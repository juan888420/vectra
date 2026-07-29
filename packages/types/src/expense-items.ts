import { z } from "zod";

import { moneyAmountSchema } from "./money.js";
import { paginatedResponseSchema } from "./pagination.js";

// Hand-mirrored from apps/api/src/features/expense-items/expense-items.schemas.ts.
// `archivedAt`/`createdAt`/`updatedAt` are strings, not the backend's own
// `z.date()`, for the same reason as accounts.ts: JSON never produces Dates.

export const expenseItemFrequencySchema = z.enum(["MONTHLY", "YEARLY", "ONE_TIME"]);

export type ExpenseItemFrequency = z.infer<typeof expenseItemFrequencySchema>;

export const expenseItemPublicSchema = z.object({
  id: z.uuid(),
  categoryId: z.uuid(),
  name: z.string(),
  amount: z.number(),
  currency: z.string().length(3),
  frequency: expenseItemFrequencySchema,
  archivedAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type ExpenseItemPublic = z.infer<typeof expenseItemPublicSchema>;

// `currency` is never collected: the server always applies the user's default
// currency (business rule 9), same as accounts and budgets.
export const createExpenseItemBodySchema = z.object({
  categoryId: z.uuid(),
  name: z.string().trim().min(1).max(80),
  amount: moneyAmountSchema,
  frequency: expenseItemFrequencySchema.default("MONTHLY"),
});

export type CreateExpenseItemBody = z.infer<typeof createExpenseItemBodySchema>;

export const updateExpenseItemBodySchema = z
  .object({
    categoryId: z.uuid(),
    name: z.string().trim().min(1).max(80),
    amount: moneyAmountSchema,
    frequency: expenseItemFrequencySchema,
  })
  .partial()
  .refine((body) => Object.keys(body).length > 0, { message: "At least one field is required" });

export type UpdateExpenseItemBody = z.infer<typeof updateExpenseItemBodySchema>;

export const expenseItemListResponseSchema = paginatedResponseSchema(expenseItemPublicSchema);

export interface ListExpenseItemsQuery {
  page?: number;
  pageSize?: number;
  sortBy?: "name" | "createdAt" | "amount";
  sortOrder?: "asc" | "desc";
  categoryId?: string;
  frequency?: ExpenseItemFrequency;
  includeArchived?: boolean;
}
