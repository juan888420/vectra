// Errors with an HTTP status the global error handler maps to the standard
// ErrorResponse shape (`name` becomes the `error` field).

export class HttpError extends Error {
  constructor(
    public readonly statusCode: number,
    name: string,
    message: string,
  ) {
    super(message);
    this.name = name;
  }
}

export const badRequest = (message: string): HttpError =>
  new HttpError(400, "Bad Request", message);

export const unauthorized = (message = "Unauthorized"): HttpError =>
  new HttpError(401, "Unauthorized", message);

export const notFound = (message: string): HttpError => new HttpError(404, "Not Found", message);

export const conflict = (message: string): HttpError => new HttpError(409, "Conflict", message);
