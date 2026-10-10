// Minimal vitest config scoped to scripts/nex-canonical/*.test.ts
// Used only to run the pure-function tests for generate-candidates.ts.
// Does NOT replace the project-wide vitest.config.ts.
import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";
import path from "node:path";
const root = path.dirname(fileURLToPath(import.meta.url));
export default defineConfig({
  resolve: {
    alias: {
      "@": path.join(root, "../../src"),
      "server-only": path.join(root, "../../src/test/emptyModule.ts"),
    },
  },
  test: {
    environment: "node",
    include: [
      "scripts/nex-canonical/*.test.ts",
      "scripts/nex-canonical/__tests__/*.test.ts",
    ],
    globals: true,
    root: path.join(root, "../.."),
  },
});
