import { z } from "zod";

import { paginatedResponseSchema } from "./pagination.js";

// Hand-mirrored from apps/api/src/features/accounts/accounts.schemas.ts.
// `archivedAt`/`createdAt`/`updatedAt` deliberately differ from the backend's
// own `z.date()` for the same reason as auth.ts: JSON.parse never produces
// Date instances, so the value that crosses the wire is a string.

export const accountTypeSchema = z.enum(["CASH", "BANK", "CREDIT_CARD", "OTHER"]);

export type AccountType = z.infer<typeof accountTypeSchema>;

export const accountPublicSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  type: accountTypeSchema,
  currency: z.string().length(3),
  archivedAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type AccountPublic = z.infer<typeof accountPublicSchema>;

// The backend also accepts an optional `currency`, but the MVP enforces a
// single currency per user and rejects any value that isn't it (business
// rule 9) — so the create form never collects it; the server always
// defaults to the user's own currency.
export const createAccountBodySchema = z.object({
  name: z.string().trim().min(1).max(50),
  type: accountTypeSchema,
});

export type CreateAccountBody = z.infer<typeof createAccountBodySchema>;

// `currency` is immutable: changing it would reinterpret every existing
// transaction amount in a different currency.
export const updateAccountBodySchema = z
  .object({
    name: z.string().trim().min(1).max(50),
    type: accountTypeSchema,
  })
  .partial()
  .refine((body) => Object.keys(body).length > 0, { message: "At least one field is required" });

export type UpdateAccountBody = z.infer<typeof updateAccountBodySchema>;

export const accountListResponseSchema = paginatedResponseSchema(accountPublicSchema);

export interface ListAccountsQuery {
  page?: number;
  pageSize?: number;
  sortBy?: "name" | "createdAt";
  sortOrder?: "asc" | "desc";
  type?: AccountType;
  includeArchived?: boolean;
}
