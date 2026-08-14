import { createContext } from "react";

import type { CategoryColor } from "./category-color.js";

/** Resolves a category name to its color under the app-wide assignment.
 * A function rather than the map itself so callers never have to know that
 * lookups are normalized. */
export type CategoryColorResolver = (name: string) => CategoryColor;

export const CategoryColorContext = createContext<CategoryColorResolver | null>(null);
