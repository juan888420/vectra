import type { IncomePublic } from "@vectra/types";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Button,
  EmptyState,
  Skeleton,
} from "@vectra/ui";
import { Banknote, Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { CardGrid } from "../../components/CardGrid.js";
import { ListPageHeader } from "../../components/ListPageHeader.js";
import { PageContainer } from "../../components/PageContainer.js";
import { Pagination } from "../../components/Pagination.js";
import { getErrorMessage } from "../../lib/error-messages.js";
import { ScenarioImpactDialog } from "../scenarios/ScenarioImpactDialog.js";
import { useScenarioImpact } from "../scenarios/use-scenario-impact.js";
import { IncomeCard } from "./IncomeCard.js";
import { IncomeFormDialog } from "./IncomeFormDialog.js";
import { syncIncomeScenariosRequest } from "./incomes.api.js";
import {
  useArchiveIncome,
  useDeleteIncome,
  useIncomes,
  useUnarchiveIncome,
} from "./use-incomes.js";

const PAGE_SIZE = 20;

type FormDialogState = { mode: "create" } | { mode: "edit"; income: IncomePublic } | null;

export function IncomesPage() {
  const [page, setPage] = useState(1);
  const [includeArchived, setIncludeArchived] = useState(false);
  const [formDialog, setFormDialog] = useState<FormDialogState>(null);
  const [pendingDelete, setPendingDelete] = useState<IncomePublic | null>(null);

  const { data, isLoading } = useIncomes({ page, pageSize: PAGE_SIZE, includeArchived });
  const archiveIncome = useArchiveIncome();
  const unarchiveIncome = useUnarchiveIncome();
  const deleteIncome = useDeleteIncome();
  const scenarioImpact = useScenarioImpact(syncIncomeScenariosRequest);

  async function handleToggleArchive(income: IncomePublic) {
    const wasArchived = income.archivedAt !== null;
    try {
      scenarioImpact.report(
        wasArchived
          ? await unarchiveIncome.mutateAsync(income.id)
          : await archiveIncome.mutateAsync(income.id),
      );
      toast.success(wasArchived ? "Ingreso restaurado." : "Ingreso archivado.");
    } catch (error) {
      toast.error(getErrorMessage(error, "income"));
    }
  }

  async function handleDelete() {
    if (!pendingDelete) return;
    try {
      await deleteIncome.mutateAsync(pendingDelete.id);
      toast.success("Ingreso eliminado.");
    } catch (error) {
      toast.error(getErrorMessage(error, "income"));
    }
  }

  const incomes = data?.data ?? [];

  return (
    <PageContainer>
      <ListPageHeader
        title="Ingresos"
        description="Sueldo, freelance, dividendos... y su cobertura frente a tus escenarios."
        action={
          <>
            {/* Same move as Categorías: in the header, not alone on its own
                right-aligned row. */}
            <Button
              variant={includeArchived ? "secondary" : "outline"}
              onClick={() => {
                setIncludeArchived((value) => !value);
                setPage(1);
              }}
            >
              {includeArchived ? "Ocultar archivados" : "Mostrar archivados"}
            </Button>
            <Button onClick={() => setFormDialog({ mode: "create" })}>
              <Plus /> Nuevo ingreso
            </Button>
          </>
        }
      />

      {isLoading ? (
        <CardGrid density="card">
          {Array.from({ length: 6 }, (_, index) => (
            <li key={index}>
              <Skeleton className="h-36 w-full rounded-xl" />
            </li>
          ))}
        </CardGrid>
      ) : incomes.length === 0 ? (
        <EmptyState
          icon={Banknote}
          title="Todavía no hay ingresos"
          description="Registra tu primer ingreso para calcular la cobertura de tus escenarios."
          action={
            <Button onClick={() => setFormDialog({ mode: "create" })}>
              <Plus /> Nuevo ingreso
            </Button>
          }
        />
      ) : (
        <CardGrid density="card">
          {incomes.map((income) => (
            <li key={income.id} className="flex">
              <IncomeCard
                income={income}
                onEdit={() => setFormDialog({ mode: "edit", income })}
                onToggleArchive={() => void handleToggleArchive(income)}
                onDelete={() => setPendingDelete(income)}
              />
            </li>
          ))}
        </CardGrid>
      )}

      <Pagination
        page={data?.meta.page ?? 1}
        totalPages={data?.meta.totalPages ?? 1}
        onPageChange={setPage}
      />

      <IncomeFormDialog
        open={formDialog !== null}
        onOpenChange={(open) => {
          if (!open) setFormDialog(null);
        }}
        income={formDialog?.mode === "edit" ? formDialog.income : undefined}
        onEdited={scenarioImpact.report}
      />

      <ScenarioImpactDialog {...scenarioImpact.dialogProps} />

      <AlertDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar &quot;{pendingDelete?.name}&quot;?</AlertDialogTitle>
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
