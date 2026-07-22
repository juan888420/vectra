# Roadmap — Pulse Finance

Secuencia lógica de fases, sin fechas comprometidas. Cada fase asume que la anterior está completa y validada.

## Fase 0 — Definición (actual)

- Visión de producto y alcance del MVP.
- Modelo de dominio conceptual.
- Decisión de stack técnico (ver [ADR-0001](../decisions/0001-tech-stack.md)).

## Fase 1 — MVP

- Autenticación y gestión de sesión de un solo usuario.
- CRUD de cuentas, categorías y transacciones (registro manual).
- Presupuestos por categoría y período mensual.
- Vista de resumen: balance, gasto vs. presupuesto, desglose por categoría.
- Transacciones recurrentes básicas.

## Fase 2 — Consolidación

- Reportes históricos (comparación entre meses/períodos).
- Mejoras de UX en registro rápido de transacciones (ej. atajos, plantillas).
- Categorías con subcategorías o etiquetas adicionales.
- Exportación de datos propios (CSV) para respaldo del usuario.

## Fase 3 — Expansión (ideas aparcadas, no comprometidas)

- Conexión automática con bancos (agregación de cuentas vía proveedor externo).
- Metas de ahorro y proyecciones simples.
- Soporte multi-moneda.
- Cuentas compartidas (pareja/familia) manteniendo privacidad por transacción.

## Fuera de roadmap por ahora

- Funcionalidad orientada a equipos/empresas (facturación, múltiples clientes, roles).
- Asesoría financiera automatizada o recomendaciones de inversión.
