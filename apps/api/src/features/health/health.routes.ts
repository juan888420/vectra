import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";

const healthResponseSchema = z.object({
  status: z.enum(["ok", "degraded"]),
  uptime: z.number(),
  timestamp: z.iso.datetime(),
  checks: z.object({
    database: z.enum(["up", "down"]),
  }),
});

export const healthRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get(
    "/health",
    {
      schema: {
        tags: ["Health"],
        summary: "Application and database health",
        response: {
          200: healthResponseSchema,
          503: healthResponseSchema,
        },
      },
      config: {
        // Health probes should not consume the client rate-limit budget.
        rateLimit: false,
      },
    },
    async (request, reply) => {
      let database: "up" | "down" = "up";

      try {
        await app.prisma.$queryRaw`SELECT 1`;
      } catch (error) {
        request.log.error(error, "database health check failed");
        database = "down";
      }

      const healthy = database === "up";

      return reply.status(healthy ? 200 : 503).send({
        status: healthy ? "ok" : "degraded",
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
        checks: { database },
      });
    },
  );
};
