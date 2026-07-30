import { Navigate, Route, Routes } from "react-router";

import { AccountsPage } from "../features/accounts/AccountsPage.js";
import { LoginPage } from "../features/auth/LoginPage.js";
import { ProtectedRoute } from "../features/auth/ProtectedRoute.js";
import { RegisterPage } from "../features/auth/RegisterPage.js";
import { CategoriesPage } from "../features/categories/CategoriesPage.js";
import { CategoryDetailPage } from "../features/categories/CategoryDetailPage.js";
import { DashboardPage } from "../features/dashboard/DashboardPage.js";
import { ExpenseItemDetailPage } from "../features/expense-items/ExpenseItemDetailPage.js";
import { ExpenseItemsPage } from "../features/expense-items/ExpenseItemsPage.js";
import { IncomeDetailPage } from "../features/incomes/IncomeDetailPage.js";
import { IncomesPage } from "../features/incomes/IncomesPage.js";
import { ScenarioDetailPage } from "../features/scenarios/ScenarioDetailPage.js";
import { ScenariosIndexPage } from "../features/scenarios/ScenariosIndexPage.js";
import { ScenariosLayout } from "../features/scenarios/ScenariosLayout.js";
import { TransactionsPage } from "../features/transactions/TransactionsPage.js";
import { Layout } from "./Layout.js";

// Declarative <Routes>, not RRv7's data-router/loader mode: TanStack Query
// owns all server state (docs/architecture/overview.md), so routing stays
// purely about which screen renders, not about fetching.
//
// `/` lands on Escenarios (ADR-0006) — the Dashboard, built entirely over
// the ledger, moves to `/dashboard` as a secondary "Historial" screen until
// it's redesigned around scenarios.
export function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<Layout />}>
          <Route path="/" element={<Navigate to="/scenarios" replace />} />
          <Route path="/scenarios" element={<ScenariosLayout />}>
            <Route index element={<ScenariosIndexPage />} />
            <Route path=":id" element={<ScenarioDetailPage />} />
          </Route>
          <Route path="/categories" element={<CategoriesPage />} />
          <Route path="/categories/:id" element={<CategoryDetailPage />} />
          <Route path="/expense-items" element={<ExpenseItemsPage />} />
          <Route path="/expense-items/:id" element={<ExpenseItemDetailPage />} />
          <Route path="/incomes" element={<IncomesPage />} />
          <Route path="/incomes/:id" element={<IncomeDetailPage />} />

          {/* Historial (ledger) — secondary, ADR-0005/0006 */}
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/accounts" element={<AccountsPage />} />
          <Route path="/transactions" element={<TransactionsPage />} />
        </Route>
      </Route>
    </Routes>
  );
}
