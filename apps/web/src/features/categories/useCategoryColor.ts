import { useContext } from "react";

import { CategoryColorContext, type CategoryColorResolver } from "./category-color-context.js";

export function useCategoryColor(): CategoryColorResolver {
  const context = useContext(CategoryColorContext);
  if (!context) {
    throw new Error("useCategoryColor must be used within <CategoryColorProvider>");
  }
  return context;
}
