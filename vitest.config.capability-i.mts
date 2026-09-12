// Vitest config for Capability I test-synthesis fixtures only.
// Kept separate from the primary config so the fixture tests do NOT run
// during the default `vitest run` sweep.
//
// taught_by = master_ai_engineer · 2026-09-12 · test infrastructure

import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@": path.join(root, "src"),
      "server-only": path.join(root, "src/test/emptyModule.ts"),
    },
  },
  test: {
    environment: "node",
    include: ["data/nex1-code-engine/challenge-i-tests/*.ts"],
    globals: true,
  },
});
