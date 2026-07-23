# ADR-0002: Mapeo del dominio a Prisma (RFC-0007)

## Estado

`accepted`

## Contexto

El dominio de Vectra quedó definido en [`data-model.md`](../architecture/data-model.md) (RFC-0006). Este ADR documenta las decisiones **técnicas** tomadas al traducir ese dominio al primer `schema.prisma` ([`apps/api/prisma/schema.prisma`](../../apps/api/prisma/schema.prisma)), sin introducir reglas de negocio nuevas. Migraciones, seed y client quedan fuera de alcance (RFC-0007).

## Decisiones

### Prisma 7

Se instaló Prisma 7.9 (última major). Dos cambios de convención respecto a Prisma 5/6 que afectan la estructura:

- La URL de conexión ya no vive en el bloque `datasource` del schema; se configura en [`prisma.config.ts`](../../apps/api/prisma.config.ts) vía `env("DATABASE_URL")`.
- Prisma ya no carga `.env` automáticamente: `prisma.config.ts` importa `dotenv/config` (se añadió `dotenv` como devDependency de `apps/api`). Hay un `.env.example` committeado; el `.env` real está gitignoreado.
- El generator es el nuevo `prisma-client` (genera TypeScript en `src/generated/prisma`, gitignoreado).
- El client de Prisma 7 es Rust-free y se conecta mediante un driver adapter: `@prisma/adapter-pg` (RFC-0008). El client se expone como plugin de Fastify en `apps/api/src/plugins/prisma.ts` (RFC-0009).

### Value object `Money` → columnas `amount` + `currency`

Prisma no tiene tipos compuestos en PostgreSQL, así que cada aparición de `Money` en el dominio se mapea al par `amount Decimal @db.Decimal(12, 2)` + `currency Char(3)` (ISO 4217). `Decimal(12, 2)` cubre hasta 9.999.999.999,99 — suficiente para finanzas personales. **Nunca `Float`** (regla de negocio 8). El VO como tal (inmutabilidad, aritmética segura entre monedas) se implementará en la capa de dominio del backend, no en la DB.

`Transaction.currency` duplica en apariencia `Account.currency`, pero no es redundancia: el ledger es inmutable y autocontenido — cada movimiento registra la moneda en la que ocurrió, independiente de cambios futuros en la cuenta. Es el mapeo fiel de que `Transaction` contiene un `Money` completo según el dominio.

### `archived` → `archivedAt DateTime?`

El flag conceptual `archived` se materializa como timestamp nullable (`null` = activo). Aporta la fecha de archivado gratis y evita un boolean + fecha separados. `RecurringTransaction` conserva `isActive Boolean` porque el dominio lo define como flag de activación (el usuario lo pausa/reanuda), no como archivado.

### Integridad referencial

- `User` → todo lo demás: `onDelete: Cascade` (borrar la cuenta de usuario elimina todos sus datos; consistente con "el User es la raíz de todo").
- `Account`/`Category` → `Transaction` y `RecurringTransaction`: `onDelete: Restrict`. Refuerza a nivel DB la regla "archivar, nunca borrar" (regla de negocio 3): la DB rechaza el hard delete si existen movimientos.
- `RecurringTransaction` → `Transaction`: `onDelete: SetNull`. Las transacciones generadas son independientes de su plantilla (regla de negocio 5) y sobreviven si esta se elimina.

### Restricciones no expresables en Prisma

> **Actualización (RFC-0008)**: las restricciones 1 y 2 ya se aplicaron como SQL crudo en la migración inicial (`20260723015119_init`). La 3 (inter-tabla) permanece en la capa de servicio por diseño.

Quedan documentadas en comentarios `///` del schema:

1. **Unicidad de `Budget` activo** (`user` + `category` + `period`): requiere un índice único parcial (`WHERE archived_at IS NULL`), que Prisma no soporta declarativamente. Un `@@unique` normal impediría recrear un presupuesto tras archivar el anterior.
2. **`CHECK` de montos**: `amount > 0` en `Transaction`, `>= 0` en `SavingGoal` (regla de negocio 10).
3. **Coincidencia de `TransactionType` entre transacción y categoría** (regla de negocio 2): regla inter-tabla, solo aplicable en la capa de servicio.

### Otras decisiones menores

- **IDs**: `uuid(7)` (UUIDv7, ordenable por tiempo — mejor localidad de índice que UUIDv4) con tipo nativo `@db.Uuid`.
- **Fechas de negocio** (`Transaction.date`, `startDate`, `endDate`, `targetDate`): `@db.Date` — el dominio no incluye hora del día. `createdAt`/`updatedAt` sí son timestamps completos.
- **Tablas en `snake_case`** vía `@@map` (convención global: `snake_case` para DB).
- **Pregunta abierta 3 del RFC-0006 resuelta**: `Transaction.categoryId` es **obligatorio**; cada usuario tendrá una categoría "Sin categorizar" por defecto (decisión del usuario, 2026-07-22). La creación de esa categoría por defecto pertenece a la fase de seed/auth, no a este schema.
- `User` no incluye aún campos de credenciales (`passwordHash`, refresh tokens): pertenecen a la fase de autenticación y se añadirán en su RFC, manteniendo este schema 1:1 con el dominio actual.

## Consecuencias

- El schema valida (`prisma validate`) y es la base para la fase de migraciones.
- Tres invariantes viven temporalmente solo en la capa de servicio (ver arriba); la fase de migraciones debe añadirlas como constraints SQL para que la DB sea la última línea de defensa.
- Cualquier cambio de dominio debe actualizarse primero en `data-model.md` y luego reflejarse aquí y en el schema.
