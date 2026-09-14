import { defineConfig } from "vitest/config";

// jsdom, not node: history.ts reads window.localStorage and builds DOM rows.
export default defineConfig({ test: { environment: "jsdom", include: ["tests/**/*.test.ts"], setupFiles: ["tests/setup.ts"] } });
