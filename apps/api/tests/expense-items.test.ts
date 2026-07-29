import type { FastifyInstance } from "fastify";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { buildApp } from "../src/app.js";
import { cleanupTestUser, registerTestUser, type TestUser } from "./helpers/test-user.js";

// Item names are unique per user among active items, so every test that
// creates one uses its own name; the same applies to categories, which are
// archived in cascade and would otherwise leak state across tests.
function uniqueName(prefix: string): string {
  return `${prefix} ${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

async function createExpenseCategory(app: FastifyInstance, auth: Record<string, string>) {
  const res = await request(app.server)
    .post("/categories")
    .set(auth)
    .send({ name: uniqueName("Items cat"), type: "EXPENSE" });
  return res.body.id as string;
}

describe("Expense items", () => {
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

  it("creates an item defaulting to MONTHLY and the user's currency", async () => {
    const categoryId = await createExpenseCategory(app, auth);

    const res = await request(app.server)
      .post("/expense-items")
      .set(auth)
      .send({ categoryId, name: uniqueName("Netflix"), amount: 50000 });

    expect(res.status).toBe(201);
    expect(res.body.amount).toBe(50000);
    expect(res.body.frequency).toBe("MONTHLY");
    expect(res.body.currency).toBe("COP");
    expect(res.body.categoryId).toBe(categoryId);
    expect(res.body.archivedAt).toBeNull();
  });

  it("accepts YEARLY and ONE_TIME frequencies", async () => {
    const categoryId = await createExpenseCategory(app, auth);

    const yearly = await request(app.server)
      .post("/expense-items")
      .set(auth)
      .send({ categoryId, name: uniqueName("Dominio"), amount: 60000, frequency: "YEARLY" });
    const oneTime = await request(app.server)
      .post("/expense-items")
      .set(auth)
      .send({ categoryId, name: uniqueName("Mac Mini"), amount: 3000000, frequency: "ONE_TIME" });

    expect(yearly.body.frequency).toBe("YEARLY");
    expect(oneTime.body.frequency).toBe("ONE_TIME");
  });

  it("rejects an item in an income category", async () => {
    const res = await request(app.server)
      .post("/expense-items")
      .set(auth)
      .send({ categoryId: user.incomeCategoryId, name: uniqueName("Sueldo"), amount: 100 });

    expect(res.status).toBe(400);
  });

  it("rejects an item in an archived category", async () => {
    const categoryId = await createExpenseCategory(app, auth);
    await request(app.server).post(`/categories/${categoryId}/archive`).set(auth);

    const res = await request(app.server)
      .post("/expense-items")
      .set(auth)
      .send({ categoryId, name: uniqueName("Spotify"), amount: 100 });

    expect(res.status).toBe(400);
  });

  it("rejects a second active item with the same name (reuse before duplicating)", async () => {
    const categoryId = await createExpenseCategory(app, auth);
    const name = uniqueName("Claude");
    await request(app.server)
      .post("/expense-items")
      .set(auth)
      .send({ categoryId, name, amount: 70000 });

    const res = await request(app.server)
      .post("/expense-items")
      .set(auth)
      .send({ categoryId, name, amount: 90000 });

    expect(res.status).toBe(409);
  });

  it("rejects an amount with more than 2 decimal places", async () => {
    const categoryId = await createExpenseCategory(app, auth);

    const res = await request(app.server)
      .post("/expense-items")
      .set(auth)
      .send({ categoryId, name: uniqueName("Cursor"), amount: 10.999 });

    expect(res.status).toBe(400);
  });

  it("moves an item to another category and updates its price", async () => {
    const categoryId = await createExpenseCategory(app, auth);
    const otherCategoryId = await createExpenseCategory(app, auth);
    const created = await request(app.server)
      .post("/expense-items")
      .set(auth)
      .send({ categoryId, name: uniqueName("Gym"), amount: 100000 });

    const res = await request(app.server)
      .patch(`/expense-items/${created.body.id}`)
      .set(auth)
      .send({ categoryId: otherCategoryId, amount: 120000 });

    expect(res.status).toBe(200);
    expect(res.body.categoryId).toBe(otherCategoryId);
    expect(res.body.amount).toBe(120000);
  });

  it("rejects an empty update body", async () => {
    const categoryId = await createExpenseCategory(app, auth);
    const created = await request(app.server)
      .post("/expense-items")
      .set(auth)
      .send({ categoryId, name: uniqueName("Vitaminas"), amount: 50000 });

    const res = await request(app.server)
      .patch(`/expense-items/${created.body.id}`)
      .set(auth)
      .send({});

    expect(res.status).toBe(400);
  });

  it("filters by category and excludes archived items by default", async () => {
    const categoryId = await createExpenseCategory(app, auth);
    const keptName = uniqueName("Proteina");
    await request(app.server)
      .post("/expense-items")
      .set(auth)
      .send({ categoryId, name: keptName, amount: 150000 });
    const archived = await request(app.server)
      .post("/expense-items")
      .set(auth)
      .send({ categoryId, name: uniqueName("Creatina"), amount: 80000 });
    await request(app.server).post(`/expense-items/${archived.body.id}/archive`).set(auth);

    const active = await request(app.server)
      .get(`/expense-items?categoryId=${categoryId}`)
      .set(auth);
    const all = await request(app.server)
      .get(`/expense-items?categoryId=${categoryId}&includeArchived=true`)
      .set(auth);

    expect(active.body.data).toHaveLength(1);
    expect(active.body.data[0].name).toBe(keptName);
    expect(all.body.data).toHaveLength(2);
  });

  it("archives a category in cascade with its items", async () => {
    const categoryId = await createExpenseCategory(app, auth);
    const item = await request(app.server)
      .post("/expense-items")
      .set(auth)
      .send({ categoryId, name: uniqueName("Disney"), amount: 30000 });

    await request(app.server).post(`/categories/${categoryId}/archive`).set(auth);

    const res = await request(app.server).get(`/expense-items/${item.body.id}`).set(auth);
    expect(res.body.archivedAt).not.toBeNull();
  });

  it("refuses to delete a category that still has items", async () => {
    const categoryId = await createExpenseCategory(app, auth);
    await request(app.server)
      .post("/expense-items")
      .set(auth)
      .send({ categoryId, name: uniqueName("Max"), amount: 25000 });

    const res = await request(app.server).delete(`/categories/${categoryId}`).set(auth);
    expect(res.status).toBe(409);
  });

  it("refuses to unarchive an item whose category was archived", async () => {
    const categoryId = await createExpenseCategory(app, auth);
    const item = await request(app.server)
      .post("/expense-items")
      .set(auth)
      .send({ categoryId, name: uniqueName("Figma"), amount: 60000 });
    await request(app.server).post(`/categories/${categoryId}/archive`).set(auth);

    const res = await request(app.server)
      .post(`/expense-items/${item.body.id}/unarchive`)
      .set(auth);

    expect(res.status).toBe(400);
  });

  it("frees the name once the item is archived", async () => {
    const categoryId = await createExpenseCategory(app, auth);
    const name = uniqueName("Notion");
    const first = await request(app.server)
      .post("/expense-items")
      .set(auth)
      .send({ categoryId, name, amount: 40000 });
    await request(app.server).post(`/expense-items/${first.body.id}/archive`).set(auth);

    const res = await request(app.server)
      .post("/expense-items")
      .set(auth)
      .send({ categoryId, name, amount: 45000 });

    expect(res.status).toBe(201);
  });

  it("hides another user's item behind a 404", async () => {
    const stranger = await registerTestUser(app);
    const strangerAuth = { Authorization: `Bearer ${stranger.accessToken}` };
    const item = await request(app.server)
      .post("/expense-items")
      .set(strangerAuth)
      .send({
        categoryId: stranger.expenseCategoryId,
        name: uniqueName("Secreto"),
        amount: 1000,
      });

    const res = await request(app.server).get(`/expense-items/${item.body.id}`).set(auth);
    expect(res.status).toBe(404);

    await cleanupTestUser(app, stranger.userId);
  });

  it("deletes an item that no scenario references", async () => {
    const categoryId = await createExpenseCategory(app, auth);
    const item = await request(app.server)
      .post("/expense-items")
      .set(auth)
      .send({ categoryId, name: uniqueName("Temporal"), amount: 10000 });

    const res = await request(app.server).delete(`/expense-items/${item.body.id}`).set(auth);
    expect(res.status).toBe(204);

    const after = await request(app.server).get(`/expense-items/${item.body.id}`).set(auth);
    expect(after.status).toBe(404);
  });
});
