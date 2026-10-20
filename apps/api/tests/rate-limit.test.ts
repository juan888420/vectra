import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { buildApp } from "../src/app.js";

// The platform proxy as seen from the server socket, and two real clients as
// that proxy reports them (it appends the address it saw to X-Forwarded-For).
const PROXY = "10.0.0.1";
const CLIENT_A = "203.0.113.7";
const CLIENT_B = "203.0.113.8";

// Login allows 10 attempts per minute per client (auth.routes.ts).
const LOGIN_LIMIT = 10;
// Budgets per minute from plugins/rate-limit.ts.
const USER_LIMIT = 300;
const ANONYMOUS_LIMIT = 100;

// Failed logins also count per email (auth.routes.ts).
const LOGIN_FAILURES_LIMIT = 10;

let nobodyCounter = 0;
// A fresh email per attempt by default, so tests about the per-IP limit never
// trip the per-email one.
function failedLogin(
  app: FastifyInstance,
  init: { remoteAddress: string; xff?: string; email?: string },
) {
  nobodyCounter += 1;
  return app.inject({
    method: "POST",
    url: "/api/auth/login",
    remoteAddress: init.remoteAddress,
    headers: init.xff ? { "x-forwarded-for": init.xff } : {},
    payload: {
      email: init.email ?? `nobody-${nobodyCounter}@example.com`,
      password: "wrong-password",
    },
  });
}

describe("Rate limiting behind one trusted proxy", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp({ trustProxyHops: 1, globalRateLimit: true });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it("cannot be evaded by forging X-Forwarded-For", async () => {
    // Every request claims a different origin in the part of the header the
    // client controls; the proxy-appended entry (CLIENT_A) stays the same.
    const statuses: number[] = [];
    for (let i = 0; i < LOGIN_LIMIT + 3; i++) {
      const res = await failedLogin(app, {
        remoteAddress: PROXY,
        xff: `198.51.100.${i}, ${CLIENT_A}`,
      });
      statuses.push(res.statusCode);
    }

    expect(statuses.slice(0, LOGIN_LIMIT).every((status) => status === 401)).toBe(true);
    expect(statuses.slice(LOGIN_LIMIT)).toEqual([429, 429, 429]);
  });

  it("does not let one client exhaust the budget of everyone behind the proxy", async () => {
    // CLIENT_A is now limited (previous test); CLIENT_B shares the proxy
    // socket address but is a different client.
    const res = await failedLogin(app, { remoteAddress: PROXY, xff: CLIENT_B });

    expect(res.statusCode).toBe(401);
  });

  it("reports the limit with the stable error code", async () => {
    const res = await failedLogin(app, { remoteAddress: PROXY, xff: `1.1.1.1, ${CLIENT_A}` });

    expect(res.statusCode).toBe(429);
    expect(res.json().code).toBe("RATE_LIMITED");
  });
});

describe("Rate limiting with no trusted proxy", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp({ trustProxyHops: 0, globalRateLimit: true });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it("ignores X-Forwarded-For entirely", async () => {
    const statuses: number[] = [];
    for (let i = 0; i < LOGIN_LIMIT + 2; i++) {
      const res = await failedLogin(app, { remoteAddress: CLIENT_A, xff: `198.51.100.${i}` });
      statuses.push(res.statusCode);
    }

    expect(statuses.slice(LOGIN_LIMIT)).toEqual([429, 429]);
  });
});

describe("Rate limiting of signed-in users", () => {
  let app: FastifyInstance;
  const emails: string[] = [];

  async function signUp(): Promise<string> {
    const email = `rl-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
    emails.push(email);
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/register",
      remoteAddress: PROXY,
      headers: { "x-forwarded-for": `198.51.100.${emails.length}` },
      payload: { email, password: "password123" },
    });
    return res.json().accessToken as string;
  }

  function me(token: string) {
    // Both users come from the same client address on purpose.
    return app.inject({
      method: "GET",
      url: "/api/me",
      remoteAddress: PROXY,
      headers: { authorization: `Bearer ${token}`, "x-forwarded-for": CLIENT_A },
    });
  }

  beforeAll(async () => {
    app = await buildApp({ trustProxyHops: 1, globalRateLimit: true });
    await app.ready();
  });

  afterAll(async () => {
    await app.prisma.user.deleteMany({ where: { email: { in: emails } } });
    await app.close();
  });

  it("limits per account, so users sharing an address do not throttle each other", async () => {
    const tokenA = await signUp();
    const tokenB = await signUp();

    let lastA = 0;
    for (let i = 0; i <= USER_LIMIT; i++) {
      lastA = (await me(tokenA)).statusCode;
    }

    expect(lastA).toBe(429);
    expect((await me(tokenB)).statusCode).toBe(200);
  });

  it("counts requests with a forged token against the client address", async () => {
    // A token that fails verification is keyed by address, whatever `sub` it
    // claims — and it is counted even though authentication rejects it.
    const forged = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ4In0.invalid";
    const statuses: number[] = [];
    for (let i = 0; i <= ANONYMOUS_LIMIT; i++) {
      const res = await app.inject({
        method: "GET",
        url: "/api/me",
        remoteAddress: PROXY,
        headers: { authorization: `Bearer ${forged}`, "x-forwarded-for": CLIENT_B },
      });
      statuses.push(res.statusCode);
    }

    expect(statuses.slice(0, ANONYMOUS_LIMIT).every((status) => status === 401)).toBe(true);
    expect(statuses[ANONYMOUS_LIMIT]).toBe(429);
  });
});

describe("Failed login limit per account", () => {
  let app: FastifyInstance;
  const emails: string[] = [];
  let clientCounter = 0;

  // A different client address on every request, as an attacker rotating
  // IPs would, so only the per-email limit can stop them.
  function nextClient(): string {
    clientCounter += 1;
    return `203.0.113.${clientCounter}`;
  }

  function logIn(email: string, password: string) {
    return app.inject({
      method: "POST",
      url: "/api/auth/login",
      remoteAddress: PROXY,
      headers: { "x-forwarded-for": nextClient() },
      payload: { email, password },
    });
  }

  async function signUp(): Promise<string> {
    const email = `lf-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
    emails.push(email);
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/register",
      remoteAddress: PROXY,
      headers: { "x-forwarded-for": nextClient() },
      payload: { email, password: "password123" },
    });
    expect(res.statusCode).toBe(201);
    return email;
  }

  beforeAll(async () => {
    app = await buildApp({ trustProxyHops: 1, globalRateLimit: true });
    await app.ready();
  });

  afterAll(async () => {
    await app.prisma.user.deleteMany({ where: { email: { in: emails } } });
    await app.close();
  });

  it("locks an account after repeated failures from any address", async () => {
    const email = await signUp();

    // Mixed case on purpose: the schema lowercases, so it is one account.
    for (let i = 0; i < LOGIN_FAILURES_LIMIT; i++) {
      const attempt = i % 2 === 0 ? email : email.toUpperCase();
      expect((await logIn(attempt, "wrong-password")).statusCode).toBe(401);
    }

    // Even the right password is refused until the window ends.
    const locked = await logIn(email, "password123");
    expect(locked.statusCode).toBe(429);
    expect(locked.json().code).toBe("RATE_LIMITED");
    expect(Number(locked.headers["retry-after"])).toBeGreaterThan(0);
  });

  it("does not affect other accounts", async () => {
    const email = await signUp();

    expect((await logIn(email, "password123")).statusCode).toBe(200);
  });

  it("does not count successful logins", async () => {
    const email = await signUp();

    for (let i = 0; i < LOGIN_FAILURES_LIMIT + 1; i++) {
      expect((await logIn(email, "password123")).statusCode).toBe(200);
    }
    expect((await logIn(email, "wrong-password")).statusCode).toBe(401);
  });

  it("counts an unknown email like a wrong password", async () => {
    // Otherwise a 429 on one and a 401 on the other would reveal which
    // accounts exist.
    const email = `ghost-${Date.now()}@example.com`;

    for (let i = 0; i < LOGIN_FAILURES_LIMIT; i++) {
      expect((await logIn(email, "wrong-password")).statusCode).toBe(401);
    }
    expect((await logIn(email, "wrong-password")).statusCode).toBe(429);
  });
});
