# ADR-0006: Motor de escenarios — modelo de dominio

## Estado

`accepted`

## Contexto

[ADR-0005](0005-financial-scenarios.md) fijó la visión (escenarios, productos, categorías, ingresos) y dejó explícitamente para un RFC de implementación el detalle fino de cómo se compone un escenario. [RFC-0021](../resumen.md) ya implementó `ExpenseItem` e `Income` en backend, sin dependencias entre sí. Falta la pieza más compleja: `Scenario` en sí mismo.

El problema de fondo es que ADR-0005 da dos reglas que en la superficie parecen contradictorias:

- Reutilizar por referencia, no por copia (heredado de ADR-0004): "si sube el precio de Netflix, se actualiza en todos lados sin editar copias".
- "Vectra nunca modifica silenciosamente una simulación" (ADR-0005 punto 8): los cambios compartidos requieren confirmación del usuario.

Este ADR resuelve esa tensión y fija el modelo de dominio completo del motor de escenarios, antes de escribir el RFC de implementación.

## Decisión

### El eje central: no todo vínculo tiene la misma vivacidad

Se distinguen tres tipos de relación, cada una con su propia semántica:

| Vínculo                                            | Semántica                                                                                                                                                                                                                                               | Por qué                                                                                                                                                                                         |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Ítem → Escenario (ítem ya seleccionado)            | **Vivo**: editar precio, nombre o frecuencia de un `ExpenseItem` se refleja al instante en todo escenario que lo tenga seleccionado. El escenario no guarda un snapshot del precio, guarda una referencia al ítem.                                      | Es el caso de uso fundador de ADR-0004: "no quiero editar 5 copias de Netflix".                                                                                                                 |
| Categoría → Escenario (agregar categoría completa) | **Snapshot con propagación opt-in**: agregar una categoría es un atajo que selecciona sus ítems activos _en ese momento_. Cambios posteriores en la categoría (ítem nuevo, ítem archivado) no tocan el escenario solo; el usuario decide si aplicarlos. | Regla explícita de ADR-0005 punto 8. Una categoría es una agrupación temática, no una suscripción — el usuario decidió qué entraba, no "todo lo que exista en Tecnología en cualquier momento". |
| Escenario → Escenario (composición)                | **Vivo**: si "Escenario IA" incluye a "Escenario actual", y este último cambia su selección de ítems, el total de "Escenario IA" se recalcula solo.                                                                                                     | Es el propósito explícito de la composición (ADR-0004: "comparar sin duplicar"). Si fuera snapshot, componer escenarios sería un simple copy-paste sin valor.                                   |

Todo lo demás del modelo se deriva de esta tabla.

### Entidades

**`Scenario`**

- `id`, `userId`, `name` (único entre activos por usuario, mismo patrón que `ExpenseItem`/`Income`).
- `status`: `ACTIVE | INACTIVE | ARCHIVED` — puramente un estado de visibilidad/lifecycle, **sin unicidad forzada**: varios escenarios pueden estar `ACTIVE` a la vez. "Activo" significa "candidato a comparación", no "mi única situación real".
- Sin campo de línea base persistido: el comparador no asume un escenario de referencia fijo; el usuario elige contra cuál calcular deltas cada vez que abre el comparador (se puede recordar la última elección en el frontend, no en el dominio).
- No almacena totales ni proyecciones — siempre derivados (regla heredada de ADR-0004/0005).

**`ScenarioItem`** (join `Scenario` ↔ `ExpenseItem`)

- `scenarioId`, `expenseItemId`, `addedAt`.
- `addedViaCategoryId: uuid | null` — campo de **procedencia**, no una relación funcional. Si el ítem entró porque el usuario agregó la categoría completa, aquí queda grabado el id de esa categoría (inmutable una vez seteado; no se actualiza si el ítem cambia de categoría después). Si entró individualmente, es `null`.
- Este campo es lo que hace posible la propagación opt-in sin crear una tabla de "suscripciones a categoría" separada: para saber a qué escenarios avisarles de un cambio en la categoría X, basta con buscar escenarios que tengan al menos un `ScenarioItem` activo con `addedViaCategoryId = X`. Si el usuario ya quitó todos los ítems que vinieron de esa categoría, el escenario deja de "escuchar" cambios de esa categoría de forma natural, sin lógica extra.

**`ScenarioComposition`** (join `Scenario` ↔ `Scenario`, autorreferencial)

- `parentScenarioId`, `includedScenarioId`, `addedAt`.
- Constraint de aplicación en el service layer (no expresable en Prisma): `includedScenarioId` no puede ser ancestro de `parentScenarioId` en el grafo de inclusión (ciclo transitivo, no solo directo) ni igual a él (auto-inclusión).

**`ScenarioIncome`** (join `Scenario` ↔ `Income`)

- `scenarioId`, `incomeId` — **many-to-many**: un escenario puede vincularse a varios ingresos; la cobertura suma todos los vinculados.

### Reglas de negocio derivadas

1. **Prohibición de ciclos**: antes de insertar una composición A→B, verificar que A no sea alcanzable desde B recorriendo el grafo de inclusiones. Sin esto, un total se calcularía en recursión infinita.
2. **Archivar nunca cambia un número ya calculado por otro escenario que lo referencia.** Regla unificadora: un `ExpenseItem` archivado sigue sumando en los escenarios que lo tienen seleccionado; un `Scenario` archivado sigue sumando en los escenarios que lo incluyen; un `Income` archivado sigue contando en la cobertura de los escenarios vinculados. Archivar solo saca a la entidad de las listas activas e impide que entre en _nuevas_ selecciones. Es la aplicación literal del principio rector de ADR-0005: si archivar restara un número, sería una mutación silenciosa.
3. **Borrar (delete físico) sigue bloqueado si hay referencias**, igual que `Category` con `Budget`/`ExpenseItem` hoy. Un `ExpenseItem`/`Income` referenciado por algún `ScenarioItem`/`ScenarioIncome` no se puede borrar, solo archivar. Un `Scenario` incluido por otro tampoco se puede borrar.
4. **Unicidad de nombre de escenario** entre los activos por usuario, mismo patrón que ítems/ingresos.
5. **Ownership estricto**: `ScenarioComposition`/`ScenarioItem`/`ScenarioIncome` solo pueden apuntar a entidades del mismo `userId`; nunca cruzar usuarios.
6. **Cálculo de totales**: recorrido recursivo del árbol de composición (protegido por la regla 1, así que siempre termina) sumando ítems propios (`YEARLY` prorrateado ÷ 12, `ONE_TIME` excluido del total recurrente) más los totales recurrentes de cada escenario incluido. Los `ONE_TIME` se acumulan aparte como "costos únicos" — no entran en el total mensual ni en las proyecciones ×6/×12.
7. **Cobertura de ingresos**: `% consumido = totalMensualEscenario / Σ(ingresos vinculados, normalizados a mensual) × 100`. Los `WEEKLY` se normalizan a mensual como `monto × 52 ÷ 12` (aproximación estándar, no calendario exacto). Los `ONE_TIME` vinculados no entran en la cobertura mensual.
8. **Propagación de cambios de categoría es un aviso pasivo, no un diálogo interruptor**: los escenarios afectados por un cambio en una categoría que incluyeron en bloque muestran una señal visual (derivada, no almacenada — se calcula comparando `ScenarioItem.addedViaCategoryId` contra el estado actual de la categoría) que el usuario revisa y aplica cuando quiere, ítem por ítem o todo de una vez.

### Edge cases resueltos

| Caso                                                                                                                | Resolución                                                                                                                                                                                                                              |
| ------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Escenario A incluye a B, se intenta hacer que B incluya a A                                                         | Rechazado en el service layer (regla 1) antes de escribir la fila.                                                                                                                                                                      |
| Se intenta borrar un `ExpenseItem` seleccionado en 3 escenarios                                                     | 409, "archívalo en vez de borrarlo" (patrón ya existente en `Category`).                                                                                                                                                                |
| Se archiva una categoría con ítems ya seleccionados en escenarios                                                   | Los ítems se archivan en cascada (ya implementado en RFC-0021); siguen sumando donde estén seleccionados (regla 2). No dispara el aviso de propagación — ese es para _cambios de contenido_, no para el archivado en cascada del padre. |
| Se agrega un ítem nuevo a una categoría que 2 escenarios ya incluyeron en bloque                                    | No se propaga solo; aviso pasivo en esos 2 escenarios (regla 8).                                                                                                                                                                        |
| Se archiva un ítem de una categoría que un escenario incluyó en bloque                                              | Igual, mirado al revés: aviso pasivo, nunca se remueve solo.                                                                                                                                                                            |
| Un escenario queda vacío (0 ítems, 0 composiciones)                                                                 | Válido, total $0. No hay razón de dominio para prohibirlo.                                                                                                                                                                              |
| Se cambia la categoría de un `ExpenseItem` ya seleccionado en un escenario que vino de "agregar categoría completa" | El ítem se mueve, pero `addedViaCategoryId` en el `ScenarioItem` ya existente no cambia — es procedencia histórica, no un puntero vivo.                                                                                                 |
| Proyección a 6/12 meses de un escenario con ítems `ONE_TIME`                                                        | No entran en la proyección recurrente; se muestran como línea aparte ("+$X en costos únicos"). Detalle de UI exacto queda abierto (ya señalado en ADR-0005 punto 11).                                                                   |
| Escenario vinculado a un ingreso `ONE_TIME` (ej. un bono)                                                           | No cuenta para la cobertura mensual recurrente.                                                                                                                                                                                         |
| Dos escenarios "activos" simultáneamente                                                                            | Permitido: `ACTIVE` es un estado de visibilidad, no un flag de línea base única.                                                                                                                                                        |

## Alternativas descartadas

- **Todo vivo (incluida la categoría)**: más simple de implementar, pero contradice directamente ADR-0005 punto 8 — "Vectra nunca modifica silenciosamente".
- **Todo snapshot (incluida la composición escenario-en-escenario)**: elimina la necesidad de recálculo recursivo, pero vacía de sentido la composición — sería idéntico a "duplicar", que ADR-0004 descartó explícitamente por el mismo motivo del ejemplo de Netflix.
- **Tabla `ScenarioCategorySubscription` separada** en vez de `addedViaCategoryId` en `ScenarioItem`: más explícita, pero añade una entidad y una sincronización extra (qué pasa si el usuario borra todos los ítems de esa procedencia pero la "suscripción" queda huérfana). El campo de procedencia logra el mismo resultado observable con menos estado que mantener consistente.
- **Cascada automática de archivado hacia arriba** (archivar un ítem lo quita de los escenarios que lo usan): descartado por violar directamente el principio rector de ADR-0005.
- **Línea base única por usuario** (`isBaseline` con unicidad forzada): más simple para calcular deltas sin preguntar, pero fuerza una jerarquía que el dueño del producto no pidió; se prefirió dejar `ACTIVE` como estado libre y que el comparador pregunte contra qué escenario calcular deltas.
- **Escenario ↔ Ingreso uno a uno**: más simple de mostrar en UI (un selector), pero no refleja la realidad de la mayoría de usuarios (más de una fuente de ingreso); se optó por many-to-many.
- **Diálogo interruptor al cambiar una categoría**: coherente con "preguntar antes de aplicar", pero interrumpe un flujo de edición de categoría con un modal que puede afectar varios escenarios a la vez; se prefirió un aviso pasivo revisable cuando el usuario quiera.

## Consecuencias

- Este documento es la base del RFC de implementación de `Scenario` (backend). Quedan fuera de este ADR, por ser implementación y no dominio:
  - Esquema Prisma exacto (nombres de columnas, índices, tipo de constraint para unicidad de nombre activo).
  - Endpoints y forma de la API (cómo se expone el aviso pasivo al frontend: campo calculado en el `GET` de escenario vs. endpoint separado de "sincronizaciones pendientes").
  - Algoritmo exacto de detección de ciclos (recursión en el servicio vs. CTE recursiva en Postgres) — nota de rendimiento, no de dominio.
  - Diseño UI del comparador y de la señal de "revisar cambios de categoría".
- `ExpenseItem`/`Income` (RFC-0021) necesitarán el guard de "archivar en vez de borrar cuando hay referencias" una vez existan `ScenarioItem`/`ScenarioIncome` — ya quedó marcado con comentario en el código de RFC-0021.
- El comparador de escenarios (dashboard, ADR-0005 § Consecuencias) se apoya en la regla 6 (cálculo de totales) y en la regla 2 (archivado no muta totales) para mostrar deltas y proyecciones de forma consistente.
