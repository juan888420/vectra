import { z } from "zod";

import { moneyAmountSchema } from "./money.js";
import { paginatedResponseSchema } from "./pagination.js";
import { withAffectedScenariosSchema } from "./scenario-impact.js";

// Hand-mirrored from apps/api/src/features/incomes/incomes.schemas.ts, same
// string-dates caveat as expense-items.ts.

export const incomeFrequencySchema = z.enum(["WEEKLY", "MONTHLY", "YEARLY", "ONE_TIME"]);

export type IncomeFrequency = z.infer<typeof incomeFrequencySchema>;

export const incomePublicSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  amount: z.number(),
  currency: z.string().length(3),
  frequency: incomeFrequencySchema,
  archivedAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type IncomePublic = z.infer<typeof incomePublicSchema>;

export const createIncomeBodySchema = z.object({
  name: z.string().trim().min(1).max(80),
  amount: moneyAmountSchema,
  frequency: incomeFrequencySchema.default("MONTHLY"),
});

export type CreateIncomeBody = z.infer<typeof createIncomeBodySchema>;

export const updateIncomeBodySchema = z
  .object({
    name: z.string().trim().min(1).max(80),
    amount: moneyAmountSchema,
    frequency: incomeFrequencySchema,
  })
  .partial()
  .refine((body) => Object.keys(body).length > 0, { message: "At least one field is required" });

export type UpdateIncomeBody = z.infer<typeof updateIncomeBodySchema>;

// Same save-always-report-impact contract as expense items (RFC-0023.3).
export const incomeMutationResponseSchema = withAffectedScenariosSchema(incomePublicSchema);

export type IncomeMutationResponse = z.infer<typeof incomeMutationResponseSchema>;

export const incomeListResponseSchema = paginatedResponseSchema(incomePublicSchema);

export interface ListIncomesQuery {
  page?: number;
  pageSize?: number;
  sortBy?: "name" | "createdAt" | "amount";
  sortOrder?: "asc" | "desc";
  frequency?: IncomeFrequency;
  includeArchived?: boolean;
}

// "¿Cuánto dinero genera este ingreso?" (ADR-0006) — derived, never stored.
// `totals` is null for ONE_TIME incomes (no period to project).
export const incomeSummarySchema = z.object({
  income: incomePublicSchema,
  totals: z
    .object({
      monthly: z.number(),
      sixMonths: z.number(),
      twelveMonths: z.number(),
    })
    .nullable(),
});

export type IncomeSummary = z.infer<typeof incomeSummarySchema>;
