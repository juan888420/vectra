# Vectra

Vectra is a personal finance tracker that helps individuals log expenses and income, organize them by category, and keep their budgets under control.

![License](https://img.shields.io/badge/license-MIT-blue)
![Status](https://img.shields.io/badge/status-planning-yellow)
![Frontend](https://img.shields.io/badge/frontend-React%2019%20%2B%20TypeScript-61DAFB)
![Backend](https://img.shields.io/badge/backend-Fastify%20%2B%20Prisma-000000)

## Table of contents

- [About](#about)
- [Project status](#project-status)
- [Features](#features)
- [Tech stack](#tech-stack)
- [Documentation](#documentation)
- [Project structure](#project-structure)
- [Contributing](#contributing)
- [License](#license)

## About

Most people don't have a clear, continuous view of where their money goes. Bank apps show isolated movements per account, spreadsheets require constant manual discipline, and most existing tools are either too simple (raw logging) or too complex (full financial planning). Vectra focuses on fast transaction entry and honest, real-time budget tracking, without the noise.

## Project status

**Pre-code / documentation phase.** No application code has been written yet. This stage covers product vision, domain modeling, and architecture decisions. The tech stack is already confirmed (see [ADR-0001](docs/decisions/0001-tech-stack.md)).

## Features

Planned for the MVP (see [vision.md](docs/product/vision.md) for full scope):

- Manual transaction entry (expense/income) with amount, date, category, and account.
- Custom categories, with a suggested starter set.
- Multiple accounts (cash, bank, credit card) to group transactions.
- Per-category, per-period budgets (e.g. monthly).
- Summary view: current balance, spend vs. budget, breakdown by category.
- Recurring transactions (subscriptions, salary) generated automatically each period.

## Tech stack

| Layer    | Technologies                                                                                                                                                 |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Frontend | React 19, TypeScript, Vite, Tailwind CSS v4, shadcn/ui, React Router v7, TanStack Query, React Hook Form, Zod, Framer Motion, Recharts, Lucide React, Sonner |
| Backend  | Fastify, TypeScript, Prisma, PostgreSQL, JWT + Refresh Tokens, bcrypt, Zod                                                                                   |
| DevOps   | Docker, Docker Compose, ESLint, Prettier, Husky, lint-staged                                                                                                 |
| Testing  | Vitest, Testing Library, Supertest                                                                                                                           |
| Deploy   | Vercel (frontend), Railway (backend), Neon or Railway PostgreSQL (database)                                                                                  |
| Extras   | OpenAPI / Swagger                                                                                                                                            |

Full rationale and role of each technology in [ADR-0001](docs/decisions/0001-tech-stack.md).

## Documentation

- [`docs/README.md`](docs/README.md) — documentation index.
- [`docs/product/vision.md`](docs/product/vision.md) — problem, target user, MVP scope.
- [`docs/product/roadmap.md`](docs/product/roadmap.md) — development phases.
- [`docs/architecture/overview.md`](docs/architecture/overview.md) — architecture principles and stack mapping.
- [`docs/architecture/data-model.md`](docs/architecture/data-model.md) — domain entities and relationships.
- [`docs/decisions/`](docs/decisions/) — Architecture Decision Records (ADRs).
- [`docs/glossary.md`](docs/glossary.md) — domain terminology.
- [`.claude/CLAUDE.md`](.claude/CLAUDE.md) — project context and working rules for AI-assisted development.

## Project structure

```
vectra/
├── .claude/
│   └── CLAUDE.md
└── docs/
    ├── README.md
    ├── product/
    │   ├── vision.md
    │   └── roadmap.md
    ├── architecture/
    │   ├── overview.md
    │   └── data-model.md
    ├── decisions/
    │   └── 0001-tech-stack.md
    └── glossary.md
```

Application code (frontend/backend) will be added once the architecture phase is approved, following a feature-based structure (see [CLAUDE.md](.claude/CLAUDE.md)).

## Contributing

This is currently a solo portfolio project in its planning stage. Not open for external contributions yet.

## License

[MIT](LICENSE)
