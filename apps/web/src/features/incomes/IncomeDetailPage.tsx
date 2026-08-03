import type { IncomeFrequency } from "@vectra/types";
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
import { formatMoney } from "@vectra/utils";
import { Archive, ArchiveRestore, ChevronLeft, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router";
import { toast } from "sonner";

import { ProjectionStatCards } from "../../components/ProjectionStatCards.js";
import { ApiError } from "../../lib/api-client.js";
import { ScenarioImpactDialog } from "../scenarios/ScenarioImpactDialog.js";
import { useScenarioImpact } from "../scenarios/use-scenario-impact.js";
import { IncomeFormDialog } from "./IncomeFormDialog.js";
import { syncIncomeScenariosRequest } from "./incomes.api.js";
import {
  useArchiveIncome,
  useDeleteIncome,
  useIncomeSummary,
  useUnarchiveIncome,
} from "./use-incomes.js";

const FREQUENCY_LABELS: Record<IncomeFrequency, string> = {
  WEEKLY: "Semanal",
  MONTHLY: "Mensual",
  YEARLY: "Anual",
  ONE_TIME: "Esporádico",
};

export function IncomeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const { data: summary, isLoading, error } = useIncomeSummary(id ?? "");
  const archiveIncome = useArchiveIncome();
  const unarchiveIncome = useUnarchiveIncome();
  const deleteIncome = useDeleteIncome();
  const scenarioImpact = useScenarioImpact(syncIncomeScenariosRequest);

  if (!id || error) {
    return <Navigate to="/incomes" replace />;
  }

  async function handleToggleArchive() {
    if (!summary) return;
    try {
      scenarioImpact.report(
        summary.income.archivedAt
          ? await unarchiveIncome.mutateAsync(summary.income.id)
          : await archiveIncome.mutateAsync(summary.income.id),
      );
    } catch (thrown) {
      toast.error(thrown instanceof ApiError ? thrown.message : "Algo salió mal.");
    }
  }

  async function handleDelete() {
    if (!summary) return;
    try {
      await deleteIncome.mutateAsync(summary.income.id);
      navigate("/incomes");
    } catch (thrown) {
      toast.error(thrown instanceof ApiError ? thrown.message : "Algo salió mal.");
      setConfirmingDelete(false);
    }
  }

  if (isLoading || !summary) {
    return (
      <div className="mx-auto max-w-4xl">
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  const { income, totals } = summary;

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <div>
        <Link
          to="/incomes"
          className="mb-2 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="size-4" /> Ingresos
        </Link>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold tracking-tight">{income.name}</h1>
            <Badge variant="outline">{FREQUENCY_LABELS[income.frequency]}</Badge>
            {income.archivedAt ? <Badge variant="secondary">Archivado</Badge> : null}
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Acciones del ingreso">
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => setEditing(true)}>
                <Pencil /> Editar
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => void handleToggleArchive()}>
                {income.archivedAt ? <ArchiveRestore /> : <Archive />}
                {income.archivedAt ? "Desarchivar" : "Archivar"}
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

      {totals ? (
        <ProjectionStatCards
          monthly={totals.monthly}
          sixMonths={totals.sixMonths}
          twelveMonths={totals.twelveMonths}
          currency={income.currency}
          isLoading={false}
        />
      ) : (
        <p className="text-sm text-muted-foreground">
          Es un ingreso esporádico ({formatMoney(income.amount, income.currency)}), no participa en
          proyecciones recurrentes.
        </p>
      )}

      <IncomeFormDialog
        open={editing}
        onOpenChange={setEditing}
        income={income}
        onEdited={scenarioImpact.report}
      />

      <ScenarioImpactDialog {...scenarioImpact.dialogProps} />

      <AlertDialog open={confirmingDelete} onOpenChange={setConfirmingDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar &quot;{income.name}&quot;?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Los ingresos vinculados a algún escenario no se
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
