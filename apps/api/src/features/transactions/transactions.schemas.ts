import { z } from "zod";

import {
  paginatedResponseSchema,
  paginationQuerySchema,
  sortQuerySchema,
} from "../../lib/pagination.js";

// Same enum as Category.type (TransactionType in the Prisma schema); kept
// local to this feature rather than imported from categories/, per the
// feature-based architecture (features don't reach into each other).
export const transactionTypeSchema = z.enum(["EXPENSE", "INCOME"]);

// Decimal(12,2): 10 integer digits + 2 decimal digits.
const MAX_AMOUNT = 9_999_999_999.99;

const amountSchema = z
  .number()
  .positive()
  .max(MAX_AMOUNT, "Amount exceeds the maximum allowed")
  .refine((value) => Math.round(value * 100) / 100 === value, {
    message: "Amount must have at most 2 decimal places",
  });

export const transactionPublicSchema = z.object({
  id: z.uuid(),
  accountId: z.uuid(),
  categoryId: z.uuid(),
  recurringTransactionId: z.uuid().nullable(),
  amount: z.number(),
  currency: z.string().length(3),
  type: transactionTypeSchema,
  date: z.date(),
  note: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

// `currency` is not accepted here: it is derived from the Account's currency
// (same reasoning as Account.currency defaulting from the User in RFC-0011).
export const createTransactionBodySchema = z.object({
  accountId: z.uuid(),
  categoryId: z.uuid(),
  type: transactionTypeSchema,
  amount: amountSchema,
  date: z.iso.date(),
  note: z.string().trim().max(280).optional(),
});

export const updateTransactionBodySchema = z
  .object({
    accountId: z.uuid(),
    categoryId: z.uuid(),
    type: transactionTypeSchema,
    amount: amountSchema,
    date: z.iso.date(),
    note: z.string().trim().max(280).nullable(),
  })
  .partial()
  .refine((body) => Object.keys(body).length > 0, { message: "At least one field is required" });

export const listTransactionsQuerySchema = paginationQuerySchema
  .extend(sortQuerySchema(["date", "amount", "createdAt"], "date").shape)
  .extend({
    accountId: z.uuid().optional(),
    categoryId: z.uuid().optional(),
    type: transactionTypeSchema.optional(),
    dateFrom: z.iso.date().optional(),
    dateTo: z.iso.date().optional(),
    // Substring match against `note`, case-insensitive.
    search: z.string().trim().min(1).max(100).optional(),
  })
  .refine((query) => !query.dateFrom || !query.dateTo || query.dateFrom <= query.dateTo, {
    message: "dateFrom must be before or equal to dateTo",
    path: ["dateFrom"],
  });

export const transactionListResponseSchema = paginatedResponseSchema(transactionPublicSchema);

export type CreateTransactionBody = z.infer<typeof createTransactionBodySchema>;
export type UpdateTransactionBody = z.infer<typeof updateTransactionBodySchema>;
export type ListTransactionsQuery = z.infer<typeof listTransactionsQuerySchema>;
