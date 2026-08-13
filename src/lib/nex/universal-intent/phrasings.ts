// Loads the Universal Intent phrasing corpus from data/nex-intent-phrasings.jsonl.
// Server-only (uses fs). For client-safe access, use the API endpoint at
// src/app/api/nex/universal-intent/route.ts.
//
// Doctrine: docs/brains/nex-master-intent-library-v1-philip-2026-08-03.md
// Corpus: data/nex-intent-phrasings.jsonl (append-only)

import fs from "node:fs";
import path from "node:path";
import type { PhrasingRow } from "./types";

const CORPUS_PATH = path.join(process.cwd(), "data", "nex-intent-phrasings.jsonl");

let _cache: PhrasingRow[] | null = null;

/** Load the phrasing corpus. Cached in-memory after first read. */
export function loadPhrasings(): PhrasingRow[] {
  if (_cache !== null) return _cache;
  if (!fs.existsSync(CORPUS_PATH)) {
    _cache = [];
    return _cache;
  }
  const raw = fs.readFileSync(CORPUS_PATH, "utf8");
  const rows: PhrasingRow[] = [];
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const row = JSON.parse(trimmed) as PhrasingRow;
      if (row.phrasing && row.layer1_verb && row.layer2_domain && row.layer3_capability) {
        rows.push(row);
      }
    } catch {
      // Skip malformed rows silently — telemetry logging is a follow-up.
    }
  }
  _cache = rows;
  return _cache;
}

/** Reset the in-memory cache. Called when the corpus is updated at runtime. */
export function resetPhrasingsCache(): void {
  _cache = null;
}

/** Append a new phrasing to the corpus (server-only). */
export function appendPhrasing(row: PhrasingRow): void {
  const line = JSON.stringify(row) + "\n";
  fs.appendFileSync(CORPUS_PATH, line, "utf8");
  resetPhrasingsCache();
}
