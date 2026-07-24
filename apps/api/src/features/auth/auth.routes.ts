import type { FastifyReply, FastifyRequest } from "fastify";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";

import { env } from "../../config/env.js";
import { unauthorized } from "../../lib/http-errors.js";
import { toUserPublic } from "../users/users.schemas.js";
import {
  authResponseSchema,
  errorResponseSchema,
  loginBodySchema,
  registerBodySchema,
} from "./auth.schemas.js";
import { loginUser, registerUser, revokeRefreshToken, rotateRefreshToken } from "./auth.service.js";

export const REFRESH_COOKIE = "vectra_refresh";

// Scoped to /auth so the browser only attaches it to refresh/logout calls.
// SameSite=Lax works in dev (localhost ports are same-site); the production
// cross-site setup (Vercel <-> Railway) is documented in RFC-0010.
function setRefreshCookie(reply: FastifyReply, token: string, expiresAt: Date): void {
  void reply.setCookie(REFRESH_COOKIE, token, {
    path: "/auth",
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "lax",
    expires: expiresAt,
  });
}

function readRefreshCookie(request: FastifyRequest): string {
  const token = request.cookies[REFRESH_COOKIE];
  if (!token) {
    throw unauthorized("Missing refresh token");
  }
  return token;
}

// Tighter than the global 100/min: these endpoints do bcrypt work and are
// the target of credential-stuffing attacks.
const strictRateLimit = { rateLimit: { max: 10, timeWindow: "1 minute" } };

export const authRoutes: FastifyPluginAsyncZod = async (app) => {
  app.post(
    "/register",
    {
      schema: {
        tags: ["Auth"],
        summary: "Register a new user",
        body: registerBodySchema,
        response: { 201: authResponseSchema, 409: errorResponseSchema },
      },
      config: strictRateLimit,
    },
    async (request, reply) => {
      const { user, refreshToken } = await registerUser(app.prisma, request.body);
      const accessToken = await reply.jwtSign({ sub: user.id });

      setRefreshCookie(reply, refreshToken.token, refreshToken.expiresAt);
      return reply.status(201).send({ user: toUserPublic(user), accessToken });
    },
  );

  app.post(
    "/login",
    {
      schema: {
        tags: ["Auth"],
        summary: "Log in with email and password",
        body: loginBodySchema,
        response: { 200: authResponseSchema, 401: errorResponseSchema },
      },
      config: strictRateLimit,
    },
    async (request, reply) => {
      const { email, password } = request.body;
      const { user, refreshToken } = await loginUser(app.prisma, email, password);
      const accessToken = await reply.jwtSign({ sub: user.id });

      setRefreshCookie(reply, refreshToken.token, refreshToken.expiresAt);
      return reply.status(200).send({ user: toUserPublic(user), accessToken });
    },
  );

  app.post(
    "/refresh",
    {
      schema: {
        tags: ["Auth"],
        summary: "Rotate the refresh token and issue a new access token",
        response: { 200: authResponseSchema, 401: errorResponseSchema },
      },
    },
    async (request, reply) => {
      const token = readRefreshCookie(request);
      const { user, refreshToken } = await rotateRefreshToken(app.prisma, token);
      const accessToken = await reply.jwtSign({ sub: user.id });

      setRefreshCookie(reply, refreshToken.token, refreshToken.expiresAt);
      return reply.status(200).send({ user: toUserPublic(user), accessToken });
    },
  );

  app.post(
    "/logout",
    {
      schema: {
        tags: ["Auth"],
        summary: "Revoke the current session",
        response: { 204: z.null() },
      },
    },
    async (request, reply) => {
      const token = request.cookies[REFRESH_COOKIE];
      if (token) {
        await revokeRefreshToken(app.prisma, token);
      }

      void reply.clearCookie(REFRESH_COOKIE, { path: "/auth" });
      return reply.status(204).send(null);
    },
  );
};
