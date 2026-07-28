import type { FastifyInstance } from "fastify";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { buildApp } from "../src/app.js";
import { cleanupTestUser, registerTestUser, type TestUser } from "./helpers/test-user.js";

describe("Transactions", () => {
  let app: FastifyInstance;
  let user: TestUser;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
    user = await registerTestUser(app);
  });

  afterAll(async () => {
    await cleanupTestUser(app, user.userId);
    await app.close();
  });

  const authHeader = () => ({ Authorization: `Bearer ${user.accessToken}` });

  const createPayload = (overrides: Record<string, unknown> = {}) => ({
    accountId: user.accountId,
    categoryId: user.expenseCategoryId,
    type: "EXPENSE",
    amount: 42.5,
    date: "2026-07-20",
    ...overrides,
  });

  it("creates a transaction, deriving currency from the account", async () => {
    const res = await request(app.server)
      .post("/transactions")
      .set(authHeader())
      .send(createPayload());

    expect(res.status).toBe(201);
    expect(res.body.amount).toBe(42.5);
    expect(res.body.currency).toBe("COP");
    expect(res.body.accountId).toBe(user.accountId);
  });

  it("rejects a type that does not match the category's type (business rule 2)", async () => {
    const res = await request(app.server)
      .post("/transactions")
      .set(authHeader())
      .send(createPayload({ type: "INCOME" }));

    expect(res.status).toBe(400);
  });

  it("rejects an amount with more than 2 decimal places", async () => {
    const res = await request(app.server)
      .post("/transactions")
      .set(authHeader())
      .send(createPayload({ amount: 10.999 }));

    expect(res.status).toBe(400);
  });

  it("rejects a zero or negative amount", async () => {
    const res = await request(app.server)
      .post("/transactions")
      .set(authHeader())
      .send(createPayload({ amount: 0 }));

    expect(res.status).toBe(400);
  });

  it("rejects an archived account (business rule 4)", async () => {
    const account = await request(app.server)
      .post("/accounts")
      .set(authHeader())
      .send({ name: "Temp account", type: "CASH" });
    await request(app.server).post(`/accounts/${account.body.id}/archive`).set(authHeader());

    const res = await request(app.server)
      .post("/transactions")
      .set(authHeader())
      .send(createPayload({ accountId: account.body.id }));

    expect(res.status).toBe(400);
  });

  it("rejects an archived category (business rule 4)", async () => {
    const category = await request(app.server)
      .post("/categories")
      .set(authHeader())
      .send({ name: "Temp category", type: "EXPENSE" });
    await request(app.server).post(`/categories/${category.body.id}/archive`).set(authHeader());

    const res = await request(app.server)
      .post("/transactions")
      .set(authHeader())
      .send(createPayload({ categoryId: category.body.id }));

    expect(res.status).toBe(400);
  });

  it("isolates transactions between users (404, not 403, on cross-user access)", async () => {
    const created = await request(app.server)
      .post("/transactions")
      .set(authHeader())
      .send(createPayload());

    const otherUser = await registerTestUser(app);
    try {
      const res = await request(app.server)
        .get(`/transactions/${created.body.id}`)
        .set({ Authorization: `Bearer ${otherUser.accessToken}` });

      expect(res.status).toBe(404);
    } finally {
      await cleanupTestUser(app, otherUser.userId);
    }
  });

  it("filters the list by type and account", async () => {
    await request(app.server).post("/transactions").set(authHeader()).send(createPayload());

    const res = await request(app.server)
      .get("/transactions")
      .query({ type: "EXPENSE", accountId: user.accountId, pageSize: 50 })
      .set(authHeader());

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThan(0);
    for (const transaction of res.body.data) {
      expect(transaction.type).toBe("EXPENSE");
      expect(transaction.accountId).toBe(user.accountId);
    }
  });

  it("searches by note", async () => {
    const marker = `needle-${Date.now()}`;
    await request(app.server)
      .post("/transactions")
      .set(authHeader())
      .send(createPayload({ note: `groceries ${marker}` }));

    const res = await request(app.server)
      .get("/transactions")
      .query({ search: marker })
      .set(authHeader());

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].note).toContain(marker);
  });

  it("updates amount and note", async () => {
    const created = await request(app.server)
      .post("/transactions")
      .set(authHeader())
      .send(createPayload());

    const res = await request(app.server)
      .patch(`/transactions/${created.body.id}`)
      .set(authHeader())
      .send({ amount: 100, note: "adjusted" });

    expect(res.status).toBe(200);
    expect(res.body.amount).toBe(100);
    expect(res.body.note).toBe("adjusted");
  });

  it("rejects updating the category to one whose type mismatches the transaction's type", async () => {
    const created = await request(app.server)
      .post("/transactions")
      .set(authHeader())
      .send(createPayload());

    const res = await request(app.server)
      .patch(`/transactions/${created.body.id}`)
      .set(authHeader())
      .send({ categoryId: user.incomeCategoryId });

    expect(res.status).toBe(400);
  });

  it("deletes a transaction (hard delete, temporary MVP decision)", async () => {
    const created = await request(app.server)
      .post("/transactions")
      .set(authHeader())
      .send(createPayload());

    const del = await request(app.server)
      .delete(`/transactions/${created.body.id}`)
      .set(authHeader());
    expect(del.status).toBe(204);

    const get = await request(app.server).get(`/transactions/${created.body.id}`).set(authHeader());
    expect(get.status).toBe(404);
  });
});
