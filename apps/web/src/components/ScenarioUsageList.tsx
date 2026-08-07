import type { ScenarioStatus } from "@vectra/types";
import { Badge, Card, CardContent, CardHeader, CardTitle, EmptyState } from "@vectra/ui";
import { Layers } from "lucide-react";
import { Link } from "react-router";

const SCENARIO_STATUS_LABELS: Record<ScenarioStatus, string> = {
  ACTIVE: "Activo",
  INACTIVE: "Inactivo",
  ARCHIVED: "Archivado",
};

interface ScenarioUsageListProps {
  scenarios: Array<{ id: string; name: string; status: ScenarioStatus }>;
}

// "En qué escenarios se usa" (ADR-0006): the same question, and the same
// answer shape ({id, name, status}), for Productos and Ingresos — so this
// lives here rather than in either feature folder, and neither depends on
// the other or on features/scenarios for it.
export function ScenarioUsageList({ scenarios }: ScenarioUsageListProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Usado en estos escenarios</CardTitle>
      </CardHeader>
      <CardContent>
        {scenarios.length === 0 ? (
          <EmptyState
            icon={Layers}
            title="No se usa en ningún escenario todavía"
            description="Agrégalo a un escenario para ver cuánto pesa en tus simulaciones."
          />
        ) : (
          <ul className="flex flex-col gap-2">
            {scenarios.map((scenario) => (
              <li key={scenario.id}>
                <Link
                  to={`/scenarios/${scenario.id}`}
                  className="flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm hover:bg-accent"
                >
                  <span className="font-medium">{scenario.name}</span>
                  <Badge variant={scenario.status === "ACTIVE" ? "default" : "outline"}>
                    {SCENARIO_STATUS_LABELS[scenario.status]}
                  </Badge>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
