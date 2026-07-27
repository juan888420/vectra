import type { FastifyInstance } from "fastify";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { buildApp } from "../src/app.js";
import { cleanupTestUser, registerTestUser, type TestUser } from "./helpers/test-user.js";

describe("Recurring transactions", () => {
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

  const createPayload = (overrides: Record<string, unknown> = {}) => ({
    accountId: user.accountId,
    categoryId: user.expenseCategoryId,
    amount: 25.5,
    frequency: "MONTHLY",
    startDate: "2026-01-15",
    ...overrides,
  });

  const create = (overrides: Record<string, unknown> = {}) =>
    request(app.server).post("/recurring-transactions").set(auth).send(createPayload(overrides));

  it("creates a template, deriving currency from the account and seeding nextExecutionDate", async () => {
    const res = await create();

    expect(res.status).toBe(201);
    expect(res.body.amount).toBe(25.5);
    expect(res.body.currency).toBe("USD");
    expect(res.body.isActive).toBe(true);
    expect(res.body.startDate.slice(0, 10)).toBe("2026-01-15");
    expect(res.body.nextExecutionDate.slice(0, 10)).toBe("2026-01-15");
    expect(res.body.endDate).toBeNull();
  });

  it.each(["DAILY", "WEEKLY", "BIWEEKLY", "MONTHLY", "YEARLY"])(
    "accepts the %s frequency",
    async (frequency) => {
      const res = await create({ frequency });
      expect(res.status).toBe(201);
      expect(res.body.frequency).toBe(frequency);
    },
  );

  it("rejects an unknown frequency", async () => {
    const res = await create({ frequency: "HOURLY" });
    expect(res.status).toBe(400);
  });

  it("rejects an endDate before startDate", async () => {
    const res = await create({ startDate: "2026-06-01", endDate: "2026-05-01" });
    expect(res.status).toBe(400);
  });

  it("accepts an endDate equal to startDate", async () => {
    const res = await create({ startDate: "2026-06-01", endDate: "2026-06-01" });
    expect(res.status).toBe(201);
  });

  it("rejects an amount with more than 2 decimal places", async () => {
    const res = await create({ amount: 10.999 });
    expect(res.status).toBe(400);
  });

  it("rejects a zero amount", async () => {
    const res = await create({ amount: 0 });
    expect(res.status).toBe(400);
  });

  it("rejects an archived account (business rule 4)", async () => {
    const account = await request(app.server)
      .post("/accounts")
      .set(auth)
      .send({ name: `Archived acct ${Date.now()}`, type: "CASH" });
    await request(app.server).post(`/accounts/${account.body.id}/archive`).set(auth);

    const res = await create({ accountId: account.body.id });
    expect(res.status).toBe(400);
  });

  it("rejects an archived category (business rule 4)", async () => {
    const category = await request(app.server)
      .post("/categories")
      .set(auth)
      .send({ name: `Archived cat ${Date.now()}`, type: "EXPENSE" });
    await request(app.server).post(`/categories/${category.body.id}/archive`).set(auth);

    const res = await create({ categoryId: category.body.id });
    expect(res.status).toBe(400);
  });

  it("returns 404 for an account belonging to another user", async () => {
    const otherUser = await registerTestUser(app);
    try {
      const res = await create({ accountId: otherUser.accountId });
      expect(res.status).toBe(404);
    } finally {
      await cleanupTestUser(app, otherUser.userId);
    }
  });

  it("isolates templates between users (404, not 403, on cross-user access)", async () => {
    const created = await create();
    const otherUser = await registerTestUser(app);
    try {
      const res = await request(app.server)
        .get(`/recurring-transactions/${created.body.id}`)
        .set({ Authorization: `Bearer ${otherUser.accessToken}` });

      expect(res.status).toBe(404);
    } finally {
      await cleanupTestUser(app, otherUser.userId);
    }
  });

  it("updates amount and frequency without moving the pending nextExecutionDate", async () => {
    const created = await create();

    const res = await request(app.server)
      .patch(`/recurring-transactions/${created.body.id}`)
      .set(auth)
      .send({ amount: 99, frequency: "WEEKLY" });

    expect(res.status).toBe(200);
    expect(res.body.amount).toBe(99);
    expect(res.body.frequency).toBe("WEEKLY");
    expect(res.body.nextExecutionDate.slice(0, 10)).toBe(
      created.body.nextExecutionDate.slice(0, 10),
    );
  });

  it("ignores startDate and nextExecutionDate in the update body", async () => {
    const created = await create();

    await request(app.server)
      .patch(`/recurring-transactions/${created.body.id}`)
      .set(auth)
      .send({ amount: 30, startDate: "2020-01-01", nextExecutionDate: "2020-01-01" });

    const res = await request(app.server)
      .get(`/recurring-transactions/${created.body.id}`)
      .set(auth);

    expect(res.body.startDate.slice(0, 10)).toBe("2026-01-15");
    expect(res.body.nextExecutionDate.slice(0, 10)).toBe("2026-01-15");
  });

  it("clears the endDate when set to null", async () => {
    const created = await create({ endDate: "2026-12-31" });
    expect(created.body.endDate).not.toBeNull();

    const res = await request(app.server)
      .patch(`/recurring-transactions/${created.body.id}`)
      .set(auth)
      .send({ endDate: null });

    expect(res.status).toBe(200);
    expect(res.body.endDate).toBeNull();
  });

  it("pauses and resumes, keeping the schedule across the pause", async () => {
    const created = await create();

    const paused = await request(app.server)
      .post(`/recurring-transactions/${created.body.id}/pause`)
      .set(auth);
    expect(paused.status).toBe(200);
    expect(paused.body.isActive).toBe(false);
    expect(paused.body.nextExecutionDate).toBe(created.body.nextExecutionDate);

    const resumed = await request(app.server)
      .post(`/recurring-transactions/${created.body.id}/resume`)
      .set(auth);
    expect(resumed.body.isActive).toBe(true);
    expect(resumed.body.nextExecutionDate).toBe(created.body.nextExecutionDate);
  });

  it("is idempotent when pausing twice", async () => {
    const created = await create();
    await request(app.server).post(`/recurring-transactions/${created.body.id}/pause`).set(auth);

    const res = await request(app.server)
      .post(`/recurring-transactions/${created.body.id}/pause`)
      .set(auth);

    expect(res.status).toBe(200);
    expect(res.body.isActive).toBe(false);
  });

  it("hides inactive templates from the list unless includeInactive is set", async () => {
    const created = await create({ frequency: "YEARLY", startDate: "2026-03-03" });
    await request(app.server).post(`/recurring-transactions/${created.body.id}/pause`).set(auth);

    const active = await request(app.server)
      .get("/recurring-transactions")
      .query({ pageSize: 100 })
      .set(auth);
    expect(active.body.data.some((t: { id: string }) => t.id === created.body.id)).toBe(false);

    const all = await request(app.server)
      .get("/recurring-transactions")
      .query({ pageSize: 100, includeInactive: "true" })
      .set(auth);
    expect(all.body.data.some((t: { id: string }) => t.id === created.body.id)).toBe(true);
  });

  it("filters the list by frequency", async () => {
    await create({ frequency: "DAILY" });

    const res = await request(app.server)
      .get("/recurring-transactions")
      .query({ frequency: "DAILY", pageSize: 100 })
      .set(auth);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThan(0);
    for (const template of res.body.data) {
      expect(template.frequency).toBe("DAILY");
    }
  });

  // That deleting a template *detaches* rather than destroys the transactions
  // it generated is covered in the processor suite, where real generated
  // transactions exist.
  it("deletes a template", async () => {
    const created = await create();

    const del = await request(app.server)
      .delete(`/recurring-transactions/${created.body.id}`)
      .set(auth);
    expect(del.status).toBe(204);

    const get = await request(app.server)
      .get(`/recurring-transactions/${created.body.id}`)
      .set(auth);
    expect(get.status).toBe(404);
  });

  it("requires authentication", async () => {
    const res = await request(app.server).get("/recurring-transactions");
    expect(res.status).toBe(401);
  });
});
