// src/lib/nex/master-ai/claude-session-observer.ts
//
// Founder Doctrine 2026-09-10:
// "Master AI Engineer is constantly learning code from Claude and growing
//  in the ability to become code expert. Around the clock. Advises Claude
//  on how to make code more world-class, including UI."
//
// This module is the "learning loop" that observes Claude's edits and
// accumulates deterministic wisdom about our codebase. It runs each time
// the master-ai supervisor fires (every 15 min via Windows Scheduled Task).
//
// Design invariants:
//   1. READ-ONLY on source · never writes to src/
//   2. Deterministic scoring · same input → same score every time
//   3. Zero LLM · pure heuristic analysis (patterns, deltas, structural)
//   4. Append-only ledger · wisdom accumulates, never overwrites history
//   5. Founder-controllable · scoring rules live in this file, easily edited

import { readdirSync, statSync, readFileSync, existsSync, appendFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

// ═══════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════

export interface FileObservation {
  path:            string;   // relative from repo root
  size_bytes:      number;
  line_count:      number;
  mtime_iso:       string;
  mtime_ms:        number;
  ext:             string;
}

export interface FileScore {
  observation:     FileObservation;
  overall:         number;   // 0.0..1.0
  band:            "excellent" | "good" | "acceptable" | "needs_review" | "warn";
  signals:         Record<string, number>;
  notes:           readonly string[];
}

export interface ObserverCycle {
  cycle_iso:        string;
  window_hours:     number;
  files_touched:    number;
  files_scored:     number;
  avg_score:        number;
  new_advice:       readonly string[];
  top_files:        readonly { path: string; score: number; band: string }[];
}

// ═══════════════════════════════════════════════════════════════════
// Scoring signals (deterministic · zero LLM)
// ═══════════════════════════════════════════════════════════════════
//
// Each signal returns 0..1. Weighted sum → overall score.
// Ranges hand-tuned to reflect what Master AI has learned this session.

const SIGNAL_WEIGHTS = Object.freeze({
  file_size_reasonable:     0.15, // penalise 3000+ line files
  has_header_comment:       0.10, // top-of-file docstring
  no_todo_bombs:            0.10, // no TODO / FIXME / XXX
  test_ratio_present:       0.10, // sibling *.test.ts exists
  no_hardcoded_secrets:     0.15, // no obvious API keys / passwords
  imports_clean:            0.10, // no unused / no wildcard *
  error_handling:           0.10, // try/catch present when async
  types_present:            0.10, // TS types not `any` overload
  small_functions:          0.10, // no >200-line functions
});

// ═══════════════════════════════════════════════════════════════════
// Wisdom rules the master AI has already learned this session
// (seed set · will grow as more Claude cycles observed)
// ═══════════════════════════════════════════════════════════════════

const SEED_WISDOM = Object.freeze([
  "Chat resilience wrapper (top-level try/catch) prevents 500s cascading to users · doctrine 2026-09-10",
  "Event-log rotation (5 MB, gzip, 7-day) prevents disk-full crash cycles",
  "Never expose Postgres URLs in error messages · strip credentials BEFORE slicing",
  "Windows scheduled tasks with repetition interval must NOT use AtLogOn trigger (needs elevation) · use Once + RepetitionInterval",
  "Tailwind JIT scans .ts files for class-name patterns · compact regex character-classes with dash-colon-period can corrupt globals.css",
  "React useEffect body must return only a cleanup function or undefined · arrow-body from scrollIntoView breaks it",
  "React map() elements need key= on the actual returned element, not on wrapper components",
  "Local Postgres 5433 is 5.4x faster than Supabase pooler · always prefer local for hot paths",
  "OSM Overpass API returns 400-500 accommodation records per Indonesian city in <10s",
  "Deterministic composer returns unknown when city missing · loosen promotion gate OR pre-populate prior_list",
  "Bilingual jailbreak defence requires Indonesian + Japanese patterns · English-only misses regional attacks",
  "MinIO Windows binary is 108 MB · runs standalone, no Docker needed",
  "Truth score per request must NEVER block content · signal only",
]);

// ═══════════════════════════════════════════════════════════════════
// File observation
// ═══════════════════════════════════════════════════════════════════

const OBSERVED_EXTS = new Set(["ts", "tsx", "mjs", "js", "sql", "md"]);
const SKIP_DIRS = new Set(["node_modules", ".next", ".git", "dist", "build", "coverage", "_cache", "harvest-osm"]);

function walkForRecent(root: string, cutoffMs: number, out: FileObservation[]): void {
  let entries: string[] = [];
  try { entries = readdirSync(root); } catch { return; }
  for (const name of entries) {
    if (SKIP_DIRS.has(name)) continue;
    if (name.startsWith(".")) continue;
    const full = join(root, name);
    let st;
    try { st = statSync(full); } catch { continue; }
    if (st.isDirectory()) { walkForRecent(full, cutoffMs, out); continue; }
    if (!st.isFile()) continue;
    if (st.mtimeMs < cutoffMs) continue;
    const m = /\.([a-z0-9]+)$/i.exec(name);
    const ext = m ? m[1].toLowerCase() : "";
    if (!OBSERVED_EXTS.has(ext)) continue;
    out.push({
      path:       full,
      size_bytes: st.size,
      line_count: 0, // filled during score
      mtime_iso:  new Date(st.mtimeMs).toISOString(),
      mtime_ms:   st.mtimeMs,
      ext,
    });
  }
}

// ═══════════════════════════════════════════════════════════════════
// Signal computations (deterministic)
// ═══════════════════════════════════════════════════════════════════

function scoreFile(obs: FileObservation): FileScore {
  let text = "";
  try { text = readFileSync(obs.path, "utf8"); } catch { /* orphan */ }
  const lines = text.split("\n");
  obs.line_count = lines.length;

  const signals: Record<string, number> = {};
  const notes: string[] = [];

  // 1. file_size_reasonable
  const loc = obs.line_count;
  signals.file_size_reasonable = loc < 300 ? 1.0
                              : loc < 800 ? 0.9
                              : loc < 1500 ? 0.7
                              : loc < 3000 ? 0.5
                              : 0.3;
  if (loc >= 3000) notes.push(`file_over_3000_lines:${loc}`);

  // 2. has_header_comment
  const first10 = lines.slice(0, 10).join("\n");
  signals.has_header_comment = /^(?:\/\/|\/\*|#|--)/.test(lines[0] ?? "") && first10.length > 40 ? 1.0 : 0.4;
  if (signals.has_header_comment < 1) notes.push("no_header_docstring");

  // 3. no_todo_bombs
  const todoCount = (text.match(/\b(?:TODO|FIXME|XXX|HACK)\b/gi) ?? []).length;
  signals.no_todo_bombs = todoCount === 0 ? 1.0 : todoCount < 3 ? 0.7 : 0.3;
  if (todoCount >= 3) notes.push(`todo_bombs:${todoCount}`);

  // 4. test_ratio_present (sibling .test.ts existence)
  const testSibling = obs.path.replace(/\.(ts|tsx|mjs)$/, ".test.$1");
  signals.test_ratio_present = existsSync(testSibling) ? 1.0 : (obs.ext === "md" || obs.ext === "sql" ? 1.0 : 0.5);

  // 5. no_hardcoded_secrets (naive · covers common leaks)
  const secretMatches =
    (text.match(/\bAKIA[0-9A-Z]{16}\b/g) ?? []).length +          // AWS key
    (text.match(/sk-[A-Za-z0-9]{20,}/g) ?? []).length +           // openai/stripe live
    (text.match(/\b[A-Za-z0-9]{32,}@[a-z0-9.-]+\.[a-z]{2,}\b/g) ?? []).length + // long hash-like near email
    (text.match(/postgres(?:ql)?:\/\/[^:@]+:[^@\s]+@/gi) ?? []).length; // pg url with pw
  signals.no_hardcoded_secrets = secretMatches === 0 ? 1.0 : 0.0;
  if (secretMatches > 0) notes.push(`secrets_detected:${secretMatches}`);

  // 6. imports_clean (no wildcard imports · light heuristic)
  const wildcards = (text.match(/^import\s+\*\s+as\s+/gm) ?? []).length;
  signals.imports_clean = wildcards === 0 ? 1.0 : wildcards < 3 ? 0.8 : 0.5;
  if (wildcards >= 3) notes.push(`many_wildcard_imports:${wildcards}`);

  // 7. error_handling (async without try in same fn is a smell)
  const asyncFns = (text.match(/\basync\s+function\b|async\s*\(/g) ?? []).length;
  const tryCatches = (text.match(/\btry\s*\{/g) ?? []).length;
  if (asyncFns === 0) signals.error_handling = 1.0;
  else if (tryCatches >= asyncFns * 0.4) signals.error_handling = 1.0;
  else if (tryCatches > 0) signals.error_handling = 0.7;
  else signals.error_handling = 0.4;
  if (signals.error_handling < 0.7) notes.push(`async_without_try_catch:${asyncFns}fns_${tryCatches}tries`);

  // 8. types_present (any-abuse detection · TS files only)
  if (obs.ext === "ts" || obs.ext === "tsx") {
    const anyCount = (text.match(/\bany\b(?!\s*[,)])/g) ?? []).length;
    signals.types_present = anyCount === 0 ? 1.0 : anyCount < 5 ? 0.8 : anyCount < 20 ? 0.6 : 0.3;
    if (anyCount >= 20) notes.push(`any_overuse:${anyCount}`);
  } else {
    signals.types_present = 1.0;
  }

  // 9. small_functions (no function block > 200 lines · rough scan)
  const fnStarts = text.split(/(?:^|\s)(?:function|async function|\)\s*=>|const\s+\w+\s*=\s*\()/gm).length - 1;
  const avgFnLines = fnStarts > 0 ? loc / fnStarts : loc;
  signals.small_functions = avgFnLines < 50 ? 1.0 : avgFnLines < 100 ? 0.8 : avgFnLines < 200 ? 0.6 : 0.3;
  if (avgFnLines >= 200) notes.push(`avg_fn_lines:${Math.round(avgFnLines)}`);

  // Roll up
  let overall = 0;
  for (const [k, w] of Object.entries(SIGNAL_WEIGHTS)) {
    overall += (signals[k] ?? 0) * w;
  }
  overall = Math.round(overall * 1000) / 1000;

  const band: FileScore["band"] =
      overall >= 0.90 ? "excellent"
    : overall >= 0.75 ? "good"
    : overall >= 0.60 ? "acceptable"
    : overall >= 0.40 ? "needs_review"
    : "warn";

  return { observation: obs, overall, band, signals, notes };
}

// ═══════════════════════════════════════════════════════════════════
// Cycle · called by the master-ai supervisor
// ═══════════════════════════════════════════════════════════════════

const LEDGER_DIR = process.env.NEX_MASTER_AI_DATA_ROOT
  ?? join(process.cwd(), "data", "master-ai");

function ensureLedgerDir(): void {
  try { if (!existsSync(LEDGER_DIR)) mkdirSync(LEDGER_DIR, { recursive: true }); } catch { /* ignore */ }
}

/**
 * Run one observation cycle · scan files changed in the last N hours,
 * score each, append a summary row to the ledger, return the cycle.
 * Called every 15 min by the master-ai supervisor.
 */
export function runObserverCycle(input: {
  root:       string;
  window_hours?: number;
  max_files?:    number;
} = { root: process.cwd() }): ObserverCycle {
  const window_hours = input.window_hours ?? 24;
  const max_files    = input.max_files ?? 50;
  const cutoff = Date.now() - window_hours * 60 * 60 * 1000;

  const observations: FileObservation[] = [];
  walkForRecent(join(input.root, "src"), cutoff, observations);
  walkForRecent(join(input.root, "scripts"), cutoff, observations);
  walkForRecent(join(input.root, "docs", "DECISIONS"), cutoff, observations);

  // Sort by mtime desc · take the freshest max_files
  observations.sort((a, b) => b.mtime_ms - a.mtime_ms);
  const sample = observations.slice(0, max_files);

  const scores = sample.map(scoreFile);
  const avg = scores.length === 0 ? 0
    : scores.reduce((s, x) => s + x.overall, 0) / scores.length;

  // Generate advice from recent low-scoring files
  const advice: string[] = [];
  for (const s of scores) {
    if (s.band === "warn" || s.band === "needs_review") {
      for (const n of s.notes) {
        const line = `${s.observation.path.replace(input.root + "\\", "").replace(/\\/g, "/")} · ${n}`;
        if (!advice.includes(line) && advice.length < 20) advice.push(line);
      }
    }
  }

  const cycle: ObserverCycle = {
    cycle_iso:     new Date().toISOString(),
    window_hours,
    files_touched: observations.length,
    files_scored:  scores.length,
    avg_score:     Number(avg.toFixed(3)),
    new_advice:    advice,
    top_files: scores.slice(0, 10).map((s) => ({
      path:  s.observation.path.replace(input.root + "\\", "").replace(/\\/g, "/"),
      score: s.overall,
      band:  s.band,
    })),
  };

  // Append to ledger
  ensureLedgerDir();
  try {
    appendFileSync(
      join(LEDGER_DIR, "claude-observer.jsonl"),
      JSON.stringify(cycle) + "\n",
      "utf8",
    );
  } catch { /* never fail the cycle */ }

  return cycle;
}

/**
 * Return the accumulated wisdom · seed + observations · for Claude to
 * read at session start. Bounded to the most useful 40 lines.
 */
export function readAdvice(): { seed: readonly string[]; recent_cycles: number; observations: readonly string[] } {
  const observations: string[] = [];
  try {
    const p = join(LEDGER_DIR, "claude-observer.jsonl");
    if (existsSync(p)) {
      const raw = readFileSync(p, "utf8");
      const lines = raw.split("\n").filter((l) => l.trim().length > 0);
      const recent = lines.slice(-10);
      for (const l of recent) {
        try {
          const c = JSON.parse(l) as ObserverCycle;
          for (const a of c.new_advice) if (!observations.includes(a) && observations.length < 30) observations.push(a);
        } catch { /* skip */ }
      }
      return { seed: SEED_WISDOM, recent_cycles: lines.length, observations };
    }
  } catch { /* fall through */ }
  return { seed: SEED_WISDOM, recent_cycles: 0, observations };
}
