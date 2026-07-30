import { formatMoney } from "@vectra/utils";

import { StatCard } from "../features/dashboard/StatCard.js";

interface ProjectionStatCardsProps {
  monthly?: number;
  sixMonths?: number;
  twelveMonths?: number;
  currency: string;
  isLoading: boolean;
}

// The mensual/6m/anual trio every "question screen" shows (ADR-0006):
// Category, Product and Income detail pages. Scenario has its own richer
// ScenarioSummaryCards (coverage, one-time items, hasUpdates) — this is the
// plain version reused by the other three.
export function ProjectionStatCards({
  monthly,
  sixMonths,
  twelveMonths,
  currency,
  isLoading,
}: ProjectionStatCardsProps) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <StatCard
        label="Mensual"
        value={isLoading ? undefined : formatMoney(monthly ?? 0, currency)}
        isLoading={isLoading}
      />
      <StatCard
        label="6 meses"
        value={isLoading ? undefined : formatMoney(sixMonths ?? 0, currency)}
        isLoading={isLoading}
      />
      <StatCard
        label="Anual"
        value={isLoading ? undefined : formatMoney(twelveMonths ?? 0, currency)}
        isLoading={isLoading}
      />
    </div>
  );
}
