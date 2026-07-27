// Shared UTC calendar-month boundary helper: any period-based aggregation
// (Budget progress, Dashboard summaries) needs the same "current month"
// definition. `end` is exclusive, so callers filter with `date: { gte: start, lt: end }`.
export function getMonthRange(
  offsetMonths = 0,
  reference: Date = new Date(),
): { start: Date; end: Date } {
  const start = new Date(
    Date.UTC(reference.getUTCFullYear(), reference.getUTCMonth() + offsetMonths, 1),
  );
  const end = new Date(
    Date.UTC(reference.getUTCFullYear(), reference.getUTCMonth() + offsetMonths + 1, 1),
  );
  return { start, end };
}
