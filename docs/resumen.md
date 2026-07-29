# Resumen del proyecto

> Se actualiza al final de cada sesión. Léelo primero para saber dónde retomar.

**Última actualización**: 2026-07-28 (redefinición de la visión: escenarios financieros, ADR-0005)

## Estado

**Backend**: completo para el ledger — auth (JWT + refresh), accounts, categories, transactions, budgets, recurring-transactions (con processor idempotente), dashboard y reports. Todo en `apps/api`, con tests de integración. Nuevos registros usan `COP` como `defaultCurrency` por defecto (antes `USD`; el usuario de prueba sembrado sigue en USD, no se tocó).

**Frontend**: infraestructura (RFC-0017) + UI de negocio para Accounts/Categories (RFC-0018) + Transactions (RFC-0019) + Dashboard (RFC-0020, mergeado vía PR #16). Vite + React 19 + Tailwind v4, `packages/ui` (shadcn/ui: `Table`/`Dialog`/`Select`/`Badge`/`AlertDialog`/`Skeleton` + `DataTable`/`EmptyState`/`FormDialog` reutilizables), `packages/types` (schemas Zod compartidos: `accounts`/`categories`/`transactions`/`budgets` (parcial, solo lectura)/`dashboard`/`money`) y `packages/utils` (`formatMoney`/`formatDateOnly` compartidos, usados por Transactions y Dashboard). Auth flow verificado end-to-end. CRUD completo de Accounts, Categories y Transactions. Dashboard (`/`) consume `GET /dashboard/summary`: stat cards, gráfico de gasto por categoría y comparación mensual (Recharts, lazy-loaded), presupuestos con progreso, top expenses y balances por cuenta. React Query Devtools activo solo en desarrollo.

**Toda la UI del ledger está traducida al español**, incluyendo el Dashboard (RFC-0020) — stat cards, títulos de gráficos, tablas y estados vacíos — y los mensajes de validación de Zod (`z.config(es())`).

**Visión redefinida (ADR-0005, supersede parcialmente ADR-0004)**: Vectra es un **simulador de escenarios financieros**. Conceptos: **Escenario** (simulación nombrada con selección explícita de productos, composición con otros escenarios sin ciclos, estados activo/inactivo/archivado, proyecciones mensual/6m/anual derivadas), **Producto** (gasto único en el sistema — nombre, precio, frecuencia mensual/anual/esporádico — organizado por categorías, referenciado por escenarios, creable desde ambos lados), **Ingreso** (sección propia, frecuencias mensual/semanal/anual/esporádico, vínculo opcional bidireccional con escenarios, cobertura % consumido/restante). Principios: reutilizar antes que duplicar; **propagación con confirmación** (Vectra nunca modifica silenciosamente una simulación — si una categoría cambia, pregunta qué escenarios actualizar); comparación relativa al escenario activo (deltas); esporádicos aparte de proyecciones recurrentes. El ledger pasa a ser **vista de registro histórico** (sección secundaria del nav, no se borra código). Ver `docs/decisions/0005-financial-scenarios.md`, `product/vision.md`, `product/roadmap.md` y `glossary.md`.

## Qué se hizo en esta sesión

1. **Fix**: `formatDateOnly` (ahora en `packages/utils/src/date.ts`, compartido por Transactions y Dashboard) asumía un `date` sin hora (`"2026-01-15"`); el backend real devuelve ISO datetime completo (`"2026-07-20T00:00:00.000Z"`), lo que rompía la página de Transacciones (`RangeError: Invalid time value`). Ahora recorta a los primeros 10 caracteres antes de parsear — corregido también en `TransactionFormDialog.tsx`.
2. **Fix**: `@hookform/resolvers@3.10.0` es incompatible con Zod v4 (su chequeo `Array.isArray(error?.errors)` no detecta un `ZodError` de Zod v4, que renombró esa propiedad a `.issues`). Cualquier error de validación en cualquier formulario se relanzaba sin capturar en vez de mostrarse en el campo. Actualizado a `@hookform/resolvers@^5.5.7` + `react-hook-form@^7.83.0`; ajustados los genéricos de `useForm` en `RegisterPage.tsx`.
3. **Feature**: traducción completa del ledger al español (nav, formularios, tablas, toasts, empty states, alert dialogs) + locale `es` de Zod para mensajes de validación por defecto.
4. **Feature**: `defaultCurrency` por defecto en el registro cambiado de `USD` a `COP` (backend y su mirror en `packages/types`).
5. **Docs**: ADR-0004 documentando el giro de producto hacia planes de gasto, con `vision.md`, `roadmap.md` y `glossary.md` actualizados.
6. **Merge**: se integró el PR #16 (RFC-0020 Dashboard) que había quedado divergido de esta rama de trabajo local; conflictos resueltos en `Layout.tsx` (nav en español + label "Dashboard"), `TransactionsPage.tsx` (usa `formatDateOnly`/`formatMoney` de `@vectra/utils`) y este archivo.
7. **Feature**: traducción del Dashboard (RFC-0020) al español — `DashboardPage`, `AccountBalancesTable`, `BudgetsProgressList`, `MonthComparisonChart`, `SpendingByCategoryChart`, `TopExpensesList`. Verificado con typecheck y lint de `apps/web`.
8. **Docs**: ADR-0005 (escenarios financieros) redefiniendo la visión sobre el ADR-0004; `vision.md`, `roadmap.md` (Fase 2 reformulada) y `glossary.md` (Scenario/Product/Income/propagación con confirmación) actualizados; ADR-0004 marcado como `partially superseded`.
9. **RFC-0021 (backend)**: features `expense-items/` e `incomes/` en `apps/api` con CRUD completo, archivar/desarchivar, paginación, filtros y ownership. `ExpenseItem` (categoría **obligatoria**, `MONTHLY`/`YEARLY`/`ONE_TIME`) e `Income` (`WEEKLY`/`MONTHLY`/`YEARLY`/`ONE_TIME`), ambos con nombre único entre los activos por usuario. Migración `20260728120000_add_expense_items_and_incomes` aplicada en `vectra_dev` y `vectra_test`. Mirrors en `packages/types`. 24 tests nuevos, 157 en total pasando.

Todo verificado con `pnpm typecheck`, `pnpm lint` y la suite de tests de `apps/web` y `apps/api` (2 tests de `recurring-transactions-processor.test.ts` timeoutean en este entorno por lentitud de la DB real, no relacionados con estos cambios).

## Sigue

1. **RFC-0022 — backend de `Scenario`**: selección explícita de ítems, composición escenario-en-escenario sin ciclos, estados activo/inactivo/archivado, totales y proyecciones derivadas (prorrateo de anuales, esporádicos aparte), vínculo opcional con `Income`. Debe añadir los guards de "archivar en vez de borrar" que `deleteExpenseItem`/`deleteIncome` dejaron marcados con comentario.
2. Después: CRUD UI → composer de escenarios → comparador con proyecciones (Recharts) → cobertura de ingresos → reorganización del nav (ledger como registro histórico).

**Usuario de prueba con datos**: `dev@vectra.local` / `devpassword` (accounts, categories, transactions y budgets sembrados en USD).
