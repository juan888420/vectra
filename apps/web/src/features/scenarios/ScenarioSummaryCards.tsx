import type { ScenarioSummary } from "@vectra/types";
import { Card, CardContent, CardHeader, CardTitle, Skeleton } from "@vectra/ui";
import { formatMoney } from "@vectra/utils";
import { AlertTriangle } from "lucide-react";

import { StatCard } from "../dashboard/StatCard.js";

interface ScenarioSummaryCardsProps {
  summary?: ScenarioSummary;
  isLoading: boolean;
  currency: string;
}

export function ScenarioSummaryCards({ summary, isLoading, currency }: ScenarioSummaryCardsProps) {
  return (
    <div className="flex flex-col gap-4">
      {summary?.hasUpdates ? (
        <div className="flex items-center gap-2 rounded-md border border-amber-500/30 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:bg-amber-950 dark:text-amber-300">
          <AlertTriangle className="size-4 shrink-0" />
          Uno o más productos, ingresos o escenarios incluidos cambiaron desde que se agregaron. Los
          totales de abajo siguen usando el precio con el que se agregaron.
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
