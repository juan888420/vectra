# Resumen del proyecto

> Se actualiza al final de cada sesión. Léelo primero para saber dónde retomar.

**Última actualización**: 2026-08-05 (sesión doble: se eliminó por completo el sistema de iconos de categorías y se reemplazó por chips/badges de color derivado del nombre; y se encontró y corrigió, con evidencia de Playwright, el bug del "primer clic" que venía abierto de dos sesiones — la causa era el `AnimatePresence` externo de `ScenarioItemsSection`, no los iconos ni el orden del clic).

## Estado

**Backend**: completo para el ledger — auth (JWT + refresh), accounts, categories, transactions, budgets, recurring-transactions (con processor idempotente), dashboard y reports — y completo para el dominio de escenarios: expense-items, incomes (RFC-0021), scenarios (RFC-0022), sus endpoints `summary` (RFC-0023), eliminación de categorías con reasignación (RFC-0023.2) y el sistema de sincronización en el momento de editar (RFC-0023.3, ver abajo). Todo en `apps/api`. Nuevos registros usan `COP` como `defaultCurrency` por defecto (el usuario de prueba sembrado sigue en USD). CORS permite explícitamente `GET/HEAD/POST/PATCH/DELETE`.

**Escenarios (modelo)**: `Scenario` (estados `ACTIVE`/`INACTIVE`/`ARCHIVED`, default `INACTIVE`) con `ScenarioItem`/`ScenarioIncome` como snapshots explícitos de `ExpenseItem`/`Income` — el escenario nunca lee el recurso original en vivo, así que un cambio de precio nunca modifica una simulación en silencio (ADR-0005). `ScenarioComposition` permite escenario-en-escenario con detección de ciclos (BFS en service layer). Los `ScenarioItem` **sí** se heredan a través de la composición (agregado real); los `ScenarioIncome` **no** — un ingreso pertenece únicamente al escenario donde se vinculó.

**`ScenarioItem` snapshotea `categoryName` y `frequencyOverride`**:

- `categoryName: String` — el nombre de la categoría al momento de agregar el producto. Nunca se lee la categoría en vivo (ADR-0005); un rename en la categoría fuente se sincroniza **solo, sin diálogo ni decisión del usuario** vía `syncCategoryNameInScenarios`, porque es 100% visual y nunca mueve un total.
- `frequencyOverride: Boolean` — `true` cuando la frecuencia de ese `ScenarioItem` fue elegida a propósito para ese escenario (ej. simular un producto facturado anualmente ahí mientras el producto real sigue siendo mensual), en vez de copiada del `ExpenseItem` vivo. Se fija al agregar un producto desde "Desde categorías" con una frecuencia distinta a la original (`POST /scenarios/:id/items` acepta `frequency` opcional). Cuando está en `true`, `diffItemKinds` **excluye** la frecuencia de la detección de drift — nunca aparece como "Desactualizado" por esto, y ni `syncExpenseItemScenarios` ni `syncScenario` la pisan de vuelta a la del producto real al aplicar un cambio de precio.

**Las categorías no tienen apariencia almacenada** (cambio de esta sesión, ver "Qué se hizo"). No hay columna `icon` ni `categoryIcon`, ni vocabulario de iconos, ni picker. El color de una categoría se **deriva de su nombre** en el cliente (`apps/web/src/features/categories/category-color.ts`): hash djb2 sobre el nombre normalizado (trim + lowercase) contra una paleta cerrada de 8 tonos. Renombrar una categoría cambia su color, y eso es aceptable a propósito: el color sirve para distinguir de un vistazo, no es una identidad. La paleta excluye ámbar y rojo porque ámbar ya significa "Desactualizado" en una tarjeta de producto y rojo significa destructivo en el resto de la app.

**Sincronización en el momento de editar (RFC-0023.3)**: reemplaza por completo el sistema anterior de "revisar cambios acumulados" (banner permanente + lista con checkboxes). El flujo es preventivo, no acumulativo:

1. El `PATCH`/`archive`/`unarchive` de un producto o ingreso **siempre guarda**, sin bloquearse ni pedir confirmación previa.
2. En la misma operación, los cambios **visuales** (nombre del producto, nombre de la categoría, nombre del ingreso) se sincronizan solos en todos los snapshots no archivados — nunca generan pregunta, porque no mueven ningún total.
3. Después de guardar, la respuesta incluye `affectedScenarios`: los escenarios no archivados cuyo costo **sí** se movería (cambios financieros: precio, frecuencia sin `frequencyOverride`, archivado). Para productos incluye los escenarios padre por composición (`collectAncestorScenarioIds`, BFS ascendente); para ingresos no, porque la cobertura de un padre nunca lee los ingresos de un hijo.
4. Si la lista viene vacía, el flujo termina ahí. Si no, el frontend abre `ScenarioImpactDialog` — el recurso ya está guardado, el diálogo solo decide la sincronización.
5. "Aplicar ahora" → `POST /expense-items/:id/sync-scenarios` (o `/incomes/:id/sync-scenarios`). "No ahora" → ninguna llamada extra; esos escenarios quedan con `hasUpdates: true`.

**El diálogo dice qué va a cambiar, no solo cuántos escenarios**: la misma respuesta trae `changes`, un resumen agregado **por campo** derivado de los `diff*Kinds` que ya se calculaban (`summarizeItemImpact`/`summarizeIncomeImpact`). Sigue siendo todo-o-nada: sin checkboxes ni selección por cambio. Los snapshots afectados pueden discrepar sobre el valor viejo (el escenario A se sincronizó a 80.000 y el B sigue en 60.000), así que `from` es `number | null` y en ese caso se muestra solo el destino en vez de inventar un origen.

**El aviso "Cambios pendientes" del escenario también es descriptivo**, con el mismo describer que el diálogo — no dos implementaciones. Cada `ScenarioImpactChange` lleva `name` (del producto/ingreso) y `source: "expenseItem" | "income"`. Un único mapper en el backend, `toScenarioImpactChange`, convierte los `ScenarioChange` que ya calculaba `detectScenarioChanges` (infraestructura de RFC-0023.1, conservada) al mismo formato `ScenarioImpactChange` — dos rutas de cálculo, un solo formato de salida. `GET /scenarios/:id/summary` lo expone como `pendingChanges: ScenarioImpactChange[]`, derivado del mismo array que ya alimentaba `hasUpdates` (`hasUpdates: pendingChanges.length > 0`) — cero queries extra. En el frontend, `describeScenarioChange` (`apps/web/src/features/scenarios/describe-scenario-change.ts`) es la única función que convierte un cambio a texto en español; la usan tanto `ScenarioImpactDialog` como `ScenarioSummaryCards`.

**Nada derivado se almacena**: `hasUpdates` se calcula al vuelo (solo con cambios `kind: "financial"`, y devuelve `false` sin más para escenarios `ARCHIVED`). Se descartó explícitamente guardar un flag `hasPendingChanges` por ser el mismo patrón desincronizable que RFC-0023.1 vino a corregir.

**Escenarios archivados**: congelados. No entran en `affectedScenarios`, no se sincronizan, y su `summary` reporta `hasUpdates: false`. Al desarchivar se vuelve a comprobar desde cero (el cálculo es derivado, así que esto sale gratis).

**Botón "Actualizar" a nivel escenario**: `POST /scenarios/:id/sync` aplica de una vez todos los cambios financieros pendientes alcanzables (items propios + los de escenarios compuestos, ingresos propios), sin selección por ítem. Respeta `frequencyOverride`.

**Infraestructura `ScenarioChange` conservada**: la unión discriminada de 9 variantes (`ITEM_RENAMED`, `ITEM_CATEGORY_RENAMED`, `ITEM_PRICE_CHANGED`, `ITEM_FREQUENCY_CHANGED`, `ITEM_ARCHIVED`, `INCOME_RENAMED`, `INCOME_AMOUNT_CHANGED`, `INCOME_FREQUENCY_CHANGED`, `INCOME_ARCHIVED`) con su `kind: "visual" | "financial"`, los detectores (`CHANGE_DETECTORS`, `diffItemKinds`/`diffIncomeKinds`) y los endpoints `GET/POST /scenarios/:id/changes(/apply)` siguen existiendo. **Ninguna pantalla los consume hoy** — se mantienen como capacidad reutilizable. Los `diff*Kinds` siguen siendo la única fuente de verdad, compartida por el flag `outdated` por ítem, `hasUpdates` y todas las funciones de sync.

**Eliminado en sesiones previas**: el modelo `ScenarioCategoryWatch` (tabla, endpoints `category-watches`, relaciones) y el tipo de cambio `NEW_ITEM_AVAILABLE`. "Categoría completa" pasó a ser **solo una ayuda de selección**: expande la categoría en `ScenarioItem` individuales en el momento, sin mantener ninguna relación viva con ella. También se eliminó `ScenarioChangesDialog`.

**Endpoints `summary` por entidad (RFC-0023)**: `GET /categories/:id/summary`, `GET /expense-items/:id/summary` (+ en qué escenarios se usa), `GET /incomes/:id/summary`, y `GET /scenarios` enriquecido con `monthly` por fila. Todo el cómputo vive en el backend — `toMonthlyEquivalent`/`toProjection` en `packages/utils`.

**Frontend**: infraestructura (RFC-0017) + Accounts/Categories (RFC-0018) + Transactions (RFC-0019) + Dashboard (RFC-0020) + Productos/Ingresos (RFC-0021 UI) + Escenarios (RFC-0022 UI) + pantallas-pregunta (RFC-0023) + eliminación de categorías con reasignación (RFC-0023.2) + sincronización en el momento de editar (RFC-0023.3) + asistente de composición (RFC-0025). Vite + React 19 + Tailwind v4, `packages/ui` (shadcn/ui + `DataTable`/`EmptyState`/`FormDialog`), `packages/types` (schemas Zod compartidos; módulo `scenario-impact.ts` separado de `scenarios.ts` para evitar un ciclo de imports con `expense-items`/`incomes`) y `packages/utils`.

**Navegación y pantallas**: la ruta de aterrizaje (`/`) es **Escenarios**. Nav primario: Escenarios, Categorías, Productos, Ingresos. Nav secundario, dropdown "Historial": Dashboard, Cuentas, Transacciones. `Budget` sigue existiendo, sin pantalla propia. No existe todavía una `ReportsPage` en el frontend.

- **Escenarios** (`/scenarios`): `ScenariosLayout` (master-detail persistente; el sidebar **sí** es colapsable, con el estado persistido en `localStorage` bajo `scenarios_sidebar_collapsed` — el resumen anterior lo daba por pendiente, era un error). `ScenarioDetailPage`: `ScenarioSummaryCards` (totales, cobertura de ingresos, esporádicos aparte, aviso "Tiene cambios pendientes" + botón "Aplicar cambios pendientes" solo cuando el usuario declinó sincronizar) + `ScenarioItemsSection` + `ScenarioIncomesSection` + `ScenarioCompositionsSection`, apiladas a ancho completo. `ScenarioItemsSection` es un asistente de 3 estados sin modales (`idle`/`browse`/`create`), montado con `key={scenario.id}` para que el estado del asistente no viaje de un escenario a otro (React Router no lo desmonta al cambiar de `:id`).
  - `idle`: rejilla de tarjetas tipo launcher (`ScenarioItemCard`, `grid-cols-[repeat(auto-fill,minmax(8.5rem,1fr))]`, tiles de ~144px): badge de color con el nombre de la categoría, nombre del producto, precio y frecuencia. "Desactualizado" es borde/fondo ámbar + punto, sin badge. El botón de quitar está oculto hasta hover/foco (siempre visible en touch vía `pointer-coarse:`).
  - `browse` (`ScenarioCategoryChips` + `ScenarioProductChecklist`): fila de chips de categoría con `flex-wrap` (más un chip "+ Nueva" para crear categoría inline) → productos con checkboxes animados. Un producto recién marcado (no uno ya incluido) gana un selector de frecuencia inline ("Original/Mensual/Anual/Esporádico") que viaja como `frequency` opcional al agregar.
  - `create` (`ScenarioInlineProductForm`): mismos chips para elegir categoría, luego formulario de nombre/precio/frecuencia. El `useForm` vive en `ScenarioItemsSection`, no en el hijo, para que un desvío a "crear categoría" no borre lo ya tecleado.
  - **Crear categoría inline** (`ScenarioInlineCategoryForm`): tercer paso posible desde los chips en ambos flujos, sin modal — solo nombre, siempre `EXPENSE`. Al crear, selecciona la categoría automáticamente.
- **Categorías** (`/categories` → `/categories/:id`): responde "¿cuánto gasto en esta área?" + eliminar con reasignación de productos. `CategoryFormDialog` pide solo nombre y tipo.
- **Productos** (`/expense-items` → `/expense-items/:id`): "¿cuánto me cuesta mantener esto?" + en qué escenarios se usa.
- **Ingresos** (`/incomes` → `/incomes/:id`): "¿cuánto me genera esta fuente?", o "esporádico, sin proyección" si `ONE_TIME`.

**Toda la UI del ledger está traducida al español**, incluyendo mensajes de validación de Zod (`z.config(es())`).

**ADR-0005 / ADR-0006**: sin cambios. RFC-0023.3 y RFC-0025 se mantienen dentro de lo ya aceptado.

## Qué se hizo en esta sesión

### 1. Eliminación total del sistema de iconos de categorías

Decisión del usuario: los iconos se van del proyecto entero, "como si nunca hubieran existido". Reemplazo por chips/badges de color generado automáticamente y estable a partir del nombre, sin que el usuario elija nada.

- **DB**: migración `20260805140000_drop_category_icons` — `DROP COLUMN` en `categories.icon` y `scenario_items.categoryIcon`. Destructiva a propósito: un icono nunca movió un total, así que no hay nada que auditar.
- **`packages/types`**: fuera `CATEGORY_ICON_NAMES` (~42 ids lucide), `categoryIconSchema`, `CategoryIcon`, `DEFAULT_CATEGORY_ICON`, `parseCategoryIcon`, el campo `icon` de los tres schemas de categoría, `categoryIcon` de `scenarioItemPublicSchema` y `toIcon` de `itemCategoryRenamedChangeSchema`. `updateCategoryBodySchema` pasó de `.partial().refine(...)` a `{ name }` obligatorio: era parcial solo porque nombre e icono eran independientes (una categoría de sistema aceptaba icono pero no rename).
- **`apps/api`**: fuera `syncCategoryIconInScenarios`, todos los `categoryIcon` de `scenarios.service.ts`, el `toIcon` de `ITEM_CATEGORY_RENAMED`, y los iconos de `DEFAULT_CATEGORIES` en `initial-user-data.ts`. Se eliminaron también `PublicCategory` y `toPublic` de `categories.service.ts`: solo existían para estrechar `icon: string` al vocabulario cerrado, así que sin `icon` el row de Prisma ya _es_ la forma pública.
- **`apps/web`**: borrados `CategoryIconPicker.tsx`, `category-icons.ts` y `ScenarioCategoryGallery.tsx`. Nuevos `category-color.ts` (paleta + hash) y `ScenarioCategoryChips.tsx`. `CategoryFormDialog` quedó en nombre + tipo. `ScenarioItemCard` muestra un badge de color con el nombre de la categoría; antes la categoría aparecía dos veces (icono arriba, texto gris abajo), ahora una sola vez.

Neto: **-435 líneas**. `typecheck` y `lint` en verde.

**Nota de diseño**: esto rompe la regla de "un solo color de acento por proyecto" del CLAUDE.md global. Fue una decisión explícita del usuario y está acotada a una paleta cerrada de 8 tonos, no a colores arbitrarios.

### 2. Bug del "primer clic": causa raíz encontrada y corregida

Bug abierto desde dos sesiones. **Los iconos no tenían nada que ver** — persistió intacto después de eliminarlos.

**Cómo se diagnosticó**: se instaló `playwright-core` **fuera del repo** (en el scratchpad de la sesión, sin tocar `package.json`), apuntando a la instalación de Edge del sistema para no descargar navegadores. Con eso se reprodujo el bug de forma determinista y se instrumentó el render con `console.log` temporal.

**Dos correcciones al diagnóstico de la sesión anterior**, ambas con evidencia:

- **No era "el primer clic"**. Es el primer clic _de cada entrada al composer_, y falla con **cualquier** categoría — se probaron los 9 chips uno por uno, cada uno con entrada fresca, y fallaron los 9. Lo que parecía "el segundo clic lo arregla" era en realidad "un clic en un chip **distinto** lo arregla": clicar el mismo chip tres veces seguidas nunca funcionaba.
- **El panel no se montaba invisible: no se montaba.** En el DOM no existía ningún nodo entre los chips y el pie de la tarjeta hasta que se clicaba otro chip. La conclusión previa ("el componente sí se monta con el `categoryId` correcto") era un falso positivo.

**Causa raíz**: el **`AnimatePresence` externo** de `ScenarioItemsSection` (el que alternaba `idle` ↔ `browse`/`create`), con framer-motion 11.15 + React 19. Traza del render:

```
[onSelect] called with id=…b8b0
[SECTION render] categoryId=…b8b0     ← el estado SÍ cambia, el padre SÍ renderiza
[SECTION render] categoryId=…b8b0     ← (doble render de StrictMode)
[CHIPS render] selectedId=…b8b0       ← el hijo SÍ renderiza con el valor correcto
[CHIPS render] selectedId=…b8b0
[CHIPS render] selectedId=null  ←←←   sin ningún [SECTION render] que lo origine
[CHIPS render] selectedId=null
```

Tras el commit del `setCategoryId`, `AnimatePresence` re-renderiza su copia cacheada del subárbol anterior y React commitea esa salida vieja encima de la nueva: los chips repintan con `selectedId=null` y el panel de abajo desaparece. El estado de React queda correcto todo el tiempo — por eso clicar el mismo chip otra vez no hacía nada (bail-out por `Object.is`) y solo un chip distinto forzaba un render que ganaba la carrera.

Aislado con tres pruebas: con el `AnimatePresence` **interno** desactivado el bug era idéntico; con el **externo** desactivado desaparecía; y con el externo restaurado en modo por defecto (sync) en vez de `popLayout` volvía igual. Es el wrapper, no su `mode`.

**Corrección**: se quitó el `AnimatePresence` externo y los dos `exit` que dependían de él. Los `motion.div` siguen ahí con `initial`/`animate` — esas props no necesitan `AnimatePresence`, solo `exit` la necesita. Se conserva la animación de entrada (a los 60 ms del clic el panel está en `opacity: 0.52`; a los 250 ms en `1`) y se pierde solo el fundido de salida. El `AnimatePresence` **interno se mantiene**: la prueba de aislamiento lo exoneró directamente. Hay un comentario en el archivo con el mecanismo, para que nadie reintroduzca el wrapper creyendo que mejora la transición.

**Verificación tras el fix** (mismo arnés que produjo el diagnóstico):

| Prueba                                                   | Antes                       | Después  |
| -------------------------------------------------------- | --------------------------- | -------- |
| Los 9 chips, primer clic, entrada fresca                 | 9/9 fallaban                | 9/9 OK   |
| 3 ciclos entrar → clic → volver, misma carga             | Fallaba el 1º de cada ciclo | 3/3 OK   |
| Mismo chip 3 veces seguidas                              | Nunca funcionaba            | 3/3 OK   |
| Flujos "Desde categorías" y "Nuevo producto", carga fría | Ambos fallaban              | Ambos OK |

### 3. Migración aplicada a mano

`prisma migrate` **no funciona en esta máquina**: el schema-engine no puede lanzarse (`spawn UNKNOWN`, probablemente antivirus o permisos en Windows). `prisma generate` sí funciona, porque usa otro binario. La migración se aplicó ejecutando el SQL con el driver `pg` y registrando la fila en `_prisma_migrations` a mano. Verificado: cero columnas de icono restantes.

## Sigue — próximos pasos y mejoras

### Pendiente inmediato

1. **Reiniciar el dev server de la API** para levantar limpio con el contrato nuevo (sin `icon` en `CategoryPublic`, sin `categoryIcon` en `ScenarioItemPublic`).
2. **Datos de prueba creados esta sesión**: el usuario `dev@vectra.local` no tenía ningún escenario, así que se creó "Repro primer clic" con 20 productos en la categoría Comida, todos agregados al escenario. Sirve para validar a mano; bórralo cuando estorbe.
3. **Validación visual manual en navegador** (lo que Playwright no cubrió):
   - Densidad de los chips con las categorías reales, y que los 8 colores se distingan bien. Los pares más cercanos de la paleta son teal/cyan y blue/indigo.
   - Que un nombre largo de categoría no rompa el chip (hay `max-w-52 truncate`) ni el badge de la tarjeta (`max-w-[calc(100%-1.75rem)]`).
   - Modo claro y oscuro: la paleta define ambos, pero no se verificó a ojo.
   - "Nuevo producto": tipear nombre/precio, tocar "+ Nueva" para crear una categoría, confirmar que lo tecleado sigue ahí al volver y que la categoría nueva queda seleccionada.
   - "Desde categorías": marcar un producto nuevo, elegir una frecuencia distinta a "Original", aplicar, y confirmar que se agregó con esa frecuencia. Después cambiar el precio del producto real y "Aplicar ahora" — confirmar que la frecuencia elegida **no** vuelve a la original.
   - Golden path de RFC-0023.3, heredado y todavía sin confirmar: rename sin diálogo, cambio de precio con diálogo + "Cambios pendientes", badge "Desactualizado" en escenarios compuestos, archivado, composición.

### Funcionalidad pendiente (analizada, no construida)

4. **Métricas "¿cuánto dinero me queda?" a 6 y 12 meses** — hoy `incomeCoverage.remainingMonthly` solo existe a nivel mensual.
5. **Propios vs. heredados en la lista de productos de un escenario compuesto** — `ScenarioItemsSection` sigue mostrando solo los items propios (`listScenarioItems` no recorre la composición), aunque el total y el sync sí la recorren.
6. **Comparador de escenarios** con deltas contra el escenario activo (ADR-0005 §12) — introduce Recharts.
7. **Rediseño del Dashboard alrededor de escenarios** — sigue siendo el widget del ledger de siempre, en `/dashboard`.
8. **Editar la frecuencia de un producto ya incluido en un escenario** (no solo al agregarlo) — el selector inline solo aplica a productos recién marcados en "Desde categorías"; cambiar la de uno ya incluido requeriría una interacción propia, no construida.

### Deuda técnica / mejoras menores

9. **`framer-motion@11.15` es anterior a React 19** — el bug del "primer clic" fue un fallo de compatibilidad, no un mal uso de la API. Si vuelve a aparecer algo raro con animaciones, migrar a `motion` v12 (que sí declara soporte de React 19) es el siguiente paso lógico. No urge.
10. **Playwright no está en el repo** — se usó desde el scratchpad de la sesión (`playwright-core` + canal `msedge`, sin descarga de navegadores). Resolvió en una sesión un bug que dos sesiones de lectura de código no pudieron. Vale la pena evaluarlo como `devDependency` real.
11. **`prisma migrate` no funciona en esta máquina** (`spawn UNKNOWN` del schema-engine). Toda migración futura necesita el mismo rodeo manual, o arreglar el entorno. Anotarlo antes de la próxima migración.
12. **`getScenarioSummary` llama a `detectScenarioChanges` internamente** para derivar `hasUpdates` (una sola fuente de verdad en vez de duplicar la comparación) — suma consultas por cada carga de summary. Aceptable a esta escala.
13. **`GET /scenarios` con N consultas internas por fila** (una por escenario, para el `monthly` enriquecido) — mismo criterio.
14. **No existe suite de tests en `apps/api`** — ningún `*.test.ts` en el repo.
15. **Los endpoints `/scenarios/:id/changes(/apply)` no tienen consumidor** — conservados como capacidad futura. Si en 2-3 sesiones nada los usa, evaluar eliminarlos.
16. **Coherencia visual del badge de categoría**: `CategoriesPage`/`CategoryDetailPage` y los listados de `ExpenseItemsPage` siguen mostrando la categoría como texto plano. Si se busca coherencia, ahí es donde iría el mismo badge de color de `ScenarioItemCard`. No pedido explícitamente.

### Decisiones de producto sin resolver (a propósito, no ahora)

17. Si `Budget`/`Reports` se mantienen a largo plazo, dado que Escenario + cobertura de Ingreso ya responden una versión más flexible de la misma pregunta.
18. Si los ingresos deberían agruparse por categoría en algún momento.

**Usuario de prueba con datos**: `dev@vectra.local` / `devpassword` (accounts, categories, transactions y budgets sembrados en USD, más el escenario de repro del punto 2).
