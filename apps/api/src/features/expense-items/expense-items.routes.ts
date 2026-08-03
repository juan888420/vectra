import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";

import { errorResponseSchema, idParamsSchema } from "../../lib/schemas.js";
import { syncExpenseItemScenarios } from "../scenarios/scenarios.service.js";
import {
  createExpenseItemBodySchema,
  expenseItemListResponseSchema,
  expenseItemMutationResponseSchema,
  expenseItemPublicSchema,
  expenseItemSummarySchema,
  listExpenseItemsQuerySchema,
  syncExpenseItemScenariosResponseSchema,
  updateExpenseItemBodySchema,
} from "./expense-items.schemas.js";
import {
  archiveExpenseItem,
  createExpenseItem,
  deleteExpenseItem,
  getExpenseItem,
  getExpenseItemSummary,
  listExpenseItems,
  unarchiveExpenseItem,
  updateExpenseItem,
} from "./expense-items.service.js";

const TAGS = ["Expense items"];
const SECURITY = [{ bearerAuth: [] }];

export const expenseItemsRoutes: FastifyPluginAsyncZod = async (app) => {
  app.addHook("onRequest", app.authenticate);

  app.get(
    "/",
    {
      schema: {
        tags: TAGS,
        summary: "List expense items with filters, pagination and sorting",
        security: SECURITY,
        querystring: listExpenseItemsQuerySchema,
        response: { 200: expenseItemListResponseSchema, 401: errorResponseSchema },
      },
    },
    async (request) => listExpenseItems(app.prisma, request.user.sub, request.query),
  );

  app.get(
    "/:id",
    {
      schema: {
        tags: TAGS,
        summary: "Get an expense item",
        security: SECURITY,
        params: idParamsSchema,
        response: { 200: expenseItemPublicSchema, 404: errorResponseSchema },
      },
    },
    async (request) => getExpenseItem(app.prisma, request.user.sub, request.params.id),
  );

  app.get(
    "/:id/summary",
    {
      schema: {
        tags: TAGS,
        summary: "Get an expense item's derived totals and the scenarios that use it",
        security: SECURITY,
        params: idParamsSchema,
        response: { 200: expenseItemSummarySchema, 404: errorResponseSchema },
      },
    },
    async (request) => getExpenseItemSummary(app.prisma, request.user.sub, request.params.id),
  );

  app.post(
    "/",
    {
      schema: {
        tags: TAGS,
        summary: "Create an expense item in an expense category",
        security: SECURITY,
        body: createExpenseItemBodySchema,
        response: {
          201: expenseItemPublicSchema,
          400: errorResponseSchema,
          409: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const item = await createExpenseItem(app.prisma, request.user.sub, request.body);
      return reply.status(201).send(item);
    },
  );

  app.patch(
    "/:id",
    {
      schema: {
        tags: TAGS,
        summary: "Update an expense item's name, amount, frequency or category",
        security: SECURITY,
        params: idParamsSchema,
        body: updateExpenseItemBodySchema,
        response: {
          200: expenseItemMutationResponseSchema,
          400: errorResponseSchema,
          404: errorResponseSchema,
          409: errorResponseSchema,
        },
      },
    },
    async (request) =>
      updateExpenseItem(app.prisma, request.user.sub, request.params.id, request.body),
  );

  app.post(
    "/:id/archive",
    {
      schema: {
        tags: TAGS,
        summary: "Archive an expense item",
        security: SECURITY,
        params: idParamsSchema,
        response: { 200: expenseItemMutationResponseSchema, 404: errorResponseSchema },
      },
    },
    async (request) => archiveExpenseItem(app.prisma, request.user.sub, request.params.id),
  );

  app.post(
    "/:id/unarchive",
    {
      schema: {
        tags: TAGS,
        summary: "Unarchive an expense item",
        security: SECURITY,
        params: idParamsSchema,
        response: {
          200: expenseItemMutationResponseSchema,
          400: errorResponseSchema,
          404: errorResponseSchema,
          409: errorResponseSchema,
        },
      },
    },
    async (request) => unarchiveExpenseItem(app.prisma, request.user.sub, request.params.id),
  );

  app.post(
    "/:id/sync-scenarios",
    {
      schema: {
        tags: TAGS,
        summary: "Sync every scenario snapshot still financially out of sync with this item",
        security: SECURITY,
        params: idParamsSchema,
        response: { 200: syncExpenseItemScenariosResponseSchema, 404: errorResponseSchema },
      },
    },
    async (request) => syncExpenseItemScenarios(app.prisma, request.user.sub, request.params.id),
  );

  app.delete(
    "/:id",
    {
      schema: {
        tags: TAGS,
        summary: "Delete an expense item",
        security: SECURITY,
        params: idParamsSchema,
        response: { 204: z.null(), 404: errorResponseSchema },
      },
    },
    async (request, reply) => {
      await deleteExpenseItem(app.prisma, request.user.sub, request.params.id);
      return reply.status(204).send(null);
    },
  );
};
