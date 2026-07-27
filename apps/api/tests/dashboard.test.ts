import type { FastifyInstance } from "fastify";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { buildApp } from "../src/app.js";
import { cleanupTestUser, registerTestUser } from "./helpers/test-user.js";

// Every test registers its own user so absolute totals (totalBalance,
// currentMonthSummary, financialHealth score) never mix with another test's
// transactions.
describe("Dashboard", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it("returns zeroed totals and a neutral financial health score when there is no activity yet", async () => {
    const testUser = await registerTestUser(app);
    const auth = { Authorization: `Bearer ${testUser.accessToken}` };
    try {
      const res = await request(app.server).get("/dashboard/summary").set(auth);

      expect(res.status).toBe(200);
      expect(res.body.totalBalance).toEqual({ income: 0, expenses: 0, balance: 0 });
      expect(res.body.currentMonthSummary).toEqual({ income: 0, expenses: 0, balance: 0 });
      expect(res.body.spendingByCategory).toEqual([]);
      expect(res.body.topExpenses).toEqual([]);
      expect(res.body.budgets).toEqual([]);
      expect(res.body.accountBalances).toHaveLength(1);
      expect(res.body.accountBalances[0]).toMatchObject({ income: 0, expenses: 0, balance: 0 });
      expect(res.body.monthComparison.changePercent).toEqual({
        income: 0,
        expenses: 0,
        balance: 0,
      });
      // savingsScore 50 (no income/expenses) * .4 + budgetScore 70 (no budgets) * .4 + balanceScore 50 (balance 0) * .2 = 58
      expect(res.body.financialHealth).toEqual({ score: 58, status: "WARNING" });
    } finally {
      await cleanupTestUser(app, testUser.userId);
    }
  });

  it("computes totalBalance and per-account balances from income and expense transactions", async () => {
    const testUser = await registerTestUser(app);
    const auth = { Authorization: `Bearer ${testUser.accessToken}` };
    try {
      const secondAccount = await request(app.server)
        .post("/accounts")
        .set(auth)
        .send({ name: "Savings", type: "BANK" });
      const today = new Date().toISOString().slice(0, 10);

      await request(app.server).post("/transactions").set(auth).send({
        accountId: testUser.accountId,
        categoryId: testUser.incomeCategoryId,
        type: "INCOME",
        amount: 1000,
        date: today,
      });
      await request(app.server).post("/transactions").set(auth).send({
        accountId: testUser.accountId,
        categoryId: testUser.expenseCategoryId,
        type: "EXPENSE",
        amount: 300,
        date: today,
      });
      await request(app.server).post("/transactions").set(auth).send({
        accountId: secondAccount.body.id,
        categoryId: testUser.expenseCategoryId,
        type: "EXPENSE",
        amount: 100,
        date: today,
      });

      const res = await request(app.server).get("/dashboard/summary").set(auth);

      expect(res.body.totalBalance).toEqual({ income: 1000, expenses: 400, balance: 600 });

      const primary = res.body.accountBalances.find(
        (account: { accountId: string }) => account.accountId === testUser.accountId,
      );
      const secondary = res.body.accountBalances.find(
        (account: { accountId: string }) => account.accountId === secondAccount.body.id,
      );
      expect(primary).toMatchObject({ income: 1000, expenses: 300, balance: 700 });
      expect(secondary).toMatchObject({ income: 0, expenses: 100, balance: -100 });
    } finally {
      await cleanupTestUser(app, testUser.userId);
    }
  });

  it("computes spendingByCategory with percentage and a stable color, sorted by amount desc", async () => {
    const testUser = await registerTestUser(app);
    const auth = { Authorization: `Bearer ${testUser.accessToken}` };
    try {
      const categoryA = await request(app.server)
        .post("/categories")
        .set(auth)
        .send({ name: "Groceries", type: "EXPENSE" });
      const categoryB = await request(app.server)
        .post("/categories")
        .set(auth)
        .send({ name: "Transport", type: "EXPENSE" });
      const today = new Date().toISOString().slice(0, 10);

      await request(app.server).post("/transactions").set(auth).send({
        accountId: testUser.accountId,
        categoryId: categoryA.body.id,
        type: "EXPENSE",
        amount: 60,
        date: today,
      });
      await request(app.server).post("/transactions").set(auth).send({
        accountId: testUser.accountId,
        categoryId: categoryA.body.id,
        type: "EXPENSE",
        amount: 40,
        date: today,
      });
      await request(app.server).post("/transactions").set(auth).send({
        accountId: testUser.accountId,
        categoryId: categoryB.body.id,
        type: "EXPENSE",
        amount: 50,
        date: today,
      });

      const res = await request(app.server).get("/dashboard/summary").set(auth);

      expect(res.body.spendingByCategory).toHaveLength(2);
      const [first, second] = res.body.spendingByCategory;
      expect(first).toMatchObject({ categoryId: categoryA.body.id, amount: 100, percentage: 66.7 });
      expect(second).toMatchObject({ categoryId: categoryB.body.id, amount: 50, percentage: 33.3 });
      expect(first.color).toMatch(/^hsl\(/);

      const res2 = await request(app.server).get("/dashboard/summary").set(auth);
      expect(res2.body.spendingByCategory[0].color).toBe(first.color);
    } finally {
      await cleanupTestUser(app, testUser.userId);
    }
  });

  it("orders topExpenses by amount desc, then date desc on ties", async () => {
    const testUser = await registerTestUser(app);
    const auth = { Authorization: `Bearer ${testUser.accessToken}` };
    try {
      const now = new Date();
      const earlier = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 5))
        .toISOString()
        .slice(0, 10);
      const later = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 6))
        .toISOString()
        .slice(0, 10);

      await request(app.server).post("/transactions").set(auth).send({
        accountId: testUser.accountId,
        categoryId: testUser.expenseCategoryId,
        type: "EXPENSE",
        amount: 200,
        date: earlier,
      });
      await request(app.server).post("/transactions").set(auth).send({
        accountId: testUser.accountId,
        categoryId: testUser.expenseCategoryId,
        type: "EXPENSE",
        amount: 200,
        date: later,
      });
      await request(app.server).post("/transactions").set(auth).send({
        accountId: testUser.accountId,
        categoryId: testUser.expenseCategoryId,
        type: "EXPENSE",
        amount: 50,
        date: later,
      });

      const res = await request(app.server).get("/dashboard/summary").set(auth);

      expect(res.body.topExpenses).toHaveLength(3);
      expect(res.body.topExpenses[0].amount).toBe(200);
      expect(res.body.topExpenses[0].date.slice(0, 10)).toBe(later);
      expect(res.body.topExpenses[1].amount).toBe(200);
      expect(res.body.topExpenses[1].date.slice(0, 10)).toBe(earlier);
      expect(res.body.topExpenses[2].amount).toBe(50);
    } finally {
      await cleanupTestUser(app, testUser.userId);
    }
  });

  it("excludes transactions outside the current month from currentMonthSummary and spendingByCategory", async () => {
    const testUser = await registerTestUser(app);
    const auth = { Authorization: `Bearer ${testUser.accessToken}` };
    try {
      const now = new Date();
      const previousMonthDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 15))
        .toISOString()
        .slice(0, 10);

      await request(app.server).post("/transactions").set(auth).send({
        accountId: testUser.accountId,
        categoryId: testUser.expenseCategoryId,
        type: "EXPENSE",
        amount: 500,
        date: previousMonthDate,
      });

      const res = await request(app.server).get("/dashboard/summary").set(auth);

      expect(res.body.currentMonthSummary).toEqual({ income: 0, expenses: 0, balance: 0 });
      expect(res.body.spendingByCategory).toEqual([]);
      expect(res.body.totalBalance.expenses).toBe(500);
    } finally {
      await cleanupTestUser(app, testUser.userId);
    }
  });

  it("includes budget status and factors it into the financial health score", async () => {
    const testUser = await registerTestUser(app);
    const auth = { Authorization: `Bearer ${testUser.accessToken}` };
    try {
      const category = await request(app.server)
        .post("/categories")
        .set(auth)
        .send({ name: "Rent", type: "EXPENSE" });
      await request(app.server)
        .post("/budgets")
        .set(auth)
        .send({ categoryId: category.body.id, amount: 100 });

      const today = new Date().toISOString().slice(0, 10);
      await request(app.server).post("/transactions").set(auth).send({
        accountId: testUser.accountId,
        categoryId: category.body.id,
        type: "EXPENSE",
        amount: 150,
        date: today,
      });

      const res = await request(app.server).get("/dashboard/summary").set(auth);

      expect(res.body.budgets).toHaveLength(1);
      expect(res.body.budgets[0].status).toBe("EXCEEDED");
      // savingsScore 0 (all expense, no income) + budgetScore 0 (one EXCEEDED) + balanceScore 0 (negative balance)
      expect(res.body.financialHealth).toEqual({ score: 0, status: "CRITICAL" });
    } finally {
      await cleanupTestUser(app, testUser.userId);
    }
  });

  it("computes monthComparison and changePercent between current and previous month", async () => {
    const testUser = await registerTestUser(app);
    const auth = { Authorization: `Bearer ${testUser.accessToken}` };
    try {
      const now = new Date();
      const previousMonthDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 10))
        .toISOString()
        .slice(0, 10);
      const today = now.toISOString().slice(0, 10);

      await request(app.server).post("/transactions").set(auth).send({
        accountId: testUser.accountId,
        categoryId: testUser.expenseCategoryId,
        type: "EXPENSE",
        amount: 100,
        date: previousMonthDate,
      });
      await request(app.server).post("/transactions").set(auth).send({
        accountId: testUser.accountId,
        categoryId: testUser.expenseCategoryId,
        type: "EXPENSE",
        amount: 150,
        date: today,
      });

      const res = await request(app.server).get("/dashboard/summary").set(auth);

      expect(res.body.monthComparison.previous.expenses).toBe(100);
      expect(res.body.monthComparison.current.expenses).toBe(150);
      expect(res.body.monthComparison.changePercent.expenses).toBe(50);
    } finally {
      await cleanupTestUser(app, testUser.userId);
    }
  });

  it("requires authentication", async () => {
    const res = await request(app.server).get("/dashboard/summary");
    expect(res.status).toBe(401);
  });
});
