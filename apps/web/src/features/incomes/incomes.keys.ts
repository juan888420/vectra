import type { ListIncomesQuery } from "@vectra/types";

export const incomesKeys = {
  all: ["incomes"] as const,
  lists: () => [...incomesKeys.all, "list"] as const,
  list: (query: ListIncomesQuery) => [...incomesKeys.lists(), query] as const,
  details: () => [...incomesKeys.all, "detail"] as const,
  detail: (id: string) => [...incomesKeys.details(), id] as const,
  summary: (id: string) => [...incomesKeys.detail(id), "summary"] as const,
};
