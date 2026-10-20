# ADR-0008: Despliegue como servicio único en el mismo origen

## Estado

`accepted` — supersede la sección "Deploy" de [ADR-0001](0001-tech-stack.md) (Vercel para el frontend, Railway para el API). El resto de ADR-0001 sigue vigente.

## Contexto

ADR-0001 preveía el SPA en Vercel y el API en Railway, en dominios distintos. La auditoría previa al primer lanzamiento encontró que esa topología rompe la sesión: el refresh token vive en una cookie `HttpOnly` con `SameSite=Lax`, y el navegador no la envía en un `fetch` cross-site, así que cada recarga perdería la sesión. Las alternativas (`SameSite=None`, o un rewrite de Vercel hacia Railway) reabren CSRF en `/auth/*`, dejan el API expuesto por su URL directa, o colocan una cadena de proxies delante del API que vuelve frágil la identificación de la IP del cliente para el rate limiting.

## Decisión

**Un único servicio en Railway sirve el SPA compilado y el API desde el mismo origen, con HTTPS.** La beta cerrada usa el dominio que genera Railway (`vectra-production-fba3.up.railway.app`); un dominio propio queda para la beta abierta (ver "Dominio").

- Todas las rutas del API viven bajo `/api` (`apps/api/src/lib/api-prefix.ts`). La cookie de refresh se emite con `Path=/api/auth`, derivado de esa misma constante.
- Fastify sirve `apps/web/dist` (`plugins/web-app.ts`): los archivos de `assets/` con caché inmutable, `index.html` siempre revalidado, y cualquier navegación GET fuera de `/api` que no sea un archivo cae en `index.html` (fallback del SPA). Un `/api/*` desconocido o un archivo inexistente responden 404 JSON, nunca el SPA.
- No hay plugin de CORS: el navegador bloquea toda lectura cross-origin por defecto, que es la política deseada. En desarrollo, Vite hace proxy de `/api` al API local, así que también es mismo origen.
- El frontend no tiene variables de entorno de build: llama a `/api` relativo al origen que lo sirve.
- Imagen: `Dockerfile` multi-stage (build del workspace completo; runtime solo con las dependencias de producción del API). La configuración de la plataforma vive en `.railway/railway.ts` (ver "Configuración de Railway").
- **Migraciones**: `prisma migrate deploy` se ejecuta como comando de pre-deploy de Railway, una vez por despliegue y antes de que arranque la nueva versión; si falla, el despliegue se detiene. El arranque del servidor (`node dist/server.js`) **nunca** migra.
- `WEB_DIST_DIR` es obligatorio en producción (el servidor no arranca sin él ni sin un `index.html` dentro).

## Alternativas consideradas

- **Vercel + rewrite `/api/*` → Railway**: mismo origen para el navegador, pero el API sigue accesible por su URL de Railway saltándose el rewrite, y la IP del cliente llega tras dos proxies. Descartada para el MVP.
- **Subdominios de un mismo dominio (`app.` / `api.`)**: mismo sitio pero distinto origen, así que sigue necesitando CORS con credenciales.

## Consecuencias

- Se pierde el CDN de Vercel para los estáticos. Irrelevante en la beta; si hiciera falta, se puede poner un CDN delante del servicio único sin cambiar la aplicación.
- Un solo despliegue versiona juntos frontend y API: no hay ventana en la que un frontend nuevo hable con un API viejo.
- Variables de entorno de producción: `DATABASE_URL`, `JWT_SECRET`, `NODE_ENV=production`, `WEB_DIST_DIR`, `HOST=0.0.0.0` y `TRUST_PROXY_HOPS=1` (estas cuatro fijadas en la imagen) y `PORT` (la inyecta Railway).
- **OpenSSL en la imagen**: `node:22-bookworm-slim` no trae OpenSSL, así que Prisma no detecta su versión y elige el `schema-engine` "debian-openssl-1.1.x", que en Prisma 7.10 no enlaza libssl: lleva OpenSSL 3.4.1 embebido estáticamente. Funciona (el smoke test lo comprobó), pero esa copia no recibe los parches de seguridad de Debian y Prisma lo marca como fallback ("may not work as expected"). La imagen instala `openssl` en la etapa base para que Prisma elija el binario "debian-openssl-3.0.x", que enlaza el `libssl3` del sistema. El CI falla si reaparece cualquier `prisma:warn`.
- **Rate limiting**: las peticiones con un access token válido se limitan por cuenta (no falsificable con cabeceras); las anónimas, por IP del cliente. Esa IP sale de `X-Forwarded-For` confiando exactamente `TRUST_PROXY_HOPS` saltos (nunca `trustProxy: true`), así que lo que el cliente anteponga en la cabecera se ignora. La autenticación corre en `preValidation` para que el limitador (en `onRequest`) cuente también las peticiones con token ausente o falsificado.

## Riesgos aceptados

El CLI de Prisma viaja en la imagen de runtime solo para el `prisma migrate deploy` del paso de release, y arrastra tres avisos de `pnpm audit --prod` que no tienen arreglo compatible: Prisma 7.10.0 fija versiones exactas (`mysql2` 3.15.3, `deepmerge-ts` 7.1.5 vía `@prisma/config`). Revisados el 2026-10-14:

| Aviso                                       | Paquete           | Por qué no es alcanzable en Vectra                                                                                                                                                                             |
| ------------------------------------------- | ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GHSA-ggr8-5vv4-36mx / CVE-2026-40345 (alta) | `deepmerge-ts` <8 | Solo lo usa `@prisma/config` para fusionar nuestro `prisma.config.ts` (datos propios, sin ciclos). El runtime de `@prisma/client` no lo carga. El arreglo es la 8.x, una versión mayor que Prisma 7 no admite. |
| GHSA-3f6p-5ww8-9rcr (alta)                  | `mysql2` <3.22.0  | Solo lo importa Prisma Studio, de forma dinámica, con datasources MySQL. Vectra usa PostgreSQL y nunca ejecuta Studio en producción.                                                                           |
| GHSA-rgwj-5xj2-c3m3 (moderada)              | `mysql2` ≤3.23.0  | El mismo caso: nunca se abre una conexión MySQL.                                                                                                                                                               |

Se registran en `pnpm-workspace.yaml` (`auditConfig.ignoreGhsas`), y el CI ejecuta `pnpm audit --prod`, así que cualquier aviso fuera de esta lista lo rompe. Se descartaron los overrides (forzar `mysql2` por encima del pin exacto de Prisma sin pruebas propias, o `deepmerge-ts` 8, que es una versión mayor) y Prisma 8, que hoy está en RC. Hay que revisar la lista en cada actualización de Prisma.

## Configuración de Railway (Infrastructure as Code)

La primera versión de esta ADR usaba `railway.json` (Config as Code). Railway lo declaró obsoleto: los servicios nuevos no pueden adoptarlo (según el foro de Railway, desde el 2026-08-28) y los archivos existentes dejan de leerse el 2026-12-01. Un servicio creado hoy **ignoraría `railway.json` sin avisar**: se seguiría construyendo con el `Dockerfile` (Railway lo detecta en la raíz), pero sin pre-deploy ni health check. Como `/api/health` solo comprueba `SELECT 1`, ese deploy quedaría activo sobre una base sin tablas.

Se sustituye por `.railway/railway.ts` (Infrastructure as Code, SDK `railway`), sin cambiar la arquitectura:

- **Recursos**: un `postgres("postgres")` y el servicio `vectra`, con origen GitHub `main` y "Wait for CI" (`checkSuites: true`), para que un commit con el CI en rojo no se despliegue. Comportamiento todavía sin observar (ver "Verificación contra la plataforma real", punto 5).
- **Build**: `builder: "DOCKERFILE"`, `dockerfilePath: "Dockerfile"`.
- **Pre-deploy**: `npx --no-install prisma migrate deploy`, el mismo comando que el smoke test del CI ejecuta dentro de la imagen final. Corre en un contenedor aparte con la misma imagen y las variables del servicio; si falla, no se reintenta y el deploy no sigue. Se añade `preDeployTimeoutSeconds: 300`, porque por defecto no tiene límite y una migración bloqueada colgaría el deploy.
- **Health check**: `/api/health`, timeout de 60 s. Railway lo consulta desde `healthcheck.railway.app` y solo al desplegar, no como monitorización continua.
- **Réplicas**: `1`. El rate limiter guarda sus contadores en memoria del proceso: con dos réplicas, cada presupuesto se duplicaría. Escalar exige antes un almacén compartido.
- **Variables**: `DATABASE_URL` referencia a la del Postgres. `JWT_SECRET` es `ctx.shared.JWT_SECRET`, que Railway resuelve como `${{shared.JWT_SECRET}}`: referencia a una variable compartida y sellada del entorno `production`, creada a mano en el dashboard, así que el valor nunca entra en el repositorio ni en el plan. Se descartó `preserve()`, que solo conserva el valor de una variable que ya existe en el servicio y no sirve para un servicio que aún no existe. El nombre no lo comprueba el compilador (`ctx.shared` acepta cualquier clave), así que se revisa en el plan. `NODE_ENV`, `HOST`, `WEB_DIST_DIR` y `TRUST_PROXY_HOPS` siguen fijadas en la imagen.
- **Aplicación**: Railway no lee `.railway/` durante el deploy. Los cambios se aplican con `railway config plan` y `railway config apply` (CLI ≥ 5.42.1), y **no se ejecuta `apply` sin revisar antes el `plan`**. Automatizarlo en CI (action `railwayapp/config`) queda fuera de alcance mientras sea un solo entorno.
- **Validación local**: `pnpm typecheck` comprueba el archivo contra los tipos del SDK, que rechazan campos desconocidos y valores fuera de enum. Evaluar el programa produce el grafo esperado: `preDeploy` se normaliza a `deploy.preDeployCommand: [...]`, igual que en el antiguo `railway.json`. El cálculo del plan vive en el CLI, no en el SDK, así que solo `railway config plan` contra el proyecto real valida el resto.

## Dominio

Los dominios que genera Railway (`*.up.railway.app`) **no se declaran en `.railway/railway.ts`**: la referencia de IaC los excluye explícitamente, y `domains: [...]` solo admite dominios propios. El de la beta se generó una vez con `railway domain --service vectra --environment production --port 8080` y vive fuera del código; el `plan` posterior no propone borrarlo. Al pasar a un dominio propio se declarará en `domains` y se configurará su DNS (CNAME + verificación).

## Swagger público (intencional)

`/api/docs` (Swagger UI) y `/api/docs/json` quedan públicos en producción a propósito: Vectra es un proyecto de portafolio y el contrato del API es parte de lo que se muestra. Revisado el 2026-10-15: el documento no declara `servers` ni hosts internos, y `password` solo aparece en los `requestBody` de `register` y `login`, nunca en una respuesta. Si el producto deja de ser una demo, se condiciona por entorno en `plugins/swagger.ts`.

## Verificación contra la plataforma real (2026-10-15)

Hecha sobre el proyecto real, sin provocar fallos en producción. Los comportamientos ante fallo (pre-deploy que falla, health check que no responde) **no se observaron**: probarlos exige un entorno desechable, que se descartó por ahora.

1. **Plan**: acepta `build` y `deploy` sin errores y no propone cambios destructivos (`0 to destroy`) ni renombres; proyecto y servicio coinciden con `vectra` (punto 9).
2. **Pre-deploy**: en el deploy de #29 corrió una vez, aplicó solo la migración pendiente (`20261015120000_retire_system_categories`) y el servidor arrancó después. Fallo y timeout de 300 s: sin observar.
3. **Health check**: Railway lo consulta desde `healthcheck.railway.app` y la nueva versión solo pasa a `SUCCESS` tras responder; la anterior queda `REMOVED`. Bloqueo ante una versión rota: sin observar.
4. **Variables**: `JWT_SECRET` se resuelve desde la variable compartida (el servidor arranca y firma tokens). Incidente: el primer valor tenía un salto de línea, y un listado `railway variables --kv` cortado por `=` mostró su segunda línea como si fuera un nombre de variable, exponiendo un fragmento. Se rotó a un valor de una sola línea (`openssl rand -hex 48`). **Regla: los secretos se generan en una sola línea, y los listados de variables se inspeccionan por clave, nunca por valor.**
5. **Wait for CI**: el 2026-10-15 estaba **desactivado** pese al `apply` inicial. El deploy de #29 empezó a construir a las 01:53:00 UTC, mientras el CI de `main` corría (01:52:58 → 01:54:38), y el `plan` lo mostraba como `source.checkSuites (null → true)`; el dashboard no muestra el toggle, presumiblemente por los permisos de la GitHub App sobre el repo (no confirmado). Se aplicó el plan fijado (`--out` / `--plan`). Lo comprobado después es solo la configuración: el `plan` ya no lista `checkSuites` (confirmado de nuevo el 2026-10-19), y el deploy que disparó el `apply` pasó por `WAITING` antes de `SUCCESS`, pero era un commit cuyo CI ya había terminado en verde, así que no demuestra la espera. **Sin observar**: que Railway retenga un deploy mientras el CI corre o cuando termina en rojo. `main` no tiene branch protection (2026-10-19); esa es la mitigación que no depende de Railway (merge solo con CI en verde).
6. **PostgreSQL**: imagen sin confirmar en el plan; el CI sigue probando contra `postgres:18`.
7. **TLS**: `migrate deploy` y el servidor conectan con la `DATABASE_URL` de la red privada (`postgres.railway.internal:5432`) sin parámetros extra.
8. **`TRUST_PROXY_HOPS`**: se queda en `1`, ver abajo.
9. **Proyecto**: ver punto 1.

Además: el SPA responde en `/` y rutas profundas (200, `no-cache`), los assets con `max-age=31536000, immutable`, `/api/*` desconocido y archivos inexistentes dan 404 JSON, y las cabeceras de seguridad están presentes (HSTS, CSP, `nosniff`, `X-Frame-Options`, `Referrer-Policy`). El flujo de auth se probó de punta a punta con una cuenta de QA: registro (201, 10 categorías por defecto, ninguna de sistema), cookie `vectra_refresh` con `Path=/api/auth; HttpOnly; Secure; SameSite=Lax`, refresh con rotación (200, cookie nueva, token válido), refresh sin cookie (401), cookie sola sobre `/api/me` (401), logout (204, cookie borrada), refresh con la cookie revocada (401), login (200) y contraseña incorrecta (401 `INVALID_CREDENTIALS`).

`restartPolicyType (null → "ON_FAILURE")` sigue apareciendo en cada `plan` después del `apply` (también el 2026-10-19, como único cambio pendiente): el manifiesto del deploy ya lleva `ON_FAILURE` (el valor por defecto de Railway) y la API devuelve `null` para él. Es una diferencia cosmética, se ignora.

### IP del cliente y rate limiting

Con `TRUST_PROXY_HOPS=1`, Fastify **no** obtiene la IP del cliente sino la de un nodo de **CDN77** (`152.233.23.193`/`.194`, Datacamp, Miami) que está delante del edge de Railway. Un `X-Forwarded-For` falsificado (`1.2.3.4`, o una cadena de dos IPs) se ignora, así que el límite no se puede saltar; el problema es el inverso: todo el tráfico anónimo que entra por el mismo nodo comparte cubo (100/min global, **10/min en `login` y `register`**). Las peticiones autenticadas no se ven afectadas: se limitan por cuenta.

No se sube a `2`: Railway no documenta la cadena de proxies ni publica rangos del CDN, sus respuestas en la comunidad se contradicen (el edge sobrescribe, añade por la izquierda o por la derecha) y advierte que el comportamiento puede cambiar. Si alguna ruta llegara sin pasar por el CDN, `2` confiaría en un valor que el cliente controla.

Decisión:

- **Beta cerrada**: se queda en `1`. Falla por exceso de limitación, nunca por defecto.
- **Antes de abrir la beta**: medir el `X-Forwarded-For` crudo que llega al servidor (log temporal a nivel debug, peticiones con la cabecera falsificada desde redes distintas).
- **Resultado esperado**: limitar `login` y `register` también por email, además de por IP, para no depender del modelo de proxies de Railway, que no tiene contrato.
