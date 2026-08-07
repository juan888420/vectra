import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";

import { errorResponseSchema, idParamsSchema } from "../../lib/schemas.js";
import {
  addScenarioCategory,
  addScenarioComposition,
  addScenarioIncome,
  addScenarioItem,
  applyScenarioChanges,
  archiveScenario,
  activateScenario,
  createScenario,
  deactivateScenario,
  deleteScenario,
  detectScenarioChanges,
  getScenario,
  getScenarioSummary,
  listScenarioCompositions,
  listScenarioIncomes,
  listScenarioItems,
  listScenarios,
  removeScenarioComposition,
  removeScenarioIncome,
  removeScenarioItem,
  syncScenario,
  unarchiveScenario,
  updateScenario,
} from "./scenarios.service.js";
import {
  addScenarioCategoryBodySchema,
  addScenarioCategoryResponseSchema,
  addScenarioCompositionBodySchema,
  addScenarioIncomeBodySchema,
  addScenarioItemBodySchema,
  applyScenarioChangesBodySchema,
  applyScenarioChangesResponseSchema,
  createScenarioBodySchema,
  listScenariosQuerySchema,
  scenarioChangesResponseSchema,
  scenarioCompositionPublicSchema,
  scenarioIncomePublicSchema,
  scenarioItemPublicSchema,
  scenarioListResponseSchema,
  scenarioPublicSchema,
  scenarioSummarySchema,
  syncScenarioResponseSchema,
  updateScenarioBodySchema,
} from "./scenarios.schemas.js";

const TAGS = ["Scenarios"];
const SECURITY = [{ bearerAuth: [] }];
const scenarioItemParamsSchema = z.object({ id: z.uuid(), itemId: z.uuid() });
const scenarioIncomeParamsSchema = z.object({ id: z.uuid(), incomeId: z.uuid() });
const scenarioCompositionParamsSchema = z.object({ id: z.uuid(), compositionId: z.uuid() });

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
    "/:id/summary",
    {
      schema: {
        tags: TAGS,
        summary: "Get a scenario's derived totals, projections, coverage and drift status",
        security: SECURITY,
        params: idParamsSchema,
        response: { 200: scenarioSummarySchema, 404: errorResponseSchema },
      },
    },
    async (request) => getScenarioSummary(app.prisma, request.user.sub, request.params.id),
  );

  app.post(
    "/:id/sync",
    {
      schema: {
        tags: TAGS,
        summary: "Apply every pending financial change reachable from this scenario at once",
        security: SECURITY,
        params: idParamsSchema,
        response: { 200: syncScenarioResponseSchema, 404: errorResponseSchema },
      },
    },
    async (request) => syncScenario(app.prisma, request.user.sub, request.params.id),
  );

  app.post(
    "/",
    {
      schema: {
        tags: TAGS,
        summary: "Create a scenario",
        security: SECURITY,
        body: createScenarioBodySchema,
        response: { 201: scenarioPublicSchema, 409: errorResponseSchema },
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
        summary: "Rename a scenario",
        security: SECURITY,
        params: idParamsSchema,
        body: updateScenarioBodySchema,
        response: { 200: scenarioPublicSchema, 404: errorResponseSchema, 409: errorResponseSchema },
      },
    },
    async (request) =>
      updateScenario(app.prisma, request.user.sub, request.params.id, request.body),
  );

  app.post(
    "/:id/activate",
    {
      schema: {
        tags: TAGS,
        summary: "Mark a scenario as active",
        security: SECURITY,
        params: idParamsSchema,
        response: { 200: scenarioPublicSchema, 404: errorResponseSchema, 409: errorResponseSchema },
      },
    },
    async (request) => activateScenario(app.prisma, request.user.sub, request.params.id),
  );

  app.post(
    "/:id/deactivate",
    {
      schema: {
        tags: TAGS,
        summary: "Mark a scenario as inactive",
        security: SECURITY,
        params: idParamsSchema,
        response: { 200: scenarioPublicSchema, 404: errorResponseSchema, 409: errorResponseSchema },
      },
    },
    async (request) => deactivateScenario(app.prisma, request.user.sub, request.params.id),
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
        summary: "Unarchive a scenario (returns to inactive)",
        security: SECURITY,
        params: idParamsSchema,
        response: { 200: scenarioPublicSchema, 404: errorResponseSchema, 409: errorResponseSchema },
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

  // --- Items -----------------------------------------------------------

  app.get(
    "/:id/items",
    {
      schema: {
        tags: TAGS,
        summary: "List a scenario's expense item selections",
        security: SECURITY,
        params: idParamsSchema,
        response: {
          200: z.object({ data: z.array(scenarioItemPublicSchema) }),
          404: errorResponseSchema,
        },
      },
    },
    async (request) => ({
      data: await listScenarioItems(app.prisma, request.user.sub, request.params.id),
    }),
  );

  app.post(
    "/:id/items",
    {
      schema: {
        tags: TAGS,
        summary: "Add an expense item snapshot to a scenario",
        security: SECURITY,
        params: idParamsSchema,
        body: addScenarioItemBodySchema,
        response: {
          201: scenarioItemPublicSchema,
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
        request.body.expenseItemId,
        request.body.frequency,
      );
      return reply.status(201).send(item);
    },
  );

  app.delete(
    "/:id/items/:itemId",
    {
      schema: {
        tags: TAGS,
        summary: "Remove an expense item selection from a scenario",
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
        request.params.itemId,
      );
      return reply.status(204).send(null);
    },
  );

  // --- Incomes -----------------------------------------------------------

  app.get(
    "/:id/incomes",
    {
      schema: {
        tags: TAGS,
        summary: "List a scenario's linked incomes",
        security: SECURITY,
        params: idParamsSchema,
        response: {
          200: z.object({ data: z.array(scenarioIncomePublicSchema) }),
          404: errorResponseSchema,
        },
      },
    },
    async (request) => ({
      data: await listScenarioIncomes(app.prisma, request.user.sub, request.params.id),
    }),
  );

  app.post(
    "/:id/incomes",
    {
      schema: {
        tags: TAGS,
        summary: "Link an income snapshot to a scenario",
        security: SECURITY,
        params: idParamsSchema,
        body: addScenarioIncomeBodySchema,
        response: {
          201: scenarioIncomePublicSchema,
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
        request.body.incomeId,
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

  // --- Composition (scenario-in-scenario) ---------------------------------

  app.get(
    "/:id/compositions",
    {
      schema: {
        tags: TAGS,
        summary: "List the scenarios included inside a scenario",
        security: SECURITY,
        params: idParamsSchema,
        response: {
          200: z.object({ data: z.array(scenarioCompositionPublicSchema) }),
          404: errorResponseSchema,
        },
      },
    },
    async (request) => ({
      data: await listScenarioCompositions(app.prisma, request.user.sub, request.params.id),
    }),
  );

  app.post(
    "/:id/compositions",
    {
      schema: {
        tags: TAGS,
        summary: "Include another scenario inside this one",
        security: SECURITY,
        params: idParamsSchema,
        body: addScenarioCompositionBodySchema,
        response: {
          201: z.object({ id: z.uuid(), childScenarioId: z.uuid() }),
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
        request.body.childScenarioId,
      );
      return reply
        .status(201)
        .send({ id: composition.id, childScenarioId: composition.childScenarioId });
    },
  );

  app.delete(
    "/:id/compositions/:compositionId",
    {
      schema: {
        tags: TAGS,
        summary: "Remove a scenario composition",
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
        request.params.compositionId,
      );
      return reply.status(204).send(null);
    },
  );

  // --- Change review (RFC-0023.1) -----------------------------------------

  app.get(
    "/:id/changes",
    {
      schema: {
        tags: TAGS,
        summary: "List a scenario's pending changes (visual + financial), explained field by field",
        security: SECURITY,
        params: idParamsSchema,
        response: { 200: scenarioChangesResponseSchema, 404: errorResponseSchema },
      },
    },
    async (request) => ({
      data: await detectScenarioChanges(app.prisma, request.user.sub, request.params.id),
    }),
  );

  app.post(
    "/:id/changes/apply",
    {
      schema: {
        tags: TAGS,
        summary:
          "Apply a set of pending changes by id (visual changes never need this to be listed first)",
        security: SECURITY,
        params: idParamsSchema,
        body: applyScenarioChangesBodySchema,
        response: { 200: applyScenarioChangesResponseSchema, 404: errorResponseSchema },
      },
    },
    async (request) =>
      applyScenarioChanges(app.prisma, request.user.sub, request.params.id, request.body.changeIds),
  );

  // --- "Add whole category" (ADR-0005 §7) ---------------------------------

  app.post(
    "/:id/category",
    {
      schema: {
        tags: TAGS,
        summary: "Add every active product of a category to the scenario as individual items",
        security: SECURITY,
        params: idParamsSchema,
        body: addScenarioCategoryBodySchema,
        response: {
          201: addScenarioCategoryResponseSchema,
          400: errorResponseSchema,
          404: errorResponseSchema,
          409: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const result = await addScenarioCategory(
        app.prisma,
        request.user.sub,
        request.params.id,
        request.body.categoryId,
      );
      return reply.status(201).send(result);
    },
  );
};
