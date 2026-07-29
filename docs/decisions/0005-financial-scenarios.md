# ADR-0005: Escenarios financieros como eje del producto

## Estado

`accepted` — supersede parcialmente a [ADR-0004](0004-expense-plans-pivot.md) (mantiene su dirección general, corrige el modelo conceptual).

## Contexto

El ADR-0004 estableció los "planes de gasto" como feature central: listas nombradas de gastos hipotéticos con ítems propios (`ExpensePlanItem` colgando del plan, con categoría opcional). Al refinar la visión, el dueño del producto redefinió el concepto con más precisión:

- El eje del producto no es "listas de gastos" sino **escenarios financieros**: simulaciones nombradas de un estilo de vida o de una decisión ("Escenario actual", "Escenario IA", "Escenario con carro", "Escenario independiente") que se construyen, se proyectan y se **comparan** entre sí.
- Los productos (gastos individuales: Netflix, Claude, Cursor...) no pertenecen a un escenario: **existen una única vez en el sistema**. Las categorías los organizan por área de la vida (Tecnología, Streaming, Comida); los escenarios los combinan para construir simulaciones.
- Un producto se puede crear desde una categoría o desde un escenario (con asociación a categoría inline), y en ambos casos es el mismo producto reutilizable.
- Los ingresos son una sección independiente de primer nivel, con frecuencias propias, no una "entidad ligera" auxiliar.

El modelo del ADR-0004 (ítem poseído por el plan) no soporta este flujo bidireccional ni la reutilización de productos entre escenarios, por lo que se corrige antes de implementar.

## Decisión

**Los escenarios financieros son el eje del producto y el punto de entrada de la experiencia.** El modelo conceptual queda así:

### Producto (product)

1. Un producto es un gasto con nombre, precio (`Money`) y frecuencia. Existe **una única vez** en el sistema; nunca se duplica para reutilizarlo.
2. Frecuencias: al menos `MONTHLY` y `YEARLY`, más **esporádico** (`ONE_TIME`): un gasto puntual que no participa en las proyecciones recurrentes.
3. Se crea desde una categoría o desde un escenario. En el segundo caso, la app ofrece asociarlo a una categoría existente o crearla inline.
4. Los ítems anuales se prorratean (÷ 12) en el total mensual y se marcan visualmente como anuales (igual que en ADR-0004).

### Categoría (category)

5. Organiza productos por área de la vida (Tecnología, Streaming, Comida) y muestra el total de sus productos. Es una pantalla propia con su agregado, no solo una etiqueta.
6. Se reutiliza la entidad `Category` existente del ledger; su evolución exacta (relación con productos, convivencia con transacciones) se define en el RFC de implementación.

### Escenario (scenario)

7. Un escenario mantiene una **selección explícita de productos**. Al agregar una categoría completa, Vectra propone incorporar todos sus productos como selección inicial.
8. **Propagación con confirmación**: si una categoría cambia después (se agregan, eliminan o modifican productos), la app **nunca** actualiza los escenarios automáticamente; pregunta al usuario si desea aplicar los cambios a los escenarios afectados, pudiendo elegir cuáles actualizar. Principio rector: **el usuario siempre decide cuándo un cambio compartido afecta a otros escenarios; Vectra nunca modifica silenciosamente una simulación.**
9. Un escenario puede incluir otros escenarios (composición). Los ciclos están prohibidos (directa o transitivamente), igual que en ADR-0004.
10. Estados: **activo / inactivo / archivado** (recuperable, mismo patrón archivar-no-borrar del dominio). No hay borrado físico de escenarios referenciados. Normalmente un solo escenario activo representa la situación real del usuario.
11. Cada escenario muestra total mensual, proyección a 6 meses y anual — siempre derivados, nunca almacenados (regla del ADR-0004 que se mantiene). Los productos esporádicos no participan en proyecciones recurrentes; se presentan aparte (ej. "costo único de entrada" — detalle a confirmar en diseño UI).
12. Principio de UX: la comparación es **relativa al escenario activo** (deltas: "+$X/mes sobre tu escenario actual"), no solo totales absolutos.

### Ingreso (income)

13. Sección independiente de primer nivel. Cada ingreso tiene nombre (Sueldo, Freelance, Dividendos, Bonos) y frecuencia: mensual, semanal, anual o esporádico.
14. Los ingresos recurrentes proyectan (mensual, 6 meses, anual); los esporádicos no muestran proyecciones.
15. Relación escenario ↔ ingreso **opcional en ambas direcciones**: puede existir un escenario sin ingresos y un ingreso sin escenarios. Cuando existe el vínculo, se muestra cobertura (% consumido, monto restante).

### Ledger

16. El ledger (cuentas, transacciones, presupuestos, recurrencias, dashboard, reports) **deja de ser el flujo principal** y pasa a ser una vista de registro histórico, agrupada como sección secundaria en la navegación. No se elimina código ni tests; cualquier cambio que lo afecte requiere justificación propia.

## Qué se mantiene del ADR-0004

- El giro de "registrar el pasado" a "simular el futuro".
- Prorrateo de anuales, proyecciones derivadas nunca almacenadas, prohibición de ciclos en composición, patrón archivar-no-borrar, reutilización de `Category`.
- El descarte de forzar la idea sobre `RecurringTransaction`/`Budget` y el descarte de eliminar el ledger.

## Qué corrige del ADR-0004

- **Terminología**: "expense plan" → **escenario** (scenario); "expense plan item" → **producto** (product). El nombre importa: "plan de gasto" sugiere presupuesto; "escenario" comunica simulación y comparación.
- **Propiedad del producto**: el ítem ya no pertenece al plan; el producto existe una vez, las categorías lo organizan y los escenarios lo referencian.
- **Composición ampliada**: un escenario incluye productos individuales, categorías completas (como selección inicial) y otros escenarios — no solo plan-incluye-plan.
- **Composición por referencia viva → selección explícita con propagación confirmada** (punto 8): la referencia viva silenciosa contradecía la confianza en los números de una simulación.
- **Ingresos**: de entidad ligera con monto mensual a sección de primer nivel con frecuencias múltiples y proyecciones propias.

## Consecuencias

- [`product/vision.md`](../product/vision.md), [`product/roadmap.md`](../product/roadmap.md) y [`glossary.md`](../glossary.md) se actualizan con esta terminología y modelo.
- El detalle fino de datos (esquema Prisma, mecánica de propagación, endpoints) se define en los RFCs de implementación de la Fase 2, que deben ceñirse a este modelo conceptual.
- El dashboard futuro se diseña como **comparador de escenarios**: cards lado a lado con deltas contra el escenario activo, proyecciones superponibles, cobertura de ingresos.
