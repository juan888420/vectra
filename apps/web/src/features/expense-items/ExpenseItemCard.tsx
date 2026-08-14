import type { ExpenseItemFrequency, ExpenseItemPublic } from "@vectra/types";
import {
  Badge,
  Button,
  cn,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@vectra/ui";
import { formatMoney, formatMoneyCompact } from "@vectra/utils";
import { Archive, ArchiveRestore, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { Link } from "react-router";

import { useCategoryColor } from "../categories/useCategoryColor.js";

const FREQUENCY_LABELS: Record<ExpenseItemFrequency, string> = {
  MONTHLY: "mensual",
  YEARLY: "anual",
  ONE_TIME: "esporádico",
};

interface ExpenseItemCardProps {
  item: ExpenseItemPublic;
  categoryName: string;
  /** Hides the actions menu for read-only contexts (e.g. previewed inside a
   * category's own detail page) — same on/off pattern ScenarioItemCard uses
   * for composed-scenario previews, so a product looks identical wherever
   * it's shown instead of gaining a second, editless representation. */
  canEdit?: boolean;
  onEdit?: () => void;
  onToggleArchive?: () => void;
  onDelete?: () => void;
}

/** A product, as a compact centered mini-card — the visual reference for the
 * rest of the app, adapted from ScenarioItemCard's tile language (name →
 * category badge → bold amount → frequency) to the product catalog's own
 * needs: a Link to the detail page instead of no navigation, and a 3-action
 * menu (Editar/Archivar/Eliminar) instead of a single remove button. Not
 * imported from features/scenarios on purpose — same recipe, independent
 * component, so Productos doesn't depend on the Escenarios feature. */
export function ExpenseItemCard({
  item,
  categoryName,
  canEdit = true,
  onEdit,
  onToggleArchive,
  onDelete,
}: ExpenseItemCardProps) {
  const color = useCategoryColor()(categoryName);

  return (
    // Padding and type step up with the grid's own column minimum (CardGrid
    // "tile"): at lg the columns are ~168px rather than ~104px, and keeping
    // the phone-sized interior there just produced a lot of empty tile.
    <div className="group relative flex w-full flex-col items-center justify-center gap-1 overflow-hidden rounded-xl border p-2 text-center transition-colors hover:bg-muted/50 lg:gap-1.5 lg:p-3">
      {item.archivedAt ? (
        <span className="absolute left-1.5 top-1.5">
          <Badge variant="secondary" className="px-1 py-0 text-[9px] leading-tight">
            Archivado
          </Badge>
        </span>
      ) : null}

      <Link to={`/expense-items/${item.id}`} className="flex w-full flex-col items-center gap-1">
        <span className="line-clamp-2 min-h-[2rem] w-full text-xs leading-4 font-medium lg:min-h-[2.5rem] lg:text-sm lg:leading-5">
          {item.name}
        </span>

        <span
          className={cn(
            "max-w-full truncate rounded-full border px-1.5 py-px text-[10px] leading-tight font-medium lg:px-2 lg:text-xs",
            color.soft,
          )}
        >
          {categoryName}
        </span>

        <span className="flex w-full flex-col leading-tight">
          {/* Compact at tile width, exact on hover and one click away on the
              detail page — the amount is the point of the card, so it can't
              be silently clipped. */}
          <span
            className="truncate text-sm font-bold tabular-nums lg:text-base"
            title={formatMoney(item.amount, item.currency)}
          >
            {formatMoneyCompact(item.amount, item.currency)}
          </span>
          <span className="truncate text-[10px] text-muted-foreground lg:text-xs">
            {FREQUENCY_LABELS[item.frequency]}
          </span>
        </span>
      </Link>

      {canEdit ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              // Hidden until the tile is engaged, same as ScenarioItemCard's
              // remove button — but always there without a hover to rely on.
              className={cn(
                "absolute right-1 top-1 size-7 rounded-md text-muted-foreground opacity-0 transition-opacity",
                "hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100",
                "pointer-coarse:opacity-100 [&_svg]:size-3",
              )}
              aria-label={`Acciones para ${item.name}`}
            >
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={onEdit}>
              <Pencil /> Editar
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={onToggleArchive}>
              {item.archivedAt ? <ArchiveRestore /> : <Archive />}
              {item.archivedAt ? "Desarchivar" : "Archivar"}
            </DropdownMenuItem>
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onSelect={onDelete}
            >
              <Trash2 /> Eliminar
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
    </div>
  );
}
