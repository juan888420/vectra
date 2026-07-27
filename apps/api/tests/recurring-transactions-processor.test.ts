import type { FastifyInstance } from "fastify";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { buildApp } from "../src/app.js";
import {
  createRecurringTransactionProcessor,
  MAX_CATCH_UP_ITERATIONS,
  type RecurringTransactionProcessor,
} from "../src/features/recurring-transactions/recurring-transactions.processor.js";
import { cleanupTestUser, registerTestUser, type TestUser } from "./helpers/test-user.js";

const asOf = (iso: string): Date => new Date(`${iso}T00:00:00.000Z`);

describe("Recurring transaction processor", () => {
  let app: FastifyInstance;
  let user: TestUser;
  let auth: Record<string, string>;
  let processor: RecurringTransactionProcessor;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
    user = await registerTestUser(app);
    auth = { Authorization: `Bearer ${user.accessToken}` };
    processor = createRecurringTransactionProcessor(app.prisma);
  });

  afterAll(async () => {
    await cleanupTestUser(app, user.userId);
    await app.close();
  });

  // Each test owns a dedicated category so its generated transactions never
  // mix with another test's counts.
  async function isolatedCategory(type: "EXPENSE" | "INCOME" = "EXPENSE"): Promise<string> {
    const res = await request(app.server)
      .post("/categories")
      .set(auth)
      .send({ name: `Proc ${type} ${Date.now()}-${Math.random()}`, type });
    return res.body.id;
  }

  async function createTemplate(overrides: Record<string, unknown> = {}): Promise<string> {
    const res = await request(app.server)
      .post("/recurring-transactions")
      .set(auth)
      .send({
        accountId: user.accountId,
        categoryId: overrides.categoryId ?? (await isolatedCategory()),
        amount: 10,
        frequency: "MONTHLY",
        startDate: "2026-01-15",
        ...overrides,
      });
    expect(res.status).toBe(201);
    return res.body.id;
  }

  const generatedFor = (templateId: string) =>
    app.prisma.transaction.findMany({
      where: { recurringTransactionId: templateId },
      orderBy: { date: "asc" },
    });

  const templateById = (id: string) =>
    app.prisma.recurringTransaction.findUniqueOrThrow({ where: { id } });

  it("generates the first occurrence on its start date and advances the schedule", async () => {
    const templateId = await createTemplate();

    const summary = await processor.processDueRecurringTransactions(asOf("2026-01-15"));

    expect(summary.generated).toBeGreaterThanOrEqual(1);
    expect(summary.failed).toBe(0);

    const generated = await generatedFor(templateId);
    expect(generated).toHaveLength(1);
    expect(generated[0]!.date.toISOString().slice(0, 10)).toBe("2026-01-15");
    expect(Number(generated[0]!.amount)).toBe(10);
    expect(generated[0]!.currency).toBe("USD");

    const template = await templateById(templateId);
    expect(template.nextExecutionDate.toISOString().slice(0, 10)).toBe("2026-02-15");
  });

  it("does not generate anything before the start date", async () => {
    const templateId = await createTemplate({ startDate: "2026-06-10" });

    await processor.processDueRecurringTransactions(asOf("2026-06-09"));

    expect(await generatedFor(templateId)).toHaveLength(0);
    const template = await templateById(templateId);
    expect(template.nextExecutionDate.toISOString().slice(0, 10)).toBe("2026-06-10");
  });

  it("derives the transaction type from the category (business rule 2)", async () => {
    const incomeCategory = await isolatedCategory("INCOME");
    const templateId = await createTemplate({
      categoryId: incomeCategory,
      startDate: "2026-01-05",
    });

    await processor.processDueRecurringTransactions(asOf("2026-01-05"));

    const [generated] = await generatedFor(templateId);
    expect(generated!.type).toBe("INCOME");
  });

  // The core idempotency guarantee: the same occurrence must never be written
  // twice, no matter how often the scheduler fires.
  it("never generates the same occurrence twice across repeated runs", async () => {
    const templateId = await createTemplate({ startDate: "2026-02-01" });

    await processor.processDueRecurringTransactions(asOf("2026-02-01"));
    await processor.processDueRecurringTransactions(asOf("2026-02-01"));
    await processor.processDueRecurringTransactions(asOf("2026-02-01"));

    expect(await generatedFor(templateId)).toHaveLength(1);
  });

  it("stays idempotent when two runs execute concurrently", async () => {
    const templateId = await createTemplate({ startDate: "2026-02-03" });

    await Promise.all([
      processor.processDueRecurringTransactions(asOf("2026-02-03")),
      processor.processDueRecurringTransactions(asOf("2026-02-03")),
    ]);

    expect(await generatedFor(templateId)).toHaveLength(1);
  });

  it("catches up on every occurrence missed while the scheduler was down", async () => {
    const templateId = await createTemplate({ frequency: "MONTHLY", startDate: "2026-01-31" });

    await processor.processDueRecurringTransactions(asOf("2026-05-15"));

    const generated = await generatedFor(templateId);
    // Anchored monthly recurrence: the 31st anchor survives short months.
    expect(generated.map((t) => t.date.toISOString().slice(0, 10))).toEqual([
      "2026-01-31",
      "2026-02-28",
      "2026-03-31",
      "2026-04-30",
    ]);

    const template = await templateById(templateId);
    expect(template.nextExecutionDate.toISOString().slice(0, 10)).toBe("2026-05-31");
  });

  it("stops at the endDate and generates nothing beyond it", async () => {
    const templateId = await createTemplate({
      frequency: "WEEKLY",
      startDate: "2026-03-02",
      endDate: "2026-03-16",
    });

    await processor.processDueRecurringTransactions(asOf("2026-06-01"));

    const generated = await generatedFor(templateId);
    expect(generated.map((t) => t.date.toISOString().slice(0, 10))).toEqual([
      "2026-03-02",
      "2026-03-09",
      "2026-03-16",
    ]);

    // A second run past the end date must remain a no-op.
    await processor.processDueRecurringTransactions(asOf("2026-07-01"));
    expect(await generatedFor(templateId)).toHaveLength(3);
  });

  it("skips paused templates entirely", async () => {
    const templateId = await createTemplate({ startDate: "2026-04-01" });
    await request(app.server).post(`/recurring-transactions/${templateId}/pause`).set(auth);

    await processor.processDueRecurringTransactions(asOf("2026-04-01"));

    expect(await generatedFor(templateId)).toHaveLength(0);
    const template = await templateById(templateId);
    expect(template.nextExecutionDate.toISOString().slice(0, 10)).toBe("2026-04-01");
  });

  it("catches up on occurrences missed while paused once resumed", async () => {
    const templateId = await createTemplate({ frequency: "MONTHLY", startDate: "2026-01-10" });
    await request(app.server).post(`/recurring-transactions/${templateId}/pause`).set(auth);

    await processor.processDueRecurringTransactions(asOf("2026-03-10"));
    expect(await generatedFor(templateId)).toHaveLength(0);

    await request(app.server).post(`/recurring-transactions/${templateId}/resume`).set(auth);
    await processor.processDueRecurringTransactions(asOf("2026-03-10"));

    expect((await generatedFor(templateId)).map((t) => t.date.toISOString().slice(0, 10))).toEqual([
      "2026-01-10",
      "2026-02-10",
      "2026-03-10",
    ]);
  });

  it("skips occurrences whose category was archived, but keeps the schedule moving", async () => {
    const categoryId = await isolatedCategory();
    const templateId = await createTemplate({ categoryId, startDate: "2026-05-05" });
    await request(app.server).post(`/categories/${categoryId}/archive`).set(auth);

    const summary = await processor.processDueRecurringTransactions(asOf("2026-05-05"));

    expect(summary.skipped).toBeGreaterThanOrEqual(1);
    expect(await generatedFor(templateId)).toHaveLength(0);

    const template = await templateById(templateId);
    expect(template.nextExecutionDate.toISOString().slice(0, 10)).toBe("2026-06-05");

    // Unarchiving resumes generation without replaying the skipped occurrence.
    await request(app.server).post(`/categories/${categoryId}/unarchive`).set(auth);
    await processor.processDueRecurringTransactions(asOf("2026-06-05"));

    expect((await generatedFor(templateId)).map((t) => t.date.toISOString().slice(0, 10))).toEqual([
      "2026-06-05",
    ]);
  });

  it("reports processed, generated, skipped and failed counters for a run", async () => {
    // The processor is deliberately global (a scheduler drives the whole
    // system, not one user), so the counters only become deterministic once
    // the templates left active by earlier tests are quiesced.
    await app.prisma.recurringTransaction.updateMany({
      where: { userId: user.userId },
      data: { isActive: false },
    });

    const activeCategory = await isolatedCategory();
    const archivedCategory = await isolatedCategory();
    const activeId = await createTemplate({
      categoryId: activeCategory,
      startDate: "2026-08-01",
      frequency: "WEEKLY",
      endDate: "2026-08-08",
    });
    const skippedId = await createTemplate({
      categoryId: archivedCategory,
      startDate: "2026-08-01",
      frequency: "YEARLY",
    });
    await request(app.server).post(`/categories/${archivedCategory}/archive`).set(auth);

    const before = await processor.processDueRecurringTransactions(asOf("2026-07-31"));
    const summary = await processor.processDueRecurringTransactions(asOf("2026-08-08"));

    // Both templates were examined in the second run, not the first.
    expect(before.processed).toBe(0);
    expect(summary.processed).toBe(2);
    // Two weekly occurrences from the active template.
    expect(summary.generated).toBe(2);
    expect(summary.skipped).toBe(1);
    expect(summary.failed).toBe(0);

    expect(await generatedFor(activeId)).toHaveLength(2);
    expect(await generatedFor(skippedId)).toHaveLength(0);
  });

  it("bounds a single run at MAX_CATCH_UP_ITERATIONS and carries the rest to the next run", async () => {
    const templateId = await createTemplate({ frequency: "DAILY", startDate: "2020-01-01" });

    // Far enough ahead that the daily backlog exceeds the safety bound.
    await processor.processDueRecurringTransactions(asOf("2026-01-01"));

    const afterFirstRun = await generatedFor(templateId);
    expect(afterFirstRun).toHaveLength(MAX_CATCH_UP_ITERATIONS);
    // 2020 is a leap year: 366 days lands the cursor on 2021-01-01.
    const template = await templateById(templateId);
    expect(template.nextExecutionDate.toISOString().slice(0, 10)).toBe("2021-01-01");

    // The backlog is carried, not dropped: the next run keeps going.
    await processor.processDueRecurringTransactions(asOf("2026-01-01"));
    expect((await generatedFor(templateId)).length).toBe(MAX_CATCH_UP_ITERATIONS * 2);
  });

  it("detaches generated transactions instead of destroying them when the template is deleted", async () => {
    const templateId = await createTemplate({ startDate: "2026-09-09" });
    await processor.processDueRecurringTransactions(asOf("2026-09-09"));

    const [generated] = await generatedFor(templateId);
    expect(generated).toBeDefined();

    const del = await request(app.server).delete(`/recurring-transactions/${templateId}`).set(auth);
    expect(del.status).toBe(204);

    const orphan = await app.prisma.transaction.findUniqueOrThrow({
      where: { id: generated!.id },
    });
    expect(orphan.recurringTransactionId).toBeNull();
    expect(Number(orphan.amount)).toBe(10);
  });
});
