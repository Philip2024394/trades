#!/usr/bin/env node
// predictive-boundary.test.mjs
//
// Proves that no file under src/lib/nex/comms-social/** imports or
// references the Predictive Engine, canonically OR in disguised form.
// Charter S-XII (v0.2) widened scope: Social 1.x must NOT consume
// Predictive AND must not embody local learning against outcomes.

import { spawnSync } from "node:child_process";
import { readdirSync, readFileSync, statSync, writeFileSync, unlinkSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, relative, sep } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO = join(__dirname, "..", "..", "..", "..", "..");
const SCRIPT = join(REPO, "scripts", "verify-comms-social-boundaries.mjs");
const COMMS_SOCIAL = join(REPO, "src", "lib", "nex", "comms-social");

const results = [];
function record(id, pass, note = "") {
  results.push({ id, pass, note });
  process.stdout.write(`  ${pass ? "PASS" : "FAIL"} ${id}${note ? " · " + note : ""}\n`);
}

function walk(dir) {
  const out = [];
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    const s = statSync(p);
    if (s.isDirectory()) {
      // Skip tests/ — test files reference forbidden patterns as literals.
      if (e === "tests") continue;
      out.push(...walk(p));
    } else if (/\.(ts|tsx|mjs|js)$/.test(e) && !e.endsWith(".test.mjs") && !e.endsWith(".test.ts")) {
      out.push(p);
    }
  }
  return out;
}

process.stdout.write("predictive-boundary.test.mjs\n");

// P1 · Grep every file for direct predictive imports.
{
  const files = walk(COMMS_SOCIAL);
  const violations = [];
  for (const f of files) {
    const src = readFileSync(f, "utf8");
    if (/from\s+["']@\/lib\/nex\/predictive/.test(src)) violations.push(relative(REPO, f));
    if (/from\s+["']\.\.\/predictive/.test(src) || /from\s+["']\.\.\/\.\.\/predictive/.test(src)) violations.push(relative(REPO, f));
    if (/nex\.predictions\b/.test(src)) violations.push(relative(REPO, f));
  }
  record("P1 no predictive import in comms-social/**", violations.length === 0, violations.length ? violations.join(",") : "");
}

// P2 · Grep for learning-signal columns / patterns (S-XII widened scope).
{
  const files = walk(COMMS_SOCIAL);
  const banned = [
    /updated_from_outcome/i,
    /learned_at/i,
    /engagement_score_learned/i,
    /auto_tuned_from_engagement/i,
    /model_version.*local/i,
  ];
  const violations = [];
  for (const f of files) {
    const src = readFileSync(f, "utf8");
    for (const re of banned) {
      if (re.test(src)) violations.push({ file: relative(REPO, f), pattern: re.toString() });
    }
  }
  record("P2 no local-learning column patterns in comms-social/**", violations.length === 0, violations.length ? JSON.stringify(violations).slice(0, 100) : "");
}

// P3 · Boundary verifier catches a synthetic predictive import.
{
  const path = join(COMMS_SOCIAL, "__predictive_boundary_probe__.ts");
  writeFileSync(path, `import { getActiveModel } from "@/lib/nex/predictive/registry";\nexport const _ = getActiveModel;\n`, "utf8");
  const r = spawnSync("node", [SCRIPT], { cwd: REPO, encoding: "utf8" });
  const detected = r.status === 1 && /R3/.test(r.stdout);
  try { unlinkSync(path); } catch { /* ignore */ }
  record("P3 verifier catches synthetic predictive import", detected, `exit=${r.status}`);
}

// P4 · Verifier green after cleanup.
{
  const r = spawnSync("node", [SCRIPT], { cwd: REPO, encoding: "utf8" });
  record("P4 verifier green after cleanup", r.status === 0, `exit=${r.status}`);
}

process.stdout.write(`\nSummary · ${results.filter(x => x.pass).length}/${results.length} passed\n`);
process.exit(results.every(x => x.pass) ? 0 : 1);
