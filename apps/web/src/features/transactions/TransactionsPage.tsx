import type { TransactionPublic, TransactionType } from "@vectra/types";
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
  EmptyState,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@vectra/ui";
import { MoreHorizontal, Pencil, Plus, Receipt, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { useAccounts } from "../accounts/use-accounts.js";
import { useCategories } from "../categories/use-categories.js";
import { ApiError } from "../../lib/api-client.js";
import { TransactionFormDialog } from "./TransactionFormDialog.js";
import { useDeleteTransaction, useTransactions } from "./use-transactions.js";

const TRANSACTION_TYPE_LABELS: Record<TransactionType, string> = {
  EXPENSE: "Expense",
  INCOME: "Income",
};

const PAGE_SIZE = 20;
const ALL = "ALL";

type FormDialogState = { mode: "create" } | { mode: "edit"; transaction: TransactionPublic } | null;

function formatDateOnly(isoDate: string): string {
  // The backend serializes `date` as a full ISO datetime ("2026-07-20T00:00:00.000Z"),
  // not a bare date string — take just the date part before appending our own
  // time-of-day, or the concatenation produces an unparseable string.
  const datePart = isoDate.slice(0, 10);
  return new Intl.DateTimeFormat(undefined, { timeZone: "UTC", dateStyle: "medium" }).format(
    new Date(`${datePart}T00:00:00Z`),
  );
}

function formatAmount(amount: number, currency: string): string {
  return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(amount);
}

export function TransactionsPage() {
  const [page, setPage] = useState(1);
  const [typeFilter, setTypeFilter] = useState<string>(ALL);
  const [accountFilter, setAccountFilter] = useState<string>(ALL);
  const [categoryFilter, setCategoryFilter] = useState<string>(ALL);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [formDialog, setFormDialog] = useState<FormDialogState>(null);
  const [pendingDelete, setPendingDelete] = useState<TransactionPublic | null>(null);

  // Debounced so typing a note search doesn't fire a request per keystroke.
  useEffect(() => {
    const timeout = setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => clearTimeout(timeout);
  }, [searchInput]);

  const { data, isLoading } = useTransactions({
    page,
    pageSize: PAGE_SIZE,
    sortBy: "date",
    sortOrder: "desc",
    type: typeFilter === ALL ? undefined : (typeFilter as TransactionType),
    accountId: accountFilter === ALL ? undefined : accountFilter,
    categoryId: categoryFilter === ALL ? undefined : categoryFilter,
    search: search === "" ? undefined : search,
  });

  // Broad, unfiltered lookups: the table needs every account/category name
  // (including archived ones, since old transactions still reference them),
  // and the filter dropdowns are derived from the same fetch.
  const { data: accountsData } = useAccounts({
    includeArchived: true,
    pageSize: 100,
    sortBy: "name",
  });
  const { data: categoriesData } = useCategories({
    includeArchived: true,
    pageSize: 100,
    sortBy: "name",
  });

  const deleteTransaction = useDeleteTransaction();

  const accountsById = new Map((accountsData?.data ?? []).map((account) => [account.id, account]));
  const categoriesById = new Map(
    (categoriesData?.data ?? []).map((category) => [category.id, category]),
  );
  const categoryFilterOptions = (categoriesData?.data ?? []).filter(
    (category) => typeFilter === ALL || category.type === typeFilter,
  );

  function resetToFirstPage() {
    setPage(1);
  }

  async function handleDelete() {
    if (!pendingDelete) return;
    try {
      await deleteTransaction.mutateAsync(pendingDelete.id);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Something went wrong.");
    }
  }

  const transactions = data?.data ?? [];
  const hasActiveFilters =
    typeFilter !== ALL || accountFilter !== ALL || categoryFilter !== ALL || search !== "";

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Transactions</h1>
          <p className="text-sm text-muted-foreground">Every expense and income, in one place.</p>
        </div>
        <Button onClick={() => setFormDialog({ mode: "create" })}>
          <Plus /> New transaction
        </Button>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <Select
          value={typeFilter}
          onValueChange={(value) => {
            setTypeFilter(value);
            setCategoryFilter(ALL);
            resetToFirstPage();
          }}
        >
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All types</SelectItem>
            {Object.entries(TRANSACTION_TYPE_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={accountFilter}
          onValueChange={(value) => {
            setAccountFilter(value);
            resetToFirstPage();
          }}
        >
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All accounts</SelectItem>
            {(accountsData?.data ?? []).map((account) => (
              <SelectItem key={account.id} value={account.id}>
                {account.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={categoryFilter}
          onValueChange={(value) => {
            setCategoryFilter(value);
            resetToFirstPage();
          }}
        >
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All categories</SelectItem>
            {categoryFilterOptions.map((category) => (
              <SelectItem key={category.id} value={category.id}>
                {category.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Input
          placeholder="Search notes…"
          className="w-48"
          value={searchInput}
          onChange={(event) => {
            setSearchInput(event.target.value);
            resetToFirstPage();
          }}
        />
      </div>

      <DataTable
        columns={[
          {
            id: "date",
            header: "Date",
            cell: (transaction) => formatDateOnly(transaction.date),
          },
          {
            id: "account",
            header: "Account",
            cell: (transaction) => accountsById.get(transaction.accountId)?.name ?? "—",
          },
          {
            id: "category",
            header: "Category",
            cell: (transaction) => categoriesById.get(transaction.categoryId)?.name ?? "—",
          },
          {
            id: "type",
            header: "Type",
            cell: (transaction) => (
              <Badge variant={transaction.type === "INCOME" ? "default" : "outline"}>
                {TRANSACTION_TYPE_LABELS[transaction.type]}
              </Badge>
            ),
          },
          {
            id: "amount",
            header: "Amount",
            className: "text-right",
            cell: (transaction) => (
              <span
                className={
                  transaction.type === "INCOME"
                    ? "font-medium text-emerald-600 dark:text-emerald-400"
                    : "font-medium"
                }
              >
                {transaction.type === "INCOME" ? "+" : "-"}
                {formatAmount(transaction.amount, transaction.currency)}
              </span>
            ),
          },
          {
            id: "note",
            header: "Note",
            cell: (transaction) => (
              <span
                className="block max-w-48 truncate text-muted-foreground"
                title={transaction.note ?? undefined}
              >
                {transaction.note ?? "—"}
              </span>
            ),
          },
          {
            id: "actions",
            header: "",
            className: "text-right",
            cell: (transaction) => (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" aria-label="Actions">
                    <MoreHorizontal />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onSelect={() => setFormDialog({ mode: "edit", transaction })}>
                    <Pencil /> Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onSelect={() => setPendingDelete(transaction)}
                  >
                    <Trash2 /> Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ),
          },
        ]}
        data={transactions}
        rowKey={(transaction) => transaction.id}
        isLoading={isLoading}
        emptyState={
          <EmptyState
            icon={Receipt}
            title={hasActiveFilters ? "No transactions match these filters" : "No transactions yet"}
            description={
              hasActiveFilters
                ? "Try a different filter or clear them to see everything."
                : "Record your first transaction to start tracking your money."
            }
            action={
              hasActiveFilters ? undefined : (
                <Button onClick={() => setFormDialog({ mode: "create" })}>
                  <Plus /> New transaction
                </Button>
              )
            }
          />
        }
      />

      {data && data.meta.totalPages > 1 ? (
        <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Page {data.meta.page} of {data.meta.totalPages}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((value) => value - 1)}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= data.meta.totalPages}
              onClick={() => setPage((value) => value + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      ) : null}

      <TransactionFormDialog
        open={formDialog !== null}
        onOpenChange={(open) => {
          if (!open) setFormDialog(null);
        }}
        transaction={formDialog?.mode === "edit" ? formDialog.transaction : undefined}
      />

      <AlertDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this transaction?</AlertDialogTitle>
            <AlertDialogDescription>This can&apos;t be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => void handleDelete()}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
