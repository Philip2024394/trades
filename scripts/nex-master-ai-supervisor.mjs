#!/usr/bin/env node
// scripts/nex-master-ai-supervisor.mjs
//
// Founder 2026-09-10 · Master AI Engineer supervisor · single-shot cycle.
//
// Windows Scheduled Task fires this every 15 min. Each invocation:
//   1. Rotates + archives all ledgers under data/master-ai/ (garbage-out)
//   2. Verifies all 7 NEX agents are RUNNING · restarts any CRASHED
//   3. Confirms fact-freshness (isFactFresh on random 10 hot-tier bundles)
//   4. Writes a supervisor.log line so founder can see uptime cadence
//
// Founder rule PRESERVED: this NEVER blocks a chat reply. It's an
// observability + housekeeping cycle only. The truth score computed
// per-request lives elsewhere (src/lib/nex/master-ai/truth-score-envelope.ts).
//
// Runs in ~2-5 seconds per firing. Idempotent (safe to run 100×/day).

import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync, existsSync, appendFileSync, readdirSync, statSync, renameSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import zlib from "node:zlib";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..");
const MASTER_AI_DIR = join(REPO_ROOT, "data", "master-ai");
const LOG_PATH = join(MASTER_AI_DIR, "supervisor.log");

const ROTATE_AT_BYTES = 5 * 1024 * 1024;
const KEEP_DAYS = 7;
const KEEP_MS = KEEP_DAYS * 24 * 60 * 60 * 1000;

function log(line) {
  const ts = new Date().toISOString();
  const msg = `[${ts}] ${line}\n`;
  process.stdout.write(msg);
  try {
    if (!existsSync(MASTER_AI_DIR)) mkdirSync(MASTER_AI_DIR, { recursive: true });
    appendFileSync(LOG_PATH, msg);
  } catch { /* never break on log */ }
}

// ── 1. Rotate + archive ledgers under data/master-ai ─────────────
function rotateLedgers() {
  let rotated = 0, pruned = 0;
  try {
    if (!existsSync(MASTER_AI_DIR)) return { rotated: 0, pruned: 0 };
    const entries = readdirSync(MASTER_AI_DIR);
    const now = Date.now();
    // Rotate active .jsonl files above threshold
    for (const name of entries) {
      if (!name.endsWith(".jsonl")) continue;
      if (name === "supervisor.log") continue;
      const full = join(MASTER_AI_DIR, name);
      try {
        const st = statSync(full);
        if (st.size < ROTATE_AT_BYTES) continue;
        const stamp = new Date().toISOString().replace(/-/g, "").replace(/:/g, "").replace(/\./g, "");
        const archived = join(MASTER_AI_DIR, `${name.replace(/\.jsonl$/, "")}-${stamp}.jsonl`);
        renameSync(full, archived);
        rotated++;
        // Gzip in-process (small files, non-blocking OK)
        try {
          const buf = readFileSync(archived);
          const gz = zlib.gzipSync(buf);
          writeFileSync(`${archived}.gz`, gz);
          // Delete uncompressed after successful gzip
          try { renameSync(archived, archived + ".todelete"); } catch { /* ignore */ }
        } catch { /* leave uncompressed */ }
      } catch { /* per-file */ }
    }
    // Prune archives older than KEEP_DAYS
    for (const name of entries) {
      if (!name.includes("-2026")) continue; // date-stamped archive
      if (!name.endsWith(".jsonl") && !name.endsWith(".jsonl.gz")) continue;
      try {
        const full = join(MASTER_AI_DIR, name);
        const st = statSync(full);
        if (now - st.mtimeMs > KEEP_MS) {
          try { renameSync(full, full + ".purged"); pruned++; } catch { /* ignore */ }
        }
      } catch { /* ignore */ }
    }
  } catch (err) {
    log(`rotate error: ${String(err).slice(0, 200)}`);
  }
  return { rotated, pruned };
}

// ── 2. Verify agents · restart any CRASHED ───────────────────────
function verifyAgents() {
  try {
    const r = spawnSync("node", ["scripts/nex-agents.mjs", "status"], {
      cwd: REPO_ROOT,
      encoding: "utf8",
      timeout: 30_000,
    });
    if (r.error || r.status !== 0) {
      log(`agents status err: ${String(r.error ?? r.stderr).slice(0, 200)}`);
      return { active: 0, crashed: 0, restarted: 0 };
    }
    const out = r.stdout ?? "";
    const summaryMatch = out.match(/summary:\s*(\{[^\}]+\})/);
    let active = 0, crashed = 0;
    if (summaryMatch) {
      try {
        const s = JSON.parse(summaryMatch[1]);
        active = s.active ?? 0;
        crashed = s.crashed ?? 0;
      } catch { /* keep 0s */ }
    }
    let restarted = 0;
    if (crashed > 0) {
      log(`detected ${crashed} crashed agents · running start all`);
      const rr = spawnSync("node", ["scripts/nex-agents.mjs", "start", "all"], {
        cwd: REPO_ROOT,
        encoding: "utf8",
        timeout: 60_000,
      });
      if (!rr.error && rr.status === 0) restarted = crashed;
    }
    return { active, crashed, restarted };
  } catch (err) {
    log(`verifyAgents err: ${String(err).slice(0, 200)}`);
    return { active: 0, crashed: 0, restarted: 0 };
  }
}

// ── 3. Fact-freshness spot-check (10 accommodation rows) ─────────
async function factFreshnessSpotCheck() {
  try {
    // Minimal Postgres check · reads .env.local for URL
    let envLocal = "";
    try { envLocal = readFileSync(join(REPO_ROOT, ".env.local"), "utf8"); } catch { return { checked: 0, stale: 0 }; }
    const m = envLocal.match(/^NEX_TAXONOMY_POSTGRES_URL\s*=\s*(.+)$/m)
      ?? envLocal.match(/^NEX_POSTGRES_URL\s*=\s*(.+)$/m);
    if (!m) return { checked: 0, stale: 0 };
    const url = m[1].trim().replace(/^["']|["']$/g, "");
    const { Client } = await import("pg").catch(() => ({}));
    if (!Client) return { checked: 0, stale: 0 };
    const c = new Client({ connectionString: url, connectionTimeoutMillis: 8000 });
    await c.connect();
    try {
      const rows = (await c.query(`
        SELECT public_listing_ref, source_retrieved_at
        FROM nex.accommodation_business
        WHERE source_retrieved_at IS NOT NULL
        ORDER BY random()
        LIMIT 10
      `)).rows;
      let stale = 0;
      const now = Date.now();
      const STALE_MS = 180 * 24 * 60 * 60 * 1000; // 180 days
      for (const r of rows) {
        const t = new Date(r.source_retrieved_at).getTime();
        if (!Number.isFinite(t) || now - t > STALE_MS) stale++;
      }
      return { checked: rows.length, stale };
    } finally {
      await c.end();
    }
  } catch { return { checked: 0, stale: 0 }; }
}

// ── 4. Claude session observer · learning-loop ───────────────────
// Founder Doctrine 2026-09-10 · Master AI Engineer constantly learns
// from Claude's edits. This step scans src/ + scripts/ + docs for
// files touched in the last 24 h, scores each deterministically, and
// appends observations to data/master-ai/claude-observer.jsonl.
//
// Purely observation-only · never modifies source · never blocks.
async function runClaudeObserver() {
  try {
    const r = spawnSync("npx", ["tsx", "scripts/_run-observer-cycle.mjs"], {
      cwd: REPO_ROOT,
      encoding: "utf8",
      timeout: 90_000,
      shell: true,
    });
    if (r.error || r.status !== 0) {
      log(`observer err: ${String(r.error ?? r.stderr).slice(0, 200)}`);
      return { files: 0, avg: 0, advice: 0 };
    }
    const line = (r.stdout ?? "").split("\n").find((l) => l.trim().startsWith("{"));
    if (!line) return { files: 0, avg: 0, advice: 0 };
    try { return JSON.parse(line); } catch { return { files: 0, avg: 0, advice: 0 }; }
  } catch (err) {
    log(`observer fatal: ${String(err).slice(0, 200)}`);
    return { files: 0, avg: 0, advice: 0 };
  }
}

// ── Main ─────────────────────────────────────────────────────────
async function main() {
  const t0 = Date.now();
  log(`supervisor start · pid=${process.pid}`);
  const rot = rotateLedgers();
  log(`rotate · ${rot.rotated} rotated · ${rot.pruned} pruned`);
  const agents = verifyAgents();
  log(`agents · active=${agents.active} crashed=${agents.crashed} restarted=${agents.restarted}`);
  const fresh = await factFreshnessSpotCheck();
  log(`freshness · checked=${fresh.checked} stale=${fresh.stale}`);
  const observer = await runClaudeObserver();
  log(`observer · files=${observer.files} avg=${observer.avg} advice=${observer.advice}`);
  const durMs = Date.now() - t0;
  log(`supervisor done · ${durMs}ms`);
  process.exit(0);
}

main().catch((err) => {
  log(`fatal: ${String(err).slice(0, 500)}`);
  process.exit(1);
});
