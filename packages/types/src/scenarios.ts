import { z } from "zod";

import { expenseItemFrequencySchema } from "./expense-items.js";
import { incomeFrequencySchema } from "./incomes.js";
import { paginatedResponseSchema } from "./pagination.js";
import { scenarioImpactChangeSchema } from "./scenario-impact.js";

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
  // Pins this scenario's snapshot to a frequency other than the product's own
  // — e.g. simulating an annual-billed subscription here while the real
  // product stays monthly. Omitted keeps the product's current frequency.
  frequency: expenseItemFrequencySchema.optional(),
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
  // Same semantics as ScenarioItem/ScenarioIncome's `outdated`: this
  // composed scenario itself has unsynced financial drift (RFC-0023.3). No
  // per-change detail here — that's what opening the child scenario is for.
  outdated: z.boolean(),
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
  // Same list `hasUpdates` is derived from, described per resource — feeds
  // the "Cambios pendientes" summary shown above "Aplicar cambios
  // pendientes", built by the exact same describer as ScenarioImpactDialog
  // (RFC-0023.3).
  pendingChanges: z.array(scenarioImpactChangeSchema),
});

export type ScenarioSummary = z.infer<typeof scenarioSummarySchema>;

// --- Change review (RFC-0023.1, kept as backend capability) ----------------
//
// Each ScenarioChange explains exactly what drifted, field by field. Since
// RFC-0023.3 (sync-on-write) nothing in the UI consumes this: visual drift
// syncs inline when the source is saved, and financial drift is surfaced at
// save time through `affectedScenarios` on the resource's own mutation
// response. Kept as a general-purpose capability for a future feature that
// needs the full field-by-field explanation.

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

// --- "Add whole category" (ADR-0005 §7) ------------------------------------
//
// A selection helper only: it expands to individual ScenarioItems right
// away. The scenario keeps no live relationship with the category, so a
// product created there later never surfaces here on its own (RFC-0023.3).

export const addScenarioCategoryBodySchema = z.object({
  categoryId: z.uuid(),
});

export type AddScenarioCategoryBody = z.infer<typeof addScenarioCategoryBodySchema>;

export const addScenarioCategoryResponseSchema = z.object({
  addedCount: z.number(),
});

export type AddScenarioCategoryResponse = z.infer<typeof addScenarioCategoryResponseSchema>;

// --- Scenario-level sync (RFC-0023.3) --------------------------------------
//
// The "Actualizar" action: applies every pending financial change reachable
// from this scenario at once, with no per-change selection.
export const syncScenarioResponseSchema = z.object({
  syncedCount: z.number(),
});

export type SyncScenarioResponse = z.infer<typeof syncScenarioResponseSchema>;
