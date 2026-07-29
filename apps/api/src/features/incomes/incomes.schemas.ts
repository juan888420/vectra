import { z } from "zod";

import {
  paginatedResponseSchema,
  paginationQuerySchema,
  queryBooleanSchema,
  sortQuerySchema,
} from "../../lib/pagination.js";
import { moneyAmountSchema } from "../../lib/schemas.js";

// Wider than expenseItemFrequencySchema on purpose: weekly pay is common,
// weekly subscriptions are not (ADR-0005 §13). ONE_TIME incomes (a bonus)
// are excluded from the recurring projections.
export const incomeFrequencySchema = z.enum(["WEEKLY", "MONTHLY", "YEARLY", "ONE_TIME"]);

export const incomePublicSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  amount: z.number(),
  currency: z.string().length(3),
  frequency: incomeFrequencySchema,
  archivedAt: z.date().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

// `currency` derives from the user's default currency, like every other
// Money-carrying resource.
export const createIncomeBodySchema = z.object({
  name: z.string().trim().min(1).max(80),
  amount: moneyAmountSchema,
  frequency: incomeFrequencySchema.default("MONTHLY"),
});

export const updateIncomeBodySchema = z
  .object({
    name: z.string().trim().min(1).max(80),
    amount: moneyAmountSchema,
    frequency: incomeFrequencySchema,
  })
  .partial()
  .refine((body) => Object.keys(body).length > 0, { message: "At least one field is required" });

export const listIncomesQuerySchema = paginationQuerySchema
  .extend(sortQuerySchema(["name", "createdAt", "amount"], "name").shape)
  .extend({
    frequency: incomeFrequencySchema.optional(),
    includeArchived: queryBooleanSchema,
  });

export const incomeListResponseSchema = paginatedResponseSchema(incomePublicSchema);

export type CreateIncomeBody = z.infer<typeof createIncomeBodySchema>;
export type UpdateIncomeBody = z.infer<typeof updateIncomeBodySchema>;
export type ListIncomesQuery = z.infer<typeof listIncomesQuerySchema>;
