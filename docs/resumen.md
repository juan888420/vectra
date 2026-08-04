# Resumen del proyecto

> Se actualiza al final de cada sesión. Léelo primero para saber dónde retomar.

**Última actualización**: 2026-08-03 (RFC-0025: rediseño completo del selector de productos en Escenarios como asistente visual guiado por iconos de categoría, con `Category.icon` nuevo en el modelo)

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

**Eliminado en sesión previa**: el modelo `ScenarioCategoryWatch` (tabla, endpoints `category-watches`, relaciones en `Scenario`/`Category`) y el tipo de cambio `NEW_ITEM_AVAILABLE`. "Categoría completa" pasó a ser **solo una ayuda de selección**: expande la categoría en `ScenarioItem` individuales en el momento, y el escenario no mantiene ninguna relación viva con ella — un producto creado ahí después no aparece ni pregunta nada. Esta regla se conserva intacta en el rediseño de esta sesión (RFC-0025, ver abajo). También se eliminó `ScenarioChangesDialog` del frontend.

**`Category` tiene `icon` (RFC-0025, nuevo esta sesión)**: campo `String` obligatorio, `@default("tag")`, validado en la API contra el vocabulario cerrado `CATEGORY_ICON_NAMES` (~42 ids lucide en kebab-case, `packages/types/src/categories.ts`). El mapeo nombre→componente lucide vive solo en `apps/web/src/features/categories/category-icons.ts`, así que ni `packages/types` ni la API dependen de `lucide-react`. `CategoryFormDialog` incorpora `CategoryIconPicker` (grid de iconos). Las categorías de sistema ("Sin categorizar") aceptan cambio de icono aunque sigan sin poder renombrarse — `updateCategory` separa ambos guards. Un icono desconocido en base de datos degrada a `tag` en `toPublic` en vez de romper la respuesta.

**Endpoints `summary` por entidad (RFC-0023)**: `GET /categories/:id/summary`, `GET /expense-items/:id/summary` (+ en qué escenarios se usa), `GET /incomes/:id/summary`, y `GET /scenarios` enriquecido con `monthly` por fila. Todo el cómputo vive en el backend — `toMonthlyEquivalent`/`toProjection` en `packages/utils`.

**Frontend**: infraestructura (RFC-0017) + Accounts/Categories (RFC-0018) + Transactions (RFC-0019) + Dashboard (RFC-0020) + Productos/Ingresos (RFC-0021 UI) + Escenarios (RFC-0022 UI) + pantallas-pregunta (RFC-0023) + eliminación de categorías con reasignación (RFC-0023.2) + sincronización en el momento de editar (RFC-0023.3). Vite + React 19 + Tailwind v4, `packages/ui` (shadcn/ui + `DataTable`/`EmptyState`/`FormDialog`), `packages/types` (schemas Zod compartidos; nuevo módulo `scenario-impact.ts`, separado de `scenarios.ts` para evitar un ciclo de imports con `expense-items`/`incomes`) y `packages/utils`.

**Navegación y pantallas**: la ruta de aterrizaje (`/`) es **Escenarios**. Nav primario: Escenarios, Categorías, Productos, Ingresos. Nav secundario, dropdown "Historial": Dashboard, Cuentas, Transacciones. `Budget` sigue existiendo, sin pantalla propia. No existe todavía una `ReportsPage` en el frontend.

- **Escenarios** (`/scenarios`): `ScenariosLayout` (master-detail persistente, sidebar colapsable **pendiente**). `ScenarioDetailPage`: `ScenarioSummaryCards` (totales, cobertura de ingresos, esporádicos aparte, aviso **"Tiene cambios pendientes"** + botón **"Aplicar cambios pendientes"** solo cuando el usuario declinó sincronizar en su momento) + `ScenarioItemsSection` (rediseñado en RFC-0025: asistente de 3 estados, ver abajo) + `ScenarioIncomesSection` + `ScenarioCompositionsSection`, ahora **apiladas a ancho completo** (antes iban lado a lado en grid de 2 columnas).
- **Categorías** (`/categories` → `/categories/:id`): responde "¿cuánto gasto en esta área?" + eliminar con reasignación de productos.
- **Productos** (`/expense-items` → `/expense-items/:id`): "¿cuánto me cuesta mantener esto?" + en qué escenarios se usa.
- **Ingresos** (`/incomes` → `/incomes/:id`): "¿cuánto me genera esta fuente?", o "esporádico, sin proyección" si `ONE_TIME`.

**Toda la UI del ledger está traducida al español**, incluyendo mensajes de validación de Zod (`z.config(es())`).

**ADR-0005 / ADR-0006**: sin cambios. RFC-0023.3 se mantiene dentro de lo ya aceptado: ADR-0005 §8 exige que el usuario decida cuándo un cambio compartido afecta a otros escenarios, y eso se cumple — solo cambia _cuándo_ se pregunta (al guardar, no al abrir el escenario) y la granularidad (todo-o-nada por edición en vez de campo por campo, que el ADR planteaba como posibilidad, no obligación). ADR-0005 §7 ("categoría completa como selección inicial") queda intacto: lo que se quitó es el "seguimiento" persistente que RFC-0023.1 había añadido por su cuenta, que nunca estuvo en el ADR.

## Qué se hizo en esta sesión

RFC-0025 — rediseño del selector de productos en Escenarios. El diseño pasó por dos iteraciones dentro de la misma sesión: primero un picker agrupado por categoría con buscador (acordeón + búsqueda), y luego el usuario pidió reemplazarlo por completo por un asistente visual guiado. Se documenta solo el resultado final; la primera iteración fue revertida.

### Diseño previo a código

Se acordó por preguntas puntuales antes de escribir nada: los iconos de categoría vienen de un campo `icon` obligatorio con picker propio (no derivados del nombre, no emoji) porque el nombre de la categoría queda oculto hasta seleccionarla y el icono pasa a ser el identificador principal; el parámetro `search` que se había añadido a `GET /expense-items`/`GET /categories` para la primera iteración se revirtió por completo al no tener ya consumidor; ambos flujos del asistente ("Nuevo producto" y "Desde categorías") comparten el primer paso (elegir categoría por icono) para que el usuario aprenda un solo patrón de interacción; y el layout de Productos/Ingresos pasa de grid de 2 columnas a apilado a ancho completo.

### Backend

- **Migración** `20260803120000_add_category_icon`: `ALTER TABLE categories ADD COLUMN icon TEXT NOT NULL DEFAULT 'tag'` + backfill por nombre para las 10 categorías semilla (`Comida` → `utensils`, `Salud` → `heart-pulse`, etc.). El `DEFAULT` se mantiene en la columna a propósito (no se dropea): cualquier insert futuro que omita `icon` sigue siendo válido. Aplicada con `prisma migrate deploy` contra `vectra_dev` y verificada por consulta directa.
- **`packages/types/src/categories.ts`**: `CATEGORY_ICON_NAMES` (~42 ids lucide en kebab-case, única fuente de verdad) + `categoryIconSchema` + `DEFAULT_CATEGORY_ICON`. La API importa esto en vez de mantener un mirror a mano, a diferencia de la convención del resto del paquete.
- **`categories.schemas.ts`/`categories.service.ts`**: `icon` obligatorio en create, opcional en update (`updateCategoryBodySchema` pasa a `.partial()` con "al menos un campo", igual que expense-items). Nuevo `toPublic()` que degrada un icono desconocido a `tag` en vez de fallar la respuesta. El guard `assertNotSystem` se movió para cubrir solo el rename — "Sin categorizar" ya acepta cambio de icono.
- **`initial-user-data.ts`**: las 12 categorías semilla llevan `icon` explícito, en sync con el backfill de la migración.

### Frontend

- **Icono de categoría**: `category-icons.ts` (Record total `CategoryIcon → LucideIcon`, un solo lugar que ata el vocabulario de tipos a componentes lucide reales) + `CategoryIconPicker.tsx` (grid de iconos con estado seleccionado por color/anillo, nunca `scale` en hover) integrado en `CategoryFormDialog`.
- **El asistente de `ScenarioItemsSection`** (reescrito por completo, con Framer Motion): máquina de 3 estados sin modales.
  - `idle`: dos tiles de acción ("Nuevo producto" / "Desde categorías") sobre la lista de productos ya incluidos (sin cambios respecto a antes: badges de frecuencia/desactualizado, botón quitar).
  - `browse` (`ScenarioCategoryGallery` + `ScenarioProductChecklist`, nuevos): galería de iconos en fila, sin buscador; al elegir uno aparece su nombre con fade y sus productos con checkboxes animados. La selección persiste en estado local al cambiar de categoría, sembrada con lo que el escenario ya tiene — "Aceptar cambios" aplica un diff bidireccional (`toAdd`/`toRemove` contra `Promise.all`), así que desmarcar un producto ya incluido lo quita.
  - `create` (`ScenarioInlineProductForm`, nuevo): misma galería para elegir categoría, luego formulario de nombre/precio/frecuencia (frecuencia como control segmentado, no `<Select>`); al guardar se agrega al escenario y vuelve a `idle`.
- **`ScenarioDetailPage`**: el `grid lg:grid-cols-2` de Productos/Ingresos se quitó; ambas secciones son hijas directas del `flex flex-col` de la página, a ancho completo.
- **Eliminados**: `ScenarioProductPicker.tsx` y `ScenarioProductPickerCategoryRow.tsx` (la primera iteración, con buscador y acordeón — nunca llegaron a commit).
- **Revertido**: el parámetro `search` en `expense-items`/`categories` (schemas, service, tipos compartidos, capa API del frontend) que se había añadido y luego quedó sin consumidor.

### Verificación

`pnpm typecheck`, `pnpm lint` y `pnpm build` en verde en todo el workspace (los 3 warnings de `packages/ui` son preexistentes). Migración aplicada y backfill verificado por consulta directa contra `vectra_dev`: las categorías semilla tienen su icono real, las creadas por el usuario cayeron en `tag` como estaba previsto. No hay suite de tests en el repo para `apps/api` (ningún `*.test.ts` existe todavía), así que no hay tests que correr o romper.

**No se corrió el navegador** — sin herramienta de automatización (`chromium-cli`/Playwright) disponible en este entorno. Ver "Sigue".

## Sigue — próximos pasos y mejoras

### Bloqueante antes de seguir

1. **Validación visual manual en navegador — RFC-0025 (nuevo esta sesión)**:
   - Reiniciar el dev server de la API (el proceso corriendo puede seguir sirviendo el contrato viejo sin `icon`, arrancó antes de regenerar el cliente Prisma).
   - Estado `idle`: confirmar que Productos e Ingresos aparecen apilados a ancho completo, no lado a lado.
   - "Desde categorías": elegir un icono → aparece el nombre + sus productos → marcar algunos, cambiar a otra categoría, volver a la primera → confirmar que la selección se mantuvo → "Aceptar cambios" → confirmar que se agregaron los marcados y punto (sin tocar los no marcados de categorías no visitadas).
   - Repetir desmarcando un producto que ya estaba en el escenario → confirmar que "Aceptar cambios" lo quita.
   - "Nuevo producto": elegir categoría → llenar formulario → confirmar que aparece en el escenario y el asistente vuelve a `idle`.
   - `CategoryFormDialog`: crear/editar una categoría y confirmar que el picker de iconos funciona y el icono elegido se ve luego en la galería del escenario.
   - Categoría de sistema ("Sin categorizar"): confirmar que se le puede cambiar el icono pero no el nombre.
2. **Validación visual manual en navegador — RFC-0023.3** (heredado, sigue sin hacerse): golden path completo de sincronización en el momento de editar (rename sin diálogo, cambio de precio con diálogo + "Cambios pendientes", badge "Desactualizado" en escenarios compuestos, archivado, composición). Ver detalle en el historial de commits o pedir que se reconstruya si hace falta.

### Funcionalidad pendiente (analizada, no construida)

3. **Icono de categoría solo se ve en el asistente de Escenarios** — `CategoriesPage`/`CategoryDetailPage` y los listados de `ExpenseItemsPage` siguen mostrando la categoría como texto plano, sin el icono nuevo. Coherencia visual pendiente, no pedida explícitamente esta sesión.
4. **Panel lateral de Escenarios colapsable** — `ScenariosLayout` sigue sin poder cerrarse.
5. **Métricas "¿cuánto dinero me queda?" a 6 y 12 meses** — hoy `incomeCoverage.remainingMonthly` solo existe a nivel mensual.
6. **Propios vs. heredados en la lista de productos de un escenario compuesto** — `ScenarioItemsSection` sigue mostrando solo los items propios (`listScenarioItems` no recorre la composición), aunque el total y el sync sí la recorren.
7. **Comparador de escenarios** con deltas contra el escenario activo (ADR-0005 §12) — introduce Recharts.
8. **Rediseño del Dashboard alrededor de escenarios** — sigue siendo el widget del ledger de siempre, en `/dashboard`.

### Deuda técnica / mejoras menores

9. **`getScenarioSummary` llama a `detectScenarioChanges` internamente** para derivar `hasUpdates` (una sola fuente de verdad en vez de duplicar la comparación) — suma consultas por cada carga de summary. Aceptable a esta escala; revisar si se nota lento.
10. **`GET /scenarios` con N consultas internas por fila** (una por escenario, para el `monthly` enriquecido) — mismo criterio.
11. **No existe suite de tests en `apps/api`** — confirmado esta sesión (`find` sin resultados). Las 59/190 pruebas mencionadas en sesiones anteriores del resumen no se pudieron re-verificar porque no hay archivos `*.test.ts` en el repo actual; revisar si se perdieron o si la referencia previa ya estaba desactualizada.
12. **Los endpoints `/scenarios/:id/changes(/apply)` no tienen consumidor** — conservados a propósito como capacidad futura. Si en 2-3 sesiones nada los usa, evaluar eliminarlos.
13. **Sin herramienta de automatización de navegador en este entorno** (no hay `chromium-cli` ni Playwright instalado) — toda verificación de UI en las últimas sesiones quedó pendiente de un paso manual del usuario. Si esto se repite seguido, vale la pena instalar Playwright como dependencia de desarrollo.

### Decisiones de producto sin resolver (a propósito, no ahora)

14. Si `Budget`/`Reports` se mantienen a largo plazo, dado que Escenario + cobertura de Ingreso ya responden una versión más flexible de la misma pregunta.
15. Si los ingresos deberían agruparse por categoría en algún momento.

**Usuario de prueba con datos**: `dev@vectra.local` / `devpassword` (accounts, categories, transactions y budgets sembrados en USD).
