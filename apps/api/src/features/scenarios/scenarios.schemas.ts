import { z } from "zod";

import {
  paginatedResponseSchema,
  paginationQuerySchema,
  queryBooleanSchema,
  sortQuerySchema,
} from "../../lib/pagination.js";
import { scenarioImpactChangeSchema } from "../../lib/schemas.js";
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
  // Same semantics as ScenarioItem/ScenarioIncome's `outdated`: this
  // composed scenario itself has unsynced financial drift (RFC-0023.3). No
  // per-change detail here — that's what opening the child scenario is for.
  outdated: z.boolean(),
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
  // Same list `hasUpdates` is derived from, described per resource — feeds
  // the "Cambios pendientes" summary shown above "Aplicar cambios
  // pendientes", built by the exact same describer as ScenarioImpactDialog
  // (RFC-0023.3).
  pendingChanges: z.array(scenarioImpactChangeSchema),
});

// --- Change review (RFC-0023.1, kept as backend capability) ----------------
//
// A ScenarioChange is a derived, never-stored fact: "this field of this row
// drifted from its live source". Since RFC-0023.3 (sync-on-write), nothing
// in the product calls GET/POST /scenarios/:id/changes(/apply) anymore —
// `kind: "visual"` drift syncs inline the moment the source is saved
// (reconcileExpenseItemScenarios/reconcileIncomeScenarios), and
// `kind: "financial"` drift is surfaced to the user right at save time via
// `affectedScenarios` on the resource's own PATCH/archive/unarchive
// response, not through this list. The endpoints and this union stay as a
// general-purpose capability for a future feature that needs a full,
// field-by-field explanation of what drifted.
//
// To add a new change type in the future (currency, taxes, discounts, saving
// goals...): add one literal to `scenarioChangeSchema`'s union below, one
// case in `CHANGE_KIND` and one in the apply-dispatch switch in
// scenarios.service.ts.
export const scenarioChangeKindSchema = z.enum(["visual", "financial"]);

// Shared by every change: which row it was computed from and, since a
// composed scenario's items can originate in a scenario it includes, which
// scenario actually owns the drifted row (ADR-0005 §9).
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

export const scenarioChangesResponseSchema = z.object({
  data: z.array(scenarioChangeSchema),
});

export const applyScenarioChangesBodySchema = z.object({
  changeIds: z.array(z.string()).min(1),
});

export const applyScenarioChangesResponseSchema = z.object({
  appliedCount: z.number(),
});

// --- "Add whole category" (ADR-0005 §7) — a selection helper only, no ------
// persistent link kept between the scenario and the category (RFC-0023.3).

export const addScenarioCategoryBodySchema = z.object({
  categoryId: z.uuid(),
});

export const addScenarioCategoryResponseSchema = z.object({
  addedCount: z.number(),
});

// POST /scenarios/:id/sync — the "Actualizar" action: applies every pending
// financial change reachable from the scenario in one go, no per-item
// selection (see scenarios.service.ts's syncScenario).
export const syncScenarioResponseSchema = z.object({
  syncedCount: z.number(),
});

export type SyncScenarioResponse = z.infer<typeof syncScenarioResponseSchema>;

export type CreateScenarioBody = z.infer<typeof createScenarioBodySchema>;
export type UpdateScenarioBody = z.infer<typeof updateScenarioBodySchema>;
export type ListScenariosQuery = z.infer<typeof listScenariosQuerySchema>;
export type AddScenarioItemBody = z.infer<typeof addScenarioItemBodySchema>;
export type AddScenarioIncomeBody = z.infer<typeof addScenarioIncomeBodySchema>;
export type AddScenarioCompositionBody = z.infer<typeof addScenarioCompositionBodySchema>;
export type ScenarioChange = z.infer<typeof scenarioChangeSchema>;
export type ScenarioChangeKind = z.infer<typeof scenarioChangeKindSchema>;
export type ApplyScenarioChangesBody = z.infer<typeof applyScenarioChangesBodySchema>;
export type AddScenarioCategoryBody = z.infer<typeof addScenarioCategoryBodySchema>;
