// src/lib/nex-agent/code-engine/capability-envelope-history-persistence.ts
//
// NEX1 · Verdict-history persistence · Fix 17 pattern.
// One JSONL per task_id · append-only · deterministic.
//
// Each line is one envelope + timestamp:
//   { ts, envelope }
//
// Zero LLM · zero network · task_id regex-guarded against path escape.

import { existsSync, mkdirSync, appendFileSync, readFileSync } from "node:fs";
import path from "node:path";
import type { UncertaintyEnvelope } from "./capability-uncertainty-envelope";

const REPO_ROOT = process.cwd();
const STORE_DIR = path.join(REPO_ROOT, "data", "nex1-envelope-history");

const SAFE_ID_RE = /^[A-Za-z0-9_-]+$/;

function ensureDir(): void {
  if (!existsSync(STORE_DIR)) {
    try { mkdirSync(STORE_DIR, { recursive: true }); } catch { /* rare · silent */ }
  }
}

interface HistoryEntry {
  readonly ts: string;
  readonly envelope: UncertaintyEnvelope<unknown>;
}

/** Fire-and-forget append. Silently no-ops on unsafe task_id or fs failure. */
export function logEnvelope(taskId: string, envelope: UncertaintyEnvelope<unknown>): void {
  if (!SAFE_ID_RE.test(taskId)) return;
  try {
    ensureDir();
    const file = path.join(STORE_DIR, `${taskId}.jsonl`);
    const entry: HistoryEntry = { ts: new Date().toISOString(), envelope };
    appendFileSync(file, JSON.stringify(entry) + "\n", { encoding: "utf8" });
  } catch { /* silent · caller cannot fail because of persistence */ }
}

/** Read the trail for one task. Missing file → empty list. Malformed lines skipped. */
export function loadEnvelopeHistory(taskId: string): { entries: HistoryEntry[]; skipped_malformed: number } {
  if (!SAFE_ID_RE.test(taskId)) return { entries: [], skipped_malformed: 0 };
  const file = path.join(STORE_DIR, `${taskId}.jsonl`);
  if (!existsSync(file)) return { entries: [], skipped_malformed: 0 };
  let raw = "";
  try { raw = readFileSync(file, "utf8"); } catch { return { entries: [], skipped_malformed: 0 }; }
  const entries: HistoryEntry[] = [];
  let skipped = 0;
  for (const line of raw.split("\n")) {
    if (!line.trim()) continue;
    try {
      const parsed = JSON.parse(line) as HistoryEntry;
      if (parsed && parsed.envelope && typeof parsed.ts === "string") entries.push(parsed);
      else skipped++;
    } catch { skipped++; }
  }
  return { entries, skipped_malformed: skipped };
}

export function getStoreDir(): string { return STORE_DIR; }
