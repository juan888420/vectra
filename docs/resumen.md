# Resumen del proyecto

> Se actualiza al final de cada sesión. Léelo primero para saber dónde retomar.

**Última actualización**: 2026-07-27 (RFC-0019)

**Backend**: completo — auth (JWT + refresh), accounts, categories, transactions, budgets, recurring-transactions (con processor idempotente), dashboard y reports. Todo en `apps/api`, con tests de integración.

**Frontend**: infraestructura (RFC-0017) + UI de negocio para Accounts/Categories (RFC-0018) + Transactions (RFC-0019). Vite + React 19 + Tailwind v4, `packages/ui` (shadcn/ui: `Table`/`Dialog`/`Select`/`Badge`/`AlertDialog`/`Skeleton` + `DataTable`/`EmptyState`/`FormDialog` reutilizables — `DataTable` ya renderiza skeleton rows en `isLoading`) y `packages/types` (schemas Zod compartidos: `accounts`/`categories`/`transactions`/`money`). Auth flow completo verificado end-to-end. CRUD completo de Accounts, Categories y Transactions (esta última con selects de cuenta/categoría dependientes del tipo, filtros de lista y regla `type === category.type` reflejada en el UI). Query hooks TanStack Query con key factories en las 3 features; `FormDialog` y `applyConflictError` extraídos como piezas compartidas entre los 3 diálogos de creación/edición. **Sin Dashboard ni Budgets/Reports todavía.**

**Estado de rama**: trabajo en `feat/rfc-0019-transactions-ui`, no mergeado a `main` (cada RFC vive en su propia rama, se abre PR y se mergea manualmente por el usuario).

**Sigue**: Dashboard (RFC-0020), que ya tiene el endpoint backend listo (RFC-0014) — requiere introducir Recharts en el frontend por primera vez. Después: Budgets/Reports UI.
