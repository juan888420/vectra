import type { ScenarioCompositionPublic } from "@vectra/types";
import { Button, cn } from "@vectra/ui";
import { formatMoney } from "@vectra/utils";
import { X } from "lucide-react";
import { useState } from "react";

import { ScenarioCompositionDetailDialog } from "./ScenarioCompositionDetailDialog.js";
import { ScenarioOutdatedIndicator, scenarioRowClassName } from "./ScenarioOutdatedIndicator.js";
import { useScenarioIncomes, useScenarioItems } from "./use-scenarios.js";

interface ScenarioCompositionCardProps {
  composition: ScenarioCompositionPublic;
  /** Looked up from the scenario list already fetched by the parent
   * (`GET /scenarios` carries `monthly` per row) — no extra request just to
   * show a headline number on the card. */
  monthly: number | undefined;
  currency: string;
  canEdit: boolean;
  onRemove: () => void;
}

function countLabel(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

/** One composed scenario, as a centered mini-card in the same visual family
 * as ScenarioItemCard and ScenarioIncomeCard: name, monthly total, and how
 * many products/incomes it carries — enough to know what you're inheriting
 * without opening it. The full breakdown lives behind
 * ScenarioCompositionDetailDialog, opened by clicking the card body. Same
 * container and "Desactualizado" language as the other two sections
 * (ScenarioOutdatedIndicator / scenarioRowClassName), so the three parts of
 * the composer read as one system. */
export function ScenarioCompositionCard({
  composition,
  monthly,
  currency,
  canEdit,
  onRemove,
}: ScenarioCompositionCardProps) {
  const [detailOpen, setDetailOpen] = useState(false);

  // Eager, not gated behind the dialog: the count itself is part of what the
  // compact card must show, so there is no "lazy" version of this fetch.
  const { data: items } = useScenarioItems(composition.childScenarioId);
  const { data: incomes } = useScenarioIncomes(composition.childScenarioId);

  return (
    <>
      <div
        className={scenarioRowClassName(
          composition.outdated,
          "group relative flex w-full flex-col items-center justify-center gap-1.5 overflow-hidden p-4 text-center",
        )}
      >
        {composition.outdated ? (
          <span className="absolute left-2 top-2">
            <ScenarioOutdatedIndicator />
          </span>
        ) : null}

        <button
          type="button"
          onClick={() => setDetailOpen(true)}
          className="flex w-full flex-col items-center gap-1.5"
        >
          <span className="line-clamp-2 min-h-[2.5rem] w-full text-sm font-medium leading-5">
            {composition.childScenarioName}
          </span>

          <span className="truncate text-base font-bold tabular-nums">
            {monthly === undefined ? "…" : formatMoney(monthly, currency)}
          </span>

          <span className="text-xs text-muted-foreground">
            {countLabel(items?.length ?? 0, "producto", "productos")} ·{" "}
            {countLabel(incomes?.length ?? 0, "ingreso", "ingresos")}
          </span>
        </button>

        {canEdit ? (
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "absolute right-1.5 top-1.5 size-6 rounded-md text-muted-foreground opacity-0 transition-opacity",
              "hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100",
              "pointer-coarse:opacity-100 [&_svg]:size-3.5",
            )}
            aria-label={`Quitar ${composition.childScenarioName}`}
            onClick={onRemove}
          >
            <X />
          </Button>
        ) : null}
      </div>

      <ScenarioCompositionDetailDialog
        open={detailOpen}
        onOpenChange={setDetailOpen}
        scenarioId={composition.childScenarioId}
        scenarioName={composition.childScenarioName}
        monthly={monthly}
        currency={currency}
      />
    </>
  );
}
