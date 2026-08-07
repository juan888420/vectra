import { z } from "zod";

import { expenseItemPublicSchema } from "./expense-items.js";
import { paginatedResponseSchema } from "./pagination.js";

// Hand-mirrored from apps/api/src/features/categories/categories.schemas.ts.
// `archivedAt`/`createdAt`/`updatedAt` are strings, not the backend's own
// `z.date()`, for the same reason as auth.ts (JSON never produces Dates).

export const categoryTypeSchema = z.enum(["EXPENSE", "INCOME"]);

export type CategoryType = z.infer<typeof categoryTypeSchema>;

export const categoryPublicSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  type: categoryTypeSchema,
  isSystem: z.boolean(),
  archivedAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type CategoryPublic = z.infer<typeof categoryPublicSchema>;

export const createCategoryBodySchema = z.object({
  name: z.string().trim().min(1).max(50),
  type: categoryTypeSchema,
});

export type CreateCategoryBody = z.infer<typeof createCategoryBodySchema>;

// `type` is immutable: changing it on a category with history has no clear
// semantics (its transactions would contradict the new type), which leaves the
// name as the only editable field.
export const updateCategoryBodySchema = z.object({
  name: z.string().trim().min(1).max(50),
});

export type UpdateCategoryBody = z.infer<typeof updateCategoryBodySchema>;

export const categoryListResponseSchema = paginatedResponseSchema(categoryPublicSchema);

export interface ListCategoriesQuery {
  page?: number;
  pageSize?: number;
  sortBy?: "name" | "createdAt";
  sortOrder?: "asc" | "desc";
  type?: CategoryType;
  includeArchived?: boolean;
}

// "¿Cuánto gasto en esta área?" (ADR-0006) — derived, never stored.
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

export type CategorySummary = z.infer<typeof categorySummarySchema>;

// Moves a category's expense items to another category, then deletes it
// (no product is ever left without a category).
export const deleteCategoryWithReassignmentBodySchema = z.object({
  targetCategoryId: z.uuid(),
});

export type DeleteCategoryWithReassignmentBody = z.infer<
  typeof deleteCategoryWithReassignmentBodySchema
>;

export const deleteCategoryWithReassignmentResponseSchema = z.object({
  movedCount: z.number(),
});

export type DeleteCategoryWithReassignmentResponse = z.infer<
  typeof deleteCategoryWithReassignmentResponseSchema
>;
