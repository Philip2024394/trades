// NEX Programmer Agent · Phase G · live campaigns runner (§33 G1-G7)
// Philip 2026-09-06 · AUTHORIZE · PHASE G
//
// Wraps the tsx driver in an isolated tmp audit-store so activation
// doesn't pollute persistent state. Prints EVIDENCE_JSON: and persists
// it as _phase_g_live_campaigns.json.

import { spawnSync } from "node:child_process";
import { writeFileSync, mkdtempSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import os from "node:os";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..", "..", "..");
const driver = path.join(here, "_phase_g_live_campaigns_driver.ts");
const tmpDir = mkdtempSync(path.join(os.tmpdir(), "phase-g-activation-"));

const result = spawnSync("npx", ["tsx", driver], {
  cwd: repoRoot,
  encoding: "utf8",
  env: {
    ...process.env,
    NEX_PROGRAMMER_EXECUTION_DIR: path.join(tmpDir, "audit"),
    PHASE_G_SANDBOX_PARENT: path.join(tmpDir, "sandbox-parent"),
    NEX_PROGRAMMER_IMPROVEMENT_DIR: path.join(tmpDir, "improvement"),
    NEX_PROGRAMMER_STABILITY_DIR: path.join(tmpDir, "stability"),
  },
  timeout: 300_000,
  shell: true,
});

console.log(result.stdout ?? "");
if (result.status !== 0) {
  console.error(result.stderr ?? "");
  process.exit(result.status ?? 1);
}

const line = (result.stdout ?? "").split("\n").filter((l) => l.startsWith("EVIDENCE_JSON:")).pop();
if (line) {
  writeFileSync(
    path.join(here, "_phase_g_live_campaigns.json"),
    line.replace("EVIDENCE_JSON:", ""),
  );
}
