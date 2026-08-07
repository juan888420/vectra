import { toMonthlyEquivalent, toProjection } from "@vectra/utils";

import { conflict } from "../../lib/http-errors.js";
import { findOwnedOrFail } from "../../lib/ownership.js";
import { buildMeta, toSkipTake, type PageMeta } from "../../lib/pagination.js";
import type { Income, PrismaClient } from "../../generated/prisma/client.js";
import { reconcileIncomeScenarios } from "../scenarios/scenarios.service.js";
import type { ScenarioImpact } from "../scenarios/scenarios.service.js";
import type { CreateIncomeBody, ListIncomesQuery, UpdateIncomeBody } from "./incomes.schemas.js";

type PublicIncome = Omit<Income, "amount"> & { amount: number };

function toPublic(income: Income): PublicIncome {
  return { ...income, amount: Number(income.amount) };
}

// Same reuse rule as ExpenseItem: one active "Sueldo" per user, so linking a
// scenario to an income is never ambiguous. Archived names are free to reuse.
async function assertNameAvailable(
  prisma: PrismaClient,
  userId: string,
  name: string,
  excludeId?: string,
): Promise<void> {
  const duplicate = await prisma.income.findFirst({
    where: {
      userId,
      archivedAt: null,
      name: { equals: name, mode: "insensitive" },
      ...(excludeId && { id: { not: excludeId } }),
    },
  });
  if (duplicate) {
    throw conflict(`An active income named "${name}" already exists`);
  }
}

export async function listIncomes(
  prisma: PrismaClient,
  userId: string,
  query: ListIncomesQuery,
): Promise<{ data: PublicIncome[]; meta: PageMeta }> {
  const where = {
    userId,
    ...(query.frequency && { frequency: query.frequency }),
    ...(query.includeArchived ? {} : { archivedAt: null }),
  };

  const [totalItems, incomes] = await prisma.$transaction([
    prisma.income.count({ where }),
    prisma.income.findMany({
      where,
      orderBy: { [query.sortBy]: query.sortOrder },
      ...toSkipTake(query),
    }),
  ]);

  return { data: incomes.map(toPublic), meta: buildMeta(query, totalItems) };
}

export async function getIncome(
  prisma: PrismaClient,
  userId: string,
  id: string,
): Promise<PublicIncome> {
  return toPublic(await findOwnedOrFail(prisma.income, id, userId, "Income"));
}

export async function createIncome(
  prisma: PrismaClient,
  userId: string,
  input: CreateIncomeBody,
): Promise<PublicIncome> {
  await assertNameAvailable(prisma, userId, input.name);

  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });

  const income = await prisma.income.create({
    data: { ...input, userId, currency: user.defaultCurrency },
  });

  return toPublic(income);
}

export type IncomeMutationResult = ScenarioImpact & { data: PublicIncome };

// See expense-items.service.ts's finalizeExpenseItemWrite — same save-
// always-report-impact contract (RFC-0023.3).
async function finalizeIncomeWrite(
  prisma: PrismaClient,
  income: Income,
): Promise<IncomeMutationResult> {
  const impact = await reconcileIncomeScenarios(prisma, income);
  return { data: toPublic(income), ...impact };
}

export async function updateIncome(
  prisma: PrismaClient,
  userId: string,
  id: string,
  input: UpdateIncomeBody,
): Promise<IncomeMutationResult> {
  const existing = await findOwnedOrFail(prisma.income, id, userId, "Income");

  if (input.name) {
    await assertNameAvailable(prisma, userId, input.name, id);
  }

  const income = await prisma.income.update({ where: { id: existing.id }, data: input });
  return finalizeIncomeWrite(prisma, income);
}

export async function archiveIncome(
  prisma: PrismaClient,
  userId: string,
  id: string,
): Promise<IncomeMutationResult> {
  const income = await findOwnedOrFail(prisma.income, id, userId, "Income");

  if (income.archivedAt) {
    return finalizeIncomeWrite(prisma, income);
  }

  const archived = await prisma.income.update({
    where: { id },
    data: { archivedAt: new Date() },
  });
  return finalizeIncomeWrite(prisma, archived);
}

export async function unarchiveIncome(
  prisma: PrismaClient,
  userId: string,
  id: string,
): Promise<IncomeMutationResult> {
  const income = await findOwnedOrFail(prisma.income, id, userId, "Income");

  if (!income.archivedAt) {
    return finalizeIncomeWrite(prisma, income);
  }

  await assertNameAvailable(prisma, userId, income.name, id);

  const restored = await prisma.income.update({ where: { id }, data: { archivedAt: null } });
  return finalizeIncomeWrite(prisma, restored);
}

// Incomes referenced by a scenario are archived, never deleted (business
// rule 3, mirroring deleteExpenseItem) — a ScenarioIncome snapshot still
// points at this row.
export async function deleteIncome(
  prisma: PrismaClient,
  userId: string,
  id: string,
): Promise<void> {
  await findOwnedOrFail(prisma.income, id, userId, "Income");

  const counts = await prisma.income.findUniqueOrThrow({
    where: { id },
    select: { _count: { select: { scenarioIncomes: true } } },
  });
  if (counts._count.scenarioIncomes > 0) {
    throw conflict("Income is referenced by a scenario; archive it instead");
  }

  await prisma.income.delete({ where: { id } });
}

// "¿Cuánto dinero genera este ingreso?" (ADR-0006) — derived, never stored.
// The scenario list answers "en qué escenarios se usa": ScenarioIncome isn't
// queryable client-side, same reasoning as getExpenseItemSummary.
export async function getIncomeSummary(prisma: PrismaClient, userId: string, id: string) {
  const income = await findOwnedOrFail(prisma.income, id, userId, "Income");

  const scenarioIncomes = await prisma.scenarioIncome.findMany({
    where: { incomeId: id, scenario: { userId } },
    include: { scenario: true },
    orderBy: { scenario: { name: "asc" } },
  });

  const totals =
    income.frequency === "ONE_TIME"
      ? null
      : toProjection(toMonthlyEquivalent(Number(income.amount), income.frequency));

  return {
    income: toPublic(income),
    totals,
    scenarios: scenarioIncomes.map((scenarioIncome) => ({
      id: scenarioIncome.scenario.id,
      name: scenarioIncome.scenario.name,
      status: scenarioIncome.scenario.status,
    })),
  };
}
