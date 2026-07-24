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
import { authRoutes } from "./features/auth/auth.routes.js";
import { healthRoutes } from "./features/health/health.routes.js";
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
  await app.register(cors, { origin: env.CORS_ORIGIN, credentials: true });
  await app.register(rateLimit, { max: 100, timeWindow: "1 minute" });
  await app.register(prismaPlugin);
  await app.register(authPlugin);
  await app.register(swaggerPlugin);

  await app.register(healthRoutes);
  await app.register(authRoutes, { prefix: "/auth" });
  await app.register(usersRoutes);

  return app;
}
