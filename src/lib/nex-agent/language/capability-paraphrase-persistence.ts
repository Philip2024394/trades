// src/lib/nex-agent/language/capability-paraphrase-persistence.ts
//
// NEX1 · C10 Phase 4a · JSONL persistence for the paraphrase library.
// Follows the Fix 17 pattern (data/nex1-*/*.jsonl · append-only · deterministic).
//
// Two event kinds are appended:
//   { kind: "upsert", ts, source, canonical, target_slug, entry_kind, provenance }
//   { kind: "touch",  ts, canonical }
//
// On bootstrap, `replayEvents()` streams the file and rebuilds the (source →
// entry) state deterministically. Missing file → treated as empty log · no
// error · library still boots with the seed pack.
//
// Zero LLM · zero network · zero shelling out · only node:fs.

import { existsSync, mkdirSync, appendFileSync, readFileSync, writeFileSync, renameSync, statSync } from "node:fs";
import path from "node:path";

const REPO_ROOT = process.cwd();
const STORE_DIR = path.join(REPO_ROOT, "data", "nex1-paraphrase");
const STORE_FILE = path.join(STORE_DIR, "entries.jsonl");

export type PersistenceEvent =
  | {
      readonly kind: "upsert";
      readonly ts: string;
      readonly source: string;
      readonly canonical: string;
      readonly target_slug: string;
      readonly entry_kind: "seed" | "founder_correction" | "harvested" | "manual";
      readonly provenance: string;
    }
  | {
      readonly kind: "touch";
      readonly ts: string;
      readonly canonical: string;
    };

function ensureDir(): void {
  if (!existsSync(STORE_DIR)) {
    try { mkdirSync(STORE_DIR, { recursive: true }); } catch { /* ignore · rare */ }
  }
}

/**
 * Append one event synchronously. Returns { ok, error }. Persistence failure
 * NEVER converts silently to success · caller may choose to log or ignore.
 */
export function appendEvent(evt: PersistenceEvent): { ok: boolean; error?: string } {
  try {
    ensureDir();
    appendFileSync(STORE_FILE, JSON.stringify(evt) + "\n", { encoding: "utf8" });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message.slice(0, 200) };
  }
}

/**
 * Read the JSONL log and yield events in order. Malformed lines are skipped
 * with a soft warning in the return payload · never throws.
 */
export function replayEvents(): { events: PersistenceEvent[]; skipped_malformed: number } {
  if (!existsSync(STORE_FILE)) return { events: [], skipped_malformed: 0 };
  let raw = "";
  try { raw = readFileSync(STORE_FILE, "utf8"); } catch { return { events: [], skipped_malformed: 0 }; }
  const events: PersistenceEvent[] = [];
  let skipped = 0;
  for (const line of raw.split("\n")) {
    if (!line.trim()) continue;
    try {
      const parsed = JSON.parse(line) as PersistenceEvent;
      if (parsed && (parsed.kind === "upsert" || parsed.kind === "touch")) {
        events.push(parsed);
      } else {
        skipped++;
      }
    } catch {
      skipped++;
    }
  }
  return { events, skipped_malformed: skipped };
}

/** Diagnostic surface · used by the /api/nex1/paraphrase snapshot for observability. */
export function getStorePath(): string { return STORE_FILE; }

/**
 * Compact the paraphrase log: replay every event, collapse to the final state
 * (one `upsert` per canonical with cumulative `match_count` baked into an
 * `upsert.match_count` extension field · but since our upsert schema doesn't
 * carry match_count, we compact by dropping ALL touch events and keeping ONE
 * upsert per canonical). Match_count history is lost by compaction · that's
 * the trade the founder is choosing when they hit compact.
 *
 * Atomic-in-effect: write .tmp, then rename over the target.
 */
export function compactParaphraseLog(): { ok: boolean; before_bytes: number; after_bytes: number; before_events: number; after_events: number; error?: string } {
  if (!existsSync(STORE_FILE)) return { ok: true, before_bytes: 0, after_bytes: 0, before_events: 0, after_events: 0 };
  let before_bytes = 0;
  let before_events = 0;
  let raw = "";
  try { raw = readFileSync(STORE_FILE, "utf8"); before_bytes = statSync(STORE_FILE).size; } catch (e) {
    return { ok: false, before_bytes, after_bytes: 0, before_events: 0, after_events: 0, error: (e as Error).message.slice(0, 200) };
  }

  // Replay to compute latest upsert per canonical.
  const latestUpsert = new Map<string, PersistenceEvent>();
  for (const line of raw.split("\n")) {
    if (!line.trim()) continue;
    before_events++;
    try {
      const e = JSON.parse(line) as PersistenceEvent;
      if (e.kind === "upsert") latestUpsert.set(e.canonical, e);
      // touch events discarded during compaction · match_count lives on
      // in-memory (was applied during replay by the library bootstrap) but
      // the on-disk log is rewritten fresh.
    } catch { /* skip malformed */ }
  }

  // Rewrite as one line per canonical. Sorted by canonical for determinism.
  const lines: string[] = [];
  const canonicals = Array.from(latestUpsert.keys()).sort();
  for (const c of canonicals) {
    lines.push(JSON.stringify(latestUpsert.get(c)));
  }
  const payload = lines.join("\n") + (lines.length > 0 ? "\n" : "");

  try {
    ensureDir();
    const tmp = STORE_FILE + ".tmp";
    writeFileSync(tmp, payload, { encoding: "utf8" });
    renameSync(tmp, STORE_FILE);
  } catch (e) {
    return { ok: false, before_bytes, after_bytes: 0, before_events, after_events: 0, error: (e as Error).message.slice(0, 200) };
  }
  const after_bytes = existsSync(STORE_FILE) ? statSync(STORE_FILE).size : 0;
  return { ok: true, before_bytes, after_bytes, before_events, after_events: lines.length };
}

