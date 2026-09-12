// Vitest config for Capability I.2 negative-proof fixtures.
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
    include: ["data/nex1-code-engine/challenge-i2-tests/*.ts"],
    globals: true,
  },
});
