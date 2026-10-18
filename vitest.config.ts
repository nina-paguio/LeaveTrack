import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    env: { LOG_LEVEL: "error", SESSION_SECRET: "test-secret-".repeat(4) },
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
