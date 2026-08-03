import type { ScenarioStatus } from "@vectra/types";
import { Button, cn } from "@vectra/ui";
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

const STATUS_ICON_COLORS: Record<ScenarioStatus, string> = {
  ACTIVE: "text-emerald-400 group-hover:text-emerald-300",
  INACTIVE: "text-slate-500 group-hover:text-slate-300",
  ARCHIVED: "text-slate-600",
};

export interface ScenariosOutletContext {
  openCreateDialog: () => void;
}

// The main screen of the product (ADR-0006): a persistent list + detail
// split, not a CRUD list you navigate away from — closer to Linear/Notion
// than to Categories/Products/Incomes' simple list→detail navigation.
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

  const { data, isLoading } = useScenarios({ pageSize: 100, sortBy: "name" });
  const scenarios = data?.data ?? [];

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
          "flex shrink-0 flex-col rounded-lg border border-slate-800 bg-slate-900 text-slate-100 shadow-xl overflow-hidden transition-all duration-300 ease-in-out",
          isCollapsed ? "w-0 border-none opacity-0" : "w-64 opacity-100",
        )}
      >
        <div className="flex items-center justify-between border-b border-slate-800 bg-slate-950/40 px-4 py-3">
          <div className="flex items-center gap-2">
            <Layers className="size-4 text-emerald-400" />
            <span className="text-xs font-bold tracking-wider text-slate-200 uppercase">
              Escenarios
            </span>
          </div>
          <div className="flex items-center gap-1">
            <Button
              size="icon"
              variant="ghost"
              className="size-7 text-slate-400 hover:bg-slate-800 hover:text-white rounded-full transition-all"
              onClick={() => setCreating(true)}
              aria-label="Nuevo escenario"
            >
              <Plus className="size-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="size-7 text-slate-400 hover:bg-slate-800 hover:text-white rounded-full transition-all"
              onClick={toggleSidebar}
              aria-label="Colapsar sidebar"
            >
              <ChevronLeft className="size-4" />
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2 scrollbar-thin scrollbar-thumb-slate-800">
          {isLoading ? (
            <p className="p-3 text-sm text-slate-400">Cargando…</p>
          ) : scenarios.length === 0 ? (
            <p className="p-3 text-sm text-slate-400">Todavía no hay escenarios.</p>
          ) : (
            <ul className="flex flex-col gap-1">
              {scenarios.map((scenario) => {
                const IconComponent = STATUS_ICONS[scenario.status];
                const isCurrent = scenario.id === id;
                const isGloballyActive = scenario.status === "ACTIVE";

                // Resolve item class names
                let linkClassName = "";
                let iconClassName = "";

                if (isGloballyActive) {
                  if (isCurrent) {
                    // Selected and globally active
                    linkClassName =
                      "bg-gradient-to-r from-emerald-950/60 to-slate-800/80 text-white font-semibold border-l-4 border-emerald-500 rounded-l-none pl-2 shadow-[0_4px_12px_rgba(16,185,129,0.15),inset_0_1px_1px_rgba(255,255,255,0.05)] border-t border-r border-b border-emerald-500/20";
                    iconClassName = "text-emerald-400 drop-shadow-[0_0_6px_rgba(52,211,153,0.6)]";
                  } else {
                    // Active but not selected
                    linkClassName =
                      "bg-emerald-950/15 text-slate-200 border border-emerald-500/10 hover:bg-emerald-950/30 hover:text-white";
                    iconClassName = "text-emerald-500 group-hover:text-emerald-400";
                  }
                } else {
                  if (isCurrent) {
                    // Selected but not active
                    if (scenario.status === "ARCHIVED") {
                      linkClassName =
                        "bg-slate-800 text-white/80 font-medium border-l-4 border-slate-600 rounded-l-none pl-2 shadow-md border-t border-r border-b border-slate-700/30";
                      iconClassName = "text-slate-400";
                    } else {
                      linkClassName =
                        "bg-slate-800 text-white font-semibold border-l-4 border-slate-400 rounded-l-none pl-2 shadow-md border-t border-r border-b border-slate-700/30";
                      iconClassName = "text-slate-300 group-hover:text-white";
                    }
                  } else {
                    // Unselected inactive/archived
                    linkClassName =
                      "text-slate-400 hover:bg-slate-800/60 hover:text-slate-100 border border-transparent";
                    iconClassName = STATUS_ICON_COLORS[scenario.status];
                  }
                }

                return (
                  <li key={scenario.id}>
                    <Link
                      to={`/scenarios/${scenario.id}`}
                      className={cn(
                        "group flex items-center justify-between gap-2.5 rounded-lg px-3 py-2.5 text-sm transition-all duration-200",
                        linkClassName,
                      )}
                    >
                      <span className="flex min-w-0 items-center gap-2.5">
                        <IconComponent
                          className={cn(
                            "size-4 shrink-0 transition-transform group-hover:scale-105",
                            iconClassName,
                          )}
                        />
                        <span className="flex items-center gap-2 min-w-0">
                          <span
                            className={cn(
                              "truncate",
                              scenario.status === "ARCHIVED" && "line-through opacity-60",
                            )}
                          >
                            {scenario.name}
                          </span>
                          {isGloballyActive && (
                            <span className="shrink-0 text-[9px] font-bold tracking-widest text-emerald-400 bg-emerald-500/10 px-1 py-0.5 rounded border border-emerald-500/20 uppercase">
                              Activo
                            </span>
                          )}
                        </span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </aside>

      <div className="relative min-w-0 flex-1 overflow-y-auto rounded-lg border">
        {isCollapsed && (
          <Button
            size="icon"
            variant="outline"
            className="absolute left-3 top-3 z-40 size-8 rounded-md border bg-background hover:bg-accent text-muted-foreground shadow-sm transition-all"
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
