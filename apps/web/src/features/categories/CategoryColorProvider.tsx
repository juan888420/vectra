import { useMemo, type ReactNode } from "react";

import { CategoryColorContext, type CategoryColorResolver } from "./category-color-context.js";
import { assignCategoryColors, categoryColor } from "./category-color.js";
import { useCategories } from "./use-categories.js";

/** Holds the one category→color assignment the whole app reads from.
 *
 * It has to be app-wide rather than per screen: the same category is tinted on
 * a product card, on a scenario item and on the categories list, and those
 * would disagree the moment each computed its own assignment from whatever
 * subset it had loaded.
 *
 * `includeArchived` matters here. The set that feeds the assignment must not
 * change when the user toggles "Mostrar archivadas" — otherwise every category
 * on screen could change color as a side effect of a filter. Archived
 * categories still occupy their slot.
 *
 * The request is shared with the screens that already list categories via
 * TanStack Query's cache (same key, 30s staleTime), so this costs an extra
 * fetch only on the screens that never needed categories at all.
 */
export function CategoryColorProvider({ children }: { children: ReactNode }) {
  const { data } = useCategories({ pageSize: 100, sortBy: "name", includeArchived: true });

  const resolve = useMemo<CategoryColorResolver>(() => {
    const names = (data?.data ?? []).map((category) => category.name);
    const map = assignCategoryColors(names);
    // Falls back to the standalone hash for anything not in the set yet — a
    // category created seconds ago, or one referenced by a snapshot whose
    // original was deleted. Those are single names with no set to belong to.
    return (name: string) => map.get(name.trim().toLowerCase()) ?? categoryColor(name);
  }, [data]);

  return <CategoryColorContext value={resolve}>{children}</CategoryColorContext>;
}
