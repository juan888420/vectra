import { Button, EmptyState } from "@vectra/ui";
import { Layers, Plus } from "lucide-react";
import { Navigate, useOutletContext } from "react-router";

import type { ScenariosOutletContext } from "./ScenariosLayout.js";
import { useScenarios } from "./use-scenarios.js";

// Rendered at the index route `/scenarios` (no :id selected yet). Lands
// directly on the active scenario, like opening Linear and seeing your
// issues — not an empty list waiting for a click (ADR-0006).
export function ScenariosIndexPage() {
  const { data, isLoading } = useScenarios({ pageSize: 100, sortBy: "name" });
  const { openCreateDialog } = useOutletContext<ScenariosOutletContext>();

  if (isLoading) {
    return null;
  }

  const scenarios = data?.data ?? [];
  const active = scenarios.find((scenario) => scenario.status === "ACTIVE");
  if (active) {
    return <Navigate to={`/scenarios/${active.id}`} replace />;
  }

  return (
    <div className="flex h-full items-center justify-center p-6">
      <EmptyState
        icon={Layers}
        title={scenarios.length === 0 ? "Todavía no hay escenarios" : "Ningún escenario activo"}
        description={
          scenarios.length === 0
            ? "Crea tu primer escenario para empezar a simular tu estilo de vida."
            : "Selecciona un escenario de la lista o crea uno nuevo."
        }
        action={
          <Button onClick={openCreateDialog}>
            <Plus /> Nuevo escenario
          </Button>
        }
      />
    </div>
  );
}
