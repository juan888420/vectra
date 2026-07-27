// Shared numeric helpers for money aggregation. Amounts are Decimal(12,2) in
// the database; once converted to JS numbers they stay well within float
// precision, but intermediate sums still need explicit rounding back to cents.

export function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Percentage change from `previous` to `current`, rounded to one decimal.
 * `null` when the previous value was 0 and the current is not: a percentage
 * change from zero is undefined, not Infinity/NaN.
 */
export function percentChange(current: number, previous: number): number | null {
  if (previous === 0) {
    return current === 0 ? 0 : null;
  }
  return Math.round(((current - previous) / previous) * 1000) / 10;
}
