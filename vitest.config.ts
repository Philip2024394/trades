// Vitest config — mirrors the tsconfig path aliases so tests can import
// via @/... same as production code.

import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@":            path.join(root, "src"),
      // Next.js `server-only` guard would throw when the test runtime
      // (non-Next) hits it. Alias to an empty module so imports resolve.
      "server-only":  path.join(root, "src/test/emptyModule.ts")
    }
  },
  test: {
    environment: "node",
    // Country Foundation Step 4 (2026-08-22) · scripts/**/*.test.mjs added so Walker
    // config country-awareness tests (which live next to the acquisition code they test)
    // are discovered by the default `vitest run`. Only .test.mjs files match — pre-existing
    // `_test-*.mjs` standalone scripts are NOT swept up (different naming convention).
    include: ["src/**/*.test.ts", "src/**/*.test.tsx", "scripts/**/*.test.mjs"],
    globals:  true,
    setupFiles: ["src/test/setup.ts"]
  }
});
