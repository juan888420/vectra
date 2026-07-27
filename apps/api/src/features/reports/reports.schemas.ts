import { z } from "zod";

import { periodTotalsSchema } from "../../lib/schemas.js";

// Every report is read-only and computed on demand from Transaction (business
// rule 7 extended to analytics: no aggregate is ever persisted). Responses are
// shaped for Recharts: flat arrays of points with ISO date bounds ready to be
// used as axis labels/keys.

export const reportGroupBySchema = z.enum(["day", "week", "month", "year"]);

const dateRangeFields = {
  dateFrom: z.iso.date(),
  dateTo: z.iso.date(),
};

const dateRangeRule = { message: "dateFrom must be before or equal to dateTo", path: ["dateFrom"] };

export const cashFlowQuerySchema = z
  .object({
    ...dateRangeFields,
    groupBy: reportGroupBySchema.default("month"),
    accountId: z.uuid().optional(),
  })
  .refine((query) => query.dateFrom <= query.dateTo, dateRangeRule);

const cashFlowPointSchema = z.object({
  periodStart: z.iso.date(),
  periodEnd: z.iso.date(),
  income: z.number(),
  expenses: z.number(),
  balance: z.number(),
  // Running balance across the *requested range* (starts at 0), not the
  // account's historical balance — that lives in the dashboard.
  cumulativeBalance: z.number(),
});

export const cashFlowResponseSchema = z.object({
  groupBy: reportGroupBySchema,
  data: z.array(cashFlowPointSchema),
});

export const categoryTrendsQuerySchema = z
  .object({
    ...dateRangeFields,
    groupBy: reportGroupBySchema.default("month"),
    accountId: z.uuid().optional(),
    categoryId: z.uuid().optional(),
  })
  .refine((query) => query.dateFrom <= query.dateTo, dateRangeRule);

// Wide format: one row per period, one dynamic key per categoryId — exactly
// the shape Recharts' stacked charts consume. The legend maps each key to its
// display name and stable color.
const categoryTrendPointSchema = z
  .object({
    periodStart: z.iso.date(),
    periodEnd: z.iso.date(),
  })
  .catchall(z.number());

export const categoryTrendsResponseSchema = z.object({
  groupBy: reportGroupBySchema,
  legend: z.array(
    z.object({
      categoryId: z.uuid(),
      categoryName: z.string(),
      color: z.string(),
    }),
  ),
  data: z.array(categoryTrendPointSchema),
});

export const accountStatsQuerySchema = z
  .object({
    ...dateRangeFields,
    accountId: z.uuid().optional(),
  })
  .refine((query) => query.dateFrom <= query.dateTo, dateRangeRule);

const accountStatsSchema = z.object({
  accountId: z.uuid(),
  name: z.string(),
  currency: z.string().length(3),
  transactionCount: z.number().int(),
  income: z.number(),
  expenses: z.number(),
  netChange: z.number(),
  // Income and expense metrics are deliberately separate: a single blended
  // average is meaningless when the two flows have different magnitudes.
  averageIncome: z.number(),
  averageExpense: z.number(),
  largestIncome: z.number(),
  largestExpense: z.number(),
});

export const accountStatsResponseSchema = z.object({
  data: z.array(accountStatsSchema),
});

// Both ranges are explicit rather than deriving "the previous period"
// automatically: ranges of unequal length stay unambiguous and the frontend
// controls exactly what it compares.
export const periodComparisonQuerySchema = z
  .object({
    currentFrom: z.iso.date(),
    currentTo: z.iso.date(),
    previousFrom: z.iso.date(),
    previousTo: z.iso.date(),
    accountId: z.uuid().optional(),
  })
  .refine((query) => query.currentFrom <= query.currentTo, {
    message: "currentFrom must be before or equal to currentTo",
    path: ["currentFrom"],
  })
  .refine((query) => query.previousFrom <= query.previousTo, {
    message: "previousFrom must be before or equal to previousTo",
    path: ["previousFrom"],
  });

const nullablePercentTripleSchema = z.object({
  income: z.number().nullable(),
  expenses: z.number().nullable(),
  balance: z.number().nullable(),
});

export const periodComparisonResponseSchema = z.object({
  current: periodTotalsSchema,
  previous: periodTotalsSchema,
  changeAmount: periodTotalsSchema,
  changePercent: nullablePercentTripleSchema,
});

export type CashFlowQuery = z.infer<typeof cashFlowQuerySchema>;
export type CategoryTrendsQuery = z.infer<typeof categoryTrendsQuerySchema>;
export type AccountStatsQuery = z.infer<typeof accountStatsQuerySchema>;
export type PeriodComparisonQuery = z.infer<typeof periodComparisonQuerySchema>;
