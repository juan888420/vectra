import type { ListTransactionsQuery } from "@vectra/types";

export const transactionsKeys = {
  all: ["transactions"] as const,
  lists: () => [...transactionsKeys.all, "list"] as const,
  list: (query: ListTransactionsQuery) => [...transactionsKeys.lists(), query] as const,
};
