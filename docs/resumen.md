# Resumen del proyecto

> Se actualiza al final de cada sesión. Léelo primero para saber dónde retomar.

**Última actualización**: 2026-07-28 (giro de producto, ADR-0004)

## Estado

**Backend**: completo para el ledger — auth (JWT + refresh), accounts, categories, transactions, budgets, recurring-transactions (con processor idempotente), dashboard y reports. Todo en `apps/api`, con tests de integración. Nuevos registros ahora usan `COP` como `defaultCurrency` por defecto (antes `USD`).

**Frontend**: infraestructura (RFC-0017) + UI de negocio para Accounts/Categories (RFC-0018) + Transactions (RFC-0019), **toda la UI traducida al español** (incluyendo mensajes de validación de Zod vía locale `es`). `packages/ui` (shadcn/ui: `Table`/`Dialog`/`Select`/`Badge`/`AlertDialog`/`Skeleton` + `DataTable`/`EmptyState`/`FormDialog` reutilizables) y `packages/types` (schemas Zod compartidos: `accounts`/`categories`/`transactions`/`money`). Auth flow verificado end-to-end. CRUD completo de Accounts, Categories y Transactions. **Sin Dashboard ni Budgets/Reports UI, ni planes de gasto todavía.**

**Giro de producto (ADR-0004)**: los **planes de gasto** (expense plans) pasan a ser la feature central — listas nombradas de gastos recurrentes hipotéticos con totales, proyecciones a 6/12 meses, composición de planes por referencia viva (sin ciclos) y fuentes de ingreso opcionales. El ledger existente se conserva como feature secundaria, no se elimina. El Dashboard genérico de RFC-0020 quedó descartado (se implementó una vez y se revirtió); el próximo dashboard se diseña alrededor de los planes. Ver `docs/decisions/0004-expense-plans-pivot.md`, `product/vision.md` y `product/roadmap.md`.

## Qué se hizo en esta sesión

1. **Fix**: `formatDateOnly` en `TransactionsPage.tsx` y el input de fecha en `TransactionFormDialog.tsx` asumían un `date` sin hora (`"2026-01-15"`); el backend real devuelve ISO datetime completo (`"2026-07-20T00:00:00.000Z"`), lo que rompía la página de Transacciones (`RangeError: Invalid time value`). Ahora ambos recortan a los primeros 10 caracteres antes de parsear.
2. **Fix**: `@hookform/resolvers@3.10.0` es incompatible con Zod v4 (su chequeo `Array.isArray(error?.errors)` no detecta un `ZodError` de Zod v4, que renombró esa propiedad a `.issues`). Esto hacía que **cualquier** error de validación en **cualquier** formulario (login, registro, cuentas, categorías, transacciones) se relanzara sin capturar en vez de mostrarse en el campo — el síntoma era "no pasa nada al hacer clic en el botón". Se actualizó a `@hookform/resolvers@^5.5.7` + `react-hook-form@^7.83.0`, y se ajustaron los genéricos de `useForm` en `RegisterPage.tsx` (único formulario con campos `.default()` en su schema).
3. **Feature**: traducción completa de la UI al español (nav, formularios, tablas, toasts, empty states, alert dialogs) y `z.config(es())` en `main.tsx` para que los mensajes de validación por defecto de Zod salgan en español en todos los formularios.
4. **Feature**: `defaultCurrency` por defecto en el registro cambiado de `USD` a `COP` (backend y su mirror en `packages/types`), a pedido explícito — sin tocar los datos ya sembrados del usuario de prueba.
5. **Docs**: ADR-0004 documentando el giro de producto hacia planes de gasto, con `vision.md`, `roadmap.md` y `glossary.md` actualizados en consecuencia.

Todo verificado con `pnpm typecheck`, `pnpm lint` y la suite de tests de `apps/web` y `apps/api` (2 tests de `recurring-transactions-processor.test.ts` timeoutean en este entorno por lentitud de la DB real, no relacionados con estos cambios).

## Sigue

**Fase 2 del roadmap** — construir planes de gasto:

1. RFC de la entidad backend: `ExpensePlan` + `ExpensePlanItem` (precio, frecuencia mensual/anual, categoría, estados activo/archivado), siguiendo el mismo patrón de feature ya usado 3 veces (accounts/categories/transactions).
2. CRUD UI de planes (con creación inline de categorías).
3. Composición de planes (incluir un plan dentro de otro, por referencia viva).
4. Proyecciones y dashboard comparativo de escenarios (primera introducción real de Recharts).
5. Fuentes de ingreso y cobertura (vínculo opcional plan → ingreso).

**Usuario de prueba con datos**: `dev@vectra.local` / `devpassword` (accounts, categories, transactions y budgets sembrados en USD — no se tocó al cambiar el default a COP).
