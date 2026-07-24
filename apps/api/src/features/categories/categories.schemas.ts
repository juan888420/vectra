import { z } from "zod";

import {
  paginatedResponseSchema,
  paginationQuerySchema,
  queryBooleanSchema,
  sortQuerySchema,
} from "../../lib/pagination.js";

export const categoryTypeSchema = z.enum(["EXPENSE", "INCOME"]);

export const categoryPublicSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  type: categoryTypeSchema,
  isSystem: z.boolean(),
  archivedAt: z.date().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const createCategoryBodySchema = z.object({
  name: z.string().trim().min(1).max(50),
  type: categoryTypeSchema,
});

// `type` is immutable: changing it on a category with history has no clear
// semantics (its transactions would contradict the new type).
export const updateCategoryBodySchema = z.object({
  name: z.string().trim().min(1).max(50),
});

export const listCategoriesQuerySchema = paginationQuerySchema
  .extend(sortQuerySchema(["name", "createdAt"], "name").shape)
  .extend({
    type: categoryTypeSchema.optional(),
    includeArchived: queryBooleanSchema,
  });

export const categoryListResponseSchema = paginatedResponseSchema(categoryPublicSchema);

export type CreateCategoryBody = z.infer<typeof createCategoryBodySchema>;
export type UpdateCategoryBody = z.infer<typeof updateCategoryBodySchema>;
export type ListCategoriesQuery = z.infer<typeof listCategoriesQuerySchema>;
