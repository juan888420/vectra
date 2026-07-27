import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";

import { errorResponseSchema } from "../../lib/schemas.js";
import { dashboardSummarySchema } from "./dashboard.schemas.js";
import { getDashboardSummary } from "./dashboard.service.js";

const TAGS = ["Dashboard"];
const SECURITY = [{ bearerAuth: [] }];

export const dashboardRoutes: FastifyPluginAsyncZod = async (app) => {
  app.addHook("onRequest", app.authenticate);

  app.get(
    "/summary",
    {
      schema: {
        tags: TAGS,
        summary:
          "Real-time financial summary: balances, current month, category breakdown, top expenses, budget status, month-over-month comparison and a financial health score",
        security: SECURITY,
        response: { 200: dashboardSummarySchema, 401: errorResponseSchema },
      },
    },
    async (request) => getDashboardSummary(app.prisma, request.user.sub),
  );
};
