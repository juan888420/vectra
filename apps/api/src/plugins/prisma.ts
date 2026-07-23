import { PrismaPg } from "@prisma/adapter-pg";
import fp from "fastify-plugin";

import { env } from "../config/env.js";
import { PrismaClient } from "../generated/prisma/client.js";

declare module "fastify" {
  interface FastifyInstance {
    prisma: PrismaClient;
  }
}

// Prisma 7 client is Rust-free and connects through a driver adapter.
export const prismaPlugin = fp(async (app) => {
  const adapter = new PrismaPg({ connectionString: env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter });

  app.decorate("prisma", prisma);

  app.addHook("onClose", async () => {
    await prisma.$disconnect();
  });
});
