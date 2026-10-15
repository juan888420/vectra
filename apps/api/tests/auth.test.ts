import { createHash } from "node:crypto";

import type { FastifyInstance, LightMyRequestResponse } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { buildApp } from "../src/app.js";
import { REFRESH_COOKIE } from "../src/features/auth/auth.routes.js";
import { REFRESH_REUSE_GRACE_MS } from "../src/features/auth/auth.service.js";

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

let clientCounter = 0;
// Each call from a distinct client so the 10/min login/register limit never
// interferes with what these tests are about.
function nextClient(): string {
  clientCounter += 1;
  return `192.0.2.${clientCounter}`;
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
      remoteAddress: nextClient(),
      payload: { email, password: PASSWORD },
    });
    expect(res.statusCode).toBe(201);
    return { email, res, cookie: refreshCookieOf(res) };
  }

  // A second, independent session for the same user (another device).
  function logIn(email: string) {
    return app.inject({
      method: "POST",
      url: "/api/auth/login",
      remoteAddress: nextClient(),
      payload: { email, password: PASSWORD },
    });
  }

  function refresh(token: string) {
    return app.inject({
      method: "POST",
      url: "/api/auth/refresh",
      cookies: { [REFRESH_COOKIE]: token },
    });
  }

  function setsRefreshCookie(res: LightMyRequestResponse): boolean {
    return res.cookies.some((cookie) => cookie.name === REFRESH_COOKIE);
  }

  // Moves a rotated token's revocation into the past, as if it had been
  // rotated longer ago than the grace window.
  async function ageRotation(token: string, ms: number): Promise<void> {
    await app.prisma.refreshToken.update({
      where: { tokenHash: createHash("sha256").update(token).digest("hex") },
      data: { revokedAt: new Date(Date.now() - ms) },
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

    const login = await logIn(email);
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

  describe("refresh token rotation", () => {
    it("lets concurrent refreshes with the same cookie both succeed without forking", async () => {
      const { email, cookie } = await register();
      const otherDevice = refreshCookieOf(await logIn(email));

      const [first, second] = await Promise.all([refresh(cookie.value), refresh(cookie.value)]);

      expect([first.statusCode, second.statusCode]).toEqual([200, 200]);
      // Exactly one response rotates: the other confirms the session and
      // leaves the cookie alone, so there is a single successor.
      const rotated = [first, second].filter(setsRefreshCookie);
      expect(rotated).toHaveLength(1);
      const successor = refreshCookieOf(rotated[0]!);

      expect((await refresh(successor.value)).statusCode).toBe(200);
      expect((await refresh(otherDevice.value)).statusCode).toBe(200);
    });

    it("accepts a just-rotated cookie within the grace window, without a new cookie", async () => {
      const { email, cookie } = await register();
      const otherDevice = refreshCookieOf(await logIn(email));
      const successor = refreshCookieOf(await refresh(cookie.value));

      // e.g. a second tab that loaded before the first one's Set-Cookie landed
      const late = await refresh(cookie.value);

      expect(late.statusCode).toBe(200);
      expect(late.json().accessToken).toEqual(expect.any(String));
      expect(setsRefreshCookie(late)).toBe(false);
      expect((await refresh(successor.value)).statusCode).toBe(200);
      expect((await refresh(otherDevice.value)).statusCode).toBe(200);
    });

    it("treats a rotated cookie presented after the grace window as theft", async () => {
      const { email, cookie } = await register();
      const otherDevice = refreshCookieOf(await logIn(email));
      const successor = refreshCookieOf(await refresh(cookie.value));
      await ageRotation(cookie.value, REFRESH_REUSE_GRACE_MS + 1_000);

      const reused = await refresh(cookie.value);

      expect(reused.statusCode).toBe(401);
      // Every session dies, including the legitimate successor and other devices.
      expect((await refresh(successor.value)).statusCode).toBe(401);
      expect((await refresh(otherDevice.value)).statusCode).toBe(401);
    });

    it("does not revive a session that was logged out, even within the grace window", async () => {
      const { email, cookie } = await register();
      const otherDevice = refreshCookieOf(await logIn(email));
      const successor = refreshCookieOf(await refresh(cookie.value));
      await app.inject({
        method: "POST",
        url: "/api/auth/logout",
        cookies: { [REFRESH_COOKIE]: successor.value },
      });

      expect((await refresh(cookie.value)).statusCode).toBe(401);
      // Not treated as theft: the other device stays signed in.
      expect((await refresh(otherDevice.value)).statusCode).toBe(200);
    });

    it("rejects a logged-out cookie without signing out other devices", async () => {
      const { email, cookie } = await register();
      const otherDevice = refreshCookieOf(await logIn(email));
      await app.inject({
        method: "POST",
        url: "/api/auth/logout",
        cookies: { [REFRESH_COOKIE]: cookie.value },
      });

      expect((await refresh(cookie.value)).statusCode).toBe(401);
      expect((await refresh(otherDevice.value)).statusCode).toBe(200);
    });
  });
});
