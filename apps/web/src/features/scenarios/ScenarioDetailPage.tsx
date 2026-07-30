import type { ScenarioStatus } from "@vectra/types";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Badge,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Skeleton,
} from "@vectra/ui";
import {
  Archive,
  ArchiveRestore,
  MoreHorizontal,
  Pencil,
  Play,
  Square,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router";
import { toast } from "sonner";

import { ApiError } from "../../lib/api-client.js";
import { useAuth } from "../auth/useAuth.js";
import { ScenarioCompositionsSection } from "./ScenarioCompositionsSection.js";
import { ScenarioFormDialog } from "./ScenarioFormDialog.js";
import { ScenarioIncomesSection } from "./ScenarioIncomesSection.js";
import { ScenarioItemsSection } from "./ScenarioItemsSection.js";
import { ScenarioSummaryCards } from "./ScenarioSummaryCards.js";
import {
  useActivateScenario,
  useArchiveScenario,
  useDeactivateScenario,
  useDeleteScenario,
  useScenario,
  useScenarioSummary,
  useUnarchiveScenario,
} from "./use-scenarios.js";

const STATUS_LABELS: Record<ScenarioStatus, string> = {
  ACTIVE: "Activo",
  INACTIVE: "Inactivo",
  ARCHIVED: "Archivado",
};

export function ScenarioDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [renaming, setRenaming] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const { data: scenario, isLoading, error } = useScenario(id ?? "");
  const { data: summary, isLoading: isLoadingSummary } = useScenarioSummary(id ?? "");
  const activateScenario = useActivateScenario();
  const deactivateScenario = useDeactivateScenario();
  const archiveScenario = useArchiveScenario();
  const unarchiveScenario = useUnarchiveScenario();
  const deleteScenario = useDeleteScenario();

  if (!id) {
    return <Navigate to="/scenarios" replace />;
  }

  if (error) {
    return <Navigate to="/scenarios" replace />;
  }

  async function handleToggleActive() {
    if (!scenario) return;
    try {
      if (scenario.status === "ACTIVE") {
        await deactivateScenario.mutateAsync(scenario.id);
      } else {
        await activateScenario.mutateAsync(scenario.id);
      }
    } catch (thrown) {
      toast.error(thrown instanceof ApiError ? thrown.message : "Algo salió mal.");
    }
  }

  async function handleToggleArchive() {
    if (!scenario) return;
    try {
      if (scenario.status === "ARCHIVED") {
        await unarchiveScenario.mutateAsync(scenario.id);
      } else {
        await archiveScenario.mutateAsync(scenario.id);
      }
    } catch (thrown) {
      toast.error(thrown instanceof ApiError ? thrown.message : "Algo salió mal.");
    }
  }

  async function handleDelete() {
    if (!scenario) return;
    try {
      await deleteScenario.mutateAsync(scenario.id);
      navigate("/scenarios");
    } catch (thrown) {
      toast.error(thrown instanceof ApiError ? thrown.message : "Algo salió mal.");
      setConfirmingDelete(false);
    }
  }

  if (isLoading || !scenario) {
    return (
      <div className="mx-auto max-w-4xl p-6">
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 p-6">
      <div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold tracking-tight">{scenario.name}</h1>
            <Badge variant={scenario.status === "ACTIVE" ? "default" : "outline"}>
              {STATUS_LABELS[scenario.status]}
            </Badge>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Acciones del escenario">
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => setRenaming(true)}>
                <Pencil /> Renombrar
              </DropdownMenuItem>
              {scenario.status !== "ARCHIVED" ? (
                <DropdownMenuItem onSelect={() => void handleToggleActive()}>
                  {scenario.status === "ACTIVE" ? <Square /> : <Play />}
                  {scenario.status === "ACTIVE" ? "Desactivar" : "Activar"}
                </DropdownMenuItem>
              ) : null}
              <DropdownMenuItem onSelect={() => void handleToggleArchive()}>
                {scenario.status === "ARCHIVED" ? <ArchiveRestore /> : <Archive />}
                {scenario.status === "ARCHIVED" ? "Desarchivar" : "Archivar"}
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onSelect={() => setConfirmingDelete(true)}
              >
                <Trash2 /> Eliminar
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <ScenarioSummaryCards
        summary={summary}
        isLoading={isLoadingSummary}
        currency={user?.defaultCurrency ?? "USD"}
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ScenarioItemsSection scenario={scenario} />
        <ScenarioIncomesSection scenario={scenario} />
      </div>

      <ScenarioCompositionsSection scenario={scenario} />

      <ScenarioFormDialog open={renaming} onOpenChange={setRenaming} scenario={scenario} />

      <AlertDialog open={confirmingDelete} onOpenChange={setConfirmingDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar &quot;{scenario.name}&quot;?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Los escenarios incluidos en otro escenario no se
              pueden eliminar, archívalos en su lugar.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => void handleDelete()}>Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
