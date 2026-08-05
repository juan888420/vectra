import {
  createExpenseItemBodySchema,
  expenseItemFrequencySchema,
  moneyAmountSchema,
  type ExpenseItemFrequency,
  type ExpenseItemPublic,
} from "@vectra/types";
import {
  Button,
  cn,
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
} from "@vectra/ui";
import type { UseFormReturn } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { ApiError } from "../../lib/api-client.js";
import { applyConflictError } from "../../lib/form-errors.js";
import { useCreateExpenseItem } from "../expense-items/use-expense-items.js";

const FREQUENCY_LABELS: Record<ExpenseItemFrequency, string> = {
  MONTHLY: "Mensual",
  YEARLY: "Anual",
  ONE_TIME: "Esporádico",
};

// `categoryId` comes from step one, not from a field. Same string-amount
// treatment as ExpenseItemFormDialog: the real money rule runs at submit.
export const inlineProductSchema = createExpenseItemBodySchema
  .omit({ amount: true, frequency: true, categoryId: true })
  .extend({
    amount: z.string().min(1, "El monto es obligatorio"),
    frequency: expenseItemFrequencySchema,
  });

export type InlineProductValues = z.infer<typeof inlineProductSchema>;

export const INLINE_PRODUCT_DEFAULT_VALUES: InlineProductValues = {
  name: "",
  amount: "",
  frequency: "MONTHLY",
};

interface ScenarioInlineProductFormProps {
  // Owned by the parent (ScenarioItemsSection), not created here: the parent
  // stays mounted while the user detours into "crear categoría", so the
  // already-typed name/amount survive that detour instead of resetting with
  // this component's own mount/unmount.
  form: UseFormReturn<InlineProductValues>;
  categoryId: string;
  onCreated: (item: ExpenseItemPublic) => void;
  onCancel: () => void;
}

export function ScenarioInlineProductForm({
  form,
  categoryId,
  onCreated,
  onCancel,
}: ScenarioInlineProductFormProps) {
  const createExpenseItem = useCreateExpenseItem();

  async function onSubmit(values: InlineProductValues) {
    const parsedAmount = moneyAmountSchema.safeParse(Number(values.amount));
    if (!parsedAmount.success) {
      form.setError("amount", {
        message: parsedAmount.error.issues[0]?.message ?? "Monto inválido",
      });
      return;
    }

    try {
      const created = await createExpenseItem.mutateAsync({
        ...values,
        categoryId,
        amount: parsedAmount.data,
      });
      onCreated(created);
    } catch (error) {
      if (!applyConflictError(error, form, "name")) {
        toast.error(error instanceof ApiError ? error.message : "Algo salió mal.");
      }
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nombre</FormLabel>
                <FormControl>
                  <Input autoComplete="off" placeholder="Netflix, alquiler…" {...field} />
                </FormControl>
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
                  <Input
                    type="number"
                    step="0.01"
                    min="0.01"
                    inputMode="decimal"
                    placeholder="0.00"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="frequency"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Frecuencia</FormLabel>
              <FormControl>
                <div className="grid grid-cols-3 gap-1 rounded-lg bg-muted/60 p-1">
                  {Object.entries(FREQUENCY_LABELS).map(([value, label]) => {
                    const isSelected = field.value === value;
                    return (
                      <button
                        key={value}
                        type="button"
                        onClick={() => field.onChange(value)}
                        aria-pressed={isSelected}
                        className={cn(
                          "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                          isSelected
                            ? "bg-background text-foreground shadow-sm"
                            : "text-muted-foreground hover:text-foreground",
                        )}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancelar
          </Button>
          <Button type="submit" disabled={createExpenseItem.isPending}>
            {createExpenseItem.isPending ? "Guardando…" : "Crear y agregar"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
