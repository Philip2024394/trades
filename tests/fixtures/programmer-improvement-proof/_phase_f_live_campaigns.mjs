// NEX Programmer Agent · Phase F · live campaigns (§24)
// Philip 2026-09-06 · AUTHORIZE · PHASE F
//
// This runner executes six controlled learning campaigns end-to-end
// against the REAL Phase C reviewer + Phase D corpus + Phase E drift
// detector. It never modifies the reviewer, evaluator, or corpus.
// Outputs a JSON evidence bundle for the report.
//
// Usage:
//   node tests/fixtures/programmer-improvement-proof/_phase_f_live_campaigns.mjs
//
// Requires the source modules to be resolvable via the standard build.
// We use `tsx` to load TypeScript sources directly.

import { spawnSync } from "node:child_process";
import { writeFileSync, mkdtempSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import os from "node:os";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..", "..", "..");

// Delegate to a tsx-driven driver so we can import TypeScript directly.
const driver = path.join(here, "_phase_f_live_campaigns_driver.ts");
const tmpDir = mkdtempSync(path.join(os.tmpdir(), "phase-f-live-"));
const result = spawnSync("npx", ["tsx", driver], {
  cwd: repoRoot,
  encoding: "utf8",
  env: {
    ...process.env,
    NEX_PROGRAMMER_IMPROVEMENT_DIR: tmpDir,
    // Stability store is namespaced so we don't pollute other test runs
    NEX_PROGRAMMER_STABILITY_DIR: path.join(tmpDir, "stability"),
  },
  timeout: 240_000,
  shell: true,  // Windows: resolve npx.cmd
});

console.log(result.stdout ?? "");
if (result.status !== 0) {
  console.error(result.stderr ?? "");
  process.exit(result.status ?? 1);
}

// Persist the driver's JSON output next to this runner.
writeFileSync(
  path.join(here, "_phase_f_live_campaigns.json"),
  (result.stdout ?? "").split("\n").filter((l) => l.startsWith("EVIDENCE_JSON:")).pop()?.replace("EVIDENCE_JSON:", "") ?? "{}",
);
