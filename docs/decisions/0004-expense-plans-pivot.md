# ADR-0004: Planes de gasto como feature central del producto

## Estado

`accepted`

## Contexto

Hasta ahora Vectra se diseñó como un **ledger de contabilidad real**: el usuario registra transacciones que ya ocurrieron (gastos e ingresos inmutables), y los balances, presupuestos y reportes se derivan de ese historial (ver [`data-model.md`](../architecture/data-model.md) y ADRs 0001–0003). El backend de ese modelo está completo (auth, accounts, categories, transactions, budgets, recurring transactions, dashboard, reports) y el frontend cubre el CRUD de cuentas, categorías y transacciones.

Al usar el producto, el dueño del proyecto redefinió qué problema quiere resolver realmente: no registrar el pasado, sino **simular y comparar escenarios de gasto futuro**. El caso de uso concreto:

- Crear un "gasto" con nombre libre (ej. "gasto mensual") que agrupa productos/servicios con nombre y precio (Netflix $50.000 COP, Claude $70.000 COP, gym, corte de pelo...), cada uno con su categoría.
- Ver el total mensual de ese plan y su proyección a 6 y 12 meses.
- Crear varios planes y combinarlos ("suposiciones"): un plan puede incluir a otro plan existente además de productos propios, para comparar opciones de gasto sin borrar nada.
- Opcionalmente, vincular un plan a una fuente de ingreso ("gasto 1 se paga del sueldo fijo") para ver cuánto consume y cuánto queda libre.

El registro manual de cada transacción real tiene demasiada fricción para este objetivo; la comparación de planes de gasto fijo es lo que el usuario haría hoy en notas o Excel. Además, el Dashboard (RFC-0020) fue revertido y no existe, por lo que no hay UI central que quede obsoleta con el giro.

## Decisión

**Los planes de gasto (expense plans) pasan a ser la feature central de Vectra.** El ledger de transacciones existente se conserva como feature secundaria (no se elimina ni se rompe), pero el desarrollo futuro y el dashboard se diseñan alrededor de los planes.

Lineamientos de dominio acordados (el detalle fino se definirá en los RFCs de implementación):

1. **Entidades nuevas**: `ExpensePlan` (nombre, estado) y `ExpensePlanItem` (nombre, precio como `Money`, frecuencia, categoría opcional). Un ítem representa un gasto hipotético recurrente, no una transacción real.
2. **Frecuencia por ítem**: al menos `MONTHLY` y `YEARLY`. En el total mensual del plan, los ítems anuales se **prorratean** (precio ÷ 12) y se marcan visualmente como anuales. Mostrar el pico real del cobro anual en el mes que cae queda como mejora futura (requeriría un campo opcional de mes de cobro).
3. **Composición por referencia viva**: un plan puede incluir otros planes. Editar el plan base actualiza automáticamente los planes que lo incluyen — ese es el objetivo declarado ("no borrar productos, comparar opciones"). Los ciclos están prohibidos (A no puede incluir a B si B ya incluye a A, directa o transitivamente).
4. **Estados**: activo/inactivo (toggle de simulación) y archivado (mismo patrón archivar-no-borrar del resto del dominio).
5. **Proyecciones derivadas, nunca almacenadas**: total mensual, total por categoría dentro del plan, y proyección a 6/12 meses se calculan siempre a partir de los ítems (misma filosofía que la regla de negocio 7 del ledger: los agregados no se guardan).
6. **Categorías se reutilizan**: los ítems referencian la entidad `Category` existente. La UI permitirá crear una categoría inline durante la creación del ítem, además del CRUD ya existente.
7. **Fuentes de ingreso**: entidad ligera de ingresos recurrentes con nombre (ej. "sueldo fijo", monto mensual). Un plan puede vincularse opcionalmente a una fuente para mostrar cobertura (% consumido, monto restante). Es opcional y no bloquea el uso de planes.

### Alternativas descartadas

- **Forzar la idea sobre las entidades existentes** (`RecurringTransaction` + `Budget`): las plantillas recurrentes generan transacciones reales en el ledger, y los presupuestos miden gasto real contra límite — ambas cosas contradicen la naturaleza hipotética de un plan. Mezclarlas rompería el principio de ledger inmutable o exigiría flags de "simulación" por todas partes.
- **Descartar el ledger**: innecesario. No estorba, su código está probado, y a futuro puede alimentar los planes (ej. sugerir un plan a partir del gasto real).
- **Composición por copia** (duplicar ítems al incluir un plan): más simple de implementar, pero contradice el objetivo del usuario — al subir el precio de Netflix habría que editarlo en cada copia.

## Consecuencias

- [`product/vision.md`](../product/vision.md), [`product/roadmap.md`](../product/roadmap.md) y [`glossary.md`](../glossary.md) se actualizan para reflejar el nuevo foco.
- El dashboard pendiente ya no será el genérico planificado en RFC-0020 (salud financiera, comparación de meses); se diseñará alrededor de planes: totales, proyecciones y comparación de escenarios lado a lado. Recharts entrará al frontend con ese propósito.
- Orden de construcción recomendado: entidad de planes + ítems (backend) → CRUD UI de planes → composición → proyecciones y dashboard comparativo → fuentes de ingreso y cobertura.
- Los tests y features del ledger existente se mantienen; cualquier cambio que los afecte requiere justificación propia, no es parte de este giro.
