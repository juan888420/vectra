import type { ExpenseItemFrequency, ScenarioItemPublic } from "@vectra/types";
import { Button, cn } from "@vectra/ui";
import { formatMoney } from "@vectra/utils";
import { X } from "lucide-react";

import { categoryColor } from "../categories/category-color.js";
import { ScenarioOutdatedIndicator, scenarioRowClassName } from "./ScenarioOutdatedIndicator.js";

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

/** A product already included in the scenario, as a compact centered
 * mini-card: name leads, category trails it de-emphasized, and the price is
 * the loudest thing on the tile — the number this whole screen exists to
 * answer. No fixed height: the name reserves two lines' worth of space and
 * the grid stretches every tile in a row to match its tallest neighbor, so
 * shorter cards stay visually centered instead of leaving dead space below.
 * Reused as-is (read-only, `canEdit={false}`) inside
 * ScenarioCompositionDetailDialog, so a product looks identical whether
 * you're viewing it in its own scenario or previewing a composed one. */
export function ScenarioItemCard({ item, canEdit, onRemove }: ScenarioItemCardProps) {
  const color = categoryColor(item.categoryName);

  return (
    <div
      className={scenarioRowClassName(
        item.outdated,
        "group relative flex w-full flex-col items-center justify-center gap-1 overflow-hidden p-2 text-center",
      )}
    >
      {item.outdated ? (
        <span className="absolute left-1.5 top-1.5">
          <ScenarioOutdatedIndicator />
        </span>
      ) : null}

      <span className="line-clamp-2 min-h-[2rem] w-full text-xs font-medium leading-4">
        {item.name}
      </span>

      <span
        className={cn(
          "max-w-full truncate rounded-full border px-1.5 py-px text-[10px] font-medium leading-tight",
          color.soft,
        )}
      >
        {item.categoryName}
      </span>

      <span className="flex w-full flex-col leading-tight">
        <span className="truncate text-sm font-bold tabular-nums">
          {formatMoney(item.amount, item.currency)}
        </span>
        <span className="truncate text-[10px] text-muted-foreground">
          {FREQUENCY_LABELS[item.frequency]}
        </span>
      </span>

      {canEdit ? (
        <Button
          variant="ghost"
          size="icon"
          // Hidden until the tile is engaged so a grid of many reads as
          // content, not as a wall of delete buttons — but always there
          // without a hover to rely on.
          className={cn(
            "absolute right-1 top-1 size-5 rounded-md text-muted-foreground opacity-0 transition-opacity",
            "hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100",
            "pointer-coarse:opacity-100 [&_svg]:size-3",
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
