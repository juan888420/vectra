import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";

import { errorResponseSchema, idParamsSchema } from "../../lib/schemas.js";
import {
  createTransactionBodySchema,
  listTransactionsQuerySchema,
  transactionListResponseSchema,
  transactionPublicSchema,
  updateTransactionBodySchema,
} from "./transactions.schemas.js";
import {
  createTransaction,
  deleteTransaction,
  getTransaction,
  listTransactions,
  updateTransaction,
} from "./transactions.service.js";

const TAGS = ["Transactions"];
const SECURITY = [{ bearerAuth: [] }];

export const transactionsRoutes: FastifyPluginAsyncZod = async (app) => {
  app.addHook("onRequest", app.authenticate);

  app.get(
    "/",
    {
      schema: {
        tags: TAGS,
        summary: "List transactions with filters, search, pagination and sorting",
        security: SECURITY,
        querystring: listTransactionsQuerySchema,
        response: { 200: transactionListResponseSchema, 401: errorResponseSchema },
      },
    },
    async (request) => listTransactions(app.prisma, request.user.sub, request.query),
  );

  app.get(
    "/:id",
    {
      schema: {
        tags: TAGS,
        summary: "Get a transaction",
        security: SECURITY,
        params: idParamsSchema,
        response: { 200: transactionPublicSchema, 404: errorResponseSchema },
      },
    },
    async (request) => getTransaction(app.prisma, request.user.sub, request.params.id),
  );

  app.post(
    "/",
    {
      schema: {
        tags: TAGS,
        summary: "Create a transaction",
        security: SECURITY,
        body: createTransactionBodySchema,
        response: {
          201: transactionPublicSchema,
          400: errorResponseSchema,
          404: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const transaction = await createTransaction(app.prisma, request.user.sub, request.body);
      return reply.status(201).send(transaction);
    },
  );

  app.patch(
    "/:id",
    {
      schema: {
        tags: TAGS,
        summary: "Update a transaction",
        security: SECURITY,
        params: idParamsSchema,
        body: updateTransactionBodySchema,
        response: {
          200: transactionPublicSchema,
          400: errorResponseSchema,
          404: errorResponseSchema,
        },
      },
    },
    async (request) =>
      updateTransaction(app.prisma, request.user.sub, request.params.id, request.body),
  );

  // Hard delete: a temporary MVP decision (see transactions.service.ts),
  // not a definitive domain rule.
  app.delete(
    "/:id",
    {
      schema: {
        tags: TAGS,
        summary: "Delete a transaction (hard delete, temporary MVP behavior)",
        security: SECURITY,
        params: idParamsSchema,
        response: { 204: z.null(), 404: errorResponseSchema },
      },
    },
    async (request, reply) => {
      await deleteTransaction(app.prisma, request.user.sub, request.params.id);
      return reply.status(204).send(null);
    },
  );
};
