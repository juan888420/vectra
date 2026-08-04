import { zodResolver } from "@hookform/resolvers/zod";
import {
  createCategoryBodySchema,
  DEFAULT_CATEGORY_ICON,
  type CategoryIcon,
  type CategoryPublic,
  type CategoryType,
} from "@vectra/types";
import {
  FormControl,
  FormDialog,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@vectra/ui";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { applyConflictError } from "../../lib/form-errors.js";
import { CategoryIconPicker } from "./CategoryIconPicker.js";
import { useCreateCategory, useUpdateCategory } from "./use-categories.js";

const CATEGORY_TYPE_LABELS: Record<CategoryType, string> = {
  EXPENSE: "Gasto",
  INCOME: "Ingreso",
};

interface CategoryFormValues {
  name: string;
  type: CategoryType;
  icon: CategoryIcon;
}

interface CategoryFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  category?: CategoryPublic;
  /** Locks `type` to this value when creating — used by the inline "crear
   * categoría" flow from ExpenseItemFormDialog, where only EXPENSE makes
   * sense (ADR-0005 §3). Ignored when editing. */
  forcedType?: CategoryType;
  /** Called after a successful create, so a caller embedding this dialog
   * inline (e.g. product creation) can auto-select the new category. */
  onCreated?: (category: CategoryPublic) => void;
}

export function CategoryFormDialog({
  open,
  onOpenChange,
  category,
  forcedType,
  onCreated,
}: CategoryFormDialogProps) {
  const isEditing = category !== undefined;
  const createCategory = useCreateCategory();
  const updateCategory = useUpdateCategory();

  const form = useForm<CategoryFormValues>({
    resolver: zodResolver(createCategoryBodySchema),
    defaultValues: { name: "", type: forcedType ?? "EXPENSE", icon: DEFAULT_CATEGORY_ICON },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        name: category?.name ?? "",
        type: category?.type ?? forcedType ?? "EXPENSE",
        icon: category?.icon ?? DEFAULT_CATEGORY_ICON,
      });
    }
  }, [open, category, forcedType, form]);

  async function onSubmit(values: CategoryFormValues) {
    try {
      if (isEditing) {
        // `type` is immutable server-side. A system category rejects a rename
        // but accepts an icon, so only the icon travels in that case.
        await updateCategory.mutateAsync({
          id: category.id,
          body: category.isSystem
            ? { icon: values.icon }
            : { name: values.name, icon: values.icon },
        });
      } else {
        const created = await createCategory.mutateAsync(values);
        onCreated?.(created);
      }
      onOpenChange(false);
    } catch (error) {
      if (!applyConflictError(error, form, "name")) {
        toast.error("Algo salió mal. Intenta de nuevo.");
      }
    }
  }

  const isSubmitting = createCategory.isPending || updateCategory.isPending;

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={isEditing ? "Editar categoría" : "Nueva categoría"}
      description={
        isEditing
          ? "El tipo de una categoría no puede cambiar una vez creada."
          : "Las categorías agrupan tus transacciones para presupuestos y reportes."
      }
      form={form}
      onSubmit={onSubmit}
      isSubmitting={isSubmitting}
      submitLabel="Guardar"
      submittingLabel="Guardando…"
    >
      <FormField
        control={form.control}
        name="name"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Nombre</FormLabel>
            <FormControl>
              <Input autoComplete="off" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name="icon"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Icono</FormLabel>
            <FormControl>
              <CategoryIconPicker value={field.value} onChange={field.onChange} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name="type"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Tipo</FormLabel>
            <Select
              value={field.value}
              onValueChange={field.onChange}
              disabled={isEditing || forcedType !== undefined}
            >
              <FormControl>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                {Object.entries(CATEGORY_TYPE_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />
    </FormDialog>
  );
}
