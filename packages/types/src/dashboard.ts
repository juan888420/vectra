import { z } from "zod";

import { budgetPublicSchema } from "./budgets.js";
import { periodTotalsSchema } from "./money.js";

// Hand-mirrored from apps/api/src/features/dashboard/dashboard.schemas.ts.
// `date` is a string, not the backend's own `z.date()`, for the same reason
// as transactions.ts (JSON never produces Dates).

export const accountBalanceSchema = z.object({
  accountId: z.uuid(),
  name: z.string(),
  currency: z.string().length(3),
  income: z.number(),
  expenses: z.number(),
  balance: z.number(),
});

export type AccountBalance = z.infer<typeof accountBalanceSchema>;

export const categorySpendingSchema = z.object({
  categoryId: z.uuid(),
  categoryName: z.string(),
  amount: z.number(),
  percentage: z.number(),
  // Deterministic per-category color (hsl(...)) computed by the backend
  // (apps/api/src/lib/chart-color.ts) — consumed as-is, never regenerated or
  // theme-adjusted on the frontend, so it stays stable across reloads.
  color: z.string(),
});

export type CategorySpending = z.infer<typeof categorySpendingSchema>;

export const topExpenseSchema = z.object({
  id: z.uuid(),
  accountId: z.uuid(),
  categoryId: z.uuid(),
  amount: z.number(),
  date: z.string(),
  note: z.string().nullable(),
});

export type TopExpense = z.infer<typeof topExpenseSchema>;

export const monthComparisonSchema = z.object({
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

export type MonthComparison = z.infer<typeof monthComparisonSchema>;

export const financialHealthStatusSchema = z.enum(["GOOD", "WARNING", "CRITICAL"]);

export type FinancialHealthStatus = z.infer<typeof financialHealthStatusSchema>;

export const financialHealthSchema = z.object({
  score: z.number().int().min(0).max(100),
  status: financialHealthStatusSchema,
});

export type FinancialHealth = z.infer<typeof financialHealthSchema>;

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

export type DashboardSummary = z.infer<typeof dashboardSummarySchema>;
