# Documentación — Vectra

Índice de la documentación del proyecto. Esta carpeta es la base de conocimiento para el desarrollo de Vectra; se mantiene actualizada a medida que el producto y la arquitectura evolucionan.

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

- **`glossary.md`** — términos de dominio financiero usados de forma consistente en todo el proyecto.

## Convenciones de esta carpeta

- Los ADRs se numeran secuencialmente (`000N-titulo-en-kebab-case.md`) y nunca se editan retroactivamente para cambiar una decisión ya tomada: si algo cambia, se crea un ADR nuevo que referencia y sustituye al anterior.
- La documentación de producto y arquitectura sí se actualiza in-place a medida que el proyecto avanza.
- Todo en inglés queda reservado a código/commits (por convención global); esta documentación puede escribirse en español salvo que el proyecto decida lo contrario.
