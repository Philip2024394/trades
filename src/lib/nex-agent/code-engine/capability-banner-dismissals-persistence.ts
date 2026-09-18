// src/lib/nex-agent/code-engine/capability-banner-dismissals-persistence.ts
//
// NEX1 · Notes-panel banner dismissal persistence · Fix 17 pattern.
// Deterministic · append-only JSONL · zero LLM · zero network.
//
// Event shape (one JSON per line):
//   { kind: "dismiss", ts, prefix }
//   { kind: "undismiss", ts, prefix }   // reserved for future UX · not used yet
//
// On bootstrap, replay produces the current dismissal set.
// "prefix" is the paraphrase source phrase (first 2 tokens of a refused prompt).

import { existsSync, mkdirSync, appendFileSync, readFileSync, writeFileSync, renameSync, statSync } from "node:fs";
import path from "node:path";

const REPO_ROOT = process.cwd();
const STORE_DIR = path.join(REPO_ROOT, "data", "nex1-notes-panel");
const STORE_FILE = path.join(STORE_DIR, "dismissals.jsonl");

export type DismissalEvent =
  | { readonly kind: "dismiss"; readonly ts: string; readonly prefix: string }
  | { readonly kind: "undismiss"; readonly ts: string; readonly prefix: string };

function ensureDir(): void {
  if (!existsSync(STORE_DIR)) {
    try { mkdirSync(STORE_DIR, { recursive: true }); } catch { /* rare · silent */ }
  }
}

/** Append one event. Returns { ok, error? } · never throws. */
export function appendDismissalEvent(evt: DismissalEvent): { ok: boolean; error?: string } {
  try {
    ensureDir();
    appendFileSync(STORE_FILE, JSON.stringify(evt) + "\n", { encoding: "utf8" });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message.slice(0, 200) };
  }
}

/**
 * Replay the log · returns the current dismissal set. `undismiss` events
 * REMOVE the prefix; missing file returns an empty set.
 */
export function loadDismissals(): { prefixes: string[]; skipped_malformed: number } {
  if (!existsSync(STORE_FILE)) return { prefixes: [], skipped_malformed: 0 };
  let raw = "";
  try { raw = readFileSync(STORE_FILE, "utf8"); } catch { return { prefixes: [], skipped_malformed: 0 }; }
  const set = new Set<string>();
  let skipped = 0;
  for (const line of raw.split("\n")) {
    if (!line.trim()) continue;
    try {
      const e = JSON.parse(line) as DismissalEvent;
      if (e && typeof e.prefix === "string" && e.prefix.trim()) {
        if (e.kind === "dismiss") set.add(e.prefix);
        else if (e.kind === "undismiss") set.delete(e.prefix);
        else skipped++;
      } else {
        skipped++;
      }
    } catch { skipped++; }
  }
  return { prefixes: Array.from(set), skipped_malformed: skipped };
}

export function getDismissalStorePath(): string { return STORE_FILE; }

/**
 * Compact the dismissal log: replay to the current dismissed set, then
 * rewrite as one `dismiss` event per currently-dismissed prefix. Any
 * dismiss+undismiss pair for the same prefix cancels out and both events
 * disappear from the on-disk log. Deterministic · atomic write.
 */
export function compactDismissalLog(): { ok: boolean; before_bytes: number; after_bytes: number; before_events: number; after_events: number; error?: string } {
  if (!existsSync(STORE_FILE)) return { ok: true, before_bytes: 0, after_bytes: 0, before_events: 0, after_events: 0 };
  let before_bytes = 0;
  let before_events = 0;
  let raw = "";
  try { raw = readFileSync(STORE_FILE, "utf8"); before_bytes = statSync(STORE_FILE).size; } catch (e) {
    return { ok: false, before_bytes, after_bytes: 0, before_events: 0, after_events: 0, error: (e as Error).message.slice(0, 200) };
  }
  const set = new Set<string>();
  for (const line of raw.split("\n")) {
    if (!line.trim()) continue;
    before_events++;
    try {
      const e = JSON.parse(line) as DismissalEvent;
      if (e && typeof e.prefix === "string" && e.prefix.trim()) {
        if (e.kind === "dismiss") set.add(e.prefix);
        else if (e.kind === "undismiss") set.delete(e.prefix);
      }
    } catch { /* skip malformed */ }
  }
  const ts = new Date().toISOString();
  const lines: string[] = [];
  const prefixes = Array.from(set).sort();
  for (const p of prefixes) {
    lines.push(JSON.stringify({ kind: "dismiss", ts, prefix: p } satisfies DismissalEvent));
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
