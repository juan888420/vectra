import type { ExpenseItemFrequency, ScenarioItemPublic } from "@vectra/types";
import { Button, cn } from "@vectra/ui";
import { formatMoney } from "@vectra/utils";
import { X } from "lucide-react";

import { categoryIcon } from "../categories/category-icons.js";

// Lowercase and terse: at tile size the frequency is a qualifier hanging off
// the price, not a label of its own.
const FREQUENCY_LABELS: Record<ExpenseItemFrequency, string> = {
  MONTHLY: "mensual",
  YEARLY: "anual",
  ONE_TIME: "esporádico",
};

interface ScenarioItemCardProps {
  item: ScenarioItemPublic;
  canEdit: boolean;
  onRemove: () => void;
}

/** One product already included in the scenario, as a launcher-style tile so a
 * grid of them stays scannable at five or six per row (RFC-0025). Drift is
 * carried by border and background rather than a badge — at this size a badge
 * would own the tile instead of annotating it. */
export function ScenarioItemCard({ item, canEdit, onRemove }: ScenarioItemCardProps) {
  const Icon = categoryIcon(item.categoryIcon);

  return (
    <div
      className={cn(
        "group relative flex h-36 w-full flex-col overflow-hidden rounded-xl border p-2.5 transition-colors",
        item.outdated
          ? "border-amber-300 bg-amber-50/60 dark:border-amber-900 dark:bg-amber-950/25"
          : "hover:bg-muted/50",
      )}
    >
      <div className="flex items-start justify-between">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="size-4" />
        </span>
        {item.outdated ? (
          <>
            <span
              className="mr-0.5 mt-1 size-1.5 shrink-0 rounded-full bg-amber-500"
              title="Desactualizado"
              aria-hidden
            />
            <span className="sr-only">Desactualizado</span>
          </>
        ) : null}
      </div>

      <div className="mt-2 flex min-w-0 flex-col">
        <span className="line-clamp-2 text-sm font-medium leading-tight">{item.name}</span>
        <span className="truncate text-xs leading-tight text-muted-foreground">
          {item.categoryName}
        </span>
      </div>

      <div className="mt-auto flex min-w-0 flex-col">
        <span className="truncate text-sm font-semibold leading-tight tabular-nums">
          {formatMoney(item.amount, item.currency)}
        </span>
        <span className="truncate text-[11px] leading-tight text-muted-foreground">
          {FREQUENCY_LABELS[item.frequency]}
        </span>
      </div>

      {canEdit ? (
        <Button
          variant="ghost"
          size="icon"
          // Hidden until the tile is engaged so a grid of six reads as content,
          // not as six delete buttons — but always there without a hover to
          // rely on.
          className={cn(
            "absolute right-1 top-1 size-6 rounded-md text-muted-foreground opacity-0 transition-opacity",
            "hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100",
            "pointer-coarse:opacity-100 [&_svg]:size-3.5",
          )}
          aria-label={`Quitar ${item.name}`}
          onClick={onRemove}
        >
          <X />
        </Button>
      ) : null}
    </div>
  );
}
