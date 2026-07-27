import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";

import { errorResponseSchema, idParamsSchema } from "../../lib/schemas.js";
import {
  accountListResponseSchema,
  accountPublicSchema,
  createAccountBodySchema,
  listAccountsQuerySchema,
  updateAccountBodySchema,
} from "./accounts.schemas.js";
import {
  archiveAccount,
  createAccount,
  deleteAccount,
  getAccount,
  listAccounts,
  unarchiveAccount,
  updateAccount,
} from "./accounts.service.js";

const TAGS = ["Accounts"];
const SECURITY = [{ bearerAuth: [] }];

export const accountsRoutes: FastifyPluginAsyncZod = async (app) => {
  app.addHook("onRequest", app.authenticate);

  app.get(
    "/",
    {
      schema: {
        tags: TAGS,
        summary: "List accounts with filters, pagination and sorting",
        security: SECURITY,
        querystring: listAccountsQuerySchema,
        response: { 200: accountListResponseSchema, 401: errorResponseSchema },
      },
    },
    async (request) => listAccounts(app.prisma, request.user.sub, request.query),
  );

  app.get(
    "/:id",
    {
      schema: {
        tags: TAGS,
        summary: "Get an account",
        security: SECURITY,
        params: idParamsSchema,
        response: { 200: accountPublicSchema, 404: errorResponseSchema },
      },
    },
    async (request) => getAccount(app.prisma, request.user.sub, request.params.id),
  );

  app.post(
    "/",
    {
      schema: {
        tags: TAGS,
        summary: "Create an account",
        security: SECURITY,
        body: createAccountBodySchema,
        response: { 201: accountPublicSchema, 400: errorResponseSchema, 409: errorResponseSchema },
      },
    },
    async (request, reply) => {
      const account = await createAccount(app.prisma, request.user.sub, request.body);
      return reply.status(201).send(account);
    },
  );

  app.patch(
    "/:id",
    {
      schema: {
        tags: TAGS,
        summary: "Update an account's name or type",
        security: SECURITY,
        params: idParamsSchema,
        body: updateAccountBodySchema,
        response: { 200: accountPublicSchema, 404: errorResponseSchema, 409: errorResponseSchema },
      },
    },
    async (request) => updateAccount(app.prisma, request.user.sub, request.params.id, request.body),
  );

  app.post(
    "/:id/archive",
    {
      schema: {
        tags: TAGS,
        summary: "Archive an account",
        security: SECURITY,
        params: idParamsSchema,
        response: { 200: accountPublicSchema, 404: errorResponseSchema },
      },
    },
    async (request) => archiveAccount(app.prisma, request.user.sub, request.params.id),
  );

  app.post(
    "/:id/unarchive",
    {
      schema: {
        tags: TAGS,
        summary: "Unarchive an account",
        security: SECURITY,
        params: idParamsSchema,
        response: { 200: accountPublicSchema, 404: errorResponseSchema, 409: errorResponseSchema },
      },
    },
    async (request) => unarchiveAccount(app.prisma, request.user.sub, request.params.id),
  );

  app.delete(
    "/:id",
    {
      schema: {
        tags: TAGS,
        summary: "Delete an account without associated records",
        security: SECURITY,
        params: idParamsSchema,
        response: { 204: z.null(), 404: errorResponseSchema, 409: errorResponseSchema },
      },
    },
    async (request, reply) => {
      await deleteAccount(app.prisma, request.user.sub, request.params.id);
      return reply.status(204).send(null);
    },
  );
};
