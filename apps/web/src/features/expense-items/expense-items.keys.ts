import type { ListExpenseItemsQuery } from "@vectra/types";

export const expenseItemsKeys = {
  all: ["expense-items"] as const,
  lists: () => [...expenseItemsKeys.all, "list"] as const,
  list: (query: ListExpenseItemsQuery) => [...expenseItemsKeys.lists(), query] as const,
  details: () => [...expenseItemsKeys.all, "detail"] as const,
  detail: (id: string) => [...expenseItemsKeys.details(), id] as const,
  summary: (id: string) => [...expenseItemsKeys.detail(id), "summary"] as const,
};
