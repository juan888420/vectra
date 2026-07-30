import { z } from "zod";

import {
  paginatedResponseSchema,
  paginationQuerySchema,
  queryBooleanSchema,
  sortQuerySchema,
} from "../../lib/pagination.js";
import { expenseItemFrequencySchema } from "../expense-items/expense-items.schemas.js";
import { incomeFrequencySchema } from "../incomes/incomes.schemas.js";

export const scenarioStatusSchema = z.enum(["ACTIVE", "INACTIVE", "ARCHIVED"]);

export const scenarioPublicSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  status: scenarioStatusSchema,
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const createScenarioBodySchema = z.object({
  name: z.string().trim().min(1).max(80),
});

export const updateScenarioBodySchema = z.object({
  name: z.string().trim().min(1).max(80),
});

export const listScenariosQuerySchema = paginationQuerySchema
  .extend(sortQuerySchema(["name", "createdAt"], "name").shape)
  .extend({
    status: scenarioStatusSchema.optional(),
    includeArchived: queryBooleanSchema,
  });

// The list carries `monthly` (unlike the single-scenario `scenarioPublicSchema`)
// so a persistently-visible list of scenarios (ADR-0006: Escenarios as the
// main screen) can show "¿cuánto cuesta?" per row from one request, instead
// of one /summary call per scenario.
export const scenarioListItemSchema = scenarioPublicSchema.extend({
  monthly: z.number(),
});

export const scenarioListResponseSchema = paginatedResponseSchema(scenarioListItemSchema);

// A ScenarioItem is a frozen snapshot (name/amount/currency/frequency/
// categoryName) plus `outdated`, computed at read time by comparing
// `lastSyncedAt` against the live ExpenseItem's (and its category's)
// `updatedAt` — never stored (ADR-0005 principle 2).
export const scenarioItemPublicSchema = z.object({
  id: z.uuid(),
  expenseItemId: z.uuid(),
  name: z.string(),
  amount: z.number(),
  currency: z.string().length(3),
  frequency: expenseItemFrequencySchema,
  categoryName: z.string(),
  lastSyncedAt: z.date(),
  outdated: z.boolean(),
});

export const addScenarioItemBodySchema = z.object({
  expenseItemId: z.uuid(),
});

export const scenarioIncomePublicSchema = z.object({
  id: z.uuid(),
  incomeId: z.uuid(),
  name: z.string(),
  amount: z.number(),
  currency: z.string().length(3),
  frequency: incomeFrequencySchema,
  lastSyncedAt: z.date(),
  outdated: z.boolean(),
});

export const addScenarioIncomeBodySchema = z.object({
  incomeId: z.uuid(),
});

export const scenarioCompositionPublicSchema = z.object({
  id: z.uuid(),
  childScenarioId: z.uuid(),
  childScenarioName: z.string(),
});

export const addScenarioCompositionBodySchema = z.object({
  childScenarioId: z.uuid(),
});

// Derived, never stored: totals (monthly recurring, prorating YEARLY ÷12),
// naive 6/12-month projections (no real anniversary timing yet, out of scope
// per ADR-0005/roadmap Fase 3), the one-time items/incomes kept apart from
// the recurring totals, income coverage when at least one income is linked,
// and whether any item/income/composed scenario has drifted from its source.
export const scenarioSummarySchema = z.object({
  scenario: scenarioPublicSchema,
  totals: z.object({
    monthly: z.number(),
    sixMonths: z.number(),
    twelveMonths: z.number(),
  }),
  oneTime: z.object({
    items: z.array(z.object({ id: z.uuid(), name: z.string(), amount: z.number() })),
    total: z.number(),
  }),
  incomeCoverage: z
    .object({
      totalIncomeMonthly: z.number(),
      consumedPercentage: z.number(),
      remainingMonthly: z.number(),
    })
    .nullable(),
  hasUpdates: z.boolean(),
});

export type CreateScenarioBody = z.infer<typeof createScenarioBodySchema>;
export type UpdateScenarioBody = z.infer<typeof updateScenarioBodySchema>;
export type ListScenariosQuery = z.infer<typeof listScenariosQuerySchema>;
export type AddScenarioItemBody = z.infer<typeof addScenarioItemBodySchema>;
export type AddScenarioIncomeBody = z.infer<typeof addScenarioIncomeBodySchema>;
export type AddScenarioCompositionBody = z.infer<typeof addScenarioCompositionBodySchema>;
