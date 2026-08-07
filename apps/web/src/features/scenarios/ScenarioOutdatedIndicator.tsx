import { cn } from "@vectra/ui";

// One amber recipe for "this snapshot has unsynced financial drift" (RFC-0023.3),
// shared by every row/tile across Productos, Ingresos and Escenarios heredados —
// border + tint here, never a text badge, so "Desactualizado" reads the same
// everywhere on this page instead of one section using a pill and another a dot.
const OUTDATED_TINT_CLASSNAME =
  "border-amber-300 bg-amber-50/60 dark:border-amber-900 dark:bg-amber-950/25";

/** Base container classes shared by every row/tile in the scenario composer
 * (ScenarioItemCard, ScenarioCompositionCard, the income row): same radius,
 * border and hover treatment, swapped for the outdated tint when drifted. */
export function scenarioRowClassName(outdated: boolean, extra?: string) {
  return cn(
    "rounded-xl border transition-colors",
    outdated ? OUTDATED_TINT_CLASSNAME : "hover:bg-muted/50",
    extra,
  );
}

/** The dot-shaped "Desactualizado" indicator itself, for inline placement next
 * to a name/title. Pair with `scenarioRowClassName(true, …)` for the container. */
export function ScenarioOutdatedIndicator() {
  return (
    <>
      <span
        className="size-1.5 shrink-0 rounded-full bg-amber-500"
        title="Desactualizado"
        aria-hidden
      />
      <span className="sr-only">Desactualizado</span>
    </>
  );
}
