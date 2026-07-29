import type { FinancialHealthStatus } from "@vectra/types";
import { Button, EmptyState, Skeleton } from "@vectra/ui";
import { formatMoney } from "@vectra/utils";
import { AlertTriangle, HeartPulse, PiggyBank, Wallet } from "lucide-react";
import { lazy, Suspense } from "react";

import { useAccounts } from "../accounts/use-accounts.js";
import { useAuth } from "../auth/useAuth.js";
import { useCategories } from "../categories/use-categories.js";
import { AccountBalancesTable } from "./AccountBalancesTable.js";
import { BudgetsProgressList } from "./BudgetsProgressList.js";
import { StatCard, type StatTone } from "./StatCard.js";
import { TopExpensesList } from "./TopExpensesList.js";
import { useDashboardSummary } from "./use-dashboard.js";

// Lazy-loaded so Recharts (and its own chunk) is only fetched when the
// dashboard route is actually visited, not on the initial app shell load.
const SpendingByCategoryChart = lazy(() => import("./SpendingByCategoryChart.js"));
const MonthComparisonChart = lazy(() => import("./MonthComparisonChart.js"));

const HEALTH_TONE: Record<FinancialHealthStatus, StatTone> = {
  GOOD: "positive",
  WARNING: "warning",
  CRITICAL: "negative",
};

const HEALTH_LABEL: Record<FinancialHealthStatus, string> = {
  GOOD: "Buena",
  WARNING: "Alerta",
  CRITICAL: "Crítica",
};

function ChartSkeleton() {
  return <Skeleton className="h-56 w-full rounded-lg" />;
}

export function DashboardPage() {
  const { user } = useAuth();
  const currency = user?.defaultCurrency ?? "USD";

  const { data, isLoading, isError, refetch } = useDashboardSummary();

  // Broad, unfiltered lookups: topExpenses/budgets only carry ids, and this
  // page needs every account/category name (including archived ones, since
  // past expenses can reference an account/category archived since then) —
  // same pattern already used by TransactionsPage.
  const { data: accountsData, isLoading: isAccountsLoading } = useAccounts({
    includeArchived: true,
    pageSize: 100,
    sortBy: "name",
  });
  const { data: categoriesData, isLoading: isCategoriesLoading } = useCategories({
    includeArchived: true,
    pageSize: 100,
    sortBy: "name",
  });

  const accountNameById = new Map(
    (accountsData?.data ?? []).map((account) => [account.id, account.name]),
  );
  const categoryNameById = new Map(
    (categoriesData?.data ?? []).map((category) => [category.id, category.name]),
  );

  const isPageLoading = isLoading || isAccountsLoading || isCategoriesLoading;

  if (isError) {
    return (
      <EmptyState
        icon={AlertTriangle}
        title="Ocurrió un error al cargar el dashboard"
        description="Intenta de nuevo."
        action={<Button onClick={() => void refetch()}>Reintentar</Button>}
      />
    );
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Tus finanzas, de un vistazo.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          label="Saldo total"
          icon={Wallet}
          isLoading={isPageLoading}
          value={data ? formatMoney(data.totalBalance.balance, currency) : null}
        />
        <StatCard
          label="Este mes"
          icon={PiggyBank}
          isLoading={isPageLoading}
          value={data ? formatMoney(data.currentMonthSummary.balance, currency) : null}
        />
        <StatCard
          label="Salud financiera"
          icon={HeartPulse}
          isLoading={isPageLoading}
          value={data ? data.financialHealth.score : null}
          badge={
            data
              ? {
                  label: HEALTH_LABEL[data.financialHealth.status],
                  tone: HEALTH_TONE[data.financialHealth.status],
                }
              : undefined
          }
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border p-6">
          <h2 className="mb-4 text-sm font-medium">Gasto por categoría</h2>
          {isPageLoading ? (
            <ChartSkeleton />
          ) : (
            <Suspense fallback={<ChartSkeleton />}>
              <SpendingByCategoryChart data={data?.spendingByCategory ?? []} currency={currency} />
            </Suspense>
          )}
        </div>
        <div className="rounded-xl border p-6">
          <h2 className="mb-4 text-sm font-medium">Comparación mensual</h2>
          {isPageLoading || !data ? (
            <ChartSkeleton />
          ) : (
            <Suspense fallback={<ChartSkeleton />}>
              <MonthComparisonChart data={data.monthComparison} currency={currency} />
            </Suspense>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border p-6">
          <h2 className="mb-4 text-sm font-medium">Presupuestos</h2>
          <BudgetsProgressList
            budgets={data?.budgets ?? []}
            categoryNameById={categoryNameById}
            isLoading={isPageLoading}
          />
        </div>
        <div className="rounded-xl border p-6">
          <h2 className="mb-4 text-sm font-medium">Mayores gastos este mes</h2>
          <TopExpensesList
            expenses={data?.topExpenses ?? []}
            currency={currency}
            accountNameById={accountNameById}
            categoryNameById={categoryNameById}
            isLoading={isPageLoading}
          />
        </div>
      </div>

      <div className="rounded-xl border p-6">
        <h2 className="mb-4 text-sm font-medium">Cuentas</h2>
        <AccountBalancesTable accounts={data?.accountBalances ?? []} isLoading={isPageLoading} />
      </div>
    </div>
  );
}
