# Resumen del proyecto

> Se actualiza al final de cada sesión. Léelo primero para saber dónde retomar.

**Última actualización**: 2026-07-30 (RFC-0023: Categorías/Productos/Ingresos/Escenarios como pantallas que responden preguntas, ADR-0006)

## Estado

**Backend**: completo para el ledger — auth (JWT + refresh), accounts, categories, transactions, budgets, recurring-transactions (con processor idempotente), dashboard y reports — y completo para el dominio de escenarios: expense-items, incomes (RFC-0021), scenarios (RFC-0022) y sus endpoints `summary` (RFC-0023). Todo en `apps/api`, con tests de integración (**179/179 pasando**). Nuevos registros usan `COP` como `defaultCurrency` por defecto (antes `USD`; el usuario de prueba sembrado sigue en USD, no se tocó).

**Escenarios (modelo, RFC-0022)**: `Scenario` (estados `ACTIVE`/`INACTIVE`/`ARCHIVED`) con `ScenarioItem`/`ScenarioIncome` como snapshots explícitos de `ExpenseItem`/`Income` — el escenario nunca lee el recurso original en vivo, así que un cambio de precio nunca modifica una simulación en silencio (ADR-0005). `ScenarioComposition` permite escenario-en-escenario con detección de ciclos (BFS en service layer, no SQL recursivo). `GET /scenarios/:id/summary` calcula, siempre derivado y nunca almacenado: totales mensual/6m/12m (prorrateo de `YEARLY` ÷12, `ONE_TIME` aparte), cobertura de ingresos (% consumido, restante) y `hasUpdates` (compara `lastSyncedAt` del snapshot contra el `updatedAt` del `ExpenseItem`/`Income`/categoría original; se propaga transitivamente a través de la composición). `deleteExpenseItem`/`deleteIncome` bloquean el borrado físico si un `ScenarioItem`/`ScenarioIncome` los referencia (archivar en su lugar).

**Endpoints `summary` por entidad (RFC-0023)**: `GET /categories/:id/summary` (totales + lista de productos), `GET /expense-items/:id/summary` (totales + en qué escenarios se usa), `GET /incomes/:id/summary` (totales, `null` si `ONE_TIME`), y `GET /scenarios` enriquecido con `monthly` por fila. Todo el cómputo (prorrateo, proyecciones) vive en el backend — `toMonthlyEquivalent`/`toProjection` están en `packages/utils`, compartidos por `apps/api` y cualquier pantalla futura que lo necesite. El endpoint de sincronización (aplicar un cambio de precio/nombre al snapshot cuando `hasUpdates` lo señala) sigue sin construirse — pospuesto a propósito.

**Frontend**: infraestructura (RFC-0017) + Accounts/Categories (RFC-0018) + Transactions (RFC-0019) + Dashboard (RFC-0020) + Productos/Ingresos (RFC-0021 UI) + Escenarios (RFC-0022 UI) + pantallas-pregunta y reorganización de navegación (RFC-0023). Vite + React 19 + Tailwind v4, `packages/ui` (shadcn/ui: `Table`/`Dialog`/`Select`/`Badge`/`AlertDialog`/`Skeleton`/`Card`/`DropdownMenu` + `DataTable`/`EmptyState`/`FormDialog` reutilizables), `packages/types` (schemas Zod compartidos por dominio, incluyendo los `*SummarySchema` de RFC-0023) y `packages/utils` (`formatMoney`/`formatDateOnly`/`toMonthlyEquivalent`/`toProjection`). Auth flow verificado end-to-end. React Query Devtools activo solo en desarrollo.

**Navegación y pantallas (post RFC-0023)**: la ruta de aterrizaje (`/`) es **Escenarios**, no el Dashboard. Nav primario: Escenarios, Categorías, Productos, Ingresos — cada uno responde una pregunta financiera (ADR-0006). Nav secundario, agrupado en un dropdown "Historial": Dashboard, Cuentas, Transacciones. `Budget` sigue existiendo (solo visible hoy dentro del Dashboard, sin pantalla propia); no se marcó como candidato a eliminar. No existe todavía una `ReportsPage` en el frontend (el backend de reports está listo desde RFC-0016, pero nunca se construyó su UI).

- **Escenarios** (`/scenarios`): ya no es una lista CRUD. `ScenariosLayout` es un layout master-detail persistente al estilo Linear/Notion — sidebar con todos los escenarios y su total mensual (calculado en backend, sin N+1) + panel de detalle a la derecha. `ScenariosIndexPage` (ruta índice `/scenarios`) auto-selecciona el escenario `ACTIVE` al entrar, o invita a crear el primero si no hay ninguno. `ScenarioDetailPage` es el panel de detalle: `ScenarioSummaryCards` (totales, cobertura de ingresos, esporádicos aparte, banner de "hay actualizaciones") + `ScenarioItemsSection`/`ScenarioIncomesSection` (elegir existente **o crear nuevo inline**, incluyendo categoría inline para productos) + `ScenarioCompositionsSection`.
- **Categorías** (`/categories` → `/categories/:id`): `CategoryDetailPage` responde "¿cuánto gasto en esta área?" — mensual/6m/anual + lista de productos + botón para crear un producto ya en esa categoría.
- **Productos** (`/expense-items` → `/expense-items/:id`): `ExpenseItemDetailPage` responde "¿cuánto me cuesta mantener esto?" — mensual/6m/anual + en qué escenarios se usa (link a cada uno).
- **Ingresos** (`/incomes` → `/incomes/:id`): `IncomeDetailPage` responde "¿cuánto me genera esta fuente?" — mensual/6m/anual, o el mensaje de "esporádico, sin proyección" si `ONE_TIME`. Sin agrupación por categoría (decisión explícita).

**Toda la UI del ledger está traducida al español**, incluyendo el Dashboard — stat cards, títulos de gráficos, tablas y estados vacíos — y los mensajes de validación de Zod (`z.config(es())`).

**ADR-0005 (escenarios como eje del producto)**: Vectra es un simulador de escenarios financieros. Conceptos: **Escenario**, **Producto**, **Ingreso**, con reutilización antes que duplicación, propagación con confirmación (nunca cambios silenciosos), comparación relativa al escenario activo (deltas, todavía no construido) y esporádicos aparte de proyecciones recurrentes. Ver `docs/decisions/0005-financial-scenarios.md`.

**ADR-0006 (interfaz orientada a preguntas, no a CRUD)**: cada pantalla principal responde una pregunta financiera concreta; las métricas derivadas son el contenido principal, crear/editar/archivar son acciones secundarias. No cambia el modelo de datos — es una decisión de interfaz, ya implementada por completo en RFC-0023. Ver `docs/decisions/0006-question-driven-interface.md`.

## Qué se hizo en esta sesión

**RFC-0023 completo** — Categorías, Productos, Ingresos y Escenarios transformados en pantallas que responden preguntas (ADR-0006), en el orden pedido (Categorías → Productos → Ingresos → Escenarios):

1. **Backend**: 3 endpoints `summary` nuevos —
   - `GET /categories/:id/summary` (`categories.service.ts`): suma los `ExpenseItem` activos de la categoría (mensual/6m/anual, `ONE_TIME` aparte).
   - `GET /expense-items/:id/summary` (`expense-items.service.ts`): totales del producto + lookup inverso de `ScenarioItem` para listar en qué escenarios se usa (el único caso que de verdad necesitaba backend nuevo — no hay forma de derivarlo en el cliente).
   - `GET /incomes/:id/summary` (`incomes.service.ts`): totales del ingreso, `null` si `ONE_TIME`.
   - `GET /scenarios` (list) enriquecido con `monthly` por fila — necesario para que el sidebar de Escenarios muestre el costo de cada uno sin una llamada por fila.
   - Refactor: `toMonthlyEquivalent`/`toProjection` (antes solo en `apps/api/src/features/scenarios/scenarios.projections.ts`) se movieron a `packages/utils/src/projections.ts`, para que backend y frontend compartan la misma fórmula en vez de duplicarla.
2. **Tests backend**: `apps/api/tests/categories.test.ts` (nuevo — Categories no tenía tests de integración hasta ahora) + casos nuevos en `expense-items.test.ts`/`incomes.test.ts`/`scenarios.test.ts`. **179/179 tests pasando**.
3. **Mirrors en `packages/types`**: `categorySummarySchema`, `expenseItemSummarySchema`, `incomeSummarySchema`, `scenarioListItemSchema`.
4. **Frontend — pantallas nuevas**: `CategoryDetailPage`, `ExpenseItemDetailPage`, `IncomeDetailPage`, todas usando el nuevo componente compartido `ProjectionStatCards` (mensual/6m/anual, reutilizando `StatCard` del Dashboard).
5. **Frontend — Escenarios rediseñado**: de lista `DataTable` a `ScenariosLayout` (layout master-detail persistente) + `ScenariosIndexPage` (auto-selección del escenario activo). `ScenariosPage.tsx` (la lista CRUD anterior) se eliminó por completo, ya no queda código muerto.
6. **Frontend — creación inline en el composer** (ADR-0005 §3, subida de prioridad en este RFC): `ScenarioItemsSection`/`ScenarioIncomesSection` ofrecen "Crear nuevo" además de "elegir existente"; `ExpenseItemFormDialog` ahora permite crear la categoría inline también (`CategoryFormDialog` ganó las props `forcedType`/`onCreated` para soportar este flujo anidado).
7. **Router y nav**: `/` → Escenarios (antes Dashboard, que se movió a `/dashboard`); nuevas rutas `/categories/:id`, `/expense-items/:id`, `/incomes/:id`; `Layout.tsx` con nav primario (Escenarios/Categorías/Productos/Ingresos) + dropdown "Historial" (Dashboard/Cuentas/Transacciones).
8. **Fix de regresión propia** (detectada y corregida en la misma sesión): `withProviders` en `apps/web/tests/test-utils.tsx` no envolvía en `MemoryRouter`, así que cualquier test que renderizara un `<Link>` (los nuevos links de nombre en las listas) rompía con "Cannot destructure property 'basename'". Corregido agregando `MemoryRouter`.
9. **Verificación**: `pnpm typecheck`/`lint`/`build` limpios en todo el monorepo. `apps/api` 179/179. `apps/web`: solo la falla preexistente de `DashboardPage.test.tsx` (ver más abajo) — nada nuevo roto (confirmado corriendo el test de Transactions también en aislamiento, que había dado un timeout limítrofe una vez pero pasó en la repetición). Smoke test en vivo contra un servidor real (`pnpm dev`) de los 3 endpoints `summary` nuevos y del `monthly` en la lista de escenarios.

**Antes de RFC-0023, en la misma sesión**: análisis de producto (sin código) que llevó a **ADR-0006** — se formalizó que las pantallas principales dejan de ser CRUDs y pasan a responder una pregunta financiera cada una, con las métricas derivadas como contenido principal. Decisiones cerradas ahí: ruta principal → Escenarios; ingresos sin agrupar por categoría; `Budget` se mantiene sin marcarlo para eliminar. `docs/decisions/0006-question-driven-interface.md` + `docs/README.md` (índice) actualizados en ese momento.

**Sesiones anteriores** (resumen, detalle en el historial de git): RFC-0022 backend de escenarios (13 tests, incluyó limpieza de un prototipo abandonado con diseño de "referencia viva" que nunca llegó a git); RFC-0021 backend de expense-items/incomes (24 tests); RFC-0020 Dashboard; traducción completa del ledger al español; ADR-0004/0005 documentando el giro de producto hacia escenarios; fixes de `formatDateOnly` (parseo de ISO datetime) y de incompatibilidad `@hookform/resolvers`+Zod v4.

## Sigue — próximos pasos y mejoras

**Ya no pendiente** (las 4 preguntas de ADR-0006 están respondidas end-to-end): Categorías, Productos, Ingresos y Escenarios ya muestran sus métricas derivadas como contenido principal.

### Bloqueante antes de seguir

1. **Validación visual manual en navegador** — no se pudo hacer en este sandbox (sin Chromium/Playwright/`chromium-cli`/Docker). Golden path sugerido:
   - Entrar a `/` → debe caer en el escenario activo, o en el estado vacío si no hay ninguno.
   - Crear una categoría → entrar a su detalle → crear un producto inline desde ahí.
   - Crear un escenario → agregar el producto (elegir existente) → probar también "Crear nuevo" inline (producto y categoría) desde el composer.
   - Crear un ingreso y vincularlo al escenario.
   - Confirmar que el sidebar de Escenarios muestra el mensual correcto y que se actualiza al agregar/quitar productos.
   - Editar el precio de un producto ya usado en un escenario y confirmar que aparece el badge "Desactualizado" (sin acción todavía, ver punto siguiente).

### Funcionalidad pendiente (ya identificada, sin construir)

2. **Endpoint y UI de sincronización**: aplicar el precio/nombre nuevo del `ExpenseItem`/`Income` al snapshot cuando `hasUpdates` lo señala. Pospuesto a propósito desde RFC-0022; con la creación inline ya construida, es la pieza que más se nota que falta.
3. **Agregar una categoría completa a un escenario** de una sola vez (ADR-0005 §7) — hoy el composer solo permite producto por producto.
4. **Comparador de escenarios** con deltas contra el escenario activo (ADR-0005 §12) — introduce Recharts.
5. **Rediseño del Dashboard alrededor de escenarios** — hoy sigue siendo el widget del ledger de siempre, solo se movió de lugar (`/dashboard`), no se rediseñó.

### Deuda técnica / mejoras menores

6. **Arreglar el test desactualizado** `apps/web/tests/features/dashboard/DashboardPage.test.tsx` (espera texto en inglés en una UI ya traducida al español) — preexistente, no bloqueante.
7. **Test de Transactions al límite del timeout** (`TransactionsPage.test.tsx`, ~10s en una corrida de este sandbox) — no es una regresión de esta sesión, pero vale la pena revisar si conviene subir el timeout o aligerar el test si se repite.
8. **`GET /scenarios` con N consultas internas por fila** (una por escenario, para el `monthly` enriquecido) — aceptable a la escala de un proyecto personal; revisar solo si con más escenarios se nota lento.

### Decisiones de producto sin resolver (a propósito, no ahora)

9. Si `Budget`/`Reports` se mantienen a largo plazo, dado que Escenario + cobertura de Ingreso ya responden una versión más flexible de la misma pregunta (ADR-0006 lo deja explícitamente sin decidir).
10. Si los ingresos deberían agruparse por categoría en algún momento (se descartó para RFC-0023, pero quedó como pregunta abierta en el análisis de producto previo a ADR-0006).

**Usuario de prueba con datos**: `dev@vectra.local` / `devpassword` (accounts, categories, transactions y budgets sembrados en USD).
