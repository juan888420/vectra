import type { ListCategoriesQuery } from "@vectra/types";

export const categoriesKeys = {
  all: ["categories"] as const,
  lists: () => [...categoriesKeys.all, "list"] as const,
  list: (query: ListCategoriesQuery) => [...categoriesKeys.lists(), query] as const,
  details: () => [...categoriesKeys.all, "detail"] as const,
  detail: (id: string) => [...categoriesKeys.details(), id] as const,
  summary: (id: string) => [...categoriesKeys.detail(id), "summary"] as const,
};
