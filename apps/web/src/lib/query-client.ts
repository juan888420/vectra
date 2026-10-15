import { QueryClient } from "@tanstack/react-query";

import { ApiError } from "./api-client.js";

// One retry, and only for failures a retry can fix (network errors, 5xx). A
// 4xx is the server's answer, not a hiccup — and retrying a 429 would spend
// the rate-limit budget that just ran out.
export function shouldRetry(failureCount: number, error: unknown): boolean {
  if (error instanceof ApiError && error.statusCode < 500) {
    return false;
  }
  return failureCount < 1;
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: shouldRetry,
    },
  },
});
