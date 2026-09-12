// src/lib/nex-shadow/store.ts
//
// NEX1 · SHADOW MODE · append-only JSONL store.
// authored_by = master_ai_engineer · founder-authorised 2026-09-12
//
// Discipline:
//   · Append-only. No mutation. No deletion. No overwrite.
//   · Fire-and-forget from the live path (SH-2). Any exception here MUST
//     be caught by the caller · never propagates to the live response.
//   · Founder-audit surface reads the JSONL back in reverse-chronological
//     order for the observation panel.

import { existsSync, mkdirSync, appendFileSync, readFileSync, readdirSync, statSync } from "node:fs";
import { resolve, join } from "node:path";
import type { ShadowRecord, ShadowEvaluation } from "./types";

const STORE_DIR = "data/nex1-shadow/records";

function ensureDir(): string {
  const dir = resolve(process.cwd(), STORE_DIR);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return dir;
}

function currentJsonlPath(): string {
  const dir = ensureDir();
  const day = new Date().toISOString().slice(0, 10); // YYYY-MM-DD · one file per day
  return join(dir, `records-${day}.jsonl`);
}

/**
 * @summary Append a shadow record. Never throws. Any I/O failure returns
 * false silently · SH-2 guarantees the live path is never disturbed.
 */
export function appendRecord(rec: ShadowRecord): boolean {
  try {
    const line = JSON.stringify(rec) + "\n";
    appendFileSync(currentJsonlPath(), line, "utf8");
    return true;
  } catch {
    return false;
  }
}

export interface StoreStats {
  readonly total: number;
  readonly by_evaluation: Readonly<Record<ShadowEvaluation, number>>;
  readonly failures_by_layer: Readonly<Record<string, number>>;
  readonly failures_by_rule: Readonly<Record<string, number>>;
  readonly latest_at: string | null;
  readonly file_count: number;
  readonly total_bytes: number;
}
export function readStats(): StoreStats {
  const dir = ensureDir();
  const empty = {
    total: 0,
    by_evaluation: { SHADOW_MATCH: 0, SHADOW_VARIANCE: 0, SHADOW_FAILURE: 0, SHADOW_UNEVALUATED: 0 } as Record<ShadowEvaluation, number>,
    failures_by_layer: {} as Record<string, number>,
    failures_by_rule: {} as Record<string, number>,
    latest_at: null as string | null,
    file_count: 0,
    total_bytes: 0,
  };
  if (!existsSync(dir)) return empty;
  const files = readdirSync(dir).filter((f) => f.endsWith(".jsonl"));
  let total = 0, bytes = 0;
  const byEval = { SHADOW_MATCH: 0, SHADOW_VARIANCE: 0, SHADOW_FAILURE: 0, SHADOW_UNEVALUATED: 0 } as Record<ShadowEvaluation, number>;
  const byLayer: Record<string, number> = {};
  const byRule: Record<string, number> = {};
  let latest: string | null = null;
  for (const f of files) {
    const p = join(dir, f);
    try {
      const st = statSync(p);
      bytes += st.size;
      const text = readFileSync(p, "utf8");
      for (const line of text.split("\n")) {
        if (!line.trim()) continue;
        try {
          const r: ShadowRecord = JSON.parse(line);
          total++;
          byEval[r.examiner.evaluation] = (byEval[r.examiner.evaluation] ?? 0) + 1;
          if (r.examiner.evaluation === "SHADOW_FAILURE") {
            if (r.examiner.failure_layer) byLayer[r.examiner.failure_layer] = (byLayer[r.examiner.failure_layer] ?? 0) + 1;
            if (r.examiner.failure_rule)  byRule[r.examiner.failure_rule]   = (byRule[r.examiner.failure_rule]   ?? 0) + 1;
          }
          if (!latest || r.at > latest) latest = r.at;
        } catch { /* skip malformed line · fail-safe */ }
      }
    } catch { /* skip unreadable file · fail-safe */ }
  }
  return { total, by_evaluation: byEval, failures_by_layer: byLayer, failures_by_rule: byRule, latest_at: latest, file_count: files.length, total_bytes: bytes };
}

export function readRecent(limit = 25): readonly ShadowRecord[] {
  const dir = ensureDir();
  if (!existsSync(dir)) return [];
  const files = readdirSync(dir).filter((f) => f.endsWith(".jsonl")).sort().reverse();
  const out: ShadowRecord[] = [];
  for (const f of files) {
    if (out.length >= limit) break;
    try {
      const p = join(dir, f);
      const text = readFileSync(p, "utf8");
      const lines = text.split("\n").filter((l) => l.trim()).reverse();
      for (const line of lines) {
        if (out.length >= limit) break;
        try {
          out.push(JSON.parse(line));
        } catch { /* skip */ }
      }
    } catch { /* skip */ }
  }
  return out;
}
