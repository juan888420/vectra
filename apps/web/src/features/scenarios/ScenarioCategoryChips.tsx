import type { CategoryPublic } from "@vectra/types";
import { cn } from "@vectra/ui";
import { Plus } from "lucide-react";

import { categoryColor } from "../categories/category-color.js";

interface ScenarioCategoryChipsProps {
  categories: CategoryPublic[];
  selectedId: string | null;
  onSelect: (categoryId: string) => void;
  /** Whether "creating a category" is the active step — highlights the "+"
   * chip like any other selection, so the row keeps reading as "this is what's
   * active" instead of looking like nothing is picked. */
  creatingCategory?: boolean;
  onCreateCategory: () => void;
}

/** Step one of both composer flows: pick a category by name. Chips rather than
 * a select or a grid of icons — the whole set stays visible and comparable at a
 * glance, wraps instead of scrolling, and reads correctly with twenty
 * categories as well as with three. Each chip carries a color derived from its
 * name (see category-color.ts), which is what makes the row scannable without
 * an icon to recognize. */
export function ScenarioCategoryChips({
  categories,
  selectedId,
  onSelect,
  creatingCategory = false,
  onCreateCategory,
}: ScenarioCategoryChipsProps) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {categories.map((category) => {
        const isSelected = !creatingCategory && category.id === selectedId;
        const color = categoryColor(category.name);
        return (
          <button
            key={category.id}
            type="button"
            onClick={() => onSelect(category.id)}
            aria-pressed={isSelected}
            className={cn(
              "max-w-52 truncate rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
              isSelected ? color.solid : cn(color.soft, "hover:brightness-95"),
            )}
          >
            {category.name}
          </button>
        );
      })}

      <button
        type="button"
        onClick={onCreateCategory}
        aria-pressed={creatingCategory}
        className={cn(
          "flex items-center gap-1 rounded-full border border-dashed px-3 py-1.5 text-xs font-normal transition-colors",
          creatingCategory
            ? "border-primary bg-primary text-primary-foreground"
            : "border-muted-foreground/30 text-muted-foreground hover:bg-muted hover:text-foreground",
        )}
      >
        <Plus className="size-3" /> Nueva categoría
      </button>
    </div>
  );
}
