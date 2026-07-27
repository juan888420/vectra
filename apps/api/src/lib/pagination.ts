import { z } from "zod";

// Shared list-endpoint building blocks: every paginated resource (accounts,
// categories, and later transactions) uses the same query params and the
// same `{ data, meta }` response envelope.

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

export function sortQuerySchema<const T extends readonly [string, ...string[]]>(
  fields: T,
  defaultField: T[number],
) {
  return z.object({
    sortBy: z.enum(fields).default(defaultField),
    sortOrder: z.enum(["asc", "desc"]).default("asc"),
  });
}

export function paginatedResponseSchema<T extends z.ZodType>(itemSchema: T) {
  return z.object({
    data: z.array(itemSchema),
    meta: z.object({
      page: z.number().int(),
      pageSize: z.number().int(),
      totalItems: z.number().int(),
      totalPages: z.number().int(),
    }),
  });
}

export interface PageMeta {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

export const toSkipTake = ({
  page,
  pageSize,
}: PaginationQuery): { skip: number; take: number } => ({
  skip: (page - 1) * pageSize,
  take: pageSize,
});

export const buildMeta = ({ page, pageSize }: PaginationQuery, totalItems: number): PageMeta => ({
  page,
  pageSize,
  totalItems,
  totalPages: Math.max(1, Math.ceil(totalItems / pageSize)),
});

// Query-string booleans: z.coerce.boolean() would turn "false" into true,
// so list filters use an explicit string enum instead.
export const queryBooleanSchema = z
  .enum(["true", "false"])
  .default("false")
  .transform((value) => value === "true");
