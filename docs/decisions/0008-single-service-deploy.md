# ADR-0008: Despliegue como servicio único en el mismo origen

## Estado

`accepted` — supersede la sección "Deploy" de [ADR-0001](0001-tech-stack.md) (Vercel para el frontend, Railway para el API). El resto de ADR-0001 sigue vigente.

## Contexto

ADR-0001 preveía el SPA en Vercel y el API en Railway, en dominios distintos. La auditoría previa al primer lanzamiento encontró que esa topología rompe la sesión: el refresh token vive en una cookie `HttpOnly` con `SameSite=Lax`, y el navegador no la envía en un `fetch` cross-site, así que cada recarga perdería la sesión. Las alternativas (`SameSite=None`, o un rewrite de Vercel hacia Railway) reabren CSRF en `/auth/*`, dejan el API expuesto por su URL directa, o colocan una cadena de proxies delante del API que vuelve frágil la identificación de la IP del cliente para el rate limiting.

## Decisión

**Un único servicio en Railway sirve el SPA compilado y el API desde el mismo origen, bajo un dominio propio con HTTPS.**

- Todas las rutas del API viven bajo `/api` (`apps/api/src/lib/api-prefix.ts`). La cookie de refresh se emite con `Path=/api/auth`, derivado de esa misma constante.
- Fastify sirve `apps/web/dist` (`plugins/web-app.ts`): los archivos de `assets/` con caché inmutable, `index.html` siempre revalidado, y cualquier navegación GET fuera de `/api` que no sea un archivo cae en `index.html` (fallback del SPA). Un `/api/*` desconocido o un archivo inexistente responden 404 JSON, nunca el SPA.
- No hay plugin de CORS: el navegador bloquea toda lectura cross-origin por defecto, que es la política deseada. En desarrollo, Vite hace proxy de `/api` al API local, así que también es mismo origen.
- El frontend no tiene variables de entorno de build: llama a `/api` relativo al origen que lo sirve.
- Imagen: `Dockerfile` multi-stage (build del workspace completo; runtime solo con las dependencias de producción del API). Configuración en `railway.json`.
- **Migraciones**: `prisma migrate deploy` se ejecuta como `preDeployCommand` de Railway, una vez por despliegue y antes de que arranque la nueva versión; si falla, el despliegue se detiene. El arranque del servidor (`node dist/server.js`) **nunca** migra.
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

## Verificación pendiente contra la plataforma real

La documentación de Railway no pudo consultarse desde el entorno donde se escribió esta ADR. Antes de abrir la beta, verificar en un despliegue de prueba:

1. Que `preDeployCommand` en `railway.json` se aplica tal como está escrito y corre una sola vez por despliegue (no por réplica).
2. Que `healthcheckPath` (`/api/health`) bloquea el cambio de versión si la nueva no arranca.
3. La topología del proxy de Railway delante del contenedor, que fija `TRUST_PROXY_HOPS` (hoy `1`). Comprobación: enviar `curl -H "X-Forwarded-For: 1.2.3.4" https://<dominio>/api/health` y confirmar en los logs que `remoteAddress` es la IP pública real de quien hace la petición, no `1.2.3.4` ni una IP interna de Railway. Si aparece una IP de Railway o de su CDN, hay un salto más y el valor correcto es `2`; si aparece `1.2.3.4`, el valor es demasiado alto. La documentación pública de Railway no define este modelo de confianza y hay reportes de comunidad contradictorios sobre `X-Real-IP`, por eso no se usa esa cabecera.
