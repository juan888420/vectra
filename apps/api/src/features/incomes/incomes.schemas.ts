import { z } from "zod";

import {
  paginatedResponseSchema,
  paginationQuerySchema,
  queryBooleanSchema,
  sortQuerySchema,
} from "../../lib/pagination.js";
import { moneyAmountSchema, withAffectedScenarios } from "../../lib/schemas.js";

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

// See expense-items.schemas.ts's expenseItemMutationResponseSchema — same
// save-always-report-impact contract (RFC-0023.3).
export const incomeMutationResponseSchema = withAffectedScenarios(incomePublicSchema);

export const syncIncomeScenariosResponseSchema = z.object({
  syncedCount: z.number(),
});

export const listIncomesQuerySchema = paginationQuerySchema
  .extend(sortQuerySchema(["name", "createdAt", "amount"], "name").shape)
  .extend({
    frequency: incomeFrequencySchema.optional(),
    includeArchived: queryBooleanSchema,
  });

export const incomeListResponseSchema = paginatedResponseSchema(incomePublicSchema);

// Duplicated literal rather than importing from scenarios.schemas.ts: that
// module already imports from this one (incomeFrequencySchema), so importing
// back would create a cycle over a 3-value enum that never changes. Same
// reasoning as expense-items.schemas.ts's scenarioUsageStatusSchema.
const scenarioUsageStatusSchema = z.enum(["ACTIVE", "INACTIVE", "ARCHIVED"]);

// "¿Cuánto dinero genera este ingreso?" (ADR-0006) — derived, never stored.
// `ONE_TIME` incomes have no period to project (business rule from ADR-0005
// §14), so `totals` is null rather than a misleading zeroed-out projection.
// `scenarios` answers "en qué escenarios se usa" (same business question as
// expense-items' summary) — ScenarioIncome isn't queryable from the client.
export const incomeSummarySchema = z.object({
  income: incomePublicSchema,
  totals: z
    .object({
      monthly: z.number(),
      sixMonths: z.number(),
      twelveMonths: z.number(),
    })
    .nullable(),
  scenarios: z.array(
    z.object({ id: z.uuid(), name: z.string(), status: scenarioUsageStatusSchema }),
  ),
});

export type CreateIncomeBody = z.infer<typeof createIncomeBodySchema>;
export type UpdateIncomeBody = z.infer<typeof updateIncomeBodySchema>;
export type ListIncomesQuery = z.infer<typeof listIncomesQuerySchema>;
