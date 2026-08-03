import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import Fastify from "fastify";
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from "fastify-type-provider-zod";

import { env } from "./config/env.js";
import { accountsRoutes } from "./features/accounts/accounts.routes.js";
import { authRoutes } from "./features/auth/auth.routes.js";
import { budgetsRoutes } from "./features/budgets/budgets.routes.js";
import { categoriesRoutes } from "./features/categories/categories.routes.js";
import { dashboardRoutes } from "./features/dashboard/dashboard.routes.js";
import { expenseItemsRoutes } from "./features/expense-items/expense-items.routes.js";
import { healthRoutes } from "./features/health/health.routes.js";
import { incomesRoutes } from "./features/incomes/incomes.routes.js";
import { recurringTransactionsRoutes } from "./features/recurring-transactions/recurring-transactions.routes.js";
import { reportsRoutes } from "./features/reports/reports.routes.js";
import { scenariosRoutes } from "./features/scenarios/scenarios.routes.js";
import { transactionsRoutes } from "./features/transactions/transactions.routes.js";
import { usersRoutes } from "./features/users/users.routes.js";
import { authPlugin } from "./plugins/auth.js";
import { registerErrorHandler } from "./plugins/error-handler.js";
import { prismaPlugin } from "./plugins/prisma.js";
import { swaggerPlugin } from "./plugins/swagger.js";

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

export async function buildApp() {
  const app = Fastify({
    logger: loggerByEnv[env.NODE_ENV],
  }).withTypeProvider<ZodTypeProvider>();

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  registerErrorHandler(app);

  await app.register(helmet);
  await app.register(cors, {
    origin: env.CORS_ORIGIN,
    credentials: true,
    methods: ["GET", "HEAD", "POST", "PATCH", "DELETE"],
  });
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

  await app.register(healthRoutes);
  await app.register(authRoutes, { prefix: "/auth" });
  await app.register(usersRoutes);
  await app.register(accountsRoutes, { prefix: "/accounts" });
  await app.register(categoriesRoutes, { prefix: "/categories" });
  await app.register(transactionsRoutes, { prefix: "/transactions" });
  await app.register(budgetsRoutes, { prefix: "/budgets" });
  await app.register(dashboardRoutes, { prefix: "/dashboard" });
  await app.register(recurringTransactionsRoutes, { prefix: "/recurring-transactions" });
  await app.register(reportsRoutes, { prefix: "/reports" });
  await app.register(expenseItemsRoutes, { prefix: "/expense-items" });
  await app.register(incomesRoutes, { prefix: "/incomes" });
  await app.register(scenariosRoutes, { prefix: "/scenarios" });

  return app;
}
