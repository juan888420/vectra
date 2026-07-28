# Visión de producto — Vectra

> Actualizada tras el giro de producto registrado en [ADR-0004](../decisions/0004-expense-plans-pivot.md): los planes de gasto pasan a ser la feature central; el ledger de transacciones reales queda como feature secundaria.

## Problema

La mayoría de las personas no sabe cuánto le cuesta realmente su estilo de vida, ni puede responder preguntas del tipo "¿qué pasa si además pago este servicio?" o "¿cuánto me cuesta esto de aquí a un año?". Las apps de finanzas personales típicas exigen registrar cada transacción manualmente (demasiada fricción para mantenerlo), y las hojas de cálculo requieren armar las fórmulas a mano cada vez que se quiere comparar una opción nueva. El resultado: la gente decide gastos recurrentes (suscripciones, servicios, hábitos) sin ver el costo acumulado ni comparar alternativas.

## Usuario objetivo

Personas que gestionan sus finanzas por su cuenta y quieren:

- Armar listas nombradas de sus gastos recurrentes (suscripciones, servicios, hábitos) con precio y categoría, sin fricción.
- Ver cuánto suma ese estilo de vida al mes, y cuánto costaría en 6 o 12 meses.
- Comparar escenarios: "mi gasto actual" vs. "mi gasto actual + estas cosas nuevas", sin borrar ni rehacer nada.
- Opcionalmente, contrastar un plan contra sus ingresos ("¿qué % de mi sueldo se va en esto?").

No es el público objetivo: equipos, empresas, contadores, ni usuarios que buscan asesoría de inversión.

## Propuesta de valor

Vectra es un **simulador de planes de gasto**: en vez de registrar el pasado, el usuario modela su gasto recurrente y compara opciones de futuro. Crear un plan toma segundos, los totales y proyecciones se calculan solos, y los planes se componen entre sí para explorar "suposiciones" sin destruir las anteriores.

## Alcance del nuevo foco (MVP de planes)

**Dentro de alcance:**

- Planes de gasto con nombre libre; cada plan agrupa ítems (nombre, precio, frecuencia mensual o anual, categoría).
- Total mensual por plan (con prorrateo de ítems anuales) y proyección a 6 y 12 meses.
- Total por categoría dentro de un plan (ej. "Tecnología: Claude + ChatGPT + Cursor = $X/mes").
- Varios planes por usuario, con estados activo/inactivo y archivado.
- Composición: un plan puede incluir otros planes por referencia viva (editar el plan base actualiza a quienes lo incluyen).
- Categorías reutilizadas del dominio existente, con creación inline al añadir un ítem.
- Fuentes de ingreso con nombre y vínculo opcional plan → fuente (cobertura: % consumido, restante).
- Dashboard comparativo de planes (totales, proyecciones, escenarios lado a lado).

**Fuera de alcance por ahora:**

- Picos reales de cobros anuales en la proyección (mes exacto de cobro) — mejora futura sobre el prorrateo.
- Conexión automática con bancos, multi-moneda simultáneo, multi-usuario.
- Convertir un plan en transacciones reales del ledger automáticamente.

## Feature secundaria: ledger de transacciones

El registro manual de transacciones reales (cuentas, categorías, transacciones, presupuestos, recurrencias) ya está construido y se conserva funcional, pero deja de dirigir el roadmap. A futuro puede alimentar los planes (ej. sugerir un plan a partir del gasto real registrado).

## Métricas de éxito (cualitativas)

- Un usuario puede crear su primer plan con 5 ítems en menos de 2 minutos.
- Un usuario puede responder "¿cuánto me costaría este estilo de vida en un año?" de un vistazo.
- Un usuario puede comparar dos escenarios de gasto sin duplicar ni borrar datos.
