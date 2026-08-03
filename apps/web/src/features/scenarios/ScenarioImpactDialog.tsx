import type { AffectedScenario, ScenarioImpactChange } from "@vectra/types";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@vectra/ui";

import { describeScenarioChange } from "./describe-scenario-change.js";

interface ScenarioImpactDialogProps {
  scenarios: AffectedScenario[];
  changes: ScenarioImpactChange[];
  onConfirm: () => void;
  onDismiss: () => void;
  isPending: boolean;
}

// Shown right after a product/income has already been saved (RFC-0023.3):
// the edit is done, this only decides whether the scenarios that use it get
// their snapshots synced now. It spells out what would change via the same
// describeScenarioChange the scenario's own "Cambios pendientes" summary
// uses — no checkboxes, no per-change selection: it is all-or-nothing.
// Declining costs nothing, those scenarios just keep showing "Tiene
// cambios pendientes".
export function ScenarioImpactDialog({
  scenarios,
  changes,
  onConfirm,
  onDismiss,
  isPending,
}: ScenarioImpactDialogProps) {
  const count = scenarios.length;

  return (
    <AlertDialog open={count > 0} onOpenChange={(open) => !open && onDismiss()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {count === 1
              ? "Este cambio afecta a 1 escenario"
              : `Este cambio afecta a ${count} escenarios`}
          </AlertDialogTitle>
          <AlertDialogDescription>¿Deseas aplicar este cambio ahora?</AlertDialogDescription>
        </AlertDialogHeader>

        <ul className="flex flex-col gap-1.5 text-sm">
          {changes.map((change, index) => (
            <li key={index} className="rounded-md border px-3 py-2">
              {describeScenarioChange(change)}
            </li>
          ))}
        </ul>

        <p className="text-xs text-muted-foreground">
          En {scenarios.map((scenario) => scenario.name).join(", ")}.
        </p>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>No ahora</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} disabled={isPending}>
            {isPending ? "Aplicando…" : "Aplicar ahora"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
