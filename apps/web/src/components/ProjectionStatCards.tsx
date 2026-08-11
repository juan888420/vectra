import { formatMoney, formatMoneyCompact } from "@vectra/utils";

import { StatCard } from "./StatCard.js";

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
  // The 12-month figure is an order of magnitude above the monthly one, so
  // these abbreviate past a million and keep the exact value on hover — the
  // full number stays one hop away on whichever detail page owns it.
  const cards = [
    { label: "Mensual", amount: monthly ?? 0 },
    { label: "6 meses", amount: sixMonths ?? 0 },
    { label: "Anual", amount: twelveMonths ?? 0 },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      {cards.map((card) => (
        <StatCard
          key={card.label}
          label={card.label}
          value={isLoading ? undefined : formatMoneyCompact(card.amount, currency)}
          valueTitle={isLoading ? undefined : formatMoney(card.amount, currency)}
          isLoading={isLoading}
        />
      ))}
    </div>
  );
}
