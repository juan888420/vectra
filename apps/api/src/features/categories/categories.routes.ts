import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";

import { errorResponseSchema, idParamsSchema } from "../../lib/schemas.js";
import {
  categoryListResponseSchema,
  categoryPublicSchema,
  createCategoryBodySchema,
  listCategoriesQuerySchema,
  updateCategoryBodySchema,
} from "./categories.schemas.js";
import {
  archiveCategory,
  createCategory,
  deleteCategory,
  getCategory,
  listCategories,
  unarchiveCategory,
  updateCategory,
} from "./categories.service.js";

const TAGS = ["Categories"];
const SECURITY = [{ bearerAuth: [] }];

export const categoriesRoutes: FastifyPluginAsyncZod = async (app) => {
  app.addHook("onRequest", app.authenticate);

  app.get(
    "/",
    {
      schema: {
        tags: TAGS,
        summary: "List categories with filters, pagination and sorting",
        security: SECURITY,
        querystring: listCategoriesQuerySchema,
        response: { 200: categoryListResponseSchema, 401: errorResponseSchema },
      },
    },
    async (request) => listCategories(app.prisma, request.user.sub, request.query),
  );

  app.get(
    "/:id",
    {
      schema: {
        tags: TAGS,
        summary: "Get a category",
        security: SECURITY,
        params: idParamsSchema,
        response: { 200: categoryPublicSchema, 404: errorResponseSchema },
      },
    },
    async (request) => getCategory(app.prisma, request.user.sub, request.params.id),
  );

  app.post(
    "/",
    {
      schema: {
        tags: TAGS,
        summary: "Create a category",
        security: SECURITY,
        body: createCategoryBodySchema,
        response: { 201: categoryPublicSchema, 409: errorResponseSchema },
      },
    },
    async (request, reply) => {
      const category = await createCategory(app.prisma, request.user.sub, request.body);
      return reply.status(201).send(category);
    },
  );

  app.patch(
    "/:id",
    {
      schema: {
        tags: TAGS,
        summary: "Rename a category",
        security: SECURITY,
        params: idParamsSchema,
        body: updateCategoryBodySchema,
        response: { 200: categoryPublicSchema, 404: errorResponseSchema, 409: errorResponseSchema },
      },
    },
    async (request) =>
      updateCategory(app.prisma, request.user.sub, request.params.id, request.body),
  );

  app.post(
    "/:id/archive",
    {
      schema: {
        tags: TAGS,
        summary: "Archive a category (cascades to its active budgets)",
        security: SECURITY,
        params: idParamsSchema,
        response: { 200: categoryPublicSchema, 404: errorResponseSchema, 409: errorResponseSchema },
      },
    },
    async (request) => archiveCategory(app.prisma, request.user.sub, request.params.id),
  );

  app.post(
    "/:id/unarchive",
    {
      schema: {
        tags: TAGS,
        summary: "Unarchive a category",
        security: SECURITY,
        params: idParamsSchema,
        response: { 200: categoryPublicSchema, 404: errorResponseSchema, 409: errorResponseSchema },
      },
    },
    async (request) => unarchiveCategory(app.prisma, request.user.sub, request.params.id),
  );

  app.delete(
    "/:id",
    {
      schema: {
        tags: TAGS,
        summary: "Delete a category without associated records",
        security: SECURITY,
        params: idParamsSchema,
        response: { 204: z.null(), 404: errorResponseSchema, 409: errorResponseSchema },
      },
    },
    async (request, reply) => {
      await deleteCategory(app.prisma, request.user.sub, request.params.id);
      return reply.status(204).send(null);
    },
  );
};
