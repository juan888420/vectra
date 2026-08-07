# Resumen del proyecto

> Se actualiza al final de cada sesión. Léelo primero para saber dónde retomar.

**Última actualización**: 2026-08-06 (sesión de cierre de RFC-0025: pasada completa de consistencia visual/UX sobre todo el módulo Escenarios — mini-cards de producto, unificación de "Desactualizado" entre Productos/Ingresos/Escenarios heredados, sidebar reescrito sobre tokens del sistema con sección "Archivados" y orden ACTIVO-primero, escenarios heredados con tarjeta compacta + diálogo de detalle, reutilización de `ProjectionStatCards`, y navegación automática al escenario recién creado. Ningún cambio de lógica de negocio ni de contrato de backend — solo presentación).

## Estado

**Backend**: completo para el ledger — auth (JWT + refresh), accounts, categories, transactions, budgets, recurring-transactions (con processor idempotente), dashboard y reports — y completo para el dominio de escenarios: expense-items, incomes (RFC-0021), scenarios (RFC-0022), sus endpoints `summary` (RFC-0023), eliminación de categorías con reasignación (RFC-0023.2) y el sistema de sincronización en el momento de editar (RFC-0023.3, ver abajo). Todo en `apps/api`. Nuevos registros usan `COP` como `defaultCurrency` por defecto (el usuario de prueba sembrado sigue en USD). CORS permite explícitamente `GET/HEAD/POST/PATCH/DELETE`.

**Escenarios (modelo)**: `Scenario` (estados `ACTIVE`/`INACTIVE`/`ARCHIVED`, default `INACTIVE`) con `ScenarioItem`/`ScenarioIncome` como snapshots explícitos de `ExpenseItem`/`Income` — el escenario nunca lee el recurso original en vivo, así que un cambio de precio nunca modifica una simulación en silencio (ADR-0005). `ScenarioComposition` permite escenario-en-escenario con detección de ciclos (BFS en service layer). Los `ScenarioItem` **sí** se heredan a través de la composición (agregado real); los `ScenarioIncome` **no** — un ingreso pertenece únicamente al escenario donde se vinculó.

**`ScenarioItem` snapshotea `categoryName` y `frequencyOverride`**:

- `categoryName: String` — el nombre de la categoría al momento de agregar el producto. Nunca se lee la categoría en vivo (ADR-0005); un rename en la categoría fuente se sincroniza **solo, sin diálogo ni decisión del usuario** vía `syncCategoryNameInScenarios`, porque es 100% visual y nunca mueve un total.
- `frequencyOverride: Boolean` — `true` cuando la frecuencia de ese `ScenarioItem` fue elegida a propósito para ese escenario (ej. simular un producto facturado anualmente ahí mientras el producto real sigue siendo mensual), en vez de copiada del `ExpenseItem` vivo. Se fija al agregar un producto desde "Desde categorías" con una frecuencia distinta a la original (`POST /scenarios/:id/items` acepta `frequency` opcional). Cuando está en `true`, `diffItemKinds` **excluye** la frecuencia de la detección de drift — nunca aparece como "Desactualizado" por esto, y ni `syncExpenseItemScenarios` ni `syncScenario` la pisan de vuelta a la del producto real al aplicar un cambio de precio.

**Las categorías no tienen apariencia almacenada**. No hay columna `icon` ni `categoryIcon`, ni vocabulario de iconos, ni picker. El color de una categoría se **deriva de su nombre** en el cliente (`apps/web/src/features/categories/category-color.ts`): hash djb2 sobre el nombre normalizado (trim + lowercase) contra una paleta cerrada de 8 tonos. Renombrar una categoría cambia su color, y eso es aceptable a propósito: el color sirve para distinguir de un vistazo, no es una identidad. La paleta excluye ámbar y rojo porque ámbar ya significa "Desactualizado" en una tarjeta de producto y rojo significa destructivo en el resto de la app.

**Sincronización en el momento de editar (RFC-0023.3)**: reemplaza por completo el sistema anterior de "revisar cambios acumulados" (banner permanente + lista con checkboxes). El flujo es preventivo, no acumulativo:

1. El `PATCH`/`archive`/`unarchive` de un producto o ingreso **siempre guarda**, sin bloquearse ni pedir confirmación previa.
2. En la misma operación, los cambios **visuales** (nombre del producto, nombre de la categoría, nombre del ingreso) se sincronizan solos en todos los snapshots no archivados — nunca generan pregunta, porque no mueven ningún total.
3. Después de guardar, la respuesta incluye `affectedScenarios`: los escenarios no archivados cuyo costo **sí** se movería (cambios financieros: precio, frecuencia sin `frequencyOverride`, archivado). Para productos incluye los escenarios padre por composición (`collectAncestorScenarioIds`, BFS ascendente); para ingresos no, porque la cobertura de un padre nunca lee los ingresos de un hijo.
4. Si la lista viene vacía, el flujo termina ahí. Si no, el frontend abre `ScenarioImpactDialog` — el recurso ya está guardado, el diálogo solo decide la sincronización.
5. "Aplicar ahora" → `POST /expense-items/:id/sync-scenarios` (o `/incomes/:id/sync-scenarios`). "No ahora" → ninguna llamada extra; esos escenarios quedan con `hasUpdates: true`.

**El diálogo dice qué va a cambiar, no solo cuántos escenarios**: la misma respuesta trae `changes`, un resumen agregado **por campo** derivado de los `diff*Kinds` que ya se calculaban (`summarizeItemImpact`/`summarizeIncomeImpact`). Sigue siendo todo-o-nada: sin checkboxes ni selección por cambio. Los snapshots afectados pueden discrepar sobre el valor viejo (el escenario A se sincronizó a 80.000 y el B sigue en 60.000), así que `from` es `number | null` y en ese caso se muestra solo el destino en vez de inventar un origen.

**El aviso "Cambios pendientes" del escenario también es descriptivo**, con el mismo describer que el diálogo — no dos implementaciones. Cada `ScenarioImpactChange` lleva `name` (del producto/ingreso) y `source: "expenseItem" | "income"`. Un único mapper en el backend, `toScenarioImpactChange`, convierte los `ScenarioChange` que ya calculaba `detectScenarioChanges` (infraestructura de RFC-0023.1, conservada) al mismo formato `ScenarioImpactChange` — dos rutas de cálculo, un solo formato de salida. `GET /scenarios/:id/summary` lo expone como `pendingChanges: ScenarioImpactChange[]`, derivado del mismo array que ya alimentaba `hasUpdates` (`hasUpdates: pendingChanges.length > 0`) — cero queries extra. En el frontend, `describeScenarioChange` (`apps/web/src/features/scenarios/describe-scenario-change.ts`) es la única función que convierte un cambio a texto en español; la usan tanto `ScenarioImpactDialog` como `ScenarioSummaryCards`.

**Nada derivado se almacena**: `hasUpdates` se calcula al vuelo (solo con cambios `kind: "financial"`, y devuelve `false` sin más para escenarios `ARCHIVED`). Se descartó explícitamente guardar un flag `hasPendingChanges` por ser el mismo patrón desincronizable que RFC-0023.1 vino a corregir.

**Escenarios archivados**: congelados a nivel de dominio. No entran en `affectedScenarios`, no se sincronizan, y su `summary` reporta `hasUpdates: false`. Al desarchivar se vuelve a comprobar desde cero (el cálculo es derivado, así que esto sale gratis). En el frontend ya no desaparecen del sidebar al archivarlos (ver "Qué se hizo").

**Botón "Actualizar" a nivel escenario**: `POST /scenarios/:id/sync` aplica de una vez todos los cambios financieros pendientes alcanzables (items propios + los de escenarios compuestos, ingresos propios), sin selección por ítem. Respeta `frequencyOverride`.

**Infraestructura `ScenarioChange` conservada**: la unión discriminada de 9 variantes (`ITEM_RENAMED`, `ITEM_CATEGORY_RENAMED`, `ITEM_PRICE_CHANGED`, `ITEM_FREQUENCY_CHANGED`, `ITEM_ARCHIVED`, `INCOME_RENAMED`, `INCOME_AMOUNT_CHANGED`, `INCOME_FREQUENCY_CHANGED`, `INCOME_ARCHIVED`) con su `kind: "visual" | "financial"`, los detectores (`CHANGE_DETECTORS`, `diffItemKinds`/`diffIncomeKinds`) y los endpoints `GET/POST /scenarios/:id/changes(/apply)` siguen existiendo. **Ninguna pantalla los consume hoy** — se mantienen como capacidad reutilizable. Los `diff*Kinds` siguen siendo la única fuente de verdad, compartida por el flag `outdated` por ítem, `hasUpdates` y todas las funciones de sync.

**Eliminado en sesiones previas**: el modelo `ScenarioCategoryWatch` (tabla, endpoints `category-watches`, relaciones), el tipo de cambio `NEW_ITEM_AVAILABLE`, y el sistema de iconos de categoría (columna `icon`/`categoryIcon`, vocabulario cerrado, picker). "Categoría completa" pasó a ser **solo una ayuda de selección**: expande la categoría en `ScenarioItem` individuales en el momento, sin mantener ninguna relación viva con ella. También se eliminó `ScenarioChangesDialog`.

**Endpoints `summary` por entidad (RFC-0023)**: `GET /categories/:id/summary`, `GET /expense-items/:id/summary` (+ en qué escenarios se usa), `GET /incomes/:id/summary`, y `GET /scenarios` enriquecido con `monthly` por fila. Todo el cómputo vive en el backend — `toMonthlyEquivalent`/`toProjection` en `packages/utils`.

**Frontend**: infraestructura (RFC-0017) + Accounts/Categories (RFC-0018) + Transactions (RFC-0019) + Dashboard (RFC-0020) + Productos/Ingresos (RFC-0021 UI) + Escenarios (RFC-0022 UI) + pantallas-pregunta (RFC-0023) + eliminación de categorías con reasignación (RFC-0023.2) + sincronización en el momento de editar (RFC-0023.3) + asistente de composición (RFC-0025, **cerrado** esta sesión tras una pasada de consistencia visual). Vite + React 19 + Tailwind v4, `packages/ui` (shadcn/ui + `DataTable`/`EmptyState`/`FormDialog`), `packages/types` (schemas Zod compartidos; módulo `scenario-impact.ts` separado de `scenarios.ts` para evitar un ciclo de imports con `expense-items`/`incomes`) y `packages/utils`.

**Navegación y pantallas**: la ruta de aterrizaje (`/`) es **Escenarios**. Nav primario: Escenarios, Categorías, Productos, Ingresos. Nav secundario, dropdown "Historial": Dashboard, Cuentas, Transacciones. `Budget` sigue existiendo, sin pantalla propia. No existe todavía una `ReportsPage` en el frontend.

- **Escenarios** (`/scenarios`): `ScenariosLayout` (master-detail persistente). El sidebar es colapsable (`localStorage` bajo `scenarios_sidebar_collapsed`) y **reescrito esta sesión sobre los tokens del sistema** (`bg-card`/`border`/`bg-accent`/`text-accent-foreground`/`text-primary`, `shadow-sm` a juego con `Card`) — antes usaba una paleta `slate`/`emerald` hardcodeada con gradientes y glow-shadows ajena al resto de la app. Trae los escenarios con `includeArchived: true` (un solo request) y los separa en dos secciones:
  - **Escenarios** (no archivados): orden de dos claves — el escenario con `status: "ACTIVE"` siempre encabeza la lista (aunque no sea el más reciente), y dentro de cada grupo (activo / inactivo) desempata por `updatedAt` descendente, así que crear, renombrar o desarchivar un escenario lo hace subir al tope de su grupo. Texto en `text-foreground` (contraste pleno) para distinguirse claramente de Archivados.
  - **Archivados**: solo se muestra si hay al menos uno; texto en `text-muted-foreground/60` (menor énfasis, mismo lenguaje visual — nada de tachado). Clic navega igual a `/scenarios/:id`; "Desarchivar" sigue viviendo en el dropdown del detalle, sin cambios de lógica.
  - Ambas secciones renderizan la misma fila (`ScenarioSidebarRow`, componente local no exportado) para no duplicar el markup — solo cambia el flag `muted`.
  - **Crear escenario navega directo al nuevo** (`ScenarioFormDialog`): tras `createScenario.mutateAsync`, `navigate(/scenarios/:id)` en vez de solo cerrar el diálogo — el escenario recién creado queda abierto y seleccionado en el sidebar sin que el usuario tenga que buscarlo. Renombrar sigue sin navegar.

  `ScenarioDetailPage`: `ScenarioSummaryCards` (ahora reutiliza `ProjectionStatCards` — el mismo trío mensual/6 meses/anual que usan Categorías/Productos/Ingresos, en vez de reimplementar tres `StatCard` con etiquetas propias; terminología unificada en toda la app) + `ScenarioItemsSection` + `ScenarioIncomesSection` + `ScenarioCompositionsSection`, apiladas a ancho completo. `ScenarioItemsSection` es un asistente de 3 estados sin modales (`idle`/`browse`/`create`), montado con `key={scenario.id}` para que el estado del asistente no viaje de un escenario a otro (React Router no lo desmonta al cambiar de `:id`). El título de la tarjeta refleja el contexto: "Productos" en `idle`, "Productos · {categoría}" en `browse`/`create` con categoría elegida.
  - `idle`: rejilla de **mini-cards** (`ScenarioItemCard`, rediseñada esta sesión — `grid-cols-[repeat(auto-fill,minmax(6.5rem,1fr))]`, antes `8.5rem`, más columnas por fila). Sin alto fijo: el nombre reserva dos líneas y el grid estira cada tarjeta al alto de su fila, así el contenido queda centrado incluso con vecinos de distinto largo de nombre. Jerarquía: nombre (`text-xs font-medium`) → categoría (chip pequeño, menor énfasis) → **monto** (`text-sm font-bold tabular-nums`, lo más destacado de la tarjeta) → frecuencia (`text-[10px]` muted). El botón de quitar está oculto hasta hover/foco (siempre visible en touch vía `pointer-coarse:`).
  - `browse` (`ScenarioCategoryChips` + `ScenarioProductChecklist`): fila de chips de categoría con `flex-wrap` (más un chip "+ Nueva" para crear categoría inline) → productos con checkboxes animados. Un producto recién marcado (no uno ya incluido) gana un selector de frecuencia inline ("Original/Mensual/Anual/Esporádico") que viaja como `frequency` opcional al agregar. El chip seleccionado usa un tratamiento sutil (borde + fondo sólido de su color) — se probó una versión más marcada (borde grueso, mayor peso tipográfico) y se revirtió a pedido del usuario a favor de mostrar el contexto en el título de la tarjeta en vez de en el chip.
  - `create` (`ScenarioInlineProductForm`): mismos chips para elegir categoría, luego formulario de nombre/precio/frecuencia. El `useForm` vive en `ScenarioItemsSection`, no en el hijo, para que un desvío a "crear categoría" no borre lo ya tecleado.
  - **Crear categoría inline** (`ScenarioInlineCategoryForm`): tercer paso posible desde los chips en ambos flujos, sin modal — solo nombre, siempre `EXPENSE`. Al crear, selecciona la categoría automáticamente.
  - **"Desactualizado" unificado** (`ScenarioOutdatedIndicator.tsx`, nuevo esta sesión): un único borde/fondo ámbar (`scenarioRowClassName`) y un único punto indicador, compartidos ahora por `ScenarioItemCard`, las filas de `ScenarioIncomesSection` y las tarjetas de `ScenarioCompositionsSection`. Antes cada sección lo resolvía distinto (borde en los tiles, `Badge` de texto en las otras dos) — ya no.
  - **`ScenarioIncomesSection`**: filas con el mismo contenedor unificado (`rounded-xl`, mismo padding que las demás secciones) y sin el `text-emerald-600` hardcodeado que tenía el monto — ahora es texto neutro `font-semibold tabular-nums`, como en Productos y Escenarios heredados. La frecuencia se mantiene como `Badge` (categórico, no es lo mismo que "Desactualizado").
  - **`ScenarioCompositionsSection`** (rediseñada esta sesión): cada escenario heredado es una fila compacta (`ScenarioCompositionCard`) con nombre, total mensual — tomado gratis de `GET /scenarios` (ya trae `monthly` por fila), sin request extra — y cantidad de productos/ingresos (`useScenarioItems`/`useScenarioIncomes` sobre el `childScenarioId`, cacheados). Clic abre `ScenarioCompositionDetailDialog`: mensual, la misma rejilla de `ScenarioItemCard` en modo solo-lectura (`canEdit={false}`) para los productos — ya no una lista de texto —, lista de ingresos, y botón "Abrir escenario". Antes era un `<li>` con `Link` + `Badge` de texto plano, sin indicar cuánto pesaba ni qué contenía.

- **Categorías** (`/categories` → `/categories/:id`): responde "¿cuánto gasto en esta área?" + eliminar con reasignación de productos. `CategoryFormDialog` pide solo nombre y tipo.
- **Productos** (`/expense-items` → `/expense-items/:id`): "¿cuánto me cuesta mantener esto?" + en qué escenarios se usa.
- **Ingresos** (`/incomes` → `/incomes/:id`): "¿cuánto me genera esta fuente?", o "esporádico, sin proyección" si `ONE_TIME`.

**Toda la UI del ledger está traducida al español**, incluyendo mensajes de validación de Zod (`z.config(es())`).

**ADR-0005 / ADR-0006**: sin cambios. RFC-0023.3 y RFC-0025 se mantienen dentro de lo ya aceptado — la pasada de esta sesión fue exclusivamente de presentación (componentes, tokens, layout), sin tocar modelo, endpoints ni reglas de sincronización.

## Qué se hizo en esta sesión

Sesión de **cierre de RFC-0025**: a pedido del usuario, una auditoría y luego una pasada completa de consistencia visual/UX sobre todo el módulo Escenarios (Productos, Ingresos, Escenarios heredados, sidebar). Puramente presentación — sin cambios de modelo, endpoints ni reglas de negocio en ningún paso. Iterativa: cada pieza se implementó, se mostró, y se ajustó según feedback antes de seguir.

### 1. Auditoría inicial (sin código)

A pedido explícito, análisis de la UI de Escenarios completa antes de tocar nada: se identificaron el sidebar (paleta `slate`/`emerald` hardcodeada, ajena al resto de la app), la falta de unificación entre cómo Productos/Ingresos/Escenarios-compuestos mostraban "Desactualizado", y la duplicación de `ScenarioSummaryCards` frente a `ProjectionStatCards`. Se priorizó con el usuario antes de escribir código.

### 2. Escenarios heredados: de "solo el nombre" a tarjeta + diálogo

Iteró dos veces: primero una tarjeta con total mensual/6m/12m y lista completa inline (el usuario la encontró demasiado densa), después una tarjeta compacta (nombre, mensual, conteo de productos/ingresos, "Desactualizado") con el detalle completo movido a `ScenarioCompositionDetailDialog` (divulgación progresiva). El diálogo se simplificó a pedido: se quitó el trío de métricas 6m/12m ("no quiero un dashboard, quiero algo informativo") y se dejó solo el total mensual + listas.

### 3. Pasada completa de consistencia (RFC-0025 close-out)

- **`ScenarioOutdatedIndicator.tsx`** (nuevo): borde/fondo ámbar + punto compartidos por las tres secciones — antes cada una lo resolvía distinto.
- **`ScenarioSummaryCards`** pasó a reutilizar `ProjectionStatCards` en vez de reimplementar el trío de stats con etiquetas propias ("Total mensual"/"Proyección a 6 meses" → "Mensual"/"6 meses"/"Anual", igual que en Categorías/Productos/Ingresos).
- **`ScenarioIncomesSection`**: filas unificadas al mismo contenedor y tratamiento de "Desactualizado"; se quitó el `text-emerald-600` hardcodeado del monto (color sin significado semántico).
- **Sidebar (`ScenariosLayout.tsx`) reescrito por completo** sobre los tokens del sistema (`bg-card`/`border`/`accent`/`primary`), sin gradientes ni glow-shadows.

### 4. Mini-cards de producto

`ScenarioItemCard` rediseñada: de tile de ~144px con contenido alineado a la izquierda a mini-card compacta y centrada (nombre → categoría → **monto en negrita**, lo más destacado), sin alto fijo (el grid estira cada tarjeta a la altura de su fila). Grid más denso (`minmax(6.5rem,1fr)`, antes `8.5rem`). Reutilizada tal cual, en modo solo-lectura, dentro de `ScenarioCompositionDetailDialog` — evita una segunda implementación de "cómo se ve un producto".

### 5. Dos mejoras de flujo

- **Crear escenario navega al recién creado** (`ScenarioFormDialog`): antes solo cerraba el diálogo y dejaba al usuario donde estuviera.
- **Sidebar: escenarios archivados ya no desaparecen.** Antes, archivar un escenario lo sacaba por completo del sidebar (la query por defecto excluye `ARCHIVED`). Ahora el sidebar pide `includeArchived: true` y separa en dos secciones — "Escenarios" (activos/inactivos) y "Archivados" (solo si hay alguno, texto atenuado `text-muted-foreground/60`, sin tachado). Orden de la sección principal, de dos claves: el escenario `ACTIVE` siempre primero, y dentro de cada grupo por `updatedAt` descendente — así lo recién creado/editado/desarchivado sube, pero nunca por encima del escenario globalmente activo. Fila compartida (`ScenarioSidebarRow`) entre ambas secciones. De paso, se subió el contraste del texto de la sección principal (`text-foreground`, antes `text-muted-foreground`) para que se distinga con claridad de Archivados — sin colores nuevos, solo tokens ya existentes.

### Verificación en cada paso

`tsc --noEmit`, `eslint` y `prettier --check`/`--write` en verde tras cada cambio, sobre `apps/web`. **Ningún paso incluyó verificación visual en navegador** — no se usó Playwright ni ningún navegador esta sesión (a diferencia de la sesión anterior, que sí lo usó para el bug del "primer clic"). Todo lo construido esta sesión queda pendiente de esa verificación.

## Sigue — próximos pasos y mejoras

### Pendiente inmediato

1. **Validación visual manual en navegador de todo lo construido esta sesión** — nada de lo de hoy se vio en un navegador real:
   - Sidebar: contraste real activos/archivados, densidad y legibilidad de la sección "Archivados" con varios escenarios, comportamiento colapsado/expandido en ambos temas.
   - Mini-cards de producto: nombres largos, montos con muchos dígitos, que el grid más denso (`6.5rem`) no se sienta apretado con categorías de nombre largo.
   - `ScenarioCompositionDetailDialog`: que el grid de mini-cards respire dentro del diálogo (`sm:max-w-lg`), y que la lista de ingresos (sin rediseñar, fuera de alcance de esta sesión) no desentone visualmente al lado del grid de productos.
   - Flujo completo: crear un escenario y confirmar que navega y queda seleccionado; archivar/desarchivar y confirmar el movimiento entre secciones del sidebar y el reordenamiento.
2. **Validación visual pendiente de sesiones anteriores, todavía sin confirmar**:
   - Densidad de los chips de categoría con datos reales, y que los 8 colores se distingan bien (pares más cercanos: teal/cyan y blue/indigo).
   - Que un nombre largo de categoría no rompa el chip ni el badge de la mini-card.
   - Modo claro y oscuro para la paleta de categorías.
   - Golden path de RFC-0023.3: rename sin diálogo, cambio de precio con diálogo + "Cambios pendientes", "Desactualizado" en escenarios compuestos, archivado, composición.

### Funcionalidad pendiente (analizada, no construida)

3. **Métricas "¿cuánto dinero me queda?" a 6 y 12 meses** — hoy `incomeCoverage.remainingMonthly` solo existe a nivel mensual.
4. **Propios vs. heredados en la lista de productos de un escenario compuesto** — `ScenarioItemsSection` (la pantalla del propio escenario) sigue mostrando solo los items propios (`listScenarioItems` no recorre la composición), aunque el total y el sync sí la recorren. Distinto del nuevo `ScenarioCompositionDetailDialog`, que sí muestra los productos propios del escenario heredado — ese es solo un preview de ese escenario, no resuelve esto.
5. **Comparador de escenarios** con deltas contra el escenario activo (ADR-0005 §12) — introduce Recharts. Candidato más alto en valor para la próxima sesión de features (no de pulido).
6. **Rediseño del Dashboard alrededor de escenarios** — sigue siendo el widget del ledger de siempre, en `/dashboard`.
7. **Editar la frecuencia de un producto ya incluido en un escenario** (no solo al agregarlo) — el selector inline solo aplica a productos recién marcados en "Desde categorías"; cambiar la de uno ya incluido requeriría una interacción propia, no construida.

### Deuda técnica / mejoras menores

8. **`framer-motion@11.15` es anterior a React 19** — causó el bug del "primer clic" de dos sesiones atrás (`AnimatePresence` externo, ya corregido). Si vuelve a aparecer algo raro con animaciones, migrar a `motion` v12 es el siguiente paso lógico. No urge.
9. **Playwright no está en el repo** — se usó desde el scratchpad de sesión dos sesiones atrás (`playwright-core` + canal `msedge`, sin descarga de navegadores) y resolvió un bug que la lectura de código no pudo. Esta sesión no lo usó (cero verificación visual). Vale la pena evaluarlo como `devDependency` real, sobre todo antes de la próxima sesión de pulido visual.
10. **`prisma migrate` no funciona en esta máquina** (`spawn UNKNOWN` del schema-engine). Toda migración futura necesita el rodeo manual (SQL directo + registro en `_prisma_migrations`), o arreglar el entorno. No se tocó el schema esta sesión.
11. **`getScenarioSummary` llama a `detectScenarioChanges` internamente** para derivar `hasUpdates` (una sola fuente de verdad en vez de duplicar la comparación) — suma consultas por cada carga de summary. Aceptable a esta escala.
12. **`GET /scenarios` con N consultas internas por fila** (una por escenario, para el `monthly` enriquecido) — mismo criterio. El sidebar y `ScenarioCompositionCard` dependen de este campo, así que el costo ahora se paga en más lugares.
13. **`ScenarioCompositionCard` dispara `useScenarioItems`/`useScenarioIncomes` por cada escenario heredado** (para el conteo de productos/ingresos en la tarjeta compacta) — N+1 en el cliente, aceptable con 1-3 composiciones típicas por escenario, mismo criterio que el resto del proyecto.
14. **No existe suite de tests en `apps/api`** — ningún `*.test.ts` en el repo.
15. **Los endpoints `/scenarios/:id/changes(/apply)` no tienen consumidor** — conservados como capacidad futura. Van varias sesiones sin uso; evaluar eliminarlos si sigue así.
16. **Coherencia visual del badge de categoría**: `CategoriesPage`/`CategoryDetailPage` y los listados de `ExpenseItemsPage` siguen mostrando la categoría como texto plano, no como el chip de color que ya usan Escenarios. No pedido explícitamente, pero es la inconsistencia visual más visible que queda fuera del módulo Escenarios.

### Decisiones de producto sin resolver (a propósito, no ahora)

17. Si `Budget`/`Reports` se mantienen a largo plazo, dado que Escenario + cobertura de Ingreso ya responden una versión más flexible de la misma pregunta.
18. Si los ingresos deberían agruparse por categoría en algún momento.

**Usuario de prueba con datos**: `dev@vectra.local` / `devpassword` (accounts, categories, transactions y budgets sembrados en USD). El escenario "Repro primer clic" (20 productos en Comida) sembrado hace dos sesiones para depurar el bug del primer clic puede seguir ahí — no se tocó esta sesión; bórralo si estorba.
