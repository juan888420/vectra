import type { ListScenariosQuery } from "@vectra/types";

// Nested under `detail(id)` unlike categories/transactions: a scenario's
// items/incomes/compositions/summary all depend on its id, so invalidating
// `all` (done by every mutation below) sweeps the whole detail tree too.
export const scenariosKeys = {
  all: ["scenarios"] as const,
  lists: () => [...scenariosKeys.all, "list"] as const,
  list: (query: ListScenariosQuery) => [...scenariosKeys.lists(), query] as const,
  details: () => [...scenariosKeys.all, "detail"] as const,
  detail: (id: string) => [...scenariosKeys.details(), id] as const,
  items: (id: string) => [...scenariosKeys.detail(id), "items"] as const,
  incomes: (id: string) => [...scenariosKeys.detail(id), "incomes"] as const,
  compositions: (id: string) => [...scenariosKeys.detail(id), "compositions"] as const,
  summary: (id: string) => [...scenariosKeys.detail(id), "summary"] as const,
  changes: (id: string) => [...scenariosKeys.detail(id), "changes"] as const,
  categoryWatches: (id: string) => [...scenariosKeys.detail(id), "category-watches"] as const,
};
