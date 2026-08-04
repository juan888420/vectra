import type { CategoryPublic } from "@vectra/types";
import { cn } from "@vectra/ui";
import { AnimatePresence, motion } from "framer-motion";

import { categoryIcon } from "../categories/category-icons.js";

interface ScenarioCategoryGalleryProps {
  categories: CategoryPublic[];
  selectedId: string | null;
  onSelect: (categoryId: string) => void;
}

/** Step one of both composer flows: pick a category by its icon. The name is
 * deliberately hidden until selection so the row reads as navigation rather
 * than as a list (RFC-0025). */
export function ScenarioCategoryGallery({
  categories,
  selectedId,
  onSelect,
}: ScenarioCategoryGalleryProps) {
  const selected = categories.find((category) => category.id === selectedId) ?? null;

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex flex-wrap justify-center gap-2">
        {categories.map((category) => {
          const Icon = categoryIcon(category.icon);
          const isSelected = category.id === selectedId;
          return (
            <button
              key={category.id}
              type="button"
              onClick={() => onSelect(category.id)}
              aria-label={category.name}
              aria-pressed={isSelected}
              className={cn(
                "relative flex size-14 items-center justify-center rounded-xl border transition-colors",
                isSelected
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-transparent bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <Icon className="size-6" />
            </button>
          );
        })}
      </div>

      <div className="flex h-5 items-center">
        <AnimatePresence mode="wait">
          {selected ? (
            <motion.span
              key={selected.id}
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 4 }}
              transition={{ duration: 0.15 }}
              className="text-sm font-medium"
            >
              {selected.name}
            </motion.span>
          ) : (
            <motion.span
              key="hint"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="text-sm text-muted-foreground"
            >
              Elige una categoría para continuar
            </motion.span>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
