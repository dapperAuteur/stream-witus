import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // `server-only` throws outside an RSC context; stub it so the isolation
      // suite can import server modules that pull in pure helpers.
      "server-only": fileURLToPath(new URL("./tests/stubs/server-only.ts", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    setupFiles: ["tests/setup-env.ts"],
    // DB-integration suites make several serverless round-trips to Neon per
    // hook/test; the default 5s/10s is too tight over the network.
    testTimeout: 30000,
    hookTimeout: 30000,
  },
});
