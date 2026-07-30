import type { ScenarioStatus } from "@vectra/types";
import { Button, cn } from "@vectra/ui";
import { formatMoney } from "@vectra/utils";
import { Plus } from "lucide-react";
import { useState } from "react";
import { Link, Outlet, useParams } from "react-router";

import { useAuth } from "../auth/useAuth.js";
import { ScenarioFormDialog } from "./ScenarioFormDialog.js";
import { useScenarios } from "./use-scenarios.js";

const STATUS_DOT_CLASSNAME: Record<ScenarioStatus, string> = {
  ACTIVE: "bg-emerald-500",
  INACTIVE: "bg-muted-foreground/40",
  ARCHIVED: "bg-muted-foreground/20",
};

export interface ScenariosOutletContext {
  openCreateDialog: () => void;
}

// The main screen of the product (ADR-0006): a persistent list + detail
// split, not a CRUD list you navigate away from — closer to Linear/Notion
// than to Categories/Products/Incomes' simple list→detail navigation.
export function ScenariosLayout() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [creating, setCreating] = useState(false);

  const { data, isLoading } = useScenarios({ pageSize: 100, sortBy: "name" });
  const scenarios = data?.data ?? [];
  const currency = user?.defaultCurrency ?? "USD";

  return (
    <div className="flex h-[calc(100dvh-7rem)] gap-4">
      <aside className="flex w-64 shrink-0 flex-col rounded-lg border">
        <div className="flex items-center justify-between border-b px-3 py-2.5">
          <span className="text-sm font-medium">Escenarios</span>
          <Button
            size="icon"
            variant="ghost"
            className="size-7"
            onClick={() => setCreating(true)}
            aria-label="Nuevo escenario"
          >
            <Plus className="size-4" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto p-1.5">
          {isLoading ? (
            <p className="p-3 text-sm text-muted-foreground">Cargando…</p>
          ) : scenarios.length === 0 ? (
            <p className="p-3 text-sm text-muted-foreground">Todavía no hay escenarios.</p>
          ) : (
            <ul className="flex flex-col gap-0.5">
              {scenarios.map((scenario) => (
                <li key={scenario.id}>
                  <Link
                    to={`/scenarios/${scenario.id}`}
                    className={cn(
                      "flex items-center justify-between gap-2 rounded-md px-2.5 py-2 text-sm transition-colors hover:bg-accent",
                      scenario.id === id && "bg-accent font-medium",
                    )}
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <span
                        className={cn(
                          "size-1.5 shrink-0 rounded-full",
                          STATUS_DOT_CLASSNAME[scenario.status],
                        )}
                      />
                      <span className="truncate">{scenario.name}</span>
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {formatMoney(scenario.monthly, currency)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>

      <div className="min-w-0 flex-1 overflow-y-auto rounded-lg border">
        <Outlet
          context={{ openCreateDialog: () => setCreating(true) } satisfies ScenariosOutletContext}
        />
      </div>

      <ScenarioFormDialog open={creating} onOpenChange={setCreating} />
    </div>
  );
}
