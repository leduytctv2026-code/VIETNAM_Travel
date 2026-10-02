import { defineConfig } from "vitest/config";
import path from "node:path";
export default defineConfig({
  resolve: { alias: { "@": path.resolve("src") } },
  test: {
    include: ["backend/tests/**/*.test.ts", "tests/frontend/**/*.test.tsx"],
    testTimeout: 30000,
    hookTimeout: 120000,
    maxWorkers: 1,
    fileParallelism: false,
  },
});
