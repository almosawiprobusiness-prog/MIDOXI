import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  // Match the "@/..." paths the app uses, so pure modules can be imported as-is.
  resolve: {
    alias: { "@": fileURLToPath(new URL("./", import.meta.url)) },
  },
  test: {
    // Unit tests only — pure logic, no server/client runtime. E2E/route coverage
    // lives in scripts/smoke.mjs against a running server.
    include: ["tests/unit/**/*.test.ts"],
    environment: "node",
  },
});
