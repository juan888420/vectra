import { describe, expect, it } from "vitest";

import { chartColor } from "../src/lib/chart-color.js";

describe("chartColor", () => {
  it("produces a valid hsl() color", () => {
    expect(chartColor("0198c8a4-0000-7000-8000-000000000001")).toMatch(
      /^hsl\(\d{1,3}, 65%, 50%\)$/,
    );
  });

  it("is deterministic for the same seed", () => {
    const seed = "0198c8a4-0000-7000-8000-000000000002";
    expect(chartColor(seed)).toBe(chartColor(seed));
  });

  it("keeps the hue within 0-359", () => {
    for (const seed of ["a", "zz", "0198c8a4-aaaa-7bbb-8ccc-dddddddddddd", ""]) {
      const match = /^hsl\((\d+),/.exec(chartColor(seed));
      expect(match).not.toBeNull();
      expect(Number(match![1])).toBeLessThan(360);
    }
  });

  it("gives different seeds different colors (known non-colliding pair)", () => {
    expect(chartColor("groceries")).not.toBe(chartColor("transport"));
  });
});
