import type { BudgetPublic, BudgetStatus } from "@vectra/types";
import { cn, EmptyState, Skeleton } from "@vectra/ui";
import { formatMoney } from "@vectra/utils";
import { Target } from "lucide-react";

interface BudgetsProgressListProps {
  budgets: BudgetPublic[];
  categoryNameById: Map<string, string>;
  isLoading?: boolean;
}

const STATUS_BAR_CLASSNAME: Record<BudgetStatus, string> = {
  ON_TRACK: "bg-emerald-500",
  WARNING: "bg-amber-500",
  EXCEEDED: "bg-red-500",
};

export function BudgetsProgressList({
  budgets,
  categoryNameById,
  isLoading,
}: BudgetsProgressListProps) {
  if (isLoading) {
    return (
      <div className="flex flex-col gap-4">
        {Array.from({ length: 3 }, (_, index) => (
          <Skeleton key={index} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  if (budgets.length === 0) {
    return (
      <EmptyState
        icon={Target}
        title="No budgets set up yet"
        description="Set a monthly budget per category to track progress here."
      />
    );
  }

  return (
    <ul className="flex flex-col gap-4">
      {budgets.map((budget) => (
        <li key={budget.id} className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">{categoryNameById.get(budget.categoryId) ?? "—"}</span>
            <span className="text-muted-foreground">
              {formatMoney(budget.spent, budget.currency)} /{" "}
              {formatMoney(budget.amount, budget.currency)}
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={cn("h-full rounded-full", STATUS_BAR_CLASSNAME[budget.status])}
              style={{ width: `${Math.min(100, budget.percentUsed)}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
