import react from "@vitejs/plugin-react-swc";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./tests/setup.ts"],
    globals: false,
    // Multi-select flows (Radix Select + userEvent) are slower than the
    // 5s default, especially under load; give them headroom.
    testTimeout: 10_000,
    // Component test files interact with real timers and DOM heavily
    // enough that running them concurrently causes CPU contention and
    // flaky timeouts under load; the suite is small, so run sequentially.
    fileParallelism: false,
  },
});
