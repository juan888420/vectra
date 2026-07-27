import { chartColor } from "../../lib/chart-color.js";
import { percentChange, round2 } from "../../lib/finance-math.js";
import { badRequest } from "../../lib/http-errors.js";
import {
  buildBuckets,
  bucketIndexFor,
  toIsoDate,
  type ReportBucket,
  type ReportGroupBy,
} from "../../lib/report-buckets.js";
import type { Prisma, PrismaClient } from "../../generated/prisma/client.js";
import type {
  AccountStatsQuery,
  CashFlowQuery,
  CategoryTrendsQuery,
  PeriodComparisonQuery,
} from "./reports.schemas.js";

interface PeriodTotals {
  income: number;
  expenses: number;
  balance: number;
}

function bucketsOrFail(
  from: string,
  to: string,
  groupBy: ReportGroupBy,
  weekStartsOn: number,
): ReportBucket[] {
  try {
    return buildBuckets(new Date(from), new Date(to), groupBy, weekStartsOn);
  } catch (error) {
    if (error instanceof RangeError) {
      throw badRequest(error.message);
    }
    throw error;
  }
}

// The user's preferred first day of week only matters for `week` grouping;
// every other grouping skips the extra query.
async function resolveWeekStart(
  prisma: PrismaClient,
  userId: string,
  groupBy: ReportGroupBy,
): Promise<number> {
  if (groupBy !== "week") {
    return 1;
  }
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { weekStartsOn: true },
  });
  return user.weekStartsOn;
}

function rangeWhere(
  userId: string,
  from: string,
  to: string,
  accountId?: string,
): Prisma.TransactionWhereInput {
  return {
    account: { userId },
    ...(accountId && { accountId }),
    date: { gte: new Date(from), lte: new Date(to) },
  };
}

export async function getCashFlow(prisma: PrismaClient, userId: string, query: CashFlowQuery) {
  const weekStartsOn = await resolveWeekStart(prisma, userId, query.groupBy);
  const buckets = bucketsOrFail(query.dateFrom, query.dateTo, query.groupBy, weekStartsOn);

  // One row per (day, type) instead of raw transactions: the payload from the
  // database stays bounded by the range length, not the transaction count.
  const sums = await prisma.transaction.groupBy({
    by: ["date", "type"],
    where: rangeWhere(userId, query.dateFrom, query.dateTo, query.accountId),
    _sum: { amount: true },
  });

  const totals = buckets.map(() => ({ income: 0, expenses: 0 }));
  for (const sum of sums) {
    const index = bucketIndexFor(buckets, sum.date);
    if (index === -1) continue;
    const amount = Number(sum._sum.amount ?? 0);
    if (sum.type === "INCOME") {
      totals[index]!.income += amount;
    } else {
      totals[index]!.expenses += amount;
    }
  }

  let cumulative = 0;
  const data = buckets.map((bucket, index) => {
    const income = round2(totals[index]!.income);
    const expenses = round2(totals[index]!.expenses);
    const balance = round2(income - expenses);
    cumulative = round2(cumulative + balance);
    return {
      periodStart: toIsoDate(bucket.start),
      periodEnd: toIsoDate(bucket.end),
      income,
      expenses,
      balance,
      cumulativeBalance: cumulative,
    };
  });

  return { groupBy: query.groupBy, data };
}

export async function getCategoryTrends(
  prisma: PrismaClient,
  userId: string,
  query: CategoryTrendsQuery,
) {
  const weekStartsOn = await resolveWeekStart(prisma, userId, query.groupBy);
  const buckets = bucketsOrFail(query.dateFrom, query.dateTo, query.groupBy, weekStartsOn);

  const sums = await prisma.transaction.groupBy({
    by: ["date", "categoryId"],
    where: {
      ...rangeWhere(userId, query.dateFrom, query.dateTo, query.accountId),
      type: "EXPENSE",
      ...(query.categoryId && { categoryId: query.categoryId }),
    },
    _sum: { amount: true },
  });

  const perBucket = buckets.map(() => new Map<string, number>());
  const totalByCategory = new Map<string, number>();
  for (const sum of sums) {
    const index = bucketIndexFor(buckets, sum.date);
    if (index === -1) continue;
    const amount = Number(sum._sum.amount ?? 0);
    const bucketMap = perBucket[index]!;
    bucketMap.set(sum.categoryId, (bucketMap.get(sum.categoryId) ?? 0) + amount);
    totalByCategory.set(sum.categoryId, (totalByCategory.get(sum.categoryId) ?? 0) + amount);
  }

  const categories = await prisma.category.findMany({
    where: { id: { in: [...totalByCategory.keys()] } },
  });
  const nameById = new Map(categories.map((category) => [category.id, category.name]));

  // Legend ordered by total spend descending: stacked charts read best with
  // the biggest series first.
  const legend = [...totalByCategory.entries()]
    .sort(([, a], [, b]) => b - a)
    .map(([categoryId]) => ({
      categoryId,
      categoryName: nameById.get(categoryId) ?? "Unknown",
      color: chartColor(categoryId),
    }));

  // The wide row type ({periodStart/periodEnd: string} & Record<string, number>)
  // cannot be constructed without a cast: TS rejects string props alongside a
  // number index signature. The cast is safe — dynamic keys are UUIDs, which
  // can never collide with the two fixed keys — and the integration test locks
  // the serialized shape end-to-end.
  type CategoryTrendPoint = { periodStart: string; periodEnd: string } & Record<string, number>;

  const data = buckets.map((bucket, index) => {
    const point: Record<string, string | number> = {
      periodStart: toIsoDate(bucket.start),
      periodEnd: toIsoDate(bucket.end),
    };
    for (const [categoryId, amount] of perBucket[index]!) {
      point[categoryId] = round2(amount);
    }
    return point as CategoryTrendPoint;
  });

  return { groupBy: query.groupBy, legend, data };
}

export async function getAccountStats(
  prisma: PrismaClient,
  userId: string,
  query: AccountStatsQuery,
) {
  // Accounts with no activity in the range still appear (zeroed): a stats
  // table that silently drops rows reads as a bug, not an insight.
  const accounts = await prisma.account.findMany({
    where: { userId, ...(query.accountId && { id: query.accountId }) },
    orderBy: { name: "asc" },
  });
  if (accounts.length === 0) {
    return { data: [] };
  }

  const sums = await prisma.transaction.groupBy({
    by: ["accountId", "type"],
    where: {
      accountId: { in: accounts.map((account) => account.id) },
      date: { gte: new Date(query.dateFrom), lte: new Date(query.dateTo) },
    },
    _sum: { amount: true },
    _count: { _all: true },
    _avg: { amount: true },
    _max: { amount: true },
  });

  interface FlowStats {
    total: number;
    count: number;
    average: number;
    largest: number;
  }
  const emptyFlow: FlowStats = { total: 0, count: 0, average: 0, largest: 0 };
  const byAccount = new Map<string, { income: FlowStats; expense: FlowStats }>();
  for (const sum of sums) {
    const entry = byAccount.get(sum.accountId) ?? { income: emptyFlow, expense: emptyFlow };
    const flow: FlowStats = {
      total: Number(sum._sum.amount ?? 0),
      count: sum._count._all,
      average: Number(sum._avg.amount ?? 0),
      largest: Number(sum._max.amount ?? 0),
    };
    if (sum.type === "INCOME") {
      entry.income = flow;
    } else {
      entry.expense = flow;
    }
    byAccount.set(sum.accountId, entry);
  }

  const data = accounts.map((account) => {
    const { income, expense } = byAccount.get(account.id) ?? {
      income: emptyFlow,
      expense: emptyFlow,
    };
    return {
      accountId: account.id,
      name: account.name,
      currency: account.currency,
      transactionCount: income.count + expense.count,
      income: round2(income.total),
      expenses: round2(expense.total),
      netChange: round2(income.total - expense.total),
      averageIncome: round2(income.average),
      averageExpense: round2(expense.average),
      largestIncome: round2(income.largest),
      largestExpense: round2(expense.largest),
    };
  });

  return { data };
}

async function periodTotals(
  prisma: PrismaClient,
  userId: string,
  from: string,
  to: string,
  accountId?: string,
): Promise<PeriodTotals> {
  const sums = await prisma.transaction.groupBy({
    by: ["type"],
    where: rangeWhere(userId, from, to, accountId),
    _sum: { amount: true },
  });

  let income = 0;
  let expenses = 0;
  for (const sum of sums) {
    if (sum.type === "INCOME") {
      income = Number(sum._sum.amount ?? 0);
    } else {
      expenses = Number(sum._sum.amount ?? 0);
    }
  }

  return { income: round2(income), expenses: round2(expenses), balance: round2(income - expenses) };
}

export async function getPeriodComparison(
  prisma: PrismaClient,
  userId: string,
  query: PeriodComparisonQuery,
) {
  const [current, previous] = await Promise.all([
    periodTotals(prisma, userId, query.currentFrom, query.currentTo, query.accountId),
    periodTotals(prisma, userId, query.previousFrom, query.previousTo, query.accountId),
  ]);

  return {
    current,
    previous,
    changeAmount: {
      income: round2(current.income - previous.income),
      expenses: round2(current.expenses - previous.expenses),
      balance: round2(current.balance - previous.balance),
    },
    changePercent: {
      income: percentChange(current.income, previous.income),
      expenses: percentChange(current.expenses, previous.expenses),
      balance: percentChange(current.balance, previous.balance),
    },
  };
}
