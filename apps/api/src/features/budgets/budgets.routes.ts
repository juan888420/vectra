import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";

import { errorResponseSchema, idParamsSchema } from "../../lib/schemas.js";
import {
  budgetListResponseSchema,
  budgetPublicSchema,
  createBudgetBodySchema,
  listBudgetsQuerySchema,
  updateBudgetBodySchema,
} from "./budgets.schemas.js";
import {
  archiveBudget,
  createBudget,
  deleteBudget,
  getBudget,
  listBudgets,
  unarchiveBudget,
  updateBudget,
} from "./budgets.service.js";

const TAGS = ["Budgets"];
const SECURITY = [{ bearerAuth: [] }];

export const budgetsRoutes: FastifyPluginAsyncZod = async (app) => {
  app.addHook("onRequest", app.authenticate);

  app.get(
    "/",
    {
      schema: {
        tags: TAGS,
        summary: "List budgets with computed spend, pagination and sorting",
        security: SECURITY,
        querystring: listBudgetsQuerySchema,
        response: { 200: budgetListResponseSchema, 401: errorResponseSchema },
      },
    },
    async (request) => listBudgets(app.prisma, request.user.sub, request.query),
  );

  app.get(
    "/:id",
    {
      schema: {
        tags: TAGS,
        summary: "Get a budget with computed spend, remaining amount and status",
        security: SECURITY,
        params: idParamsSchema,
        response: { 200: budgetPublicSchema, 404: errorResponseSchema },
      },
    },
    async (request) => getBudget(app.prisma, request.user.sub, request.params.id),
  );

  app.post(
    "/",
    {
      schema: {
        tags: TAGS,
        summary: "Create a budget for an expense category",
        security: SECURITY,
        body: createBudgetBodySchema,
        response: {
          201: budgetPublicSchema,
          400: errorResponseSchema,
          409: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const budget = await createBudget(app.prisma, request.user.sub, request.body);
      return reply.status(201).send(budget);
    },
  );

  app.patch(
    "/:id",
    {
      schema: {
        tags: TAGS,
        summary: "Update a budget's amount",
        security: SECURITY,
        params: idParamsSchema,
        body: updateBudgetBodySchema,
        response: { 200: budgetPublicSchema, 404: errorResponseSchema },
      },
    },
    async (request) => updateBudget(app.prisma, request.user.sub, request.params.id, request.body),
  );

  app.post(
    "/:id/archive",
    {
      schema: {
        tags: TAGS,
        summary: "Archive a budget",
        security: SECURITY,
        params: idParamsSchema,
        response: { 200: budgetPublicSchema, 404: errorResponseSchema },
      },
    },
    async (request) => archiveBudget(app.prisma, request.user.sub, request.params.id),
  );

  app.post(
    "/:id/unarchive",
    {
      schema: {
        tags: TAGS,
        summary: "Unarchive a budget",
        security: SECURITY,
        params: idParamsSchema,
        response: { 200: budgetPublicSchema, 404: errorResponseSchema, 409: errorResponseSchema },
      },
    },
    async (request) => unarchiveBudget(app.prisma, request.user.sub, request.params.id),
  );

  app.delete(
    "/:id",
    {
      schema: {
        tags: TAGS,
        summary: "Delete a budget",
        security: SECURITY,
        params: idParamsSchema,
        response: { 204: z.null(), 404: errorResponseSchema },
      },
    },
    async (request, reply) => {
      await deleteBudget(app.prisma, request.user.sub, request.params.id);
      return reply.status(204).send(null);
    },
  );
};
