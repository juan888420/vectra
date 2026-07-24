import { z } from "zod";

import {
  paginatedResponseSchema,
  paginationQuerySchema,
  queryBooleanSchema,
  sortQuerySchema,
} from "../../lib/pagination.js";

export const accountTypeSchema = z.enum(["CASH", "BANK", "CREDIT_CARD", "OTHER"]);

export const accountPublicSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  type: accountTypeSchema,
  currency: z.string().length(3),
  archivedAt: z.date().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const createAccountBodySchema = z.object({
  name: z.string().trim().min(1).max(50),
  type: accountTypeSchema,
  // Defaults to the user's currency; the MVP enforces a single currency per
  // user (business rule 9), so any other value is rejected in the service.
  currency: z
    .string()
    .length(3)
    .toUpperCase()
    .regex(/^[A-Z]{3}$/, "Must be an ISO 4217 code")
    .optional(),
});

// `currency` is immutable: changing it would reinterpret every existing
// transaction amount in a different currency.
export const updateAccountBodySchema = z
  .object({
    name: z.string().trim().min(1).max(50),
    type: accountTypeSchema,
  })
  .partial()
  .refine((body) => Object.keys(body).length > 0, { message: "At least one field is required" });

export const listAccountsQuerySchema = paginationQuerySchema
  .extend(sortQuerySchema(["name", "createdAt"], "name").shape)
  .extend({
    type: accountTypeSchema.optional(),
    includeArchived: queryBooleanSchema,
  });

export const accountListResponseSchema = paginatedResponseSchema(accountPublicSchema);

export type CreateAccountBody = z.infer<typeof createAccountBodySchema>;
export type UpdateAccountBody = z.infer<typeof updateAccountBodySchema>;
export type ListAccountsQuery = z.infer<typeof listAccountsQuerySchema>;
