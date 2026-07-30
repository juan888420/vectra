import type { IncomeFrequency, ScenarioPublic } from "@vectra/types";
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
import { Banknote, Plus, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { ApiError } from "../../lib/api-client.js";
import { IncomeFormDialog } from "../incomes/IncomeFormDialog.js";
import { useIncomes } from "../incomes/use-incomes.js";
import {
  useAddScenarioIncome,
  useRemoveScenarioIncome,
  useScenarioIncomes,
} from "./use-scenarios.js";

const FREQUENCY_LABELS: Record<IncomeFrequency, string> = {
  WEEKLY: "Semanal",
  MONTHLY: "Mensual",
  YEARLY: "Anual",
  ONE_TIME: "Esporádico",
};

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

        {isLoading ? (
          <Skeleton className="h-16 w-full" />
        ) : (scenarioIncomes ?? []).length === 0 ? (
          <EmptyState
            icon={Banknote}
            title="Sin ingresos vinculados"
            description="Vincula un ingreso para ver la cobertura de este escenario."
          />
        ) : (
          <ul className="flex flex-col gap-2">
            {(scenarioIncomes ?? []).map((income) => (
              <li
                key={income.id}
                className="flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm"
              >
                <div className="flex items-center gap-1.5">
                  <span className="font-medium">{income.name}</span>
                  <Badge variant="outline">{FREQUENCY_LABELS[income.frequency]}</Badge>
                  {income.outdated ? (
                    <Badge className="border-transparent bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400">
                      Desactualizado
                    </Badge>
                  ) : null}
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-medium text-emerald-600 dark:text-emerald-400">
                    {formatMoney(income.amount, income.currency)}
                  </span>
                  {canEdit ? (
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Quitar ${income.name}`}
                      onClick={() => void handleRemove(income.id)}
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

      <IncomeFormDialog
        open={creatingIncome}
        onOpenChange={setCreatingIncome}
        onCreated={(income) => void handleCreated(income.id)}
      />
    </Card>
  );
}
