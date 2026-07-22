# Glosario de dominio — Pulse Finance

Términos de negocio a usar de forma consistente en código, documentación y commits. Ver también el modelo de entidades en [architecture/data-model.md](architecture/data-model.md).

| Término | Definición |
|---|---|
| **Account** (cuenta) | Agrupador de transacciones dentro del sistema del usuario (ej. efectivo, cuenta bancaria, tarjeta). No es una cuenta bancaria real conectada, es una representación manual dentro de Pulse Finance. |
| **Transaction** (transacción) | Un movimiento individual de dinero: un gasto o un ingreso, con monto, fecha, cuenta y categoría. |
| **Category** (categoría) | Clasificación temática de una transacción (ej. Comida, Transporte, Salario). Una categoría es de gasto o de ingreso, nunca ambos. |
| **Budget** (presupuesto) | Límite de gasto definido por el usuario para una categoría, en un período determinado (ej. mensual). |
| **Budget period** (período de presupuesto) | Ventana de tiempo sobre la que se evalúa un presupuesto (ej. un mes calendario). |
| **Recurring transaction** (transacción recurrente) | Plantilla que genera transacciones automáticamente cada cierta frecuencia (ej. salario mensual, suscripción semanal/mensual). |
| **Net worth** (patrimonio neto) | Suma de los balances de todas las cuentas del usuario en un momento dado. No confundir con "gasto del período". |
| **Balance** | Monto actual disponible en una cuenta, derivado de sus transacciones (no almacenado como fuente de verdad independiente). |
| **MVP** | Alcance mínimo viable definido en [product/vision.md](product/vision.md), Fase 1 del [roadmap](product/roadmap.md). |
