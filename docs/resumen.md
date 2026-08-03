# Resumen del proyecto

> Se actualiza al final de cada sesión. Léelo primero para saber dónde retomar.

**Última actualización**: 2026-08-03 (RFC-0023.3: diálogo de impacto descriptivo + resumen de "Cambios pendientes" en el escenario + badge "Desactualizado" en escenarios compuestos, todo con la misma semántica visual y sin duplicar lógica)

## Estado

**Backend**: completo para el ledger — auth (JWT + refresh), accounts, categories, transactions, budgets, recurring-transactions (con processor idempotente), dashboard y reports — y completo para el dominio de escenarios: expense-items, incomes (RFC-0021), scenarios (RFC-0022), sus endpoints `summary` (RFC-0023), eliminación de categorías con reasignación (RFC-0023.2) y el sistema de sincronización en el momento de editar (RFC-0023.3, ver abajo). Todo en `apps/api`. Nuevos registros usan `COP` como `defaultCurrency` por defecto (el usuario de prueba sembrado sigue en USD). CORS permite explícitamente `GET/HEAD/POST/PATCH/DELETE`.

**Escenarios (modelo)**: `Scenario` (estados `ACTIVE`/`INACTIVE`/`ARCHIVED`, default `INACTIVE`) con `ScenarioItem`/`ScenarioIncome` como snapshots explícitos de `ExpenseItem`/`Income` — el escenario nunca lee el recurso original en vivo, así que un cambio de precio nunca modifica una simulación en silencio (ADR-0005). `ScenarioComposition` permite escenario-en-escenario con detección de ciclos (BFS en service layer). Los `ScenarioItem` **sí** se heredan a través de la composición (agregado real); los `ScenarioIncome` **no** — un ingreso pertenece únicamente al escenario donde se vinculó.

**Sincronización en el momento de editar (RFC-0023.3, nuevo esta sesión)**: reemplaza por completo el sistema anterior de "revisar cambios acumulados" (banner permanente + lista con checkboxes). Ahora el flujo es preventivo, no acumulativo:

1. El `PATCH`/`archive`/`unarchive` de un producto o ingreso **siempre guarda**, sin bloquearse ni pedir confirmación previa.
2. En la misma operación, los cambios **visuales** (nombre del producto, nombre de categoría, nombre del ingreso) se sincronizan solos en todos los snapshots no archivados — nunca generan pregunta, porque no mueven ningún total. Renombrar una categoría hace lo mismo vía `syncCategoryNameInScenarios`.
3. Después de guardar, la respuesta incluye `affectedScenarios`: los escenarios no archivados cuyo costo **sí** se movería (cambios financieros: precio, frecuencia, archivado). Para productos incluye los escenarios padre por composición (`collectAncestorScenarioIds`, BFS ascendente, espejo del descendente que ya existía); para ingresos no, porque la cobertura de un padre nunca lee los ingresos de un hijo.
4. Si la lista viene vacía, el flujo termina ahí. Si no, el frontend abre `ScenarioImpactDialog` — el recurso ya está guardado, el diálogo solo decide la sincronización.
5. "Aplicar ahora" → `POST /expense-items/:id/sync-scenarios` (o `/incomes/:id/sync-scenarios`). "No ahora" → ninguna llamada extra; esos escenarios quedan con `hasUpdates: true`.

**El diálogo dice qué va a cambiar, no solo cuántos escenarios**: la misma respuesta trae `changes`, un resumen agregado **por campo** derivado de los `diff*Kinds` que ya se calculaban (`summarizeItemImpact`/`summarizeIncomeImpact`). Sigue siendo todo-o-nada: sin checkboxes ni selección por cambio. Los snapshots afectados pueden discrepar sobre el valor viejo (el escenario A se sincronizó a 80.000 y el B sigue en 60.000), así que `from` es `number | null` y en ese caso se muestra solo el destino en vez de inventar un origen.

**El aviso "Cambios pendientes" del escenario ahora también es descriptivo**, con el mismo describer que el diálogo — no dos implementaciones. Cada `ScenarioImpactChange` lleva `name` (del producto/ingreso) y `source: "expenseItem" | "income"` (para elegir "precio" vs. "ingreso" en el texto). Un único mapper en el backend, `toScenarioImpactChange`, convierte los `ScenarioChange` que ya calculaba `detectScenarioChanges` (la infraestructura de RFC-0023.1, conservada) al mismo formato `ScenarioImpactChange` que usan `summarizeItemImpact`/`summarizeIncomeImpact` — dos rutas de cálculo (una por-recurso-editado, otra por-escenario-completo), un solo formato de salida. `GET /scenarios/:id/summary` expone esto como `pendingChanges: ScenarioImpactChange[]`, derivado del mismo array que ya alimentaba `hasUpdates` (`hasUpdates: pendingChanges.length > 0`) — cero queries extra. En el frontend, `describeScenarioChange` (`apps/web/src/features/scenarios/describe-scenario-change.ts`) es la única función que convierte un cambio a texto en español; la usan tanto `ScenarioImpactDialog` como `ScenarioSummaryCards`. Un tipo de cambio nuevo que no tenga su caso en el `switch` exhaustivo rompe el build en las dos vistas a la vez, nunca en una sola.

**Nada derivado se almacena**: `hasUpdates` sigue calculándose al vuelo (ahora solo con cambios `kind: "financial"`, y devuelve `false` sin más para escenarios `ARCHIVED`). Se descartó explícitamente guardar un flag `hasPendingChanges` por ser el mismo patrón desincronizable que RFC-0023.1 vino a corregir.

**Escenarios archivados**: congelados. No entran en `affectedScenarios`, no se sincronizan, y su `summary` reporta `hasUpdates: false`. Al desarchivar se vuelve a comprobar desde cero (el cálculo es derivado, así que esto sale gratis) y el escenario reaparece como pendiente si su snapshot ya no coincide.

**Botón "Actualizar" a nivel escenario**: `POST /scenarios/:id/sync` aplica de una vez todos los cambios financieros pendientes alcanzables (items propios + los de escenarios compuestos, ingresos propios), sin selección por ítem ni checkboxes.

**Infraestructura `ScenarioChange` conservada**: la unión discriminada de 9 variantes (`ITEM_RENAMED`, `ITEM_CATEGORY_RENAMED`, `ITEM_PRICE_CHANGED`, `ITEM_FREQUENCY_CHANGED`, `ITEM_ARCHIVED`, `INCOME_RENAMED`, `INCOME_AMOUNT_CHANGED`, `INCOME_FREQUENCY_CHANGED`, `INCOME_ARCHIVED`) con su `kind: "visual" | "financial"`, los detectores (`CHANGE_DETECTORS`, `diffItemKinds`/`diffIncomeKinds`) y los endpoints `GET/POST /scenarios/:id/changes(/apply)` siguen existiendo. **Ninguna pantalla los consume hoy** — se mantienen como capacidad reutilizable para una feature futura que necesite el desglose campo por campo. Los `diff*Kinds` sí siguen siendo la única fuente de verdad, compartida por el flag `outdated` por ítem, `hasUpdates` y todas las funciones de sync.

**Eliminado esta sesión**: el modelo `ScenarioCategoryWatch` (tabla, endpoints `category-watches`, relaciones en `Scenario`/`Category`) y el tipo de cambio `NEW_ITEM_AVAILABLE`. "Categoría completa" en el composer pasó a ser **solo una ayuda de selección**: expande la categoría en `ScenarioItem` individuales en el momento, y el escenario no mantiene ninguna relación viva con ella — un producto creado ahí después no aparece ni pregunta nada. También se eliminó `ScenarioChangesDialog` del frontend.

**Endpoints `summary` por entidad (RFC-0023)**: `GET /categories/:id/summary`, `GET /expense-items/:id/summary` (+ en qué escenarios se usa), `GET /incomes/:id/summary`, y `GET /scenarios` enriquecido con `monthly` por fila. Todo el cómputo vive en el backend — `toMonthlyEquivalent`/`toProjection` en `packages/utils`.

**Frontend**: infraestructura (RFC-0017) + Accounts/Categories (RFC-0018) + Transactions (RFC-0019) + Dashboard (RFC-0020) + Productos/Ingresos (RFC-0021 UI) + Escenarios (RFC-0022 UI) + pantallas-pregunta (RFC-0023) + eliminación de categorías con reasignación (RFC-0023.2) + sincronización en el momento de editar (RFC-0023.3). Vite + React 19 + Tailwind v4, `packages/ui` (shadcn/ui + `DataTable`/`EmptyState`/`FormDialog`), `packages/types` (schemas Zod compartidos; nuevo módulo `scenario-impact.ts`, separado de `scenarios.ts` para evitar un ciclo de imports con `expense-items`/`incomes`) y `packages/utils`.

**Navegación y pantallas**: la ruta de aterrizaje (`/`) es **Escenarios**. Nav primario: Escenarios, Categorías, Productos, Ingresos. Nav secundario, dropdown "Historial": Dashboard, Cuentas, Transacciones. `Budget` sigue existiendo, sin pantalla propia. No existe todavía una `ReportsPage` en el frontend.

- **Escenarios** (`/scenarios`): `ScenariosLayout` (master-detail persistente, sidebar colapsable **pendiente**). `ScenarioDetailPage`: `ScenarioSummaryCards` (totales, cobertura de ingresos, esporádicos aparte, aviso **"Tiene cambios pendientes"** + botón **"Aplicar cambios pendientes"** solo cuando el usuario declinó sincronizar en su momento) + `ScenarioItemsSection` + `ScenarioIncomesSection` + `ScenarioCompositionsSection`.
- **Categorías** (`/categories` → `/categories/:id`): responde "¿cuánto gasto en esta área?" + eliminar con reasignación de productos.
- **Productos** (`/expense-items` → `/expense-items/:id`): "¿cuánto me cuesta mantener esto?" + en qué escenarios se usa.
- **Ingresos** (`/incomes` → `/incomes/:id`): "¿cuánto me genera esta fuente?", o "esporádico, sin proyección" si `ONE_TIME`.

**Toda la UI del ledger está traducida al español**, incluyendo mensajes de validación de Zod (`z.config(es())`).

**ADR-0005 / ADR-0006**: sin cambios. RFC-0023.3 se mantiene dentro de lo ya aceptado: ADR-0005 §8 exige que el usuario decida cuándo un cambio compartido afecta a otros escenarios, y eso se cumple — solo cambia _cuándo_ se pregunta (al guardar, no al abrir el escenario) y la granularidad (todo-o-nada por edición en vez de campo por campo, que el ADR planteaba como posibilidad, no obligación). ADR-0005 §7 ("categoría completa como selección inicial") queda intacto: lo que se quitó es el "seguimiento" persistente que RFC-0023.1 había añadido por su cuenta, que nunca estuvo en el ADR.

## Qué se hizo en esta sesión

Dos piezas, en el orden en que se pidieron.

### 1. RFC-0023.3 — sincronización en el momento de editar

### Diseño previo a código

El usuario pidió eliminar el sistema de avisos acumulados. Se acordó por preguntas puntuales, antes de escribir nada: solo los cambios financieros preguntan (los renames se sincronizan solos); crear un producto nuevo no dispara nada y `ScenarioCategoryWatch` se elimina (la categoría es ayuda de selección, no relación persistente); los escenarios padre por composición sí participan; los archivados quedan excluidos y se recomprueban al desarchivar; nada derivado se almacena. Un ajuste posterior del usuario corrigió el diseño inicial: el guardado nunca debe bloquearse esperando confirmación — se guarda siempre, y el diálogo solo decide la sincronización.

### Backend

- **Migración** `20260802090000_drop_scenario_category_watch`: `DROP TABLE scenario_category_watches` + sus FKs. Aplicada con `pnpm db:apply` (el binario de Prisma migrate sigue bloqueado por Windows App Control en esta máquina).
- **`scenarios.service.ts`**: `collectAncestorScenarioIds` (BFS ascendente nuevo), `resolveAffectedScenarios`, `reconcileExpenseItemScenarios`/`reconcileIncomeScenarios` (sincronizan lo visual + reportan el impacto financiero), `syncExpenseItemScenarios`/`syncIncomeScenarios`/`syncScenario` (re-detectan antes de aplicar, nunca confían en una lista del cliente; todo en transacción Prisma), `syncCategoryNameInScenarios`. Eliminados `detectNewItemsInWatchedCategories` y el CRUD de watches; `addScenarioCategory` ya no crea watch. `getScenarioSummary` filtra por `kind === "financial"` y corta en seco para archivados.
- **`expense-items`/`incomes`**: `updateX`/`archiveX`/`unarchiveX` pasan a devolver `{ data, affectedScenarios }` vía un `finalizeXWrite` compartido; nuevo `POST /:id/sync-scenarios` en ambos.
- **`categories.service.ts`**: `updateCategory` sincroniza el `categoryName` de los snapshots en cascada.
- **`lib/schemas.ts`**: `affectedScenarioSchema` + helper `withAffectedScenarios`.
- **`app.ts`**: el rate limiter global (100/min por IP) pasa a `global: false` bajo `NODE_ENV=test` — toda la suite comparte una IP y los tests nuevos la superaban. Los límites por ruta (auth, 10/min) siguen aplicando igual.

### Frontend

- **`ScenarioImpactDialog`** (nuevo, en `features/scenarios`): el diálogo "Este cambio modifica el costo de N escenarios", con la lista de nombres y los botones "Actualizar ahora" / "No ahora".
- **`use-scenario-impact.ts`** (nuevo): hook que recibe la función de sync del recurso y expone `report(id, scenarios)` + `dialogProps` — usado idéntico por productos e ingresos, en su página de detalle y en su listado.
- **`ExpenseItemFormDialog`/`IncomeFormDialog`**: nuevo prop `onEdited(id, affectedScenarios)`; el padre es dueño del diálogo.
- **`ScenarioSummaryCards`**: banner reescrito a "Tiene cambios pendientes" + botón "Actualizar" (antes: "Revisar cambios" con panel de checkboxes).
- **Eliminado**: `ScenarioChangesDialog`, `useScenarioChanges`, `useApplyScenarioChanges`, `useScenarioCategoryWatches`, `useRemoveScenarioCategoryWatch` y sus requests/keys.
- **`ScenarioItemsSection`**: "Categoría completa" ya no habla de seguir la categoría.

### 2. Diálogo descriptivo + resumen de "Cambios pendientes"

Pedido explícito de seguimiento: el diálogo debía decir _qué_ cambia (no solo cuántos escenarios), y el aviso "Tiene cambios pendientes" del escenario debía mostrar lo mismo, sin duplicar lógica de descripción y sin volver a checkboxes.

- `ScenarioImpactChange` (backend, `apps/api/src/lib/schemas.ts` + mirror en `packages/types/src/scenario-impact.ts`) ganó `name`/`source`.
- Nuevo mapper `toScenarioImpactChange` en `scenarios.service.ts` reutiliza `detectScenarioChanges` (la unión `ScenarioChange` de RFC-0023.1, hasta ahora sin consumidor) para producir el mismo formato que ya generaban `summarizeItemImpact`/`summarizeIncomeImpact`.
- `getScenarioSummary` expone `pendingChanges`, derivado del mismo array que `hasUpdates`.
- Frontend: `describeScenarioChange` (nuevo, `describe-scenario-change.ts`) es la única función de texto, usada por `ScenarioImpactDialog` (simplificado: ya no recibe `resourceName` como prop, lo deriva de `changes[0].name`) y por `ScenarioSummaryCards` (lista antes del botón).

### 3. Badge "Desactualizado" en escenarios compuestos

Pedido de seguimiento: dentro de "Escenarios incluidos" (`ScenarioCompositionsSection`), un escenario asociado con cambios financieros pendientes debe verse igual que un producto/ingreso desactualizado — mismo badge, sin desglose (el desglose sigue viviendo al abrir el escenario hijo).

- Nuevo helper `hasPendingFinancialChanges(prisma, userId, scenario)` en `scenarios.service.ts`, factorizado del mismo cálculo que ya usaba `getScenarioSummary` para `hasUpdates` (reutiliza `detectScenarioChanges`, excluye archivados). `listScenarioCompositions` lo llama por cada hijo y expone `outdated: boolean` en cada entrada.
- `scenarioCompositionPublicSchema` (api + types) gana el campo `outdated`.
- `ScenarioCompositionsSection.tsx` muestra el mismo `Badge` ámbar "Desactualizado" que ya usa `ScenarioItemsSection` para productos, junto al nombre del escenario incluido.

### Verificación

`tsc --noEmit` y `eslint` limpios en `apps/api`, `apps/web`, `packages/types`, `packages/ui` (los 3 warnings de `packages/ui` son preexistentes, en archivos no tocados). Hay un error de eslint preexistente en `ScenariosLayout.tsx` (`user` sin usar) de un trabajo en progreso ajeno a esta sesión (sidebar colapsable, ítem #3 del backlog) — no se tocó.

**Tests del dominio tocado: 59/59 en verde** (`scenarios` + `expense-items` + `incomes` + `categories`), con 13 tests de integración nuevos que cubren el flujo completo: rename de producto y de categoría sin preguntar, impacto reportado + sync bajo demanda, resumen `changes`/`pendingChanges` con `name`/`source`/from-to correctos, varios campos en un mismo guardado, `from: null` cuando los snapshots discrepan, producto archivado reportado como salida del escenario, propagación a escenarios padre por composición, exclusión de archivados y recomprobación al desarchivar, ingreso sincronizado solo cuando se pide, "categoría completa" sin relación persistente, un escenario con 4 cambios pendientes de tipos distintos listados en `pendingChanges`, y un escenario compuesto marcado `outdated` en la lista del padre que se limpia al sincronizar el hijo. De paso se corrigieron 2 tests que ya estaban desactualizados desde la sesión anterior (esperaban el default `ACTIVE` de escenario, cambiado a `INACTIVE`).

**Suite completa de API: 185-188/190 según la corrida.** Los 2-5 fallos que aparecen son **timeouts intermitentes** en `recurring-transactions-processor.test.ts` y `dashboard.test.ts` — archivos del ledger que esta sesión no tocó (`git status` limpio en ellos). El conjunto que falla cambia entre corridas y desaparece al subir el `testTimeout` (el test más lento tarda ~5.4s contra el default de 5s). No es acumulación de datos (la BD de dev tiene 9 usuarios / 15 transacciones); es carga de máquina. Queda anotado como deuda abajo.

**No se corrió el navegador** — ver "Sigue".

## Sigue — próximos pasos y mejoras

### Bloqueante antes de seguir

1. **Validación visual manual en navegador** — no se hizo (sin Chromium en este sandbox). Golden path para RFC-0023.3:
   - Renombrar un producto usado por un escenario → confirmar que **no** aparece ningún diálogo y que el nombre ya cambió dentro del escenario.
   - Renombrar una categoría usada por un producto de un escenario → mismo comportamiento, sin diálogo.
   - Cambiar el precio de un producto usado por 2+ escenarios → confirmar el diálogo con el conteo correcto y la línea "Producto: precio 80.000 → 100.000 COP" → "No ahora" → confirmar que esos escenarios muestran "Cambios pendientes" con **la misma línea de texto** arriba del botón "Aplicar cambios pendientes" → aplicar → confirmar que el total ya refleja el precio nuevo y el aviso desapareció.
   - Provocar varios tipos de cambio pendientes a la vez en un mismo escenario (precio, frecuencia, archivado, ingreso) → confirmar que las 4 líneas aparecen en el resumen, con "precio"/"frecuencia" para productos e "ingreso" para el ingreso.
   - Incluir un escenario B dentro de un escenario A ("Escenarios incluidos") → cambiar el precio de un producto de B y declinar la sincronización → confirmar que B aparece con el badge "Desactualizado" en la lista de A, sin ningún detalle ahí → sincronizar B (desde B o vía el botón "Aplicar cambios pendientes" de A) → confirmar que el badge desaparece.
   - Repetir eligiendo "Actualizar ahora" → confirmar que el total cambia al instante y no queda ningún aviso.
   - Archivar un producto usado en un escenario → "Actualizar ahora" → confirmar que sale del escenario.
   - Editar un producto de un escenario hijo → confirmar que el escenario padre también aparece en la lista del diálogo.
   - Archivar un escenario → editar un producto que usaba → confirmar que no aparece en el diálogo → desarchivarlo → confirmar que ahí sí queda "Tiene cambios pendientes".
   - "Categoría completa" → crear un producto nuevo en esa categoría → confirmar que el escenario **no** se entera de nada.

### Funcionalidad pendiente (analizada, no construida)

2. **Selector de productos escalable** — sigue siendo un `<Select>` plano sin búsqueda ni agrupación por categoría. El usuario ya pidió explícitamente agrupación por categoría + opción "seleccionar toda la categoría" dentro del selector (hoy "Categoría completa" es un botón/diálogo aparte).
3. **Panel lateral de Escenarios colapsable** — `ScenariosLayout` sigue sin poder cerrarse.
4. **Métricas "¿cuánto dinero me queda?" a 6 y 12 meses** — hoy `incomeCoverage.remainingMonthly` solo existe a nivel mensual.
5. **Propios vs. heredados en la lista de productos de un escenario compuesto** — `ScenarioItemsSection` sigue mostrando solo los items propios (`listScenarioItems` no recorre la composición), aunque el total y el sync sí la recorren.
6. **Comparador de escenarios** con deltas contra el escenario activo (ADR-0005 §12) — introduce Recharts.
7. **Rediseño del Dashboard alrededor de escenarios** — sigue siendo el widget del ledger de siempre, en `/dashboard`.

### Deuda técnica / mejoras menores

8. **`getScenarioSummary` llama a `detectScenarioChanges` internamente** para derivar `hasUpdates` (una sola fuente de verdad en vez de duplicar la comparación) — suma consultas por cada carga de summary. Aceptable a esta escala; revisar si se nota lento.
9. **`GET /scenarios` con N consultas internas por fila** (una por escenario, para el `monthly` enriquecido) — mismo criterio.
10. **Arreglar `apps/web/tests/features/dashboard/DashboardPage.test.tsx`** — 4 tests fallando porque esperan texto en inglés en una UI ya traducida. Preexistente, no bloqueante, no tocado esta sesión (el resto de la suite web pasa: 5 archivos, 7 tests).

11. **Timeouts intermitentes en la suite de API** — 2-4 tests de `recurring-transactions-processor.test.ts` y `dashboard.test.ts` fallan por timeout de forma no determinista bajo carga; el más lento tarda ~5.4s contra el default de 5s de Vitest. Pasan todos al correrlos con `--testTimeout=30000`. Opciones: subir el `testTimeout` global en `vitest.config`, o investigar por qué el catch-up del processor tarda segundos con una BD casi vacía (podría ser una consulta ineficiente que sí importa en producción). Lo segundo es más valioso pero más largo.
12. **Los endpoints `/scenarios/:id/changes(/apply)` no tienen consumidor** — conservados a propósito como capacidad futura. Si en 2-3 sesiones nada los usa, evaluar eliminarlos.

### Decisiones de producto sin resolver (a propósito, no ahora)

13. Si `Budget`/`Reports` se mantienen a largo plazo, dado que Escenario + cobertura de Ingreso ya responden una versión más flexible de la misma pregunta.
14. Si los ingresos deberían agruparse por categoría en algún momento.

**Usuario de prueba con datos**: `dev@vectra.local` / `devpassword` (accounts, categories, transactions y budgets sembrados en USD).
