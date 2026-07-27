import { describe, expect, it } from "vitest";

import {
  buildBuckets,
  bucketIndexFor,
  MAX_REPORT_BUCKETS,
  toIsoDate,
  type ReportGroupBy,
} from "../src/lib/report-buckets.js";

const date = (iso: string): Date => new Date(`${iso}T00:00:00.000Z`);

function bucketsAsIso(
  from: string,
  to: string,
  groupBy: ReportGroupBy,
  weekStartsOn?: number,
): [string, string][] {
  return buildBuckets(date(from), date(to), groupBy, weekStartsOn).map((bucket) => [
    toIsoDate(bucket.start),
    toIsoDate(bucket.end),
  ]);
}

describe("buildBuckets", () => {
  it("produces one bucket per day", () => {
    expect(bucketsAsIso("2026-05-01", "2026-05-03", "day")).toEqual([
      ["2026-05-01", "2026-05-01"],
      ["2026-05-02", "2026-05-02"],
      ["2026-05-03", "2026-05-03"],
    ]);
  });

  it("handles a single-day range", () => {
    expect(bucketsAsIso("2026-05-01", "2026-05-01", "day")).toEqual([["2026-05-01", "2026-05-01"]]);
  });

  it("returns an empty array when from is after to", () => {
    expect(bucketsAsIso("2026-05-02", "2026-05-01", "day")).toEqual([]);
  });

  // 2026-06-01 is a Monday.
  it("aligns weeks to Monday by default, clamping the edges to the range", () => {
    expect(bucketsAsIso("2026-06-03", "2026-06-16", "week")).toEqual([
      ["2026-06-03", "2026-06-07"],
      ["2026-06-08", "2026-06-14"],
      ["2026-06-15", "2026-06-16"],
    ]);
  });

  it("respects weekStartsOn = 0 (Sunday)", () => {
    expect(bucketsAsIso("2026-06-03", "2026-06-16", "week", 0)).toEqual([
      ["2026-06-03", "2026-06-06"],
      ["2026-06-07", "2026-06-13"],
      ["2026-06-14", "2026-06-16"],
    ]);
  });

  it("keeps a full week intact when the range covers it exactly", () => {
    expect(bucketsAsIso("2026-06-08", "2026-06-14", "week")).toEqual([
      ["2026-06-08", "2026-06-14"],
    ]);
  });

  it("aligns months to calendar months, clamping the edges", () => {
    expect(bucketsAsIso("2026-01-15", "2026-03-10", "month")).toEqual([
      ["2026-01-15", "2026-01-31"],
      ["2026-02-01", "2026-02-28"],
      ["2026-03-01", "2026-03-10"],
    ]);
  });

  it("gives February 29 days in a leap year", () => {
    expect(bucketsAsIso("2028-02-01", "2028-03-01", "month")).toEqual([
      ["2028-02-01", "2028-02-29"],
      ["2028-03-01", "2028-03-01"],
    ]);
  });

  it("aligns years to calendar years, clamping the edges", () => {
    expect(bucketsAsIso("2025-06-01", "2026-02-01", "year")).toEqual([
      ["2025-06-01", "2025-12-31"],
      ["2026-01-01", "2026-02-01"],
    ]);
  });

  it("ignores time-of-day on the inputs", () => {
    const buckets = buildBuckets(
      new Date("2026-05-01T23:59:00.000Z"),
      new Date("2026-05-02T00:01:00.000Z"),
      "day",
    );
    expect(buckets).toHaveLength(2);
  });

  it("throws a RangeError past MAX_REPORT_BUCKETS", () => {
    expect(() => buildBuckets(date("2020-01-01"), date("2026-01-01"), "day")).toThrow(RangeError);
  });

  it("allows exactly MAX_REPORT_BUCKETS buckets", () => {
    const from = date("2020-01-01");
    const to = new Date(from.getTime() + (MAX_REPORT_BUCKETS - 1) * 24 * 60 * 60 * 1000);
    expect(buildBuckets(from, to, "day")).toHaveLength(MAX_REPORT_BUCKETS);
  });
});

describe("bucketIndexFor", () => {
  const buckets = buildBuckets(date("2026-01-15"), date("2026-03-10"), "month");

  it("finds the bucket containing a date", () => {
    expect(bucketIndexFor(buckets, date("2026-01-20"))).toBe(0);
    expect(bucketIndexFor(buckets, date("2026-02-01"))).toBe(1);
    expect(bucketIndexFor(buckets, date("2026-03-10"))).toBe(2);
  });

  it("returns -1 for dates outside every bucket", () => {
    expect(bucketIndexFor(buckets, date("2026-01-01"))).toBe(-1);
    expect(bucketIndexFor(buckets, date("2026-03-11"))).toBe(-1);
  });
});
