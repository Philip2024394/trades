// NEX Code Brain · idempotent knowledge-seed loader
// Populates the knowledge store with the "code bible" once, then no-ops.
// Every seed entry lands with `founder_approved: false` (per honest-posture
// contract in knowledge-store.ts) so callers can filter unapproved advisory
// entries at retrieval time if they need Founder-verified content only.

import { addKnowledgeEntry, searchKnowledge } from "..";
import { CODE_BIBLE_SEED } from "./engineering-patterns";
import type { SeedPattern } from "./engineering-patterns";

export interface SeedOutcome {
  readonly seeded: number;
  readonly already_present: number;
  readonly rejected: readonly { readonly title: string; readonly reason: string }[];
}

const SEED_MARKER_TAG = "code-bible-seed";

/**
 * Populate the knowledge store with the engineering-pattern seed.
 * Idempotent: re-runs are safe. Titles already present are skipped.
 */
export function seedCodeBible(): SeedOutcome {
  const already = new Set(
    searchKnowledge({ tag: SEED_MARKER_TAG }).map((e) => e.title),
  );
  let seeded = 0;
  let already_present = 0;
  const rejected: { title: string; reason: string }[] = [];

  for (const p of CODE_BIBLE_SEED) {
    if (already.has(p.title)) {
      already_present++;
      continue;
    }
    const tagsWithMarker = [...p.tags, SEED_MARKER_TAG];
    const r = addKnowledgeEntry({
      kind: p.kind,
      title: p.title,
      body: p.body,
      contributed_by_lane: p.contributed_by_lane,
      contributed_by_agent: "code-bible-seeder",
      applicable_paths: p.applicable_paths,
      tags: tagsWithMarker,
      evidence: extractCitations(p.body),
    });
    if (!r.ok) {
      rejected.push({ title: p.title, reason: r.reason ?? "unknown" });
      continue;
    }
    seeded++;
  }
  return { seeded, already_present, rejected };
}

/** Extract `**Source.**` / `**Evidence.**` lines as evidence strings. */
function extractCitations(body: string): readonly string[] {
  const out: string[] = [];
  const rx = /\*\*(?:Source|Evidence)\.\*\*\s*([^\n]+)/g;
  let m: RegExpExecArray | null;
  while ((m = rx.exec(body)) !== null) {
    if (m[1]) out.push(m[1].trim());
  }
  return out;
}

/** Search for patterns matching a free-text query · returns a scored list. */
export interface Suggestion {
  readonly title: string;
  readonly kind: string;
  readonly tags: readonly string[];
  readonly score: number; // tag-hit count · higher = more relevant
  readonly excerpt: string;
}

export function suggestPatternsFor(query: string, limit: number = 5): readonly Suggestion[] {
  const q = query.toLowerCase();
  const terms = q
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 3);
  if (terms.length === 0) return [];

  // Pull every seed entry from the store.
  const all = searchKnowledge({ tag: SEED_MARKER_TAG });
  const scored: Suggestion[] = all.map((e) => {
    let score = 0;
    const hay = (e.title + " " + e.body + " " + e.tags.join(" ")).toLowerCase();
    for (const t of terms) {
      if (hay.includes(t)) score++;
    }
    return {
      title: e.title,
      kind: e.kind,
      tags: e.tags,
      score,
      excerpt: e.body.slice(0, 200),
    };
  });
  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title))
    .slice(0, limit);
}

export function totalSeedEntries(): number {
  return searchKnowledge({ tag: SEED_MARKER_TAG }).length;
}
