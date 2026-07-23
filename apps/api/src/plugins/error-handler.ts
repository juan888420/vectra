import type { FastifyError, FastifyInstance } from "fastify";
import {
  hasZodFastifySchemaValidationErrors,
  isResponseSerializationError,
} from "fastify-type-provider-zod";

import { env } from "../config/env.js";

// Every error leaves the API with this shape.
interface ErrorResponse {
  statusCode: number;
  error: string;
  message: string;
  issues?: { path: string; message: string }[];
}

export function registerErrorHandler(app: FastifyInstance): void {
  app.setErrorHandler((error: FastifyError, request, reply) => {
    if (hasZodFastifySchemaValidationErrors(error)) {
      const response: ErrorResponse = {
        statusCode: 400,
        error: "Bad Request",
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
        message: "Response serialization failed",
      } satisfies ErrorResponse);
    }

    const statusCode = error.statusCode && error.statusCode >= 400 ? error.statusCode : 500;

    if (statusCode >= 500) {
      request.log.error(error);
    }

    // Never leak internals of unexpected errors outside development.
    const message =
      statusCode >= 500 && env.NODE_ENV === "production" ? "Internal Server Error" : error.message;

    return reply.status(statusCode).send({
      statusCode,
      error: statusCode >= 500 ? "Internal Server Error" : (error.name ?? "Error"),
      message,
    } satisfies ErrorResponse);
  });

  app.setNotFoundHandler((request, reply) => {
    return reply.status(404).send({
      statusCode: 404,
      error: "Not Found",
      message: `Route ${request.method} ${request.url} not found`,
    } satisfies ErrorResponse);
  });
}
