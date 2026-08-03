import { z } from "zod";

// Lives in its own module, not scenarios.ts, to stay importable from
// expense-items.ts/incomes.ts — scenarios.ts already imports from both.

// A resource's PATCH/archive/unarchive always saves, then reports the
// non-archived scenarios whose cost would move if the change were synced
// (direct owners plus composition ancestors for products). The client shows
// the "¿actualizar ahora?" dialog off this list; declining simply leaves
// those scenarios flagged via the derived `hasUpdates` (RFC-0023.3).
export const affectedScenarioSchema = z.object({
  id: z.uuid(),
  name: z.string(),
});

export type AffectedScenario = z.infer<typeof affectedScenarioSchema>;

// Superset of ExpenseItemFrequency and IncomeFrequency, redeclared here
// rather than imported: those modules import *this* one.
const impactFrequencySchema = z.enum(["WEEKLY", "MONTHLY", "YEARLY", "ONE_TIME"]);

export type ImpactFrequency = z.infer<typeof impactFrequencySchema>;

// Which kind of resource a change belongs to — drives vocabulary ("precio"
// vs. "ingreso") in the shared frontend describer, nothing more.
export const scenarioImpactSourceSchema = z.enum(["expenseItem", "income"]);

export type ScenarioImpactSource = z.infer<typeof scenarioImpactSourceSchema>;

const scenarioImpactChangeBaseSchema = z.object({
  name: z.string(),
  source: scenarioImpactSourceSchema,
});

// What syncing would actually do, named per resource. The backend builds
// these from the same field-comparison primitives in two situations: right
// after a single product/income is saved (one resource, feeds
// ScenarioImpactDialog), and when listing a whole scenario's pending drift
// (every affected resource at once, feeds the "Cambios pendientes" summary).
// Same shape either way, so the frontend needs exactly one function to turn
// a change into text (`describeScenarioChange`).
//
// `from` is null when the affected snapshots disagree on the old value (one
// scenario was synced at a different price than another): there is no single
// honest "from" to show, so the UI renders only the destination.
export const scenarioImpactChangeSchema = z.discriminatedUnion("field", [
  scenarioImpactChangeBaseSchema.extend({
    field: z.literal("amount"),
    currency: z.string().length(3),
    from: z.number().nullable(),
    to: z.number(),
  }),
  scenarioImpactChangeBaseSchema.extend({
    field: z.literal("frequency"),
    from: impactFrequencySchema.nullable(),
    to: impactFrequencySchema,
  }),
  // The source was archived: syncing removes it from its scenarios rather
  // than updating any field, so there is no from/to to show.
  scenarioImpactChangeBaseSchema.extend({ field: z.literal("archived") }),
]);

export type ScenarioImpactChange = z.infer<typeof scenarioImpactChangeSchema>;

export function withAffectedScenariosSchema<T extends z.ZodType>(dataSchema: T) {
  return z.object({
    data: dataSchema,
    affectedScenarios: z.array(affectedScenarioSchema),
    changes: z.array(scenarioImpactChangeSchema),
  });
}

export const syncScenariosResponseSchema = z.object({
  syncedCount: z.number(),
});

export type SyncScenariosResponse = z.infer<typeof syncScenariosResponseSchema>;
