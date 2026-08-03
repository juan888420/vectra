import type { ScenarioSummary } from "@vectra/types";
import { Button, Card, CardContent, CardHeader, CardTitle, Skeleton } from "@vectra/ui";
import { formatMoney } from "@vectra/utils";
import { AlertTriangle } from "lucide-react";

import { StatCard } from "../dashboard/StatCard.js";
import { describeScenarioChange } from "./describe-scenario-change.js";

interface ScenarioSummaryCardsProps {
  summary?: ScenarioSummary;
  isLoading: boolean;
  currency: string;
  onSync: () => void;
  isSyncing: boolean;
}

export function ScenarioSummaryCards({
  summary,
  isLoading,
  currency,
  onSync,
  isSyncing,
}: ScenarioSummaryCardsProps) {
  return (
    <div className="flex flex-col gap-4">
      {/* Only ever shows when the user declined syncing at edit time
          (RFC-0023.3) — an informational summary, no checkboxes and no
          per-change selection; the button below applies all of it at once.
          Described with the exact same function as ScenarioImpactDialog, so
          this list and that dialog never disagree on wording. */}
      {summary?.hasUpdates ? (
        <div className="flex flex-col gap-2 rounded-md border border-amber-500/30 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:bg-amber-950 dark:text-amber-300">
          <div className="flex items-center gap-2">
            <AlertTriangle className="size-4 shrink-0" />
            Cambios pendientes
          </div>
          <ul className="flex list-inside list-disc flex-col gap-1 text-sm">
            {summary.pendingChanges.map((change, index) => (
              <li key={index}>{describeScenarioChange(change)}</li>
            ))}
          </ul>
          <Button
            size="sm"
            variant="outline"
            className="w-fit"
            onClick={onSync}
            disabled={isSyncing}
          >
            {isSyncing ? "Aplicando…" : "Aplicar cambios pendientes"}
          </Button>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Total mensual"
          value={isLoading ? undefined : formatMoney(summary?.totals.monthly ?? 0, currency)}
          isLoading={isLoading}
        />
        <StatCard
          label="Proyección a 6 meses"
          value={isLoading ? undefined : formatMoney(summary?.totals.sixMonths ?? 0, currency)}
          isLoading={isLoading}
        />
        <StatCard
          label="Proyección a 12 meses"
          value={isLoading ? undefined : formatMoney(summary?.totals.twelveMonths ?? 0, currency)}
          isLoading={isLoading}
        />
      </div>

      {summary && summary.incomeCoverage ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Cobertura de ingresos
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">
                {formatMoney(summary.totals.monthly, currency)} de{" "}
                {formatMoney(summary.incomeCoverage.totalIncomeMonthly, currency)}
              </span>
              <span className="text-muted-foreground">
                {summary.incomeCoverage.consumedPercentage.toFixed(0)}% consumido
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary"
                style={{ width: `${Math.min(100, summary.incomeCoverage.consumedPercentage)}%` }}
              />
            </div>
            <span className="text-xs text-muted-foreground">
              Queda {formatMoney(summary.incomeCoverage.remainingMonthly, currency)}/mes
            </span>
          </CardContent>
        </Card>
      ) : null}

      {summary && summary.oneTime.items.length > 0 ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Gastos esporádicos (no entran en las proyecciones)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col gap-1.5 text-sm">
              {summary.oneTime.items.map((item) => (
                <li key={item.id} className="flex items-center justify-between">
                  <span>{item.name}</span>
                  <span className="font-medium">{formatMoney(item.amount, currency)}</span>
                </li>
              ))}
            </ul>
            <div className="mt-2 flex items-center justify-between border-t pt-2 text-sm font-medium">
              <span>Total</span>
              <span>{formatMoney(summary.oneTime.total, currency)}</span>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {isLoading && !summary ? <Skeleton className="h-24 w-full" /> : null}
    </div>
  );
}
