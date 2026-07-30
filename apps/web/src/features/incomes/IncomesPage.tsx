import type { IncomeFrequency, IncomePublic } from "@vectra/types";
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
  DataTable,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  EmptyState,
} from "@vectra/ui";
import { formatMoney } from "@vectra/utils";
import {
  Archive,
  ArchiveRestore,
  Banknote,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import { toast } from "sonner";

import { ApiError } from "../../lib/api-client.js";
import { IncomeFormDialog } from "./IncomeFormDialog.js";
import {
  useArchiveIncome,
  useDeleteIncome,
  useIncomes,
  useUnarchiveIncome,
} from "./use-incomes.js";

const FREQUENCY_LABELS: Record<IncomeFrequency, string> = {
  WEEKLY: "Semanal",
  MONTHLY: "Mensual",
  YEARLY: "Anual",
  ONE_TIME: "Esporádico",
};

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

  async function handleToggleArchive(income: IncomePublic) {
    try {
      if (income.archivedAt) {
        await unarchiveIncome.mutateAsync(income.id);
      } else {
        await archiveIncome.mutateAsync(income.id);
      }
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

      <DataTable
        columns={[
          {
            id: "name",
            header: "Nombre",
            cell: (income) => (
              <Link to={`/incomes/${income.id}`} className="font-medium hover:underline">
                {income.name}
              </Link>
            ),
          },
          {
            id: "frequency",
            header: "Frecuencia",
            cell: (income) => <Badge variant="outline">{FREQUENCY_LABELS[income.frequency]}</Badge>,
          },
          {
            id: "amount",
            header: "Monto",
            className: "text-right",
            cell: (income) => (
              <span className="font-medium text-emerald-600 dark:text-emerald-400">
                {formatMoney(income.amount, income.currency)}
              </span>
            ),
          },
          {
            id: "status",
            header: "Estado",
            cell: (income) =>
              income.archivedAt ? <Badge variant="secondary">Archivado</Badge> : null,
          },
          {
            id: "actions",
            header: "",
            className: "text-right",
            cell: (income) => (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" aria-label={`Acciones para ${income.name}`}>
                    <MoreHorizontal />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onSelect={() => setFormDialog({ mode: "edit", income })}>
                    <Pencil /> Editar
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => void handleToggleArchive(income)}>
                    {income.archivedAt ? <ArchiveRestore /> : <Archive />}
                    {income.archivedAt ? "Desarchivar" : "Archivar"}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onSelect={() => setPendingDelete(income)}
                  >
                    <Trash2 /> Eliminar
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ),
          },
        ]}
        data={incomes}
        rowKey={(income) => income.id}
        isLoading={isLoading}
        emptyState={
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
        }
      />

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
      />

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
