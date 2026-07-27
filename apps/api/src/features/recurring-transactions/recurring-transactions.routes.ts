import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";

import { errorResponseSchema, idParamsSchema } from "../../lib/schemas.js";
import {
  createRecurringTransactionBodySchema,
  listRecurringTransactionsQuerySchema,
  recurringTransactionListResponseSchema,
  recurringTransactionPublicSchema,
  updateRecurringTransactionBodySchema,
} from "./recurring-transactions.schemas.js";
import {
  createRecurringTransaction,
  deleteRecurringTransaction,
  getRecurringTransaction,
  listRecurringTransactions,
  pauseRecurringTransaction,
  resumeRecurringTransaction,
  updateRecurringTransaction,
} from "./recurring-transactions.service.js";

const TAGS = ["Recurring transactions"];
const SECURITY = [{ bearerAuth: [] }];

export const recurringTransactionsRoutes: FastifyPluginAsyncZod = async (app) => {
  app.addHook("onRequest", app.authenticate);

  app.get(
    "/",
    {
      schema: {
        tags: TAGS,
        summary: "List recurring transaction templates with filters, pagination and sorting",
        security: SECURITY,
        querystring: listRecurringTransactionsQuerySchema,
        response: { 200: recurringTransactionListResponseSchema, 401: errorResponseSchema },
      },
    },
    async (request) => listRecurringTransactions(app.prisma, request.user.sub, request.query),
  );

  app.get(
    "/:id",
    {
      schema: {
        tags: TAGS,
        summary: "Get a recurring transaction template",
        security: SECURITY,
        params: idParamsSchema,
        response: { 200: recurringTransactionPublicSchema, 404: errorResponseSchema },
      },
    },
    async (request) => getRecurringTransaction(app.prisma, request.user.sub, request.params.id),
  );

  app.post(
    "/",
    {
      schema: {
        tags: TAGS,
        summary: "Create a recurring transaction template",
        security: SECURITY,
        body: createRecurringTransactionBodySchema,
        response: {
          201: recurringTransactionPublicSchema,
          400: errorResponseSchema,
          404: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const template = await createRecurringTransaction(app.prisma, request.user.sub, request.body);
      return reply.status(201).send(template);
    },
  );

  app.patch(
    "/:id",
    {
      schema: {
        tags: TAGS,
        summary: "Update a recurring transaction template (applies to future occurrences)",
        security: SECURITY,
        params: idParamsSchema,
        body: updateRecurringTransactionBodySchema,
        response: {
          200: recurringTransactionPublicSchema,
          400: errorResponseSchema,
          404: errorResponseSchema,
        },
      },
    },
    async (request) =>
      updateRecurringTransaction(app.prisma, request.user.sub, request.params.id, request.body),
  );

  app.post(
    "/:id/pause",
    {
      schema: {
        tags: TAGS,
        summary: "Pause a recurring transaction (keeps its schedule for catch-up on resume)",
        security: SECURITY,
        params: idParamsSchema,
        response: { 200: recurringTransactionPublicSchema, 404: errorResponseSchema },
      },
    },
    async (request) => pauseRecurringTransaction(app.prisma, request.user.sub, request.params.id),
  );

  app.post(
    "/:id/resume",
    {
      schema: {
        tags: TAGS,
        summary: "Resume a paused recurring transaction",
        security: SECURITY,
        params: idParamsSchema,
        response: { 200: recurringTransactionPublicSchema, 404: errorResponseSchema },
      },
    },
    async (request) => resumeRecurringTransaction(app.prisma, request.user.sub, request.params.id),
  );

  app.delete(
    "/:id",
    {
      schema: {
        tags: TAGS,
        summary: "Delete a template (generated transactions are kept and detached)",
        security: SECURITY,
        params: idParamsSchema,
        response: { 204: z.null(), 404: errorResponseSchema },
      },
    },
    async (request, reply) => {
      await deleteRecurringTransaction(app.prisma, request.user.sub, request.params.id);
      return reply.status(204).send(null);
    },
  );
};
