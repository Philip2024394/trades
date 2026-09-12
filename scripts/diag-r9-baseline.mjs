import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..");
const entryFile = fileURLToPath(import.meta.url);
if (!process.env.NEX_DIAG_INNER) {
  const child = spawn("npx", ["tsx", entryFile], { stdio: "inherit", cwd: repoRoot, shell: true, env: { ...process.env, NEX_DIAG_INNER: "1" } });
  child.on("exit", (code) => process.exit(code ?? 1));
} else {
  await inner();
}
async function inner() {
  const { mkdtempSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const pathMod = await import("node:path");
  process.env.NEX_PROGRAMMER_LEARNING_DIR = mkdtempSync(pathMod.join(tmpdir(), "diag-"));
  const { review } = await import("../src/lib/nex/programmer-review/reviewer.ts");
  const resp = review({
    review_id: "diag_1",
    requirement: "read a config file from disk for the nodejs app.",
    implementation: { id: "impl_config_loader", files: ["src/config/loader.ts"], summary: "config loader uses fs.readFileSync to read the config file and returns the parsed payload with success paths.", claim: "loads config via fs.readFileSync", claimed_by: "claude" },
    tests: { files: ["src/config/loader.test.ts"], passed: 2, failed: 0, summary: "checks that the loader reads the file and returns the payload across the standard input formats.", known_gaps: [] },
    runtime_evidence: [],
    requirement_details: { edge_cases_required: [], edge_cases_covered: [], security_requirements: [], security_violations_observed: [] },
  });
  console.log("verdict:", resp.verdict);
  console.log("findings:");
  for (const f of resp.findings) console.log(`  [${f.severity}] ${f.category} :: ${f.message.slice(0, 140)}`);
  console.log("reasoning trace:");
  for (const r of resp.reasoning_trace) console.log(`  ${r}`);
}
