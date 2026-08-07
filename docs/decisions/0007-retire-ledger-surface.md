# ADR-0007: Retiro del ledger de la experiencia de producto

## Estado

`accepted` — supersede parcialmente a [ADR-0006](0006-question-driven-interface.md), sección "Ledger histórico: se queda, sin cambios de alcance".

## Contexto

ADR-0006 había decidido mantener `Account`, `Transaction`, `Budget` y `Report` como una sección secundaria de "registro histórico", agrupada bajo "Historial" en la navegación, distinta de la simulación por escenarios. En la práctica, tras completar la unificación visual de Escenarios/Categorías/Productos/Ingresos (RFC-0026), el dueño del producto confirmó que esa sección secundaria nunca se usa ni se va a rediseñar: Vectra es un simulador de escenarios financieros, no un ledger con una capa de simulación encima. Mantener el ledger vivo (rutas, pantallas, endpoints) sin un plan real de inversión sobre él es la clase de deuda de alcance que ADR-0006 pensaba revisar "más adelante si la experiencia real lo confirma" — la experiencia real ya lo confirmó.

Auditoría previa a esta decisión (RFC-0027) encontró que `Dashboard`, `Budget`, `RecurringTransaction` y `Report` dependen de `Account`/`Transaction` a nivel de código (no solo de dato): `DashboardPage` importa `useAccounts` directamente, y los cuatro se construyen agregando sobre `prisma.transaction`/`prisma.account`. Ninguno de los tres últimos (`Budget`, `RecurringTransaction`, `Report`) tenía ya pantalla propia en el frontend — eran superficie de API sin consumidor.

## Decisión

**Se retira de la experiencia de producto y del backend expuesto todo lo construido específicamente para el ledger: Cuentas, Transacciones, Presupuestos, Transacciones recurrentes, Reports y Dashboard.** Vectra queda enfocado exclusivamente en Escenarios, Categorías, Productos e Ingresos — las cuatro preguntas de ADR-0006 que sí se mantienen.

Alcance concreto:

- **Frontend**: se eliminan las páginas, hooks, componentes y rutas exclusivos de Cuentas/Transacciones/Dashboard. El nav pierde el dropdown "Historial" — el nav primario (Escenarios, Categorías, Productos, Ingresos) pasa a ser el nav completo.
- **Backend**: se eliminan las rutas, servicios y schemas de `accounts`, `transactions`, `budgets`, `recurring-transactions`, `reports` y `dashboard`, junto con la lib exclusiva a ellos (`resource-guards`, `chart-color`, `finance-math`, `date-range`, `report-buckets`, `recurrence`).
- **Registro de usuario**: `createInitialUserData` deja de crear una cuenta "Efectivo" por defecto — no tiene sentido crear un registro en un modelo sin ningún endpoint que lo exponga.
- **Modelo de datos: sin cambios.** `Account`, `Transaction`, `Budget` y `RecurringTransaction` **permanecen en el schema de Prisma**, sin migración. Dos razones: (1) `Category.archiveCategory`/`deleteCategory` siguen consultando estas relaciones (cascada de archivado, conteo antes de borrado físico) como parte de su propia lógica de negocio, que no se toca; (2) borrar modelos con datos históricos reales del usuario semilla es una decisión de migración que merece su propio análisis, no un efecto secundario de una limpieza de UI/API.

## Qué NO cambia esta decisión

- Ningún modelo, campo o regla de negocio de Escenarios, Categorías, Productos o Ingresos (ADR-0002/0003/0005).
- El resto de ADR-0006: las cuatro preguntas, la jerarquía visual (métricas derivadas como contenido principal), y `/` como ruta de aterrizaje en Escenarios.
- El schema de Prisma — ver arriba.

## Consecuencias

- `StatCard` (antes en `features/dashboard/`) se reubica a `apps/web/src/components/`, porque `ProjectionStatCards` — compartido por Categorías/Productos/Ingresos/Escenarios — lo importaba desde ahí. Sin este movimiento, retirar Dashboard rompía los cuatro módulos vigentes.
- `packages/ui`'s `DataTable` queda sin consumidores en `apps/web` (sus tres usos eran Cuentas/Transacciones/Dashboard). No se elimina en este RFC — queda como deuda técnica menor.
- Las tablas `accounts`, `transactions`, `budgets`, `recurring_transactions` quedan en Postgres sin ningún endpoint que las lea o escriba. Es dato residual aceptado a propósito (ver arriba); una futura limpieza de schema es un RFC aparte.
- `docs/architecture/data-model.md` y `docs/glossary.md` siguen describiendo estas entidades (siguen existiendo en el schema) pero ya no son parte del producto expuesto — se les agrega una nota de contexto en vez de reescribirlas.
