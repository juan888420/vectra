# Security policy

Vectra is a personal finance application still in its pre-development phase. No production deployment exists yet.

## Reporting a vulnerability

If you find a security issue, please open a private report via [GitHub Security Advisories](https://github.com/juan888420/vectra/security/advisories/new) instead of a public issue. This project does not yet have a bug bounty program.

## Security practices

As implementation starts, Vectra follows these practices from the beginning (see [`.claude/CLAUDE.md`](.claude/CLAUDE.md)):

- Input validation and sanitization (Zod on both frontend and backend).
- Password hashing with bcrypt.
- JWT access tokens with short expiration + rotating refresh tokens.
- `HttpOnly` cookies for refresh tokens.
- Rate limiting on authentication and write endpoints.
- Parameterized queries via Prisma (no raw SQL string interpolation).
- Protection against common web attacks (XSS, CSRF).
