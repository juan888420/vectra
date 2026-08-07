import type { IncomeFrequency, IncomePublic } from "@vectra/types";
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
import { Archive, ArchiveRestore, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { Link } from "react-router";

const FREQUENCY_LABELS: Record<IncomeFrequency, string> = {
  WEEKLY: "Semanal",
  MONTHLY: "Mensual",
  YEARLY: "Anual",
  ONE_TIME: "Esporádico",
};

interface IncomeCardProps {
  income: IncomePublic;
  onEdit: () => void;
  onToggleArchive: () => void;
  onDelete: () => void;
}

/** An income, as a centered mini-card in the same visual family as
 * ExpenseItemCard and CategoryCard — larger and airier, since a user
 * typically has only a handful of income sources. The amount carries the
 * card on size and weight alone (text-xl font-bold), never on color: a
 * previous pass in Escenarios deliberately dropped a hardcoded emerald tint
 * from income amounts because color without semantic meaning broke
 * consistency with Productos — the same rule applies here. Not imported from
 * features/scenarios — same visual recipe, independent component. */
export function IncomeCard({ income, onEdit, onToggleArchive, onDelete }: IncomeCardProps) {
  return (
    <div className="group relative flex w-full flex-col items-center justify-center gap-2 overflow-hidden rounded-xl border p-5 text-center transition-colors hover:bg-muted/50">
      {income.archivedAt ? (
        <span className="absolute left-2 top-2">
          <Badge variant="secondary" className="px-1.5 py-0 text-[10px] leading-tight">
            Archivado
          </Badge>
        </span>
      ) : null}

      <Link to={`/incomes/${income.id}`} className="flex w-full flex-col items-center gap-2">
        <span className="line-clamp-2 min-h-[2.5rem] w-full text-sm font-medium leading-5">
          {income.name}
        </span>

        <span className="truncate text-xl font-bold tabular-nums">
          {formatMoney(income.amount, income.currency)}
        </span>

        <Badge variant="outline">{FREQUENCY_LABELS[income.frequency]}</Badge>
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
            aria-label={`Acciones para ${income.name}`}
          >
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={onEdit}>
            <Pencil /> Editar
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={onToggleArchive}>
            {income.archivedAt ? <ArchiveRestore /> : <Archive />}
            {income.archivedAt ? "Desarchivar" : "Archivar"}
          </DropdownMenuItem>
          <DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={onDelete}>
            <Trash2 /> Eliminar
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
