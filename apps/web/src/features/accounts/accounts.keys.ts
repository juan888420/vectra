import type { ListAccountsQuery } from "@vectra/types";

// Query key factory: every accounts query key is derived from `all`, so a
// single `invalidateQueries({ queryKey: accountsKeys.all })` after a mutation
// busts every list variant (different filters/pages) at once.
export const accountsKeys = {
  all: ["accounts"] as const,
  lists: () => [...accountsKeys.all, "list"] as const,
  list: (query: ListAccountsQuery) => [...accountsKeys.lists(), query] as const,
};
