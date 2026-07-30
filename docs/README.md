# Documentación — Vectra

Índice de la documentación del proyecto. Esta carpeta es la base de conocimiento para el desarrollo de Vectra; se mantiene actualizada a medida que el producto y la arquitectura evolucionan.

- **[`resumen.md`](resumen.md)** — estado actual del proyecto y qué sigue. Se actualiza al final de cada sesión; es el primer archivo a leer al retomar el trabajo.

## Estructura

- **`product/`** — qué estamos construyendo y para quién.
  - [`vision.md`](product/vision.md): problema, usuario objetivo, propuesta de valor, alcance del MVP.
  - [`roadmap.md`](product/roadmap.md): fases de desarrollo, sin fechas comprometidas.

- **`architecture/`** — cómo está (o estará) construido.
  - [`overview.md`](architecture/overview.md): principios de arquitectura, capas y stack técnico confirmado.
  - [`data-model.md`](architecture/data-model.md): entidades de dominio y sus relaciones.

- **`decisions/`** — Architecture Decision Records (ADRs). Cada decisión relevante (stack, providers, patrones) se documenta aquí con contexto, opciones y estado.
  - [`0001-tech-stack.md`](decisions/0001-tech-stack.md): decisión de stack técnico (`accepted`).
  - [`0002-prisma-domain-mapping.md`](decisions/0002-prisma-domain-mapping.md): mapeo del dominio al schema de Prisma (`accepted`).
  - [`0003-recurring-transaction-scheduling.md`](decisions/0003-recurring-transaction-scheduling.md): estrategia de recurrencia anchored vs. drifting (`accepted`).
  - [`0004-expense-plans-pivot.md`](decisions/0004-expense-plans-pivot.md): giro de producto — planes de gasto como feature central (`partially superseded` por ADR-0005).
  - [`0005-financial-scenarios.md`](decisions/0005-financial-scenarios.md): escenarios financieros como eje del producto (`accepted`).
  - [`0006-question-driven-interface.md`](decisions/0006-question-driven-interface.md): interfaz orientada a preguntas financieras, no a CRUD (`accepted`).

- **`glossary.md`** — términos de dominio financiero usados de forma consistente en todo el proyecto.

## Convenciones de esta carpeta

- Los ADRs se numeran secuencialmente (`000N-titulo-en-kebab-case.md`) y nunca se editan retroactivamente para cambiar una decisión ya tomada: si algo cambia, se crea un ADR nuevo que referencia y sustituye al anterior.
- La documentación de producto y arquitectura sí se actualiza in-place a medida que el proyecto avanza.
- Todo en inglés queda reservado a código/commits (por convención global); esta documentación puede escribirse en español salvo que el proyecto decida lo contrario.
