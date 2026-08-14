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

import { CardGrid } from "../../components/CardGrid.js";
import { ListPageHeader } from "../../components/ListPageHeader.js";
import { PageContainer } from "../../components/PageContainer.js";
import { Pagination } from "../../components/Pagination.js";
import { getErrorMessage } from "../../lib/error-messages.js";
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
    const wasArchived = category.archivedAt !== null;
    try {
      if (wasArchived) {
        await unarchiveCategory.mutateAsync(category.id);
      } else {
        await archiveCategory.mutateAsync(category.id);
      }
      toast.success(wasArchived ? "Categoría restaurada." : "Categoría archivada.");
    } catch (error) {
      toast.error(getErrorMessage(error, "category"));
    }
  }

  async function handleDelete() {
    if (!pendingDelete) return;
    try {
      await deleteCategory.mutateAsync(pendingDelete.id);
      toast.success("Categoría eliminada.");
    } catch (error) {
      toast.error(getErrorMessage(error, "category"));
    }
  }

  const categories = data?.data ?? [];

  return (
    <PageContainer>
      <ListPageHeader
        title="Categorías"
        description="Agrupa tus productos por área de tu vida y mira cuánto pesa cada una."
        action={
          <>
            {/* Lives in the header rather than on a row of its own: alone on a
                right-aligned line it read as an orphaned control, and the gap
                grew with the container on wide screens. */}
            <Button
              variant={includeArchived ? "secondary" : "outline"}
              onClick={() => {
                setIncludeArchived((value) => !value);
                setPage(1);
              }}
            >
              {includeArchived ? "Ocultar archivadas" : "Mostrar archivadas"}
            </Button>
            <Button onClick={() => setFormDialog({ mode: "create" })}>
              <Plus /> Nueva categoría
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
      ) : categories.length === 0 ? (
        <EmptyState
          icon={Tags}
          title="Todavía no hay categorías"
          description="Crea tu primera categoría para empezar a organizar tus productos."
          action={
            <Button onClick={() => setFormDialog({ mode: "create" })}>
              <Plus /> Nueva categoría
            </Button>
          }
        />
      ) : (
        <CardGrid density="card">
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
        </CardGrid>
      )}

      <Pagination
        page={data?.meta.page ?? 1}
        totalPages={data?.meta.totalPages ?? 1}
        onPageChange={setPage}
      />

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
