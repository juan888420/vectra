import { zodResolver } from "@hookform/resolvers/zod";
import {
  createIncomeBodySchema,
  incomeFrequencySchema,
  moneyAmountSchema,
  type IncomeFrequency,
  type IncomeMutationResponse,
  type IncomePublic,
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
import { z } from "zod";

import { ApiError } from "../../lib/api-client.js";
import { applyConflictError } from "../../lib/form-errors.js";
import { useCreateIncome, useUpdateIncome } from "./use-incomes.js";

const FREQUENCY_LABELS: Record<IncomeFrequency, string> = {
  WEEKLY: "Semanal",
  MONTHLY: "Mensual",
  YEARLY: "Anual",
  ONE_TIME: "Esporádico",
};

// `frequency` is re-declared without its `.default(...)` — see the same
// comment in ExpenseItemFormDialog.tsx.
const incomeFormSchema = createIncomeBodySchema.omit({ amount: true, frequency: true }).extend({
  amount: z.string().min(1, "El monto es obligatorio"),
  frequency: incomeFrequencySchema,
});

type IncomeFormValues = z.infer<typeof incomeFormSchema>;

interface IncomeFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  income?: IncomePublic;
  /** Called after a successful create — the scenario composer uses this to
   * link the new income right away. */
  onCreated?: (income: IncomePublic) => void;
  /** Called after a successful edit with the impact the edit would have on
   * the scenarios using it — the parent owns the confirmation dialog
   * (RFC-0023.3). */
  onEdited?: (result: IncomeMutationResponse) => void;
}

export function IncomeFormDialog({
  open,
  onOpenChange,
  income,
  onCreated,
  onEdited,
}: IncomeFormDialogProps) {
  const isEditing = income !== undefined;
  const createIncome = useCreateIncome();
  const updateIncome = useUpdateIncome();

  const form = useForm<IncomeFormValues>({
    resolver: zodResolver(incomeFormSchema),
    defaultValues: { name: "", amount: "", frequency: "MONTHLY" },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        name: income?.name ?? "",
        amount: income ? String(income.amount) : "",
        frequency: income?.frequency ?? "MONTHLY",
      });
    }
  }, [open, income, form]);

  async function onSubmit(values: IncomeFormValues) {
    const parsedAmount = moneyAmountSchema.safeParse(Number(values.amount));
    if (!parsedAmount.success) {
      form.setError("amount", {
        message: parsedAmount.error.issues[0]?.message ?? "Monto inválido",
      });
      return;
    }

    try {
      if (isEditing) {
        const result = await updateIncome.mutateAsync({
          id: income.id,
          body: { ...values, amount: parsedAmount.data },
        });
        onEdited?.(result);
      } else {
        const created = await createIncome.mutateAsync({ ...values, amount: parsedAmount.data });
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

  const isSubmitting = createIncome.isPending || updateIncome.isPending;

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={isEditing ? "Editar ingreso" : "Nuevo ingreso"}
      description="Sueldo, freelance, dividendos... cualquier fuente de dinero que entra."
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
        name="amount"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Monto</FormLabel>
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
  );
}
