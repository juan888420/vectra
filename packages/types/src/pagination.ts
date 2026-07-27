import { z } from "zod";

// Mirrors apps/api/src/lib/pagination.ts's paginatedResponseSchema envelope
// (response shape only — no query-schema mirror yet, since no list UI exists
// in the frontend until a feature RFC needs it).
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

export interface PaginatedResponse<T> {
  data: T[];
  meta: PageMeta;
}
