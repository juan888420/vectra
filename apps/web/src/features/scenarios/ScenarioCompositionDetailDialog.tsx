import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Skeleton,
} from "@vectra/ui";
import { formatMoney } from "@vectra/utils";
import { Link } from "react-router";

import { ScenarioItemCard } from "./ScenarioItemCard.js";
import { useScenarioIncomes, useScenarioItems } from "./use-scenarios.js";

interface ScenarioCompositionDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  scenarioId: string;
  scenarioName: string;
  monthly: number | undefined;
  currency: string;
}

/** Full breakdown of a composed scenario, opened on demand from its compact
 * row (ScenarioCompositionCard) — progressive disclosure instead of a second
 * summary permanently on screen. Informational only: one total and two
 * plain lists, not a second dashboard of stat cards. Reuses the same
 * items/incomes queries the card already triggered for its counts, so this
 * is typically an instant cache hit, not a new request. */
export function ScenarioCompositionDetailDialog({
  open,
  onOpenChange,
  scenarioId,
  scenarioName,
  monthly,
  currency,
}: ScenarioCompositionDetailDialogProps) {
  const { data: items, isLoading: isLoadingItems } = useScenarioItems(scenarioId);
  const { data: incomes, isLoading: isLoadingIncomes } = useScenarioIncomes(scenarioId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{scenarioName}</DialogTitle>
          <DialogDescription className="sr-only">
            Resumen de lo que este escenario heredado aporta aquí.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-baseline justify-between border-b pb-3">
          <span className="text-sm text-muted-foreground">Mensual</span>
          <span className="text-lg font-semibold tabular-nums">
            {monthly === undefined ? "…" : formatMoney(monthly, currency)}
          </span>
        </div>

        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-medium text-muted-foreground">
            Productos{items ? ` (${items.length})` : ""}
          </h3>
          {isLoadingItems ? (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(6.5rem,1fr))] gap-2">
              <Skeleton className="h-24 w-full rounded-xl" />
              <Skeleton className="h-24 w-full rounded-xl" />
              <Skeleton className="h-24 w-full rounded-xl" />
            </div>
          ) : !items || items.length === 0 ? (
            <p className="rounded-md border border-dashed px-3 py-4 text-center text-sm text-muted-foreground">
              Sin productos.
            </p>
          ) : (
            // Same mini-card as the scenario's own Productos section
            // (ScenarioItemCard) — read-only here (canEdit={false}), since
            // this dialog only previews what a composed scenario carries.
            <div className="grid grid-cols-[repeat(auto-fill,minmax(6.5rem,1fr))] gap-2">
              {items.map((item) => (
                <ScenarioItemCard key={item.id} item={item} canEdit={false} onRemove={() => {}} />
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-medium text-muted-foreground">
            Ingresos{incomes ? ` (${incomes.length})` : ""}
          </h3>
          {isLoadingIncomes ? (
            <Skeleton className="h-16 w-full" />
          ) : !incomes || incomes.length === 0 ? (
            <p className="rounded-md border border-dashed px-3 py-4 text-center text-sm text-muted-foreground">
              Sin ingresos.
            </p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {incomes.map((income) => (
                <li
                  key={income.id}
                  className="flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm"
                >
                  <span className="min-w-0 truncate font-medium">{income.name}</span>
                  <span className="shrink-0 tabular-nums text-muted-foreground">
                    {formatMoney(income.amount, income.currency)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <DialogFooter>
          <Button asChild>
            <Link to={`/scenarios/${scenarioId}`} onClick={() => onOpenChange(false)}>
              Abrir escenario
            </Link>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
