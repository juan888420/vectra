import type { ExpenseItemPublic } from "@vectra/types";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
} from "@vectra/ui";
import { Plus, ShoppingBag } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { CardGrid } from "../../components/CardGrid.js";
import { ListPageHeader } from "../../components/ListPageHeader.js";
import { PageContainer } from "../../components/PageContainer.js";
import { Pagination } from "../../components/Pagination.js";
import { getErrorMessage } from "../../lib/error-messages.js";
import { useCategories } from "../categories/use-categories.js";
import { ScenarioImpactDialog } from "../scenarios/ScenarioImpactDialog.js";
import { useScenarioImpact } from "../scenarios/use-scenario-impact.js";
import { ExpenseItemCard } from "./ExpenseItemCard.js";
import { syncExpenseItemScenariosRequest } from "./expense-items.api.js";
import { ExpenseItemFormDialog } from "./ExpenseItemFormDialog.js";
import {
  useArchiveExpenseItem,
  useDeleteExpenseItem,
  useExpenseItems,
  useUnarchiveExpenseItem,
} from "./use-expense-items.js";

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
    const wasArchived = item.archivedAt !== null;
    try {
      scenarioImpact.report(
        wasArchived
          ? await unarchiveExpenseItem.mutateAsync(item.id)
          : await archiveExpenseItem.mutateAsync(item.id),
      );
      toast.success(wasArchived ? "Producto restaurado." : "Producto archivado.");
    } catch (error) {
      toast.error(getErrorMessage(error, "expenseItem"));
    }
  }

  async function handleDelete() {
    if (!pendingDelete) return;
    try {
      await deleteExpenseItem.mutateAsync(pendingDelete.id);
      toast.success("Producto eliminado.");
    } catch (error) {
      toast.error(getErrorMessage(error, "expenseItem"));
    }
  }

  const items = data?.data ?? [];
  const hasActiveFilters = categoryFilter !== ALL;

  return (
    <PageContainer>
      <ListPageHeader
        title="Productos"
        description="Gastos reutilizables que puedes combinar en cualquier escenario."
        action={
          <Button onClick={() => setFormDialog({ mode: "create" })}>
            <Plus /> Nuevo producto
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 lg:mb-6">
        <Select
          value={categoryFilter}
          onValueChange={(value) => {
            setCategoryFilter(value);
            setPage(1);
          }}
        >
          {/* Grows to fill the row on a phone instead of sitting at a fixed
              12rem next to a wrapped button. */}
          <SelectTrigger className="w-full sm:w-48">
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

      {isLoading ? (
        <CardGrid density="tile">
          {Array.from({ length: 8 }, (_, index) => (
            <li key={index}>
              <Skeleton className="h-28 w-full rounded-xl" />
            </li>
          ))}
        </CardGrid>
      ) : items.length === 0 ? (
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
      ) : (
        <CardGrid density="tile">
          {items.map((item) => (
            <li key={item.id} className="flex">
              <ExpenseItemCard
                item={item}
                categoryName={categoriesById.get(item.categoryId)?.name ?? "—"}
                onEdit={() => setFormDialog({ mode: "edit", item })}
                onToggleArchive={() => void handleToggleArchive(item)}
                onDelete={() => setPendingDelete(item)}
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
            <AlertDialogAction variant="destructive" onClick={() => void handleDelete()}>
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageContainer>
  );
}
