// `isoDate` is a date-only string (e.g. "2026-01-15"); parsed as UTC midnight
// so the displayed date never shifts a day in timezones behind UTC.
export function formatDateOnly(isoDate: string): string {
  return new Intl.DateTimeFormat(undefined, { timeZone: "UTC", dateStyle: "medium" }).format(
    new Date(`${isoDate}T00:00:00Z`),
  );
}
