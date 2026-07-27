import type { FastifyInstance } from "fastify";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { buildApp } from "../src/app.js";
import { cleanupTestUser, registerTestUser, type TestUser } from "./helpers/test-user.js";

// Every test that needs a budget creates its own expense category, so
// budgets never collide on the "one active budget per category+period"
// uniqueness rule across unrelated tests.
async function createExpenseCategory(app: FastifyInstance, auth: Record<string, string>) {
  const res = await request(app.server)
    .post("/categories")
    .set(auth)
    .send({ name: `Budget test ${Date.now()}-${Math.random()}`, type: "EXPENSE" });
  return res.body.id as string;
}

function firstDayOfPreviousMonth(): string {
  const now = new Date();
  const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 15));
  return date.toISOString().slice(0, 10);
}

describe("Budgets", () => {
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

  it("creates a budget with zero spend and ON_TRACK status", async () => {
    const categoryId = await createExpenseCategory(app, auth);

    const res = await request(app.server)
      .post("/budgets")
      .set(auth)
      .send({ categoryId, amount: 200 });

    expect(res.status).toBe(201);
    expect(res.body.amount).toBe(200);
    expect(res.body.spent).toBe(0);
    expect(res.body.remaining).toBe(200);
    expect(res.body.percentUsed).toBe(0);
    expect(res.body.status).toBe("ON_TRACK");
  });

  it("rejects a budget for an income category", async () => {
    const res = await request(app.server)
      .post("/budgets")
      .set(auth)
      .send({ categoryId: user.incomeCategoryId, amount: 200 });

    expect(res.status).toBe(400);
  });

  it("rejects a budget for an archived category", async () => {
    const categoryId = await createExpenseCategory(app, auth);
    await request(app.server).post(`/categories/${categoryId}/archive`).set(auth);

    const res = await request(app.server)
      .post("/budgets")
      .set(auth)
      .send({ categoryId, amount: 200 });

    expect(res.status).toBe(400);
  });

  it("rejects an amount with more than 2 decimal places", async () => {
    const categoryId = await createExpenseCategory(app, auth);

    const res = await request(app.server)
      .post("/budgets")
      .set(auth)
      .send({ categoryId, amount: 10.999 });

    expect(res.status).toBe(400);
  });

  it("rejects a duplicate active budget for the same category and period (business rule 6)", async () => {
    const categoryId = await createExpenseCategory(app, auth);
    await request(app.server).post("/budgets").set(auth).send({ categoryId, amount: 200 });

    const res = await request(app.server)
      .post("/budgets")
      .set(auth)
      .send({ categoryId, amount: 300 });

    expect(res.status).toBe(409);
  });

  it("computes spent, remaining, percentUsed and status from current-period transactions", async () => {
    const categoryId = await createExpenseCategory(app, auth);
    const budget = await request(app.server)
      .post("/budgets")
      .set(auth)
      .send({ categoryId, amount: 100 });

    const today = new Date().toISOString().slice(0, 10);
    await request(app.server).post("/transactions").set(auth).send({
      accountId: user.accountId,
      categoryId,
      type: "EXPENSE",
      amount: 85,
      date: today,
    });

    const warningRes = await request(app.server).get(`/budgets/${budget.body.id}`).set(auth);
    expect(warningRes.body.spent).toBe(85);
    expect(warningRes.body.remaining).toBe(15);
    expect(warningRes.body.percentUsed).toBe(85);
    expect(warningRes.body.status).toBe("WARNING");

    await request(app.server).post("/transactions").set(auth).send({
      accountId: user.accountId,
      categoryId,
      type: "EXPENSE",
      amount: 35,
      date: today,
    });

    const exceededRes = await request(app.server).get(`/budgets/${budget.body.id}`).set(auth);
    expect(exceededRes.body.spent).toBe(120);
    expect(exceededRes.body.remaining).toBe(-20);
    expect(exceededRes.body.status).toBe("EXCEEDED");
  });

  it("excludes transactions from a previous period", async () => {
    const categoryId = await createExpenseCategory(app, auth);
    const budget = await request(app.server)
      .post("/budgets")
      .set(auth)
      .send({ categoryId, amount: 100 });

    await request(app.server).post("/transactions").set(auth).send({
      accountId: user.accountId,
      categoryId,
      type: "EXPENSE",
      amount: 50,
      date: firstDayOfPreviousMonth(),
    });

    const res = await request(app.server).get(`/budgets/${budget.body.id}`).set(auth);
    expect(res.body.spent).toBe(0);
    expect(res.body.status).toBe("ON_TRACK");
  });

  it("excludes transactions from other categories", async () => {
    const categoryId = await createExpenseCategory(app, auth);
    const otherCategoryId = await createExpenseCategory(app, auth);
    const budget = await request(app.server)
      .post("/budgets")
      .set(auth)
      .send({ categoryId, amount: 100 });

    const today = new Date().toISOString().slice(0, 10);
    await request(app.server).post("/transactions").set(auth).send({
      accountId: user.accountId,
      categoryId: otherCategoryId,
      type: "EXPENSE",
      amount: 50,
      date: today,
    });

    const res = await request(app.server).get(`/budgets/${budget.body.id}`).set(auth);
    expect(res.body.spent).toBe(0);
  });

  it("frees the category+period on archive, and re-validates uniqueness on unarchive", async () => {
    const categoryId = await createExpenseCategory(app, auth);
    const first = await request(app.server)
      .post("/budgets")
      .set(auth)
      .send({ categoryId, amount: 100 });

    await request(app.server).post(`/budgets/${first.body.id}/archive`).set(auth);

    const second = await request(app.server)
      .post("/budgets")
      .set(auth)
      .send({ categoryId, amount: 150 });
    expect(second.status).toBe(201);

    const unarchiveRes = await request(app.server)
      .post(`/budgets/${first.body.id}/unarchive`)
      .set(auth);
    expect(unarchiveRes.status).toBe(409);
  });

  it("isolates budgets between users (404, not 403, on cross-user access)", async () => {
    const categoryId = await createExpenseCategory(app, auth);
    const created = await request(app.server)
      .post("/budgets")
      .set(auth)
      .send({ categoryId, amount: 100 });

    const otherUser = await registerTestUser(app);
    try {
      const res = await request(app.server)
        .get(`/budgets/${created.body.id}`)
        .set({ Authorization: `Bearer ${otherUser.accessToken}` });

      expect(res.status).toBe(404);
    } finally {
      await cleanupTestUser(app, otherUser.userId);
    }
  });

  it("updates the amount", async () => {
    const categoryId = await createExpenseCategory(app, auth);
    const created = await request(app.server)
      .post("/budgets")
      .set(auth)
      .send({ categoryId, amount: 100 });

    const res = await request(app.server)
      .patch(`/budgets/${created.body.id}`)
      .set(auth)
      .send({ amount: 250 });

    expect(res.status).toBe(200);
    expect(res.body.amount).toBe(250);
  });

  it("deletes a budget", async () => {
    const categoryId = await createExpenseCategory(app, auth);
    const created = await request(app.server)
      .post("/budgets")
      .set(auth)
      .send({ categoryId, amount: 100 });

    const del = await request(app.server).delete(`/budgets/${created.body.id}`).set(auth);
    expect(del.status).toBe(204);

    const get = await request(app.server).get(`/budgets/${created.body.id}`).set(auth);
    expect(get.status).toBe(404);
  });
});
