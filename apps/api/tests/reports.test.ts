import type { FastifyInstance } from "fastify";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { buildApp } from "../src/app.js";
import { cleanupTestUser, registerTestUser, type TestUser } from "./helpers/test-user.js";

// Fixed dates far from "today" so results never depend on when the suite
// runs. June 2026: the 1st is a Monday.
describe("Reports", () => {
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

  async function addTransaction(overrides: Record<string, unknown>): Promise<void> {
    const res = await request(app.server)
      .post("/transactions")
      .set(auth)
      .send({
        accountId: user.accountId,
        categoryId: user.expenseCategoryId,
        type: "EXPENSE",
        amount: 10,
        date: "2026-06-01",
        ...overrides,
      });
    expect(res.status).toBe(201);
  }

  describe("GET /reports/cash-flow", () => {
    it("groups by month with cumulative balance", async () => {
      await addTransaction({
        type: "INCOME",
        categoryId: user.incomeCategoryId,
        amount: 1000,
        date: "2026-01-10",
      });
      await addTransaction({ amount: 400, date: "2026-01-20" });
      await addTransaction({ amount: 250, date: "2026-02-05" });

      const res = await request(app.server)
        .get("/reports/cash-flow")
        .query({ dateFrom: "2026-01-01", dateTo: "2026-02-28", groupBy: "month" })
        .set(auth);

      expect(res.status).toBe(200);
      expect(res.body.groupBy).toBe("month");
      expect(res.body.data).toEqual([
        {
          periodStart: "2026-01-01",
          periodEnd: "2026-01-31",
          income: 1000,
          expenses: 400,
          balance: 600,
          cumulativeBalance: 600,
        },
        {
          periodStart: "2026-02-01",
          periodEnd: "2026-02-28",
          income: 0,
          expenses: 250,
          balance: -250,
          cumulativeBalance: 350,
        },
      ]);
    });

    it("groups by week aligned to the user's week start (Monday by default)", async () => {
      await addTransaction({ amount: 30, date: "2026-06-03" });
      await addTransaction({ amount: 70, date: "2026-06-10" });

      const res = await request(app.server)
        .get("/reports/cash-flow")
        .query({ dateFrom: "2026-06-03", dateTo: "2026-06-16", groupBy: "week" })
        .set(auth);

      expect(
        res.body.data.map((p: { periodStart: string; periodEnd: string }) => [
          p.periodStart,
          p.periodEnd,
        ]),
      ).toEqual([
        ["2026-06-03", "2026-06-07"],
        ["2026-06-08", "2026-06-14"],
        ["2026-06-15", "2026-06-16"],
      ]);
      expect(res.body.data.map((p: { expenses: number }) => p.expenses)).toEqual([30, 70, 0]);
    });

    it("filters by account", async () => {
      const other = await request(app.server)
        .post("/accounts")
        .set(auth)
        .send({ name: `CF filter ${Date.now()}`, type: "BANK" });
      await addTransaction({ accountId: other.body.id, amount: 55, date: "2026-03-03" });
      await addTransaction({ amount: 99, date: "2026-03-04" });

      const res = await request(app.server)
        .get("/reports/cash-flow")
        .query({
          dateFrom: "2026-03-01",
          dateTo: "2026-03-31",
          groupBy: "month",
          accountId: other.body.id,
        })
        .set(auth);

      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].expenses).toBe(55);
    });

    it("rejects dateFrom after dateTo", async () => {
      const res = await request(app.server)
        .get("/reports/cash-flow")
        .query({ dateFrom: "2026-02-01", dateTo: "2026-01-01" })
        .set(auth);
      expect(res.status).toBe(400);
    });

    it("rejects a range exceeding the bucket limit", async () => {
      const res = await request(app.server)
        .get("/reports/cash-flow")
        .query({ dateFrom: "2020-01-01", dateTo: "2026-01-01", groupBy: "day" })
        .set(auth);
      expect(res.status).toBe(400);
    });
  });

  describe("GET /reports/category-trends", () => {
    it("returns wide rows keyed by categoryId with a color legend, biggest spender first", async () => {
      const catA = await request(app.server)
        .post("/categories")
        .set(auth)
        .send({ name: `Trend A ${Date.now()}`, type: "EXPENSE" });
      const catB = await request(app.server)
        .post("/categories")
        .set(auth)
        .send({ name: `Trend B ${Date.now()}`, type: "EXPENSE" });

      await addTransaction({ categoryId: catA.body.id, amount: 40, date: "2026-04-05" });
      await addTransaction({ categoryId: catA.body.id, amount: 60, date: "2026-05-10" });
      await addTransaction({ categoryId: catB.body.id, amount: 150, date: "2026-04-15" });
      // INCOME must be excluded from spending trends.
      await addTransaction({
        type: "INCOME",
        categoryId: user.incomeCategoryId,
        amount: 500,
        date: "2026-04-20",
      });

      const res = await request(app.server)
        .get("/reports/category-trends")
        .query({ dateFrom: "2026-04-01", dateTo: "2026-05-31", groupBy: "month" })
        .set(auth);

      expect(res.status).toBe(200);
      expect(res.body.legend).toEqual([
        {
          categoryId: catB.body.id,
          categoryName: catB.body.name,
          color: expect.stringMatching(/^hsl\(/),
        },
        {
          categoryId: catA.body.id,
          categoryName: catA.body.name,
          color: expect.stringMatching(/^hsl\(/),
        },
      ]);

      // The wide format must survive response serialization: dynamic UUID
      // keys alongside the fixed period bounds.
      expect(res.body.data).toEqual([
        {
          periodStart: "2026-04-01",
          periodEnd: "2026-04-30",
          [catA.body.id]: 40,
          [catB.body.id]: 150,
        },
        {
          periodStart: "2026-05-01",
          periodEnd: "2026-05-31",
          [catA.body.id]: 60,
        },
      ]);
      expect(res.body.data[0][user.incomeCategoryId]).toBeUndefined();
    });

    it("filters to a single category", async () => {
      const cat = await request(app.server)
        .post("/categories")
        .set(auth)
        .send({ name: `Trend solo ${Date.now()}`, type: "EXPENSE" });
      await addTransaction({ categoryId: cat.body.id, amount: 20, date: "2026-07-07" });
      await addTransaction({ amount: 80, date: "2026-07-08" });

      const res = await request(app.server)
        .get("/reports/category-trends")
        .query({
          dateFrom: "2026-07-01",
          dateTo: "2026-07-31",
          groupBy: "month",
          categoryId: cat.body.id,
        })
        .set(auth);

      expect(res.body.legend).toHaveLength(1);
      expect(res.body.data[0][cat.body.id]).toBe(20);
      expect(res.body.data[0][user.expenseCategoryId]).toBeUndefined();
    });
  });

  describe("GET /reports/account-stats", () => {
    it("separates income and expense metrics per account and includes inactive accounts", async () => {
      const active = await request(app.server)
        .post("/accounts")
        .set(auth)
        .send({ name: `Stats active ${Date.now()}`, type: "BANK" });
      const idle = await request(app.server)
        .post("/accounts")
        .set(auth)
        .send({ name: `Stats idle ${Date.now()}`, type: "CASH" });

      await addTransaction({
        accountId: active.body.id,
        type: "INCOME",
        categoryId: user.incomeCategoryId,
        amount: 900,
        date: "2026-08-01",
      });
      await addTransaction({
        accountId: active.body.id,
        type: "INCOME",
        categoryId: user.incomeCategoryId,
        amount: 100,
        date: "2026-08-02",
      });
      await addTransaction({ accountId: active.body.id, amount: 60, date: "2026-08-03" });
      await addTransaction({ accountId: active.body.id, amount: 40, date: "2026-08-04" });

      const res = await request(app.server)
        .get("/reports/account-stats")
        .query({ dateFrom: "2026-08-01", dateTo: "2026-08-31" })
        .set(auth);

      expect(res.status).toBe(200);
      const stats = res.body.data.find(
        (row: { accountId: string }) => row.accountId === active.body.id,
      );
      expect(stats).toMatchObject({
        transactionCount: 4,
        income: 1000,
        expenses: 100,
        netChange: 900,
        averageIncome: 500,
        averageExpense: 50,
        largestIncome: 900,
        largestExpense: 60,
      });

      const idleStats = res.body.data.find(
        (row: { accountId: string }) => row.accountId === idle.body.id,
      );
      expect(idleStats).toMatchObject({
        transactionCount: 0,
        income: 0,
        expenses: 0,
        netChange: 0,
        averageIncome: 0,
        averageExpense: 0,
        largestIncome: 0,
        largestExpense: 0,
      });
    });
  });

  describe("GET /reports/period-comparison", () => {
    it("returns totals, absolute change and percent change", async () => {
      await addTransaction({ amount: 200, date: "2026-09-10" });
      await addTransaction({ amount: 300, date: "2026-10-10" });
      await addTransaction({
        type: "INCOME",
        categoryId: user.incomeCategoryId,
        amount: 1000,
        date: "2026-10-15",
      });

      const res = await request(app.server)
        .get("/reports/period-comparison")
        .query({
          currentFrom: "2026-10-01",
          currentTo: "2026-10-31",
          previousFrom: "2026-09-01",
          previousTo: "2026-09-30",
        })
        .set(auth);

      expect(res.status).toBe(200);
      expect(res.body.current).toEqual({ income: 1000, expenses: 300, balance: 700 });
      expect(res.body.previous).toEqual({ income: 0, expenses: 200, balance: -200 });
      expect(res.body.changeAmount).toEqual({ income: 1000, expenses: 100, balance: 900 });
      // Income change from 0 is undefined, not Infinity.
      expect(res.body.changePercent).toEqual({ income: null, expenses: 50, balance: -450 });
    });

    it("rejects an inverted previous range", async () => {
      const res = await request(app.server)
        .get("/reports/period-comparison")
        .query({
          currentFrom: "2026-10-01",
          currentTo: "2026-10-31",
          previousFrom: "2026-09-30",
          previousTo: "2026-09-01",
        })
        .set(auth);
      expect(res.status).toBe(400);
    });
  });

  it("isolates data between users", async () => {
    await addTransaction({ amount: 500, date: "2026-11-11" });

    const otherUser = await registerTestUser(app);
    try {
      const res = await request(app.server)
        .get("/reports/cash-flow")
        .query({ dateFrom: "2026-11-01", dateTo: "2026-11-30", groupBy: "month" })
        .set({ Authorization: `Bearer ${otherUser.accessToken}` });

      expect(res.body.data[0]).toMatchObject({ income: 0, expenses: 0, balance: 0 });
    } finally {
      await cleanupTestUser(app, otherUser.userId);
    }
  });

  it("requires authentication on every report", async () => {
    for (const path of [
      "/reports/cash-flow",
      "/reports/category-trends",
      "/reports/account-stats",
      "/reports/period-comparison",
    ]) {
      const res = await request(app.server).get(path);
      expect(res.status).toBe(401);
    }
  });
});
