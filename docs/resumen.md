# Resumen del proyecto

> Se actualiza al final de cada sesión. Léelo primero para saber dónde retomar.

**Última actualización**: 2026-07-27 (RFC-0017)

**Backend**: completo — auth (JWT + refresh), accounts, categories, transactions, budgets, recurring-transactions (con processor idempotente), dashboard y reports. Todo en `apps/api`, con tests de integración.

**Frontend**: solo infraestructura (RFC-0017) — Vite + React 19 + Tailwind v4, `packages/ui` (shadcn/ui) y `packages/types` (schemas Zod compartidos), flujo de auth completo (login/registro/refresh/logout) verificado end-to-end. **Sin UI de negocio todavía** (ni Dashboard, ni Transactions, ni Budgets, ni Reports).

**Estado de rama**: trabajo en `feat/rfc-0017-frontend-foundation`, no mergeado a `main` (cada RFC vive en su propia rama, se abre PR y se mergea manualmente por el usuario).

**Sigue**: implementar las pantallas de negocio sobre la base ya lista — probablemente empezando por Accounts/Categories/Transactions (CRUD simple) antes de Dashboard/Budgets/Reports, que dependen de más piezas visuales (charts con Recharts). Definir el orden exacto con el usuario antes de arrancar.
