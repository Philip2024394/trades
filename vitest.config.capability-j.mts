// Vitest config for Capability J failure fixtures.
// These tests INTENTIONALLY FAIL · they produce structured evidence for
// J.1's runtime-failure extractor to parse.

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
    include: ["data/nex1-code-engine/challenge-j-tests/*.ts"],
    globals: true,
    testTimeout: 2000,
  },
});
