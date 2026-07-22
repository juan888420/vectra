# Domain Design

Documento de diseño de dominio de Vectra. Precede a cualquier decisión de base de datos, API o UI (Fase 1 - Architecture, antes de Fase 3 - Database). No contiene schema de Prisma, SQL ni código de aplicación: es el modelo de negocio sobre el que se construirá todo lo demás.

Ver también [`vision.md`](../product/vision.md) (alcance de producto) y [`roadmap.md`](../product/roadmap.md) (fases).

## 1. Resumen del dominio

Vectra gestiona el dinero personal de un usuario a través de tres conceptos centrales: **dónde** está el dinero (`Account`), **qué se hizo** con él (`Transaction`, clasificada por `Category`), y **qué tan bien se está cumpliendo un plan** (`Budget`). Todo lo demás —transacciones recurrentes, metas de ahorro— son variaciones o agregados sobre esos tres conceptos.

Principio rector: el dominio modela un **libro de movimientos inmutable** (ledger). Los saldos y el progreso de presupuesto nunca se guardan como estado independiente; siempre se derivan de las transacciones. Esto evita la clase de bugs más común en apps financieras (desincronización entre "saldo guardado" y "saldo real").

## 2. Entidades

### User

- **Propósito**: dueño de todos los datos. Raíz de todo el modelo — no hay dato en Vectra que no pertenezca a un `User`.
- **Responsabilidades**: identidad y autenticación; preferencias globales.
- **Información**: identificador, email, preferencias (moneda por defecto, timezone, primer día de la semana para reportes).
- **Relaciones**: 1—N con `Account`, `Category`, `Budget`, `RecurringTransaction`, `SavingGoal`.

### Account

- **Propósito**: representa un lugar donde vive el dinero (efectivo, cuenta bancaria, tarjeta de crédito). No es una integración bancaria real — es una agrupación manual (ver [glossary.md](../glossary.md)).
- **Responsabilidades**: agrupar transacciones; exponer un balance calculado.
- **Información**: nombre, `AccountType`, `currency` (ver nota de escalabilidad más abajo), fecha de creación, flag `archived`.
- **Relaciones**: pertenece a `User`; tiene muchas `Transaction`; tiene muchas `RecurringTransaction` (las plantillas generan transacciones hacia una cuenta específica).
- **Por qué `currency` va en `Account` y no en `User`**: ver [Escalabilidad](#8-escalabilidad).

### Category

- **Propósito**: clasificar transacciones para presupuestar y reportar (ej. Comida, Transporte, Salario).
- **Responsabilidades**: agrupar transacciones y anclar presupuestos.
- **Información**: nombre, `TransactionType` (una categoría es de gasto o de ingreso, nunca ambos — ver reglas de negocio), flag `archived`.
- **Relaciones**: pertenece a `User`; tiene muchas `Transaction`; puede tener asociado un `Budget`.

### Transaction

- **Propósito**: el registro atómico de un movimiento de dinero real. Es el corazón del ledger.
- **Responsabilidades**: representar un hecho ya ocurrido (no una intención ni una proyección).
- **Información**: `Money` (monto + moneda), fecha, `TransactionType`, nota/descripción opcional.
- **Relaciones**: pertenece a exactamente un `Account` y una `Category`; opcionalmente originada por una `RecurringTransaction`.

### RecurringTransaction

- **Propósito**: plantilla que genera `Transaction` automáticamente cada cierto intervalo (salario mensual, suscripción).
- **Responsabilidades**: producir transacciones concretas en su fecha correspondiente; no es en sí misma un movimiento de dinero.
- **Información**: `Money`, `Category`, `Account`, `RecurrenceFrequency`, fecha de inicio, fecha de fin opcional, flag `active`.
- **Relaciones**: pertenece a `User`; genera muchas `Transaction` a lo largo del tiempo.

### Budget

- **Propósito**: límite de gasto que el usuario define para una categoría en un período.
- **Responsabilidades**: dar un marco de referencia contra el cual medir el gasto real (calculado sumando `Transaction`).
- **Información**: `Money` (límite), `BudgetPeriod`, referencia a `Category`.
- **Relaciones**: pertenece a `User`; referencia una `Category`.
- **Regla de unicidad**: un usuario no puede tener dos `Budget` activos para la misma `Category` y el mismo tipo de período simultáneamente (evita ambigüedad sobre "cuál presupuesto aplica").

### SavingGoal

- **Propósito**: meta de ahorro con un monto objetivo (ej. "Fondo de emergencia: $2000").
- **Responsabilidades**: trackear progreso hacia un objetivo, independiente del ledger de gasto/ingreso diario.
- **Información**: nombre, `Money` objetivo, `currentAmount` (monto acumulado), fecha objetivo opcional, `GoalStatus`.
- **Relaciones**: pertenece a `User`.
- **Nota de alcance**: esta entidad se diseña ahora porque el RFC lo pide explícitamente, pero **su implementación sigue programada para la Fase 3 (Expansión) del [roadmap](../product/roadmap.md)**, no para el MVP (Fase 1). Diseñarla hoy evita tener que rediseñar el dominio más adelante, pero no adelanta su construcción.

### Notification (fuera del modelo actual — solo mencionada)

No se incluye como entidad formal: no aparece en `vision.md` ni en `roadmap.md`, y agregarla ahora sin un caso de uso concreto sería sobreingeniería (viola YAGNI, ver `.claude/CLAUDE.md`). Se documenta únicamente como punto de extensión futuro en la sección de [Escalabilidad](#8-escalabilidad).

## 3. Relaciones

```
User
 ├── Account ──< Transaction >── Category
 │      └──< RecurringTransaction >── genera → Transaction
 ├── Category ──< Budget
 └── SavingGoal
```

Lectura: un `User` tiene muchas `Account`, `Category` y `SavingGoal`. Cada `Transaction` conecta una `Account` con una `Category`. Una `RecurringTransaction` vive "colgada" de una `Account`+`Category` y genera `Transaction` reales con el tiempo. Un `Budget` conecta un `User` con una `Category` y un período.

## 4. Reglas de negocio

1. Toda `Transaction` pertenece a exactamente un `Account` y una `Category`.
2. El `TransactionType` de una transacción debe coincidir con el `TransactionType` de su categoría (no se puede registrar un "gasto" contra una categoría de tipo "ingreso").
3. Una `Category` o `Account` con `Transaction` asociadas **nunca se borra físicamente**: se archiva (`archived = true`). Preserva la integridad del historial y evita romper reportes pasados.
4. Una `Category` o `Account` archivada no puede seleccionarse para transacciones nuevas.
5. Editar una `RecurringTransaction` (monto, categoría, frecuencia) **solo afecta a las transacciones que se generen a partir de ese momento**; las `Transaction` ya generadas son registros independientes e inmutables respecto a la plantilla.
6. Un `Budget` es único por combinación `User` + `Category` + `BudgetPeriod` activo.
7. El balance de una `Account` y el progreso de un `Budget` **siempre se derivan** sumando `Transaction`; no se almacenan como campos independientes mutables.
8. Los montos se modelan con el value object `Money` (ver sección 5) — nunca con `float`.
9. El MVP asume **una sola moneda por usuario** (ver `vision.md`, fuera de alcance el multi-moneda), pero cada `Account` ya tiene su propio campo `currency` desde el diseño inicial (ver sección 8).
10. El `currentAmount` de una `SavingGoal` nunca puede ser negativo; el `Money` objetivo tampoco.

## 5. Value Objects

Un Value Object se identifica por sus atributos, no por un identificador propio; es inmutable y comparable por valor. Estos tres conceptos del dominio de Vectra encajan mejor como VO que como entidad:

- **Money** (`amount` + `currency`): sin este VO, la aritmética monetaria terminaría dispersa y propensa a errores de precisión (floats) o de moneda (sumar USD con EUR sin darse cuenta). Encapsula suma, resta y comparación, y rechaza operaciones entre monedas distintas sin conversión explícita.
- **DateRange** (`start` + `end`): usado por el período de un `Budget` y, más adelante, por reportes históricos (Fase 2 de consolidación). Encapsula validación (`start <= end`) y la pregunta "¿esta fecha cae dentro del rango?".
- **Currency** (código ISO 4217 + precisión de unidad menor, ej. 2 decimales para USD): en el MVP es efectivamente una constante por usuario, pero modelarla como VO desde ahora evita un rediseño cuando se soporte multi-moneda (Fase 3 del roadmap).

**Trade-off evaluado y descartado por ahora**: extraer una `RecurrenceRule` VO separada (frecuencia + intervalo + reglas de excepción) para `RecurringTransaction`. Es el patrón "correcto" si la recurrencia se vuelve compleja (ej. "cada 2 semanas, excepto feriados"), pero para el MVP (mensual/semanal/anual simple) es sobreingeniería. Se deja como candidato a revisar si la lógica de recurrencia crece.

## 6. Enums

| Enum                  | Valores MVP                            | Reservado a futuro                                           |
| --------------------- | -------------------------------------- | ------------------------------------------------------------ |
| `TransactionType`     | `EXPENSE`, `INCOME`                    | `TRANSFER` (movimiento entre cuentas propias, no existe aún) |
| `AccountType`         | `CASH`, `BANK`, `CREDIT_CARD`, `OTHER` | —                                                            |
| `BudgetPeriod`        | `MONTHLY`                              | `WEEKLY`, `CUSTOM` (rango libre vía `DateRange`)             |
| `RecurrenceFrequency` | `WEEKLY`, `MONTHLY`, `YEARLY`          | intervalos custom (ej. "cada 2 meses")                       |
| `GoalStatus`          | `ACTIVE`, `COMPLETED`, `ABANDONED`     | —                                                            |

`NotificationType` (mencionado como ejemplo en el RFC) no se define todavía: no hay entidad `Notification` en este modelo (ver sección 2).

## 7. Casos límite

- **Eliminar una categoría con transacciones**: se archiva, no se borra (regla de negocio 3). La UI debe impedir elegirla para transacciones nuevas pero seguir mostrándola en el historial.
- **Cambiar un presupuesto a mitad de período**: ver [pregunta abierta 1](#11-preguntas-abiertas) — no hay una única respuesta "correcta" de negocio, requiere decisión del producto.
- **Modificar una transacción recurrente**: solo afecta generaciones futuras (regla de negocio 5); no se reescriben transacciones pasadas.
- **Eliminar una cuenta con transacciones**: mismo tratamiento que categorías — se archiva.
- **Categoría o cuenta archivada con un `Budget` o `RecurringTransaction` activo apuntándole**: el `Budget`/`RecurringTransaction` debe archivarse en cascada junto con su categoría/cuenta, para no dejar referencias "colgando" activas.
- **Meta de ahorro alcanzada (`currentAmount >= target`)**: ver [pregunta abierta 2](#11-preguntas-abiertas).
- **Transacción con monto cero**: inválida, se rechaza — no tiene significado de negocio.
- **Transacción sin categoría**: ver [pregunta abierta 3](#11-preguntas-abiertas).

## 8. Escalabilidad

Decisiones tomadas _ahora_ para no pagar una migración costosa después, sin construir nada de más (YAGNI):

- **Multi-moneda**: `Account.currency` existe desde el día uno, aunque el MVP solo permita una moneda por usuario. Es barato agregarlo ahora (un campo) y muy costoso agregarlo después (migración de datos + reescritura de cálculos de balance). La lógica de conversión entre monedas queda fuera de alcance hasta la Fase 3 del roadmap.
- **Sincronización bancaria**: no se agrega ningún campo especulativo ahora. Cuando se implemente (Fase 3), la extensión natural es un campo `source: MANUAL | SYNCED` en `Account` — se documenta como punto de extensión, no se construye.
- **IA para análisis financiero / predicciones** (Fase 8 del flujo de fases): no requiere cambios al modelo de dominio en sí; depende de que `Transaction` y `Category` estén bien pobladas y consistentes. La calidad de la categorización manual de hoy es la que habilita el análisis de mañana.
- **Usuarios premium**: se resolvería con un campo `plan`/`tier` en `User` el día que exista un caso de uso real (ej. límite de cuentas en plan gratuito). No se agrega ahora.
- **Notificaciones**: entidad separada a futuro (`Notification`, con `NotificationType`), sin impacto en las entidades actuales más allá de referencias (`userId`, y opcionalmente `budgetId`/`recurringTransactionId`).

## 9. Riesgos

- **Sobre-modelar `SavingGoal` antes de tiempo**: sería tentador diseñar un ledger completo de "contribuciones" a una meta. Para el alcance actual (Fase 3, no MVP), un campo simple `currentAmount` alcanza; el ledger de contribuciones queda como posible evolución si el producto lo requiere.
- **No modelar moneda desde ahora**: si `Account.currency` no se incluyera desde el diseño inicial, soportar multi-moneda más adelante implicaría una migración de datos en producción — mitigado incluyéndolo ya (sección 7).
- **Ambigüedad en el borrado de categorías/cuentas**: sin la regla de "archivar, nunca borrar" explícita y documentada, es fácil que la implementación de CRUD (Fase 5) tome un atajo (hard delete) que rompa reportes históricos más adelante.
- **Reglas de negocio con múltiples interpretaciones válidas** (presupuesto a mitad de período, meta de ahorro alcanzada): dejarlas sin decidir hasta la fase de CRUD arriesga inconsistencia entre lo que UI, backend y usuario esperan. Se listan como preguntas abiertas explícitas (sección 11) para decidirlas antes de implementar, no durante.

## 10. Recomendaciones

- Adoptar las tres decisiones "por defecto" propuestas en las preguntas abiertas si no hay una preferencia de producto fuerte en contra (ver sección 11): simplifican el modelo sin comprometer corrección.
- Mantener `SavingGoal` en el documento de dominio pero fuera del alcance de implementación hasta la Fase 3, tal como ya está en el roadmap — no adelantar su construcción solo porque ya está diseñada.
- Cuando se llegue a la Fase 3 (Database), este documento es la fuente de verdad para el schema de Prisma: cada entidad, VO y enum aquí descrito debería mapear 1:1 a un modelo o campo, sin agregar conceptos nuevos sin actualizar primero este documento.

## 11. Preguntas abiertas

1. **¿Cambiar un `Budget` a mitad de período afecta todo el período actual o solo desde ese momento en adelante?** Recomendación: aplica al período completo (más simple de explicar al usuario y de calcular); la alternativa (prorratear) añade complejidad sin un beneficio claro para el MVP.
2. **¿Una `SavingGoal` pasa a `COMPLETED` automáticamente al alcanzar el monto objetivo, o requiere confirmación manual del usuario?** Recomendación: automático, por simplicidad de UX; el usuario siempre puede seguir aportando o reabrir la meta si el estado lo permite.
3. **¿Una `Transaction` puede quedar sin `Category` (nullable), o siempre se asigna una categoría "Sin categorizar" creada por defecto?** Recomendación: categoría por defecto (evita manejar `null` en cálculos de presupuesto y reportes en todas las capas).
