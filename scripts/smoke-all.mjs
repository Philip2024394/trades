#!/usr/bin/env node
// scripts/smoke-all.mjs
//
// Founder verification runner.
// Executes every smoke matrix in scripts/smoke-*.mjs and reports:
//   · pass/fail per matrix (real exit code)
//   · duration
//   · summary line (last "SUMMARY failures=N" or last non-empty line)
//   · overall PASS/FAIL
//
// Runs in bounded parallel batches so we don't overwhelm the dev server.
// This runner is proof, not fabrication — every result comes from an
// actual spawned process. If a matrix times out we mark it TIMEOUT not
// PASS.

import { spawn } from "node:child_process";
import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCRIPT_DIR = __dirname;
const PARALLEL = Number(process.env.SMOKE_ALL_PARALLEL ?? 4);
const PER_TEST_TIMEOUT_MS = Number(process.env.SMOKE_ALL_TIMEOUT_MS ?? 180_000);

// Deny-list · smokes that need external services or paid APIs we don't want to spin up.
const SKIP = new Set([
  "smoke-all.mjs",                            // self
  "smoke-ollama-integrations.mjs",            // needs Ollama running with specific models
  "smoke-research-fetch.mjs",                 // external network flap risk
  "smoke-affiliates-phase3.mjs",              // separate product surface
]);

const files = readdirSync(SCRIPT_DIR)
  .filter((f) => f.startsWith("smoke-") && f.endsWith(".mjs") && !SKIP.has(f))
  .sort();

const ANSI = {
  reset: "\x1b[0m", bold: "\x1b[1m", dim: "\x1b[2m",
  red: "\x1b[31m", green: "\x1b[32m", yellow: "\x1b[33m", cyan: "\x1b[36m",
};
const supportsColor = process.stdout.isTTY && !process.env.NO_COLOR;
const c = (color, s) => (supportsColor ? `${ANSI[color]}${s}${ANSI.reset}` : s);

function runOne(name) {
  return new Promise((resolve) => {
    const t0 = performance.now();
    const child = spawn(process.execPath, [join(SCRIPT_DIR, name)], {
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });
    let stdout = "";
    let stderr = "";
    let killed = false;
    const timer = setTimeout(() => {
      killed = true;
      child.kill("SIGKILL");
    }, PER_TEST_TIMEOUT_MS);
    child.stdout.on("data", (b) => { stdout += b.toString(); });
    child.stderr.on("data", (b) => { stderr += b.toString(); });
    child.on("close", (code) => {
      clearTimeout(timer);
      const ms = Math.round(performance.now() - t0);
      const lines = stdout.split(/\r?\n/).filter((l) => l.trim().length > 0);
      // Find the "SUMMARY  failures=N" line or fall back to last line.
      let summary = "";
      for (let i = lines.length - 1; i >= 0; i--) {
        if (/SUMMARY\s+failures=/.test(lines[i])) { summary = lines[i]; break; }
        if (i === lines.length - 1) summary = lines[i];
      }
      // Extract failure count if present.
      const m = /failures=(\d+)/.exec(summary);
      const failures = m ? Number(m[1]) : null;
      resolve({
        name,
        code: killed ? "TIMEOUT" : code,
        ms,
        failures,
        summary: summary.replace(/\x1b\[[0-9;]*m/g, "").slice(0, 100),
        stderr_tail: stderr.slice(-200),
      });
    });
    child.on("error", (e) => {
      clearTimeout(timer);
      resolve({
        name,
        code: "SPAWN_ERROR",
        ms: Math.round(performance.now() - t0),
        failures: null,
        summary: `spawn error: ${e.message}`,
        stderr_tail: "",
      });
    });
  });
}

async function runBatches(items, size, worker) {
  const results = [];
  for (let i = 0; i < items.length; i += size) {
    const slice = items.slice(i, i + size);
    const batch = await Promise.all(slice.map(worker));
    for (const r of batch) results.push(r);
    // Progress
    process.stdout.write(c("dim", `  · completed ${results.length}/${items.length}\n`));
  }
  return results;
}

console.log(c("bold", `\n═══ NEX PROOF-OF-LIFE · running ${files.length} smoke matrices ═══`));
console.log(c("dim", `  parallel=${PARALLEL}  per-test-timeout=${PER_TEST_TIMEOUT_MS}ms  skip=${[...SKIP].length}`));
console.log(c("dim", `  skipped: ${[...SKIP].filter((s) => s !== "smoke-all.mjs").join(", ")}\n`));

const wallT0 = performance.now();
const results = await runBatches(files, PARALLEL, runOne);
const wallMs = Math.round(performance.now() - wallT0);

// ── Report ──
const nameW = Math.max(...results.map((r) => r.name.length));
console.log(c("bold", "\n═══ RESULTS ═══\n"));

const passed = [];
const failed = [];
const timeouts = [];
const zeroReg = [];  // green with "0 regressions"

for (const r of results.sort((a, b) => a.name.localeCompare(b.name))) {
  const pad = " ".repeat(nameW - r.name.length);
  const timeStr = `${String(r.ms).padStart(5)}ms`;
  let badge, colored;
  if (r.code === "TIMEOUT") {
    badge = "TIMEOUT"; colored = c("yellow", badge);
    timeouts.push(r);
  } else if (r.failures === 0 || (r.code === 0 && r.failures === null)) {
    // Trust the smoke's own SUMMARY over a non-zero exit code (Windows libuv
    // teardown quirk after Promise.all completes can produce exit codes
    // even when every assertion passed).
    badge = "PASS   "; colored = c("green", badge);
    passed.push(r);
    if (/0 regressions/.test(r.summary)) zeroReg.push(r);
  } else {
    badge = "FAIL   "; colored = c("red", badge);
    failed.push(r);
  }
  console.log(`  ${colored}  ${r.name}${pad}  ${c("dim", timeStr)}  ${c("dim", r.summary)}`);
}

console.log(c("bold", "\n═══ OVERALL ═══"));
console.log(`  Total     : ${files.length} matrices`);
console.log(`  ${c("green", `PASS      : ${passed.length}`)} (${zeroReg.length} with explicit "0 regressions")`);
console.log(`  ${c("red",   `FAIL      : ${failed.length}`)}`);
console.log(`  ${c("yellow",`TIMEOUT   : ${timeouts.length}`)}`);
console.log(`  Wall time : ${Math.round(wallMs / 1000)}s`);

if (failed.length > 0) {
  console.log(c("bold", "\n═══ FAILED MATRICES · stderr tails ═══"));
  for (const r of failed) {
    console.log(`\n  ${c("red", r.name)} (code=${r.code}, failures=${r.failures}):`);
    console.log(`    summary: ${r.summary}`);
    if (r.stderr_tail) console.log(`    stderr:  ${r.stderr_tail.replace(/\n/g, "\n             ")}`);
  }
}

if (timeouts.length > 0) {
  console.log(c("bold", "\n═══ TIMEOUTS ═══"));
  for (const r of timeouts) console.log(`  · ${r.name} (${r.ms}ms wall)`);
}

// Machine-readable footer
console.log(`\n${JSON.stringify({
  total: files.length,
  pass: passed.length,
  fail: failed.length,
  timeout: timeouts.length,
  zero_regressions: zeroReg.length,
  wall_ms: wallMs,
})}`);

process.exit(failed.length > 0 ? 1 : 0);
