// NEX Programmer Agent · Phase F · ACTIVATION campaigns runner (§20)
// Philip 2026-09-06 · AUTHORIZE · PHASE F ACTIVATION
//
// Wraps the tsx driver in an isolated tmp improvement-store so the
// activation run doesn't pollute persistent state. Prints the driver's
// EVIDENCE_JSON: line for downstream consumers + persists it next to
// this runner as _phase_f_activation_campaigns.json.

import { spawnSync } from "node:child_process";
import { writeFileSync, mkdtempSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import os from "node:os";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..", "..", "..");
const driver = path.join(here, "_phase_f_activation_driver.ts");
const tmpDir = mkdtempSync(path.join(os.tmpdir(), "phase-f-activation-"));

const result = spawnSync("npx", ["tsx", driver], {
  cwd: repoRoot,
  encoding: "utf8",
  env: {
    ...process.env,
    NEX_PROGRAMMER_IMPROVEMENT_DIR: tmpDir,
    NEX_PROGRAMMER_STABILITY_DIR: path.join(tmpDir, "stability"),
  },
  timeout: 300_000,
  shell: true,   // Windows: resolve npx.cmd
});

console.log(result.stdout ?? "");
if (result.status !== 0) {
  console.error(result.stderr ?? "");
  process.exit(result.status ?? 1);
}

const evidenceLine = (result.stdout ?? "").split("\n").filter((l) => l.startsWith("EVIDENCE_JSON:")).pop();
if (evidenceLine) {
  writeFileSync(
    path.join(here, "_phase_f_activation_campaigns.json"),
    evidenceLine.replace("EVIDENCE_JSON:", ""),
  );
}
