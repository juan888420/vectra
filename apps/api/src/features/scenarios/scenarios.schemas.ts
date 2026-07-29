import { z } from "zod";

import {
  paginatedResponseSchema,
  paginationQuerySchema,
  queryBooleanSchema,
  sortQuerySchema,
} from "../../lib/pagination.js";

// ACTIVE has no forced uniqueness (ADR-0006): several scenarios can be
// candidates for comparison at once, there is no single fixed baseline.
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
  status: scenarioStatusSchema.default("ACTIVE"),
});

export const updateScenarioBodySchema = z
  .object({
    name: z.string().trim().min(1).max(80),
    status: scenarioStatusSchema,
  })
  .partial()
  .refine((body) => Object.keys(body).length > 0, { message: "At least one field is required" });

export const listScenariosQuerySchema = paginationQuerySchema
  .extend(sortQuerySchema(["name", "createdAt"], "name").shape)
  .extend({
    status: scenarioStatusSchema.optional(),
    includeArchived: queryBooleanSchema,
  });

export const scenarioListResponseSchema = paginatedResponseSchema(scenarioPublicSchema);

// --- Scenario items (expense items selected in a scenario) ---

export const scenarioItemSchema = z.object({
  id: z.uuid(),
  scenarioId: z.uuid(),
  expenseItemId: z.uuid(),
  addedViaCategoryId: z.uuid().nullable(),
  addedAt: z.date(),
});

export const addScenarioItemBodySchema = z.object({
  expenseItemId: z.uuid(),
});

// "Add whole category" shortcut (ADR-0006): selects every active item in the
// category at this moment and stamps addedViaCategoryId for passive
// propagation later. Not a live subscription to the category.
export const addScenarioCategoryBodySchema = z.object({
  categoryId: z.uuid(),
});

// --- Scenario composition (scenario ↔ scenario) ---

export const scenarioCompositionSchema = z.object({
  id: z.uuid(),
  parentScenarioId: z.uuid(),
  includedScenarioId: z.uuid(),
  addedAt: z.date(),
});

export const addScenarioCompositionBodySchema = z.object({
  includedScenarioId: z.uuid(),
});

// --- Scenario incomes (scenario ↔ income) ---

export const scenarioIncomeSchema = z.object({
  id: z.uuid(),
  scenarioId: z.uuid(),
  incomeId: z.uuid(),
  addedAt: z.date(),
});

export const addScenarioIncomeBodySchema = z.object({
  incomeId: z.uuid(),
});

// --- Totals / coverage / passive sync notice ---

export const scenarioTotalsSchema = z.object({
  monthlyTotal: z.number(),
  oneTimeTotal: z.number(),
  incomeMonthlyTotal: z.number(),
  coveragePercent: z.number().nullable(),
});

export const pendingCategorySyncSchema = z.object({
  categoryId: z.uuid(),
  addedItemIds: z.array(z.uuid()),
  currentActiveItemIds: z.array(z.uuid()),
});

export type ScenarioStatus = z.infer<typeof scenarioStatusSchema>;
export type CreateScenarioBody = z.infer<typeof createScenarioBodySchema>;
export type UpdateScenarioBody = z.infer<typeof updateScenarioBodySchema>;
export type ListScenariosQuery = z.infer<typeof listScenariosQuerySchema>;
export type AddScenarioItemBody = z.infer<typeof addScenarioItemBodySchema>;
export type AddScenarioCategoryBody = z.infer<typeof addScenarioCategoryBodySchema>;
export type AddScenarioCompositionBody = z.infer<typeof addScenarioCompositionBodySchema>;
export type AddScenarioIncomeBody = z.infer<typeof addScenarioIncomeBodySchema>;
