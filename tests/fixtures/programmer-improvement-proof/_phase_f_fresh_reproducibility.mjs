// NEX Programmer Agent · Phase F · fresh-process reproducibility runner
// Philip 2026-09-06 · AUTHORIZE · PHASE F · §15 §24 Campaign 2 / 6
//
// Spawns fresh with no shared state · reads the corpus from disk · runs
// the evaluator · computes the fingerprint · prints ONLY the fingerprint
// on the last non-empty stdout line. The Phase-F evaluator-adapter's
// `verifyFreshProcessReproduction` reads that line and compares.

import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..", "..", "..");

// Delegate to a tsx-based driver so we can import TypeScript source.
const driver = path.join(here, "_phase_f_fresh_reproducibility_driver.ts");
const r = spawnSync("npx", ["tsx", driver], {
  cwd: repoRoot,
  encoding: "utf8",
  timeout: 60_000,
  shell: true,   // Windows requires shell:true to resolve npx.cmd
});

if (r.error) {
  console.error(`spawn_error:${r.error.message}`);
  process.exit(1);
}
if (typeof r.status === "number" && r.status !== 0) {
  console.error(r.stderr ?? "");
  process.exit(r.status);
}

// Pass driver output through verbatim so the last non-empty line stays
// the fingerprint.
process.stdout.write(r.stdout ?? "");
