import type { ImpactFrequency, ScenarioImpactChange } from "@vectra/types";
import { formatMoney } from "@vectra/utils";

const FREQUENCY_LABELS: Record<ImpactFrequency, string> = {
  WEEKLY: "Semanal",
  MONTHLY: "Mensual",
  YEARLY: "Anual",
  ONE_TIME: "Esporádico",
};

// The one place that turns a ScenarioImpactChange into Spanish. Used by
// ScenarioImpactDialog (right after a single product/income is saved) and
// by ScenarioSummaryCards' "Cambios pendientes" (every resource still out
// of sync in a whole scenario) — same function, same wording, always in
// sync with each other because there is only one of it (RFC-0023.3).
//
// Exhaustive on purpose (no `default`): a new impact field fails the build
// here instead of silently rendering nothing in one of the two places.
export function describeScenarioChange(change: ScenarioImpactChange): string {
  switch (change.field) {
    case "amount": {
      const label = change.source === "income" ? "ingreso" : "precio";
      const to = formatMoney(change.to, change.currency);
      const value =
        change.from === null ? to : `${formatMoney(change.from, change.currency)} → ${to}`;
      return `${change.name}: ${label} ${value}`;
    }
    case "frequency": {
      const to = FREQUENCY_LABELS[change.to];
      const value = change.from === null ? to : `${FREQUENCY_LABELS[change.from]} → ${to}`;
      return `${change.name}: frecuencia ${value}`;
    }
    case "archived":
      return `${change.name} fue archivado.`;
  }
}
