import { z } from "zod";

// Cross-feature request/response schemas.

export const idParamsSchema = z.object({
  id: z.uuid(),
});

export const errorResponseSchema = z.object({
  statusCode: z.number(),
  error: z.string(),
  message: z.string(),
});

// Income/expense/balance triple for a time window — shared by the dashboard
// summary and every report endpoint.
export const periodTotalsSchema = z.object({
  income: z.number(),
  expenses: z.number(),
  balance: z.number(),
});

// Decimal(12,2): 10 integer digits + 2 decimal digits — shared by every
// Money-shaped field (Transaction.amount, Budget.amount, ...).
const MAX_MONEY_AMOUNT = 9_999_999_999.99;

export const moneyAmountSchema = z
  .number()
  .positive()
  .max(MAX_MONEY_AMOUNT, "Amount exceeds the maximum allowed")
  .refine((value) => Math.round(value * 100) / 100 === value, {
    message: "Amount must have at most 2 decimal places",
  });
