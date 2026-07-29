import type { TopExpense } from "@vectra/types";
import { EmptyState, Skeleton } from "@vectra/ui";
import { formatDateOnly, formatMoney } from "@vectra/utils";
import { Receipt } from "lucide-react";

interface TopExpensesListProps {
  expenses: TopExpense[];
  currency: string;
  accountNameById: Map<string, string>;
  categoryNameById: Map<string, string>;
  isLoading?: boolean;
}

export function TopExpensesList({
  expenses,
  currency,
  accountNameById,
  categoryNameById,
  isLoading,
}: TopExpensesListProps) {
  if (isLoading) {
    return (
      <div className="flex flex-col gap-3">
        {Array.from({ length: 5 }, (_, index) => (
          <Skeleton key={index} className="h-10 w-full" />
        ))}
      </div>
    );
  }

  if (expenses.length === 0) {
    return (
      <EmptyState
        icon={Receipt}
        title="Todavía no hay gastos este mes"
        description="Tus mayores gastos de este mes aparecerán aquí."
      />
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {expenses.map((expense) => (
        <li key={expense.id} className="flex items-center justify-between gap-3 text-sm">
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium">
              {categoryNameById.get(expense.categoryId) ?? "—"} ·{" "}
              {accountNameById.get(expense.accountId) ?? "—"}
            </p>
            <p className="truncate text-muted-foreground">
              {formatDateOnly(expense.date)}
              {expense.note ? ` · ${expense.note}` : ""}
            </p>
          </div>
          <span className="shrink-0 font-medium">{formatMoney(expense.amount, currency)}</span>
        </li>
      ))}
    </ul>
  );
}
