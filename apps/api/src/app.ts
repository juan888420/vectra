import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import Fastify from "fastify";
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from "fastify-type-provider-zod";

import { env } from "./config/env.js";
import { authRoutes } from "./features/auth/auth.routes.js";
import { categoriesRoutes } from "./features/categories/categories.routes.js";
import { expenseItemsRoutes } from "./features/expense-items/expense-items.routes.js";
import { healthRoutes } from "./features/health/health.routes.js";
import { incomesRoutes } from "./features/incomes/incomes.routes.js";
import { scenariosRoutes } from "./features/scenarios/scenarios.routes.js";
import { usersRoutes } from "./features/users/users.routes.js";
import { API_PREFIX } from "./lib/api-prefix.js";
import { authPlugin } from "./plugins/auth.js";
import { registerErrorHandler, sendRouteNotFound } from "./plugins/error-handler.js";
import { prismaPlugin } from "./plugins/prisma.js";
import { swaggerPlugin } from "./plugins/swagger.js";
import { webAppPlugin } from "./plugins/web-app.js";

const loggerByEnv = {
  development: {
    transport: {
      target: "pino-pretty",
      options: { translateTime: "HH:MM:ss", ignore: "pid,hostname" },
    },
  },
  production: true,
  test: false,
} as const;

interface BuildAppOptions {
  /// Built SPA to serve alongside the API; omit for an API-only server.
  webDistDir?: string;
}

export async function buildApp({ webDistDir = env.WEB_DIST_DIR }: BuildAppOptions = {}) {
  const app = Fastify({
    logger: loggerByEnv[env.NODE_ENV],
  }).withTypeProvider<ZodTypeProvider>();

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  registerErrorHandler(app);

  // No CORS plugin: the SPA is served from this same origin (ADR-0008), in
  // development through Vite's /api proxy. Browsers block every cross-origin
  // read by default, which is exactly the policy we want.
  await app.register(helmet);
  // Not global under test: the whole suite shares one IP, so the per-IP
  // budget would reject legitimate requests as test files grow. Routes with
  // their own `config.rateLimit` (auth) keep theirs either way.
  await app.register(rateLimit, {
    max: 100,
    timeWindow: "1 minute",
    global: env.NODE_ENV !== "test",
  });
  await app.register(prismaPlugin);
  await app.register(authPlugin);
  await app.register(swaggerPlugin);

  await app.register(
    async (api) => {
      api.setNotFoundHandler((_request, reply) => sendRouteNotFound(reply));

      await api.register(healthRoutes);
      await api.register(authRoutes, { prefix: "/auth" });
      await api.register(usersRoutes);
      await api.register(categoriesRoutes, { prefix: "/categories" });
      await api.register(expenseItemsRoutes, { prefix: "/expense-items" });
      await api.register(incomesRoutes, { prefix: "/incomes" });
      await api.register(scenariosRoutes, { prefix: "/scenarios" });
    },
    { prefix: API_PREFIX },
  );

  if (webDistDir) {
    await app.register(webAppPlugin, { root: webDistDir });
  } else {
    app.setNotFoundHandler((_request, reply) => sendRouteNotFound(reply));
  }

  return app;
}
