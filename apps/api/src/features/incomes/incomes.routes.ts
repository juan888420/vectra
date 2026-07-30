import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";

import { errorResponseSchema, idParamsSchema } from "../../lib/schemas.js";
import {
  createIncomeBodySchema,
  incomeListResponseSchema,
  incomePublicSchema,
  incomeSummarySchema,
  listIncomesQuerySchema,
  updateIncomeBodySchema,
} from "./incomes.schemas.js";
import {
  archiveIncome,
  createIncome,
  deleteIncome,
  getIncome,
  getIncomeSummary,
  listIncomes,
  unarchiveIncome,
  updateIncome,
} from "./incomes.service.js";

const TAGS = ["Incomes"];
const SECURITY = [{ bearerAuth: [] }];

export const incomesRoutes: FastifyPluginAsyncZod = async (app) => {
  app.addHook("onRequest", app.authenticate);

  app.get(
    "/",
    {
      schema: {
        tags: TAGS,
        summary: "List incomes with filters, pagination and sorting",
        security: SECURITY,
        querystring: listIncomesQuerySchema,
        response: { 200: incomeListResponseSchema, 401: errorResponseSchema },
      },
    },
    async (request) => listIncomes(app.prisma, request.user.sub, request.query),
  );

  app.get(
    "/:id",
    {
      schema: {
        tags: TAGS,
        summary: "Get an income",
        security: SECURITY,
        params: idParamsSchema,
        response: { 200: incomePublicSchema, 404: errorResponseSchema },
      },
    },
    async (request) => getIncome(app.prisma, request.user.sub, request.params.id),
  );

  app.get(
    "/:id/summary",
    {
      schema: {
        tags: TAGS,
        summary: "Get an income's derived monthly/6m/12m projection",
        security: SECURITY,
        params: idParamsSchema,
        response: { 200: incomeSummarySchema, 404: errorResponseSchema },
      },
    },
    async (request) => getIncomeSummary(app.prisma, request.user.sub, request.params.id),
  );

  app.post(
    "/",
    {
      schema: {
        tags: TAGS,
        summary: "Create an income",
        security: SECURITY,
        body: createIncomeBodySchema,
        response: { 201: incomePublicSchema, 409: errorResponseSchema },
      },
    },
    async (request, reply) => {
      const income = await createIncome(app.prisma, request.user.sub, request.body);
      return reply.status(201).send(income);
    },
  );

  app.patch(
    "/:id",
    {
      schema: {
        tags: TAGS,
        summary: "Update an income's name, amount or frequency",
        security: SECURITY,
        params: idParamsSchema,
        body: updateIncomeBodySchema,
        response: { 200: incomePublicSchema, 404: errorResponseSchema, 409: errorResponseSchema },
      },
    },
    async (request) => updateIncome(app.prisma, request.user.sub, request.params.id, request.body),
  );

  app.post(
    "/:id/archive",
    {
      schema: {
        tags: TAGS,
        summary: "Archive an income",
        security: SECURITY,
        params: idParamsSchema,
        response: { 200: incomePublicSchema, 404: errorResponseSchema },
      },
    },
    async (request) => archiveIncome(app.prisma, request.user.sub, request.params.id),
  );

  app.post(
    "/:id/unarchive",
    {
      schema: {
        tags: TAGS,
        summary: "Unarchive an income",
        security: SECURITY,
        params: idParamsSchema,
        response: { 200: incomePublicSchema, 404: errorResponseSchema, 409: errorResponseSchema },
      },
    },
    async (request) => unarchiveIncome(app.prisma, request.user.sub, request.params.id),
  );

  app.delete(
    "/:id",
    {
      schema: {
        tags: TAGS,
        summary: "Delete an income",
        security: SECURITY,
        params: idParamsSchema,
        response: { 204: z.null(), 404: errorResponseSchema },
      },
    },
    async (request, reply) => {
      await deleteIncome(app.prisma, request.user.sub, request.params.id);
      return reply.status(204).send(null);
    },
  );
};
