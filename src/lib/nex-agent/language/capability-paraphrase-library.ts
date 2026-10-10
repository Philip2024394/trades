// src/lib/nex-agent/language/capability-paraphrase-library.ts
//
// NEX1 · C2 · Deterministic Paraphrase Library · 2026-09-17.
// Founder-authorised via frontier §17 queue after C11 UI chip.
//
// PURPOSE
//   Every phrase → canonical-intent mapping is a hand-verified translation
//   step. When the founder says "sort out the pricing" and the classifier
//   refuses, we can permanently teach it that "sort out" → "fix" by adding
//   a paraphrase entry. Next time it lands cleanly.
//
//   This module is the storage + lookup layer. Seeding + persistence come
//   in follow-up slices · Phase 1 keeps a pure in-memory store with a
//   deterministic upsert / query API and a small seed pack that maps the
//   most common refused prompts (harvested from the C10 graph) to their
//   intended intent slugs.
//
// DESIGN INTENT
//   · Zero LLM · deterministic · one lookup returns one canonical target.
//   · Additive · every learned mapping stays forever (unless retracted).
//   · Auditable · every entry carries provenance (who added it, when, why).
//   · Composable · matched paraphrase can override classifier confidence.
//   · Bounded · max 50_000 entries · overflow drops least-recent-touched.

// ── Types ──────────────────────────────────────────────────────────────

export interface ParaphraseEntry {
  /** Verbatim phrase or short expression the founder is likely to type. */
  readonly source: string;
  /** Lowercased + punctuation-normalised form used for lookup. */
  readonly canonical: string;
  /** Target intent slug the phrase should map to. */
  readonly target_slug: string;
  /** How the entry was created. */
  readonly kind: "seed" | "founder_correction" | "harvested" | "manual";
  readonly added_at: string;
  readonly last_matched_at: string | null;
  readonly match_count: number;
  /** Where this mapping came from · rejects at ingest if empty. */
  readonly provenance: string;
}

export interface ParaphraseHit {
  readonly source: string;
  readonly target_slug: string;
  readonly confidence: number;   // fixed 0.85 for direct paraphrase match
  readonly match_method: "exact" | "canonical" | "prefix" | "token";
  readonly entry: ParaphraseEntry;
}

// ── Store ──────────────────────────────────────────────────────────────

const CFG = Object.freeze({
  MAX_ENTRIES: 50_000,
  // Base confidence for a first-use entry (seed or freshly taught).
  BASE_CONFIDENCE: 0.75,
  // Ceiling · match-count weight can never push above this.
  MAX_CONFIDENCE: 0.95,
  // Confidence gained per successful match · saturates near MAX after ~40 hits.
  CONFIDENCE_PER_HIT: 0.005,
} as const);

/**
 * Deterministic match-count weighted confidence. Fresh entries return 0.75.
 * After 40 successful matches confidence saturates at 0.95. Never randomised.
 */
function computeConfidence(entry: ParaphraseEntry): number {
  const boost = Math.min(CFG.MAX_CONFIDENCE - CFG.BASE_CONFIDENCE, entry.match_count * CFG.CONFIDENCE_PER_HIT);
  return Number((CFG.BASE_CONFIDENCE + boost).toFixed(4));
}

// C10 Phase 4a · JSONL persistence (Fix 17 pattern).
import { appendEvent as persistEvent, replayEvents as persistReplay, getStorePath } from "./capability-paraphrase-persistence";

// Two indices for O(1) lookup by canonical form and by exact source.
const CANON_INDEX = new Map<string, ParaphraseEntry>();
const SOURCE_INDEX = new Map<string, ParaphraseEntry>();

function canonicalise(input: string): string {
  return input
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[.,;!?:]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// ── Seed pack · harvested from real refused prompts + doctrine ─────────

/**
 * Common founder phrasings that used to refuse. Each mapping has
 * provenance so we can audit later. Add-only · never removed silently.
 */
const SEED_PACK: ReadonlyArray<Omit<ParaphraseEntry, "canonical" | "added_at" | "last_matched_at" | "match_count">> = Object.freeze([
  // fix_bug · British slang + common phrasings
  { source: "sort out",         target_slug: "fix_bug",       kind: "seed", provenance: "British slang · maps to fix" },
  { source: "sort it",          target_slug: "fix_bug",       kind: "seed", provenance: "British slang · fix pronoun" },
  { source: "patch up",         target_slug: "fix_bug",       kind: "seed", provenance: "colloquial fix" },
  { source: "make it work",     target_slug: "fix_bug",       kind: "seed", provenance: "generic broken → fix intent" },
  { source: "not working",      target_slug: "fix_bug",       kind: "seed", provenance: "failure statement → fix" },
  { source: "gone wrong",       target_slug: "fix_bug",       kind: "seed", provenance: "British failure phrasing" },
  { source: "throwing an error", target_slug: "fix_bug",      kind: "seed", provenance: "error observation → fix" },
  { source: "crashing",         target_slug: "fix_bug",       kind: "seed", provenance: "crash → fix" },
  { source: "broken",           target_slug: "fix_bug",       kind: "seed", provenance: "state description → fix" },

  // add_feature · common phrasings
  { source: "chuck in",         target_slug: "add_feature",   kind: "seed", provenance: "British slang · add" },
  { source: "bung in",          target_slug: "add_feature",   kind: "seed", provenance: "British slang · add" },
  { source: "knock up",         target_slug: "add_feature",   kind: "seed", provenance: "British slang · quick build" },
  { source: "spin up",          target_slug: "add_feature",   kind: "seed", provenance: "developer slang · create" },
  { source: "put together",     target_slug: "add_feature",   kind: "seed", provenance: "build synonym" },
  { source: "wire in",          target_slug: "add_feature",   kind: "seed", provenance: "developer slang · connect + add" },
  { source: "stand up",         target_slug: "add_feature",   kind: "seed", provenance: "deployment slang · create running instance" },

  // refactor
  { source: "tidy up",          target_slug: "refactor",      kind: "seed", provenance: "British slang · clean" },
  { source: "pull apart",       target_slug: "refactor",      kind: "seed", provenance: "restructure phrasing" },
  { source: "clean up",         target_slug: "refactor",      kind: "seed", provenance: "common phrasing" },
  { source: "simplify",         target_slug: "refactor",      kind: "seed", provenance: "cleanup verb" },

  // explain
  { source: "walk me through",  target_slug: "explain",       kind: "seed", provenance: "explanation request" },
  { source: "talk me through",  target_slug: "explain",       kind: "seed", provenance: "explanation request" },
  { source: "run me through",   target_slug: "explain",       kind: "seed", provenance: "explanation request" },
  { source: "break it down",    target_slug: "explain",       kind: "seed", provenance: "explanation request" },
  { source: "how does",         target_slug: "explain",       kind: "seed", provenance: "question form → explain" },
  { source: "what is",          target_slug: "explain",       kind: "seed", provenance: "definition question" },
  { source: "what does",        target_slug: "explain",       kind: "seed", provenance: "definition question" },

  // add_migration
  { source: "new column",       target_slug: "add_migration", kind: "seed", provenance: "schema change" },
  { source: "drop column",      target_slug: "add_migration", kind: "seed", provenance: "schema change" },
  { source: "alter table",      target_slug: "add_migration", kind: "seed", provenance: "schema change" },
  { source: "new table",        target_slug: "add_migration", kind: "seed", provenance: "schema change" },

  // add_api_route
  { source: "new endpoint",     target_slug: "add_api_route", kind: "seed", provenance: "API route creation" },
  { source: "new route",        target_slug: "add_api_route", kind: "seed", provenance: "API route creation" },
  { source: "add endpoint",     target_slug: "add_api_route", kind: "seed", provenance: "API route creation" },
  { source: "expose",           target_slug: "add_api_route", kind: "seed", provenance: "make available via API" },

  // add_test
  { source: "cover with tests", target_slug: "add_test",      kind: "seed", provenance: "test writing" },
  { source: "add coverage",     target_slug: "add_test",      kind: "seed", provenance: "test writing" },
  { source: "write a spec",     target_slug: "add_test",      kind: "seed", provenance: "test writing" },
  { source: "write specs",      target_slug: "add_test",      kind: "seed", provenance: "test writing" },

  // small_talk edge cases
  { source: "morning",          target_slug: "small_talk",    kind: "seed", provenance: "greeting shorthand" },
  { source: "afternoon",        target_slug: "small_talk",    kind: "seed", provenance: "greeting shorthand" },
  { source: "wassup",           target_slug: "small_talk",    kind: "seed", provenance: "greeting slang" },

  // gratitude
  { source: "ta",               target_slug: "gratitude",     kind: "seed", provenance: "British gratitude shorthand" },
  { source: "much appreciated", target_slug: "gratitude",     kind: "seed", provenance: "gratitude" },
  { source: "cheers mate",      target_slug: "gratitude",     kind: "seed", provenance: "British gratitude" },
] as const);

// Bootstrap · seeds first (always present), then replay persisted JSONL events
// on top. This means: (a) seeds are the immovable floor, (b) any historical
// upsert/touch events survived restart, (c) new events append into the same log.
(function bootstrap() {
  const now = new Date().toISOString();
  for (const s of SEED_PACK) {
    const canonical = canonicalise(s.source);
    const entry: ParaphraseEntry = {
      source: s.source,
      canonical,
      target_slug: s.target_slug,
      kind: s.kind,
      added_at: now,
      last_matched_at: null,
      match_count: 0,
      provenance: s.provenance,
    };
    CANON_INDEX.set(canonical, entry);
    SOURCE_INDEX.set(s.source, entry);
  }
  // Replay persisted history · silent on empty file · deterministic.
  try {
    const { events } = persistReplay();
    for (const evt of events) {
      if (evt.kind === "upsert") {
        const existing = CANON_INDEX.get(evt.canonical);
        const entry: ParaphraseEntry = existing
          ? {
              ...existing,
              source: evt.source,
              target_slug: evt.target_slug,
              kind: evt.entry_kind,
              provenance: evt.provenance,
            }
          : {
              source: evt.source,
              canonical: evt.canonical,
              target_slug: evt.target_slug,
              kind: evt.entry_kind,
              added_at: evt.ts,
              last_matched_at: null,
              match_count: 0,
              provenance: evt.provenance,
            };
        CANON_INDEX.set(evt.canonical, entry);
        SOURCE_INDEX.set(evt.source, entry);
      } else if (evt.kind === "touch") {
        const existing = CANON_INDEX.get(evt.canonical);
        if (existing) {
          (existing as unknown as { match_count: number }).match_count = existing.match_count + 1;
          (existing as unknown as { last_matched_at: string }).last_matched_at = evt.ts;
        }
      }
    }
  } catch { /* silent · persistence-optional per Fix 17 pattern */ }
})();

// ── Public API ─────────────────────────────────────────────────────────

export function paraphraseSize(): number { return CANON_INDEX.size; }

/**
 * Add or update a paraphrase entry. Deterministic upsert · rejects entries
 * with empty source or empty provenance. Returns the stored entry.
 */
export function addParaphrase(input: Omit<ParaphraseEntry, "canonical" | "added_at" | "last_matched_at" | "match_count">): ParaphraseEntry {
  if (!input.source || !input.source.trim()) throw new Error("paraphrase:empty_source");
  if (!input.provenance || !input.provenance.trim()) throw new Error("paraphrase:empty_provenance");
  const canonical = canonicalise(input.source);
  const existing = CANON_INDEX.get(canonical);
  const now = new Date().toISOString();
  const entry: ParaphraseEntry = existing
    ? { ...existing, target_slug: input.target_slug, kind: input.kind, provenance: input.provenance }
    : {
        source: input.source,
        canonical,
        target_slug: input.target_slug,
        kind: input.kind,
        added_at: now,
        last_matched_at: null,
        match_count: 0,
        provenance: input.provenance,
      };
  CANON_INDEX.set(canonical, entry);
  SOURCE_INDEX.set(input.source, entry);
  // Persist the upsert event · append-only · Fix 17 pattern.
  persistEvent({
    kind: "upsert",
    ts: now,
    source: input.source,
    canonical,
    target_slug: input.target_slug,
    entry_kind: input.kind,
    provenance: input.provenance,
  });
  // Bounded · drop the oldest untouched entry when we hit the cap.
  if (CANON_INDEX.size > CFG.MAX_ENTRIES) {
    let oldestKey: string | null = null;
    let oldestStamp = Infinity;
    for (const [k, v] of CANON_INDEX) {
      const stamp = v.last_matched_at ? Date.parse(v.last_matched_at) : Date.parse(v.added_at);
      if (stamp < oldestStamp) { oldestStamp = stamp; oldestKey = k; }
    }
    if (oldestKey && oldestKey !== canonical) {
      const dropped = CANON_INDEX.get(oldestKey);
      CANON_INDEX.delete(oldestKey);
      if (dropped) SOURCE_INDEX.delete(dropped.source);
    }
  }
  return entry;
}

/**
 * Look up a paraphrase for a founder message. Deterministic · returns the
 * FIRST match in preference order (exact source → canonical → prefix → token).
 * Returns null when no mapping is registered.
 */
export function lookupParaphrase(message: string): ParaphraseHit | null {
  if (!message) return null;
  // 1 · exact source match (case-sensitive)
  const exact = SOURCE_INDEX.get(message.trim());
  if (exact) { touch(exact); return hit(exact, "exact"); }
  // 2 · canonical form match (case-insensitive · punctuation-stripped)
  const canonical = canonicalise(message);
  const c = CANON_INDEX.get(canonical);
  if (c) { touch(c); return hit(c, "canonical"); }
  // 3 · prefix match · phrase starts the message (e.g. "sort out the pricing")
  for (const [k, v] of CANON_INDEX) {
    if (canonical.startsWith(k + " ")) { touch(v); return hit(v, "prefix"); }
  }
  // 4 · token match · phrase appears as a distinct chunk in the message
  //     (bounded by word boundaries; slower · linear over the index).
  for (const [k, v] of CANON_INDEX) {
    if (canonical.includes(" " + k + " ") || canonical.startsWith(k + " ") || canonical.endsWith(" " + k)) {
      touch(v);
      return hit(v, "token");
    }
  }
  return null;
}

function touch(entry: ParaphraseEntry): void {
  // Mutable book-keeping · match_count and last_matched_at are the only
  // fields that change after ingest. Keeping the index reference stable
  // so callers who hold onto an entry see the updated counters.
  const nowTs = new Date().toISOString();
  (entry as unknown as { match_count: number }).match_count = entry.match_count + 1;
  (entry as unknown as { last_matched_at: string }).last_matched_at = nowTs;
  // Persist the touch event so match_count history survives restart.
  persistEvent({ kind: "touch", ts: nowTs, canonical: entry.canonical });
}

function hit(entry: ParaphraseEntry, method: ParaphraseHit["match_method"]): ParaphraseHit {
  return {
    source: entry.source,
    target_slug: entry.target_slug,
    confidence: computeConfidence(entry),
    match_method: method,
    entry,
  };
}

/** Return the current library as a snapshot · used by the diagnostic route. */
export function snapshotParaphrases(): { total: number; entries: ParaphraseEntry[]; store_path: string } {
  return {
    total: CANON_INDEX.size,
    entries: Array.from(CANON_INDEX.values()).sort((a, b) => b.match_count - a.match_count),
    store_path: getStorePath(),
  };
}

// ── Suggestion engine · used by Notes panel "teach as paraphrase" flow ────
//
// Deterministic keyword-based heuristic. Given a refused / unknown phrase,
// suggest the most likely target_slug. Zero LLM · zero training · single
// pass over a fixed keyword table. Returns null when NO keyword hits (honest
// abstention · founder must pick manually).

interface SuggestionRule {
  readonly slug: string;
  readonly keywords: readonly string[];
  readonly weight: number;
}

const SUGGESTION_RULES: readonly SuggestionRule[] = Object.freeze([
  { slug: "fix_bug", keywords: ["fix", "broken", "bug", "error", "crash", "fail", "wrong", "not working", "issue"], weight: 1 },
  { slug: "add_feature", keywords: ["add", "new", "create", "build", "make", "implement", "chuck in", "bung in", "spin up", "stand up"], weight: 1 },
  { slug: "explain", keywords: ["explain", "what is", "what does", "how does", "walk me", "describe", "clarify", "understand", "why", "tell me"], weight: 1 },
  { slug: "refactor", keywords: ["refactor", "clean", "tidy", "simplify", "restructure", "rename", "rearrange"], weight: 1 },
  { slug: "add_test", keywords: ["test", "spec", "coverage", "unit test", "verify with"], weight: 1 },
  { slug: "add_migration", keywords: ["migration", "schema", "column", "table", "alter table", "drop column", "index"], weight: 1 },
  { slug: "add_api_route", keywords: ["endpoint", "route", "api", "handler", "expose"], weight: 1 },
]);

export interface ParaphraseSuggestion {
  readonly source_normalised: string;
  readonly suggested_slug: string | null;
  readonly confidence: number;                // 0-1 · fraction of matched keywords
  readonly matched_keywords: readonly string[];
  readonly ranked_alternatives: ReadonlyArray<{ slug: string; matched: readonly string[]; score: number }>;
}

/**
 * Given a phrase (typically a refused / unknown prompt), suggest a target_slug
 * the founder might want to teach. Deterministic · no randomness · same input
 * → same suggestion. Returns null suggested_slug when no rule matched.
 */
export function suggestTargetSlug(phrase: string): ParaphraseSuggestion {
  const normalised = canonicalise(phrase);
  const scores = new Map<string, { matched: string[]; score: number }>();
  for (const rule of SUGGESTION_RULES) {
    const matched: string[] = [];
    for (const kw of rule.keywords) {
      if (normalised.includes(kw)) matched.push(kw);
    }
    if (matched.length > 0) {
      scores.set(rule.slug, { matched, score: matched.length * rule.weight });
    }
  }
  const ranked = Array.from(scores.entries())
    .map(([slug, v]) => ({ slug, matched: v.matched, score: v.score }))
    .sort((a, b) => b.score - a.score || a.slug.localeCompare(b.slug));
  const top = ranked[0] ?? null;
  const totalKeywords = SUGGESTION_RULES.reduce((sum, r) => sum + r.keywords.length, 0);
  const confidence = top ? Math.min(0.95, Number((top.score / Math.max(1, totalKeywords)).toFixed(4)) * 8) : 0;
  return {
    source_normalised: normalised,
    suggested_slug: top ? top.slug : null,
    confidence,
    matched_keywords: top ? top.matched : [],
    ranked_alternatives: ranked.slice(0, 4),
  };
}

