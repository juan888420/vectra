import type { FastifyInstance } from "fastify";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { buildApp } from "../src/app.js";
import { cleanupTestUser, registerTestUser, type TestUser } from "./helpers/test-user.js";

function uniqueName(prefix: string): string {
  return `${prefix} ${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

async function createExpenseCategory(app: FastifyInstance, auth: Record<string, string>) {
  const res = await request(app.server)
    .post("/categories")
    .set(auth)
    .send({ name: uniqueName("Scenario cat"), type: "EXPENSE" });
  return res.body.id as string;
}

async function createExpenseItem(
  app: FastifyInstance,
  auth: Record<string, string>,
  categoryId: string,
  overrides: Partial<{ name: string; amount: number; frequency: string }> = {},
) {
  const res = await request(app.server)
    .post("/expense-items")
    .set(auth)
    .send({
      categoryId,
      name: overrides.name ?? uniqueName("Item"),
      amount: overrides.amount ?? 10000,
      frequency: overrides.frequency ?? "MONTHLY",
    });
  return res.body.id as string;
}

async function createIncome(
  app: FastifyInstance,
  auth: Record<string, string>,
  overrides: Partial<{ name: string; amount: number; frequency: string }> = {},
) {
  const res = await request(app.server)
    .post("/incomes")
    .set(auth)
    .send({
      name: overrides.name ?? uniqueName("Income"),
      amount: overrides.amount ?? 100000,
      frequency: overrides.frequency ?? "MONTHLY",
    });
  return res.body.id as string;
}

async function createScenario(app: FastifyInstance, auth: Record<string, string>, name?: string) {
  const res = await request(app.server)
    .post("/scenarios")
    .set(auth)
    .send({ name: name ?? uniqueName("Scenario") });
  return res.body.id as string;
}

describe("Scenarios", () => {
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

  it("creates a scenario defaulting to ACTIVE", async () => {
    const res = await request(app.server)
      .post("/scenarios")
      .set(auth)
      .send({ name: uniqueName("Base") });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe("ACTIVE");
  });

  it("rejects a second active scenario with the same name", async () => {
    const name = uniqueName("Duplicado");
    await request(app.server).post("/scenarios").set(auth).send({ name });

    const res = await request(app.server).post("/scenarios").set(auth).send({ name });
    expect(res.status).toBe(409);
  });

  it("frees the name once the scenario is archived", async () => {
    const name = uniqueName("Reusable");
    const created = await request(app.server).post("/scenarios").set(auth).send({ name });
    await request(app.server).post(`/scenarios/${created.body.id}/archive`).set(auth);

    const res = await request(app.server).post("/scenarios").set(auth).send({ name });
    expect(res.status).toBe(201);
  });

  it("allows two scenarios to be ACTIVE at the same time", async () => {
    const a = await request(app.server)
      .post("/scenarios")
      .set(auth)
      .send({ name: uniqueName("A") });
    const b = await request(app.server)
      .post("/scenarios")
      .set(auth)
      .send({ name: uniqueName("B") });

    expect(a.body.status).toBe("ACTIVE");
    expect(b.body.status).toBe("ACTIVE");
  });

  it("selects an expense item and reflects price changes live", async () => {
    const categoryId = await createExpenseCategory(app, auth);
    const itemId = await createExpenseItem(app, auth, categoryId, { amount: 50000 });
    const scenarioId = await createScenario(app, auth);

    const added = await request(app.server)
      .post(`/scenarios/${scenarioId}/items`)
      .set(auth)
      .send({ expenseItemId: itemId });
    expect(added.status).toBe(201);

    const before = await request(app.server).get(`/scenarios/${scenarioId}/totals`).set(auth);
    expect(before.body.monthlyTotal).toBe(50000);

    await request(app.server).patch(`/expense-items/${itemId}`).set(auth).send({ amount: 70000 });

    const after = await request(app.server).get(`/scenarios/${scenarioId}/totals`).set(auth);
    expect(after.body.monthlyTotal).toBe(70000);
  });

  it("prorates YEARLY items and excludes ONE_TIME from the monthly total", async () => {
    const categoryId = await createExpenseCategory(app, auth);
    const yearlyId = await createExpenseItem(app, auth, categoryId, {
      amount: 120000,
      frequency: "YEARLY",
    });
    const oneTimeId = await createExpenseItem(app, auth, categoryId, {
      amount: 3000000,
      frequency: "ONE_TIME",
    });
    const scenarioId = await createScenario(app, auth);

    await request(app.server)
      .post(`/scenarios/${scenarioId}/items`)
      .set(auth)
      .send({ expenseItemId: yearlyId });
    await request(app.server)
      .post(`/scenarios/${scenarioId}/items`)
      .set(auth)
      .send({ expenseItemId: oneTimeId });

    const totals = await request(app.server).get(`/scenarios/${scenarioId}/totals`).set(auth);
    expect(totals.body.monthlyTotal).toBe(10000);
    expect(totals.body.oneTimeTotal).toBe(3000000);
  });

  it("rejects adding an archived expense item", async () => {
    const categoryId = await createExpenseCategory(app, auth);
    const itemId = await createExpenseItem(app, auth, categoryId);
    await request(app.server).post(`/expense-items/${itemId}/archive`).set(auth);
    const scenarioId = await createScenario(app, auth);

    const res = await request(app.server)
      .post(`/scenarios/${scenarioId}/items`)
      .set(auth)
      .send({ expenseItemId: itemId });

    expect(res.status).toBe(400);
  });

  it("rejects selecting the same item twice", async () => {
    const categoryId = await createExpenseCategory(app, auth);
    const itemId = await createExpenseItem(app, auth, categoryId);
    const scenarioId = await createScenario(app, auth);

    await request(app.server)
      .post(`/scenarios/${scenarioId}/items`)
      .set(auth)
      .send({ expenseItemId: itemId });
    const res = await request(app.server)
      .post(`/scenarios/${scenarioId}/items`)
      .set(auth)
      .send({ expenseItemId: itemId });

    expect(res.status).toBe(409);
  });

  it("adds a whole category and stamps addedViaCategoryId", async () => {
    const categoryId = await createExpenseCategory(app, auth);
    await createExpenseItem(app, auth, categoryId);
    await createExpenseItem(app, auth, categoryId);
    const scenarioId = await createScenario(app, auth);

    const res = await request(app.server)
      .post(`/scenarios/${scenarioId}/categories`)
      .set(auth)
      .send({ categoryId });

    expect(res.status).toBe(201);
    expect(res.body.added).toBe(2);
  });

  it("flags a pending category sync when a new item is added to the category later", async () => {
    const categoryId = await createExpenseCategory(app, auth);
    await createExpenseItem(app, auth, categoryId);
    const scenarioId = await createScenario(app, auth);
    await request(app.server)
      .post(`/scenarios/${scenarioId}/categories`)
      .set(auth)
      .send({ categoryId });

    // Category content changes after the bulk add — must not propagate on
    // its own (ADR-0006 business rule 8).
    await createExpenseItem(app, auth, categoryId);

    const pending = await request(app.server)
      .get(`/scenarios/${scenarioId}/pending-category-sync`)
      .set(auth);

    expect(pending.body).toHaveLength(1);
    expect(pending.body[0].categoryId).toBe(categoryId);
    expect(pending.body[0].currentActiveItemIds).toHaveLength(2);
    expect(pending.body[0].addedItemIds).toHaveLength(1);
  });

  it("keeps an archived item's total in scenarios that already selected it", async () => {
    const categoryId = await createExpenseCategory(app, auth);
    const itemId = await createExpenseItem(app, auth, categoryId, { amount: 20000 });
    const scenarioId = await createScenario(app, auth);
    await request(app.server)
      .post(`/scenarios/${scenarioId}/items`)
      .set(auth)
      .send({ expenseItemId: itemId });

    await request(app.server).post(`/expense-items/${itemId}/archive`).set(auth);

    const totals = await request(app.server).get(`/scenarios/${scenarioId}/totals`).set(auth);
    expect(totals.body.monthlyTotal).toBe(20000);
  });

  it("refuses to delete an expense item selected in a scenario", async () => {
    const categoryId = await createExpenseCategory(app, auth);
    const itemId = await createExpenseItem(app, auth, categoryId);
    const scenarioId = await createScenario(app, auth);
    await request(app.server)
      .post(`/scenarios/${scenarioId}/items`)
      .set(auth)
      .send({ expenseItemId: itemId });

    const res = await request(app.server).delete(`/expense-items/${itemId}`).set(auth);
    expect(res.status).toBe(409);
  });

  it("composes scenarios live: parent total follows child total", async () => {
    const categoryId = await createExpenseCategory(app, auth);
    const itemId = await createExpenseItem(app, auth, categoryId, { amount: 30000 });
    const child = await createScenario(app, auth);
    await request(app.server)
      .post(`/scenarios/${child}/items`)
      .set(auth)
      .send({ expenseItemId: itemId });
    const parent = await createScenario(app, auth);

    const composed = await request(app.server)
      .post(`/scenarios/${parent}/compositions`)
      .set(auth)
      .send({ includedScenarioId: child });
    expect(composed.status).toBe(201);

    const before = await request(app.server).get(`/scenarios/${parent}/totals`).set(auth);
    expect(before.body.monthlyTotal).toBe(30000);

    const anotherItem = await createExpenseItem(app, auth, categoryId, { amount: 15000 });
    await request(app.server)
      .post(`/scenarios/${child}/items`)
      .set(auth)
      .send({ expenseItemId: anotherItem });

    const after = await request(app.server).get(`/scenarios/${parent}/totals`).set(auth);
    expect(after.body.monthlyTotal).toBe(45000);
  });

  it("rejects a direct cycle (A includes B, B includes A)", async () => {
    const a = await createScenario(app, auth);
    const b = await createScenario(app, auth);
    await request(app.server)
      .post(`/scenarios/${a}/compositions`)
      .set(auth)
      .send({ includedScenarioId: b });

    const res = await request(app.server)
      .post(`/scenarios/${b}/compositions`)
      .set(auth)
      .send({ includedScenarioId: a });

    expect(res.status).toBe(400);
  });

  it("rejects a transitive cycle (A includes B includes C, C includes A)", async () => {
    const a = await createScenario(app, auth);
    const b = await createScenario(app, auth);
    const c = await createScenario(app, auth);
    await request(app.server)
      .post(`/scenarios/${a}/compositions`)
      .set(auth)
      .send({ includedScenarioId: b });
    await request(app.server)
      .post(`/scenarios/${b}/compositions`)
      .set(auth)
      .send({ includedScenarioId: c });

    const res = await request(app.server)
      .post(`/scenarios/${c}/compositions`)
      .set(auth)
      .send({ includedScenarioId: a });

    expect(res.status).toBe(400);
  });

  it("rejects a scenario including itself", async () => {
    const a = await createScenario(app, auth);

    const res = await request(app.server)
      .post(`/scenarios/${a}/compositions`)
      .set(auth)
      .send({ includedScenarioId: a });

    expect(res.status).toBe(400);
  });

  it("refuses to delete a scenario that another scenario includes", async () => {
    const child = await createScenario(app, auth);
    const parent = await createScenario(app, auth);
    await request(app.server)
      .post(`/scenarios/${parent}/compositions`)
      .set(auth)
      .send({ includedScenarioId: child });

    const res = await request(app.server).delete(`/scenarios/${child}`).set(auth);
    expect(res.status).toBe(409);
  });

  it("links incomes and computes monthly coverage normalizing WEEKLY", async () => {
    const scenarioId = await createScenario(app, auth);
    const categoryId = await createExpenseCategory(app, auth);
    const itemId = await createExpenseItem(app, auth, categoryId, { amount: 100000 });
    await request(app.server)
      .post(`/scenarios/${scenarioId}/items`)
      .set(auth)
      .send({ expenseItemId: itemId });

    const weeklyIncome = await createIncome(app, auth, { amount: 100000, frequency: "WEEKLY" });
    const linked = await request(app.server)
      .post(`/scenarios/${scenarioId}/incomes`)
      .set(auth)
      .send({ incomeId: weeklyIncome });
    expect(linked.status).toBe(201);

    const totals = await request(app.server).get(`/scenarios/${scenarioId}/totals`).set(auth);
    const expectedIncomeMonthly = (100000 * 52) / 12;
    expect(totals.body.incomeMonthlyTotal).toBeCloseTo(expectedIncomeMonthly, 5);
    expect(totals.body.coveragePercent).toBeCloseTo((100000 / expectedIncomeMonthly) * 100, 5);
  });

  it("returns null coverage when no income is linked", async () => {
    const scenarioId = await createScenario(app, auth);
    const totals = await request(app.server).get(`/scenarios/${scenarioId}/totals`).set(auth);
    expect(totals.body.coveragePercent).toBeNull();
  });

  it("excludes a ONE_TIME income from monthly coverage", async () => {
    const scenarioId = await createScenario(app, auth);
    const bonus = await createIncome(app, auth, { amount: 500000, frequency: "ONE_TIME" });
    await request(app.server)
      .post(`/scenarios/${scenarioId}/incomes`)
      .set(auth)
      .send({ incomeId: bonus });

    const totals = await request(app.server).get(`/scenarios/${scenarioId}/totals`).set(auth);
    expect(totals.body.incomeMonthlyTotal).toBe(0);
    expect(totals.body.coveragePercent).toBeNull();
  });

  it("refuses to delete an income linked to a scenario", async () => {
    const scenarioId = await createScenario(app, auth);
    const incomeId = await createIncome(app, auth);
    await request(app.server).post(`/scenarios/${scenarioId}/incomes`).set(auth).send({ incomeId });

    const res = await request(app.server).delete(`/incomes/${incomeId}`).set(auth);
    expect(res.status).toBe(409);
  });

  it("removes an item, a composition and an income link", async () => {
    const categoryId = await createExpenseCategory(app, auth);
    const itemId = await createExpenseItem(app, auth, categoryId, { amount: 10000 });
    const incomeId = await createIncome(app, auth);
    const child = await createScenario(app, auth);
    const scenarioId = await createScenario(app, auth);

    await request(app.server)
      .post(`/scenarios/${scenarioId}/items`)
      .set(auth)
      .send({ expenseItemId: itemId });
    await request(app.server).post(`/scenarios/${scenarioId}/incomes`).set(auth).send({ incomeId });
    await request(app.server)
      .post(`/scenarios/${scenarioId}/compositions`)
      .set(auth)
      .send({ includedScenarioId: child });

    const removedItem = await request(app.server)
      .delete(`/scenarios/${scenarioId}/items/${itemId}`)
      .set(auth);
    const removedIncome = await request(app.server)
      .delete(`/scenarios/${scenarioId}/incomes/${incomeId}`)
      .set(auth);
    const removedComposition = await request(app.server)
      .delete(`/scenarios/${scenarioId}/compositions/${child}`)
      .set(auth);

    expect(removedItem.status).toBe(204);
    expect(removedIncome.status).toBe(204);
    expect(removedComposition.status).toBe(204);

    const totals = await request(app.server).get(`/scenarios/${scenarioId}/totals`).set(auth);
    expect(totals.body.monthlyTotal).toBe(0);
    expect(totals.body.incomeMonthlyTotal).toBe(0);
  });

  it("hides another user's scenario behind a 404", async () => {
    const stranger = await registerTestUser(app);
    const strangerAuth = { Authorization: `Bearer ${stranger.accessToken}` };
    const scenarioId = await createScenario(app, strangerAuth);

    const res = await request(app.server).get(`/scenarios/${scenarioId}`).set(auth);
    expect(res.status).toBe(404);

    await cleanupTestUser(app, stranger.userId);
  });

  it("deletes a scenario nothing includes", async () => {
    const scenarioId = await createScenario(app, auth);

    const res = await request(app.server).delete(`/scenarios/${scenarioId}`).set(auth);
    expect(res.status).toBe(204);
  });
});
