# Roadmap — Vectra

Secuencia lógica de fases, sin fechas comprometidas. Reorientado tras [ADR-0005](../decisions/0005-financial-scenarios.md): los escenarios financieros son el eje del producto; el ledger construido en las fases 0–1 se conserva como vista de registro histórico. Reorientado de nuevo tras [ADR-0006](../decisions/0006-question-driven-interface.md): las pantallas principales dejan de ser CRUDs y pasan a responder preguntas financieras concretas (métricas derivadas como contenido principal, gestión de datos como acción secundaria).

## Fase 0 — Definición ✅

- Visión de producto, modelo de dominio, stack técnico ([ADR-0001](../decisions/0001-tech-stack.md)).

## Fase 1 — Base construida ✅ (ledger)

- Autenticación y gestión de sesión (JWT + refresh).
- CRUD de cuentas, categorías y transacciones (backend y frontend).
- Presupuestos, transacciones recurrentes, endpoints de dashboard y reports (backend).

## Fase 2 — Escenarios financieros y pantallas que responden preguntas (foco actual)

Backend base (RFC-0021/0022, ya construido):

1. **Backend de productos e ingresos** ✅ (RFC-0021): `ExpenseItem` (nombre, precio, frecuencia mensual/anual/esporádico, categoría obligatoria) e `Income` (nombre, frecuencia mensual/semanal/anual/esporádico). Únicos entre activos por usuario, organizados por categorías.
2. **Backend de escenarios** ✅ (RFC-0022): `Scenario` (estados activo/inactivo/archivado) con `ScenarioItem`/`ScenarioIncome` como snapshots explícitos de productos e ingresos (nunca referencia viva — un cambio en el producto original nunca modifica el escenario en silencio), `ScenarioComposition` para escenario-en-escenario con detección de ciclos (BFS en service layer), y `GET /scenarios/:id/summary` con totales, proyecciones (mensual/6m/12m, prorrateo de anuales, esporádicos aparte), cobertura de ingresos y el flag `hasUpdates` (comparando `lastSyncedAt` contra el `updatedAt` del recurso original). El endpoint de sincronización (`POST /sync`) queda pospuesto para el RFC de composer/frontend, que es quien lo consume.

Transformadas de CRUD a pantallas que responden preguntas (RFC-0023):

3. **Categorías responden "¿cuánto gasto en esta área?"** ✅: `GET /categories/:id/summary` (backend) + `CategoryDetailPage` (mensual/6m/anual, lista de productos, creación de producto inline).
4. **Productos responden "¿cuánto me cuesta mantener esto?"** ✅: `GET /expense-items/:id/summary` (incluye la relación inversa "en qué escenarios se usa") + `ExpenseItemDetailPage`. Creación inline (de producto y de categoría) ya disponible desde el composer de escenarios.
5. **Ingresos responden "¿cuánto me genera esta fuente?"** ✅: `GET /incomes/:id/summary` + `IncomeDetailPage` (mensual/6m/anual, `ONE_TIME` sin proyección). Sin agrupación por categoría (decidido explícitamente, ver ADR-0006).
6. **Escenarios responden "¿cuánto cuesta este estilo de vida?"** ✅: ya no es una lista CRUD — `ScenariosLayout` es un layout master-detail persistente (sidebar con mensual por escenario vía `GET /scenarios` enriquecido + panel de detalle), con auto-selección del escenario activo al entrar. Pendiente: agregar una categoría completa de una sola vez (ADR-0005 §7, hoy solo producto por producto), UI de sincronización cuando `hasUpdates` lo señala (el endpoint de sync todavía no existe), y comparador con deltas contra el escenario activo (ADR-0005 §12, introduce Recharts).
7. **Ruta principal → Escenarios** ✅ (ADR-0006): `/` deja de ser el Dashboard del ledger y pasa a Escenarios (auto-selección del activo).
8. **Reorganización completa del nav** ✅: primario (Escenarios, Categorías, Productos, Ingresos) + dropdown "Historial" (Dashboard, Cuentas, Transacciones). `Budget` se mantiene en el producto; no se marca como candidato a eliminar por ahora (ver ADR-0006). No hay `ReportsPage` en el frontend todavía, así que no hay nada que mover ahí.

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
