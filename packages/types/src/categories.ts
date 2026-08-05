import { z } from "zod";

import { expenseItemPublicSchema } from "./expense-items.js";
import { paginatedResponseSchema } from "./pagination.js";

// Hand-mirrored from apps/api/src/features/categories/categories.schemas.ts.
// `archivedAt`/`createdAt`/`updatedAt` are strings, not the backend's own
// `z.date()`, for the same reason as auth.ts (JSON never produces Dates).

export const categoryTypeSchema = z.enum(["EXPENSE", "INCOME"]);

export type CategoryType = z.infer<typeof categoryTypeSchema>;

// The closed vocabulary of category icons. Unlike the other enums in this
// file, this one is NOT hand-mirrored in the API: `apps/api` imports it from
// here, because keeping 40+ names in sync by hand is a bug waiting to happen.
// Names are lucide icon ids in kebab-case; the name -> component map lives in
// the web app (apps/web/src/features/categories/category-icons.tsx) so that
// neither this package nor the API ever depends on lucide-react.
export const CATEGORY_ICON_NAMES = [
  "tag",
  "house",
  "lightbulb",
  "wifi",
  "droplet",
  "flame",
  "utensils",
  "coffee",
  "shopping-cart",
  "shopping-bag",
  "car",
  "bus",
  "plane",
  "fuel",
  "bike",
  "heart-pulse",
  "pill",
  "dumbbell",
  "stethoscope",
  "gamepad-2",
  "music",
  "film",
  "tv",
  "book",
  "palette",
  "laptop",
  "smartphone",
  "monitor",
  "headphones",
  "wallet",
  "credit-card",
  "piggy-bank",
  "banknote",
  "trending-up",
  "briefcase",
  "building-2",
  "graduation-cap",
  "shirt",
  "dog",
  "gift",
  "wrench",
  "package",
] as const;

export const categoryIconSchema = z.enum(CATEGORY_ICON_NAMES);

export type CategoryIcon = z.infer<typeof categoryIconSchema>;

/** Used for categories predating the icon field and as the picker's initial
 * value, so a category always renders something. */
export const DEFAULT_CATEGORY_ICON: CategoryIcon = "tag";

/** Narrows a stored icon (the DB column is a plain string) to the vocabulary,
 * degrading instead of throwing: retiring an id from CATEGORY_ICON_NAMES must
 * never turn every row still holding it into a failed response. */
export function parseCategoryIcon(value: string): CategoryIcon {
  const parsed = categoryIconSchema.safeParse(value);
  return parsed.success ? parsed.data : DEFAULT_CATEGORY_ICON;
}

export const categoryPublicSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  type: categoryTypeSchema,
  icon: categoryIconSchema,
  isSystem: z.boolean(),
  archivedAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type CategoryPublic = z.infer<typeof categoryPublicSchema>;

export const createCategoryBodySchema = z.object({
  name: z.string().trim().min(1).max(50),
  type: categoryTypeSchema,
  icon: categoryIconSchema,
});

export type CreateCategoryBody = z.infer<typeof createCategoryBodySchema>;

// `type` is immutable: changing it on a category with history has no clear
// semantics (its transactions would contradict the new type). `name` and
// `icon` are independently optional because a system category accepts an icon
// change but never a rename (see the API's updateCategory).
export const updateCategoryBodySchema = z
  .object({
    name: z.string().trim().min(1).max(50),
    icon: categoryIconSchema,
  })
  .partial()
  .refine((body) => Object.keys(body).length > 0, { message: "At least one field is required" });

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
