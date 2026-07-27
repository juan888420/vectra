import { z } from "zod";

import {
  paginatedResponseSchema,
  paginationQuerySchema,
  queryBooleanSchema,
  sortQuerySchema,
} from "../../lib/pagination.js";
import { moneyAmountSchema } from "../../lib/schemas.js";

// Only MONTHLY exists in the MVP (BudgetPeriod in the Prisma schema);
// WEEKLY/CUSTOM are reserved for later per RFC-0006 §6.
export const budgetPeriodSchema = z.enum(["MONTHLY"]);

export const budgetStatusSchema = z.enum(["ON_TRACK", "WARNING", "EXCEEDED"]);

// `spent`/`remaining`/`percentUsed`/`status` are never stored (business rule
// 7): always derived from Transaction at read time.
export const budgetPublicSchema = z.object({
  id: z.uuid(),
  categoryId: z.uuid(),
  amount: z.number(),
  currency: z.string().length(3),
  period: budgetPeriodSchema,
  archivedAt: z.date().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
  spent: z.number(),
  remaining: z.number(),
  percentUsed: z.number(),
  status: budgetStatusSchema,
});

// `currency` is derived from the user's default currency (same reasoning as
// Account.currency in RFC-0011); `period` defaults to the only supported value.
export const createBudgetBodySchema = z.object({
  categoryId: z.uuid(),
  amount: moneyAmountSchema,
  period: budgetPeriodSchema.default("MONTHLY"),
});

// `categoryId`/`period` are immutable: changing either redefines what the
// budget measures, so it's a new budget instead (mirrors Account.currency).
export const updateBudgetBodySchema = z.object({
  amount: moneyAmountSchema,
});

export const listBudgetsQuerySchema = paginationQuerySchema
  .extend(sortQuerySchema(["createdAt", "amount"], "createdAt").shape)
  .extend({
    categoryId: z.uuid().optional(),
    includeArchived: queryBooleanSchema,
  });

export const budgetListResponseSchema = paginatedResponseSchema(budgetPublicSchema);

export type CreateBudgetBody = z.infer<typeof createBudgetBodySchema>;
export type UpdateBudgetBody = z.infer<typeof updateBudgetBodySchema>;
export type ListBudgetsQuery = z.infer<typeof listBudgetsQuerySchema>;
