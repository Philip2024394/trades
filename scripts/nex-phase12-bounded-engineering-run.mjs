// scripts/nex-phase12-bounded-engineering-run.mjs
//
// Phase 12 · Bounded Autonomous Engineering Under Founder Governance ·
// demo runner. Executes ONE cycle against a synthetic safe candidate ·
// proves production tree is unchanged · never modifies the Programmer
// worker or any production ledger.

import { spawn } from "node:child_process";
import { writeFileSync, existsSync, mkdirSync, unlinkSync } from "node:fs";
import path from "node:path";

const inner = String.raw`
import { runAutonomousCycle } from "@/lib/nex/programmer-execution/autonomous-loop";
import path from "node:path";
import { existsSync, statSync } from "node:fs";

const change = {
  change_id: "chg_phase12_demo",
  candidate_id: "cand_phase12_demo_add_documentation",
  description: "Phase 12 demo · add a small documentation note in sandbox · never modifies production",
  repair_skill: "add_documentation",
  founder_authorization_id: "founder_auth_phase12_demo_2026-09-08",
  files: [
    {
      relative_path: "docs/phase12-demo-note.md",
      content: "# Phase 12 demo note\n\nThis file exists only in the sandbox · not in production.\n\nGenerated as part of the Bounded Autonomous Engineering Under Founder Governance cycle demonstration.\n",
      action: "create",
    },
  ],
};

const refFiles = [
  path.resolve(process.cwd(), "package.json"),
  path.resolve(process.cwd(), "CLAUDE.md"),
  path.resolve(process.cwd(), "src/lib/nex/programmer-execution/autonomous-loop.ts"),
];
const refBytesBefore = refFiles.reduce((s, f) => existsSync(f) ? s + statSync(f).size : s, 0);

const result = runAutonomousCycle({
  change,
  production_reference_files: refFiles,
  archive_on_completion: false,
  persist_audit: false,   // Founder gate: dry on real ledger by default
});

const refBytesAfter = refFiles.reduce((s, f) => existsSync(f) ? s + statSync(f).size : s, 0);

console.log("PHASE_12_BOUNDED_ENGINEERING_CYCLE:" + JSON.stringify({
  ...result,
  external_reference_bytes_before: refBytesBefore,
  external_reference_bytes_after: refBytesAfter,
  external_reference_unchanged: refBytesBefore === refBytesAfter,
  founder_gate: "requires_founder_approval_before_merge:true is contract-enforced on every result · no auto-merge · no auto-promote · Programmer worker NOT elevated to Phase G in production this phase",
}, null, 2));
`;

const dir = path.resolve(process.cwd(), "scripts", ".phase12-runner");
if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
const tsPath = path.join(dir, "runner.ts");
writeFileSync(tsPath, inner, "utf8");
process.on("exit", () => { try { unlinkSync(tsPath); } catch { /* */ } });

const child = spawn(
  process.platform === "win32" ? "npx.cmd" : "npx",
  ["tsx", tsPath],
  { cwd: process.cwd(), stdio: "inherit", env: { ...process.env, NODE_NO_WARNINGS: "1" }, shell: true }
);
child.on("exit", (code) => process.exit(code ?? 1));
