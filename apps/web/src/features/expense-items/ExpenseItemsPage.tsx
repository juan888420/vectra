import type { ExpenseItemFrequency, ExpenseItemPublic } from "@vectra/types";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@vectra/ui";
import { formatMoney } from "@vectra/utils";
import {
  Archive,
  ArchiveRestore,
  MoreHorizontal,
  Pencil,
  Plus,
  ShoppingBag,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import { toast } from "sonner";

import { ApiError } from "../../lib/api-client.js";
import { useCategories } from "../categories/use-categories.js";
import { ScenarioImpactDialog } from "../scenarios/ScenarioImpactDialog.js";
import { useScenarioImpact } from "../scenarios/use-scenario-impact.js";
import { syncExpenseItemScenariosRequest } from "./expense-items.api.js";
import { ExpenseItemFormDialog } from "./ExpenseItemFormDialog.js";
import {
  useArchiveExpenseItem,
  useDeleteExpenseItem,
  useExpenseItems,
  useUnarchiveExpenseItem,
} from "./use-expense-items.js";

const FREQUENCY_LABELS: Record<ExpenseItemFrequency, string> = {
  MONTHLY: "Mensual",
  YEARLY: "Anual",
  ONE_TIME: "Esporádico",
};

const PAGE_SIZE = 20;
const ALL = "ALL";

type FormDialogState = { mode: "create" } | { mode: "edit"; item: ExpenseItemPublic } | null;

export function ExpenseItemsPage() {
  const [page, setPage] = useState(1);
  const [categoryFilter, setCategoryFilter] = useState<string>(ALL);
  const [includeArchived, setIncludeArchived] = useState(false);
  const [formDialog, setFormDialog] = useState<FormDialogState>(null);
  const [pendingDelete, setPendingDelete] = useState<ExpenseItemPublic | null>(null);

  const { data, isLoading } = useExpenseItems({
    page,
    pageSize: PAGE_SIZE,
    categoryId: categoryFilter === ALL ? undefined : categoryFilter,
    includeArchived,
  });

  const { data: categoriesData } = useCategories({
    type: "EXPENSE",
    includeArchived: true,
    pageSize: 100,
    sortBy: "name",
  });
  const categoriesById = new Map(
    (categoriesData?.data ?? []).map((category) => [category.id, category]),
  );

  const archiveExpenseItem = useArchiveExpenseItem();
  const unarchiveExpenseItem = useUnarchiveExpenseItem();
  const deleteExpenseItem = useDeleteExpenseItem();
  const scenarioImpact = useScenarioImpact(syncExpenseItemScenariosRequest);

  async function handleToggleArchive(item: ExpenseItemPublic) {
    try {
      scenarioImpact.report(
        item.archivedAt
          ? await unarchiveExpenseItem.mutateAsync(item.id)
          : await archiveExpenseItem.mutateAsync(item.id),
      );
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Algo salió mal.");
    }
  }

  async function handleDelete() {
    if (!pendingDelete) return;
    try {
      await deleteExpenseItem.mutateAsync(pendingDelete.id);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Algo salió mal.");
    }
  }

  const items = data?.data ?? [];
  const hasActiveFilters = categoryFilter !== ALL;

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Productos</h1>
          <p className="text-sm text-muted-foreground">
            Gastos reutilizables que puedes combinar en cualquier escenario.
          </p>
        </div>
        <Button onClick={() => setFormDialog({ mode: "create" })}>
          <Plus /> Nuevo producto
        </Button>
      </div>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <Select
          value={categoryFilter}
          onValueChange={(value) => {
            setCategoryFilter(value);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todas las categorías</SelectItem>
            {(categoriesData?.data ?? []).map((category) => (
              <SelectItem key={category.id} value={category.id}>
                {category.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

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
            cell: (item) => (
              <Link to={`/expense-items/${item.id}`} className="font-medium hover:underline">
                {item.name}
              </Link>
            ),
          },
          {
            id: "category",
            header: "Categoría",
            cell: (item) => categoriesById.get(item.categoryId)?.name ?? "—",
          },
          {
            id: "frequency",
            header: "Frecuencia",
            cell: (item) => <Badge variant="outline">{FREQUENCY_LABELS[item.frequency]}</Badge>,
          },
          {
            id: "amount",
            header: "Precio",
            className: "text-right",
            cell: (item) => (
              <span className="font-medium">{formatMoney(item.amount, item.currency)}</span>
            ),
          },
          {
            id: "status",
            header: "Estado",
            cell: (item) => (item.archivedAt ? <Badge variant="secondary">Archivado</Badge> : null),
          },
          {
            id: "actions",
            header: "",
            className: "text-right",
            cell: (item) => (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" aria-label={`Acciones para ${item.name}`}>
                    <MoreHorizontal />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onSelect={() => setFormDialog({ mode: "edit", item })}>
                    <Pencil /> Editar
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => void handleToggleArchive(item)}>
                    {item.archivedAt ? <ArchiveRestore /> : <Archive />}
                    {item.archivedAt ? "Desarchivar" : "Archivar"}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onSelect={() => setPendingDelete(item)}
                  >
                    <Trash2 /> Eliminar
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ),
          },
        ]}
        data={items}
        rowKey={(item) => item.id}
        isLoading={isLoading}
        emptyState={
          <EmptyState
            icon={ShoppingBag}
            title={
              hasActiveFilters
                ? "Ningún producto coincide con este filtro"
                : "Todavía no hay productos"
            }
            description={
              hasActiveFilters
                ? "Prueba otra categoría o quita el filtro para ver todos."
                : "Crea tu primer producto para empezar a armar escenarios."
            }
            action={
              hasActiveFilters ? undefined : (
                <Button onClick={() => setFormDialog({ mode: "create" })}>
                  <Plus /> Nuevo producto
                </Button>
              )
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

      <ExpenseItemFormDialog
        open={formDialog !== null}
        onOpenChange={(open) => {
          if (!open) setFormDialog(null);
        }}
        expenseItem={formDialog?.mode === "edit" ? formDialog.item : undefined}
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
              Esta acción no se puede deshacer. Los productos incluidos en algún escenario no se
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
