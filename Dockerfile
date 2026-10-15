# Single-service image (ADR-0008): Fastify serves the API under /api and the
# built SPA everywhere else. Migrations are NOT run here or at startup — they
# run once per deploy as the platform's pre-deploy step (railway.json).

FROM node:22-bookworm-slim AS base
# Prisma picks its schema engine (prisma migrate deploy) by the system OpenSSL.
# The slim image has none, so Prisma falls back to a binary with its own
# statically embedded OpenSSL: it works, but never gets Debian's security
# updates. With openssl installed it selects the build that links libssl3.
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable
WORKDIR /app

# --- build: full workspace, dev dependencies included -----------------------
FROM base AS build
COPY . .
RUN pnpm install --frozen-lockfile
# Builds @vectra/types and @vectra/utils first (turbo ^build), then the API
# (prisma generate + tsc) and the SPA (vite build).
RUN pnpm turbo run build --filter=@vectra/api --filter=@vectra/web

# --- runtime: production dependencies of the API only -----------------------
FROM base AS runtime
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV WEB_DIST_DIR=/app/apps/web/dist
# Railway puts one proxy in front of the container. Pending verification on a
# real deploy (ADR-0008) — the rate limiter's client IP depends on it.
ENV TRUST_PROXY_HOPS=1

# Every workspace manifest, so the frozen lockfile still matches; only the
# API's production dependency closure is actually installed.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/config/package.json packages/config/
COPY packages/types/package.json packages/types/
COPY packages/ui/package.json packages/ui/
COPY packages/utils/package.json packages/utils/
# The root `prepare` installs git hooks (husky, a dev dependency) — meaningless
# in an image and fatal once dev dependencies are left out.
RUN npm pkg delete scripts.prepare \
  && pnpm install --frozen-lockfile --prod --filter "@vectra/api..."

COPY --from=build /app/packages/types/dist packages/types/dist
COPY --from=build /app/packages/utils/dist packages/utils/dist
COPY --from=build /app/apps/api/dist apps/api/dist
# Needed by the pre-deploy `prisma migrate deploy`, not by the server itself.
COPY --from=build /app/apps/api/prisma apps/api/prisma
COPY --from=build /app/apps/api/prisma.config.ts apps/api/
COPY --from=build /app/apps/web/dist apps/web/dist

USER node
WORKDIR /app/apps/api
EXPOSE 3001
CMD ["node", "dist/server.js"]
