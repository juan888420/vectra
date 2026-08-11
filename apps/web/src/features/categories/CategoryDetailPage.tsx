import type { CategoryType } from "@vectra/types";
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
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  DropdownMenuItem,
  EmptyState,
  Skeleton,
} from "@vectra/ui";
import { formatMoney } from "@vectra/utils";
import { Archive, ArchiveRestore, Pencil, Plus, ShoppingBag, Trash2 } from "lucide-react";
import { useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router";
import { toast } from "sonner";

import { CardGrid } from "../../components/CardGrid.js";
import { DetailPageHeader } from "../../components/DetailPageHeader.js";
import { PageContainer } from "../../components/PageContainer.js";
import { ProjectionStatCards } from "../../components/ProjectionStatCards.js";
import { ApiError } from "../../lib/api-client.js";
import { useAuth } from "../auth/useAuth.js";
import { ExpenseItemCard } from "../expense-items/ExpenseItemCard.js";
import { ExpenseItemFormDialog } from "../expense-items/ExpenseItemFormDialog.js";
import { CategoryFormDialog } from "./CategoryFormDialog.js";
import { MoveItemsAndDeleteCategoryDialog } from "./MoveItemsAndDeleteCategoryDialog.js";
import {
  useArchiveCategory,
  useCategorySummary,
  useDeleteCategory,
  useUnarchiveCategory,
} from "./use-categories.js";

const CATEGORY_TYPE_LABELS: Record<CategoryType, string> = {
  EXPENSE: "Gasto",
  INCOME: "Ingreso",
};

export function CategoryDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [renaming, setRenaming] = useState(false);
  const [creatingItem, setCreatingItem] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const { data: summary, isLoading, error } = useCategorySummary(id ?? "");
  const { user } = useAuth();
  const archiveCategory = useArchiveCategory();
  const unarchiveCategory = useUnarchiveCategory();
  const deleteCategory = useDeleteCategory();

  if (!id || error) {
    return <Navigate to="/categories" replace />;
  }

  async function handleToggleArchive() {
    if (!summary) return;
    try {
      if (summary.category.archivedAt) {
        await unarchiveCategory.mutateAsync(summary.category.id);
      } else {
        await archiveCategory.mutateAsync(summary.category.id);
      }
    } catch (thrown) {
      toast.error(thrown instanceof ApiError ? thrown.message : "Algo salió mal.");
    }
  }

  async function handleDelete() {
    if (!summary) return;
    try {
      await deleteCategory.mutateAsync(summary.category.id);
      navigate("/categories");
    } catch (thrown) {
      toast.error(thrown instanceof ApiError ? thrown.message : "Algo salió mal.");
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

  const { category, items } = summary;

  return (
    <PageContainer className="flex flex-col gap-6 lg:gap-8">
      <DetailPageHeader
        backTo="/categories"
        backLabel="Categorías"
        title={category.name}
        actionsLabel="Acciones de la categoría"
        badges={
          <>
            <Badge variant="outline">{CATEGORY_TYPE_LABELS[category.type]}</Badge>
            {category.archivedAt ? <Badge variant="secondary">Archivada</Badge> : null}
          </>
        }
        // System categories expose no menu at all — same rule as before.
        actions={
          category.isSystem ? undefined : (
            <>
              <DropdownMenuItem onSelect={() => setRenaming(true)}>
                <Pencil /> Renombrar
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => void handleToggleArchive()}>
                {category.archivedAt ? <ArchiveRestore /> : <Archive />}
                {category.archivedAt ? "Desarchivar" : "Archivar"}
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onSelect={() => setConfirmingDelete(true)}
              >
                <Trash2 /> Eliminar
              </DropdownMenuItem>
            </>
          )
        }
      />

      <ProjectionStatCards
        monthly={summary.totals.monthly}
        sixMonths={summary.totals.sixMonths}
        twelveMonths={summary.totals.twelveMonths}
        currency={user?.defaultCurrency ?? "USD"}
        isLoading={false}
      />

      {summary.oneTimeTotal > 0 ? (
        <p className="text-sm text-muted-foreground">
          + {formatMoney(summary.oneTimeTotal, user?.defaultCurrency ?? "USD")} en gastos
          esporádicos (no incluidos en las proyecciones)
        </p>
      ) : null}

      <Card>
        <CardHeader className="flex-row flex-wrap items-center justify-between gap-2 space-y-0">
          <CardTitle>Productos</CardTitle>
          {category.type === "EXPENSE" && !category.archivedAt ? (
            <Button size="sm" onClick={() => setCreatingItem(true)}>
              <Plus /> Nuevo producto
            </Button>
          ) : null}
        </CardHeader>
        <CardContent>
          {items.length === 0 ? (
            <EmptyState
              icon={ShoppingBag}
              title="Sin productos"
              description="Todavía no hay productos en esta categoría."
            />
          ) : (
            // Same ExpenseItemCard as the Productos list, read-only
            // (canEdit={false}) — a product never gets a second look
            // depending on where you're viewing it from.
            <CardGrid density="tile">
              {items.map((item) => (
                <li key={item.id} className="flex">
                  <ExpenseItemCard item={item} categoryName={category.name} canEdit={false} />
                </li>
              ))}
            </CardGrid>
          )}
        </CardContent>
      </Card>

      <CategoryFormDialog open={renaming} onOpenChange={setRenaming} category={category} />

      <ExpenseItemFormDialog
        open={creatingItem}
        onOpenChange={setCreatingItem}
        defaultCategoryId={category.id}
      />

      {items.length > 0 ? (
        <MoveItemsAndDeleteCategoryDialog
          open={confirmingDelete}
          onOpenChange={setConfirmingDelete}
          category={category}
          itemCount={items.length}
          onDeleted={() => navigate("/categories")}
        />
      ) : (
        <AlertDialog open={confirmingDelete} onOpenChange={setConfirmingDelete}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Eliminar &quot;{category.name}&quot;?</AlertDialogTitle>
              <AlertDialogDescription>
                Esta categoría no tiene productos, así que se eliminará por completo. Esta acción no
                se puede deshacer: si prefieres conservarla fuera de tu vista, archívala.
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
      )}
    </PageContainer>
  );
}
