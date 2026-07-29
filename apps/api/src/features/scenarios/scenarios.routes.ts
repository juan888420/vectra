import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";

import { errorResponseSchema, idParamsSchema } from "../../lib/schemas.js";
import {
  addScenarioCategoryBodySchema,
  addScenarioCompositionBodySchema,
  addScenarioIncomeBodySchema,
  addScenarioItemBodySchema,
  createScenarioBodySchema,
  listScenariosQuerySchema,
  pendingCategorySyncSchema,
  scenarioCompositionSchema,
  scenarioIncomeSchema,
  scenarioItemSchema,
  scenarioListResponseSchema,
  scenarioPublicSchema,
  scenarioTotalsSchema,
  updateScenarioBodySchema,
} from "./scenarios.schemas.js";
import {
  addScenarioCategory,
  addScenarioComposition,
  addScenarioIncome,
  addScenarioItem,
  archiveScenario,
  createScenario,
  deleteScenario,
  getPendingCategorySync,
  getScenario,
  getScenarioTotals,
  listScenarios,
  removeScenarioComposition,
  removeScenarioIncome,
  removeScenarioItem,
  unarchiveScenario,
  updateScenario,
} from "./scenarios.service.js";

const TAGS = ["Scenarios"];
const SECURITY = [{ bearerAuth: [] }];

const scenarioItemParamsSchema = z.object({ id: z.uuid(), expenseItemId: z.uuid() });
const scenarioCompositionParamsSchema = z.object({
  id: z.uuid(),
  includedScenarioId: z.uuid(),
});
const scenarioIncomeParamsSchema = z.object({ id: z.uuid(), incomeId: z.uuid() });

export const scenariosRoutes: FastifyPluginAsyncZod = async (app) => {
  app.addHook("onRequest", app.authenticate);

  app.get(
    "/",
    {
      schema: {
        tags: TAGS,
        summary: "List scenarios with filters, pagination and sorting",
        security: SECURITY,
        querystring: listScenariosQuerySchema,
        response: { 200: scenarioListResponseSchema, 401: errorResponseSchema },
      },
    },
    async (request) => listScenarios(app.prisma, request.user.sub, request.query),
  );

  app.get(
    "/:id",
    {
      schema: {
        tags: TAGS,
        summary: "Get a scenario",
        security: SECURITY,
        params: idParamsSchema,
        response: { 200: scenarioPublicSchema, 404: errorResponseSchema },
      },
    },
    async (request) => getScenario(app.prisma, request.user.sub, request.params.id),
  );

  app.get(
    "/:id/totals",
    {
      schema: {
        tags: TAGS,
        summary: "Get a scenario's recursive totals and income coverage",
        security: SECURITY,
        params: idParamsSchema,
        response: { 200: scenarioTotalsSchema, 404: errorResponseSchema },
      },
    },
    async (request) => getScenarioTotals(app.prisma, request.user.sub, request.params.id),
  );

  app.get(
    "/:id/pending-category-sync",
    {
      schema: {
        tags: TAGS,
        summary: "List categories added in bulk whose active items no longer match",
        security: SECURITY,
        params: idParamsSchema,
        response: { 200: z.array(pendingCategorySyncSchema), 404: errorResponseSchema },
      },
    },
    async (request) => getPendingCategorySync(app.prisma, request.user.sub, request.params.id),
  );

  app.post(
    "/",
    {
      schema: {
        tags: TAGS,
        summary: "Create a scenario",
        security: SECURITY,
        body: createScenarioBodySchema,
        response: { 201: scenarioPublicSchema, 400: errorResponseSchema, 409: errorResponseSchema },
      },
    },
    async (request, reply) => {
      const scenario = await createScenario(app.prisma, request.user.sub, request.body);
      return reply.status(201).send(scenario);
    },
  );

  app.patch(
    "/:id",
    {
      schema: {
        tags: TAGS,
        summary: "Update a scenario's name or status",
        security: SECURITY,
        params: idParamsSchema,
        body: updateScenarioBodySchema,
        response: {
          200: scenarioPublicSchema,
          400: errorResponseSchema,
          404: errorResponseSchema,
          409: errorResponseSchema,
        },
      },
    },
    async (request) =>
      updateScenario(app.prisma, request.user.sub, request.params.id, request.body),
  );

  app.post(
    "/:id/archive",
    {
      schema: {
        tags: TAGS,
        summary: "Archive a scenario",
        security: SECURITY,
        params: idParamsSchema,
        response: { 200: scenarioPublicSchema, 404: errorResponseSchema },
      },
    },
    async (request) => archiveScenario(app.prisma, request.user.sub, request.params.id),
  );

  app.post(
    "/:id/unarchive",
    {
      schema: {
        tags: TAGS,
        summary: "Unarchive a scenario",
        security: SECURITY,
        params: idParamsSchema,
        response: {
          200: scenarioPublicSchema,
          404: errorResponseSchema,
          409: errorResponseSchema,
        },
      },
    },
    async (request) => unarchiveScenario(app.prisma, request.user.sub, request.params.id),
  );

  app.delete(
    "/:id",
    {
      schema: {
        tags: TAGS,
        summary: "Delete a scenario",
        security: SECURITY,
        params: idParamsSchema,
        response: { 204: z.null(), 404: errorResponseSchema, 409: errorResponseSchema },
      },
    },
    async (request, reply) => {
      await deleteScenario(app.prisma, request.user.sub, request.params.id);
      return reply.status(204).send(null);
    },
  );

  app.post(
    "/:id/items",
    {
      schema: {
        tags: TAGS,
        summary: "Select an expense item in a scenario",
        security: SECURITY,
        params: idParamsSchema,
        body: addScenarioItemBodySchema,
        response: {
          201: scenarioItemSchema,
          400: errorResponseSchema,
          404: errorResponseSchema,
          409: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const item = await addScenarioItem(
        app.prisma,
        request.user.sub,
        request.params.id,
        request.body,
      );
      return reply.status(201).send(item);
    },
  );

  app.post(
    "/:id/categories",
    {
      schema: {
        tags: TAGS,
        summary: "Select every active item of a category at once",
        security: SECURITY,
        params: idParamsSchema,
        body: addScenarioCategoryBodySchema,
        response: {
          201: z.object({ added: z.number() }),
          400: errorResponseSchema,
          404: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const result = await addScenarioCategory(
        app.prisma,
        request.user.sub,
        request.params.id,
        request.body,
      );
      return reply.status(201).send(result);
    },
  );

  app.delete(
    "/:id/items/:expenseItemId",
    {
      schema: {
        tags: TAGS,
        summary: "Remove an expense item from a scenario",
        security: SECURITY,
        params: scenarioItemParamsSchema,
        response: { 204: z.null(), 404: errorResponseSchema },
      },
    },
    async (request, reply) => {
      await removeScenarioItem(
        app.prisma,
        request.user.sub,
        request.params.id,
        request.params.expenseItemId,
      );
      return reply.status(204).send(null);
    },
  );

  app.post(
    "/:id/compositions",
    {
      schema: {
        tags: TAGS,
        summary: "Include another scenario in this one",
        security: SECURITY,
        params: idParamsSchema,
        body: addScenarioCompositionBodySchema,
        response: {
          201: scenarioCompositionSchema,
          400: errorResponseSchema,
          404: errorResponseSchema,
          409: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const composition = await addScenarioComposition(
        app.prisma,
        request.user.sub,
        request.params.id,
        request.body,
      );
      return reply.status(201).send(composition);
    },
  );

  app.delete(
    "/:id/compositions/:includedScenarioId",
    {
      schema: {
        tags: TAGS,
        summary: "Stop including a scenario",
        security: SECURITY,
        params: scenarioCompositionParamsSchema,
        response: { 204: z.null(), 404: errorResponseSchema },
      },
    },
    async (request, reply) => {
      await removeScenarioComposition(
        app.prisma,
        request.user.sub,
        request.params.id,
        request.params.includedScenarioId,
      );
      return reply.status(204).send(null);
    },
  );

  app.post(
    "/:id/incomes",
    {
      schema: {
        tags: TAGS,
        summary: "Link an income to a scenario",
        security: SECURITY,
        params: idParamsSchema,
        body: addScenarioIncomeBodySchema,
        response: {
          201: scenarioIncomeSchema,
          400: errorResponseSchema,
          404: errorResponseSchema,
          409: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const income = await addScenarioIncome(
        app.prisma,
        request.user.sub,
        request.params.id,
        request.body,
      );
      return reply.status(201).send(income);
    },
  );

  app.delete(
    "/:id/incomes/:incomeId",
    {
      schema: {
        tags: TAGS,
        summary: "Unlink an income from a scenario",
        security: SECURITY,
        params: scenarioIncomeParamsSchema,
        response: { 204: z.null(), 404: errorResponseSchema },
      },
    },
    async (request, reply) => {
      await removeScenarioIncome(
        app.prisma,
        request.user.sub,
        request.params.id,
        request.params.incomeId,
      );
      return reply.status(204).send(null);
    },
  );
};
