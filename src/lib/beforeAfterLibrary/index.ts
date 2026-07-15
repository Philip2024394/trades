// beforeAfterLibrary — server-side loader for
// scripts/beforeafter-library.json.
//
// Mirrors the heroLibrary API shape so callers can score entries
// against a free-text query and render them alongside regular
// inspiration cards. Two modes today:
//
//   • composite — one image URL, before + after merged into a
//                 single file (default: top half before, bottom
//                 half after). The card renders with corner
//                 labels + a tap-toggle to zoom into either
//                 half; no drag-slider because there's nothing
//                 hidden to reveal.
//
//   • dual      — two separate image URLs (`before_url` +
//                 `after_url`). Renders the classic
//                 draggable-divider slider that reveals one
//                 image at the expense of the other. Not
//                 currently in the library; supported for when
//                 trades submit paired shots.
//
// SERVER-ONLY.

import "server-only";
import fs from "node:fs";
import path from "node:path";

export type BeforeAfterMode = "composite" | "dual";

export type BeforeAfterEntry = {
  id: string;
  subject: string;
  keywords_strict: string[];
  excluded_trades?: string[];
  orientation: "vertical" | "horizontal";
  mode: BeforeAfterMode;
  /** Composite mode — percent (0-100) of the frame that's the
   *  BEFORE side. Default 50 (perfect half). Vertical orientation
   *  splits horizontally (top = before); horizontal splits
   *  vertically (left = before). */
  composite_split?: number;
  /** Composite mode: the merged image. */
  image_url?: string;
  /** Dual mode: two separate images. */
  before_url?: string;
  after_url?:  string;
  before_label?: string;
  after_label?:  string;
  vibe?:  string;
  notes?: string;
  sibling_group_id?: string;
};

type LibraryFile = {
  $schema_version: string;
  entries: BeforeAfterEntry[];
};

let cache: BeforeAfterEntry[] | null = null;

function loadEntries(): BeforeAfterEntry[] {
  // Bypass cache in dev so JSON edits go live without a restart.
  // Prod stays cached (file is bundled at build time, never changes).
  if (cache && process.env.NODE_ENV === "production") return cache;
  try {
    const file = path.join(process.cwd(), "scripts", "beforeafter-library.json");
    const raw = fs.readFileSync(file, "utf8");
    const parsed = JSON.parse(raw) as LibraryFile;
    cache = Array.isArray(parsed.entries) ? parsed.entries : [];
  } catch {
    cache = [];
  }
  return cache;
}

function normalise(s: string): string {
  return (s ?? "").toLowerCase().replace(/-/g, " ").trim();
}

// Same relevance guard as heroesForQuery: at least one keyword hit
// required, subject hit is tiebreaker only. Kills false positives
// like a garden fence entry sneaking into a loft-ladder search.
function scoreEntry(entry: BeforeAfterEntry, queryTokens: string[]): number {
  if (queryTokens.length === 0) return 0;
  const kws = entry.keywords_strict.map(normalise);
  const subject = normalise(entry.subject ?? "");
  let keywordScore = 0;
  let subjectScore = 0;
  for (const q of queryTokens) {
    for (const k of kws) {
      if (k === q) keywordScore += 20;
      else if (k.includes(q)) keywordScore += 8;
    }
    if (subject.includes(q)) subjectScore += 3;
  }
  if (keywordScore === 0) return 0;
  return keywordScore + subjectScore;
}

/** Free-text query → matching before/after entries, best-first,
 *  capped. Mirrors heroesForQuery signature. */
export function beforeAftersForQuery(query: string, limit = 12): BeforeAfterEntry[] {
  const cleaned = (query ?? "").toLowerCase().trim();
  if (!cleaned) return [];
  const tokens = cleaned
    .split(/[\s,]+/)
    .map((t) => t.replace(/[^a-z0-9]/g, ""))
    .filter((t) => t.length >= 2);
  if (tokens.length === 0) return [];
  const entries = loadEntries();
  const scored: Array<{ entry: BeforeAfterEntry; score: number }> = [];
  for (const entry of entries) {
    const score = scoreEntry(entry, tokens);
    if (score > 0) scored.push({ entry, score });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((s) => s.entry);
}
