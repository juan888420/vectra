import { badRequest, conflict } from "../../lib/http-errors.js";
import { findOwnedOrFail } from "../../lib/ownership.js";
import { buildMeta, toSkipTake, type PageMeta } from "../../lib/pagination.js";
import type { Budget, BudgetPeriod, PrismaClient } from "../../generated/prisma/client.js";
import type { CreateBudgetBody, ListBudgetsQuery, UpdateBudgetBody } from "./budgets.schemas.js";

// Fraction of the budget's amount at which a budget moves from ON_TRACK to
// WARNING. Domain constant so it's easy to make configurable later (e.g.
// per-user) without hunting through the calculation logic.
export const BUDGET_WARNING_THRESHOLD = 0.8;

type BudgetStatus = "ON_TRACK" | "WARNING" | "EXCEEDED";

interface BudgetProgress {
  spent: number;
  remaining: number;
  percentUsed: number;
  status: BudgetStatus;
}

type PublicBudget = Omit<Budget, "amount"> & { amount: number } & BudgetProgress;

function computeStatus(percentUsed: number): BudgetStatus {
  if (percentUsed >= 100) return "EXCEEDED";
  if (percentUsed >= BUDGET_WARNING_THRESHOLD * 100) return "WARNING";
  return "ON_TRACK";
}

function withProgress(budget: Budget, spentRaw: number): PublicBudget {
  const amount = Number(budget.amount);
  const spent = Math.round(spentRaw * 100) / 100;
  const remaining = Math.round((amount - spent) * 100) / 100;
  const percentUsed = Math.round((spent / amount) * 100);

  return { ...budget, amount, spent, remaining, percentUsed, status: computeStatus(percentUsed) };
}

// The MVP only has BudgetPeriod.MONTHLY; the switch stays exhaustive so
// adding WEEKLY/CUSTOM later (RFC-0006 §6) fails to compile here until handled.
function getCurrentPeriodRange(period: BudgetPeriod): { start: Date; end: Date } {
  switch (period) {
    case "MONTHLY": {
      const now = new Date();
      const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
      const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
      return { start, end };
    }
  }
}

async function sumSpent(
  prisma: PrismaClient,
  userId: string,
  categoryId: string,
  period: BudgetPeriod,
): Promise<number> {
  const { start, end } = getCurrentPeriodRange(period);
  const result = await prisma.transaction.aggregate({
    where: {
      categoryId,
      type: "EXPENSE",
      date: { gte: start, lt: end },
      account: { userId },
    },
    _sum: { amount: true },
  });
  return Number(result._sum.amount ?? 0);
}

async function assertCategoryAvailableForBudget(
  prisma: PrismaClient,
  userId: string,
  categoryId: string,
): Promise<void> {
  const category = await prisma.category.findFirst({ where: { id: categoryId, userId } });
  if (!category) {
    throw badRequest("Category not found");
  }
  if (category.archivedAt) {
    throw badRequest("Cannot use an archived category");
  }
  // A Budget is a spending limit (RFC-0006 §2): only EXPENSE categories can
  // have one.
  if (category.type !== "EXPENSE") {
    throw badRequest("Budgets can only be created for expense categories");
  }
}

async function assertNoActiveBudget(
  prisma: PrismaClient,
  userId: string,
  categoryId: string,
  period: BudgetPeriod,
  excludeId?: string,
): Promise<void> {
  // Uniqueness of the active budget per user+category+period is enforced
  // here rather than via a DB constraint (partial unique index deferred, see
  // ADR-0002 and the `archivedAt` comment on the Budget model).
  const duplicate = await prisma.budget.findFirst({
    where: {
      userId,
      categoryId,
      period,
      archivedAt: null,
      ...(excludeId && { id: { not: excludeId } }),
    },
  });
  if (duplicate) {
    throw conflict("An active budget already exists for this category and period");
  }
}

export async function listBudgets(
  prisma: PrismaClient,
  userId: string,
  query: ListBudgetsQuery,
): Promise<{ data: PublicBudget[]; meta: PageMeta }> {
  const where = {
    userId,
    ...(query.categoryId && { categoryId: query.categoryId }),
    ...(query.includeArchived ? {} : { archivedAt: null }),
  };

  const [totalItems, budgets] = await prisma.$transaction([
    prisma.budget.count({ where }),
    prisma.budget.findMany({
      where,
      orderBy: { [query.sortBy]: query.sortOrder },
      ...toSkipTake(query),
    }),
  ]);

  // All budgets share BudgetPeriod.MONTHLY today, so one range covers the
  // whole page; a single groupBy avoids N+1 aggregate queries.
  const spentByCategory = new Map<string, number>();
  if (budgets.length > 0) {
    const { start, end } = getCurrentPeriodRange(budgets[0]!.period);
    const sums = await prisma.transaction.groupBy({
      by: ["categoryId"],
      where: {
        categoryId: { in: budgets.map((budget) => budget.categoryId) },
        type: "EXPENSE",
        date: { gte: start, lt: end },
        account: { userId },
      },
      _sum: { amount: true },
    });
    for (const sum of sums) {
      spentByCategory.set(sum.categoryId, Number(sum._sum.amount ?? 0));
    }
  }

  const data = budgets.map((budget) =>
    withProgress(budget, spentByCategory.get(budget.categoryId) ?? 0),
  );

  return { data, meta: buildMeta(query, totalItems) };
}

export async function getBudget(
  prisma: PrismaClient,
  userId: string,
  id: string,
): Promise<PublicBudget> {
  const budget = await findOwnedOrFail(prisma.budget, id, userId, "Budget");
  const spent = await sumSpent(prisma, userId, budget.categoryId, budget.period);
  return withProgress(budget, spent);
}

export async function createBudget(
  prisma: PrismaClient,
  userId: string,
  input: CreateBudgetBody,
): Promise<PublicBudget> {
  await assertCategoryAvailableForBudget(prisma, userId, input.categoryId);
  await assertNoActiveBudget(prisma, userId, input.categoryId, input.period);

  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });

  const budget = await prisma.budget.create({
    data: {
      userId,
      categoryId: input.categoryId,
      amount: input.amount,
      currency: user.defaultCurrency,
      period: input.period,
    },
  });

  return withProgress(budget, 0);
}

export async function updateBudget(
  prisma: PrismaClient,
  userId: string,
  id: string,
  input: UpdateBudgetBody,
): Promise<PublicBudget> {
  const existing = await findOwnedOrFail(prisma.budget, id, userId, "Budget");
  const budget = await prisma.budget.update({ where: { id: existing.id }, data: input });
  const spent = await sumSpent(prisma, userId, budget.categoryId, budget.period);
  return withProgress(budget, spent);
}

export async function archiveBudget(
  prisma: PrismaClient,
  userId: string,
  id: string,
): Promise<PublicBudget> {
  const budget = await findOwnedOrFail(prisma.budget, id, userId, "Budget");

  const archived = budget.archivedAt
    ? budget
    : await prisma.budget.update({ where: { id }, data: { archivedAt: new Date() } });

  const spent = await sumSpent(prisma, userId, archived.categoryId, archived.period);
  return withProgress(archived, spent);
}

export async function unarchiveBudget(
  prisma: PrismaClient,
  userId: string,
  id: string,
): Promise<PublicBudget> {
  const budget = await findOwnedOrFail(prisma.budget, id, userId, "Budget");

  if (!budget.archivedAt) {
    const spent = await sumSpent(prisma, userId, budget.categoryId, budget.period);
    return withProgress(budget, spent);
  }

  await assertNoActiveBudget(prisma, userId, budget.categoryId, budget.period, id);

  const unarchived = await prisma.budget.update({ where: { id }, data: { archivedAt: null } });
  const spent = await sumSpent(prisma, userId, unarchived.categoryId, unarchived.period);
  return withProgress(unarchived, spent);
}

// Nothing references a Budget as a foreign key, so unlike Account/Category
// (business rule 3) there is no "archive instead" restriction to enforce.
export async function deleteBudget(
  prisma: PrismaClient,
  userId: string,
  id: string,
): Promise<void> {
  await findOwnedOrFail(prisma.budget, id, userId, "Budget");
  await prisma.budget.delete({ where: { id } });
}
