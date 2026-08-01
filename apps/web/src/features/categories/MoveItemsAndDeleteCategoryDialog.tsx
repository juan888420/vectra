import type { CategoryPublic } from "@vectra/types";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@vectra/ui";
import { Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { ApiError } from "../../lib/api-client.js";
import { CategoryFormDialog } from "./CategoryFormDialog.js";
import { useCategories, useDeleteCategoryWithReassignment } from "./use-categories.js";

// Sentinel selected from the target dropdown to open the inline "crear
// categoría" flow instead of picking an existing one (same pattern as
// ExpenseItemFormDialog's category picker).
const CREATE_CATEGORY_OPTION = "__create_category__";

interface MoveItemsAndDeleteCategoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  category: CategoryPublic;
  itemCount: number;
  /** Called after a successful move + delete, once the dialog has closed. */
  onDeleted?: () => void;
}

// Shown instead of the plain delete confirmation when a category has
// products: moving them to another category first is required so no product
// is ever left without one (no orphaned data, ADR-0005).
export function MoveItemsAndDeleteCategoryDialog({
  open,
  onOpenChange,
  category,
  itemCount,
  onDeleted,
}: MoveItemsAndDeleteCategoryDialogProps) {
  const [targetCategoryId, setTargetCategoryId] = useState("");
  const [creatingCategory, setCreatingCategory] = useState(false);
  const deleteWithReassignment = useDeleteCategoryWithReassignment();

  const { data: categoriesData, isLoading: isLoadingCategories } = useCategories({
    type: category.type,
    pageSize: 100,
    sortBy: "name",
  });
  const targetOptions = (categoriesData?.data ?? []).filter(
    (candidate) => candidate.id !== category.id && !candidate.archivedAt,
  );

  async function handleConfirm() {
    if (!targetCategoryId) return;
    try {
      const result = await deleteWithReassignment.mutateAsync({
        id: category.id,
        targetCategoryId,
      });
      toast.success(
        `Se ${result.movedCount === 1 ? "movió 1 producto" : `movieron ${result.movedCount} productos`} y se eliminó "${category.name}".`,
      );
      setTargetCategoryId("");
      onOpenChange(false);
      onDeleted?.();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Algo salió mal. Intenta de nuevo.");
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mover productos antes de eliminar</DialogTitle>
            <DialogDescription>
              Esta categoría tiene {itemCount} {itemCount === 1 ? "producto" : "productos"} asociado
              {itemCount === 1 ? "" : "s"}. Debes moverlos a otra categoría antes de eliminarla.
            </DialogDescription>
          </DialogHeader>

          <Select
            value={targetCategoryId}
            onValueChange={(value) => {
              if (value === CREATE_CATEGORY_OPTION) {
                setCreatingCategory(true);
                return;
              }
              setTargetCategoryId(value);
            }}
            disabled={isLoadingCategories}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecciona la categoría destino" />
            </SelectTrigger>
            <SelectContent>
              {targetOptions.map((option) => (
                <SelectItem key={option.id} value={option.id}>
                  {option.name}
                </SelectItem>
              ))}
              <SelectItem value={CREATE_CATEGORY_OPTION}>
                <span className="flex items-center gap-1.5 text-primary">
                  <Plus className="size-3.5" /> Crear categoría nueva
                </span>
              </SelectItem>
            </SelectContent>
          </Select>

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => void handleConfirm()}
              disabled={!targetCategoryId || deleteWithReassignment.isPending}
            >
              Mover y eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <CategoryFormDialog
        open={creatingCategory}
        onOpenChange={setCreatingCategory}
        forcedType={category.type}
        onCreated={(created) => setTargetCategoryId(created.id)}
      />
    </>
  );
}
