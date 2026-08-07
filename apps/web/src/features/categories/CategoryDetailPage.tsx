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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  EmptyState,
  Skeleton,
} from "@vectra/ui";
import { formatMoney } from "@vectra/utils";
import {
  Archive,
  ArchiveRestore,
  ChevronLeft,
  MoreHorizontal,
  Pencil,
  Plus,
  ShoppingBag,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router";
import { toast } from "sonner";

import { ProjectionStatCards } from "../../components/ProjectionStatCards.js";
import { ApiError } from "../../lib/api-client.js";
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
      <div className="mx-auto max-w-4xl">
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  const { category, items } = summary;

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <div>
        <Link
          to="/categories"
          className="mb-2 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="size-4" /> Categorías
        </Link>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold tracking-tight">{category.name}</h1>
            <Badge variant="outline">{CATEGORY_TYPE_LABELS[category.type]}</Badge>
            {category.archivedAt ? <Badge variant="secondary">Archivada</Badge> : null}
          </div>
          {!category.isSystem ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="Acciones de la categoría">
                  <MoreHorizontal />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
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
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </div>
      </div>

      <ProjectionStatCards
        monthly={summary.totals.monthly}
        sixMonths={summary.totals.sixMonths}
        twelveMonths={summary.totals.twelveMonths}
        currency={items[0]?.currency ?? "USD"}
        isLoading={false}
      />

      {summary.oneTimeTotal > 0 ? (
        <p className="text-sm text-muted-foreground">
          + {formatMoney(summary.oneTimeTotal, items[0]?.currency ?? "USD")} en gastos esporádicos
          (no incluidos en las proyecciones)
        </p>
      ) : null}

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
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
            <ul className="grid grid-cols-[repeat(auto-fill,minmax(6.5rem,1fr))] gap-2">
              {items.map((item) => (
                <li key={item.id} className="flex">
                  <ExpenseItemCard item={item} categoryName={category.name} canEdit={false} />
                </li>
              ))}
            </ul>
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
                Esta acción no se puede deshacer. Las categorías con transacciones o presupuestos no
                se pueden eliminar, archívalas en su lugar.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={() => void handleDelete()}>Eliminar</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}
