import { toUtcDateOnly } from "./recurrence.js";

// Pure calendar bucketing for report endpoints — no database access, so the
// alignment rules (week start, month lengths, clamping) are unit-testable.
//
// Buckets are calendar-aligned (weeks start on the user's `weekStartsOn`,
// months on the 1st, years on Jan 1) and contiguous. The first and last
// buckets are clamped to the requested range so every bucket describes only
// dates the query actually covers. Both bounds are inclusive: the domain works
// in whole calendar dates (`@db.Date`), not instants.

export type ReportGroupBy = "day" | "week" | "month" | "year";

export interface ReportBucket {
  start: Date;
  end: Date;
}

/**
 * Upper bound on buckets per report. Protects the API from a request like ten
 * years grouped by day, which would produce a payload no chart can display
 * anyway. `buildBuckets` throws a RangeError past this; callers translate it
 * to a 400.
 */
export const MAX_REPORT_BUCKETS = 1000;

const DAY_MS = 24 * 60 * 60 * 1000;

export function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}

function alignedStart(date: Date, groupBy: ReportGroupBy, weekStartsOn: number): Date {
  switch (groupBy) {
    case "day":
      return date;
    case "week": {
      const offset = (date.getUTCDay() - weekStartsOn + 7) % 7;
      return addDays(date, -offset);
    }
    case "month":
      return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
    case "year":
      return new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  }
}

function nextStart(start: Date, groupBy: ReportGroupBy): Date {
  switch (groupBy) {
    case "day":
      return addDays(start, 1);
    case "week":
      return addDays(start, 7);
    case "month":
      return new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1));
    case "year":
      return new Date(Date.UTC(start.getUTCFullYear() + 1, 0, 1));
  }
}

/**
 * Contiguous, calendar-aligned buckets covering [from, to], both inclusive.
 *
 * `weekStartsOn` follows the User model: 0 = Sunday … 6 = Saturday. It only
 * affects `week` grouping. Returns an empty array when `from > to`.
 */
export function buildBuckets(
  from: Date,
  to: Date,
  groupBy: ReportGroupBy,
  weekStartsOn = 1,
): ReportBucket[] {
  const rangeStart = toUtcDateOnly(from);
  const rangeEnd = toUtcDateOnly(to);
  const normalizedWeekStart = ((weekStartsOn % 7) + 7) % 7;

  const buckets: ReportBucket[] = [];
  let cursor = alignedStart(rangeStart, groupBy, normalizedWeekStart);

  while (cursor.getTime() <= rangeEnd.getTime()) {
    if (buckets.length >= MAX_REPORT_BUCKETS) {
      throw new RangeError(
        `Date range produces more than ${MAX_REPORT_BUCKETS} ${groupBy} buckets`,
      );
    }

    const following = nextStart(cursor, groupBy);
    buckets.push({
      start: cursor.getTime() < rangeStart.getTime() ? rangeStart : cursor,
      end:
        addDays(following, -1).getTime() > rangeEnd.getTime() ? rangeEnd : addDays(following, -1),
    });
    cursor = following;
  }

  return buckets;
}

/**
 * Index of the bucket containing `date`, or -1 when outside every bucket.
 * Buckets are contiguous and sorted, so the owning bucket is the last one
 * starting on or before the date.
 */
export function bucketIndexFor(buckets: ReportBucket[], date: Date): number {
  const time = toUtcDateOnly(date).getTime();
  for (let i = buckets.length - 1; i >= 0; i -= 1) {
    if (time >= buckets[i]!.start.getTime()) {
      return time <= buckets[i]!.end.getTime() ? i : -1;
    }
  }
  return -1;
}
