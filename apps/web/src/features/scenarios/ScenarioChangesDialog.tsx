import type { ExpenseItemFrequency, IncomeFrequency, ScenarioChange } from "@vectra/types";
import {
  Button,
  Checkbox,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Skeleton,
} from "@vectra/ui";
import { formatMoney } from "@vectra/utils";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { ApiError } from "../../lib/api-client.js";
import { useApplyScenarioChanges, useScenarioChanges } from "./use-scenarios.js";

const EXPENSE_FREQUENCY_LABELS: Record<ExpenseItemFrequency, string> = {
  MONTHLY: "Mensual",
  YEARLY: "Anual",
  ONE_TIME: "Esporádico",
};

const INCOME_FREQUENCY_LABELS: Record<IncomeFrequency, string> = {
  WEEKLY: "Semanal",
  MONTHLY: "Mensual",
  YEARLY: "Anual",
  ONE_TIME: "Esporádico",
};

// One entry per ScenarioChange["type"] — exhaustive by construction (no
// `default`), so a new change type added to the union fails the build here
// until it gets its own icon + message, instead of silently rendering blank.
function describeChange(change: ScenarioChange): { icon: string; text: string } {
  switch (change.type) {
    case "ITEM_RENAMED":
      return { icon: "✏️", text: `El producto "${change.from}" fue renombrado a "${change.to}".` };
    case "ITEM_CATEGORY_RENAMED":
      return {
        icon: "✏️",
        text: `La categoría "${change.from}" fue renombrada a "${change.to}".`,
      };
    case "ITEM_PRICE_CHANGED":
      return {
        icon: "💰",
        text: `El precio de ${change.itemName} cambió de ${formatMoney(change.from, change.currency)} a ${formatMoney(change.to, change.currency)}.`,
      };
    case "ITEM_FREQUENCY_CHANGED":
      return {
        icon: "🔁",
        text: `La frecuencia de ${change.itemName} cambió de ${EXPENSE_FREQUENCY_LABELS[change.from]} a ${EXPENSE_FREQUENCY_LABELS[change.to]}.`,
      };
    case "ITEM_ARCHIVED":
      return { icon: "🗑️", text: `El producto ${change.itemName} fue archivado.` };
    case "INCOME_RENAMED":
      return { icon: "✏️", text: `El ingreso "${change.from}" fue renombrado a "${change.to}".` };
    case "INCOME_AMOUNT_CHANGED":
      return {
        icon: "💰",
        text: `El monto de ${change.incomeName} cambió de ${formatMoney(change.from, change.currency)} a ${formatMoney(change.to, change.currency)}.`,
      };
    case "INCOME_FREQUENCY_CHANGED":
      return {
        icon: "🔁",
        text: `La frecuencia de ${change.incomeName} cambió de ${INCOME_FREQUENCY_LABELS[change.from]} a ${INCOME_FREQUENCY_LABELS[change.to]}.`,
      };
    case "INCOME_ARCHIVED":
      return { icon: "🗑️", text: `El ingreso ${change.incomeName} fue archivado.` };
    case "NEW_ITEM_AVAILABLE":
      return {
        icon: "➕",
        text: `Se agregó un nuevo producto, "${change.itemName}" (${formatMoney(change.amount, change.currency)}), a la categoría "${change.categoryName}" incluida en este escenario.`,
      };
  }
}

interface ScenarioChangesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  scenarioId: string;
}

// The full explanation behind the "cambios pendientes" banner (RFC-0023.1):
// visual changes (a rename) sync the instant this opens, no confirmation —
// they never move a total. Financial changes stay listed with a checkbox
// until the user reviews and confirms (ADR-0005/0006: nothing changes
// silently).
export function ScenarioChangesDialog({
  open,
  onOpenChange,
  scenarioId,
}: ScenarioChangesDialogProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const { data: changes, isLoading } = useScenarioChanges(open ? scenarioId : "");
  const applyChanges = useApplyScenarioChanges(scenarioId);

  const financialChanges = (changes ?? []).filter((change) => change.kind === "financial");

  // Visual changes never need the user's attention — resolved the moment
  // the list loads, silently, with no toast and no entry in the list above.
  useEffect(() => {
    if (!changes || applyChanges.isPending) return;
    const visualIds = changes
      .filter((change) => change.kind === "visual")
      .map((change) => change.id);
    if (visualIds.length > 0) {
      applyChanges.mutate(visualIds);
    }
  }, [changes]);

  useEffect(() => {
    if (!open) setSelectedIds(new Set());
  }, [open]);

  function toggle(id: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  async function handleConfirm() {
    if (selectedIds.size === 0) return;
    try {
      await applyChanges.mutateAsync([...selectedIds]);
      toast.success("Cambios aplicados.");
      setSelectedIds(new Set());
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Algo salió mal. Intenta de nuevo.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Cambios pendientes de revisar</DialogTitle>
          <DialogDescription>
            Este escenario tiene cambios pendientes de revisar. Selecciona cuáles aplicar — nada se
            modifica hasta que confirmes.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <Skeleton className="h-24 w-full" />
        ) : financialChanges.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No hay cambios financieros pendientes de confirmar.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {financialChanges.map((change) => {
              const { icon, text } = describeChange(change);
              const fromAnotherScenario = change.originScenarioId !== scenarioId;
              return (
                <li
                  key={change.id}
                  className="flex items-start gap-2.5 rounded-md border px-3 py-2.5 text-sm"
                >
                  <Checkbox
                    checked={selectedIds.has(change.id)}
                    onCheckedChange={() => toggle(change.id)}
                    className="mt-0.5"
                    aria-label="Seleccionar cambio"
                  />
                  <span>
                    <span className="mr-1.5">{icon}</span>
                    {text}
                    {fromAnotherScenario ? (
                      <span className="text-muted-foreground">
                        {" "}
                        (en "{change.originScenarioName}")
                      </span>
                    ) : null}
                  </span>
                </li>
              );
            })}
          </ul>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cerrar
          </Button>
          <Button
            onClick={() => void handleConfirm()}
            disabled={selectedIds.size === 0 || applyChanges.isPending}
          >
            Aplicar seleccionados
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
