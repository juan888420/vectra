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
import { Layers } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { ApiError } from "../../lib/api-client.js";
import { ScenarioCompositionCard } from "./ScenarioCompositionCard.js";
import {
  useAddScenarioComposition,
  useRemoveScenarioComposition,
  useScenarioCompositions,
  useScenarios,
} from "./use-scenarios.js";

interface ScenarioCompositionsSectionProps {
  scenario: ScenarioPublic;
  currency: string;
}

export function ScenarioCompositionsSection({
  scenario,
  currency,
}: ScenarioCompositionsSectionProps) {
  const [selectedId, setSelectedId] = useState("");
  const { data: compositions, isLoading } = useScenarioCompositions(scenario.id);
  const { data: scenariosData } = useScenarios({ pageSize: 100, sortBy: "name" });
  const addComposition = useAddScenarioComposition(scenario.id);
  const removeComposition = useRemoveScenarioComposition(scenario.id);

  // `GET /scenarios` already carries `monthly` per row (ADR-0006's
  // persistent scenario list) — reused here so each composed scenario's
  // headline number costs zero extra requests instead of one summary call
  // per row.
  const monthlyById = useMemo(
    () => new Map((scenariosData?.data ?? []).map((entry) => [entry.id, entry.monthly])),
    [scenariosData],
  );

  const includedIds = new Set(
    (compositions ?? []).map((composition) => composition.childScenarioId),
  );
  // Server-side is the authority on cycles (direct and transitive); this
  // filter only removes the obvious candidates (itself, already included) —
  // a cycle further down the graph still surfaces as a toast on submit.
  const availableScenarios = (scenariosData?.data ?? []).filter(
    (candidate) =>
      candidate.id !== scenario.id &&
      candidate.status !== "ARCHIVED" &&
      !includedIds.has(candidate.id),
  );
  const canEdit = scenario.status !== "ARCHIVED";

  async function handleAdd() {
    if (!selectedId) return;
    try {
      await addComposition.mutateAsync({ childScenarioId: selectedId });
      setSelectedId("");
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Algo salió mal.");
    }
  }

  async function handleRemove(compositionId: string) {
    try {
      await removeComposition.mutateAsync(compositionId);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Algo salió mal.");
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Escenarios incluidos</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {canEdit ? (
          <div className="flex gap-2">
            <Select value={selectedId} onValueChange={setSelectedId}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Selecciona un escenario para incluir" />
              </SelectTrigger>
              <SelectContent>
                {availableScenarios.map((candidate) => (
                  <SelectItem key={candidate.id} value={candidate.id}>
                    {candidate.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              onClick={() => void handleAdd()}
              disabled={!selectedId || addComposition.isPending}
            >
              Incluir
            </Button>
          </div>
        ) : null}

        {/* min-h keeps this area from collapsing when it goes from empty to a
            single card — same treatment as Productos and Ingresos, so the
            panel reads as a prepared workspace instead of resizing on first
            add. */}
        <div className="min-h-40">
          {isLoading ? (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(9rem,1fr))] gap-3">
              <Skeleton className="h-28 w-full rounded-xl" />
              <Skeleton className="h-28 w-full rounded-xl" />
              <Skeleton className="h-28 w-full rounded-xl" />
            </div>
          ) : (compositions ?? []).length === 0 ? (
            <EmptyState
              icon={Layers}
              title="Sin escenarios incluidos"
              description="Combina otro escenario completo dentro de este."
            />
          ) : (
            <ul className="grid grid-cols-[repeat(auto-fill,minmax(9rem,1fr))] gap-3">
              {(compositions ?? []).map((composition) => (
                <li key={composition.id} className="flex">
                  <ScenarioCompositionCard
                    composition={composition}
                    monthly={monthlyById.get(composition.childScenarioId)}
                    currency={currency}
                    canEdit={canEdit}
                    onRemove={() => void handleRemove(composition.id)}
                  />
                </li>
              ))}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
