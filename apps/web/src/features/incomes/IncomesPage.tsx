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

import { ApiError } from "../../lib/api-client.js";
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
    try {
      scenarioImpact.report(
        income.archivedAt
          ? await unarchiveIncome.mutateAsync(income.id)
          : await archiveIncome.mutateAsync(income.id),
      );
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Algo salió mal.");
    }
  }

  async function handleDelete() {
    if (!pendingDelete) return;
    try {
      await deleteIncome.mutateAsync(pendingDelete.id);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Algo salió mal.");
    }
  }

  const incomes = data?.data ?? [];

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Ingresos</h1>
          <p className="text-sm text-muted-foreground">
            Sueldo, freelance, dividendos... y su cobertura frente a tus escenarios.
          </p>
        </div>
        <Button onClick={() => setFormDialog({ mode: "create" })}>
          <Plus /> Nuevo ingreso
        </Button>
      </div>

      <div className="mb-4 flex justify-end">
        <Button
          variant={includeArchived ? "secondary" : "outline"}
          size="sm"
          onClick={() => {
            setIncludeArchived((value) => !value);
            setPage(1);
          }}
        >
          {includeArchived ? "Ocultar archivados" : "Mostrar archivados"}
        </Button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(9rem,1fr))] gap-3">
          <Skeleton className="h-32 w-full rounded-xl" />
          <Skeleton className="h-32 w-full rounded-xl" />
          <Skeleton className="h-32 w-full rounded-xl" />
        </div>
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
        <ul className="grid grid-cols-[repeat(auto-fill,minmax(9rem,1fr))] gap-3">
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
        </ul>
      )}

      {data && data.meta.totalPages > 1 ? (
        <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Página {data.meta.page} de {data.meta.totalPages}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((value) => value - 1)}
            >
              Anterior
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= data.meta.totalPages}
              onClick={() => setPage((value) => value + 1)}
            >
              Siguiente
            </Button>
          </div>
        </div>
      ) : null}

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
            <AlertDialogAction onClick={() => void handleDelete()}>Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
