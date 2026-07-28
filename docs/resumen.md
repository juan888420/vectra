# Resumen del proyecto

> Se actualiza al final de cada sesión. Léelo primero para saber dónde retomar.

**Última actualización**: 2026-07-28 (giro de producto, ADR-0004)

## Estado

**Backend**: completo para el ledger — auth (JWT + refresh), accounts, categories, transactions, budgets, recurring-transactions (con processor idempotente), dashboard y reports. Todo en `apps/api`, con tests de integración. Nuevos registros usan `COP` como `defaultCurrency` por defecto (antes `USD`; el usuario de prueba sembrado sigue en USD, no se tocó).

**Frontend**: infraestructura (RFC-0017) + UI de negocio para Accounts/Categories (RFC-0018) + Transactions (RFC-0019) + Dashboard (RFC-0020, mergeado vía PR #16). Vite + React 19 + Tailwind v4, `packages/ui` (shadcn/ui: `Table`/`Dialog`/`Select`/`Badge`/`AlertDialog`/`Skeleton` + `DataTable`/`EmptyState`/`FormDialog` reutilizables), `packages/types` (schemas Zod compartidos: `accounts`/`categories`/`transactions`/`budgets` (parcial, solo lectura)/`dashboard`/`money`) y `packages/utils` (`formatMoney`/`formatDateOnly` compartidos, usados por Transactions y Dashboard). Auth flow verificado end-to-end. CRUD completo de Accounts, Categories y Transactions. Dashboard (`/`) consume `GET /dashboard/summary`: stat cards, gráfico de gasto por categoría y comparación mensual (Recharts, lazy-loaded), presupuestos con progreso, top expenses y balances por cuenta. React Query Devtools activo solo en desarrollo.

**Toda la UI del ledger (nav, Accounts, Categories, Transactions, Login/Register) está traducida al español**, incluyendo mensajes de validación de Zod (`z.config(es())`). **El Dashboard (RFC-0020) todavía está en inglés** — se mergeó por una rama separada antes de la traducción de esta sesión y quedó pendiente.

**Giro de producto (ADR-0004)**: los **planes de gasto** (expense plans) pasan a ser la feature central — listas nombradas de gastos recurrentes hipotéticos con totales, proyecciones a 6/12 meses, composición de planes por referencia viva (sin ciclos) y fuentes de ingreso opcionales. El ledger existente (incluido este Dashboard) se conserva como feature secundaria, no se elimina. El próximo dashboard grande se diseñará alrededor de los planes, no de este. Ver `docs/decisions/0004-expense-plans-pivot.md`, `product/vision.md` y `product/roadmap.md`.

## Qué se hizo en esta sesión

1. **Fix**: `formatDateOnly` (ahora en `packages/utils/src/date.ts`, compartido por Transactions y Dashboard) asumía un `date` sin hora (`"2026-01-15"`); el backend real devuelve ISO datetime completo (`"2026-07-20T00:00:00.000Z"`), lo que rompía la página de Transacciones (`RangeError: Invalid time value`). Ahora recorta a los primeros 10 caracteres antes de parsear — corregido también en `TransactionFormDialog.tsx`.
2. **Fix**: `@hookform/resolvers@3.10.0` es incompatible con Zod v4 (su chequeo `Array.isArray(error?.errors)` no detecta un `ZodError` de Zod v4, que renombró esa propiedad a `.issues`). Cualquier error de validación en cualquier formulario se relanzaba sin capturar en vez de mostrarse en el campo. Actualizado a `@hookform/resolvers@^5.5.7` + `react-hook-form@^7.83.0`; ajustados los genéricos de `useForm` en `RegisterPage.tsx`.
3. **Feature**: traducción completa del ledger al español (nav, formularios, tablas, toasts, empty states, alert dialogs) + locale `es` de Zod para mensajes de validación por defecto.
4. **Feature**: `defaultCurrency` por defecto en el registro cambiado de `USD` a `COP` (backend y su mirror en `packages/types`).
5. **Docs**: ADR-0004 documentando el giro de producto hacia planes de gasto, con `vision.md`, `roadmap.md` y `glossary.md` actualizados.
6. **Merge**: se integró el PR #16 (RFC-0020 Dashboard) que había quedado divergido de esta rama de trabajo local; conflictos resueltos en `Layout.tsx` (nav en español + label "Dashboard"), `TransactionsPage.tsx` (usa `formatDateOnly`/`formatMoney` de `@vectra/utils`) y este archivo.

Todo verificado con `pnpm typecheck`, `pnpm lint` y la suite de tests de `apps/web` y `apps/api` (2 tests de `recurring-transactions-processor.test.ts` timeoutean en este entorno por lentitud de la DB real, no relacionados con estos cambios).

## Sigue

1. **Traducir el Dashboard** (RFC-0020 quedó en inglés): stat cards, títulos de gráficos, `DashboardPage.tsx` y componentes relacionados.
2. **Fase 2 del roadmap** — construir planes de gasto: RFC de `ExpensePlan` + `ExpensePlanItem` en backend (mismo patrón de feature ya usado 3 veces) → CRUD UI → composición → proyecciones y dashboard comparativo (Recharts) → fuentes de ingreso.

**Usuario de prueba con datos**: `dev@vectra.local` / `devpassword` (accounts, categories, transactions y budgets sembrados en USD).
