# ADR-0006: Interfaz orientada a preguntas financieras, no a CRUD

## Estado

`accepted` — complementa a [ADR-0005](0005-financial-scenarios.md) (no cambia el modelo de datos ni lo supersede; formaliza cómo se presenta).

## Contexto

Con el backend de escenarios (RFC-0022) y su primera UI ya construidos, el dueño del producto probó Vectra de punta a punta y confirmó algo que ADR-0005 dejaba implícito pero nunca formalizó: las pantallas principales no deberían sentirse como gestión de datos (listar, crear, editar, archivar), sino como respuestas a preguntas financieras concretas. El modelo de dominio (Scenario, Category, ExpenseItem, Income) ya soporta esto — lo que faltaba era declarar el principio de interfaz explícitamente, para que guíe tanto las pantallas ya construidas como las que faltan (totales de categoría, detalle de producto, comparador, etc.).

Esta decisión es puramente de **experiencia de interfaz**: no agrega, quita ni cambia ninguna entidad, campo o regla de negocio ya aceptada en ADR-0002/0003/0005.

## Decisión

**Cada pantalla principal de Vectra responde una pregunta financiera explícita; administrar datos (crear, editar, archivar, eliminar) es una acción secundaria, nunca el propósito visual de la pantalla.**

### Las cuatro preguntas

1. **Escenarios** → ¿Cuánto cuesta este estilo de vida? (total mensual, proyección a 6 y 12 meses, cobertura de ingresos cuando hay un vínculo).
2. **Categorías** → ¿Cuánto gasto en esta área de mi vida? (total mensual/6m/anual de sus productos).
3. **Productos** → ¿Cuánto me cuesta mantener este producto o servicio? (total mensual/6m/anual, más en qué escenarios se usa).
4. **Ingresos** → ¿Cuánto dinero me genera esta fuente? (total mensual/6m/anual, cuando la frecuencia lo permite — `ONE_TIME` no proyecta).

### Principio de jerarquía visual

Las métricas derivadas (mensual, 6 meses, anual, y cobertura cuando aplica) son el contenido principal de cada pantalla — el primer elemento que el usuario ve y el que ocupa el protagonismo visual. Crear, editar, archivar y eliminar siguen existiendo (no se elimina ninguna capacidad), pero se ubican como controles secundarios (menús de acciones), nunca como el elemento dominante de la pantalla.

### Ruta principal del producto

`/` (la ruta de aterrizaje) pasa de `DashboardPage` a `ScenariosPage`. El Dashboard actual, construido enteramente sobre el ledger (cuentas, transacciones, presupuestos), no representa ya el eje del producto y queda como parte de la sección secundaria de ledger histórico hasta que se rediseñe alrededor de escenarios.

### Ledger histórico: se queda, sin cambios de alcance

`Account`, `Transaction`, `Report` y `Budget` permanecen en el producto como herramientas del ledger histórico (registro de lo que efectivamente ocurrió, distinto de la simulación). En particular, **`Budget` no se marca como candidato a eliminar** — su redundancia parcial con Categoría + cobertura de Ingreso, señalada en la sesión de análisis de producto, se revisa más adelante si la experiencia real lo confirma, no ahora.

### Qué NO cambia esta decisión

- Ningún modelo Prisma, endpoint o regla de negocio ya aceptado en ADR-0002/0003/0005.
- El principio de "propagación con confirmación" y "totales siempre derivados, nunca almacenados" (ADR-0004/0005) — este ADR los reafirma, no los reemplaza.
- El alcance de `Income` (no se agrupa por categoría) — se evaluó explícitamente y se descarta por ahora.

## Consecuencias

- El trabajo pendiente de Fase 2 del roadmap (CRUD de categorías/productos, composer de escenarios) se reformula: ya no es "completar el CRUD que falta", sino "transformar cada pantalla para que responda su pregunta" — con las métricas derivadas como entregable central, no como un extra sobre una lista administrativa.
- Quedan como trabajo concreto derivado de este principio (ya identificados, sin RFC todavía): totales de Categoría (endpoint nuevo), detalle de Producto con sus escenarios de uso (endpoint nuevo), totales de Ingreso en su pantalla, agregar una categoría completa a un escenario (ADR-0005 §7), creación de producto/categoría inline desde el composer (ADR-0005 §3), y el comparador de escenarios con deltas (ADR-0005 §12).
- `product/roadmap.md` y `resumen.md` se actualizan para reflejar esta reformulación y el cambio de ruta principal.
- Cuando el Dashboard se rediseñe alrededor de escenarios, probablemente absorba parte de lo que hoy hace `Reports` — decisión que se toma en su propio momento, no aquí.
