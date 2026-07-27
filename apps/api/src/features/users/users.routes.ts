import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";

import { errorResponseSchema } from "../../lib/schemas.js";
import { getUserById } from "../auth/auth.service.js";
import { toUserPublic, userPublicSchema } from "./users.schemas.js";

export const usersRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get(
    "/me",
    {
      onRequest: [app.authenticate],
      schema: {
        tags: ["Users"],
        summary: "Get the authenticated user",
        security: [{ bearerAuth: [] }],
        response: { 200: userPublicSchema, 401: errorResponseSchema },
      },
    },
    async (request) => {
      const user = await getUserById(app.prisma, request.user.sub);
      return toUserPublic(user);
    },
  );
};
