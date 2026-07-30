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
import { Layers, X } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import { toast } from "sonner";

import { ApiError } from "../../lib/api-client.js";
import {
  useAddScenarioComposition,
  useRemoveScenarioComposition,
  useScenarioCompositions,
  useScenarios,
} from "./use-scenarios.js";

interface ScenarioCompositionsSectionProps {
  scenario: ScenarioPublic;
}

export function ScenarioCompositionsSection({ scenario }: ScenarioCompositionsSectionProps) {
  const [selectedId, setSelectedId] = useState("");
  const { data: compositions, isLoading } = useScenarioCompositions(scenario.id);
  const { data: scenariosData } = useScenarios({ pageSize: 100, sortBy: "name" });
  const addComposition = useAddScenarioComposition(scenario.id);
  const removeComposition = useRemoveScenarioComposition(scenario.id);

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

        {isLoading ? (
          <Skeleton className="h-16 w-full" />
        ) : (compositions ?? []).length === 0 ? (
          <EmptyState
            icon={Layers}
            title="Sin escenarios incluidos"
            description="Combina otro escenario completo dentro de este."
          />
        ) : (
          <ul className="flex flex-col gap-2">
            {(compositions ?? []).map((composition) => (
              <li
                key={composition.id}
                className="flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm"
              >
                <Link
                  to={`/scenarios/${composition.childScenarioId}`}
                  className="font-medium hover:underline"
                >
                  {composition.childScenarioName}
                </Link>
                {canEdit ? (
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Quitar ${composition.childScenarioName}`}
                    onClick={() => void handleRemove(composition.id)}
                  >
                    <X />
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
