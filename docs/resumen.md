# Resumen del proyecto

> Se actualiza al final de cada sesión. Léelo primero para saber dónde retomar.

**Última actualización**: 2026-08-06 (sesión larga, dos partes: cierre final de RFC-0025 en Escenarios — badge de categoría, mini-cards para Ingresos y Escenarios incluidos —, y luego unificación visual de Categorías/Productos/Ingresos sobre ese mismo lenguaje de tarjetas: `ExpenseItemCard` como referencia, `CategoryCard` con fondo teñido por categoría, `IncomeCard` sin color en el monto. Se cerró el módulo Ingresos agregándole "Usado en estos escenarios" — el único cambio de superficie de API de la sesión, mínimo y simétrico a lo que ya existía para Productos — y el logo real de Vectra en el navbar. `DataTable` se retira de Categorías/Productos/Ingresos pero sigue viva en Transacciones/Cuentas/Dashboard).

## Estado

**Backend**: completo para el ledger — auth (JWT + refresh), accounts, categories, transactions, budgets, recurring-transactions (con processor idempotente), dashboard y reports — y completo para el dominio de escenarios: expense-items, incomes (RFC-0021), scenarios (RFC-0022), sus endpoints `summary` (RFC-0023), eliminación de categorías con reasignación (RFC-0023.2) y el sistema de sincronización en el momento de editar (RFC-0023.3, ver abajo). Todo en `apps/api`. Nuevos registros usan `COP` como `defaultCurrency` por defecto (el usuario de prueba sembrado sigue en USD). CORS permite explícitamente `GET/HEAD/POST/PATCH/DELETE`.

**Escenarios (modelo)**: `Scenario` (estados `ACTIVE`/`INACTIVE`/`ARCHIVED`, default `INACTIVE`) con `ScenarioItem`/`ScenarioIncome` como snapshots explícitos de `ExpenseItem`/`Income` — el escenario nunca lee el recurso original en vivo, así que un cambio de precio nunca modifica una simulación en silencio (ADR-0005). `ScenarioComposition` permite escenario-en-escenario con detección de ciclos (BFS en service layer). Los `ScenarioItem` **sí** se heredan a través de la composición (agregado real); los `ScenarioIncome` **no** — un ingreso pertenece únicamente al escenario donde se vinculó.

**`ScenarioItem` snapshotea `categoryName` y `frequencyOverride`**:

- `categoryName: String` — el nombre de la categoría al momento de agregar el producto. Nunca se lee la categoría en vivo (ADR-0005); un rename en la categoría fuente se sincroniza **solo, sin diálogo ni decisión del usuario** vía `syncCategoryNameInScenarios`, porque es 100% visual y nunca mueve un total.
- `frequencyOverride: Boolean` — `true` cuando la frecuencia de ese `ScenarioItem` fue elegida a propósito para ese escenario (ej. simular un producto facturado anualmente ahí mientras el producto real sigue siendo mensual), en vez de copiada del `ExpenseItem` vivo. Se fija al agregar un producto desde "Desde categorías" con una frecuencia distinta a la original (`POST /scenarios/:id/items` acepta `frequency` opcional). Cuando está en `true`, `diffItemKinds` **excluye** la frecuencia de la detección de drift — nunca aparece como "Desactualizado" por esto, y ni `syncExpenseItemScenarios` ni `syncScenario` la pisan de vuelta a la del producto real al aplicar un cambio de precio.

**Las categorías no tienen apariencia almacenada**. No hay columna `icon` ni `categoryIcon`, ni vocabulario de iconos, ni picker. El color de una categoría se **deriva de su nombre** en el cliente (`apps/web/src/features/categories/category-color.ts`): hash djb2 sobre el nombre normalizado (trim + lowercase) contra una paleta cerrada de 8 tonos. Renombrar una categoría cambia su color, y eso es aceptable a propósito: el color sirve para distinguir de un vistazo, no es una identidad. La paleta excluye ámbar y rojo porque ámbar ya significa "Desactualizado" en una tarjeta de producto y rojo significa destructivo en el resto de la app. Tres variantes por color: `soft` (badges/chips), `solid` (chip seleccionado), y `wash` (agregada esta sesión — fondo/borde de baja opacidad, sin tocar el color de texto, para teñir una tarjeta completa como identidad visual sin competir con su contenido; la usa `CategoryCard`). Este sistema de color ya no es exclusivo de Escenarios: `ExpenseItemCard` y `CategoryCard` lo reutilizan directamente (copiando la misma receta de clases, sin importar nada de `features/scenarios`).

**Sincronización en el momento de editar (RFC-0023.3)**: reemplaza por completo el sistema anterior de "revisar cambios acumulados" (banner permanente + lista con checkboxes). El flujo es preventivo, no acumulativo:

1. El `PATCH`/`archive`/`unarchive` de un producto o ingreso **siempre guarda**, sin bloquearse ni pedir confirmación previa.
2. En la misma operación, los cambios **visuales** (nombre del producto, nombre de la categoría, nombre del ingreso) se sincronizan solos en todos los snapshots no archivados — nunca generan pregunta, porque no mueven ningún total.
3. Después de guardar, la respuesta incluye `affectedScenarios`: los escenarios no archivados cuyo costo **sí** se movería (cambios financieros: precio, frecuencia sin `frequencyOverride`, archivado). Para productos incluye los escenarios padre por composición (`collectAncestorScenarioIds`, BFS ascendente); para ingresos no, porque la cobertura de un padre nunca lee los ingresos de un hijo.
4. Si la lista viene vacía, el flujo termina ahí. Si no, el frontend abre `ScenarioImpactDialog` — el recurso ya está guardado, el diálogo solo decide la sincronización.
5. "Aplicar ahora" → `POST /expense-items/:id/sync-scenarios` (o `/incomes/:id/sync-scenarios`). "No ahora" → ninguna llamada extra; esos escenarios quedan con `hasUpdates: true`.

**El diálogo dice qué va a cambiar, no solo cuántos escenarios**: la misma respuesta trae `changes`, un resumen agregado **por campo** derivado de los `diff*Kinds` que ya se calculaban (`summarizeItemImpact`/`summarizeIncomeImpact`). Sigue siendo todo-o-nada: sin checkboxes ni selección por cambio. Los snapshots afectados pueden discrepar sobre el valor viejo (el escenario A se sincronizó a 80.000 y el B sigue en 60.000), así que `from` es `number | null` y en ese caso se muestra solo el destino en vez de inventar un origen.

**El aviso "Cambios pendientes" del escenario también es descriptivo**, con el mismo describer que el diálogo — no dos implementaciones. Cada `ScenarioImpactChange` lleva `name` (del producto/ingreso) y `source: "expenseItem" | "income"`. Un único mapper en el backend, `toScenarioImpactChange`, convierte los `ScenarioChange` que ya calculaba `detectScenarioChanges` (infraestructura de RFC-0023.1, conservada) al mismo formato `ScenarioImpactChange` — dos rutas de cálculo, un solo formato de salida. `GET /scenarios/:id/summary` lo expone como `pendingChanges: ScenarioImpactChange[]`, derivado del mismo array que ya alimentaba `hasUpdates` (`hasUpdates: pendingChanges.length > 0`) — cero queries extra. En el frontend, `describeScenarioChange` (`apps/web/src/features/scenarios/describe-scenario-change.ts`) es la única función que convierte un cambio a texto en español; la usan tanto `ScenarioImpactDialog` como `ScenarioSummaryCards`.

**Nada derivado se almacena**: `hasUpdates` se calcula al vuelo (solo con cambios `kind: "financial"`, y devuelve `false` sin más para escenarios `ARCHIVED`). Se descartó explícitamente guardar un flag `hasPendingChanges` por ser el mismo patrón desincronizable que RFC-0023.1 vino a corregir.

**Escenarios archivados**: congelados a nivel de dominio. No entran en `affectedScenarios`, no se sincronizan, y su `summary` reporta `hasUpdates: false`. Al desarchivar se vuelve a comprobar desde cero (el cálculo es derivado, así que esto sale gratis). En el frontend no desaparecen del sidebar al archivarlos (sección "Archivados" propia).

**Botón "Actualizar" a nivel escenario**: `POST /scenarios/:id/sync` aplica de una vez todos los cambios financieros pendientes alcanzables (items propios + los de escenarios compuestos, ingresos propios), sin selección por ítem. Respeta `frequencyOverride`.

**Infraestructura `ScenarioChange` conservada**: la unión discriminada de 9 variantes (`ITEM_RENAMED`, `ITEM_CATEGORY_RENAMED`, `ITEM_PRICE_CHANGED`, `ITEM_FREQUENCY_CHANGED`, `ITEM_ARCHIVED`, `INCOME_RENAMED`, `INCOME_AMOUNT_CHANGED`, `INCOME_FREQUENCY_CHANGED`, `INCOME_ARCHIVED`) con su `kind: "visual" | "financial"`, los detectores (`CHANGE_DETECTORS`, `diffItemKinds`/`diffIncomeKinds`) y los endpoints `GET/POST /scenarios/:id/changes(/apply)` siguen existiendo. **Ninguna pantalla los consume hoy** — se mantienen como capacidad reutilizable. Los `diff*Kinds` siguen siendo la única fuente de verdad, compartida por el flag `outdated` por ítem, `hasUpdates` y todas las funciones de sync.

**Eliminado en sesiones previas**: el modelo `ScenarioCategoryWatch` (tabla, endpoints `category-watches`, relaciones), el tipo de cambio `NEW_ITEM_AVAILABLE`, y el sistema de iconos de categoría (columna `icon`/`categoryIcon`, vocabulario cerrado, picker). "Categoría completa" pasó a ser **solo una ayuda de selección**: expande la categoría en `ScenarioItem` individuales en el momento, sin mantener ninguna relación viva con ella. También se eliminó `ScenarioChangesDialog`.

**Endpoints `summary` por entidad (RFC-0023)**: `GET /categories/:id/summary`, `GET /expense-items/:id/summary` (+ en qué escenarios se usa), `GET /incomes/:id/summary` (**+ en qué escenarios se usa, agregado esta sesión** — mismo patrón que expense-items: `scenarioIncome.findMany` sobre `incomeId`, sin endpoint nuevo, la relación ya existía e indexada), y `GET /scenarios` enriquecido con `monthly` por fila. Todo el cómputo vive en el backend — `toMonthlyEquivalent`/`toProjection` en `packages/utils`.

**Frontend**: infraestructura (RFC-0017) + Accounts/Categories (RFC-0018) + Transactions (RFC-0019) + Dashboard (RFC-0020) + Productos/Ingresos (RFC-0021 UI) + Escenarios (RFC-0022 UI) + pantallas-pregunta (RFC-0023) + eliminación de categorías con reasignación (RFC-0023.2) + sincronización en el momento de editar (RFC-0023.3) + asistente de composición (RFC-0025, cerrado en sesión previa, con un último pulido esta sesión) + **esta sesión: unificación visual de Categorías/Productos/Ingresos sobre el lenguaje de tarjetas de Escenarios**, sin RFC propio (pedido ad hoc). Vite + React 19 + Tailwind v4, `packages/ui` (shadcn/ui + `DataTable` — ya solo la usan Transacciones/Cuentas/Dashboard — /`EmptyState`/`FormDialog`), `packages/types` (schemas Zod compartidos; módulo `scenario-impact.ts` separado de `scenarios.ts` para evitar un ciclo de imports con `expense-items`/`incomes` — mismo motivo por el que `incomeSummarySchema`/`expenseItemSummarySchema` duplican un enum local de 3 valores en vez de importarlo de `scenarios.ts`) y `packages/utils`.

**Navegación y pantallas**: la ruta de aterrizaje (`/`) es **Escenarios**. Nav primario: Escenarios, Categorías, Productos, Ingresos. Nav secundario, dropdown "Historial": Dashboard, Cuentas, Transacciones. `Budget` sigue existiendo, sin pantalla propia. No existe todavía una `ReportsPage` en el frontend. El header (`apps/web/src/app/Layout.tsx`) muestra el logo real de Vectra (`src/assets/vectra-logo.png`, PNG 1024×1024, `size-7 rounded-md`) junto al wordmark de texto, agregado esta sesión.

- **Escenarios** (`/scenarios`): `ScenariosLayout` (master-detail persistente). El sidebar es colapsable (`localStorage` bajo `scenarios_sidebar_collapsed`), reescrito sobre los tokens del sistema (`bg-card`/`border`/`bg-accent`/`text-accent-foreground`/`text-primary`, `shadow-sm` a juego con `Card`). Trae los escenarios con `includeArchived: true` (un solo request) y los separa en dos secciones:
  - **Escenarios** (no archivados): orden de dos claves — el escenario con `status: "ACTIVE"` siempre encabeza la lista (aunque no sea el más reciente), y dentro de cada grupo (activo / inactivo) desempata por `updatedAt` descendente. Texto en `text-foreground` (contraste pleno) para distinguirse claramente de Archivados.
  - **Archivados**: solo se muestra si hay al menos uno; texto en `text-muted-foreground/60` (menor énfasis, mismo lenguaje visual — nada de tachado). Clic navega igual a `/scenarios/:id`; "Desarchivar" sigue viviendo en el dropdown del detalle.
  - Ambas secciones renderizan la misma fila (`ScenarioSidebarRow`, componente local no exportado).
  - **Crear escenario navega directo al nuevo** (`ScenarioFormDialog`): tras `createScenario.mutateAsync`, `navigate(/scenarios/:id)` en vez de solo cerrar el diálogo.

  `ScenarioDetailPage`: `ScenarioSummaryCards` (reutiliza `ProjectionStatCards`, el mismo trío mensual/6 meses/anual que Categorías/Productos/Ingresos) + `ScenarioItemsSection` + `ScenarioIncomesSection` + `ScenarioCompositionsSection`, apiladas a ancho completo. `ScenarioItemsSection` es un asistente de 3 estados sin modales (`idle`/`browse`/`create`), montado con `key={scenario.id}`. El título de la tarjeta es simplemente **"Productos"** en los tres estados (esta sesión: se revirtió el subtítulo "Productos · {categoría}" del header); la categoría elegida se muestra como **`Badge variant="secondary"`** justo encima del checklist/formulario, dentro del área de trabajo — no como texto plano ni como subtítulo del header.
  - `idle`: rejilla de **mini-cards** (`ScenarioItemCard`, `grid-cols-[repeat(auto-fill,minmax(6.5rem,1fr))]`). Sin alto fijo: el nombre reserva dos líneas y el grid estira cada tarjeta al alto de su fila. Jerarquía: nombre (`text-xs font-medium`) → categoría (chip pequeño, menor énfasis) → **monto** (`text-sm font-bold tabular-nums`, lo más destacado) → frecuencia (`text-[10px]` muted). El botón de quitar está oculto hasta hover/foco (siempre visible en touch vía `pointer-coarse:`). El área tiene `min-h-40` para que agregar el primer producto no la haga "colapsar" de alto.
  - `browse` (`ScenarioCategoryChips` + `ScenarioProductChecklist`): fila de chips de categoría con `flex-wrap` (más un chip "+ Nueva") → productos con checkboxes animados. Un producto recién marcado gana un selector de frecuencia inline ("Original/Mensual/Anual/Esporádico") que viaja como `frequency` opcional al agregar.
  - `create` (`ScenarioInlineProductForm`): mismos chips para elegir categoría, luego formulario de nombre/precio/frecuencia. El `useForm` vive en `ScenarioItemsSection`, no en el hijo.
  - **Crear categoría inline** (`ScenarioInlineCategoryForm`): tercer paso posible desde los chips en ambos flujos, sin modal.
  - **"Desactualizado" unificado** (`ScenarioOutdatedIndicator.tsx`): un único borde/fondo ámbar (`scenarioRowClassName`) y un único punto indicador, compartidos por `ScenarioItemCard`, `ScenarioIncomeCard` y `ScenarioCompositionCard`.
  - **`ScenarioIncomesSection`**: ya no es una lista de filas — es un grid de **`ScenarioIncomeCard`** (nueva esta sesión, `grid-cols-[repeat(auto-fill,minmax(9rem,1fr))]`), misma familia visual que `ScenarioItemCard` pero más grande/aireada (`p-4`). Sin `text-emerald-600` hardcodeado en el monto — texto neutro `font-semibold tabular-nums`. Mismo `min-h-40` que Productos.
  - **`ScenarioCompositionsSection`**: tampoco es ya una lista de filas — **`ScenarioCompositionCard`** (rediseñada esta sesión de fila a mini-card centrada: nombre, total mensual — gratis de `GET /scenarios`, sin request extra —, cantidad de productos/ingresos, "Desactualizado", botón quitar flotante). Clic abre `ScenarioCompositionDetailDialog` (sin cambios ahí: mensual + grid de `ScenarioItemCard` solo-lectura para productos + lista de ingresos + botón "Abrir escenario"). Mismo `min-h-40`.
  - Las tres secciones (Productos/Ingresos/Escenarios incluidos) comparten ahora contenedor, tratamiento de "Desactualizado", jerarquía tipográfica y el patrón `min-h-40` — se perciben como un solo sistema.

- **Categorías** (`/categories` → `/categories/:id`): responde "¿cuánto gasto en esta área?" + eliminar con reasignación de productos. Lista como grid de **`CategoryCard`** (nueva esta sesión, reemplaza `DataTable`): nombre, badge de tipo teñido con el color de la categoría, mensual + cantidad de productos vía `useCategorySummary` propio por tarjeta (N+1 aceptado explícitamente por el usuario — misma escala que `ScenarioCompositionCard`, sin endpoint nuevo), y el fondo completo de la tarjeta teñido suavemente con ese mismo color (`category-color.ts`'s `wash`, `hover:brightness-95`/`dark:hover:brightness-110`). `CategoryDetailPage` reutiliza **`ExpenseItemCard`** en modo solo-lectura (`canEdit={false}`) para su lista de productos — ya no hay dos representaciones distintas de "cómo se ve un producto" en la app. `CategoryFormDialog` pide solo nombre y tipo.
- **Productos** (`/expense-items` → `/expense-items/:id`): "¿cuánto me cuesta mantener esto?" + en qué escenarios se usa. Lista como grid de **`ExpenseItemCard`** (nueva esta sesión, reemplaza `DataTable`) — la tarjeta de referencia visual para el resto de la app: nombre, badge de categoría con color derivado, monto en negrita, frecuencia, badge "Archivado", menú de 3 acciones (Editar/Archivar/Eliminar) oculto hasta hover, tarjeta completa como link de navegación al detalle. `canEdit` opcional (default `true`) para el modo solo-lectura que reutiliza `CategoryDetailPage`.
- **Ingresos** (`/incomes` → `/incomes/:id`): "¿cuánto me genera esta fuente?", o "esporádico, sin proyección" si `ONE_TIME` — **y ahora también "en qué escenarios se usa"** (`ScenarioUsageList`, agregado esta sesión). Lista como grid de **`IncomeCard`** (nueva esta sesión, reemplaza `DataTable`) — más grande/aireada que `ExpenseItemCard` (pocos ingresos típicamente), monto protagonista solo por tamaño y peso tipográfico (`text-xl font-bold`), **sin color**: decisión explícita para no reabrir el `text-emerald-600` que ya se había retirado de Escenarios por no tener significado semántico.
- **`ScenarioUsageList`** (`apps/web/src/components/`, nuevo): "en qué escenarios se usa", extraído del bloque que antes vivía inline en `ExpenseItemDetailPage` para no duplicarlo. Vive junto a `ProjectionStatCards` — fuera de ambas features (Productos/Ingresos), ninguna depende de la otra ni de `features/scenarios`. Reutilizado tal cual en `IncomeDetailPage`.

**Toda la UI del ledger está traducida al español**, incluyendo mensajes de validación de Zod (`z.config(es())`).

**ADR-0005 / ADR-0006**: sin cambios. RFC-0023.3 y RFC-0025 se mantienen dentro de lo ya aceptado. Esta sesión fue mayormente presentación (tarjetas, tokens, layout) en Escenarios/Categorías/Productos/Ingresos; el único cambio de superficie de API fue agregar `scenarios` a `GET /incomes/:id/summary` — simétrico a lo que ya existía para `expense-items`, misma pregunta de negocio (ADR-0006) respondida para el recurso al que le faltaba, no una regla nueva.

## Qué se hizo en esta sesión

Sesión larga, dos partes: cierre final de RFC-0025 en Escenarios (a pedido del usuario tras revisión visual), y luego unificación visual de Categorías/Productos/Ingresos sobre ese mismo lenguaje ("el módulo de Escenarios ya es el estándar de diseño"). Puramente presentación salvo un cambio de backend mínimo y simétrico (punto 5). Cerró con el logo de Vectra en el navbar.

### 1. Dos ajustes de UI en Escenarios, tras revisión visual del usuario

- El nombre de la categoría elegida en el asistente de Productos se movió del subtítulo del header al área de trabajo, como encabezado directo del checklist/formulario.
- `ScenarioCompositionsSection` ("Escenarios incluidos") ganó `min-h-40`, igual que Productos, para que no colapse de alto al pasar de vacía a un ítem.

### 2. Cierre final de RFC-0025

- **Badge gris de categoría**: el texto plano del punto 1 pasó a `Badge variant="secondary"`, reutilizando el componente existente.
- **`ScenarioIncomeCard`** (nuevo): mini-card de ingreso, misma familia que `ScenarioItemCard` pero más grande/aireada. `ScenarioIncomesSection` pasó de lista de filas a grid.
- **`ScenarioCompositionCard`** rediseñada de fila a mini-card centrada — el clic sigue abriendo `ScenarioCompositionDetailDialog`, sin cambios ahí.
- Las tres secciones del composer quedaron con el mismo contenedor, "Desactualizado" y `min-h-40`.

### 3. Unificación visual de Categorías/Productos/Ingresos

Precedida de un análisis explícito (sin código) para mapear qué reutilizar: `ExpenseItemCard` inspirada en `ScenarioItemCard`, `IncomeCard` en `ScenarioIncomeCard`, `CategoryCard` en `ScenarioCompositionCard` (tarjeta-resumen con número destacado). Decisión explícita del usuario: **cero imports desde `features/scenarios`** — mismo lenguaje visual, cero acoplamiento entre features. Implementado en el orden pedido (Productos primero, como referencia):

- **`ExpenseItemCard`** (nuevo): patrón "stretched link" (tarjeta completa como `Link`, botón de acciones flotante encima) adaptado del que ya usaba `ScenarioCompositionCard`.
- **`CategoryCard`** (nuevo): `useCategorySummary` propio por tarjeta para mensual + conteo de productos.
- **`IncomeCard`** (nuevo): monto protagonista sin color.
- `ExpenseItemsPage`/`CategoriesPage`/`IncomesPage`: `DataTable` → grid de la tarjeta correspondiente. Filtros, paginación, diálogos y hooks sin cambios.

### 4. Tres correcciones tras revisión del usuario

- **Falsa alarma investigada, no corregida**: el usuario reportó como regresión que `IncomeDetailPage` no mostraba "usado en escenarios". Confirmado por `git diff`/`git log` que esa sección **nunca existió** para Ingresos — no era algo que esta sesión hubiera roto. Resuelto de fondo en el punto 5.
- **`CategoryDetailPage`**: su lista de productos ahora reutiliza `ExpenseItemCard` en modo solo-lectura — se le agregó `canEdit?: boolean` (default `true`) para esto.
- **`CategoryCard` con fondo teñido**: `category-color.ts` ganó la variante `wash` (fondo/borde de baja opacidad, compatible con dark mode). `CategoryCard` la aplica a toda la tarjeta.

### 5. Cierre del módulo Ingresos: "Usado en estos escenarios"

Cambio de backend mínimo, sin endpoint nuevo: `getIncomeSummary` ahora también consulta `scenarioIncome.findMany({ where: { incomeId, scenario: { userId } } })` (relación ya existente e indexada). `incomeSummarySchema` gana `scenarios: {id, name, status}[]`. **`ScenarioUsageList`** (nuevo, `apps/web/src/components/`) extraído del bloque que antes vivía inline en `ExpenseItemDetailPage`, reutilizado tal cual en `IncomeDetailPage`.

### 6. Logo de Vectra en el navbar

`apps/web/src/assets/vectra-logo.png` agregado al header, junto al wordmark. Verificado en navegador (Edge headless vía `playwright-core`, mismo enfoque de sesiones anteriores) en ambos temas: carga bien, tamaño proporcionado, sin errores de consola relacionados.

### Verificación

`tsc --noEmit`, `eslint` y `prettier` en verde tras cada cambio, en `apps/web`, `apps/api` y `packages/types`. Verificación visual en navegador **solo** para el logo (punto 6) — todo lo demás (puntos 1-5) sigue sin verse en un navegador real.

## Sigue — próximos pasos y mejoras

### Pendiente inmediato

1. **Validación visual manual en navegador — superficie mucho más grande que antes**, nada de esta sesión se vio en un navegador real salvo el logo:
   - Escenarios: badge gris de categoría en el asistente de Productos; `ScenarioIncomeCard`/`ScenarioCompositionCard` como grids (densidad, nombres largos, ambos temas).
   - Categorías/Productos/Ingresos: los tres grids nuevos con datos reales — sobre todo el menú "..." dentro de una tarjeta clicable (`ExpenseItemCard`/`CategoryCard`/`IncomeCard`): confirmar que abrir el menú nunca dispara la navegación al detalle (riesgo señalado explícitamente al implementarlo).
   - `CategoryCard`: contraste del `wash` en modo oscuro con los 8 colores de la paleta, sobre todo los pares más cercanos (teal/cyan, blue/indigo).
   - `CategoryDetailPage` con la nueva grid de `ExpenseItemCard` de solo lectura; `IncomeDetailPage` con la nueva sección "Usado en estos escenarios".
   - Sidebar de Escenarios (contraste activos/archivados, colapsado/expandido) y `ScenarioCompositionDetailDialog` — pendientes de sesiones previas, todavía sin confirmar.
2. **Golden path de RFC-0023.3** (pendiente de sesiones previas): rename sin diálogo, cambio de precio con diálogo + "Cambios pendientes", "Desactualizado" en escenarios compuestos, archivado, composición.

### Funcionalidad pendiente (analizada, no construida)

3. **Otra pasada para unificar visualmente los detalles** (`CategoryDetailPage`/`ExpenseItemDetailPage`/`IncomeDetailPage`): headers, stat cards y el resto de cada página siguen con el estilo de RFC-0023 original — fuera de alcance a propósito esta sesión (solo se tocó la sub-lista de productos dentro de `CategoryDetailPage`). El propio usuario anticipó que sería "otra pasada".
4. **Métricas "¿cuánto dinero me queda?" a 6 y 12 meses** — hoy `incomeCoverage.remainingMonthly` solo existe a nivel mensual.
5. **Propios vs. heredados en la lista de productos de un escenario compuesto** — `ScenarioItemsSection` (la pantalla del propio escenario) sigue mostrando solo los items propios (`listScenarioItems` no recorre la composición), aunque el total y el sync sí la recorren.
6. **Comparador de escenarios** con deltas contra el escenario activo (ADR-0005 §12) — introduce Recharts. Candidato más alto en valor para la próxima sesión de features (no de pulido).
7. **Rediseño del Dashboard alrededor de escenarios** — sigue siendo el widget del ledger de siempre, en `/dashboard`.
8. **Editar la frecuencia de un producto ya incluido en un escenario** (no solo al agregarlo).

### Deuda técnica / mejoras menores

9. **`framer-motion@11.15` es anterior a React 19** — causó el bug del "primer clic" de varias sesiones atrás, ya corregido. No urge migrar a `motion` v12 salvo que reaparezca algo raro con animaciones.
10. **Playwright no está en el repo** — se volvió a usar esta sesión desde el scratchpad (`playwright-core` + canal `msedge`, sin descarga de navegadores), tercera vez que resuelve una verificación que la lectura de código no puede. Vale la pena evaluarlo como `devDependency` real dado el uso repetido.
11. **`prisma migrate` no funciona en esta máquina** (`spawn UNKNOWN` del schema-engine). Toda migración futura necesita el rodeo manual (SQL directo + registro en `_prisma_migrations`), o arreglar el entorno. No se tocó el schema esta sesión (el cambio de Ingresos fue solo de consulta, no de modelo).
12. **`getScenarioSummary` llama a `detectScenarioChanges` internamente** para derivar `hasUpdates` — suma consultas por cada carga de summary. Aceptable a esta escala.
13. **`GET /scenarios` con N consultas internas por fila** (una por escenario, para el `monthly` enriquecido) — el sidebar y `ScenarioCompositionCard` dependen de este campo.
14. **N+1 en el cliente, mismo criterio en varios lugares ahora**: `ScenarioCompositionCard` (conteo de productos/ingresos por escenario heredado) y, desde esta sesión, `CategoryCard` (mensual + conteo de productos por categoría vía `useCategorySummary`). Aceptable con la cantidad típica de filas por página (1-3 composiciones, decenas de categorías), mismo criterio que el resto del proyecto.
15. **No existe suite de tests en `apps/api`** — ningún `*.test.ts` en el repo.
16. **Los endpoints `/scenarios/:id/changes(/apply)` no tienen consumidor** — conservados como capacidad futura. Van varias sesiones sin uso; evaluar eliminarlos si sigue así.

### Decisiones de producto sin resolver (a propósito, no ahora)

17. Si `Budget`/`Reports` se mantienen a largo plazo, dado que Escenario + cobertura de Ingreso ya responden una versión más flexible de la misma pregunta.
18. Si los ingresos deberían agruparse por categoría en algún momento.

**Usuario de prueba con datos**: `dev@vectra.local` / `devpassword` (accounts, categories, transactions y budgets sembrados en USD). El escenario "Repro primer clic" (20 productos en Comida), sembrado hace varias sesiones para depurar el bug del primer clic, puede seguir ahí — no se tocó esta sesión; bórralo si estorba.
