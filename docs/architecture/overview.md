# Arquitectura — Overview

## Stack técnico

El stack está confirmado en [ADR-0001](../decisions/0001-tech-stack.md) (estado `accepted`). Resumen por capa:

- **Frontend**: React 19 + Vite + TypeScript, Tailwind CSS v4 + shadcn/ui para UI, TanStack Query para data fetching, React Router v7 para enrutamiento.
- **Backend**: Fastify + TypeScript como API, Prisma + PostgreSQL como acceso a datos, autenticación JWT + Refresh Tokens.
- **Deploy**: Vercel (frontend), Railway (backend + posible DB), Neon como alternativa de DB gestionada.

Ver el ADR para el detalle completo de tecnologías (frontend, backend, devops, testing, deploy, extras) y sus roles.

## Principios de arquitectura

1. **Separación en capas**: la interfaz de usuario (React/Vite), la lógica de negocio y acceso a datos (Fastify + Prisma) viven en aplicaciones separadas (SPA + API), no en un mismo proceso Next.js. La lógica de negocio (cálculo de balances, validación de presupuestos, generación de transacciones recurrentes) vive en el backend, no en componentes de React.
2. **Dominio explícito**: las entidades de negocio (ver [data-model.md](data-model.md)) se modelan como tipos/esquemas Zod y modelos Prisma consistentes entre sí, no como estructuras ad-hoc.
3. **Contrato de API explícito**: el backend expone su contrato vía OpenAPI/Swagger; el frontend consume ese contrato a través de TanStack Query, evitando llamadas HTTP no documentadas.
4. **Simplicidad primero**: solución simple antes que abstracción prematura. No se introducen patrones (ej. event sourcing, CQRS) sin una necesidad concreta que los justifique.
5. **Producción, no prototipo**: código pensado para mantenerse en el tiempo, no para descartarse tras un demo.

## Consideraciones específicas del dominio

- **Precisión monetaria**: los montos se modelan con `Decimal` en Prisma / `numeric` en PostgreSQL. Nunca `float`, para evitar errores de redondeo en balances y presupuestos.
- **Transacciones recurrentes**: requieren un mecanismo de ejecución programada (ej. job/cron corriendo junto al servicio Fastify en Railway, o un servicio programado separado) — el mecanismo concreto se define en la fase de implementación.
- **Validación end-to-end con Zod**: los mismos esquemas de dominio (o esquemas equivalentes) validan tanto en el frontend (React Hook Form) como en el backend (requests Fastify), para mantener las reglas de negocio consistentes en ambos lados.
- **Autenticación**: JWT de corta duración + refresh tokens de larga duración; el diseño de almacenamiento y rotación de refresh tokens se define al implementar el backend.
- El modelo de datos debe soportar múltiples cuentas y categorías por usuario desde el diseño inicial, aunque el MVP sea single-user.

## Próximos pasos

1. Decidir estructura de repositorios: monorepo (frontend + backend) vs. repos separados.
2. Definir estructura de carpetas de cada aplicación (frontend Vite, backend Fastify) siguiendo la separación UI / lógica de negocio / acceso a datos.
3. Definir convenciones de la API (versionado de rutas, formato de errores, paginación) antes de implementar el primer endpoint.
4. Configurar Docker Compose para desarrollo local (API + PostgreSQL).
