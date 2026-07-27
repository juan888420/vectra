import type { RecurrenceFrequency } from "../generated/prisma/client.js";

// Pure recurrence math — no database access, so it can be unit-tested
// exhaustively (month lengths, leap years, month-end anchoring).
//
// Recurrences are *anchored*, not *drifting*: the day-of-month comes from the
// template's `startDate`, not from the previous occurrence. A monthly template
// starting Jan 31 therefore runs Jan 31 -> Feb 28 -> Mar 31, instead of
// permanently shrinking to the 28th after one short month. Same idea for
// yearly templates anchored on Feb 29, which fall back to Feb 28 in common
// years and snap back to Feb 29 in leap years.

const DAYS_BY_FIXED_FREQUENCY: Partial<Record<RecurrenceFrequency, number>> = {
  DAILY: 1,
  WEEKLY: 7,
  BIWEEKLY: 14,
};

/** Calendar dates carry no time-of-day in this domain (`@db.Date`). */
export function toUtcDateOnly(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function daysInMonth(year: number, monthIndex: number): number {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}

function addDays(date: Date, days: number): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + days));
}

/**
 * The occurrence that follows `current` for a template anchored at `startDate`.
 *
 * `startDate` is only read for its day-of-month (and month, for YEARLY): it is
 * the anchor the schedule returns to after a short month clamps an occurrence.
 */
export function calculateNextExecutionDate(
  current: Date,
  frequency: RecurrenceFrequency,
  startDate: Date,
): Date {
  const from = toUtcDateOnly(current);
  const anchor = toUtcDateOnly(startDate);

  const fixedDays = DAYS_BY_FIXED_FREQUENCY[frequency];
  if (fixedDays !== undefined) {
    return addDays(from, fixedDays);
  }

  if (frequency === "MONTHLY") {
    const year = from.getUTCFullYear();
    // Clamping only ever changes the day, never the month, so advancing from
    // `current`'s month stays correct even after a short-month occurrence.
    const monthIndex = from.getUTCMonth() + 1;
    const targetYear = year + Math.floor(monthIndex / 12);
    const targetMonth = ((monthIndex % 12) + 12) % 12;
    const day = Math.min(anchor.getUTCDate(), daysInMonth(targetYear, targetMonth));
    return new Date(Date.UTC(targetYear, targetMonth, day));
  }

  // YEARLY: the month always comes from the anchor, so only Feb 29 can clamp.
  const targetYear = from.getUTCFullYear() + 1;
  const targetMonth = anchor.getUTCMonth();
  const day = Math.min(anchor.getUTCDate(), daysInMonth(targetYear, targetMonth));
  return new Date(Date.UTC(targetYear, targetMonth, day));
}

/** True when `date` falls after the template's (inclusive) `endDate`. */
export function isAfterEndDate(date: Date, endDate: Date | null): boolean {
  if (!endDate) {
    return false;
  }
  return toUtcDateOnly(date).getTime() > toUtcDateOnly(endDate).getTime();
}

/** True when the occurrence is due to be generated as of `asOf` (inclusive). */
export function isDue(nextExecutionDate: Date, asOf: Date): boolean {
  return toUtcDateOnly(nextExecutionDate).getTime() <= toUtcDateOnly(asOf).getTime();
}
