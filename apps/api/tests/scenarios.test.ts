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

  it("creates a scenario defaulting to INACTIVE", async () => {
    const res = await request(app.server)
      .post("/scenarios")
      .set(auth)
      .send({ name: uniqueName("Escenario actual") });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe("INACTIVE");
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

  it("flags a composed scenario as outdated in its parent's composition list", async () => {
    const parent = await createScenario();
    const child = await createScenario();
    await request(app.server)
      .post(`/scenarios/${parent.id}/compositions`)
      .set(auth)
      .send({ childScenarioId: child.id });

    const before = await request(app.server).get(`/scenarios/${parent.id}/compositions`).set(auth);
    expect(before.body.data).toEqual([
      {
        id: expect.any(String),
        childScenarioId: child.id,
        childScenarioName: child.name,
        outdated: false,
      },
    ]);

    const childItemId = await createExpenseItem(10000, "MONTHLY");
    await request(app.server)
      .post(`/scenarios/${child.id}/items`)
      .set(auth)
      .send({ expenseItemId: childItemId });
    await request(app.server)
      .patch(`/expense-items/${childItemId}`)
      .set(auth)
      .send({ amount: 15000 });

    // The child itself has unsynced financial drift, so it shows up as
    // outdated from the parent's own composition list — no detail here,
    // that's what opening the child scenario is for.
    const after = await request(app.server).get(`/scenarios/${parent.id}/compositions`).set(auth);
    expect(after.body.data[0].outdated).toBe(true);

    await request(app.server).post(`/scenarios/${child.id}/sync`).set(auth);
    const synced = await request(app.server).get(`/scenarios/${parent.id}/compositions`).set(auth);
    expect(synced.body.data[0].outdated).toBe(false);
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

  // --- Sync-on-write (RFC-0023.3) ---------------------------------------

  it("syncs a renamed product into its snapshots without asking", async () => {
    const scenario = await createScenario();
    const itemId = await createExpenseItem(10000, "MONTHLY");
    await request(app.server)
      .post(`/scenarios/${scenario.id}/items`)
      .set(auth)
      .send({ expenseItemId: itemId });

    const newName = uniqueName("Renombrado");
    const patched = await request(app.server)
      .patch(`/expense-items/${itemId}`)
      .set(auth)
      .send({ name: newName });

    // A rename moves no total, so it never becomes a decision.
    expect(patched.body.affectedScenarios).toEqual([]);
    expect(patched.body.changes).toEqual([]);

    const items = await request(app.server).get(`/scenarios/${scenario.id}/items`).set(auth);
    expect(items.body.data[0].name).toBe(newName);

    const summary = await request(app.server).get(`/scenarios/${scenario.id}/summary`).set(auth);
    expect(summary.body.hasUpdates).toBe(false);
  });

  it("syncs a renamed category into its snapshots without asking", async () => {
    const scenario = await createScenario();
    const itemId = await createExpenseItem(10000, "MONTHLY");
    await request(app.server)
      .post(`/scenarios/${scenario.id}/items`)
      .set(auth)
      .send({ expenseItemId: itemId });

    const newName = uniqueName("Categoria");
    await request(app.server)
      .patch(`/categories/${user.expenseCategoryId}`)
      .set(auth)
      .send({ name: newName });

    const items = await request(app.server).get(`/scenarios/${scenario.id}/items`).set(auth);
    expect(items.body.data[0].categoryName).toBe(newName);

    const summary = await request(app.server).get(`/scenarios/${scenario.id}/summary`).set(auth);
    expect(summary.body.hasUpdates).toBe(false);
  });

  it("reports the affected scenarios on a price change and syncs them on demand", async () => {
    const scenario = await createScenario();
    const itemId = await createExpenseItem(10000, "MONTHLY");
    await request(app.server)
      .post(`/scenarios/${scenario.id}/items`)
      .set(auth)
      .send({ expenseItemId: itemId });

    const patched = await request(app.server)
      .patch(`/expense-items/${itemId}`)
      .set(auth)
      .send({ amount: 15000 });

    // Saved regardless, and the impact is reported rather than blocking —
    // with the actual from/to and the item's own name so the dialog can
    // spell it out.
    expect(patched.body.data.amount).toBe(15000);
    expect(patched.body.affectedScenarios).toEqual([{ id: scenario.id, name: scenario.name }]);
    expect(patched.body.changes).toEqual([
      {
        name: patched.body.data.name,
        source: "expenseItem",
        field: "amount",
        currency: "COP",
        from: 10000,
        to: 15000,
      },
    ]);

    const declined = await request(app.server).get(`/scenarios/${scenario.id}/summary`).set(auth);
    expect(declined.body.totals.monthly).toBe(10000);
    expect(declined.body.hasUpdates).toBe(true);
    // Same shape and wording data as the post-edit dialog — built by the
    // same describer on the frontend, never a second implementation.
    expect(declined.body.pendingChanges).toEqual([
      {
        name: patched.body.data.name,
        source: "expenseItem",
        field: "amount",
        currency: "COP",
        from: 10000,
        to: 15000,
      },
    ]);

    const synced = await request(app.server)
      .post(`/expense-items/${itemId}/sync-scenarios`)
      .set(auth);
    expect(synced.body.syncedCount).toBe(1);

    const after = await request(app.server).get(`/scenarios/${scenario.id}/summary`).set(auth);
    expect(after.body.totals.monthly).toBe(15000);
    expect(after.body.hasUpdates).toBe(false);
    expect(after.body.pendingChanges).toEqual([]);
  });

  it("lists every kind of pending change across a scenario's products and incomes", async () => {
    const scenario = await createScenario();
    const priceItemId = await createExpenseItem(80000, "MONTHLY");
    const frequencyItemId = await createExpenseItem(30000, "MONTHLY");
    const archivedItemId = await createExpenseItem(20000, "MONTHLY");
    const incomeId = await createIncome(2500000);
    for (const expenseItemId of [priceItemId, frequencyItemId, archivedItemId]) {
      await request(app.server)
        .post(`/scenarios/${scenario.id}/items`)
        .set(auth)
        .send({ expenseItemId });
    }
    await request(app.server)
      .post(`/scenarios/${scenario.id}/incomes`)
      .set(auth)
      .send({ incomeId });

    await request(app.server)
      .patch(`/expense-items/${priceItemId}`)
      .set(auth)
      .send({ amount: 95000 });
    await request(app.server)
      .patch(`/expense-items/${frequencyItemId}`)
      .set(auth)
      .send({ frequency: "YEARLY" });
    await request(app.server).post(`/expense-items/${archivedItemId}/archive`).set(auth);
    await request(app.server).patch(`/incomes/${incomeId}`).set(auth).send({ amount: 2700000 });

    const summary = await request(app.server).get(`/scenarios/${scenario.id}/summary`).set(auth);
    expect(summary.body.hasUpdates).toBe(true);

    const priceName = (await request(app.server).get(`/expense-items/${priceItemId}`).set(auth))
      .body.name;
    const frequencyName = (
      await request(app.server).get(`/expense-items/${frequencyItemId}`).set(auth)
    ).body.name;
    const archivedName = (
      await request(app.server).get(`/expense-items/${archivedItemId}`).set(auth)
    ).body.name;
    const incomeName = (await request(app.server).get(`/incomes/${incomeId}`).set(auth)).body.name;

    expect(summary.body.pendingChanges).toEqual(
      expect.arrayContaining([
        {
          name: priceName,
          source: "expenseItem",
          field: "amount",
          currency: "COP",
          from: 80000,
          to: 95000,
        },
        {
          name: frequencyName,
          source: "expenseItem",
          field: "frequency",
          from: "MONTHLY",
          to: "YEARLY",
        },
        { name: archivedName, source: "expenseItem", field: "archived" },
        {
          name: incomeName,
          source: "income",
          field: "amount",
          currency: "COP",
          from: 2500000,
          to: 2700000,
        },
      ]),
    );
    expect(summary.body.pendingChanges).toHaveLength(4);
  });

  it("reports every changed field when several move in one save", async () => {
    const scenario = await createScenario();
    const itemId = await createExpenseItem(80000, "MONTHLY");
    await request(app.server)
      .post(`/scenarios/${scenario.id}/items`)
      .set(auth)
      .send({ expenseItemId: itemId });

    const patched = await request(app.server)
      .patch(`/expense-items/${itemId}`)
      .set(auth)
      .send({ amount: 100000, frequency: "YEARLY" });

    const name = patched.body.data.name;
    expect(patched.body.changes).toEqual([
      { name, source: "expenseItem", field: "amount", currency: "COP", from: 80000, to: 100000 },
      { name, source: "expenseItem", field: "frequency", from: "MONTHLY", to: "YEARLY" },
    ]);
  });

  it("omits the old value when the affected snapshots disagree on it", async () => {
    const synced = await createScenario();
    const stale = await createScenario();
    const itemId = await createExpenseItem(10000, "MONTHLY");
    for (const scenario of [synced, stale]) {
      await request(app.server)
        .post(`/scenarios/${scenario.id}/items`)
        .set(auth)
        .send({ expenseItemId: itemId });
    }

    // Only one of the two scenarios follows along to 20000, so their
    // snapshots now hold different "from" values.
    await request(app.server).patch(`/expense-items/${itemId}`).set(auth).send({ amount: 20000 });
    await request(app.server).post(`/scenarios/${synced.id}/sync`).set(auth);

    const patched = await request(app.server)
      .patch(`/expense-items/${itemId}`)
      .set(auth)
      .send({ amount: 30000 });

    expect(patched.body.changes).toEqual([
      {
        name: patched.body.data.name,
        source: "expenseItem",
        field: "amount",
        currency: "COP",
        from: null,
        to: 30000,
      },
    ]);
  });

  it("reports an archived product as leaving its scenarios", async () => {
    const scenario = await createScenario();
    const itemId = await createExpenseItem(10000, "MONTHLY");
    await request(app.server)
      .post(`/scenarios/${scenario.id}/items`)
      .set(auth)
      .send({ expenseItemId: itemId });

    const archived = await request(app.server).post(`/expense-items/${itemId}/archive`).set(auth);

    expect(archived.body.changes).toEqual([
      { name: archived.body.data.name, source: "expenseItem", field: "archived" },
    ]);
  });

  it("reports composition ancestors as affected by a product's price change", async () => {
    const parent = await createScenario();
    const child = await createScenario();
    await request(app.server)
      .post(`/scenarios/${parent.id}/compositions`)
      .set(auth)
      .send({ childScenarioId: child.id });

    const itemId = await createExpenseItem(10000, "MONTHLY");
    await request(app.server)
      .post(`/scenarios/${child.id}/items`)
      .set(auth)
      .send({ expenseItemId: itemId });

    const patched = await request(app.server)
      .patch(`/expense-items/${itemId}`)
      .set(auth)
      .send({ amount: 20000 });

    const affectedIds = patched.body.affectedScenarios.map((entry: { id: string }) => entry.id);
    expect(affectedIds).toContain(child.id);
    expect(affectedIds).toContain(parent.id);
  });

  it("excludes archived scenarios from the reported impact", async () => {
    const scenario = await createScenario();
    const itemId = await createExpenseItem(10000, "MONTHLY");
    await request(app.server)
      .post(`/scenarios/${scenario.id}/items`)
      .set(auth)
      .send({ expenseItemId: itemId });
    await request(app.server).post(`/scenarios/${scenario.id}/archive`).set(auth);

    const patched = await request(app.server)
      .patch(`/expense-items/${itemId}`)
      .set(auth)
      .send({ amount: 30000 });

    expect(patched.body.affectedScenarios).toEqual([]);

    // Frozen: an archived scenario surfaces no pending state at all.
    const summary = await request(app.server).get(`/scenarios/${scenario.id}/summary`).set(auth);
    expect(summary.body.hasUpdates).toBe(false);

    // Unarchiving re-checks from scratch, so the drift resurfaces.
    await request(app.server).post(`/scenarios/${scenario.id}/unarchive`).set(auth);
    const restored = await request(app.server).get(`/scenarios/${scenario.id}/summary`).set(auth);
    expect(restored.body.hasUpdates).toBe(true);
  });

  it("drops an archived product from its scenarios when synced", async () => {
    const scenario = await createScenario();
    const itemId = await createExpenseItem(10000, "MONTHLY");
    await request(app.server)
      .post(`/scenarios/${scenario.id}/items`)
      .set(auth)
      .send({ expenseItemId: itemId });

    const archived = await request(app.server).post(`/expense-items/${itemId}/archive`).set(auth);
    expect(archived.body.affectedScenarios).toEqual([{ id: scenario.id, name: scenario.name }]);

    await request(app.server).post(`/scenarios/${scenario.id}/sync`).set(auth);

    const items = await request(app.server).get(`/scenarios/${scenario.id}/items`).set(auth);
    expect(items.body.data).toEqual([]);
  });

  it("syncs an income's amount only when asked", async () => {
    const scenario = await createScenario();
    const incomeId = await createIncome(100000);
    await request(app.server)
      .post(`/scenarios/${scenario.id}/incomes`)
      .set(auth)
      .send({ incomeId });

    const patched = await request(app.server)
      .patch(`/incomes/${incomeId}`)
      .set(auth)
      .send({ amount: 150000 });
    expect(patched.body.affectedScenarios).toEqual([{ id: scenario.id, name: scenario.name }]);
    expect(patched.body.changes).toEqual([
      {
        name: patched.body.data.name,
        source: "income",
        field: "amount",
        currency: "COP",
        from: 100000,
        to: 150000,
      },
    ]);

    const before = await request(app.server).get(`/scenarios/${scenario.id}/summary`).set(auth);
    expect(before.body.incomeCoverage.totalIncomeMonthly).toBe(100000);

    await request(app.server).post(`/incomes/${incomeId}/sync-scenarios`).set(auth);

    const after = await request(app.server).get(`/scenarios/${scenario.id}/summary`).set(auth);
    expect(after.body.incomeCoverage.totalIncomeMonthly).toBe(150000);
    expect(after.body.hasUpdates).toBe(false);
  });

  it("adds a whole category without keeping any link to it", async () => {
    const scenario = await createScenario();
    await createExpenseItem(5000, "MONTHLY");

    const added = await request(app.server)
      .post(`/scenarios/${scenario.id}/category`)
      .set(auth)
      .send({ categoryId: user.expenseCategoryId });
    expect(added.body.addedCount).toBeGreaterThan(0);

    const countAfterAdd = (
      await request(app.server).get(`/scenarios/${scenario.id}/items`).set(auth)
    ).body.data.length;

    // A product created in that category afterwards never joins on its own.
    await createExpenseItem(7000, "MONTHLY");

    const items = await request(app.server).get(`/scenarios/${scenario.id}/items`).set(auth);
    expect(items.body.data.length).toBe(countAfterAdd);

    const summary = await request(app.server).get(`/scenarios/${scenario.id}/summary`).set(auth);
    expect(summary.body.hasUpdates).toBe(false);
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
