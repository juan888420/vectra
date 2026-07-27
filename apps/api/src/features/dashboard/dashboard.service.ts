import { getActiveBudgetsSummary } from "../budgets/budgets.service.js";
import { chartColor } from "../../lib/chart-color.js";
import { getMonthRange } from "../../lib/date-range.js";
import { clamp, percentChange, round2 } from "../../lib/finance-math.js";
import type { PrismaClient, TransactionType } from "../../generated/prisma/client.js";

interface PeriodTotals {
  income: number;
  expenses: number;
  balance: number;
}

type BudgetStatus = "ON_TRACK" | "WARNING" | "EXCEEDED";

function toTotals(sums: { income: number; expenses: number }): PeriodTotals {
  return {
    income: round2(sums.income),
    expenses: round2(sums.expenses),
    balance: round2(sums.income - sums.expenses),
  };
}

async function sumByType(
  prisma: PrismaClient,
  userId: string,
  range?: { start: Date; end: Date },
): Promise<{ income: number; expenses: number }> {
  const sums = await prisma.transaction.groupBy({
    by: ["type"],
    where: {
      account: { userId },
      ...(range && { date: { gte: range.start, lt: range.end } }),
    },
    _sum: { amount: true },
  });

  const byType = new Map<TransactionType, number>(
    sums.map((sum) => [sum.type, Number(sum._sum.amount ?? 0)]),
  );
  return { income: byType.get("INCOME") ?? 0, expenses: byType.get("EXPENSE") ?? 0 };
}

async function getAccountBalances(prisma: PrismaClient, userId: string) {
  const accounts = await prisma.account.findMany({ where: { userId }, orderBy: { name: "asc" } });
  if (accounts.length === 0) {
    return [];
  }

  const sums = await prisma.transaction.groupBy({
    by: ["accountId", "type"],
    where: { accountId: { in: accounts.map((account) => account.id) } },
    _sum: { amount: true },
  });

  const byAccount = new Map<string, { income: number; expenses: number }>();
  for (const sum of sums) {
    const entry = byAccount.get(sum.accountId) ?? { income: 0, expenses: 0 };
    if (sum.type === "INCOME") {
      entry.income = Number(sum._sum.amount ?? 0);
    } else {
      entry.expenses = Number(sum._sum.amount ?? 0);
    }
    byAccount.set(sum.accountId, entry);
  }

  return accounts.map((account) => ({
    accountId: account.id,
    name: account.name,
    currency: account.currency,
    ...toTotals(byAccount.get(account.id) ?? { income: 0, expenses: 0 }),
  }));
}

async function getSpendingByCategory(
  prisma: PrismaClient,
  userId: string,
  range: { start: Date; end: Date },
) {
  const sums = await prisma.transaction.groupBy({
    by: ["categoryId"],
    where: { account: { userId }, type: "EXPENSE", date: { gte: range.start, lt: range.end } },
    _sum: { amount: true },
  });
  if (sums.length === 0) {
    return [];
  }

  const categories = await prisma.category.findMany({
    where: { id: { in: sums.map((sum) => sum.categoryId) } },
  });
  const categoryById = new Map(categories.map((category) => [category.id, category]));
  const totalExpenses = sums.reduce((total, sum) => total + Number(sum._sum.amount ?? 0), 0);

  return sums
    .map((sum) => {
      const amount = round2(Number(sum._sum.amount ?? 0));
      return {
        categoryId: sum.categoryId,
        categoryName: categoryById.get(sum.categoryId)?.name ?? "Unknown",
        amount,
        percentage: totalExpenses > 0 ? Math.round((amount / totalExpenses) * 1000) / 10 : 0,
        color: chartColor(sum.categoryId),
      };
    })
    .sort((a, b) => b.amount - a.amount);
}

async function getTopExpenses(
  prisma: PrismaClient,
  userId: string,
  range: { start: Date; end: Date },
) {
  const transactions = await prisma.transaction.findMany({
    where: { account: { userId }, type: "EXPENSE", date: { gte: range.start, lt: range.end } },
    orderBy: [{ amount: "desc" }, { date: "desc" }],
    take: 5,
  });

  return transactions.map((transaction) => ({
    id: transaction.id,
    accountId: transaction.accountId,
    categoryId: transaction.categoryId,
    amount: Number(transaction.amount),
    date: transaction.date,
    note: transaction.note,
  }));
}

// financialHealth is a heuristic, not a specified formula (the RFC only
// asked for a 0-100 score + status): weighted blend of this month's savings
// rate, active-budget adherence, and whether the month is net positive.
// Weights/thresholds are named constants so they're easy to retune later.
export const FINANCIAL_HEALTH_WEIGHTS = {
  savingsRate: 0.4,
  budgetAdherence: 0.4,
  monthBalance: 0.2,
} as const;

export const FINANCIAL_HEALTH_THRESHOLDS = {
  good: 70,
  warning: 40,
} as const;

function computeSavingsRateScore(income: number, expenses: number): number {
  if (income <= 0) {
    // No income to measure a rate against: neutral if there's also no
    // spending, otherwise every dollar spent is unbacked.
    return expenses > 0 ? 0 : 50;
  }
  const savingsRate = (income - expenses) / income;
  // +20% savings or better -> 100, break-even -> 50, -20% or worse -> 0.
  return clamp(50 + savingsRate * 250, 0, 100);
}

function computeBudgetAdherenceScore(budgets: Array<{ status: BudgetStatus }>): number {
  if (budgets.length === 0) {
    // No budgets configured: no over-spending signal either way.
    return 70;
  }
  const points = budgets.reduce((sum, budget) => {
    if (budget.status === "EXCEEDED") return sum;
    if (budget.status === "WARNING") return sum + 50;
    return sum + 100;
  }, 0);
  return points / budgets.length;
}

function computeMonthBalanceScore(balance: number): number {
  if (balance > 0) return 100;
  if (balance === 0) return 50;
  return 0;
}

function computeFinancialHealth(
  currentMonthSummary: PeriodTotals,
  budgets: Array<{ status: BudgetStatus }>,
): { score: number; status: "GOOD" | "WARNING" | "CRITICAL" } {
  const savingsScore = computeSavingsRateScore(
    currentMonthSummary.income,
    currentMonthSummary.expenses,
  );
  const budgetScore = computeBudgetAdherenceScore(budgets);
  const balanceScore = computeMonthBalanceScore(currentMonthSummary.balance);

  const score = Math.round(
    savingsScore * FINANCIAL_HEALTH_WEIGHTS.savingsRate +
      budgetScore * FINANCIAL_HEALTH_WEIGHTS.budgetAdherence +
      balanceScore * FINANCIAL_HEALTH_WEIGHTS.monthBalance,
  );

  const status =
    score >= FINANCIAL_HEALTH_THRESHOLDS.good
      ? "GOOD"
      : score >= FINANCIAL_HEALTH_THRESHOLDS.warning
        ? "WARNING"
        : "CRITICAL";

  return { score, status };
}

export async function getDashboardSummary(prisma: PrismaClient, userId: string) {
  const currentRange = getMonthRange(0);
  const previousRange = getMonthRange(-1);

  const [
    totalBalanceRaw,
    accountBalances,
    currentMonthRaw,
    spendingByCategory,
    topExpenses,
    budgets,
    previousMonthRaw,
  ] = await Promise.all([
    sumByType(prisma, userId),
    getAccountBalances(prisma, userId),
    sumByType(prisma, userId, currentRange),
    getSpendingByCategory(prisma, userId, currentRange),
    getTopExpenses(prisma, userId, currentRange),
    getActiveBudgetsSummary(prisma, userId),
    sumByType(prisma, userId, previousRange),
  ]);

  const currentMonthSummary = toTotals(currentMonthRaw);
  const previousMonthSummary = toTotals(previousMonthRaw);

  return {
    totalBalance: toTotals(totalBalanceRaw),
    accountBalances,
    currentMonthSummary,
    spendingByCategory,
    topExpenses,
    budgets,
    monthComparison: {
      current: currentMonthSummary,
      previous: previousMonthSummary,
      changePercent: {
        income: percentChange(currentMonthSummary.income, previousMonthSummary.income),
        expenses: percentChange(currentMonthSummary.expenses, previousMonthSummary.expenses),
        balance: percentChange(currentMonthSummary.balance, previousMonthSummary.balance),
      },
    },
    financialHealth: computeFinancialHealth(currentMonthSummary, budgets),
  };
}
