# Resumen del proyecto

> Se actualiza al final de cada sesión. Léelo primero para saber dónde retomar.

**Última actualización**: 2026-07-27 (RFC-0018)

**Backend**: completo — auth (JWT + refresh), accounts, categories, transactions, budgets, recurring-transactions (con processor idempotente), dashboard y reports. Todo en `apps/api`, con tests de integración.

**Frontend**: infraestructura (RFC-0017) + primera UI de negocio (RFC-0018: Accounts & Categories). Vite + React 19 + Tailwind v4, `packages/ui` (shadcn/ui, ahora con `Table`/`Dialog`/`Select`/`Badge`/`AlertDialog` + `DataTable`/`EmptyState` reutilizables) y `packages/types` (schemas Zod compartidos, ahora con `accounts`/`categories`). Auth flow completo verificado end-to-end. Pantallas de Accounts y Categories con CRUD completo (crear, editar, archivar/desarchivar, eliminar), primer precedente de query hooks TanStack Query (con query key factories) y de testing en frontend (Vitest + Testing Library + MSW). **Sin Transactions, Dashboard ni Budgets/Reports todavía.**

**Estado de rama**: trabajo en `feat/rfc-0018-accounts-categories-ui`, no mergeado a `main` (cada RFC vive en su propia rama, se abre PR y se mergea manualmente por el usuario).

**Sigue**: RFC-0019 — UI de Transactions, consumiendo los selects de accounts/categories ya construidos en RFC-0018. Después: Dashboard/Budgets/Reports, que dependen de más piezas visuales (charts con Recharts).
