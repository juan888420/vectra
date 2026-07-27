import { describe, expect, it } from "vitest";

import { clamp, percentChange, round2 } from "../src/lib/finance-math.js";

describe("round2", () => {
  it("rounds to two decimals", () => {
    expect(round2(10.005)).toBe(10.01);
    expect(round2(10.004)).toBe(10);
    expect(round2(-2.554)).toBe(-2.55);
    expect(round2(-2.556)).toBe(-2.56);
  });

  it("fixes float accumulation drift", () => {
    expect(round2(0.1 + 0.2)).toBe(0.3);
  });
});

describe("clamp", () => {
  it("clamps below, inside and above the range", () => {
    expect(clamp(-5, 0, 100)).toBe(0);
    expect(clamp(42, 0, 100)).toBe(42);
    expect(clamp(140, 0, 100)).toBe(100);
  });
});

describe("percentChange", () => {
  it("computes a rounded percentage", () => {
    expect(percentChange(150, 100)).toBe(50);
    expect(percentChange(100, 150)).toBe(-33.3);
  });

  it("is 0 when both values are 0", () => {
    expect(percentChange(0, 0)).toBe(0);
  });

  it("is null when the previous value is 0 and the current is not", () => {
    expect(percentChange(50, 0)).toBeNull();
  });

  it("handles a drop to zero", () => {
    expect(percentChange(0, 80)).toBe(-100);
  });
});
