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

export type CreateExpenseItemBody = z.infer<typeof createExpenseItemBodySchema>;
export type UpdateExpenseItemBody = z.infer<typeof updateExpenseItemBodySchema>;
export type ListExpenseItemsQuery = z.infer<typeof listExpenseItemsQuerySchema>;
