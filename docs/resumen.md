# Resumen del proyecto

> Se actualiza al final de cada sesión. Léelo primero para saber dónde retomar.

**Última actualización**: 2026-08-05 (sesión de debugging, sin resolver: bug de "primer clic" en el asistente de Productos de Escenarios — cinco hipótesis descartadas con evidencia, un bug real e independiente encontrado y corregido de paso, el bug original sigue abierto. Ver "Qué se hizo en esta sesión" y "Bug documentado para la próxima sesión" en "Sigue")

## Estado

**Backend**: completo para el ledger — auth (JWT + refresh), accounts, categories, transactions, budgets, recurring-transactions (con processor idempotente), dashboard y reports — y completo para el dominio de escenarios: expense-items, incomes (RFC-0021), scenarios (RFC-0022), sus endpoints `summary` (RFC-0023), eliminación de categorías con reasignación (RFC-0023.2) y el sistema de sincronización en el momento de editar (RFC-0023.3, ver abajo). Todo en `apps/api`. Nuevos registros usan `COP` como `defaultCurrency` por defecto (el usuario de prueba sembrado sigue en USD). CORS permite explícitamente `GET/HEAD/POST/PATCH/DELETE`.

**Escenarios (modelo)**: `Scenario` (estados `ACTIVE`/`INACTIVE`/`ARCHIVED`, default `INACTIVE`) con `ScenarioItem`/`ScenarioIncome` como snapshots explícitos de `ExpenseItem`/`Income` — el escenario nunca lee el recurso original en vivo, así que un cambio de precio nunca modifica una simulación en silencio (ADR-0005). `ScenarioComposition` permite escenario-en-escenario con detección de ciclos (BFS en service layer). Los `ScenarioItem` **sí** se heredan a través de la composición (agregado real); los `ScenarioIncome` **no** — un ingreso pertenece únicamente al escenario donde se vinculó.

**`ScenarioItem` snapshotea también `categoryIcon` y `frequencyOverride` (RFC-0025 cont., nuevo esta sesión)**:

- `categoryIcon: String` — el icono de la categoría al momento de agregar el producto, con el mismo tratamiento que `categoryName`: nunca se lee la categoría en vivo (ADR-0005), y un cambio de icono en la categoría fuente se sincroniza **solo, sin diálogo ni decisión del usuario** vía `syncCategoryIconInScenarios` (hermana de `syncCategoryNameInScenarios`, misma llamada desde `categories.service.ts`'s `updateCategory`) — es 100% visual, nunca mueve un total. `reconcileExpenseItemScenarios` también lo sincroniza cuando un producto cambia de categoría. Serializado a `ScenarioItemPublic` vía `parseCategoryIcon` (ahora en `packages/types`, reemplaza el degrade-a-`tag` que antes vivía solo en `categories.service.ts`), para que un icono retirado del vocabulario nunca rompa la respuesta de un snapshot viejo.
- `frequencyOverride: Boolean` — `true` cuando la frecuencia de ese `ScenarioItem` fue elegida a propósito para ese escenario (ej. simular un producto facturado anualmente ahí mientras el producto real sigue siendo mensual), en vez de copiada del `ExpenseItem` vivo. Se fija al agregar un producto desde "Desde categorías" con una frecuencia distinta a la original (`POST /scenarios/:id/items` acepta `frequency` opcional). Cuando está en `true`, `diffItemKinds` **excluye** la frecuencia de la detección de drift — nunca aparece como "Desactualizado" por esto, y ni `syncExpenseItemScenarios` ni `syncScenario` la pisan de vuelta a la del producto real al aplicar un cambio de precio. Sin este guard, cualquier sync financiero futuro habría revertido en silencio la elección del usuario — exactamente el bug que ADR-0005 existe para prevenir.

**Sincronización en el momento de editar (RFC-0023.3)**: reemplaza por completo el sistema anterior de "revisar cambios acumulados" (banner permanente + lista con checkboxes). El flujo es preventivo, no acumulativo:

1. El `PATCH`/`archive`/`unarchive` de un producto o ingreso **siempre guarda**, sin bloquearse ni pedir confirmación previa.
2. En la misma operación, los cambios **visuales** (nombre del producto, nombre y ahora también icono de la categoría, nombre del ingreso) se sincronizan solos en todos los snapshots no archivados — nunca generan pregunta, porque no mueven ningún total. Renombrar o re-iconar una categoría hace lo mismo vía `syncCategoryNameInScenarios`/`syncCategoryIconInScenarios`.
3. Después de guardar, la respuesta incluye `affectedScenarios`: los escenarios no archivados cuyo costo **sí** se movería (cambios financieros: precio, frecuencia sin `frequencyOverride`, archivado). Para productos incluye los escenarios padre por composición (`collectAncestorScenarioIds`, BFS ascendente, espejo del descendente que ya existía); para ingresos no, porque la cobertura de un padre nunca lee los ingresos de un hijo.
4. Si la lista viene vacía, el flujo termina ahí. Si no, el frontend abre `ScenarioImpactDialog` — el recurso ya está guardado, el diálogo solo decide la sincronización.
5. "Aplicar ahora" → `POST /expense-items/:id/sync-scenarios` (o `/incomes/:id/sync-scenarios`). "No ahora" → ninguna llamada extra; esos escenarios quedan con `hasUpdates: true`.

**El diálogo dice qué va a cambiar, no solo cuántos escenarios**: la misma respuesta trae `changes`, un resumen agregado **por campo** derivado de los `diff*Kinds` que ya se calculaban (`summarizeItemImpact`/`summarizeIncomeImpact`). Sigue siendo todo-o-nada: sin checkboxes ni selección por cambio. Los snapshots afectados pueden discrepar sobre el valor viejo (el escenario A se sincronizó a 80.000 y el B sigue en 60.000), así que `from` es `number | null` y en ese caso se muestra solo el destino en vez de inventar un origen.

**El aviso "Cambios pendientes" del escenario ahora también es descriptivo**, con el mismo describer que el diálogo — no dos implementaciones. Cada `ScenarioImpactChange` lleva `name` (del producto/ingreso) y `source: "expenseItem" | "income"` (para elegir "precio" vs. "ingreso" en el texto). Un único mapper en el backend, `toScenarioImpactChange`, convierte los `ScenarioChange` que ya calculaba `detectScenarioChanges` (la infraestructura de RFC-0023.1, conservada) al mismo formato `ScenarioImpactChange` que usan `summarizeItemImpact`/`summarizeIncomeImpact` — dos rutas de cálculo (una por-recurso-editado, otra por-escenario-completo), un solo formato de salida. `GET /scenarios/:id/summary` expone esto como `pendingChanges: ScenarioImpactChange[]`, derivado del mismo array que ya alimentaba `hasUpdates` (`hasUpdates: pendingChanges.length > 0`) — cero queries extra. En el frontend, `describeScenarioChange` (`apps/web/src/features/scenarios/describe-scenario-change.ts`) es la única función que convierte un cambio a texto en español; la usan tanto `ScenarioImpactDialog` como `ScenarioSummaryCards`. Un tipo de cambio nuevo que no tenga su caso en el `switch` exhaustivo rompe el build en las dos vistas a la vez, nunca en una sola.

**Nada derivado se almacena**: `hasUpdates` sigue calculándose al vuelo (ahora solo con cambios `kind: "financial"`, y devuelve `false` sin más para escenarios `ARCHIVED`). Se descartó explícitamente guardar un flag `hasPendingChanges` por ser el mismo patrón desincronizable que RFC-0023.1 vino a corregir.

**Escenarios archivados**: congelados. No entran en `affectedScenarios`, no se sincronizan, y su `summary` reporta `hasUpdates: false`. Al desarchivar se vuelve a comprobar desde cero (el cálculo es derivado, así que esto sale gratis) y el escenario reaparece como pendiente si su snapshot ya no coincide.

**Botón "Actualizar" a nivel escenario**: `POST /scenarios/:id/sync` aplica de una vez todos los cambios financieros pendientes alcanzables (items propios + los de escenarios compuestos, ingresos propios), sin selección por ítem ni checkboxes. Respeta `frequencyOverride` (no la pisa) igual que `syncExpenseItemScenarios`.

**Infraestructura `ScenarioChange` conservada**: la unión discriminada de 9 variantes (`ITEM_RENAMED`, `ITEM_CATEGORY_RENAMED`, `ITEM_PRICE_CHANGED`, `ITEM_FREQUENCY_CHANGED`, `ITEM_ARCHIVED`, `INCOME_RENAMED`, `INCOME_AMOUNT_CHANGED`, `INCOME_FREQUENCY_CHANGED`, `INCOME_ARCHIVED`) con su `kind: "visual" | "financial"`, los detectores (`CHANGE_DETECTORS`, `diffItemKinds`/`diffIncomeKinds`) y los endpoints `GET/POST /scenarios/:id/changes(/apply)` siguen existiendo. **Ninguna pantalla los consume hoy** — se mantienen como capacidad reutilizable para una feature futura que necesite el desglose campo por campo. `ITEM_CATEGORY_RENAMED` ahora lleva también `toIcon` (nuevo esta sesión, por consistencia): nombre e icono son la misma vista snapshoteada de la categoría, así que `buildApplyOperation` actualiza los dos juntos en vez de dejar el icono desactualizado tras aplicar un cambio de nombre por este camino. Los `diff*Kinds` siguen siendo la única fuente de verdad, compartida por el flag `outdated` por ítem, `hasUpdates` y todas las funciones de sync.

**Eliminado en sesión previa**: el modelo `ScenarioCategoryWatch` (tabla, endpoints `category-watches`, relaciones en `Scenario`/`Category`) y el tipo de cambio `NEW_ITEM_AVAILABLE`. "Categoría completa" pasó a ser **solo una ayuda de selección**: expande la categoría en `ScenarioItem` individuales en el momento, y el escenario no mantiene ninguna relación viva con ella — un producto creado ahí después no aparece ni pregunta nada. También se eliminó `ScenarioChangesDialog` del frontend.

**`Category` tiene `icon`**: campo `String` obligatorio, `@default("tag")`, validado en la API contra el vocabulario cerrado `CATEGORY_ICON_NAMES` (~42 ids lucide en kebab-case, `packages/types/src/categories.ts`). El mapeo nombre→componente lucide vive solo en `apps/web/src/features/categories/category-icons.ts`, así que ni `packages/types` ni la API dependen de `lucide-react`. `CategoryFormDialog` incorpora `CategoryIconPicker` (grid de iconos). Las categorías de sistema ("Sin categorizar") aceptan cambio de icono aunque sigan sin poder renombrarse — `updateCategory` separa ambos guards. Un icono desconocido en base de datos degrada a `tag` vía `parseCategoryIcon` (`packages/types`, compartido por `categories.service.ts` y la serialización de `ScenarioItem`) en vez de romper la respuesta.

**Endpoints `summary` por entidad (RFC-0023)**: `GET /categories/:id/summary`, `GET /expense-items/:id/summary` (+ en qué escenarios se usa), `GET /incomes/:id/summary`, y `GET /scenarios` enriquecido con `monthly` por fila. Todo el cómputo vive en el backend — `toMonthlyEquivalent`/`toProjection` en `packages/utils`.

**Frontend**: infraestructura (RFC-0017) + Accounts/Categories (RFC-0018) + Transactions (RFC-0019) + Dashboard (RFC-0020) + Productos/Ingresos (RFC-0021 UI) + Escenarios (RFC-0022 UI) + pantallas-pregunta (RFC-0023) + eliminación de categorías con reasignación (RFC-0023.2) + sincronización en el momento de editar (RFC-0023.3) + asistente visual y rejilla de productos (RFC-0025). Vite + React 19 + Tailwind v4, `packages/ui` (shadcn/ui + `DataTable`/`EmptyState`/`FormDialog`), `packages/types` (schemas Zod compartidos; módulo `scenario-impact.ts` separado de `scenarios.ts` para evitar un ciclo de imports con `expense-items`/`incomes`) y `packages/utils`.

**Navegación y pantallas**: la ruta de aterrizaje (`/`) es **Escenarios**. Nav primario: Escenarios, Categorías, Productos, Ingresos. Nav secundario, dropdown "Historial": Dashboard, Cuentas, Transacciones. `Budget` sigue existiendo, sin pantalla propia. No existe todavía una `ReportsPage` en el frontend.

- **Escenarios** (`/scenarios`): `ScenariosLayout` (master-detail persistente, sidebar colapsable **pendiente**). `ScenarioDetailPage`: `ScenarioSummaryCards` (totales, cobertura de ingresos, esporádicos aparte, aviso **"Tiene cambios pendientes"** + botón **"Aplicar cambios pendientes"** solo cuando el usuario declinó sincronizar en su momento) + `ScenarioItemsSection` + `ScenarioIncomesSection` + `ScenarioCompositionsSection`, apiladas a ancho completo. `ScenarioItemsSection` es un asistente de 3 estados sin modales (`idle`/`browse`/`create`, ver detalle abajo, rediseñado esta sesión).
  - `idle`: los productos ya incluidos se muestran como una **rejilla de tarjetas tipo launcher** (`ScenarioItemCard`, `grid-cols-[repeat(auto-fill,minmax(8.5rem,1fr))]`, tiles cuadrados de ~144px): icono de categoría, nombre, categoría y precio+frecuencia, con "Desactualizado" como borde/fondo ámbar + punto en vez de badge. Botón quitar oculto hasta hover/foco (siempre visible en touch vía `pointer-coarse:`).
  - `browse` (`ScenarioCategoryGallery` + `ScenarioProductChecklist`): galería de iconos en fila (con un tile "+" final para crear categoría inline) → productos con checkboxes animados. Un producto recién marcado (no uno ya incluido) gana un selector de frecuencia inline ("Original/Mensual/Anual/Esporádico") que viaja como `frequency` opcional al agregar.
  - `create` (`ScenarioInlineProductForm`): misma galería (con el mismo "+") para elegir categoría, luego formulario de nombre/precio/frecuencia. El `useForm` del formulario vive en `ScenarioItemsSection`, no en el componente hijo, para que un desvío a "crear categoría" no borre lo ya tecleado.
  - **Crear categoría inline** (`ScenarioInlineCategoryForm`, nuevo): tercer paso posible desde la galería en ambos flujos, sin modal — nombre + `CategoryIconPicker`, siempre `EXPENSE`. Al crear, selecciona la categoría automáticamente.
  - **Nota de esta sesión (sin resolver)**: el `AnimatePresence` que envolvía `creatingCategory`/`categoryId` en `ScenarioItemsSection` está **temporalmente reemplazado por `<div>` planos sin animación** mientras se depura el bug de "primer clic" (ver "Qué se hizo en esta sesión" y "Sigue" más abajo). Los 5 componentes de este asistente también tienen contadores de render de debug todavía activos en el código.
- **Categorías** (`/categories` → `/categories/:id`): responde "¿cuánto gasto en esta área?" + eliminar con reasignación de productos.
- **Productos** (`/expense-items` → `/expense-items/:id`): "¿cuánto me cuesta mantener esto?" + en qué escenarios se usa.
- **Ingresos** (`/incomes` → `/incomes/:id`): "¿cuánto me genera esta fuente?", o "esporádico, sin proyección" si `ONE_TIME`.

**Toda la UI del ledger está traducida al español**, incluyendo mensajes de validación de Zod (`z.config(es())`).

**ADR-0005 / ADR-0006**: sin cambios. RFC-0023.3 se mantiene dentro de lo ya aceptado (ver sesiones previas). El nuevo `frequencyOverride` es una extensión del mismo principio (ADR-0005 §8: el usuario decide cuándo un cambio compartido afecta a otros escenarios) aplicado al caso inverso — una elección explícita del usuario para _ese_ escenario nunca debe ser tratada como drift del producto real.

## Qué se hizo en esta sesión

Sesión íntegramente de debugging, **sin resolver al cierre**, sobre un bug reportado por el usuario en el asistente de "Productos" de Escenarios (el mismo de RFC-0025 cont., sesión anterior).

**Síntoma reportado** (100% reproducible según el usuario, nunca visto directamente en este entorno — sin navegador disponible): al entrar a "Nuevo producto" o "Desde categorías" y hacer clic en el icono de una categoría **por primera vez**, el panel esperado debajo de la galería (formulario de producto nuevo, o checklist de productos de esa categoría) no aparece. Un segundo clic — en la misma categoría o en otra — sí lo muestra, y desde ahí el flujo funciona con normalidad el resto de la sesión de navegador.

### Hipótesis probadas y descartadas, en orden, con evidencia real (no solo lectura de código)

1. **`AnimatePresence` externo** (`ScenarioItemsSection.tsx`, alterna idle ↔ browse/create): `mode="wait"` → `mode="popLayout"`, para que el contenido entrante no espere a que termine de salir el saliente antes de montarse. El usuario probó el cambio en el navegador: **no alteró el comportamiento reportado**. Se mantiene en el código porque sigue siendo una mejora real independiente (evita un hueco de montaje al cambiar de modo), pero queda descartado como causa.

2. **`AnimatePresence` interno** (alterna `creatingCategory`/`categoryId`/nada, envuelve directamente a `ScenarioInlineProductForm`/`ScenarioProductChecklist`/`ScenarioInlineCategoryForm`): mismo cambio `mode="wait"` → `"popLayout"`. Probado en el navegador: **tampoco cambió nada**.

3. **Capa de interacción/DOM**: revisión exhaustiva por código (no hay herramienta de navegador) de overlays invisibles, z-index en conflicto, `pointer-events`, `preventDefault`/`stopPropagation`, robo de foco, y elementos `absolute`/`fixed` superpuestos, tanto en los 5 componentes del flujo como en `packages/ui` (Radix `Dialog`/`DropdownMenu`/`AlertDialog`/`Select`). Cero hallazgos — ninguno de estos existe en el camino de este flujo.

4. **Framer Motion en general**: se reemplazó el `AnimatePresence`/`motion.div` interno completo por `<div>` planos sin ninguna animación (**sigue así en el código**, ver "Estado del código al cierre" abajo). El usuario probó en el navegador: **el bug persistió incluso sin ninguna animación de por medio**, descartando a Framer Motion como causa raíz.

5. **Montaje/estado de React**: se instrumentó `ScenarioInlineProductForm` con un banner visual temporal (`createPortal` a `document.body`, deliberadamente fuera del árbol animado para que la opacidad de un ancestro no pudiera ocultarlo). El usuario confirmó en el navegador: **el componente sí se monta en el primer clic, con el `categoryId` correcto** — descarta de raíz cualquier bug de lógica de estado, `useEffect`, memoización o dato stale de React Query en ese componente puntual.

6. **Estado compartido entre escenarios vía React Router** (hallazgo real, no descartado — se corrigió): `ScenarioDetailPage` se monta en `<Route path=":id" element={<ScenarioDetailPage />} />` sin `key`. React Router **nunca desmonta `ScenarioItemsSection` al cambiar de escenario** por el sidebar (`<Link to={`/scenarios/${id}`}>` solo cambia el param; el componente es el mismo, solo cambia el prop `scenario`). Esto significa que todo el estado del asistente (`mode`, `categoryId`, `creatingCategory`, el `useForm` de "Nuevo producto") podía quedar "abierto" de un escenario a otro si el usuario cambiaba de escenario sin tocar "Volver" primero — un bug de UX real e independiente del de "primer clic". Se corrigió con `key={scenario.id}` en `<ScenarioItemsSection>` (`ScenarioDetailPage.tsx`), forzando un remount limpio por escenario. **Se mantiene en el código** porque es correcto en sí mismo, pero **no se confirmó si cambió el patrón cross-escenario que motivó la hipótesis** (el usuario había reportado que visitar un escenario específico "arreglaba" a todos los demás sin recargar — coherente con este bug, pero no se llegó a re-probar explícitamente antes de pasar al punto 7).

7. **Render por componente** (última hipótesis, en curso, sin resultado): se instrumentaron los 5 componentes del flujo (`ScenarioItemsSection`, `ScenarioCategoryGallery`, `ScenarioInlineProductForm`, `ScenarioInlineCategoryForm`, `ScenarioProductChecklist`) con contadores de render visibles — incrementan en cada render (no solo al montar), mostrados como barras fijas apiladas arriba de la pantalla vía `createPortal`, cada una con sus props/estado relevante (`mode`, `categoryId`, `creatingCategory`, `isLoading` según el componente). El usuario probó y reportó "sigue sin funcionar" **sin llegar a comunicar los números/valores exactos de cada barra antes y después del primer clic** — la instrumentación quedó lista y sin explotar. Es la pista más prometedora para retomar (ver "Sigue").

### Estado del código al cierre de la sesión (importante para retomar)

**Cambios reales, no son debug, se mantienen**:

- `ScenarioItemsSection.tsx`: `AnimatePresence` externo en `mode="popLayout"` (antes `"wait"`).
- `ScenarioDetailPage.tsx`: `<ScenarioItemsSection key={scenario.id} scenario={scenario} />` — corrige el bug de estado-compartido-entre-escenarios del punto 6.

**Debug temporal, todavía activo, pendiente de decisión (removerlo o seguir usándolo)**:

- `ScenarioItemsSection.tsx`: el `AnimatePresence` interno fue reemplazado por `<div>` planos sin animación — no es el diseño final. Buscar el comentario `TEMPORARY` para ubicarlo y, eventualmente, restaurar el `AnimatePresence` (con `mode="popLayout"`, no `"wait"`, ya que ese cambio sí se quiere mantener).
- Los 5 componentes listados en el punto 7 tienen un `useRef` contador de render (`debugRenderCountRef`) y una barra de color vía `createPortal(..., document.body)`. Buscar `DEBUG INSTRUMENTATION` en cada archivo para ubicarlas y removerlas cuando ya no hagan falta.

**No se corrió `pnpm lint`/`pnpm build`/migraciones** — solo `pnpm typecheck` en verde después de cada cambio (no hubo cambios de backend ni de schema esta sesión). Sin herramienta de navegador en este entorno: todo lo confirmado en esta sesión fue reportado manualmente por el usuario tras cada cambio.

## Sigue — próximos pasos y mejoras

### Bug documentado para la próxima sesión (bloqueante, sin resolver)

**Síntoma**: en el asistente de "Productos" de un escenario, al entrar a "Nuevo producto" o "Desde categorías" y hacer clic en el icono de una categoría **por primera vez**, el panel esperado debajo de la galería no aparece. Un segundo clic (misma categoría u otra) sí lo muestra, y el resto de la sesión de navegador funciona con normalidad. 100% reproducible según el usuario.

**Dato adicional sin explotar**: tras refrescar la página, el bug apareció en varios escenarios, pero visitar uno específico "arregló" a todos los demás sin recargar — llevó a encontrar el bug de `key={scenario.id}` (ver "Qué se hizo en esta sesión", punto 6), que se corrigió pero **no se reconfirmó si cambió este patrón**.

**Descartado con evidencia real** (no solo hipótesis, ver detalle completo en "Qué se hizo en esta sesión"): `AnimatePresence` externo, `AnimatePresence` interno, Framer Motion en general (probado sin ninguna animación), overlays/z-index/pointer-events/foco, y montaje de React en `ScenarioInlineProductForm` (confirmado que monta correctamente con el `categoryId` correcto en el primer clic, vía banner fuera del árbol animado).

**Cómo retomar, en orden**:

1. La instrumentación de contadores de render por componente **ya está en el código** (5 componentes, ver "Estado del código al cierre" arriba) — falta el paso de leerla con atención: anotar los 5 números/valores antes del primer clic, hacer el clic, y anotar los 5 de nuevo. El objetivo puntual es encontrar cuál componente NO sube su contador (o sube con una prop desactualizada) cuando su padre sí lo hizo — eso marca el punto exacto donde el árbol se corta.
2. Si los 5 contadores suben correctamente con los valores esperados (React pintó todo bien), el problema deja de ser de render/JS y pasa a ser puramente visual — inspeccionar con el Elements panel del navegador qué hay en las coordenadas exactas del formulario justo después del primer clic, comparado con el segundo.
3. Instalar Playwright (deuda técnica ya anotada, ver punto correspondiente más abajo) — después de una sesión entera depurando interacción de UI sin poder ver el navegador, es el cuello de botella real de esta investigación.
4. Una vez resuelto: decidir si se restaura el `AnimatePresence` interno (con `mode="popLayout"`) o se deja como `<div>` plano si resulta que la animación ahí no aportaba nada, y remover toda la instrumentación de debug de los 5 componentes.

### Bloqueante antes de seguir (heredado, sigue pendiente además de lo de arriba)

1. **Validación visual manual en navegador — acumulada de las últimas dos sesiones (RFC-0025 y esta continuación)**:
   - Reiniciar el dev server de la API (contrato nuevo: `categoryIcon` en `ScenarioItemPublic`, `frequency` opcional en `addScenarioItemBodySchema`).
   - Asignar iconos reales a las categorías del usuario de prueba — las 37 filas de `scenario_items` siguen en `tag` (icono genérico) porque ninguna categoría del usuario tiene un icono propio todavía; sin esto la rejilla se ve con el mismo icono repetido, que es lo opuesto al efecto launcher buscado.
   - Rejilla de productos: confirmar densidad (~5-6 tiles por fila en monitor estándar), que el tile de 144px no corta el nombre en dos líneas, y que "Desactualizado" (borde+fondo ámbar, punto) se distingue bien sin badge.
   - "Nuevo producto": tipear nombre/precio, tocar "+" para crear una categoría nueva, confirmar que el nombre/precio ya tecleados siguen ahí al volver, y que la categoría recién creada queda seleccionada (nota: su icono puede tardar un round-trip de red en aparecer en la galería por la invalidación de React Query — no bloquea crear el producto).
   - Repetir cambiando de categoría existente a mitad de tipeo (sin crear una nueva) — confirmar que también se conserva lo escrito, ya que era un bug preexistente más amplio que el de "crear categoría".
   - "Desde categorías": marcar un producto nuevo, elegir una frecuencia distinta a "Original", aplicar cambios, y confirmar que se agregó con esa frecuencia. Después, cambiar el precio del producto real y "Aplicar ahora" en el escenario — confirmar que la frecuencia elegida **no** vuelve a la original.
   - Alternar varias veces entre "Nuevo producto" y "Nueva categoría" (y entre categorías) buscando específicamente el bug reportado (la primera transición no renderiza hasta repetir la acción) — confirmar que ya no ocurre.
   - Golden path heredado de RFC-0025 (icono de categoría, "Desde categorías" con selección persistente entre categorías, "Nuevo producto" simple) — sigue sin confirmarse en navegador.
2. **Validación visual manual en navegador — RFC-0023.3** (heredado, sigue sin hacerse): golden path completo de sincronización en el momento de editar (rename sin diálogo, cambio de precio con diálogo + "Cambios pendientes", badge "Desactualizado" en escenarios compuestos, archivado, composición).

### Funcionalidad pendiente (analizada, no construida)

3. **Icono de categoría solo se ve en el asistente de Escenarios** — `CategoriesPage`/`CategoryDetailPage` y los listados de `ExpenseItemsPage` siguen mostrando la categoría como texto plano, sin icono. Coherencia visual pendiente, no pedida explícitamente.
4. **Panel lateral de Escenarios colapsable** — `ScenariosLayout` sigue sin poder cerrarse.
5. **Métricas "¿cuánto dinero me queda?" a 6 y 12 meses** — hoy `incomeCoverage.remainingMonthly` solo existe a nivel mensual.
6. **Propios vs. heredados en la lista de productos de un escenario compuesto** — `ScenarioItemsSection` sigue mostrando solo los items propios (`listScenarioItems` no recorre la composición), aunque el total y el sync sí la recorren.
7. **Comparador de escenarios** con deltas contra el escenario activo (ADR-0005 §12) — introduce Recharts.
8. **Rediseño del Dashboard alrededor de escenarios** — sigue siendo el widget del ledger de siempre, en `/dashboard`.
9. **Editar la frecuencia de un producto ya incluido en un escenario** (no solo al agregarlo) — decisión de alcance de esta sesión: el selector de frecuencia inline solo aplica a productos recién marcados en "Desde categorías"; cambiar la frecuencia de uno ya incluido requeriría una interacción propia (¿editar la tarjeta directamente? ¿un modo de edición en el checklist?), no construida.
10. **`ScenarioProductChecklist` no ofrece el selector de frecuencia en el flujo "Nuevo producto"** — ahí la frecuencia se elige en el formulario normal (`ScenarioInlineProductForm`), que ya la tiene; no hace falta un segundo control, pero vale la nota si en el futuro se busca unificar ambos flujos más.

### Deuda técnica / mejoras menores

11. **`getScenarioSummary` llama a `detectScenarioChanges` internamente** para derivar `hasUpdates` (una sola fuente de verdad en vez de duplicar la comparación) — suma consultas por cada carga de summary. Aceptable a esta escala; revisar si se nota lento.
12. **`GET /scenarios` con N consultas internas por fila** (una por escenario, para el `monthly` enriquecido) — mismo criterio.
13. **No existe suite de tests en `apps/api`** — confirmado en sesión previa (ningún `*.test.ts` en el repo). No hay tests que corran o rompan con los cambios de esta sesión.
14. **Los endpoints `/scenarios/:id/changes(/apply)` no tienen consumidor** — conservados a propósito como capacidad futura; ahora también cargan `toIcon` en `ITEM_CATEGORY_RENAMED` por consistencia con el resto del snapshot. Si en 2-3 sesiones nada los usa, evaluar eliminarlos.
15. **Sin herramienta de automatización de navegador en este entorno** (no hay `chromium-cli` ni Playwright instalado) — toda verificación de UI en las últimas tres sesiones quedó pendiente de un paso manual del usuario. Si esto se repite seguido, vale la pena instalar Playwright como dependencia de desarrollo.

### Decisiones de producto sin resolver (a propósito, no ahora)

16. Si `Budget`/`Reports` se mantienen a largo plazo, dado que Escenario + cobertura de Ingreso ya responden una versión más flexible de la misma pregunta.
17. Si los ingresos deberían agruparse por categoría en algún momento.

**Usuario de prueba con datos**: `dev@vectra.local` / `devpassword` (accounts, categories, transactions y budgets sembrados en USD).
