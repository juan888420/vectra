import type { FastifyReply, FastifyRequest } from "fastify";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";

import { env } from "../../config/env.js";
import { API_PREFIX } from "../../lib/api-prefix.js";
import { isHttpError, tooManyRequests, unauthorized } from "../../lib/http-errors.js";
import { errorResponseSchema } from "../../lib/schemas.js";
import { toUserPublic } from "../users/users.schemas.js";
import { authResponseSchema, loginBodySchema, registerBodySchema } from "./auth.schemas.js";
import { loginUser, registerUser, revokeRefreshToken, rotateRefreshToken } from "./auth.service.js";

export const REFRESH_COOKIE = "vectra_refresh";
// Must match where authRoutes is mounted, or the browser stops sending the
// cookie to /refresh and /logout and every reload silently loses the session.
export const REFRESH_COOKIE_PATH = `${API_PREFIX}/auth`;

// Scoped to the auth routes so the browser only attaches it to refresh/logout
// calls. SameSite=Lax is enough because the SPA and the API share one origin
// (ADR-0008) — the cookie is never sent cross-site.
function setRefreshCookie(reply: FastifyReply, token: string, expiresAt: Date): void {
  void reply.setCookie(REFRESH_COOKIE, token, {
    path: REFRESH_COOKIE_PATH,
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "lax",
    expires: expiresAt,
  });
}

function readRefreshCookie(request: FastifyRequest): string {
  const token = request.cookies[REFRESH_COOKIE];
  if (!token) {
    throw unauthorized("UNAUTHENTICATED", "Missing refresh token");
  }
  return token;
}

// Tighter than the global 100/min: these endpoints do bcrypt work and are
// the target of credential-stuffing attacks.
const strictRateLimit = { rateLimit: { max: 10, timeWindow: "1 minute" } };

// Per account, on top of the per-IP limit: the client IP behind Railway's CDN
// is not reliable (ADR-0008), so an attacker rotating addresses must still hit
// a ceiling per target. Only failures count, so a user who signs in normally
// never spends budget. The cost is that anyone can lock an account's login for
// the window by failing on purpose (ADR-0008, "IP del cliente y rate limiting").
const LOGIN_FAILURES_MAX = 10;
const LOGIN_FAILURES_WINDOW = "15 minutes";

export const authRoutes: FastifyPluginAsyncZod = async (app) => {
  const loginFailures = app.createRateLimit({
    max: LOGIN_FAILURES_MAX,
    timeWindow: LOGIN_FAILURES_WINDOW,
    // Runs inside the handler, after validation; the schema lowercases email.
    keyGenerator: (request) => `login-email:${loginBodySchema.parse(request.body).email}`,
  });

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
      // `isAllowed` is always false outside an allow list; `remaining` is the
      // real signal. A read does not count the attempt.
      const failures = await loginFailures(request, { increment: false });
      if (!failures.isAllowed && failures.remaining === 0) {
        void reply.header("retry-after", failures.ttlInSeconds);
        throw tooManyRequests("Too many failed login attempts for this account");
      }

      const { email, password } = request.body;
      const { user, refreshToken } = await loginUser(app.prisma, email, password).catch(
        async (error: unknown) => {
          // Unknown email and wrong password count alike, so a 429 never
          // reveals whether the account exists.
          if (isHttpError(error) && error.code === "INVALID_CREDENTIALS") {
            await loginFailures(request);
          }
          throw error;
        },
      );
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

      // Null inside the reuse grace window: a concurrent request already
      // rotated this token and its response sets the successor cookie.
      if (refreshToken) {
        setRefreshCookie(reply, refreshToken.token, refreshToken.expiresAt);
      }
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

      void reply.clearCookie(REFRESH_COOKIE, { path: REFRESH_COOKIE_PATH });
      return reply.status(204).send(null);
    },
  );
};
