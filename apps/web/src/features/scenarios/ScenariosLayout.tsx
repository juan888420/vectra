import type { ScenarioListItem } from "@vectra/types";
import {
  Badge,
  Button,
  cn,
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  Skeleton,
} from "@vectra/ui";
import {
  Archive,
  ChevronLeft,
  ChevronRight,
  Layers,
  PanelLeft,
  Plus,
  Sparkles,
} from "lucide-react";
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
  /** Lets the mobile drawer close itself the moment a scenario is picked;
   * the desktop column passes nothing and stays put. */
  onNavigate?: () => void;
}

function ScenarioSidebarRow({
  scenario,
  isCurrent,
  muted = false,
  onNavigate,
}: ScenarioSidebarRowProps) {
  const IconComponent = STATUS_ICONS[scenario.status];
  const isGloballyActive = scenario.status === "ACTIVE";

  return (
    <li>
      <Link
        to={`/scenarios/${scenario.id}`}
        onClick={onNavigate}
        className={cn(
          "flex items-center justify-between gap-2 rounded-md px-3 py-2 text-sm transition-colors focus-ring",
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

interface ScenarioListProps {
  isLoading: boolean;
  current: ScenarioListItem[];
  archived: ScenarioListItem[];
  currentId: string | undefined;
  onNavigate?: () => void;
}

/** The list itself, rendered identically by the desktop column and the mobile
 * drawer — one implementation, so the two can't drift apart. */
function ScenarioList({ isLoading, current, archived, currentId, onNavigate }: ScenarioListProps) {
  if (isLoading) {
    // Skeleton rows rather than a "Cargando…" line: the sidebar is the only
    // place that used a text loader, which read as an error next to the
    // skeletons every other surface shows.
    return (
      <div className="flex flex-col gap-1 p-2" aria-busy="true">
        <Skeleton className="h-9 w-full rounded-md" />
        <Skeleton className="h-9 w-full rounded-md" />
        <Skeleton className="h-9 w-full rounded-md" />
      </div>
    );
  }

  if (current.length === 0 && archived.length === 0) {
    return <p className="p-3 text-sm text-muted-foreground">Todavía no hay escenarios.</p>;
  }

  return (
    <div className="p-2">
      {current.length > 0 ? (
        <ul className="flex flex-col gap-1">
          {current.map((scenario) => (
            <ScenarioSidebarRow
              key={scenario.id}
              scenario={scenario}
              isCurrent={scenario.id === currentId}
              onNavigate={onNavigate}
            />
          ))}
        </ul>
      ) : (
        <p className="p-3 text-sm text-muted-foreground">Sin escenarios activos.</p>
      )}

      {archived.length > 0 ? (
        <>
          <div className="px-3 pb-1 pt-3 text-[11px] font-semibold tracking-wide text-muted-foreground/60 uppercase">
            Archivados
          </div>
          <ul className="flex flex-col gap-1">
            {archived.map((scenario) => (
              <ScenarioSidebarRow
                key={scenario.id}
                scenario={scenario}
                isCurrent={scenario.id === currentId}
                muted
                onNavigate={onNavigate}
              />
            ))}
          </ul>
        </>
      ) : null}
    </div>
  );
}

// The main screen of the product (ADR-0006): a persistent list + detail
// split, not a CRUD list you navigate away from — closer to Linear/Notion
// than to Categories/Products/Incomes' simple list→detail navigation. Uses
// the same design tokens as the rest of the app (bg-card/border/accent, the
// one indigo --primary), not a bespoke dark palette — a nested panel should
// still read as Vectra, not as a different product bolted on.
//
// Below `md` that split stops working: a fixed 16rem column against a 320px
// viewport leaves nothing for the detail panel it exists to navigate. So the
// list moves into a drawer (Sheet) and the detail takes the full width, with
// a toolbar carrying the affordance to open it (RFC-0028).
export function ScenariosLayout() {
  const { id } = useParams<{ id: string }>();
  const [creating, setCreating] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
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
    <div className="flex min-h-0 flex-1 gap-4">
      {/* Desktop column. Hidden outright below md — the drawer below covers
          that range, and rendering both would duplicate the list in the a11y
          tree. */}
      <aside
        className={cn(
          "hidden shrink-0 flex-col overflow-hidden rounded-lg border bg-card shadow-sm transition-all duration-300 ease-in-out md:flex",
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
              aria-label="Colapsar lista de escenarios"
            >
              <ChevronLeft className="size-4" />
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          <ScenarioList
            isLoading={isLoading}
            current={currentScenarios}
            archived={archivedScenarios}
            currentId={id}
          />
        </div>
      </aside>

      <div className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-lg border shadow-sm">
        {/* Mobile toolbar: without it the list would be unreachable below md,
            since the column above is hidden there. */}
        <div className="flex shrink-0 items-center gap-2 border-b px-3 py-2 md:hidden">
          <Button variant="outline" size="sm" onClick={() => setDrawerOpen(true)}>
            <PanelLeft /> Escenarios
          </Button>
          <Button size="sm" className="ml-auto" onClick={() => setCreating(true)}>
            <Plus /> Nuevo
          </Button>
        </div>

        {isCollapsed ? (
          <Button
            size="icon"
            variant="outline"
            className="absolute left-3 top-3 z-40 hidden md:inline-flex"
            onClick={toggleSidebar}
            aria-label="Expandir lista de escenarios"
          >
            <ChevronRight className="size-4" />
          </Button>
        ) : null}

        <div className="min-h-0 flex-1 overflow-y-auto">
          <Outlet
            context={{ openCreateDialog: () => setCreating(true) } satisfies ScenariosOutletContext}
          />
        </div>
      </div>

      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent className="md:hidden">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Layers className="size-4 text-primary" />
              Escenarios
            </SheetTitle>
          </SheetHeader>
          <div className="min-h-0 flex-1 overflow-y-auto">
            <ScenarioList
              isLoading={isLoading}
              current={currentScenarios}
              archived={archivedScenarios}
              currentId={id}
              onNavigate={() => setDrawerOpen(false)}
            />
          </div>
          <div className="shrink-0 border-t p-3">
            <Button
              className="w-full"
              onClick={() => {
                setDrawerOpen(false);
                setCreating(true);
              }}
            >
              <Plus /> Nuevo escenario
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      <ScenarioFormDialog open={creating} onOpenChange={setCreating} />
    </div>
  );
}
