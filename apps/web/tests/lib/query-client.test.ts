import { describe, expect, it } from "vitest";

import { ApiError } from "../../src/lib/api-client.js";
import { shouldRetry } from "../../src/lib/query-client.js";

describe("query retry policy", () => {
  it("never retries a rate-limited request", () => {
    const error = new ApiError(429, "Too Many Requests", "Rate limited", "RATE_LIMITED");

    expect(shouldRetry(0, error)).toBe(false);
  });

  it("never retries other client errors", () => {
    expect(shouldRetry(0, new ApiError(404, "Not Found", "Missing", "RESOURCE_NOT_FOUND"))).toBe(
      false,
    );
  });

  it("retries a server error or network failure once", () => {
    const serverError = new ApiError(500, "Internal Server Error", "Boom", "INTERNAL_ERROR");

    expect(shouldRetry(0, serverError)).toBe(true);
    expect(shouldRetry(1, serverError)).toBe(false);
    expect(shouldRetry(0, new TypeError("Failed to fetch"))).toBe(true);
  });
});
