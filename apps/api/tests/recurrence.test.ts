import { describe, expect, it } from "vitest";

import { calculateNextExecutionDate, isAfterEndDate, isDue } from "../src/lib/recurrence.js";
import type { RecurrenceFrequency } from "../src/generated/prisma/client.js";

const date = (iso: string): Date => new Date(`${iso}T00:00:00.000Z`);
const iso = (value: Date): string => value.toISOString().slice(0, 10);

// `startDate` doubles as the anchor; when it doesn't matter for a case, it is
// the same as `current`.
function next(current: string, frequency: RecurrenceFrequency, startDate = current): string {
  return iso(calculateNextExecutionDate(date(current), frequency, date(startDate)));
}

describe("calculateNextExecutionDate", () => {
  describe("fixed-length frequencies", () => {
    it("advances DAILY by one day, across a month boundary", () => {
      expect(next("2026-01-31", "DAILY")).toBe("2026-02-01");
    });

    it("advances DAILY across a year boundary", () => {
      expect(next("2026-12-31", "DAILY")).toBe("2027-01-01");
    });

    it("advances WEEKLY by seven days, across a month boundary", () => {
      expect(next("2026-01-28", "WEEKLY")).toBe("2026-02-04");
    });

    it("advances BIWEEKLY by fourteen days", () => {
      expect(next("2026-01-01", "BIWEEKLY")).toBe("2026-01-15");
    });

    it("advances BIWEEKLY across a month boundary", () => {
      expect(next("2026-01-25", "BIWEEKLY")).toBe("2026-02-08");
    });

    it("advances DAILY into a leap day", () => {
      expect(next("2028-02-28", "DAILY")).toBe("2028-02-29");
    });
  });

  describe("MONTHLY", () => {
    it("keeps the same day of month in the common case", () => {
      expect(next("2026-03-15", "MONTHLY")).toBe("2026-04-15");
    });

    it("clamps a 31st anchor to the last day of a 30-day month", () => {
      expect(next("2026-03-31", "MONTHLY")).toBe("2026-04-30");
    });

    it("clamps a 31st anchor to Feb 28 in a common year", () => {
      expect(next("2026-01-31", "MONTHLY")).toBe("2026-02-28");
    });

    it("clamps a 31st anchor to Feb 29 in a leap year", () => {
      expect(next("2028-01-31", "MONTHLY")).toBe("2028-02-29");
    });

    // The anchoring guarantee: a short month must not permanently shrink the
    // schedule to the 28th.
    it("returns to the 31st anchor after a clamped February", () => {
      expect(next("2026-02-28", "MONTHLY", "2026-01-31")).toBe("2026-03-31");
    });

    it("returns to the 31st anchor after a clamped 30-day month", () => {
      expect(next("2026-04-30", "MONTHLY", "2026-01-31")).toBe("2026-05-31");
    });

    it("returns to a 30th anchor after a clamped February", () => {
      expect(next("2026-02-28", "MONTHLY", "2026-01-30")).toBe("2026-03-30");
    });

    it("crosses a year boundary", () => {
      expect(next("2026-12-15", "MONTHLY")).toBe("2027-01-15");
    });

    it("crosses a year boundary while clamping", () => {
      expect(next("2026-12-31", "MONTHLY", "2026-10-31")).toBe("2027-01-31");
    });

    it("walks a full year from a 31st anchor, hitting each month's real length", () => {
      const anchor = "2026-01-31";
      const walked: string[] = [];
      let current = anchor;
      for (let i = 0; i < 12; i += 1) {
        current = next(current, "MONTHLY", anchor);
        walked.push(current);
      }

      expect(walked).toEqual([
        "2026-02-28",
        "2026-03-31",
        "2026-04-30",
        "2026-05-31",
        "2026-06-30",
        "2026-07-31",
        "2026-08-31",
        "2026-09-30",
        "2026-10-31",
        "2026-11-30",
        "2026-12-31",
        "2027-01-31",
      ]);
    });
  });

  describe("YEARLY", () => {
    it("keeps the same month and day", () => {
      expect(next("2026-06-15", "YEARLY")).toBe("2027-06-15");
    });

    it("clamps a Feb 29 anchor to Feb 28 in a common year", () => {
      expect(next("2028-02-29", "YEARLY")).toBe("2029-02-28");
    });

    // The leap-year round trip: once clamped, the anchor must still win the
    // next time February has 29 days.
    it("snaps back to Feb 29 on the next leap year", () => {
      const anchor = "2028-02-29";
      expect(next("2029-02-28", "YEARLY", anchor)).toBe("2030-02-28");
      expect(next("2030-02-28", "YEARLY", anchor)).toBe("2031-02-28");
      expect(next("2031-02-28", "YEARLY", anchor)).toBe("2032-02-29");
    });

    it("treats 2100 as a common year (century non-leap rule)", () => {
      expect(next("2099-02-28", "YEARLY", "2096-02-29")).toBe("2100-02-28");
    });
  });

  it("ignores any time-of-day on the input", () => {
    const withTime = new Date("2026-03-15T23:45:12.000Z");
    const result = calculateNextExecutionDate(withTime, "MONTHLY", withTime);
    expect(result.toISOString()).toBe("2026-04-15T00:00:00.000Z");
  });
});

describe("isAfterEndDate", () => {
  it("is false when there is no end date", () => {
    expect(isAfterEndDate(date("2099-01-01"), null)).toBe(false);
  });

  it("is false on the end date itself (inclusive)", () => {
    expect(isAfterEndDate(date("2026-06-30"), date("2026-06-30"))).toBe(false);
  });

  it("is true the day after the end date", () => {
    expect(isAfterEndDate(date("2026-07-01"), date("2026-06-30"))).toBe(true);
  });
});

describe("isDue", () => {
  it("is true on the execution date itself (inclusive)", () => {
    expect(isDue(date("2026-06-30"), date("2026-06-30"))).toBe(true);
  });

  it("is true when overdue", () => {
    expect(isDue(date("2026-06-01"), date("2026-06-30"))).toBe(true);
  });

  it("is false when still in the future", () => {
    expect(isDue(date("2026-07-01"), date("2026-06-30"))).toBe(false);
  });
});
