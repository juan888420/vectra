import type { CategoryIcon } from "@vectra/types";
import { cn } from "@vectra/ui";

import { categoryIcon, CATEGORY_ICON_OPTIONS } from "./category-icons.js";

interface CategoryIconPickerProps {
  value: CategoryIcon;
  onChange: (icon: CategoryIcon) => void;
}

export function CategoryIconPicker({ value, onChange }: CategoryIconPickerProps) {
  return (
    <div
      role="radiogroup"
      aria-label="Icono de la categoría"
      className="grid max-h-44 grid-cols-8 gap-1 overflow-y-auto rounded-md border p-2"
    >
      {CATEGORY_ICON_OPTIONS.map((icon) => {
        const Icon = categoryIcon(icon);
        const isSelected = icon === value;
        return (
          <button
            key={icon}
            type="button"
            role="radio"
            aria-checked={isSelected}
            aria-label={icon}
            onClick={() => onChange(icon)}
            className={cn(
              "flex aspect-square items-center justify-center rounded-md transition-colors",
              isSelected
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <Icon className="size-4" />
          </button>
        );
      })}
    </div>
  );
}
