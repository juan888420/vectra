import type { ScenarioPublic } from "@vectra/types";
import {
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
import { Banknote, Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { ApiError } from "../../lib/api-client.js";
import { IncomeFormDialog } from "../incomes/IncomeFormDialog.js";
import { useIncomes } from "../incomes/use-incomes.js";
import { ScenarioIncomeCard } from "./ScenarioIncomeCard.js";
import {
  useAddScenarioIncome,
  useRemoveScenarioIncome,
  useScenarioIncomes,
} from "./use-scenarios.js";

interface ScenarioIncomesSectionProps {
  scenario: ScenarioPublic;
}

export function ScenarioIncomesSection({ scenario }: ScenarioIncomesSectionProps) {
  const [selectedId, setSelectedId] = useState("");
  const [creatingIncome, setCreatingIncome] = useState(false);
  const { data: scenarioIncomes, isLoading } = useScenarioIncomes(scenario.id);
  const { data: incomesData } = useIncomes({ pageSize: 100, sortBy: "name" });
  const addIncome = useAddScenarioIncome(scenario.id);
  const removeIncome = useRemoveScenarioIncome(scenario.id);

  const includedIds = new Set((scenarioIncomes ?? []).map((income) => income.incomeId));
  const availableIncomes = (incomesData?.data ?? []).filter(
    (income) => !includedIds.has(income.id),
  );
  const canEdit = scenario.status !== "ARCHIVED";

  async function handleAdd() {
    if (!selectedId) return;
    try {
      await addIncome.mutateAsync({ incomeId: selectedId });
      setSelectedId("");
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Algo salió mal.");
    }
  }

  async function handleCreated(incomeId: string) {
    try {
      await addIncome.mutateAsync({ incomeId });
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Algo salió mal.");
    }
  }

  async function handleRemove(scenarioIncomeId: string) {
    try {
      await removeIncome.mutateAsync(scenarioIncomeId);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Algo salió mal.");
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Ingresos vinculados</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {canEdit ? (
          <div className="flex gap-2">
            <Select value={selectedId} onValueChange={setSelectedId}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Selecciona un ingreso para vincular" />
              </SelectTrigger>
              <SelectContent>
                {availableIncomes.map((income) => (
                  <SelectItem key={income.id} value={income.id}>
                    {income.name} — {formatMoney(income.amount, income.currency)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={() => void handleAdd()} disabled={!selectedId || addIncome.isPending}>
              Vincular
            </Button>
            <Button variant="outline" onClick={() => setCreatingIncome(true)}>
              <Plus /> Nuevo
            </Button>
          </div>
        ) : null}

        {/* min-h keeps this area from collapsing when it goes from empty to a
            single card — same treatment as Productos and Escenarios
            incluidos, so all three sections read as one system. */}
        <div className="min-h-40">
          {isLoading ? (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(9rem,1fr))] gap-3">
              <Skeleton className="h-28 w-full rounded-xl" />
              <Skeleton className="h-28 w-full rounded-xl" />
              <Skeleton className="h-28 w-full rounded-xl" />
            </div>
          ) : (scenarioIncomes ?? []).length === 0 ? (
            <EmptyState
              icon={Banknote}
              title="Sin ingresos vinculados"
              description="Vincula un ingreso para ver la cobertura de este escenario."
            />
          ) : (
            <ul className="grid grid-cols-[repeat(auto-fill,minmax(9rem,1fr))] gap-3">
              {(scenarioIncomes ?? []).map((income) => (
                <li key={income.id} className="flex">
                  <ScenarioIncomeCard
                    income={income}
                    canEdit={canEdit}
                    onRemove={() => void handleRemove(income.id)}
                  />
                </li>
              ))}
            </ul>
          )}
        </div>
      </CardContent>

      <IncomeFormDialog
        open={creatingIncome}
        onOpenChange={setCreatingIncome}
        onCreated={(income) => void handleCreated(income.id)}
      />
    </Card>
  );
}
