import type { FastifyInstance, LightMyRequestResponse } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { buildApp } from "../src/app.js";
import { REFRESH_COOKIE } from "../src/features/auth/auth.routes.js";

const PASSWORD = "password123";

function uniqueEmail(): string {
  return `auth-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
}

function refreshCookieOf(res: LightMyRequestResponse) {
  const cookie = res.cookies.find((candidate) => candidate.name === REFRESH_COOKIE);
  if (!cookie) {
    throw new Error("response did not set the refresh cookie");
  }
  return cookie;
}

describe("Auth", () => {
  let app: FastifyInstance;
  const createdEmails: string[] = [];

  async function register() {
    const email = uniqueEmail();
    createdEmails.push(email);
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { email, password: PASSWORD },
    });
    expect(res.statusCode).toBe(201);
    return { email, res, cookie: refreshCookieOf(res) };
  }

  function refresh(token: string) {
    return app.inject({
      method: "POST",
      url: "/api/auth/refresh",
      cookies: { [REFRESH_COOKIE]: token },
    });
  }

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.prisma.user.deleteMany({ where: { email: { in: createdEmails } } });
    await app.close();
  });

  it("scopes the refresh cookie to the auth routes under the API prefix", async () => {
    const { cookie } = await register();

    // The browser only sends a cookie to paths under its Path: if this drifts
    // from where authRoutes is mounted, every reload loses the session.
    expect(cookie.path).toBe("/api/auth");
    expect(cookie.httpOnly).toBe(true);
    expect(cookie.sameSite).toBe("Lax");
  });

  it("sets the same cookie path on login and refresh", async () => {
    const { email } = await register();

    const login = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email, password: PASSWORD },
    });
    expect(login.statusCode).toBe(200);
    const loginCookie = refreshCookieOf(login);
    expect(loginCookie.path).toBe("/api/auth");

    const refreshed = await refresh(loginCookie.value);
    expect(refreshed.statusCode).toBe(200);
    expect(refreshCookieOf(refreshed).path).toBe("/api/auth");
  });

  it("issues a working access token on refresh", async () => {
    const { cookie } = await register();

    const refreshed = await refresh(cookie.value);
    const me = await app.inject({
      method: "GET",
      url: "/api/me",
      headers: { authorization: `Bearer ${refreshed.json().accessToken}` },
    });

    expect(me.statusCode).toBe(200);
  });

  it("clears the cookie on logout with the same path and revokes the session", async () => {
    const { cookie } = await register();

    const logout = await app.inject({
      method: "POST",
      url: "/api/auth/logout",
      cookies: { [REFRESH_COOKIE]: cookie.value },
    });
    expect(logout.statusCode).toBe(204);
    const cleared = refreshCookieOf(logout);
    expect(cleared.path).toBe("/api/auth");
    expect(cleared.value).toBe("");

    expect((await refresh(cookie.value)).statusCode).toBe(401);
  });

  it("rejects a refresh without a cookie", async () => {
    const res = await app.inject({ method: "POST", url: "/api/auth/refresh" });

    expect(res.statusCode).toBe(401);
    expect(res.json().code).toBe("UNAUTHENTICATED");
  });
});
