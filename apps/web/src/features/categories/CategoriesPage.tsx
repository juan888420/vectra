import type { CategoryPublic } from "@vectra/types";
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
import { Plus, Tags } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { ApiError } from "../../lib/api-client.js";
import { CategoryCard } from "./CategoryCard.js";
import { CategoryFormDialog } from "./CategoryFormDialog.js";
import { MoveItemsAndDeleteCategoryDialog } from "./MoveItemsAndDeleteCategoryDialog.js";
import {
  useArchiveCategory,
  useCategories,
  useCategorySummary,
  useDeleteCategory,
  useUnarchiveCategory,
} from "./use-categories.js";

const PAGE_SIZE = 20;

type FormDialogState = { mode: "create" } | { mode: "edit"; category: CategoryPublic } | null;

export function CategoriesPage() {
  const [page, setPage] = useState(1);
  const [includeArchived, setIncludeArchived] = useState(false);
  const [formDialog, setFormDialog] = useState<FormDialogState>(null);
  const [pendingDelete, setPendingDelete] = useState<CategoryPublic | null>(null);

  const { data, isLoading } = useCategories({ page, pageSize: PAGE_SIZE, includeArchived });
  const archiveCategory = useArchiveCategory();
  const unarchiveCategory = useUnarchiveCategory();
  const deleteCategory = useDeleteCategory();

  // Item count isn't in the list row, so it's fetched on demand once the
  // user actually asks to delete a category, rather than prefetched per row.
  const { data: pendingSummary, isFetching: isCheckingPendingDelete } = useCategorySummary(
    pendingDelete?.id ?? "",
  );

  async function handleToggleArchive(category: CategoryPublic) {
    try {
      if (category.archivedAt) {
        await unarchiveCategory.mutateAsync(category.id);
      } else {
        await archiveCategory.mutateAsync(category.id);
      }
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Algo salió mal.");
    }
  }

  async function handleDelete() {
    if (!pendingDelete) return;
    try {
      await deleteCategory.mutateAsync(pendingDelete.id);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Algo salió mal.");
    }
  }

  const categories = data?.data ?? [];

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Categorías</h1>
          <p className="text-sm text-muted-foreground">
            Agrupa tus transacciones para presupuestos y reportes.
          </p>
        </div>
        <Button onClick={() => setFormDialog({ mode: "create" })}>
          <Plus /> Nueva categoría
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
          {includeArchived ? "Ocultar archivadas" : "Mostrar archivadas"}
        </Button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(9rem,1fr))] gap-3">
          <Skeleton className="h-28 w-full rounded-xl" />
          <Skeleton className="h-28 w-full rounded-xl" />
          <Skeleton className="h-28 w-full rounded-xl" />
          <Skeleton className="h-28 w-full rounded-xl" />
        </div>
      ) : categories.length === 0 ? (
        <EmptyState
          icon={Tags}
          title="Todavía no hay categorías"
          description="Crea tu primera categoría para empezar a organizar transacciones."
          action={
            <Button onClick={() => setFormDialog({ mode: "create" })}>
              <Plus /> Nueva categoría
            </Button>
          }
        />
      ) : (
        <ul className="grid grid-cols-[repeat(auto-fill,minmax(9rem,1fr))] gap-3">
          {categories.map((category) => (
            <li key={category.id} className="flex">
              <CategoryCard
                category={category}
                onEdit={() => setFormDialog({ mode: "edit", category })}
                onToggleArchive={() => void handleToggleArchive(category)}
                onDelete={() => setPendingDelete(category)}
                isCheckingDelete={isCheckingPendingDelete && pendingDelete?.id === category.id}
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

      <CategoryFormDialog
        open={formDialog !== null}
        onOpenChange={(open) => {
          if (!open) setFormDialog(null);
        }}
        category={formDialog?.mode === "edit" ? formDialog.category : undefined}
      />

      {pendingDelete && pendingSummary && pendingSummary.items.length > 0 ? (
        <MoveItemsAndDeleteCategoryDialog
          open
          onOpenChange={(open) => {
            if (!open) setPendingDelete(null);
          }}
          category={pendingDelete}
          itemCount={pendingSummary.items.length}
          onDeleted={() => setPendingDelete(null)}
        />
      ) : (
        <AlertDialog
          open={pendingDelete !== null && !isCheckingPendingDelete}
          onOpenChange={(open) => {
            if (!open) setPendingDelete(null);
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Eliminar &quot;{pendingDelete?.name}&quot;?</AlertDialogTitle>
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
