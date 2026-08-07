import type { IncomeFrequency, ScenarioIncomePublic } from "@vectra/types";
import { Badge, Button, cn } from "@vectra/ui";
import { formatMoney } from "@vectra/utils";
import { X } from "lucide-react";

import { ScenarioOutdatedIndicator, scenarioRowClassName } from "./ScenarioOutdatedIndicator.js";

const FREQUENCY_LABELS: Record<IncomeFrequency, string> = {
  WEEKLY: "Semanal",
  MONTHLY: "Mensual",
  YEARLY: "Anual",
  ONE_TIME: "Esporádico",
};

interface ScenarioIncomeCardProps {
  income: ScenarioIncomePublic;
  canEdit: boolean;
  onRemove: () => void;
}

/** An income already linked to the scenario, as a centered mini-card in the
 * same visual family as ScenarioItemCard (name → detail → amount, same
 * "Desactualizado" tint and remove-on-hover button). Sized larger and airier
 * than the product tiles: a scenario typically carries only a couple of
 * income sources, so this section optimizes for legibility over density. */
export function ScenarioIncomeCard({ income, canEdit, onRemove }: ScenarioIncomeCardProps) {
  return (
    <div
      className={scenarioRowClassName(
        income.outdated,
        "group relative flex w-full flex-col items-center justify-center gap-1.5 overflow-hidden p-4 text-center",
      )}
    >
      {income.outdated ? (
        <span className="absolute left-2 top-2">
          <ScenarioOutdatedIndicator />
        </span>
      ) : null}

      <span className="line-clamp-2 min-h-[2.5rem] w-full text-sm font-medium leading-5">
        {income.name}
      </span>

      <Badge variant="outline">{FREQUENCY_LABELS[income.frequency]}</Badge>

      <span className="truncate text-base font-bold tabular-nums">
        {formatMoney(income.amount, income.currency)}
      </span>

      {canEdit ? (
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            "absolute right-1.5 top-1.5 size-6 rounded-md text-muted-foreground opacity-0 transition-opacity",
            "hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100",
            "pointer-coarse:opacity-100 [&_svg]:size-3.5",
          )}
          aria-label={`Quitar ${income.name}`}
          onClick={onRemove}
        >
          <X />
        </Button>
      ) : null}
    </div>
  );
}
