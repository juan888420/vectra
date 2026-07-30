// Shared across apps/web and apps/api so the frequency → monthly-equivalent
// formula lives in exactly one place (ADR-0006: derived calculations belong
// wherever they're computed once, never duplicated between backend and UI).
export type ProjectionFrequency = "WEEKLY" | "MONTHLY" | "YEARLY" | "ONE_TIME";

// Prorates an amount to its monthly equivalent (ADR-0005 §4/§14). ONE_TIME
// always returns 0 — one-time costs/incomes never feed the recurring
// projections; callers sum ONE_TIME amounts separately if they need that total.
export function toMonthlyEquivalent(amount: number, frequency: ProjectionFrequency): number {
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

export interface MonthlyProjection {
  monthly: number;
  sixMonths: number;
  twelveMonths: number;
}

// The mensual/6m/12m trio every "question screen" shows (Category, Product,
// Income, Scenario) — one place to change the multiplier if projections ever
// grow past a naive ×6/×12 (see roadmap Fase 3, real anniversary timing).
export function toProjection(monthly: number): MonthlyProjection {
  return { monthly, sixMonths: monthly * 6, twelveMonths: monthly * 12 };
}
