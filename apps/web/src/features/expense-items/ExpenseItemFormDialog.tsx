import { zodResolver } from "@hookform/resolvers/zod";
import {
  createExpenseItemBodySchema,
  expenseItemFrequencySchema,
  moneyAmountSchema,
  type ExpenseItemFrequency,
  type ExpenseItemMutationResponse,
  type ExpenseItemPublic,
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
import { Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { ApiError } from "../../lib/api-client.js";
import { applyConflictError } from "../../lib/form-errors.js";
import { CategoryFormDialog } from "../categories/CategoryFormDialog.js";
import { useCategories } from "../categories/use-categories.js";
import { useCreateExpenseItem, useUpdateExpenseItem } from "./use-expense-items.js";

const FREQUENCY_LABELS: Record<ExpenseItemFrequency, string> = {
  MONTHLY: "Mensual",
  YEARLY: "Anual",
  ONE_TIME: "Esporádico",
};

// Sentinel selected from the category dropdown to open the inline "crear
// categoría" flow (ADR-0005 §3) instead of picking an existing one.
const CREATE_CATEGORY_OPTION = "__create_category__";

// Same reasoning as TransactionFormDialog: `amount` stays a string in the
// form and is validated with the real `moneyAmountSchema` at submit time.
// `frequency` is re-declared without its `.default(...)` — keeping it would
// make the resolver's input/output types diverge (optional vs required).
const expenseItemFormSchema = createExpenseItemBodySchema
  .omit({ amount: true, frequency: true })
  .extend({
    amount: z.string().min(1, "El monto es obligatorio"),
    frequency: expenseItemFrequencySchema,
  });

type ExpenseItemFormValues = z.infer<typeof expenseItemFormSchema>;

interface ExpenseItemFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  expenseItem?: ExpenseItemPublic;
  /** Preselects a category when creating — used from CategoryDetailPage
   * ("nuevo producto en esta categoría") and the scenario composer. */
  defaultCategoryId?: string;
  /** Called after a successful create — the scenario composer uses this to
   * add the new product to the scenario right away (ADR-0005 §3). */
  onCreated?: (item: ExpenseItemPublic) => void;
  /** Called after a successful edit with the impact the edit would have on
   * the scenarios using it — the parent owns the confirmation dialog
   * (RFC-0023.3). */
  onEdited?: (result: ExpenseItemMutationResponse) => void;
}

export function ExpenseItemFormDialog({
  open,
  onOpenChange,
  expenseItem,
  defaultCategoryId,
  onCreated,
  onEdited,
}: ExpenseItemFormDialogProps) {
  const isEditing = expenseItem !== undefined;
  const createExpenseItem = useCreateExpenseItem();
  const updateExpenseItem = useUpdateExpenseItem();
  const [creatingCategory, setCreatingCategory] = useState(false);

  const form = useForm<ExpenseItemFormValues>({
    resolver: zodResolver(expenseItemFormSchema),
    defaultValues: { categoryId: "", name: "", amount: "", frequency: "MONTHLY" },
  });

  // Only EXPENSE categories are valid destinations; archived ones stay out
  // unless they're the item's current category (same pattern as Transactions).
  const { data: categoriesData, isLoading: isLoadingCategories } = useCategories({
    type: "EXPENSE",
    includeArchived: true,
    pageSize: 100,
    sortBy: "name",
  });
  const categoryOptions = (categoriesData?.data ?? []).filter(
    (category) => !category.archivedAt || category.id === expenseItem?.categoryId,
  );

  useEffect(() => {
    if (open) {
      form.reset({
        categoryId: expenseItem?.categoryId ?? defaultCategoryId ?? "",
        name: expenseItem?.name ?? "",
        amount: expenseItem ? String(expenseItem.amount) : "",
        frequency: expenseItem?.frequency ?? "MONTHLY",
      });
    }
  }, [open, expenseItem, defaultCategoryId, form]);

  async function onSubmit(values: ExpenseItemFormValues) {
    const parsedAmount = moneyAmountSchema.safeParse(Number(values.amount));
    if (!parsedAmount.success) {
      form.setError("amount", {
        message: parsedAmount.error.issues[0]?.message ?? "Monto inválido",
      });
      return;
    }

    try {
      if (isEditing) {
        const result = await updateExpenseItem.mutateAsync({
          id: expenseItem.id,
          body: { ...values, amount: parsedAmount.data },
        });
        onEdited?.(result);
      } else {
        const created = await createExpenseItem.mutateAsync({
          ...values,
          amount: parsedAmount.data,
        });
        onCreated?.(created);
      }
      onOpenChange(false);
    } catch (error) {
      if (!applyConflictError(error, form, "name")) {
        toast.error(
          error instanceof ApiError ? error.message : "Algo salió mal. Intenta de nuevo.",
        );
      }
    }
  }

  const isSubmitting = createExpenseItem.isPending || updateExpenseItem.isPending;

  return (
    <>
      <FormDialog
        open={open}
        onOpenChange={onOpenChange}
        title={isEditing ? "Editar producto" : "Nuevo producto"}
        description="Un producto es un gasto reutilizable que puedes agregar a cualquier escenario."
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
          name="categoryId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Categoría</FormLabel>
              <Select
                value={field.value}
                onValueChange={(value) => {
                  if (value === CREATE_CATEGORY_OPTION) {
                    setCreatingCategory(true);
                    return;
                  }
                  field.onChange(value);
                }}
                disabled={isLoadingCategories}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona una categoría" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {categoryOptions.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}
                      {category.archivedAt ? " (archivada)" : ""}
                    </SelectItem>
                  ))}
                  <SelectItem value={CREATE_CATEGORY_OPTION}>
                    <span className="flex items-center gap-1.5 text-primary">
                      <Plus className="size-3.5" /> Crear categoría nueva
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="amount"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Precio</FormLabel>
              <FormControl>
                <Input type="number" step="0.01" min="0.01" inputMode="decimal" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="frequency"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Frecuencia</FormLabel>
              <Select value={field.value} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {Object.entries(FREQUENCY_LABELS).map(([value, label]) => (
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

      <CategoryFormDialog
        open={creatingCategory}
        onOpenChange={setCreatingCategory}
        forcedType="EXPENSE"
        onCreated={(category) => form.setValue("categoryId", category.id)}
      />
    </>
  );
}
