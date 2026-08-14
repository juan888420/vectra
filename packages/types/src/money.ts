import { z } from "zod";

// Mirrors apps/api/src/lib/schemas.ts's moneyAmountSchema: Decimal(12,2), so
// 10 integer digits + 2 decimal digits. Shared across features (Transaction,
// Budget, ...) the same way the backend keeps it in a cross-feature lib
// instead of duplicating it per feature schema file.
const MAX_MONEY_AMOUNT = 9_999_999_999.99;

// User-facing copy: these messages surface under the "Precio"/"Monto" field
// of every product and income form (the forms call safeParse directly).
export const moneyAmountSchema = z
  .number()
  .positive("Ingresa un monto mayor que cero")
  .max(MAX_MONEY_AMOUNT, "El monto es demasiado alto")
  .refine((value) => Math.round(value * 100) / 100 === value, {
    message: "Usa como máximo 2 decimales",
  });

// Mirrors apps/api/src/lib/schemas.ts's periodTotalsSchema: shared shape for
// any income/expenses/balance breakdown over a period (dashboard totals,
// month comparisons), same reasoning as moneyAmountSchema above.
export const periodTotalsSchema = z.object({
  income: z.number(),
  expenses: z.number(),
  balance: z.number(),
});

export type PeriodTotals = z.infer<typeof periodTotalsSchema>;
