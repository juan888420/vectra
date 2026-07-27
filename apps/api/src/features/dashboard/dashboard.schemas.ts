import { z } from "zod";

import { periodTotalsSchema } from "../../lib/schemas.js";
import { budgetPublicSchema } from "../budgets/budgets.schemas.js";

const accountBalanceSchema = z.object({
  accountId: z.uuid(),
  name: z.string(),
  currency: z.string().length(3),
  income: z.number(),
  expenses: z.number(),
  balance: z.number(),
});

const categorySpendingSchema = z.object({
  categoryId: z.uuid(),
  categoryName: z.string(),
  amount: z.number(),
  percentage: z.number(),
  // Deterministic per-category color (HSL string), stable across requests,
  // so a Recharts legend/pie doesn't reshuffle colors between renders.
  color: z.string(),
});

const topExpenseSchema = z.object({
  id: z.uuid(),
  accountId: z.uuid(),
  categoryId: z.uuid(),
  amount: z.number(),
  date: z.date(),
  note: z.string().nullable(),
});

const monthComparisonSchema = z.object({
  current: periodTotalsSchema,
  previous: periodTotalsSchema,
  // null when the previous period's value was 0: a percentage change from
  // zero is undefined, not Infinity/NaN.
  changePercent: z.object({
    income: z.number().nullable(),
    expenses: z.number().nullable(),
    balance: z.number().nullable(),
  }),
});

export const financialHealthStatusSchema = z.enum(["GOOD", "WARNING", "CRITICAL"]);

const financialHealthSchema = z.object({
  score: z.number().int().min(0).max(100),
  status: financialHealthStatusSchema,
});

export const dashboardSummarySchema = z.object({
  totalBalance: periodTotalsSchema,
  accountBalances: z.array(accountBalanceSchema),
  currentMonthSummary: periodTotalsSchema,
  spendingByCategory: z.array(categorySpendingSchema),
  topExpenses: z.array(topExpenseSchema),
  budgets: z.array(budgetPublicSchema),
  monthComparison: monthComparisonSchema,
  financialHealth: financialHealthSchema,
});
