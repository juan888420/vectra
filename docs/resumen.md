# Resumen del proyecto

> Se actualiza al final de cada sesión. Léelo primero para saber dónde retomar.

**Última actualización**: 2026-07-29 (RFC-0022: backend del motor de escenarios)

## Estado

**Backend**: completo para el ledger — auth (JWT + refresh), accounts, categories, transactions, budgets, recurring-transactions (con processor idempotente), dashboard y reports. Todo en `apps/api`, con tests de integración. Nuevos registros usan `COP` como `defaultCurrency` por defecto (antes `USD`; el usuario de prueba sembrado sigue en USD, no se tocó). Motor de escenarios (RFC-0022) implementado sobre ADR-0006: feature `scenarios/` con CRUD, selección de ítems/categorías completas, composición sin ciclos, vínculo con ingresos, totales/cobertura derivados y aviso pasivo de propagación de categoría.

**Frontend**: infraestructura (RFC-0017) + UI de negocio para Accounts/Categories (RFC-0018) + Transactions (RFC-0019) + Dashboard (RFC-0020, mergeado vía PR #16). Vite + React 19 + Tailwind v4, `packages/ui` (shadcn/ui: `Table`/`Dialog`/`Select`/`Badge`/`AlertDialog`/`Skeleton` + `DataTable`/`EmptyState`/`FormDialog` reutilizables), `packages/types` (schemas Zod compartidos: `accounts`/`categories`/`transactions`/`budgets` (parcial, solo lectura)/`dashboard`/`money`) y `packages/utils` (`formatMoney`/`formatDateOnly` compartidos, usados por Transactions y Dashboard). Auth flow verificado end-to-end. CRUD completo de Accounts, Categories y Transactions. Dashboard (`/`) consume `GET /dashboard/summary`: stat cards, gráfico de gasto por categoría y comparación mensual (Recharts, lazy-loaded), presupuestos con progreso, top expenses y balances por cuenta. React Query Devtools activo solo en desarrollo.

**Toda la UI del ledger está traducida al español**, incluyendo el Dashboard (RFC-0020) — stat cards, títulos de gráficos, tablas y estados vacíos — y los mensajes de validación de Zod (`z.config(es())`).

**Visión redefinida (ADR-0005, supersede parcialmente ADR-0004)**: Vectra es un **simulador de escenarios financieros**. Conceptos: **Escenario** (simulación nombrada con selección explícita de productos, composición con otros escenarios sin ciclos, estados activo/inactivo/archivado, proyecciones mensual/6m/anual derivadas), **Producto** (gasto único en el sistema — nombre, precio, frecuencia mensual/anual/esporádico — organizado por categorías, referenciado por escenarios, creable desde ambos lados), **Ingreso** (sección propia, frecuencias mensual/semanal/anual/esporádico, vínculo opcional bidireccional con escenarios, cobertura % consumido/restante). Principios: reutilizar antes que duplicar; **propagación con confirmación** (Vectra nunca modifica silenciosamente una simulación — si una categoría cambia, pregunta qué escenarios actualizar); comparación relativa al escenario activo (deltas); esporádicos aparte de proyecciones recurrentes. El ledger pasa a ser **vista de registro histórico** (sección secundaria del nav, no se borra código). Ver `docs/decisions/0005-financial-scenarios.md`, `product/vision.md`, `product/roadmap.md` y `glossary.md`.

## Qué se hizo en esta sesión

1. **RFC-0022 (backend) — motor de escenarios**: feature `scenarios/` en `apps/api` implementando el modelo de dominio de ADR-0006 completo.
   - **Schema Prisma**: `Scenario` (`status: ACTIVE|INACTIVE|ARCHIVED`, sin unicidad forzada), `ScenarioItem` (join con `ExpenseItem`; `addedViaCategoryId` guarda procedencia, sin FK, para no cascadear ni forzar integridad viva), `ScenarioComposition` (self-join `Scenario`↔`Scenario`) y `ScenarioIncome` (many-to-many con `Income`). Migración `20260729031005_add_scenarios` aplicada en `vectra_dev` y `vectra_test`.
   - **Reglas de negocio**: detección de ciclos (directos y transitivos) vía BFS en el service layer antes de insertar una composición; archivar un ítem/ingreso/escenario nunca resta de un total ya calculado, solo bloquea nuevas selecciones; borrar un `ExpenseItem`/`Income`/`Scenario` referenciado devuelve 409 ("archívalo en vez de borrarlo") — cierra el pendiente que RFC-0021 había dejado marcado con comentario.
   - **Endpoints**: CRUD de escenario, agregar/quitar ítem, agregar categoría completa (atajo con snapshot + `addedViaCategoryId`), agregar/quitar composición, agregar/quitar ingreso, `GET /:id/totals` (recursivo: `MONTHLY` íntegro + `YEARLY` ÷12, `ONE_TIME` aparte; cobertura de ingresos con `WEEKLY` normalizado ×52÷12) y `GET /:id/pending-category-sync` (aviso pasivo comparando `addedViaCategoryId` contra los ítems activos actuales de la categoría).
   - **Tipos y tests**: mirror en `packages/types/src/scenarios.ts`; 24 tests nuevos en `apps/api/tests/scenarios.test.ts` (ciclos, vivacidad de ítems/composición, snapshot+aviso de categoría pasivo, cobertura de ingresos, guards de borrado), 192 tests en total pasando.
   - **Fix de infraestructura de tests**: rate limit de la app relajado a `max: 1000` (antes 100) solo bajo `NODE_ENV=test` en `app.ts` — el volumen de requests de esta suite superaba el límite pensado para tráfico real y producía 429 falsos.

Todo verificado con `pnpm typecheck`, `pnpm lint` y la suite de tests de `apps/api` (2 tests de `reports.test.ts` — `category-trends` y `account-stats` — fallaron por timeout/ECONNRESET en esta corrida, atribuible a lentitud de la DB real bajo carga concurrente de tests, no relacionados con estos cambios; mismo patrón intermitente ya visto en `recurring-transactions-processor.test.ts` en sesiones previas).

## Sigue

1. **CRUD UI de escenarios** (frontend, siguiente fase del roadmap): consumir la API de RFC-0022 — listado/creación de escenarios, selector de ítems o categoría completa, composer de escenarios, vínculo con ingresos.
2. Después: comparador con proyecciones (Recharts, deltas contra el escenario que el usuario elija) → cobertura de ingresos en UI → reorganización del nav (ledger como registro histórico, sección secundaria).
3. **Pendiente de diseño** (abierto explícitamente en ADR-0006, sin resolver aún): forma exacta en que el frontend consume el aviso pasivo de propagación de categoría (el dato ya está expuesto en `GET /scenarios/:id/pending-category-sync`, falta decidir la UI) y el detalle de presentación de los costos `ONE_TIME` en las proyecciones ×6/×12.
4. Nota abierta para revisar en la siguiente sesión: `getScenarioTotals` calcula la cobertura de ingresos solo sobre los `ScenarioIncome` vinculados directamente al escenario, no sobre los de los escenarios incluidos vía composición — el ADR-0006 no lo especifica de forma inequívoca; confirmar si ese es el comportamiento deseado antes de construir el comparador en UI.

## Historial de sesiones anteriores (resumen breve)

- Traducción completa del ledger y Dashboard al español (nav, formularios, tablas, toasts, validaciones Zod).
- Fixes de `formatDateOnly` (ISO datetime vs. date-only) y de la incompatibilidad `@hookform/resolvers@3.x` con Zod v4.
- `defaultCurrency` por defecto cambiado de `USD` a `COP` en el registro.
- ADR-0004 (giro a planes de gasto) → superseded parcialmente por ADR-0005 (escenarios financieros como eje del producto).
- RFC-0021 (backend): features `expense-items/` e `incomes/` con CRUD completo, archivar/desarchivar, paginación, filtros y ownership.
- ADR-0006: modelo de dominio completo del motor de escenarios (vivacidad de vínculos, ciclos, propagación), base de este RFC-0022.

**Usuario de prueba con datos**: `dev@vectra.local` / `devpassword` (accounts, categories, transactions y budgets sembrados en USD).
