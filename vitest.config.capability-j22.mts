// Vitest config for Capability J.2.2 broader-shape fixtures.
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
    include: ["data/nex1-code-engine/challenge-j22-tests/*.ts"],
    globals: true,
    testTimeout: 2000,
  },
});
