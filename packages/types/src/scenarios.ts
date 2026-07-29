import { z } from "zod";

import { paginatedResponseSchema } from "./pagination.js";

// Hand-mirrored from apps/api/src/features/scenarios/scenarios.schemas.ts,
// same string-dates caveat as expense-items.ts.

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
  status: scenarioStatusSchema.default("ACTIVE"),
});

export type CreateScenarioBody = z.infer<typeof createScenarioBodySchema>;

export const updateScenarioBodySchema = z
  .object({
    name: z.string().trim().min(1).max(80),
    status: scenarioStatusSchema,
  })
  .partial()
  .refine((body) => Object.keys(body).length > 0, { message: "At least one field is required" });

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

export const scenarioItemSchema = z.object({
  id: z.uuid(),
  scenarioId: z.uuid(),
  expenseItemId: z.uuid(),
  addedViaCategoryId: z.uuid().nullable(),
  addedAt: z.string(),
});

export type ScenarioItem = z.infer<typeof scenarioItemSchema>;

export const addScenarioItemBodySchema = z.object({
  expenseItemId: z.uuid(),
});

export type AddScenarioItemBody = z.infer<typeof addScenarioItemBodySchema>;

export const addScenarioCategoryBodySchema = z.object({
  categoryId: z.uuid(),
});

export type AddScenarioCategoryBody = z.infer<typeof addScenarioCategoryBodySchema>;

export const scenarioCompositionSchema = z.object({
  id: z.uuid(),
  parentScenarioId: z.uuid(),
  includedScenarioId: z.uuid(),
  addedAt: z.string(),
});

export type ScenarioComposition = z.infer<typeof scenarioCompositionSchema>;

export const addScenarioCompositionBodySchema = z.object({
  includedScenarioId: z.uuid(),
});

export type AddScenarioCompositionBody = z.infer<typeof addScenarioCompositionBodySchema>;

export const scenarioIncomeSchema = z.object({
  id: z.uuid(),
  scenarioId: z.uuid(),
  incomeId: z.uuid(),
  addedAt: z.string(),
});

export type ScenarioIncome = z.infer<typeof scenarioIncomeSchema>;

export const addScenarioIncomeBodySchema = z.object({
  incomeId: z.uuid(),
});

export type AddScenarioIncomeBody = z.infer<typeof addScenarioIncomeBodySchema>;

export const scenarioTotalsSchema = z.object({
  monthlyTotal: z.number(),
  oneTimeTotal: z.number(),
  incomeMonthlyTotal: z.number(),
  coveragePercent: z.number().nullable(),
});

export type ScenarioTotals = z.infer<typeof scenarioTotalsSchema>;

export const pendingCategorySyncSchema = z.object({
  categoryId: z.uuid(),
  addedItemIds: z.array(z.uuid()),
  currentActiveItemIds: z.array(z.uuid()),
});

export type PendingCategorySync = z.infer<typeof pendingCategorySyncSchema>;
