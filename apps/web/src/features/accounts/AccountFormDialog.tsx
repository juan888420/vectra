import { zodResolver } from "@hookform/resolvers/zod";
import { createAccountBodySchema, type AccountPublic, type AccountType } from "@vectra/types";
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
import { useAuth } from "../auth/useAuth.js";
import { useCreateAccount, useUpdateAccount } from "./use-accounts.js";

const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  CASH: "Efectivo",
  BANK: "Banco",
  CREDIT_CARD: "Tarjeta de crédito",
  OTHER: "Otro",
};

interface AccountFormValues {
  name: string;
  type: AccountType;
}

interface AccountFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // Presence of `account` is what distinguishes edit mode from create mode.
  account?: AccountPublic;
}

export function AccountFormDialog({ open, onOpenChange, account }: AccountFormDialogProps) {
  const isEditing = account !== undefined;
  const { user } = useAuth();
  const createAccount = useCreateAccount();
  const updateAccount = useUpdateAccount();

  // The UI never edits a single field in isolation, so create's fully-required
  // schema also validates edit submissions correctly (both fields always ride
  // along) — no need to also import the partial update schema here.
  const form = useForm<AccountFormValues>({
    resolver: zodResolver(createAccountBodySchema),
    defaultValues: { name: "", type: "BANK" },
  });

  useEffect(() => {
    if (open) {
      form.reset({ name: account?.name ?? "", type: account?.type ?? "BANK" });
    }
  }, [open, account, form]);

  async function onSubmit(values: AccountFormValues) {
    try {
      if (isEditing) {
        await updateAccount.mutateAsync({ id: account.id, body: values });
      } else {
        await createAccount.mutateAsync(values);
      }
      onOpenChange(false);
    } catch (error) {
      if (!applyConflictError(error, form, "name")) {
        toast.error("Algo salió mal. Intenta de nuevo.");
      }
    }
  }

  const isSubmitting = createAccount.isPending || updateAccount.isPending;

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={isEditing ? "Editar cuenta" : "Nueva cuenta"}
      description={
        isEditing
          ? `La moneda está fija en ${account.currency}.`
          : `Las cuentas nuevas usan tu moneda predeterminada (${user?.defaultCurrency ?? ""}).`
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
        name="type"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Tipo</FormLabel>
            <Select value={field.value} onValueChange={field.onChange}>
              <FormControl>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                {Object.entries(ACCOUNT_TYPE_LABELS).map(([value, label]) => (
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
