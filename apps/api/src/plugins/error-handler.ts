import type { ErrorCode } from "@vectra/types";
import type { FastifyError, FastifyInstance } from "fastify";
import {
  hasZodFastifySchemaValidationErrors,
  isResponseSerializationError,
} from "fastify-type-provider-zod";

import { isHttpError } from "../lib/http-errors.js";

// Every error leaves the API with this shape. `code` is the stable identifier
// the frontend maps to user-facing copy; `message` is an English technical
// detail that no UI ever renders.
interface ErrorResponse {
  statusCode: number;
  error: string;
  code: ErrorCode;
  message: string;
  issues?: { path: string; message: string }[];
}

// Only errors we raised on purpose (HttpError) carry a message worth
// forwarding. Anything else — a Prisma constraint violation, a TypeError, a
// framework error — gets a fixed message in *every* environment, so an
// internal detail (table, column, constraint name, stack) can never reach a
// client just because NODE_ENV isn't "production".
const UNEXPECTED_MESSAGE = "Unexpected error";

export function registerErrorHandler(app: FastifyInstance): void {
  app.setErrorHandler((error: FastifyError, request, reply) => {
    if (hasZodFastifySchemaValidationErrors(error)) {
      const response: ErrorResponse = {
        statusCode: 400,
        error: "Bad Request",
        code: "VALIDATION_FAILED",
        message: "Request validation failed",
        issues: error.validation.map((issue) => ({
          path: issue.instancePath.replaceAll("/", ".").replace(/^\./, ""),
          message: issue.message ?? "Invalid value",
        })),
      };
      return reply.status(400).send(response);
    }

    if (isResponseSerializationError(error)) {
      request.log.error(error, "response failed schema serialization");
      return reply.status(500).send({
        statusCode: 500,
        error: "Internal Server Error",
        code: "INTERNAL_ERROR",
        message: UNEXPECTED_MESSAGE,
      } satisfies ErrorResponse);
    }

    if (isHttpError(error)) {
      return reply.status(error.statusCode).send({
        statusCode: error.statusCode,
        error: error.name,
        code: error.code,
        message: error.message,
      } satisfies ErrorResponse);
    }

    // Not ours: log the real thing, tell the client only what it can act on.
    const statusCode = error.statusCode && error.statusCode >= 400 ? error.statusCode : 500;
    request.log.error(error);

    const code: ErrorCode =
      statusCode === 429
        ? "RATE_LIMITED"
        : statusCode === 401
          ? "UNAUTHENTICATED"
          : "INTERNAL_ERROR";

    return reply.status(statusCode).send({
      statusCode,
      error: statusCode >= 500 ? "Internal Server Error" : "Error",
      code,
      message: UNEXPECTED_MESSAGE,
    } satisfies ErrorResponse);
  });

  app.setNotFoundHandler((request, reply) => {
    return reply.status(404).send({
      statusCode: 404,
      error: "Not Found",
      code: "RESOURCE_NOT_FOUND",
      // Deliberately does not echo the requested method/url back.
      message: "Route not found",
    } satisfies ErrorResponse);
  });
}
