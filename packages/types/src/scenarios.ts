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

// The list carries `monthly` per row (unlike the single-scenario
// `scenarioPublicSchema`) — computed backend-side so a persistently visible
// list of scenarios can show "¿cuánto cuesta?" from one request (ADR-0006).
export const scenarioListItemSchema = scenarioPublicSchema.extend({
  monthly: z.number(),
});

export type ScenarioListItem = z.infer<typeof scenarioListItemSchema>;

export const scenarioListResponseSchema = paginatedResponseSchema(scenarioListItemSchema);

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

// --- Change review (RFC-0023.1) ---------------------------------------------
//
// Each ScenarioChange explains exactly what drifted, field by field, instead
// of a generic "has updates" flag. `kind: "visual"` (a rename) applies the
// moment the review panel opens, no confirmation needed; `kind: "financial"`
// (anything that moves a total) stays listed until the user checks it and
// confirms. To add a new type later, add one variant to the union below —
// the review dialog renders by `kind` + a per-`type` message, so a new type
// only needs its own case in the message-formatting switch, nothing else.

export const scenarioChangeKindSchema = z.enum(["visual", "financial"]);

export type ScenarioChangeKind = z.infer<typeof scenarioChangeKindSchema>;

const scenarioChangeBaseSchema = z.object({
  id: z.string(),
  kind: scenarioChangeKindSchema,
  originScenarioId: z.uuid(),
  originScenarioName: z.string(),
});

export const itemRenamedChangeSchema = scenarioChangeBaseSchema.extend({
  type: z.literal("ITEM_RENAMED"),
  scenarioItemId: z.uuid(),
  expenseItemId: z.uuid(),
  from: z.string(),
  to: z.string(),
});

export const itemCategoryRenamedChangeSchema = scenarioChangeBaseSchema.extend({
  type: z.literal("ITEM_CATEGORY_RENAMED"),
  scenarioItemId: z.uuid(),
  expenseItemId: z.uuid(),
  itemName: z.string(),
  from: z.string(),
  to: z.string(),
});

export const itemPriceChangedSchema = scenarioChangeBaseSchema.extend({
  type: z.literal("ITEM_PRICE_CHANGED"),
  scenarioItemId: z.uuid(),
  expenseItemId: z.uuid(),
  itemName: z.string(),
  currency: z.string().length(3),
  from: z.number(),
  to: z.number(),
});

export const itemFrequencyChangedSchema = scenarioChangeBaseSchema.extend({
  type: z.literal("ITEM_FREQUENCY_CHANGED"),
  scenarioItemId: z.uuid(),
  expenseItemId: z.uuid(),
  itemName: z.string(),
  from: expenseItemFrequencySchema,
  to: expenseItemFrequencySchema,
});

export const itemArchivedChangeSchema = scenarioChangeBaseSchema.extend({
  type: z.literal("ITEM_ARCHIVED"),
  scenarioItemId: z.uuid(),
  expenseItemId: z.uuid(),
  itemName: z.string(),
});

export const incomeRenamedChangeSchema = scenarioChangeBaseSchema.extend({
  type: z.literal("INCOME_RENAMED"),
  scenarioIncomeId: z.uuid(),
  incomeId: z.uuid(),
  from: z.string(),
  to: z.string(),
});

export const incomeAmountChangedSchema = scenarioChangeBaseSchema.extend({
  type: z.literal("INCOME_AMOUNT_CHANGED"),
  scenarioIncomeId: z.uuid(),
  incomeId: z.uuid(),
  incomeName: z.string(),
  currency: z.string().length(3),
  from: z.number(),
  to: z.number(),
});

export const incomeFrequencyChangedSchema = scenarioChangeBaseSchema.extend({
  type: z.literal("INCOME_FREQUENCY_CHANGED"),
  scenarioIncomeId: z.uuid(),
  incomeId: z.uuid(),
  incomeName: z.string(),
  from: incomeFrequencySchema,
  to: incomeFrequencySchema,
});

export const incomeArchivedChangeSchema = scenarioChangeBaseSchema.extend({
  type: z.literal("INCOME_ARCHIVED"),
  scenarioIncomeId: z.uuid(),
  incomeId: z.uuid(),
  incomeName: z.string(),
});

export const newItemAvailableChangeSchema = scenarioChangeBaseSchema.extend({
  type: z.literal("NEW_ITEM_AVAILABLE"),
  categoryId: z.uuid(),
  categoryName: z.string(),
  expenseItemId: z.uuid(),
  itemName: z.string(),
  currency: z.string().length(3),
  amount: z.number(),
  frequency: expenseItemFrequencySchema,
});

export const scenarioChangeSchema = z.discriminatedUnion("type", [
  itemRenamedChangeSchema,
  itemCategoryRenamedChangeSchema,
  itemPriceChangedSchema,
  itemFrequencyChangedSchema,
  itemArchivedChangeSchema,
  incomeRenamedChangeSchema,
  incomeAmountChangedSchema,
  incomeFrequencyChangedSchema,
  incomeArchivedChangeSchema,
  newItemAvailableChangeSchema,
]);

export type ScenarioChange = z.infer<typeof scenarioChangeSchema>;

export const scenarioChangesResponseSchema = z.object({
  data: z.array(scenarioChangeSchema),
});

export const applyScenarioChangesBodySchema = z.object({
  changeIds: z.array(z.string()).min(1),
});

export type ApplyScenarioChangesBody = z.infer<typeof applyScenarioChangesBodySchema>;

export const applyScenarioChangesResponseSchema = z.object({
  appliedCount: z.number(),
});

export type ApplyScenarioChangesResponse = z.infer<typeof applyScenarioChangesResponseSchema>;

// --- Category watches (ADR-0005 §7 / RFC-0023.1) ----------------------------

export const scenarioCategoryWatchPublicSchema = z.object({
  id: z.uuid(),
  categoryId: z.uuid(),
  categoryName: z.string(),
});

export type ScenarioCategoryWatchPublic = z.infer<typeof scenarioCategoryWatchPublicSchema>;

export const addScenarioCategoryBodySchema = z.object({
  categoryId: z.uuid(),
});

export type AddScenarioCategoryBody = z.infer<typeof addScenarioCategoryBodySchema>;

export const addScenarioCategoryResponseSchema = z.object({
  addedCount: z.number(),
  watch: scenarioCategoryWatchPublicSchema,
});

export type AddScenarioCategoryResponse = z.infer<typeof addScenarioCategoryResponseSchema>;
