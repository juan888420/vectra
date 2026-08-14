import { z } from "zod";

// Stable, language-agnostic identifiers for every error the API can return.
// The frontend maps each one to user-facing Spanish copy
// (apps/web/src/lib/error-messages.ts); `message` stays an English technical
// detail for logs, Swagger and API consumers, and is never shown to a user.
//
// Codes are part of the API contract: rename one and the frontend silently
// falls back to the generic message, so treat them as append-only.
export const errorCodeSchema = z.enum([
  // Request shape — the frontend validates first, so this is a last resort.
  "VALIDATION_FAILED",
  // The resource does not exist, or belongs to another user (same answer on
  // purpose — see apps/api/src/lib/ownership.ts).
  "RESOURCE_NOT_FOUND",
  // An active resource of the same kind already uses that name.
  "DUPLICATE_NAME",
  // Delete blocked: a scenario still references this product/income/scenario.
  "RESOURCE_IN_USE",
  // Delete blocked: the category still holds products, which the UI can move
  // elsewhere before deleting (MoveItemsAndDeleteCategoryDialog).
  "CATEGORY_HAS_ITEMS",
  // Delete blocked by ledger rows retired in ADR-0007 (no UI can move those,
  // so archiving is the only way out) — kept apart from CATEGORY_HAS_ITEMS so
  // the copy never promises a flow that cannot resolve the block.
  "CATEGORY_HAS_RECORDS",
  // "Sin categorizar" and friends cannot be renamed, archived or deleted.
  "SYSTEM_CATEGORY",
  // The resource is archived, so it cannot be used or modified.
  "ARCHIVED_RESOURCE",
  // Already in the scenario / already linked / already included.
  "ALREADY_INCLUDED",
  // Composing these scenarios would create a direct or transitive cycle.
  "CYCLE_DETECTED",
  // The chosen category cannot hold this product (wrong type, or an invalid
  // reassignment target).
  "INVALID_CATEGORY",
  // Missing, expired or reused session credentials.
  "UNAUTHENTICATED",
  // Wrong email or password at login.
  "INVALID_CREDENTIALS",
  // Registration with an email that already exists.
  "EMAIL_TAKEN",
  // Too many requests in the current window (@fastify/rate-limit).
  "RATE_LIMITED",
  // Anything unexpected. Never carries detail from the underlying error.
  "INTERNAL_ERROR",
]);

export type ErrorCode = z.infer<typeof errorCodeSchema>;

// Mirrors apps/api/src/lib/schemas.ts's errorResponseSchema — every non-2xx
// response from the API follows this envelope.
export const errorResponseSchema = z.object({
  statusCode: z.number(),
  error: z.string(),
  code: errorCodeSchema,
  message: z.string(),
});

export type ErrorResponse = z.infer<typeof errorResponseSchema>;
