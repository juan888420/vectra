import { expect, it } from "vitest";

// Throwaway: fails on purpose to prove the "main: CI required" ruleset blocks the merge.
it("fails on purpose", () => {
  expect(1).toBe(2);
});
