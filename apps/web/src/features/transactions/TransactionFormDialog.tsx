import { zodResolver } from "@hookform/resolvers/zod";
import {
  createTransactionBodySchema,
  moneyAmountSchema,
  type TransactionPublic,
  type TransactionType,
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

import { useAccounts } from "../accounts/use-accounts.js";
import { useCategories } from "../categories/use-categories.js";
import { ApiError } from "../../lib/api-client.js";
import { useCreateTransaction, useUpdateTransaction } from "./use-transactions.js";

const TRANSACTION_TYPE_LABELS: Record<TransactionType, string> = {
  EXPENSE: "Expense",
  INCOME: "Income",
};

// `amount` stays a string end-to-end in the form (a controlled numeric input
// tied to `valueAsNumber` fights the browser on partial input like a
// trailing decimal point). The real numeric check reuses `moneyAmountSchema`
// at submit time instead of duplicating its rules here.
const transactionFormSchema = createTransactionBodySchema
  .omit({ amount: true })
  .extend({ amount: z.string().min(1, "Amount is required") });

type TransactionFormValues = z.infer<typeof transactionFormSchema>;

interface TransactionFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction?: TransactionPublic;
}

function todayIsoDate(): string {
  const now = new Date();
  const localMidnight = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return localMidnight.toISOString().slice(0, 10);
}

export function TransactionFormDialog({
  open,
  onOpenChange,
  transaction,
}: TransactionFormDialogProps) {
  const isEditing = transaction !== undefined;
  const createTransaction = useCreateTransaction();
  const updateTransaction = useUpdateTransaction();

  const form = useForm<TransactionFormValues>({
    resolver: zodResolver(transactionFormSchema),
    defaultValues: {
      accountId: "",
      categoryId: "",
      type: "EXPENSE",
      amount: "",
      date: todayIsoDate(),
      note: "",
    },
  });

  const selectedType = form.watch("type");

  // Fetched with `includeArchived: true` so an account/category a past
  // transaction still points at (but which has since been archived) keeps
  // showing up as an option when editing — the backend itself only blocks
  // *newly selecting* an archived resource (transactions.service.ts), not
  // leaving an existing one in place.
  const { data: accountsData, isLoading: isLoadingAccounts } = useAccounts({
    includeArchived: true,
    pageSize: 100,
    sortBy: "name",
  });
  const { data: categoriesData, isLoading: isLoadingCategories } = useCategories({
    type: selectedType,
    includeArchived: true,
    pageSize: 100,
    sortBy: "name",
  });

  const accountOptions = (accountsData?.data ?? []).filter(
    (account) => !account.archivedAt || account.id === transaction?.accountId,
  );
  const categoryOptions = (categoriesData?.data ?? []).filter(
    (category) => !category.archivedAt || category.id === transaction?.categoryId,
  );

  useEffect(() => {
    if (open) {
      form.reset({
        accountId: transaction?.accountId ?? "",
        categoryId: transaction?.categoryId ?? "",
        type: transaction?.type ?? "EXPENSE",
        amount: transaction ? String(transaction.amount) : "",
        date: transaction?.date ?? todayIsoDate(),
        note: transaction?.note ?? "",
      });
    }
  }, [open, transaction, form]);

  async function onSubmit(values: TransactionFormValues) {
    const parsedAmount = moneyAmountSchema.safeParse(Number(values.amount));
    if (!parsedAmount.success) {
      form.setError("amount", {
        message: parsedAmount.error.issues[0]?.message ?? "Invalid amount",
      });
      return;
    }

    const note = (values.note ?? "").trim();
    try {
      if (isEditing) {
        await updateTransaction.mutateAsync({
          id: transaction.id,
          body: { ...values, amount: parsedAmount.data, note: note === "" ? null : note },
        });
      } else {
        await createTransaction.mutateAsync({
          ...values,
          amount: parsedAmount.data,
          note: note === "" ? undefined : note,
        });
      }
      onOpenChange(false);
    } catch (error) {
      toast.error(
        error instanceof ApiError ? error.message : "Something went wrong. Please try again.",
      );
    }
  }

  const isSubmitting = createTransaction.isPending || updateTransaction.isPending;

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={isEditing ? "Edit transaction" : "New transaction"}
      form={form}
      onSubmit={onSubmit}
      isSubmitting={isSubmitting}
    >
      <FormField
        control={form.control}
        name="type"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Type</FormLabel>
            <Select
              value={field.value}
              onValueChange={(value) => {
                field.onChange(value);
                // Categories are type-specific; a category valid for the
                // previous type is very likely invalid for the new one.
                form.setValue("categoryId", "");
              }}
            >
              <FormControl>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                {Object.entries(TRANSACTION_TYPE_LABELS).map(([value, label]) => (
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
      <FormField
        control={form.control}
        name="accountId"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Account</FormLabel>
            <Select value={field.value} onValueChange={field.onChange} disabled={isLoadingAccounts}>
              <FormControl>
                <SelectTrigger>
                  <SelectValue placeholder="Select an account" />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                {accountOptions.map((account) => (
                  <SelectItem key={account.id} value={account.id}>
                    {account.name}
                    {account.archivedAt ? " (archived)" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name="categoryId"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Category</FormLabel>
            <Select
              value={field.value}
              onValueChange={field.onChange}
              disabled={isLoadingCategories}
            >
              <FormControl>
                <SelectTrigger>
                  <SelectValue placeholder="Select a category" />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                {categoryOptions.map((category) => (
                  <SelectItem key={category.id} value={category.id}>
                    {category.name}
                    {category.archivedAt ? " (archived)" : ""}
                  </SelectItem>
                ))}
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
            <FormLabel>Amount</FormLabel>
            <FormControl>
              <Input type="number" step="0.01" min="0.01" inputMode="decimal" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name="date"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Date</FormLabel>
            <FormControl>
              <Input type="date" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name="note"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Note (optional)</FormLabel>
            <FormControl>
              <Input maxLength={280} {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </FormDialog>
  );
}
