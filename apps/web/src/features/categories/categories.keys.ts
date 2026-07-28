import type { ListCategoriesQuery } from "@vectra/types";

export const categoriesKeys = {
  all: ["categories"] as const,
  lists: () => [...categoriesKeys.all, "list"] as const,
  list: (query: ListCategoriesQuery) => [...categoriesKeys.lists(), query] as const,
};
