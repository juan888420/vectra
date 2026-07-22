# CLAUDE.md — Vectra (Project)

Este archivo complementa el CLAUDE.md global. No repite reglas ya definidas ahí (estilo de respuesta, convenciones de código, modos de trabajo); solo añade lo específico de este proyecto.

## Qué es este proyecto

Vectra es un **personal finance tracker**: usuarios individuales registran transacciones (gastos e ingresos), las organizan por categorías y cuentas, y definen presupuestos por período. Ver [`docs/product/vision.md`](../docs/product/vision.md) para el detalle de producto.

## Estado actual del proyecto

**Pre-código, stack ya definido.** Solo existe documentación y estructura base; el stack técnico ya está confirmado (ver abajo). No generes componentes, endpoints, migraciones ni ningún artefacto de aplicación hasta que el usuario lo pida explícitamente, y cuando lo pida, cíñete al stack confirmado.

## Stack técnico

Confirmado en [`docs/decisions/0001-tech-stack.md`](../docs/decisions/0001-tech-stack.md) (estado `accepted`). Este proyecto **no** usa el stack global por defecto (Next.js + Supabase): usa frontend y backend separados.

- **Frontend**: React 19 + TypeScript + Vite, Tailwind CSS v4 + shadcn/ui, React Router v7, TanStack Query, React Hook Form + Zod, Framer Motion, Recharts, Lucide React, Sonner.
- **Backend**: Fastify + TypeScript, Prisma + PostgreSQL, JWT + Refresh Tokens, bcrypt, Zod.
- **DevOps/Testing**: Docker/Docker Compose, ESLint/Prettier/Husky/lint-staged, Vitest + Testing Library + Supertest.
- **Deploy**: Vercel (frontend), Railway (backend), Neon o Railway PostgreSQL (DB).
- **Extras**: OpenAPI/Swagger para el contrato de la API.

Ver el ADR-0001 para el detalle completo y el rol de cada tecnología. Cualquier implementación futura debe ceñirse a este stack; no introducir alternativas sin un ADR nuevo.

## Arquitectura

Seguir **arquitectura basada en features** (feature-based / vertical slice): el código se organiza por dominio de negocio (ej. `transactions/`, `budgets/`, `accounts/`, `auth/`), no por tipo técnico (no carpetas globales `controllers/`, `components/`, `hooks/` a nivel raíz). Cada feature agrupa su propia UI, lógica y acceso a datos, tanto en frontend como en backend.

## Filosofía de trabajo

Antes de escribir código:

1. Analizar el problema.
2. Explicar la solución.
3. Justificar la arquitectura.
4. Detectar posibles problemas futuros.
5. Recién después, implementar.

## Reglas de código

Siempre:

- TypeScript strict, nunca `any`.
- Componentes pequeños, funciones pequeñas.
- Código legible, nombres descriptivos.
- Comentarios solo cuando aporten valor (no repetir lo que el código ya dice).
- Evitar duplicación (DRY).
- Priorizar composición sobre herencia.

## Flujo de trabajo por fases

El desarrollo avanza **por fases**, y cada fase debe terminarse completamente antes de pasar a la siguiente. **Nunca avanzar automáticamente a la siguiente fase — siempre esperar aprobación explícita del usuario.**

Fases de referencia para Vectra:

1. Arquitectura
2. Diseño UI
3. Base de datos
4. Autenticación
5. CRUD
6. Dashboard
7. Analítica
8. Predicciones
9. Optimización
10. Deploy

## Antes de implementar cualquier tarea

Responder, antes de escribir código:

- **Objetivo**: qué se busca lograr.
- **Qué se hará**: pasos concretos.
- **Archivos afectados**.
- **Por qué**: justificación.
- **Posibles alternativas**.
- **Riesgos**.

## Al terminar cada tarea

Mostrar únicamente:

- Archivos creados.
- Archivos modificados.
- Decisiones importantes tomadas.
- Próximos pasos.

## Si se detectan problemas

Detenerse. Explicar:

- Por qué ocurre.
- Opciones disponibles.
- Ventajas y desventajas de cada una.
- Recomendación.

Esperar la decisión del usuario antes de continuar.

## Calidad

Todo código debe cumplir:

- SOLID cuando aplique (no forzarlo donde no aporta).
- Clean Code.
- DRY.
- KISS.
- YAGNI.

Sin sobreingeniería.

## Testing

Agregar tests únicamente cuando aporten valor real. No crear tests artificiales solo por cobertura.

## Seguridad

Aplicar desde el inicio:

- Validación y sanitización de entradas.
- Rate limiting.
- Hash seguro de contraseñas (bcrypt, ver [ADR-0001](../docs/decisions/0001-tech-stack.md)).
- Cookies `HttpOnly` cuando corresponda (ej. refresh tokens).
- Protección contra ataques comunes (XSS, CSRF, inyección SQL vía Prisma parametrizado, etc.).

## Performance

Aplicar buenas prácticas desde el inicio:

- Lazy loading.
- Memoización solo cuando aporte valor medible.
- Queries eficientes (evitar N+1 con Prisma).
- Evitar renders innecesarios.
- Paginación en listados (ej. transacciones).

## Diseño UI

Debe sentirse como un SaaS moderno. Inspiraciones: Linear, Vercel, Stripe, Raycast, Notion.

Características: minimalista, mucho espacio en blanco, animaciones suaves (Framer Motion), responsive, soporte dark/light, accesible.

## Documentación

Cada decisión importante queda documentada (ver [`docs/decisions/`](../docs/decisions/)). No escribir documentación innecesaria.

## Terminología del dominio

Usar los términos definidos en [`docs/glossary.md`](../docs/glossary.md) de forma consistente en código, docs y commits una vez arranque el desarrollo (ej. `transaction`, `account`, `category`, `budget`, `recurring transaction`, `net worth`).

## Documentación del proyecto

Toda la documentación de producto, arquitectura y decisiones vive en [`docs/`](../docs/README.md). Mantenerla actualizada a medida que el proyecto avanza, especialmente el ADR de stack y el roadmap.

## Objetivo final

Construir una aplicación mostrable en un portafolio profesional que demuestre: arquitectura, frontend moderno, backend profesional, base de datos, seguridad, calidad de código, escalabilidad y buen diseño. Nunca sacrificar calidad por velocidad.
