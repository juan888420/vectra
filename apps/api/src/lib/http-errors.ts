import type { ErrorCode } from "@vectra/types";

// Errors with an HTTP status the global error handler maps to the standard
// ErrorResponse shape (`name` becomes the `error` field).
//
// `code` is what the frontend actually shows the user, via its own copy layer;
// `message` is an English technical detail for logs and Swagger. Keep them in
// sync in meaning, but never write `message` expecting a user to read it.

export class HttpError extends Error {
  constructor(
    public readonly statusCode: number,
    name: string,
    public readonly code: ErrorCode,
    message: string,
  ) {
    super(message);
    this.name = name;
  }
}

export const badRequest = (code: ErrorCode, message: string): HttpError =>
  new HttpError(400, "Bad Request", code, message);

export const unauthorized = (
  code: ErrorCode = "UNAUTHENTICATED",
  message = "Unauthorized",
): HttpError => new HttpError(401, "Unauthorized", code, message);

export const notFound = (message: string, code: ErrorCode = "RESOURCE_NOT_FOUND"): HttpError =>
  new HttpError(404, "Not Found", code, message);

export const conflict = (code: ErrorCode, message: string): HttpError =>
  new HttpError(409, "Conflict", code, message);

export function isHttpError(error: unknown): error is HttpError {
  return error instanceof HttpError;
}
