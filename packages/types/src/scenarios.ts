import { z } from "zod";

import { expenseItemFrequencySchema } from "./expense-items.js";
import { incomeFrequencySchema } from "./incomes.js";
import { paginatedResponseSchema } from "./pagination.js";

// Hand-mirrored from apps/api/src/features/scenarios/scenarios.schemas.ts,
// same string-dates caveat as expense-items.ts/incomes.ts.

export const scenarioStatusSchema = z.enum(["ACTIVE", "INACTIVE", "ARCHIVED"]);

export type ScenarioStatus = z.infer<typeof scenarioStatusSchema>;

export const scenarioPublicSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  status: scenarioStatusSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type ScenarioPublic = z.infer<typeof scenarioPublicSchema>;

export const createScenarioBodySchema = z.object({
  name: z.string().trim().min(1).max(80),
});

export type CreateScenarioBody = z.infer<typeof createScenarioBodySchema>;

export const updateScenarioBodySchema = z.object({
  name: z.string().trim().min(1).max(80),
});

export type UpdateScenarioBody = z.infer<typeof updateScenarioBodySchema>;

export const scenarioListResponseSchema = paginatedResponseSchema(scenarioPublicSchema);

export interface ListScenariosQuery {
  page?: number;
  pageSize?: number;
  sortBy?: "name" | "createdAt";
  sortOrder?: "asc" | "desc";
  status?: ScenarioStatus;
  includeArchived?: boolean;
}

// A frozen snapshot, plus `outdated` computed server-side by comparing
// `lastSyncedAt` against the live source's `updatedAt` (ADR-0005 principle
// 2) — never recomputed on the client.
export const scenarioItemPublicSchema = z.object({
  id: z.uuid(),
  expenseItemId: z.uuid(),
  name: z.string(),
  amount: z.number(),
  currency: z.string().length(3),
  frequency: expenseItemFrequencySchema,
  categoryName: z.string(),
  lastSyncedAt: z.string(),
  outdated: z.boolean(),
});

export type ScenarioItemPublic = z.infer<typeof scenarioItemPublicSchema>;

export const addScenarioItemBodySchema = z.object({
  expenseItemId: z.uuid(),
});

export type AddScenarioItemBody = z.infer<typeof addScenarioItemBodySchema>;

export const scenarioIncomePublicSchema = z.object({
  id: z.uuid(),
  incomeId: z.uuid(),
  name: z.string(),
  amount: z.number(),
  currency: z.string().length(3),
  frequency: incomeFrequencySchema,
  lastSyncedAt: z.string(),
  outdated: z.boolean(),
});

export type ScenarioIncomePublic = z.infer<typeof scenarioIncomePublicSchema>;

export const addScenarioIncomeBodySchema = z.object({
  incomeId: z.uuid(),
});

export type AddScenarioIncomeBody = z.infer<typeof addScenarioIncomeBodySchema>;

export const scenarioCompositionPublicSchema = z.object({
  id: z.uuid(),
  childScenarioId: z.uuid(),
  childScenarioName: z.string(),
});

export type ScenarioCompositionPublic = z.infer<typeof scenarioCompositionPublicSchema>;

export const addScenarioCompositionBodySchema = z.object({
  childScenarioId: z.uuid(),
});

export type AddScenarioCompositionBody = z.infer<typeof addScenarioCompositionBodySchema>;

// Derived (never stored): totals, naive 6/12-month projections, one-time
// items kept apart, income coverage when at least one income is linked, and
// whether any item/income/composed scenario has drifted from its source.
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

export type ScenarioSummary = z.infer<typeof scenarioSummarySchema>;
