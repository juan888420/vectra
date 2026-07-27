import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";

import { errorResponseSchema } from "../../lib/schemas.js";
import {
  accountStatsQuerySchema,
  accountStatsResponseSchema,
  cashFlowQuerySchema,
  cashFlowResponseSchema,
  categoryTrendsQuerySchema,
  categoryTrendsResponseSchema,
  periodComparisonQuerySchema,
  periodComparisonResponseSchema,
} from "./reports.schemas.js";
import {
  getAccountStats,
  getCashFlow,
  getCategoryTrends,
  getPeriodComparison,
} from "./reports.service.js";

const TAGS = ["Reports"];
const SECURITY = [{ bearerAuth: [] }];

export const reportsRoutes: FastifyPluginAsyncZod = async (app) => {
  app.addHook("onRequest", app.authenticate);

  app.get(
    "/cash-flow",
    {
      schema: {
        tags: TAGS,
        summary:
          "Income, expenses and balance per period (day/week/month/year) with a cumulative running balance",
        security: SECURITY,
        querystring: cashFlowQuerySchema,
        response: {
          200: cashFlowResponseSchema,
          400: errorResponseSchema,
          401: errorResponseSchema,
        },
      },
    },
    async (request) => getCashFlow(app.prisma, request.user.sub, request.query),
  );

  app.get(
    "/category-trends",
    {
      schema: {
        tags: TAGS,
        summary:
          "Expense evolution per category over time, in Recharts-ready wide format with a color legend",
        security: SECURITY,
        querystring: categoryTrendsQuerySchema,
        response: {
          200: categoryTrendsResponseSchema,
          400: errorResponseSchema,
          401: errorResponseSchema,
        },
      },
    },
    async (request) => getCategoryTrends(app.prisma, request.user.sub, request.query),
  );

  app.get(
    "/account-stats",
    {
      schema: {
        tags: TAGS,
        summary: "Per-account activity statistics for a date range",
        security: SECURITY,
        querystring: accountStatsQuerySchema,
        response: {
          200: accountStatsResponseSchema,
          400: errorResponseSchema,
          401: errorResponseSchema,
        },
      },
    },
    async (request) => getAccountStats(app.prisma, request.user.sub, request.query),
  );

  app.get(
    "/period-comparison",
    {
      schema: {
        tags: TAGS,
        summary: "Totals for two explicit date ranges with absolute and percentage change",
        security: SECURITY,
        querystring: periodComparisonQuerySchema,
        response: {
          200: periodComparisonResponseSchema,
          400: errorResponseSchema,
          401: errorResponseSchema,
        },
      },
    },
    async (request) => getPeriodComparison(app.prisma, request.user.sub, request.query),
  );
};
