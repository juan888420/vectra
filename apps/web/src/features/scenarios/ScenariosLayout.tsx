import type { ScenarioListItem } from "@vectra/types";
import { Badge, Button, cn } from "@vectra/ui";
import { Archive, ChevronLeft, ChevronRight, Layers, Plus, Sparkles } from "lucide-react";
import { useState } from "react";
import { Link, Outlet, useParams } from "react-router";

import { ScenarioFormDialog } from "./ScenarioFormDialog.js";
import { useScenarios } from "./use-scenarios.js";

const STATUS_ICONS = {
  ACTIVE: Sparkles,
  INACTIVE: Layers,
  ARCHIVED: Archive,
};

export interface ScenariosOutletContext {
  openCreateDialog: () => void;
}

interface ScenarioSidebarRowProps {
  scenario: ScenarioListItem;
  isCurrent: boolean;
  /** Archived scenarios stay in the sidebar (so archiving one never makes it
   * feel "lost") but read at lower emphasis than the primary list — same
   * row, same interaction, just dimmer. */
  muted?: boolean;
}

function ScenarioSidebarRow({ scenario, isCurrent, muted = false }: ScenarioSidebarRowProps) {
  const IconComponent = STATUS_ICONS[scenario.status];
  const isGloballyActive = scenario.status === "ACTIVE";

  return (
    <li>
      <Link
        to={`/scenarios/${scenario.id}`}
        className={cn(
          "flex items-center justify-between gap-2 rounded-md px-3 py-2 text-sm transition-colors",
          isCurrent
            ? "bg-accent font-medium text-accent-foreground"
            : cn(
                "hover:bg-accent hover:text-accent-foreground",
                // Foreground (not muted-foreground) for the primary list so it
                // reads clearly darker than the dimmed Archivados section —
                // muted-foreground alone made the two tiers too close.
                muted ? "text-muted-foreground/60" : "text-foreground",
              ),
        )}
      >
        <span className="flex min-w-0 items-center gap-2.5">
          <IconComponent
            className={cn(
              "size-4 shrink-0",
              isGloballyActive
                ? "text-primary"
                : muted
                  ? "text-muted-foreground/60"
                  : "text-muted-foreground",
            )}
          />
          <span className="truncate">{scenario.name}</span>
        </span>
        {isGloballyActive ? (
          <Badge variant="default" className="shrink-0">
            Activo
          </Badge>
        ) : null}
      </Link>
    </li>
  );
}

// The main screen of the product (ADR-0006): a persistent list + detail
// split, not a CRUD list you navigate away from — closer to Linear/Notion
// than to Categories/Products/Incomes' simple list→detail navigation. Uses
// the same design tokens as the rest of the app (bg-card/border/accent, the
// one indigo --primary), not a bespoke dark palette — a nested panel should
// still read as Vectra, not as a different product bolted on.
export function ScenariosLayout() {
  const { id } = useParams<{ id: string }>();
  const [creating, setCreating] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(() => {
    try {
      return localStorage.getItem("scenarios_sidebar_collapsed") === "true";
    } catch {
      return false;
    }
  });

  // includeArchived so archiving a scenario doesn't drop it out of the
  // sidebar entirely — split below into the primary list and a dimmer
  // "Archivados" section instead of two separate requests.
  const { data, isLoading } = useScenarios({
    pageSize: 100,
    sortBy: "name",
    includeArchived: true,
  });
  const scenarios = data?.data ?? [];
  // The globally ACTIVE scenario always leads, even over something touched
  // more recently — it's the one whose numbers currently matter. Within each
  // group (active / not), most-recently-touched first: creating, editing or
  // unarchiving a scenario all bump `updatedAt`, so whichever one the user
  // just acted on still surfaces without them having to hunt for it. Archived
  // scenarios keep the query's own name order (`sortBy: "name"` above) — only
  // the primary list's ordering changes here.
  const currentScenarios = scenarios
    .filter((scenario) => scenario.status !== "ARCHIVED")
    .sort((a, b) => {
      if (a.status === "ACTIVE" && b.status !== "ACTIVE") return -1;
      if (a.status !== "ACTIVE" && b.status === "ACTIVE") return 1;
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });
  const archivedScenarios = scenarios.filter((scenario) => scenario.status === "ARCHIVED");

  const toggleSidebar = () => {
    setIsCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("scenarios_sidebar_collapsed", String(next));
      } catch {
        // Ignore storage errors (e.g. private browsing)
      }
      return next;
    });
  };

  return (
    <div className="flex h-[calc(100dvh-7rem)] gap-4">
      <aside
        className={cn(
          "flex shrink-0 flex-col overflow-hidden rounded-lg border bg-card shadow-sm transition-all duration-300 ease-in-out",
          isCollapsed ? "w-0 border-none opacity-0" : "w-64 opacity-100",
        )}
      >
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div className="flex items-center gap-2">
            <Layers className="size-4 text-primary" />
            <span className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              Escenarios
            </span>
          </div>
          <div className="flex items-center gap-1">
            <Button
              size="icon"
              variant="ghost"
              className="size-7"
              onClick={() => setCreating(true)}
              aria-label="Nuevo escenario"
            >
              <Plus className="size-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="size-7"
              onClick={toggleSidebar}
              aria-label="Colapsar sidebar"
            >
              <ChevronLeft className="size-4" />
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {isLoading ? (
            <p className="p-3 text-sm text-muted-foreground">Cargando…</p>
          ) : scenarios.length === 0 ? (
            <p className="p-3 text-sm text-muted-foreground">Todavía no hay escenarios.</p>
          ) : (
            <>
              {currentScenarios.length > 0 ? (
                <ul className="flex flex-col gap-1">
                  {currentScenarios.map((scenario) => (
                    <ScenarioSidebarRow
                      key={scenario.id}
                      scenario={scenario}
                      isCurrent={scenario.id === id}
                    />
                  ))}
                </ul>
              ) : (
                <p className="p-3 text-sm text-muted-foreground">Sin escenarios activos.</p>
              )}

              {archivedScenarios.length > 0 ? (
                <>
                  <div className="px-3 pb-1 pt-3 text-[11px] font-semibold tracking-wide text-muted-foreground/60 uppercase">
                    Archivados
                  </div>
                  <ul className="flex flex-col gap-1">
                    {archivedScenarios.map((scenario) => (
                      <ScenarioSidebarRow
                        key={scenario.id}
                        scenario={scenario}
                        isCurrent={scenario.id === id}
                        muted
                      />
                    ))}
                  </ul>
                </>
              ) : null}
            </>
          )}
        </div>
      </aside>

      <div className="relative min-w-0 flex-1 overflow-y-auto rounded-lg border shadow-sm">
        {isCollapsed && (
          <Button
            size="icon"
            variant="outline"
            className="absolute left-3 top-3 z-40"
            onClick={toggleSidebar}
            aria-label="Expandir sidebar"
          >
            <ChevronRight className="size-4" />
          </Button>
        )}
        <Outlet
          context={{ openCreateDialog: () => setCreating(true) } satisfies ScenariosOutletContext}
        />
      </div>

      <ScenarioFormDialog open={creating} onOpenChange={setCreating} />
    </div>
  );
}
