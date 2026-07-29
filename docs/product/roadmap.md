# Roadmap — Vectra

Secuencia lógica de fases, sin fechas comprometidas. Reorientado tras [ADR-0005](../decisions/0005-financial-scenarios.md): los escenarios financieros son el eje del producto; el ledger construido en las fases 0–1 se conserva como vista de registro histórico.

## Fase 0 — Definición ✅

- Visión de producto, modelo de dominio, stack técnico ([ADR-0001](../decisions/0001-tech-stack.md)).

## Fase 1 — Base construida ✅ (ledger)

- Autenticación y gestión de sesión (JWT + refresh).
- CRUD de cuentas, categorías y transacciones (backend y frontend).
- Presupuestos, transacciones recurrentes, endpoints de dashboard y reports (backend).

## Fase 2 — Escenarios financieros (foco actual)

1. **Backend de productos e ingresos** ✅ (RFC-0021): `ExpenseItem` (nombre, precio, frecuencia mensual/anual/esporádico, categoría obligatoria) e `Income` (nombre, frecuencia mensual/semanal/anual/esporádico). Únicos entre activos por usuario, organizados por categorías.
2. **Backend de escenarios** ✅ (RFC-0022): `Scenario` (estados activo/inactivo/archivado) con `ScenarioItem`/`ScenarioIncome` como snapshots explícitos de productos e ingresos (nunca referencia viva — un cambio en el producto original nunca modifica el escenario en silencio), `ScenarioComposition` para escenario-en-escenario con detección de ciclos (BFS en service layer), y `GET /scenarios/:id/summary` con totales, proyecciones (mensual/6m/12m, prorrateo de anuales, esporádicos aparte), cobertura de ingresos y el flag `hasUpdates` (comparando `lastSyncedAt` contra el `updatedAt` del recurso original). El endpoint de sincronización (`POST /sync`) queda pospuesto para el RFC de composer/frontend, que es quien lo consume.
3. **CRUD UI de productos, categorías e ingresos**: pantalla de categoría con su total, creación de productos desde categoría o escenario (categoría inline), sección de ingresos con proyecciones para recurrentes.
4. **Composer de escenarios**: construir escenarios combinando productos, categorías completas y otros escenarios, con total en vivo; UI para aplicar la sincronización cuando `hasUpdates` señala que un producto/ingreso/escenario incluido cambió.
5. **Comparador y proyecciones**: escenarios lado a lado, deltas contra el escenario activo, proyecciones a 6/12 meses (introduce Recharts).
6. **Cobertura de ingresos**: ya expuesta por el backend (`GET /scenarios/:id/summary`); falta su representación en la UI.
7. **Reorganización del nav**: escenarios como punto de entrada; ledger agrupado como sección de registro histórico.

## Fase 3 — Consolidación

- Picos reales de cobros anuales en la proyección (mes de cobro por producto).
- Puente ledger → escenarios: sugerir un escenario a partir del gasto real registrado.
- Exportación de datos propios (CSV).
- Mejoras de UX en creación rápida de productos (plantillas, precios sugeridos).

## Fase 4 — Expansión (ideas aparcadas, no comprometidas)

- Conexión automática con bancos.
- Metas de ahorro y proyecciones sobre ingresos.
- Soporte multi-moneda.
- Escenarios compartidos (pareja/familia).

## Fuera de roadmap por ahora

- Funcionalidad para equipos/empresas.
- Asesoría financiera automatizada o recomendaciones de inversión.
