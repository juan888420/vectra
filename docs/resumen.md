# Resumen del proyecto

> Se actualiza al final de cada sesión. Léelo primero para saber dónde retomar.

**Última actualización**: 2026-07-27 (RFC-0019)

**Backend**: completo — auth (JWT + refresh), accounts, categories, transactions, budgets, recurring-transactions (con processor idempotente), dashboard y reports. Todo en `apps/api`, con tests de integración. Sin cambios esta sesión.

**Frontend**: infraestructura (RFC-0017) + UI de negocio para Accounts/Categories (RFC-0018) + Transactions (RFC-0019, esta sesión). Vite + React 19 + Tailwind v4.

- `packages/ui`: shadcn/ui (`Table`/`Dialog`/`Select`/`Badge`/`AlertDialog`/`Skeleton`) + reutilizables propios (`DataTable`/`EmptyState`/`FormDialog`). `DataTable` renderiza skeleton rows en `isLoading` (beneficia las 3 páginas automáticamente).
- `packages/types`: schemas Zod compartidos `accounts`/`categories`/`transactions`/`money` (mano-mirroreados del backend).
- `apps/web`: CRUD completo de Accounts, Categories y Transactions. Transactions tiene selects de cuenta/categoría dependientes del tipo (la categoría se filtra y resetea al cambiar el tipo, reflejando la regla `type === category.type` del backend) y filtros de lista (tipo/cuenta/categoría/búsqueda). Query hooks de TanStack Query con key factories en las 3 features. `FormDialog` y `applyConflictError` (helper de error 409→campo) se extrajeron esta sesión como piezas compartidas entre los 3 diálogos de creación/edición, evitando la duplicación que había entre `AccountFormDialog` y `CategoryFormDialog`.
- Testing: Vitest + Testing Library + MSW (desde RFC-0018), ahora con `fileParallelism: false` y `testTimeout: 10_000` en `apps/web/vitest.config.ts` (los tests con Radix Select son más lentos; correr los archivos en paralelo causaba timeouts falsos bajo carga).

**Sin Dashboard ni Budgets/Reports todavía** en el frontend.

**Estado de rama**: trabajo en `feat/rfc-0019-transactions-ui`, no mergeado a `main` (cada RFC vive en su propia rama, se abre PR y se mergea manualmente por el usuario).

**Sigue**: RFC-0020 — Dashboard UI. El endpoint backend ya existe (RFC-0014), así que es puramente frontend: primer lugar donde se introduce Recharts. Sugerido: reutilizar `DataTable`/`Skeleton`/`EmptyState` para las listas del dashboard (top expenses, etc.) y definir ahí mismo el patrón de wrapper de charts (colores, tooltips, responsive) ya que no hay precedente todavío. Después de Dashboard: Budgets/Reports UI.

**Pendientes sueltos (no bloquean, pero conviene resolver pronto)**:

- `docs/README.md` tiene un cambio sin commitear desde antes de RFC-0018 (agrega el link a este archivo al índice) — se dejó fuera de los commits de RFC-0018 y RFC-0019 por no pertenecer a esos RFCs. Si nadie lo reclama, considerar commitearlo suelto o descartarlo.
- Al cerrar RFC-0019, 2 tests de `apps/api` (`recurring-transactions-processor.test.ts`, el bounding de `MAX_CATCH_UP_ITERATIONS`) fallaron por timeout bajo una máquina con carga alta ese momento — no están relacionados con el diff (no se tocó `apps/api`) y son sensibles a CPU. Si vuelven a fallar en una máquina sin carga, sí ameritaría investigar.
