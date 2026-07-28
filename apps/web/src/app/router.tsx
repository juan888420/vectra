import { Route, Routes } from "react-router";

import { AccountsPage } from "../features/accounts/AccountsPage.js";
import { LoginPage } from "../features/auth/LoginPage.js";
import { ProtectedRoute } from "../features/auth/ProtectedRoute.js";
import { RegisterPage } from "../features/auth/RegisterPage.js";
import { CategoriesPage } from "../features/categories/CategoriesPage.js";
import { TransactionsPage } from "../features/transactions/TransactionsPage.js";
import { Home } from "./Home.js";
import { Layout } from "./Layout.js";

// Declarative <Routes>, not RRv7's data-router/loader mode: TanStack Query
// owns all server state (docs/architecture/overview.md), so routing stays
// purely about which screen renders, not about fetching.
export function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<Layout />}>
          <Route path="/" element={<Home />} />
          <Route path="/accounts" element={<AccountsPage />} />
          <Route path="/categories" element={<CategoriesPage />} />
          <Route path="/transactions" element={<TransactionsPage />} />
        </Route>
      </Route>
    </Routes>
  );
}
