import type { FastifyInstance } from "fastify";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { buildApp } from "../src/app.js";
import { cleanupTestUser, registerTestUser, type TestUser } from "./helpers/test-user.js";

function uniqueName(prefix: string): string {
  return `${prefix} ${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

describe("Incomes", () => {
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

  it("creates an income defaulting to MONTHLY and the user's currency", async () => {
    const res = await request(app.server)
      .post("/incomes")
      .set(auth)
      .send({ name: uniqueName("Sueldo"), amount: 4000000 });

    expect(res.status).toBe(201);
    expect(res.body.amount).toBe(4000000);
    expect(res.body.frequency).toBe("MONTHLY");
    expect(res.body.currency).toBe("COP");
    expect(res.body.archivedAt).toBeNull();
  });

  it("accepts WEEKLY, YEARLY and ONE_TIME frequencies", async () => {
    const weekly = await request(app.server)
      .post("/incomes")
      .set(auth)
      .send({ name: uniqueName("Freelance"), amount: 500000, frequency: "WEEKLY" });
    const yearly = await request(app.server)
      .post("/incomes")
      .set(auth)
      .send({ name: uniqueName("Dividendos"), amount: 2000000, frequency: "YEARLY" });
    const oneTime = await request(app.server)
      .post("/incomes")
      .set(auth)
      .send({ name: uniqueName("Bono"), amount: 1500000, frequency: "ONE_TIME" });

    expect(weekly.body.frequency).toBe("WEEKLY");
    expect(yearly.body.frequency).toBe("YEARLY");
    expect(oneTime.body.frequency).toBe("ONE_TIME");
  });

  it("rejects a second active income with the same name", async () => {
    const name = uniqueName("Arriendo");
    await request(app.server).post("/incomes").set(auth).send({ name, amount: 1000000 });

    const res = await request(app.server)
      .post("/incomes")
      .set(auth)
      .send({ name, amount: 1200000 });
    expect(res.status).toBe(409);
  });

  it("rejects a negative amount", async () => {
    const res = await request(app.server)
      .post("/incomes")
      .set(auth)
      .send({ name: uniqueName("Negativo"), amount: -100 });

    expect(res.status).toBe(400);
  });

  it("updates an income's amount and frequency", async () => {
    const created = await request(app.server)
      .post("/incomes")
      .set(auth)
      .send({ name: uniqueName("Consultoria"), amount: 800000 });

    const res = await request(app.server)
      .patch(`/incomes/${created.body.id}`)
      .set(auth)
      .send({ amount: 900000, frequency: "YEARLY" });

    expect(res.status).toBe(200);
    expect(res.body.data.amount).toBe(900000);
    expect(res.body.data.frequency).toBe("YEARLY");
    // No scenario links it, so nothing to offer syncing (RFC-0023.3).
    expect(res.body.affectedScenarios).toEqual([]);
  });

  it("filters by frequency and excludes archived incomes by default", async () => {
    const archived = await request(app.server)
      .post("/incomes")
      .set(auth)
      .send({ name: uniqueName("Viejo"), amount: 100000 });
    await request(app.server).post(`/incomes/${archived.body.id}/archive`).set(auth);

    const active = await request(app.server).get("/incomes?pageSize=100").set(auth);
    const all = await request(app.server)
      .get("/incomes?pageSize=100&includeArchived=true")
      .set(auth);

    const activeIds = active.body.data.map((income: { id: string }) => income.id);
    const allIds = all.body.data.map((income: { id: string }) => income.id);
    expect(activeIds).not.toContain(archived.body.id);
    expect(allIds).toContain(archived.body.id);
  });

  it("round-trips archive and unarchive", async () => {
    const created = await request(app.server)
      .post("/incomes")
      .set(auth)
      .send({ name: uniqueName("Alquiler"), amount: 700000 });

    const archived = await request(app.server)
      .post(`/incomes/${created.body.id}/archive`)
      .set(auth);
    expect(archived.body.data.archivedAt).not.toBeNull();

    const unarchived = await request(app.server)
      .post(`/incomes/${created.body.id}/unarchive`)
      .set(auth);
    expect(unarchived.body.data.archivedAt).toBeNull();
  });

  it("projects WEEKLY and YEARLY incomes to their monthly equivalent", async () => {
    const weekly = await request(app.server)
      .post("/incomes")
      .set(auth)
      .send({ name: uniqueName("Freelance semanal"), amount: 100000, frequency: "WEEKLY" });
    const yearly = await request(app.server)
      .post("/incomes")
      .set(auth)
      .send({ name: uniqueName("Dividendos anuales"), amount: 1200000, frequency: "YEARLY" });

    const weeklySummary = await request(app.server)
      .get(`/incomes/${weekly.body.id}/summary`)
      .set(auth);
    const yearlySummary = await request(app.server)
      .get(`/incomes/${yearly.body.id}/summary`)
      .set(auth);

    // 100000 * 52 / 12 ≈ 433333.33
    expect(weeklySummary.body.totals.monthly).toBeCloseTo(433333.33, 2);
    expect(yearlySummary.body.totals.monthly).toBe(100000);
    expect(yearlySummary.body.totals.twelveMonths).toBe(1200000);
  });

  it("returns null totals for a ONE_TIME income's summary", async () => {
    const oneTime = await request(app.server)
      .post("/incomes")
      .set(auth)
      .send({ name: uniqueName("Bono único"), amount: 500000, frequency: "ONE_TIME" });

    const res = await request(app.server).get(`/incomes/${oneTime.body.id}/summary`).set(auth);
    expect(res.body.totals).toBeNull();
  });

  it("hides another user's income behind a 404", async () => {
    const stranger = await registerTestUser(app);
    const income = await request(app.server)
      .post("/incomes")
      .set({ Authorization: `Bearer ${stranger.accessToken}` })
      .send({ name: uniqueName("Ajeno"), amount: 123456 });

    const res = await request(app.server).get(`/incomes/${income.body.id}`).set(auth);
    expect(res.status).toBe(404);

    await cleanupTestUser(app, stranger.userId);
  });

  it("deletes an income", async () => {
    const created = await request(app.server)
      .post("/incomes")
      .set(auth)
      .send({ name: uniqueName("Temporal"), amount: 10000 });

    const res = await request(app.server).delete(`/incomes/${created.body.id}`).set(auth);
    expect(res.status).toBe(204);
  });
});
