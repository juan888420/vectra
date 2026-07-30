import type { ExpenseItemFrequency, ScenarioPublic } from "@vectra/types";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
} from "@vectra/ui";
import { formatMoney } from "@vectra/utils";
import { Plus, ShoppingBag, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { ApiError } from "../../lib/api-client.js";
import { ExpenseItemFormDialog } from "../expense-items/ExpenseItemFormDialog.js";
import { useExpenseItems } from "../expense-items/use-expense-items.js";
import { useAddScenarioItem, useRemoveScenarioItem, useScenarioItems } from "./use-scenarios.js";

const FREQUENCY_LABELS: Record<ExpenseItemFrequency, string> = {
  MONTHLY: "Mensual",
  YEARLY: "Anual",
  ONE_TIME: "Esporádico",
};

interface ScenarioItemsSectionProps {
  scenario: ScenarioPublic;
}

export function ScenarioItemsSection({ scenario }: ScenarioItemsSectionProps) {
  const [selectedId, setSelectedId] = useState("");
  const [creatingItem, setCreatingItem] = useState(false);
  const { data: scenarioItems, isLoading } = useScenarioItems(scenario.id);
  const { data: expenseItemsData } = useExpenseItems({ pageSize: 100, sortBy: "name" });
  const addItem = useAddScenarioItem(scenario.id);
  const removeItem = useRemoveScenarioItem(scenario.id);

  const includedIds = new Set((scenarioItems ?? []).map((item) => item.expenseItemId));
  const availableItems = (expenseItemsData?.data ?? []).filter((item) => !includedIds.has(item.id));
  const canEdit = scenario.status !== "ARCHIVED";

  async function handleAdd() {
    if (!selectedId) return;
    try {
      await addItem.mutateAsync({ expenseItemId: selectedId });
      setSelectedId("");
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Algo salió mal.");
    }
  }

  // Creating from here (ADR-0005 §3): the new product (and its category,
  // inline too) gets added to this scenario right away instead of forcing a
  // trip to /expense-items first.
  async function handleCreated(itemId: string) {
    try {
      await addItem.mutateAsync({ expenseItemId: itemId });
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Algo salió mal.");
    }
  }

  async function handleRemove(itemId: string) {
    try {
      await removeItem.mutateAsync(itemId);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Algo salió mal.");
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Productos</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {canEdit ? (
          <div className="flex gap-2">
            <Select value={selectedId} onValueChange={setSelectedId}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Selecciona un producto para agregar" />
              </SelectTrigger>
              <SelectContent>
                {availableItems.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.name} — {formatMoney(item.amount, item.currency)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={() => void handleAdd()} disabled={!selectedId || addItem.isPending}>
              Agregar
            </Button>
            <Button variant="outline" onClick={() => setCreatingItem(true)}>
              <Plus /> Nuevo
            </Button>
          </div>
        ) : null}

        {isLoading ? (
          <Skeleton className="h-16 w-full" />
        ) : (scenarioItems ?? []).length === 0 ? (
          <EmptyState
            icon={ShoppingBag}
            title="Sin productos"
            description="Agrega productos existentes para incluirlos en este escenario."
          />
        ) : (
          <ul className="flex flex-col gap-2">
            {(scenarioItems ?? []).map((item) => (
              <li
                key={item.id}
                className="flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm"
              >
                <div className="flex min-w-0 flex-col">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate font-medium">{item.name}</span>
                    <Badge variant="outline" className="shrink-0">
                      {FREQUENCY_LABELS[item.frequency]}
                    </Badge>
                    {item.outdated ? (
                      <Badge className="shrink-0 border-transparent bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400">
                        Desactualizado
                      </Badge>
                    ) : null}
                  </div>
                  <span className="truncate text-xs text-muted-foreground">
                    {item.categoryName}
                  </span>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="font-medium">{formatMoney(item.amount, item.currency)}</span>
                  {canEdit ? (
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Quitar ${item.name}`}
                      onClick={() => void handleRemove(item.id)}
                    >
                      <X />
                    </Button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>

      <ExpenseItemFormDialog
        open={creatingItem}
        onOpenChange={setCreatingItem}
        onCreated={(item) => void handleCreated(item.id)}
      />
    </Card>
  );
}
