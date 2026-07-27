import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    setupFiles: ["./tests/setup.ts"],
    // Integration tests share one Postgres database sequentially; running
    // files in parallel risks interleaved writes across unrelated tests.
    fileParallelism: false,
  },
});
