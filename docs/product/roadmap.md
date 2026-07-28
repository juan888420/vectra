# Roadmap — Vectra

Secuencia lógica de fases, sin fechas comprometidas. Reorientado tras [ADR-0004](../decisions/0004-expense-plans-pivot.md): los planes de gasto son el foco; el ledger construido en las fases 0–1 se conserva como base y feature secundaria.

## Fase 0 — Definición ✅

- Visión de producto, modelo de dominio, stack técnico ([ADR-0001](../decisions/0001-tech-stack.md)).

## Fase 1 — Base construida ✅ (ledger)

- Autenticación y gestión de sesión (JWT + refresh).
- CRUD de cuentas, categorías y transacciones (backend y frontend).
- Presupuestos, transacciones recurrentes, endpoints de dashboard y reports (backend).

## Fase 2 — Planes de gasto (foco actual)

1. **Entidad y CRUD backend**: `ExpensePlan` + `ExpensePlanItem` (precio, frecuencia mensual/anual, categoría), estados activo/inactivo y archivado.
2. **CRUD UI de planes**: crear/editar planes e ítems, creación inline de categorías, totales por plan y por categoría.
3. **Composición**: incluir planes dentro de planes por referencia viva, con prohibición de ciclos.
4. **Proyecciones y dashboard comparativo**: total mensual prorrateado, proyección a 6/12 meses, comparación de escenarios lado a lado (introduce Recharts).
5. **Fuentes de ingreso y cobertura**: ingresos recurrentes con nombre, vínculo opcional plan → fuente (% consumido, restante).

## Fase 3 — Consolidación

- Picos reales de cobros anuales en la proyección (mes de cobro por ítem).
- Puente ledger → planes: sugerir un plan a partir del gasto real registrado.
- Exportación de datos propios (CSV).
- Mejoras de UX en creación rápida de ítems (plantillas, precios sugeridos).

## Fase 4 — Expansión (ideas aparcadas, no comprometidas)

- Conexión automática con bancos.
- Metas de ahorro y proyecciones sobre ingresos.
- Soporte multi-moneda.
- Planes compartidos (pareja/familia).

## Fuera de roadmap por ahora

- Funcionalidad para equipos/empresas.
- Asesoría financiera automatizada o recomendaciones de inversión.
