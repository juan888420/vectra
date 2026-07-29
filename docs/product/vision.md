# Visión de producto — Vectra

> Actualizada tras [ADR-0005](../decisions/0005-financial-scenarios.md): los escenarios financieros son el eje del producto. El ledger de transacciones reales queda como vista de registro histórico.

## Problema

La mayoría de las personas no puede responder preguntas del tipo "¿qué pasa si pago ChatGPT y Cursor?", "¿qué pasa si compro un carro?", "¿qué pasa si me independizo?". Las apps de finanzas personales típicas exigen registrar cada transacción manualmente (demasiada fricción) y solo miran el pasado; las hojas de cálculo obligan a rearmar fórmulas cada vez que se quiere evaluar una opción nueva. El resultado: la gente toma decisiones de gasto recurrente sin ver el costo acumulado ni comparar alternativas.

## Usuario objetivo

Personas que gestionan sus finanzas por su cuenta y quieren:

- Modelar su gasto recurrente real una sola vez, sin fricción.
- Crear escenarios hipotéticos ("¿y si además pago esto?", "¿y si me independizo?") reutilizando lo que ya modelaron.
- Comparar escenarios entre sí y contra su situación actual, con totales y proyecciones a 6 y 12 meses.
- Saber cuánto gastan por área de su vida (Tecnología, Streaming, Comida...).
- Opcionalmente, contrastar un escenario contra sus ingresos ("¿qué % de mi sueldo se va en esto?").

No es el público objetivo: equipos, empresas, contadores, ni usuarios que buscan asesoría de inversión.

## Propuesta de valor

Vectra es un **simulador de escenarios financieros personales**: en vez de registrar el pasado, el usuario construye simulaciones de futuro y las compara. Los bloques (productos, categorías, escenarios) se crean una vez y se reutilizan; los totales y proyecciones se calculan solos; y ninguna simulación cambia sin que el usuario lo decida.

## Conceptos centrales

- **Escenario**: simulación nombrada de un estilo de vida o decisión ("Escenario actual", "Escenario IA", "Escenario con carro"). Estados activo/inactivo/archivado; normalmente un solo escenario activo representa la situación real. Muestra total mensual y proyecciones a 6 y 12 meses.
- **Producto**: un gasto con nombre, precio y frecuencia (mensual, anual o esporádico). Existe una única vez en el sistema; se crea desde una categoría o desde un escenario.
- **Categoría**: área de la vida que organiza productos y muestra su total (ej. "Tecnología: Claude + ChatGPT + Cursor = $X/mes").
- **Ingreso**: sección independiente (sueldo, freelance, dividendos, bonos) con frecuencia mensual, semanal, anual o esporádica. Los recurrentes proyectan a 6/12 meses; la relación con escenarios es opcional en ambas direcciones.

## Principios de producto

1. **Reutilizar antes que duplicar**: los productos existen una vez; las categorías los organizan; los escenarios los combinan.
2. **Nada cambia en silencio**: si un cambio compartido (ej. editar una categoría) afecta a otros escenarios, Vectra pregunta y el usuario elige cuáles actualizar.
3. **Proyecciones derivadas, nunca almacenadas**: totales y proyecciones se calculan siempre desde los datos.
4. **Comparación relativa**: los escenarios hipotéticos se leen como deltas contra el escenario activo ("+$120.000/mes sobre tu situación actual").
5. **Lo esporádico no contamina lo recurrente**: gastos e ingresos puntuales se muestran aparte, sin inflar las proyecciones mensuales.

## Alcance del MVP de escenarios

**Dentro de alcance:**

- CRUD de escenarios con estados activo/inactivo/archivado.
- Productos con precio y frecuencia (mensual/anual/esporádico), creables desde categoría o escenario (con creación inline de categoría).
- Categorías con pantalla propia y total de sus productos.
- Composición de escenarios: productos individuales, categorías completas (como selección inicial) y otros escenarios, sin ciclos.
- Propagación con confirmación cuando cambia contenido compartido.
- Totales por escenario (prorrateo de anuales) y proyecciones a 6/12 meses.
- Ingresos con frecuencias múltiples, proyecciones para los recurrentes y vínculo opcional escenario ↔ ingreso (cobertura: % consumido, restante).
- Comparador de escenarios (totales, deltas contra el activo, proyecciones lado a lado).

**Fuera de alcance por ahora:**

- Picos reales de cobros anuales en la proyección (mes exacto de cobro).
- Conexión automática con bancos, multi-moneda simultáneo, multi-usuario.
- Convertir un escenario en transacciones reales del ledger automáticamente.

## Feature secundaria: ledger de transacciones

El registro manual de transacciones reales (cuentas, categorías, transacciones, presupuestos, recurrencias) ya está construido y se conserva funcional como **vista de registro histórico**, agrupado como sección secundaria en la navegación. A futuro puede alimentar los escenarios (ej. sugerir un escenario a partir del gasto real registrado).

## Métricas de éxito (cualitativas)

- Un usuario puede crear su primer escenario con 5 productos en menos de 2 minutos.
- Un usuario puede responder "¿cuánto me costaría este estilo de vida en un año?" de un vistazo.
- Un usuario puede comparar dos escenarios sin duplicar ni borrar datos.
- Un usuario sabe cuánto gasta en cada área de su vida sin hacer cuentas.
