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
- Variables de entorno de producción: `DATABASE_URL`, `JWT_SECRET`, `NODE_ENV=production`, `WEB_DIST_DIR` (fijada en la imagen), `HOST=0.0.0.0` (fijada en la imagen) y `PORT` (la inyecta Railway).

## Verificación pendiente contra la plataforma real

La documentación de Railway no pudo consultarse desde el entorno donde se escribió esta ADR. Antes de abrir la beta, verificar en un despliegue de prueba:

1. Que `preDeployCommand` en `railway.json` se aplica tal como está escrito y corre una sola vez por despliegue (no por réplica).
2. Que `healthcheckPath` (`/api/health`) bloquea el cambio de versión si la nueva no arranca.
3. La topología del proxy de Railway delante del contenedor (cabeceras `X-Forwarded-For` / `X-Real-IP` y número de saltos), que determina la configuración de `trustProxy` del rate limiting.
