# Resumen del proyecto

> Se actualiza al final de cada sesión. Léelo primero para saber dónde retomar.

**Última actualización**: 2026-07-28 (RFC-0020)

**Backend**: completo — auth (JWT + refresh), accounts, categories, transactions, budgets, recurring-transactions (con processor idempotente), dashboard y reports. Todo en `apps/api`, con tests de integración.

**Frontend**: infraestructura (RFC-0017) + UI de negocio para Accounts/Categories (RFC-0018) + Transactions (RFC-0019) + Dashboard (RFC-0020). Vite + React 19 + Tailwind v4, `packages/ui` (shadcn/ui: `Table`/`Dialog`/`Select`/`Badge`/`AlertDialog`/`Skeleton` + `DataTable`/`EmptyState`/`FormDialog` reutilizables — `DataTable` ya renderiza skeleton rows en `isLoading`), `packages/types` (schemas Zod compartidos: `accounts`/`categories`/`transactions`/`budgets` (parcial, solo lectura)/`dashboard`/`money`) y `packages/utils` (helpers compartidos `formatMoney`/`formatDateOnly`, usados por Transactions y Dashboard). Auth flow completo verificado end-to-end. CRUD completo de Accounts, Categories y Transactions. Dashboard (`/`, reemplaza el placeholder `Home`) consume `GET /dashboard/summary`: stat cards (balance total, mes actual, salud financiera), gráfico de gasto por categoría y comparación mensual (Recharts, lazy-loaded vía `React.lazy`/`Suspense`), lista de presupuestos con progreso, top expenses y tabla de balances por cuenta. React Query Devtools activo solo en desarrollo. Tests de Dashboard cubren loading/success/empty/error (sin testear internals de Recharts). **Sin Budgets/Reports UI todavía** (el backend ya expone budgets vía dashboard, pero no hay CRUD UI propio).

**Estado de rama**: trabajo en curso sobre `main` (RFC-0020 implementado directamente, pendiente de revisión final antes de commit/PR).

**Sigue**: Budgets CRUD UI (RFC-0021), que debe extender `packages/types/src/budgets.ts` (hoy deliberadamente parcial, solo lectura) con schemas de create/update/list. Después: Reports UI.
