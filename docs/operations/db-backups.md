# Runbook: backups de la base de datos de producción

Dos capas, independientes:

- **A. Backups nativos de Railway** del volumen de Postgres (pestaña Backups del servicio `postgres`). Restauran el volumen entero en minutos, pero viven dentro del proyecto: si se borra el volumen, se borran con él.
- **B. `pg_dump` cifrado fuera de Railway** (este runbook): el servicio cron `db-backup` (`ops/db-backup/`, declarado en `.railway/railway.ts`) vuelca la base cada día a las 06:00 UTC a Cloudflare R2.

Para restaurar, **A primero** si está disponible y tiene un punto adecuado; **B** cuando A no sirve (volumen perdido, problema con la cuenta o el proyecto, o hace falta un punto que A ya no retiene).

## Cómo funciona B

1. `pg_dump --format=custom` por la red privada (`postgres.railway.internal`), sin exponer el Postgres.
2. Cifrado en streaming con [`age`](https://age-encryption.org) para una **clave pública** (`AGE_RECIPIENT`). La clave privada nunca entra en Railway ni en R2: sin ella, los dumps son ilegibles aunque se filtren las credenciales del bucket.
3. Subida a `incoming/vectra-<AAAA-MM-DDTHHMMSSZ>.dump.age`. Nombre con fecha y hora UTC hasta el segundo: dos ejecuciones nunca comparten clave.
4. Solo si todo el pipe terminó bien y el objeto supera el mínimo (`BACKUP_MIN_BYTES`, 10 KB por defecto) se copia a `daily/` (y a `monthly/` el día 1) y se borra de `incoming/`.
5. Solo después de esa promoción, ping al heartbeat. **Si el heartbeat no llega, el backup de ese día no existe.**

Si algo falla, el script sale con error, no promueve nada, no hace ping e intenta borrar su objeto de `incoming/`; la regla de lifecycle de `incoming/` lo limpia si ese borrado también falla. `ops/db-backup/test/backup.test.sh` lo comprueba con stubs, y el CI lo ejecuta dentro de la imagen real.

## Puesta en marcha (una vez, la hace el propietario)

1. **Bucket R2** dedicado, sin acceso público.
2. **Token de R2** con permiso _Object Read & Write_ limitado a ese bucket.
3. **Reglas de lifecycle**: `incoming/` borra a 1 día, `daily/` a 35 días, `monthly/` a 400 días.
4. **Bucket lock**, si la cuenta lo permite: retención de 30 días en `daily/` y `monthly/` (siempre menor que su lifecycle), para que unas credenciales robadas no puedan borrar los backups recientes. **Nunca en `incoming/`**: el script necesita borrar ahí.
5. **Par de claves `age`** en una máquina de confianza: `age-keygen -o vectra-backup.key`. La línea `# public key: age1...` es `AGE_RECIPIENT`. El archivo `vectra-backup.key` (clave privada) va al gestor de contraseñas y a una copia offline; nunca al repositorio ni a Railway. **Si se pierde, los backups no sirven.**
6. **Monitor heartbeat** en el servicio de uptime, esperando un ping diario con un margen de unas horas. **Su URL es un secreto**: quien la tenga puede dar por hecho un backup que no existió, y el repositorio es público.
7. **Variables compartidas selladas** en el entorno `production` de Railway (dashboard): `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` y `HEARTBEAT_URL`. Se escriben en una sola línea y no se listan nunca por valor (ADR-0008, "Variables"). Si falta alguna, la referencia queda vacía y `backup.sh` se niega a correr.
8. **Rellenar los marcadores `<SET_ME: ...>`** de `.railway/railway.ts` (`R2_ENDPOINT`, `R2_BUCKET`, `AGE_RECIPIENT`, todos no secretos). `backup.sh` también se niega a correr mientras quede alguno.
9. `railway config plan`, revisarlo, y `railway config apply`.
10. Comprobar la primera ejecución (objeto en `daily/`, ping recibido) y hacer la primera prueba de restauración en local.

## Si el heartbeat alerta

1. Logs de la última ejecución: `railway logs --service db-backup` (o la pestaña Deployments del servicio). El script escribe una sola línea `error: ...` con la causa.
2. Causas habituales: una variable sin valor (`error: X is not set`), credenciales de R2 rotadas o revocadas, objeto por debajo del mínimo (base vacía o `pg_dump` cortado), o la ejecución anterior aún en curso (Railway salta la nueva).
3. Arreglado el origen, la siguiente ejecución programada lo confirma. No hace falta limpiar `incoming/`: lo hace la lifecycle.

## Prueba de restauración en local (mensual)

Comprueba que los backups se pueden restaurar, sin tocar producción. Requiere `age` y un PostgreSQL local **18 o superior** (`pg_restore` no lee dumps de una versión mayor que la suya).

1. Descargar el último objeto de `daily/` desde el dashboard de R2.
2. Descifrar: `age --decrypt --identity vectra-backup.key --output drill.dump vectra-<fecha>.dump.age`.
3. Comprobar que el dump es legible: `pg_restore --list drill.dump > /dev/null`.
4. Base desechable **en localhost**: `createdb -h localhost vectra_restore_drill`.
5. Restaurar: `pg_restore -h localhost --no-owner --no-privileges -d vectra_restore_drill drill.dump`.
6. Verificar:
   - `DATABASE_URL=postgresql://<usuario local>@localhost:5432/vectra_restore_drill pnpm --filter @vectra/api exec prisma migrate status` dice que el schema está al día (o solo faltan migraciones posteriores a la fecha del dump).
   - `SELECT count(*) FROM users;` y `SELECT count(*) FROM scenarios;` no dan 0.
7. Limpiar: `dropdb -h localhost vectra_restore_drill` y borrar `drill.dump` y el `.age` descargado. **Contienen datos reales de usuarios**: nunca en el repositorio ni en una carpeta sincronizada.

## Restaurar producción desde B

Solo cuando A no sirve. Cualquier escritura en producción entre el dump y la restauración se pierde.

1. **Copia del estado actual**, aunque esté roto, para poder deshacer: `pg_dump --format=custom` contra la URL pública del paso 3, a un archivo local.
2. **Preparar el dump**: descargar el objeto elegido, descifrarlo y comprobarlo con `pg_restore --list` (pasos 1-3 de la prueba local).
3. **Acceso temporal**: activar el TCP proxy del servicio `postgres` en el dashboard y usar su `DATABASE_PUBLIC_URL`. No pegarla en ningún sitio.
4. **Restaurar**: `pg_restore --clean --if-exists --no-owner --no-privileges --single-transaction -d "<DATABASE_PUBLIC_URL>" restore.dump`. Con `--single-transaction`, un fallo deja la base como estaba.
5. **Revocar todos los refresh tokens**:

   ```sql
   UPDATE refresh_tokens SET "revokedAt" = now() WHERE "revokedAt" IS NULL;
   ```

   El dump trae los refresh tokens tal como estaban en su momento: los que se revocaron después (logout, rotación, detección de reutilización) volverían a ser válidos. Revocarlos todos cierra cada sesión; los usuarios vuelven a iniciar sesión. Los access tokens ya emitidos siguen valiendo hasta que caducan (15 minutos, `ACCESS_TOKEN_TTL`); si hiciera falta cortarlos al instante, rotar `JWT_SECRET`.

6. **Migraciones**: si el dump es anterior a la última migración, redesplegar `vectra` desde el dashboard; el pre-deploy (`prisma migrate deploy`) aplica las que falten.
7. **Cerrar el acceso**: desactivar el TCP proxy.
8. **Verificar**: `/api/health` responde 200 con `database: up`, y un login funciona.
9. **Limpiar y registrar**: borrar los archivos descifrados y la copia del paso 1 cuando ya no haga falta, y dejar constancia en `docs/resumen.md`.
