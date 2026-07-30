import type { FastifyInstance } from "fastify";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { buildApp } from "../src/app.js";
import { cleanupTestUser, registerTestUser, type TestUser } from "./helpers/test-user.js";

function uniqueName(prefix: string): string {
  return `${prefix} ${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
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

  async function createExpenseItem(
    amount: number,
    frequency: "MONTHLY" | "YEARLY" | "ONE_TIME" = "MONTHLY",
  ) {
    const res = await request(app.server)
      .post("/expense-items")
      .set(auth)
      .send({ categoryId: user.expenseCategoryId, name: uniqueName("Item"), amount, frequency });
    return res.body.id as string;
  }

  async function createIncome(amount: number, frequency: "MONTHLY" | "WEEKLY" = "MONTHLY") {
    const res = await request(app.server)
      .post("/incomes")
      .set(auth)
      .send({ name: uniqueName("Income"), amount, frequency });
    return res.body.id as string;
  }

  async function createScenario(name = uniqueName("Escenario")) {
    const res = await request(app.server).post("/scenarios").set(auth).send({ name });
    return res.body as { id: string; name: string; status: string };
  }

  it("creates a scenario defaulting to ACTIVE", async () => {
    const res = await request(app.server)
      .post("/scenarios")
      .set(auth)
      .send({ name: uniqueName("Escenario actual") });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe("ACTIVE");
  });

  it("rejects a second active scenario with the same name", async () => {
    const name = uniqueName("Escenario IA");
    await request(app.server).post("/scenarios").set(auth).send({ name });

    const res = await request(app.server).post("/scenarios").set(auth).send({ name });
    expect(res.status).toBe(409);
  });

  it("moves through activate/deactivate/archive/unarchive", async () => {
    const scenario = await createScenario();

    const deactivated = await request(app.server)
      .post(`/scenarios/${scenario.id}/deactivate`)
      .set(auth);
    expect(deactivated.body.status).toBe("INACTIVE");

    const activated = await request(app.server)
      .post(`/scenarios/${scenario.id}/activate`)
      .set(auth);
    expect(activated.body.status).toBe("ACTIVE");

    const archived = await request(app.server).post(`/scenarios/${scenario.id}/archive`).set(auth);
    expect(archived.body.status).toBe("ARCHIVED");

    const activateArchived = await request(app.server)
      .post(`/scenarios/${scenario.id}/activate`)
      .set(auth);
    expect(activateArchived.status).toBe(409);

    const unarchived = await request(app.server)
      .post(`/scenarios/${scenario.id}/unarchive`)
      .set(auth);
    expect(unarchived.body.status).toBe("INACTIVE");
  });

  it("adds an expense item snapshot and rejects duplicates and archived items", async () => {
    const scenario = await createScenario();
    const itemId = await createExpenseItem(50000);

    const res = await request(app.server)
      .post(`/scenarios/${scenario.id}/items`)
      .set(auth)
      .send({ expenseItemId: itemId });

    expect(res.status).toBe(201);
    expect(res.body.amount).toBe(50000);
    expect(res.body.outdated).toBe(false);

    const duplicate = await request(app.server)
      .post(`/scenarios/${scenario.id}/items`)
      .set(auth)
      .send({ expenseItemId: itemId });
    expect(duplicate.status).toBe(409);

    const archivedItemId = await createExpenseItem(1000);
    await request(app.server).post(`/expense-items/${archivedItemId}/archive`).set(auth);
    const rejected = await request(app.server)
      .post(`/scenarios/${scenario.id}/items`)
      .set(auth)
      .send({ expenseItemId: archivedItemId });
    expect(rejected.status).toBe(400);
  });

  it("flags a scenario item as outdated once the source expense item changes", async () => {
    const scenario = await createScenario();
    const itemId = await createExpenseItem(30000);
    await request(app.server)
      .post(`/scenarios/${scenario.id}/items`)
      .set(auth)
      .send({ expenseItemId: itemId });

    await request(app.server).patch(`/expense-items/${itemId}`).set(auth).send({ amount: 45000 });

    const res = await request(app.server).get(`/scenarios/${scenario.id}/items`).set(auth);
    expect(res.body.data[0].outdated).toBe(true);
    // The snapshot itself never changes silently (ADR-0005 principle 2).
    expect(res.body.data[0].amount).toBe(30000);
  });

  it("refuses to add items or incomes to an archived scenario", async () => {
    const scenario = await createScenario();
    await request(app.server).post(`/scenarios/${scenario.id}/archive`).set(auth);
    const itemId = await createExpenseItem(1000);

    const res = await request(app.server)
      .post(`/scenarios/${scenario.id}/items`)
      .set(auth)
      .send({ expenseItemId: itemId });
    expect(res.status).toBe(409);
  });

  it("refuses to delete an expense item referenced by a scenario", async () => {
    const scenario = await createScenario();
    const itemId = await createExpenseItem(20000);
    await request(app.server)
      .post(`/scenarios/${scenario.id}/items`)
      .set(auth)
      .send({ expenseItemId: itemId });

    const res = await request(app.server).delete(`/expense-items/${itemId}`).set(auth);
    expect(res.status).toBe(409);
  });

  it("refuses to delete an income referenced by a scenario", async () => {
    const scenario = await createScenario();
    const incomeId = await createIncome(1000000);
    await request(app.server)
      .post(`/scenarios/${scenario.id}/incomes`)
      .set(auth)
      .send({ incomeId });

    const res = await request(app.server).delete(`/incomes/${incomeId}`).set(auth);
    expect(res.status).toBe(409);
  });

  it("rejects a scenario including itself and rejects a composition cycle", async () => {
    const scenario = await createScenario();

    const selfInclude = await request(app.server)
      .post(`/scenarios/${scenario.id}/compositions`)
      .set(auth)
      .send({ childScenarioId: scenario.id });
    expect(selfInclude.status).toBe(400);

    const other = await createScenario();
    const forward = await request(app.server)
      .post(`/scenarios/${scenario.id}/compositions`)
      .set(auth)
      .send({ childScenarioId: other.id });
    expect(forward.status).toBe(201);

    const cycle = await request(app.server)
      .post(`/scenarios/${other.id}/compositions`)
      .set(auth)
      .send({ childScenarioId: scenario.id });
    expect(cycle.status).toBe(400);
  });

  it("refuses to hard-delete a scenario included in another", async () => {
    const parent = await createScenario();
    const child = await createScenario();
    await request(app.server)
      .post(`/scenarios/${parent.id}/compositions`)
      .set(auth)
      .send({ childScenarioId: child.id });

    const res = await request(app.server).delete(`/scenarios/${child.id}`).set(auth);
    expect(res.status).toBe(409);
  });

  it("computes totals prorating YEARLY, excluding ONE_TIME, and income coverage", async () => {
    const scenario = await createScenario();
    const monthlyId = await createExpenseItem(50000, "MONTHLY");
    const yearlyId = await createExpenseItem(120000, "YEARLY");
    const oneTimeId = await createExpenseItem(900000, "ONE_TIME");
    for (const expenseItemId of [monthlyId, yearlyId, oneTimeId]) {
      await request(app.server)
        .post(`/scenarios/${scenario.id}/items`)
        .set(auth)
        .send({ expenseItemId });
    }
    const incomeId = await createIncome(200000, "MONTHLY");
    await request(app.server)
      .post(`/scenarios/${scenario.id}/incomes`)
      .set(auth)
      .send({ incomeId });

    const res = await request(app.server).get(`/scenarios/${scenario.id}/summary`).set(auth);

    // 50000 + (120000 / 12) = 60000
    expect(res.body.totals.monthly).toBe(60000);
    expect(res.body.totals.sixMonths).toBe(360000);
    expect(res.body.totals.twelveMonths).toBe(720000);
    expect(res.body.oneTime.total).toBe(900000);
    expect(res.body.oneTime.items).toHaveLength(1);
    expect(res.body.incomeCoverage.totalIncomeMonthly).toBe(200000);
    expect(res.body.incomeCoverage.remainingMonthly).toBe(140000);
    expect(res.body.hasUpdates).toBe(false);
  });

  it("aggregates totals and drift transitively through composition", async () => {
    const parent = await createScenario();
    const child = await createScenario();
    await request(app.server)
      .post(`/scenarios/${parent.id}/compositions`)
      .set(auth)
      .send({ childScenarioId: child.id });

    const childItemId = await createExpenseItem(10000, "MONTHLY");
    await request(app.server)
      .post(`/scenarios/${child.id}/items`)
      .set(auth)
      .send({ expenseItemId: childItemId });

    const before = await request(app.server).get(`/scenarios/${parent.id}/summary`).set(auth);
    expect(before.body.totals.monthly).toBe(10000);
    expect(before.body.hasUpdates).toBe(false);

    await request(app.server)
      .patch(`/expense-items/${childItemId}`)
      .set(auth)
      .send({ amount: 15000 });

    const after = await request(app.server).get(`/scenarios/${parent.id}/summary`).set(auth);
    // The snapshot is unchanged, so the total is still derived from 10000 —
    // only the drift flag surfaces the child's outdated item.
    expect(after.body.totals.monthly).toBe(10000);
    expect(after.body.hasUpdates).toBe(true);
  });

  it("includes the monthly total per scenario in the list response", async () => {
    const scenario = await createScenario();
    const itemId = await createExpenseItem(40000, "MONTHLY");
    await request(app.server)
      .post(`/scenarios/${scenario.id}/items`)
      .set(auth)
      .send({ expenseItemId: itemId });

    const res = await request(app.server).get("/scenarios?pageSize=100").set(auth);

    const listed = res.body.data.find((entry: { id: string }) => entry.id === scenario.id);
    expect(listed.monthly).toBe(40000);
  });

  it("hides another user's scenario behind a 404", async () => {
    const stranger = await registerTestUser(app);
    const strangerAuth = { Authorization: `Bearer ${stranger.accessToken}` };
    const res = await request(app.server)
      .post("/scenarios")
      .set(strangerAuth)
      .send({ name: uniqueName("Secreto") });

    const get = await request(app.server).get(`/scenarios/${res.body.id}`).set(auth);
    expect(get.status).toBe(404);

    await cleanupTestUser(app, stranger.userId);
  });
});
