import type { CategoryPublic, CategoryType } from "@vectra/types";
import {
  Badge,
  Button,
  cn,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@vectra/ui";
import { formatMoney } from "@vectra/utils";
import { Archive, ArchiveRestore, Loader2, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { Link } from "react-router";

import { categoryColor } from "./category-color.js";
import { useCategorySummary } from "./use-categories.js";

const CATEGORY_TYPE_LABELS: Record<CategoryType, string> = {
  EXPENSE: "Gasto",
  INCOME: "Ingreso",
};

interface CategoryCardProps {
  category: CategoryPublic;
  onEdit: () => void;
  onToggleArchive: () => void;
  onDelete: () => void;
  isCheckingDelete: boolean;
}

function countLabel(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

/** A category, as a centered mini-card in the same visual family as
 * ExpenseItemCard — name, monthly total and product count as the headline.
 * The type badge is tinted with the category's own derived color
 * (categoryColor, same djb2-over-name system Escenarios already uses for
 * product chips), so a category reads with the same identity everywhere it
 * appears. Fetches its own summary (useCategorySummary) for the monthly
 * total and product count — the list endpoint doesn't carry them, and this
 * mirrors the N+1-per-card tradeoff already accepted for
 * ScenarioCompositionCard rather than adding a new backend endpoint. Not
 * imported from features/scenarios — same visual recipe, independent
 * component. */
export function CategoryCard({
  category,
  onEdit,
  onToggleArchive,
  onDelete,
  isCheckingDelete,
}: CategoryCardProps) {
  const { data: summary } = useCategorySummary(category.id);
  const color = categoryColor(category.name);
  const currency = summary?.items[0]?.currency ?? "USD";

  return (
    <div
      className={cn(
        "group relative flex w-full flex-col items-center justify-center gap-1.5 overflow-hidden rounded-xl border p-4 text-center transition-colors",
        color.wash,
        "hover:brightness-95 dark:hover:brightness-110",
      )}
    >
      <Link to={`/categories/${category.id}`} className="flex w-full flex-col items-center gap-1.5">
        <span className="line-clamp-2 min-h-[2.5rem] w-full text-sm font-medium leading-5">
          {category.name}
        </span>

        <span
          className={cn(
            "max-w-full truncate rounded-full border px-1.5 py-px text-[10px] font-medium leading-tight",
            color.soft,
          )}
        >
          {CATEGORY_TYPE_LABELS[category.type]}
        </span>

        <span className="truncate text-base font-bold tabular-nums">
          {summary === undefined ? "…" : formatMoney(summary.totals.monthly, currency)}
        </span>

        <span className="text-xs text-muted-foreground">
          {summary === undefined ? "…" : countLabel(summary.items.length, "producto", "productos")}
        </span>

        {category.isSystem || category.archivedAt ? (
          <div className="flex flex-wrap items-center justify-center gap-1">
            {category.isSystem ? <Badge variant="outline">Sistema</Badge> : null}
            {category.archivedAt ? <Badge variant="secondary">Archivada</Badge> : null}
          </div>
        ) : null}
      </Link>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "absolute right-1.5 top-1.5 size-6 rounded-md text-muted-foreground opacity-0 transition-opacity",
              "hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100",
              "pointer-coarse:opacity-100 [&_svg]:size-3.5",
            )}
            aria-label={`Acciones para ${category.name}`}
          >
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem disabled={category.isSystem} onSelect={onEdit}>
            <Pencil /> Editar
          </DropdownMenuItem>
          <DropdownMenuItem disabled={category.isSystem} onSelect={onToggleArchive}>
            {category.archivedAt ? <ArchiveRestore /> : <Archive />}
            {category.archivedAt ? "Desarchivar" : "Archivar"}
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={category.isSystem || isCheckingDelete}
            className="text-destructive focus:text-destructive"
            onSelect={onDelete}
          >
            {isCheckingDelete ? <Loader2 className="animate-spin" /> : <Trash2 />}
            Eliminar
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
