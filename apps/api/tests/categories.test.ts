import type { FastifyInstance } from "fastify";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { buildApp } from "../src/app.js";
import { cleanupTestUser, registerTestUser, type TestUser } from "./helpers/test-user.js";

function uniqueName(prefix: string): string {
  return `${prefix} ${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

describe("Category summary", () => {
  let app: FastifyInstance;
  let user: TestUser;
  let auth: Record<string, string>;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
    user = await registerTestUser(app);
    auth = { Authorization: `Bearer ${user.accessToken}` };
  });

  afterAll(async () => {
    await cleanupTestUser(app, user.userId);
    await app.close();
  });

  async function createExpenseCategory() {
    const res = await request(app.server)
      .post("/categories")
      .set(auth)
      .send({ name: uniqueName("Tecnología"), type: "EXPENSE" });
    return res.body.id as string;
  }

  it("sums monthly, prorates YEARLY and excludes ONE_TIME from the total", async () => {
    const categoryId = await createExpenseCategory();
    await request(app.server)
      .post("/expense-items")
      .set(auth)
      .send({ categoryId, name: uniqueName("Claude"), amount: 50000, frequency: "MONTHLY" });
    await request(app.server)
      .post("/expense-items")
      .set(auth)
      .send({ categoryId, name: uniqueName("Dominio"), amount: 120000, frequency: "YEARLY" });
    const oneTime = await request(app.server)
      .post("/expense-items")
      .set(auth)
      .send({ categoryId, name: uniqueName("Mac Mini"), amount: 900000, frequency: "ONE_TIME" });

    const res = await request(app.server).get(`/categories/${categoryId}/summary`).set(auth);

    expect(res.status).toBe(200);
    // 50000 + (120000 / 12) = 60000
    expect(res.body.totals.monthly).toBe(60000);
    expect(res.body.totals.sixMonths).toBe(360000);
    expect(res.body.totals.twelveMonths).toBe(720000);
    expect(res.body.oneTimeTotal).toBe(900000);
    expect(res.body.items).toHaveLength(3);
    expect(res.body.items.map((item: { id: string }) => item.id)).toContain(oneTime.body.id);
  });

  it("excludes archived items from the summary", async () => {
    const categoryId = await createExpenseCategory();
    const item = await request(app.server)
      .post("/expense-items")
      .set(auth)
      .send({ categoryId, name: uniqueName("Spotify"), amount: 20000 });
    await request(app.server).post(`/expense-items/${item.body.id}/archive`).set(auth);

    const res = await request(app.server).get(`/categories/${categoryId}/summary`).set(auth);

    expect(res.body.totals.monthly).toBe(0);
    expect(res.body.items).toHaveLength(0);
  });

  it("returns an empty summary for a category with no items", async () => {
    const categoryId = await createExpenseCategory();

    const res = await request(app.server).get(`/categories/${categoryId}/summary`).set(auth);

    expect(res.status).toBe(200);
    expect(res.body.totals.monthly).toBe(0);
    expect(res.body.items).toEqual([]);
  });

  it("hides another user's category summary behind a 404", async () => {
    const stranger = await registerTestUser(app);
    const strangerAuth = { Authorization: `Bearer ${stranger.accessToken}` };
    const categoryRes = await request(app.server)
      .post("/categories")
      .set(strangerAuth)
      .send({ name: uniqueName("Secreto"), type: "EXPENSE" });

    const res = await request(app.server)
      .get(`/categories/${categoryRes.body.id}/summary`)
      .set(auth);
    expect(res.status).toBe(404);

    await cleanupTestUser(app, stranger.userId);
  });
});
