import type { CategoryPublic, CategoryType } from "@vectra/types";
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
import { Archive, ArchiveRestore, MoreHorizontal, Pencil, Plus, Tags, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { ApiError } from "../../lib/api-client.js";
import { CategoryFormDialog } from "./CategoryFormDialog.js";
import {
  useArchiveCategory,
  useCategories,
  useDeleteCategory,
  useUnarchiveCategory,
} from "./use-categories.js";

const CATEGORY_TYPE_LABELS: Record<CategoryType, string> = {
  EXPENSE: "Gasto",
  INCOME: "Ingreso",
};

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

      <DataTable
        columns={[
          { id: "name", header: "Nombre", cell: (category) => category.name },
          { id: "type", header: "Tipo", cell: (category) => CATEGORY_TYPE_LABELS[category.type] },
          {
            id: "status",
            header: "Estado",
            cell: (category) => (
              <div className="flex gap-1.5">
                {category.isSystem ? <Badge variant="outline">Sistema</Badge> : null}
                {category.archivedAt ? <Badge variant="secondary">Archivada</Badge> : null}
              </div>
            ),
          },
          {
            id: "actions",
            header: "",
            className: "text-right",
            cell: (category) => (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" aria-label={`Acciones para ${category.name}`}>
                    <MoreHorizontal />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    disabled={category.isSystem}
                    onSelect={() => setFormDialog({ mode: "edit", category })}
                  >
                    <Pencil /> Editar
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    disabled={category.isSystem}
                    onSelect={() => void handleToggleArchive(category)}
                  >
                    {category.archivedAt ? <ArchiveRestore /> : <Archive />}
                    {category.archivedAt ? "Desarchivar" : "Archivar"}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    disabled={category.isSystem}
                    className="text-destructive focus:text-destructive"
                    onSelect={() => setPendingDelete(category)}
                  >
                    <Trash2 /> Eliminar
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ),
          },
        ]}
        data={categories}
        rowKey={(category) => category.id}
        isLoading={isLoading}
        emptyState={
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

      <CategoryFormDialog
        open={formDialog !== null}
        onOpenChange={(open) => {
          if (!open) setFormDialog(null);
        }}
        category={formDialog?.mode === "edit" ? formDialog.category : undefined}
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
    </div>
  );
}
