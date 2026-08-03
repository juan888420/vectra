import { z } from "zod";

// Cross-feature request/response schemas.

export const idParamsSchema = z.object({
  id: z.uuid(),
});

export const errorResponseSchema = z.object({
  statusCode: z.number(),
  error: z.string(),
  message: z.string(),
});

// Income/expense/balance triple for a time window — shared by the dashboard
// summary and every report endpoint.
export const periodTotalsSchema = z.object({
  income: z.number(),
  expenses: z.number(),
  balance: z.number(),
});

// A scenario whose ScenarioItem/ScenarioIncome would move if the edit being
// saved right now gets synced (direct owner or a composition ancestor,
// non-archived — see scenarios.service.ts's reconcile functions).
export const affectedScenarioSchema = z.object({
  id: z.uuid(),
  name: z.string(),
});

// Superset of ExpenseItemFrequency and IncomeFrequency: this module is
// domain-agnostic, so it can't import either feature's enum.
const impactFrequencySchema = z.enum(["WEEKLY", "MONTHLY", "YEARLY", "ONE_TIME"]);

// Which kind of resource a change belongs to — drives vocabulary ("precio"
// vs. "ingreso") in the shared frontend describer, nothing more.
export const scenarioImpactSourceSchema = z.enum(["expenseItem", "income"]);

const scenarioImpactChangeBaseSchema = z.object({
  name: z.string(),
  source: scenarioImpactSourceSchema,
});

// What syncing would actually do, named per resource. Two call sites build
// these from the exact same field-comparison primitives
// (diffItemKinds/diffIncomeKinds in scenarios.service.ts): the post-edit
// dialog (summarizeItemImpact/summarizeIncomeImpact, one resource at a
// time) and a scenario's own pending-changes list (toScenarioImpactChange,
// every affected resource in the scenario at once). Same shape either way,
// so the frontend has exactly one function that turns a change into text.
//
// `from` is null when the affected snapshots disagree on the old value —
// there is no single honest "from" to show.
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
  scenarioImpactChangeBaseSchema.extend({ field: z.literal("archived") }),
]);

export type ScenarioImpactChange = z.infer<typeof scenarioImpactChangeSchema>;

// Wraps a mutation's own resource with the scenarios it would affect and
// what syncing them would change, so the resource is always saved
// immediately and the caller decides afterward whether to sync — never a
// blocking two-step save.
export function withAffectedScenarios<T extends z.ZodTypeAny>(dataSchema: T) {
  return z.object({
    data: dataSchema,
    affectedScenarios: z.array(affectedScenarioSchema),
    changes: z.array(scenarioImpactChangeSchema),
  });
}

// Decimal(12,2): 10 integer digits + 2 decimal digits — shared by every
// Money-shaped field (Transaction.amount, Budget.amount, ...).
const MAX_MONEY_AMOUNT = 9_999_999_999.99;

export const moneyAmountSchema = z
  .number()
  .positive()
  .max(MAX_MONEY_AMOUNT, "Amount exceeds the maximum allowed")
  .refine((value) => Math.round(value * 100) / 100 === value, {
    message: "Amount must have at most 2 decimal places",
  });
