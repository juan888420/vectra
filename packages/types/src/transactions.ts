import { z } from "zod";

import { moneyAmountSchema } from "./money.js";
import { paginatedResponseSchema } from "./pagination.js";

// Hand-mirrored from apps/api/src/features/transactions/transactions.schemas.ts.
// `date`/`createdAt`/`updatedAt` are strings, not the backend's own `z.date()`,
// for the same reason as auth.ts (JSON never produces Dates).

export const transactionTypeSchema = z.enum(["EXPENSE", "INCOME"]);

export type TransactionType = z.infer<typeof transactionTypeSchema>;

export const transactionPublicSchema = z.object({
  id: z.uuid(),
  accountId: z.uuid(),
  categoryId: z.uuid(),
  recurringTransactionId: z.uuid().nullable(),
  amount: z.number(),
  currency: z.string().length(3),
  type: transactionTypeSchema,
  date: z.string(),
  note: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type TransactionPublic = z.infer<typeof transactionPublicSchema>;

// `currency` is not accepted here: it is derived from the Account's currency,
// same reasoning as the backend schema.
export const createTransactionBodySchema = z.object({
  accountId: z.uuid(),
  categoryId: z.uuid(),
  type: transactionTypeSchema,
  amount: moneyAmountSchema,
  date: z.iso.date(),
  note: z.string().trim().max(280).optional(),
});

export type CreateTransactionBody = z.infer<typeof createTransactionBodySchema>;

export const updateTransactionBodySchema = z
  .object({
    accountId: z.uuid(),
    categoryId: z.uuid(),
    type: transactionTypeSchema,
    amount: moneyAmountSchema,
    date: z.iso.date(),
    note: z.string().trim().max(280).nullable(),
  })
  .partial()
  .refine((body) => Object.keys(body).length > 0, { message: "At least one field is required" });

export type UpdateTransactionBody = z.infer<typeof updateTransactionBodySchema>;

export const transactionListResponseSchema = paginatedResponseSchema(transactionPublicSchema);

export interface ListTransactionsQuery {
  page?: number;
  pageSize?: number;
  sortBy?: "date" | "amount" | "createdAt";
  sortOrder?: "asc" | "desc";
  accountId?: string;
  categoryId?: string;
  type?: TransactionType;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
}
