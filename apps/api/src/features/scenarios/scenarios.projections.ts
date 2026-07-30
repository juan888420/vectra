import type { ExpenseItemFrequency, IncomeFrequency } from "../../generated/prisma/enums.js";

// Prorates a snapshot amount to its monthly equivalent (ADR-0005 §4/§14).
// ONE_TIME always returns 0 — one-time costs/incomes never feed the
// recurring projections; callers sum ONE_TIME amounts separately.
export function toMonthlyEquivalent(
  amount: number,
  frequency: ExpenseItemFrequency | IncomeFrequency,
): number {
  switch (frequency) {
    case "MONTHLY":
      return amount;
    case "YEARLY":
      return amount / 12;
    case "WEEKLY":
      return (amount * 52) / 12;
    case "ONE_TIME":
      return 0;
    default:
      return 0;
  }
}
