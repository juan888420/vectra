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
  DropdownMenuItem,
  Skeleton,
} from "@vectra/ui";
import { formatMoney } from "@vectra/utils";
import { Archive, ArchiveRestore, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router";
import { toast } from "sonner";

import { DetailPageHeader } from "../../components/DetailPageHeader.js";
import { PageContainer } from "../../components/PageContainer.js";
import { ProjectionStatCards } from "../../components/ProjectionStatCards.js";
import { ScenarioUsageList } from "../../components/ScenarioUsageList.js";
import { getErrorMessage } from "../../lib/error-messages.js";
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
    const wasArchived = summary.income.archivedAt !== null;
    try {
      scenarioImpact.report(
        wasArchived
          ? await unarchiveIncome.mutateAsync(summary.income.id)
          : await archiveIncome.mutateAsync(summary.income.id),
      );
      toast.success(wasArchived ? "Ingreso restaurado." : "Ingreso archivado.");
    } catch (thrown) {
      toast.error(getErrorMessage(thrown, "income"));
    }
  }

  async function handleDelete() {
    if (!summary) return;
    try {
      await deleteIncome.mutateAsync(summary.income.id);
      toast.success("Ingreso eliminado.");
      navigate("/incomes");
    } catch (thrown) {
      toast.error(getErrorMessage(thrown, "income"));
      setConfirmingDelete(false);
    }
  }

  if (isLoading || !summary) {
    return (
      <PageContainer className="flex flex-col gap-6 lg:gap-8">
        <Skeleton className="h-8 w-56" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-24 w-full rounded-xl" />
        </div>
        <Skeleton className="h-40 w-full rounded-xl" />
      </PageContainer>
    );
  }

  const { income, totals, scenarios } = summary;

  return (
    <PageContainer className="flex flex-col gap-6 lg:gap-8">
      <DetailPageHeader
        backTo="/incomes"
        backLabel="Ingresos"
        title={income.name}
        actionsLabel="Acciones del ingreso"
        badges={
          <>
            <Badge variant="outline">{FREQUENCY_LABELS[income.frequency]}</Badge>
            {income.archivedAt ? <Badge variant="secondary">Archivado</Badge> : null}
          </>
        }
        actions={
          <>
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
          </>
        }
      />

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

      <ScenarioUsageList scenarios={scenarios} />

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
            <AlertDialogAction variant="destructive" onClick={() => void handleDelete()}>
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageContainer>
  );
}
