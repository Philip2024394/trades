#!/usr/bin/env node
// Diagnostic: apply the 3 sub-tasks · run tsc · dump the FULL scoped diagnostic
// text so we can see exactly what TypeScript emits for the ripple case.
// Snapshot-restore protocol.

import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { createHash } from "node:crypto";

const REPO_ROOT = process.cwd();
if (!process.env.NEX1_INSPECT_INNER) {
  const envArgs = existsSync(resolve(REPO_ROOT, ".env.local")) ? ["--env-file=.env.local"] : [];
  const r = spawnSync("npx", ["tsx", ...envArgs, resolve(REPO_ROOT, "scripts/nex1-sprint-2-5-inspect-tsc.mjs")],
    { stdio: "inherit", cwd: REPO_ROOT, shell: true, env: { ...process.env, NEX1_INSPECT_INNER: "1" } });
  process.exit(r.status ?? 1);
}
function sha256(t) { return createHash("sha256").update(t).digest("hex"); }
const engine = await import(pathToFileURL(resolve(REPO_ROOT, "src/lib/nex-agent/code-engine/index.ts")).href);

const PROV = "src/lib/nex-agent/code-engine/provenance-recorder.ts";
const TEST = "src/lib/nex-agent/code-engine/code-engine.test.ts";
const originalProv = readFileSync(resolve(REPO_ROOT, PROV), "utf8");
const originalTest = readFileSync(resolve(REPO_ROOT, TEST), "utf8");
function restore() {
  writeFileSync(resolve(REPO_ROOT, PROV), originalProv, "utf8");
  writeFileSync(resolve(REPO_ROOT, TEST), originalTest, "utf8");
}
process.on("uncaughtException", (e) => { console.error(e); restore(); process.exit(99); });

const reg = new engine.Nex1ReasoningRegistry();
reg.register(engine.AstSemanticAdapter);

const subs = [
  { kind: "add_interface_field", target_path: PROV, target_interface: "Nex1AttemptProvenance", field_name: "resolved_at", field_type: "string | null" },
  { kind: "add_return_object_property", target_path: PROV, target_function: "recordProvenance", property_name: "resolved_at", property_value: "new Date().toISOString()" },
  { kind: "add_test_case", target_path: TEST, target_describe: "provenance · attribution firewall", test_name: "records resolved_at when NEX1 completes an attempt", test_body: "expect(true).toBe(true);" },
];
try {
  for (const d of subs) {
    const abs = resolve(REPO_ROOT, d.target_path);
    const content = readFileSync(abs, "utf8");
    const resp = await engine.nex1InvokeAdapter(reg, {
      task_id: "i", attempt_id: "j", intent: d.kind === "add_test_case" ? "add_test" : "add_feature",
      context: { task_prompt: "x", repo_snapshot_hash: sha256(content),
        file_slices: [{ path: d.target_path, content, content_hash: sha256(content) }],
        relevant_adrs: [], declared_scope: [d.target_path] },
      output_kind: "diff", template_directive: d,
    });
    if (!resp.ok) { console.log("apply fail", resp.reason); continue; }
    const applied = engine.applyWholeFileDiff(resp.result.proposed_diff);
    writeFileSync(abs, applied.get(d.target_path), "utf8");
    console.log("applied", d.kind);
  }
  console.log("\n=== Running tsc (no truncation) ===");
  const tsc = spawnSync("npx", ["tsc", "--noEmit", "--skipLibCheck", "--noErrorTruncation"], {
    stdio: "pipe", shell: true, encoding: "utf8", cwd: REPO_ROOT,
    env: { ...process.env, NODE_OPTIONS: "--max-old-space-size=8192" },
  });
  const out = (tsc.stdout ?? "") + "\n" + (tsc.stderr ?? "");
  const lines = out.split(/\r?\n/);
  // Print only scoped
  let inScoped = false;
  let printed = 0;
  for (const line of lines) {
    if (/provenance-recorder\.ts|code-engine\.test\.ts/.test(line) && /error TS/.test(line)) {
      inScoped = true;
      console.log("\n>>>", line);
      printed++;
    } else if (inScoped && /^\s+\S/.test(line)) {
      console.log("   ", line);
      printed++;
    } else if (inScoped && line.trim() === "") {
      inScoped = false;
    } else if (inScoped) {
      inScoped = false;
    }
  }
  console.log(`\n=== printed ${printed} lines · tsc exit=${tsc.status} ===`);
} finally {
  restore();
  console.log("restored");
}
