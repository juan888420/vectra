import { toMonthlyEquivalent, toProjection } from "@vectra/utils";

import { conflict } from "../../lib/http-errors.js";
import { findOwnedOrFail } from "../../lib/ownership.js";
import { buildMeta, toSkipTake, type PageMeta } from "../../lib/pagination.js";
import type { Income, PrismaClient } from "../../generated/prisma/client.js";
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

export async function updateIncome(
  prisma: PrismaClient,
  userId: string,
  id: string,
  input: UpdateIncomeBody,
): Promise<PublicIncome> {
  const existing = await findOwnedOrFail(prisma.income, id, userId, "Income");

  if (input.name) {
    await assertNameAvailable(prisma, userId, input.name, id);
  }

  return toPublic(await prisma.income.update({ where: { id: existing.id }, data: input }));
}

export async function archiveIncome(
  prisma: PrismaClient,
  userId: string,
  id: string,
): Promise<PublicIncome> {
  const income = await findOwnedOrFail(prisma.income, id, userId, "Income");

  if (income.archivedAt) {
    return toPublic(income);
  }

  return toPublic(await prisma.income.update({ where: { id }, data: { archivedAt: new Date() } }));
}

export async function unarchiveIncome(
  prisma: PrismaClient,
  userId: string,
  id: string,
): Promise<PublicIncome> {
  const income = await findOwnedOrFail(prisma.income, id, userId, "Income");

  if (!income.archivedAt) {
    return toPublic(income);
  }

  await assertNameAvailable(prisma, userId, income.name, id);

  return toPublic(await prisma.income.update({ where: { id }, data: { archivedAt: null } }));
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
export async function getIncomeSummary(prisma: PrismaClient, userId: string, id: string) {
  const income = await findOwnedOrFail(prisma.income, id, userId, "Income");

  const totals =
    income.frequency === "ONE_TIME"
      ? null
      : toProjection(toMonthlyEquivalent(Number(income.amount), income.frequency));

  return { income: toPublic(income), totals };
}
