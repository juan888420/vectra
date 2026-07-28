// `isoDate` can be a bare date ("2026-01-15") or a full ISO datetime as
// returned by the API ("2026-01-15T00:00:00.000Z") — take just the date part
// before appending our own time-of-day, or the concatenation produces an
// unparseable string. Parsed as UTC midnight so the displayed date never
// shifts a day in timezones behind UTC.
export function formatDateOnly(isoDate: string): string {
  const datePart = isoDate.slice(0, 10);
  return new Intl.DateTimeFormat(undefined, { timeZone: "UTC", dateStyle: "medium" }).format(
    new Date(`${datePart}T00:00:00Z`),
  );
}
