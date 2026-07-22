# ADR-0001: Selección de stack técnico

## Estado

`accepted`

## Contexto

Pulse Finance necesita un stack técnico definido antes de iniciar la fase de MVP (ver [roadmap.md](../product/roadmap.md), Fase 1). Este stack es específico del proyecto y **no** corresponde al stack global por defecto del desarrollador (Next.js + Supabase): aquí frontend y backend van separados (SPA + API propia), con Prisma/PostgreSQL en vez de Supabase.

## Decisión

Se adopta el siguiente stack, confirmado por el usuario:

### Frontend

| Tecnología | Rol |
|---|---|
| React 19 | Librería de UI |
| TypeScript | Tipado estático |
| Vite | Bundler y dev server |
| Tailwind CSS v4 | Estilos utility-first |
| shadcn/ui | Componentes base accesibles sobre Tailwind |
| React Router v7 | Enrutamiento client-side |
| TanStack Query | Data fetching, cache y sincronización con el backend |
| React Hook Form | Manejo de formularios |
| Zod | Validación de esquemas (compartida en intención con el backend) |
| Framer Motion | Animaciones |
| Recharts | Gráficas (balances, progreso de presupuesto, histórico) |
| Lucide React | Iconografía |
| Sonner | Notificaciones toast |

### Backend

| Tecnología | Rol |
|---|---|
| Fastify | Framework HTTP / API |
| TypeScript | Tipado estático |
| Prisma | ORM y acceso a datos |
| PostgreSQL | Base de datos relacional |
| JWT + Refresh Tokens | Autenticación y renovación de sesión |
| bcrypt | Hashing de contraseñas |
| Zod | Validación de entrada (requests) |

### DevOps

| Tecnología | Rol |
|---|---|
| Docker | Contenerización |
| Docker Compose | Orquestación local (API + DB) |
| ESLint | Linting |
| Prettier | Formateo de código |
| Husky | Git hooks |
| lint-staged | Lint/format solo sobre archivos staged |

### Testing

| Tecnología | Rol |
|---|---|
| Vitest | Test runner (unit/integration, frontend y backend) |
| Testing Library | Testing de componentes React centrado en comportamiento de usuario |
| Supertest | Testing de endpoints HTTP del backend |

### Deploy

| Servicio | Rol |
|---|---|
| Vercel | Deploy del frontend (SPA) |
| Railway | Deploy del backend (API Fastify) |
| Neon o Railway PostgreSQL | Base de datos gestionada |

### Extras

| Tecnología | Rol |
|---|---|
| OpenAPI / Swagger | Documentación y contrato de la API |

## Consecuencias

- El código de aplicación (cuando se implemente) debe ceñirse a este stack; no introducir alternativas (ej. otro ORM, otro framework de UI) sin un ADR nuevo que lo justifique.
- Al ser frontend y backend proyectos separados, se deberá decidir en la fase de implementación si viven en un monorepo o en repositorios independientes (fuera de alcance de este ADR).
- Los montos monetarios deben modelarse con `Decimal` en Prisma / `numeric` en PostgreSQL, nunca `float`, dada la necesidad de precisión exacta señalada en [architecture/overview.md](../architecture/overview.md).
- Zod se usa tanto en frontend (validación de formularios con React Hook Form) como en backend (validación de requests en Fastify) — mantener los esquemas alineados para evitar divergencia de reglas de validación entre cliente y servidor.
- La autenticación vía JWT + Refresh Tokens implica diseñar el manejo seguro de ambos tokens (almacenamiento, expiración, rotación) al momento de implementar el backend.
