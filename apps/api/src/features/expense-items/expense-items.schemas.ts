import { z } from "zod";

import {
  paginatedResponseSchema,
  paginationQuerySchema,
  queryBooleanSchema,
  sortQuerySchema,
} from "../../lib/pagination.js";
import { moneyAmountSchema } from "../../lib/schemas.js";

// ONE_TIME items stay out of the recurring projections (ADR-0005 §11). The
// split itself belongs to the projection layer; this feature only records it.
export const expenseItemFrequencySchema = z.enum(["MONTHLY", "YEARLY", "ONE_TIME"]);

export const expenseItemPublicSchema = z.object({
  id: z.uuid(),
  categoryId: z.uuid(),
  name: z.string(),
  amount: z.number(),
  currency: z.string().length(3),
  frequency: expenseItemFrequencySchema,
  archivedAt: z.date().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

// `currency` derives from the user's default currency (same reasoning as
// Budget.currency in RFC-0013), so clients never send it.
export const createExpenseItemBodySchema = z.object({
  categoryId: z.uuid(),
  name: z.string().trim().min(1).max(80),
  amount: moneyAmountSchema,
  frequency: expenseItemFrequencySchema.default("MONTHLY"),
});

// Every field is mutable: raising a price and moving an item to another
// category are the two core edits of the domain (ADR-0005). Propagating an
// edit to the scenarios referencing the item is the Scenario RFC's job — this
// layer never decides that on the user's behalf.
export const updateExpenseItemBodySchema = z
  .object({
    categoryId: z.uuid(),
    name: z.string().trim().min(1).max(80),
    amount: moneyAmountSchema,
    frequency: expenseItemFrequencySchema,
  })
  .partial()
  .refine((body) => Object.keys(body).length > 0, { message: "At least one field is required" });

export const listExpenseItemsQuerySchema = paginationQuerySchema
  .extend(sortQuerySchema(["name", "createdAt", "amount"], "name").shape)
  .extend({
    categoryId: z.uuid().optional(),
    frequency: expenseItemFrequencySchema.optional(),
    includeArchived: queryBooleanSchema,
  });

export const expenseItemListResponseSchema = paginatedResponseSchema(expenseItemPublicSchema);

// Duplicated literal rather than importing from scenarios.schemas.ts: that
// module already imports from this one (expenseItemFrequencySchema), so
// importing back would create a cycle over a 3-value enum that never changes.
const scenarioUsageStatusSchema = z.enum(["ACTIVE", "INACTIVE", "ARCHIVED"]);

// "¿Cuánto me cuesta mantener esto?" (ADR-0006) — derived, never stored:
// the item's own mensual/6m/12m plus the scenarios that reference it
// (business question "en qué escenarios se usa"), computed server-side since
// ScenarioItem isn't queryable from the client.
export const expenseItemSummarySchema = z.object({
  item: expenseItemPublicSchema,
  totals: z.object({
    monthly: z.number(),
    sixMonths: z.number(),
    twelveMonths: z.number(),
  }),
  scenarios: z.array(
    z.object({ id: z.uuid(), name: z.string(), status: scenarioUsageStatusSchema }),
  ),
});

export type CreateExpenseItemBody = z.infer<typeof createExpenseItemBodySchema>;
export type UpdateExpenseItemBody = z.infer<typeof updateExpenseItemBodySchema>;
export type ListExpenseItemsQuery = z.infer<typeof listExpenseItemsQuerySchema>;
