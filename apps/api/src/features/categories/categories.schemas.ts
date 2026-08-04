import { categoryIconSchema } from "@vectra/types";
import { z } from "zod";

import {
  paginatedResponseSchema,
  paginationQuerySchema,
  queryBooleanSchema,
  sortQuerySchema,
} from "../../lib/pagination.js";
import { expenseItemPublicSchema } from "../expense-items/expense-items.schemas.js";

export const categoryTypeSchema = z.enum(["EXPENSE", "INCOME"]);

export const categoryPublicSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  type: categoryTypeSchema,
  // The one enum not restated here: it holds 40+ icon ids, so it is imported
  // from @vectra/types rather than hand-mirrored like categoryTypeSchema.
  icon: categoryIconSchema,
  isSystem: z.boolean(),
  archivedAt: z.date().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const createCategoryBodySchema = z.object({
  name: z.string().trim().min(1).max(50),
  type: categoryTypeSchema,
  icon: categoryIconSchema,
});

// `type` is immutable: changing it on a category with history has no clear
// semantics (its transactions would contradict the new type). `name` and
// `icon` are independently optional because a system category accepts an icon
// change but never a rename (see updateCategory).
export const updateCategoryBodySchema = z
  .object({
    name: z.string().trim().min(1).max(50),
    icon: categoryIconSchema,
  })
  .partial()
  .refine((body) => Object.keys(body).length > 0, { message: "At least one field is required" });

export const listCategoriesQuerySchema = paginationQuerySchema
  .extend(sortQuerySchema(["name", "createdAt"], "name").shape)
  .extend({
    type: categoryTypeSchema.optional(),
    includeArchived: queryBooleanSchema,
    search: z.string().trim().min(1).optional(),
  });

export const categoryListResponseSchema = paginatedResponseSchema(categoryPublicSchema);

// Derived, never stored (ADR-0006): "¿cuánto gasto en esta área?" — the
// category's expense items, prorated and summed the same way a Scenario's
// items are (mensual/6m/12m). ONE_TIME items are excluded from the total and
// listed separately, same convention as the Scenario summary.
export const categorySummarySchema = z.object({
  category: categoryPublicSchema,
  totals: z.object({
    monthly: z.number(),
    sixMonths: z.number(),
    twelveMonths: z.number(),
  }),
  oneTimeTotal: z.number(),
  items: z.array(expenseItemPublicSchema),
});

// Body for /:id/delete-with-reassignment: moves every active expense item
// off the category being deleted before deleting it, so no product is ever
// left without a category (business rule: no orphaned data).
export const deleteCategoryWithReassignmentBodySchema = z.object({
  targetCategoryId: z.uuid(),
});

export const deleteCategoryWithReassignmentResponseSchema = z.object({
  movedCount: z.number(),
});

export type CreateCategoryBody = z.infer<typeof createCategoryBodySchema>;
export type UpdateCategoryBody = z.infer<typeof updateCategoryBodySchema>;
export type ListCategoriesQuery = z.infer<typeof listCategoriesQuerySchema>;
export type DeleteCategoryWithReassignmentBody = z.infer<
  typeof deleteCategoryWithReassignmentBodySchema
>;
