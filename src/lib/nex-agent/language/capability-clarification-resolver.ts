// src/lib/nex-agent/language/capability-clarification-resolver.ts
//
// NEX1 · C7 · Interactive Intent Refinement · 2026-09-17.
// Founder-authorised via frontier §17 queue after Agent 10.
//
// PURPOSE
//   Agent 10 emits A/B/C/D options when the classifier is mid-confidence.
//   This module resolves the founder's follow-up reply to ONE of those
//   options deterministically:
//
//     Turn 1: founder → "add fix"
//     NEX1   → AMBIG · A:fix_bug · B:add_feature · C:unknown
//     Turn 2: founder → "A" (or "a" or "fix" or "fix bug" or "the fix one")
//     Resolver → { slug: "fix_bug", method: "letter" | "slug" | "display" | "trigger" }
//     Orchestrator → skips classify + ambiguity · forces intent · proceeds
//
// MATCHING · deterministic · ordered (first match wins)
//   M1 · Letter form   · "A" / "a" / "a)" / "(a)" / "a." / "option a"
//   M2 · Exact slug     · "fix_bug" / "add_feature"
//   M3 · Display name   · "fix a bug" / "add a new feature"
//   M4 · Trigger tokens · registry intent triggers as a fallback
//
// SAFETY
//   · Zero LLM · zero randomness · zero fuzzy string matching.
//   · Returns null when no match · caller decides fallback.
//   · Case-insensitive · punctuation-tolerant · but still exact-match at core.

import { CODE_INTENT_REGISTRY } from "./code-intent-registry";
import type { DomainIntent } from "@/lib/nex/language/types";

export interface AmbiguityOptionSnapshot {
  readonly id: "A" | "B" | "C" | "D";
  readonly slug: string;
  readonly display: string;
}

export type ResolutionMethod = "letter" | "slug" | "display" | "trigger" | "explicit_none";

export interface ClarificationResolution {
  readonly resolved: true;
  readonly slug: string;
  readonly method: ResolutionMethod;
  readonly matched_on: string;
}

export interface ClarificationUnresolved {
  readonly resolved: false;
  readonly reason: "empty_reply" | "no_options" | "unknown_letter" | "no_match" | "explicit_none";
}

export type ClarificationResult = ClarificationResolution | ClarificationUnresolved;

// ─── Letter-form patterns · order matters (specific → generic) ─────────────
const LETTER_PATTERNS: ReadonlyArray<{ re: RegExp; letter: "A" | "B" | "C" | "D" }> = [
  { re: /^\s*option\s+([abcd])\s*$/i, letter: "" as never },  // placeholder · replaced below
  { re: /^\s*\(?([abcd])\)?\s*[.:]?\s*$/i, letter: "" as never },
];
// (These are computed dynamically at match-time; the letter is captured.)

const LETTER_TO_INDEX: Record<string, number> = { a: 0, b: 1, c: 2, d: 3 };

function matchLetter(reply: string): "A" | "B" | "C" | "D" | null {
  const trimmed = reply.trim().toLowerCase();
  if (trimmed.length === 0 || trimmed.length > 12) return null;
  // "a" / "b" / "c" / "d" alone
  if (/^[abcd]$/.test(trimmed)) return trimmed.toUpperCase() as "A" | "B" | "C" | "D";
  // "a)" / "(a)" / "a." / "a:"
  const m1 = trimmed.match(/^\(?([abcd])\)?\s*[.:]?\s*$/);
  if (m1) return m1[1].toUpperCase() as "A" | "B" | "C" | "D";
  // "option a" / "option b"
  const m2 = trimmed.match(/^option\s+([abcd])\s*$/);
  if (m2) return m2[1].toUpperCase() as "A" | "B" | "C" | "D";
  // "pick a" / "choose b" / "answer c"
  const m3 = trimmed.match(/^(?:pick|choose|answer|go\s+with|do)\s+\(?([abcd])\)?$/);
  if (m3) return m3[1].toUpperCase() as "A" | "B" | "C" | "D";
  return null;
}

function matchExplicitNone(reply: string): boolean {
  const trimmed = reply.trim().toLowerCase();
  // Common ways founders say "none of these"
  return /^(none|neither|none of (them|these)|nope|not (a|b|c|d))\b/.test(trimmed);
}

function wordBoundaryRegExp(term: string): RegExp {
  const esc = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|\\W)${esc}(\\W|$)`, "i");
}

/**
 * Resolve the founder's reply against the ambiguity options.
 * Deterministic · first match wins by the M1→M4 order documented above.
 */
export function resolveClarification(reply: string, options: readonly AmbiguityOptionSnapshot[]): ClarificationResult {
  if (!reply || !reply.trim()) {
    return { resolved: false, reason: "empty_reply" };
  }
  if (!options || options.length === 0) {
    return { resolved: false, reason: "no_options" };
  }

  const rawReply = reply.trim();
  const lowerReply = rawReply.toLowerCase();

  // M1 · Letter form
  const letter = matchLetter(rawReply);
  if (letter) {
    const idx = LETTER_TO_INDEX[letter.toLowerCase()];
    if (typeof idx === "number" && idx < options.length) {
      const chosen = options[idx];
      // Guard · "unknown" option means the founder explicitly said "none".
      if (chosen.slug === "unknown") {
        return { resolved: false, reason: "explicit_none" };
      }
      return { resolved: true, slug: chosen.slug, method: "letter", matched_on: letter };
    }
    return { resolved: false, reason: "unknown_letter" };
  }

  // Explicit "none of these"
  if (matchExplicitNone(rawReply)) {
    return { resolved: false, reason: "explicit_none" };
  }

  // Build a lookup of the offered slugs so we don't match against intents
  // that weren't presented as options.
  const offeredSlugs = new Set(options.map((o) => o.slug));
  const registryMap = new Map<string, DomainIntent>();
  for (const intent of CODE_INTENT_REGISTRY) {
    if (offeredSlugs.has(intent.slug)) registryMap.set(intent.slug, intent);
  }

  // M2 · Exact slug (e.g. "fix_bug", "add_feature")
  for (const opt of options) {
    if (opt.slug === "unknown") continue;
    if (lowerReply === opt.slug.toLowerCase() ||
        lowerReply === opt.slug.replace(/_/g, " ").toLowerCase() ||
        lowerReply === opt.slug.replace(/_/g, "-").toLowerCase()) {
      return { resolved: true, slug: opt.slug, method: "slug", matched_on: opt.slug };
    }
  }

  // M3 · Display name (e.g. "fix a bug", "add a new feature")
  for (const opt of options) {
    if (opt.slug === "unknown") continue;
    if (lowerReply === opt.display.toLowerCase()) {
      return { resolved: true, slug: opt.slug, method: "display", matched_on: opt.display };
    }
  }
  // M3b · Substring on display (founder wrote "the fix one" containing "fix")
  for (const opt of options) {
    if (opt.slug === "unknown") continue;
    // Split display into distinctive terms · skip short words.
    const distinctiveTerms = opt.display.toLowerCase()
      .split(/\W+/).filter((t) => t.length >= 4 && !["some", "code", "with", "your"].includes(t));
    for (const term of distinctiveTerms) {
      if (wordBoundaryRegExp(term).test(lowerReply)) {
        return { resolved: true, slug: opt.slug, method: "display", matched_on: term };
      }
    }
  }

  // M4 · Trigger tokens from the intent registry (only for offered slugs).
  //      Score each · take the highest · require a clear winner.
  const scores: Array<{ slug: string; hits: number; token: string | null }> = [];
  for (const [slug, intent] of registryMap) {
    if (slug === "unknown") continue;
    let hits = 0;
    let strongestToken: string | null = null;
    for (const tok of intent.trigger_tokens ?? []) {
      if (wordBoundaryRegExp(tok).test(lowerReply)) {
        hits++;
        if (!strongestToken || tok.length > strongestToken.length) strongestToken = tok;
      }
    }
    for (const ph of intent.trigger_phrases ?? []) {
      if (lowerReply.includes(ph.toLowerCase())) {
        hits += 2;
        if (!strongestToken || ph.length > (strongestToken?.length ?? 0)) strongestToken = ph;
      }
    }
    scores.push({ slug, hits, token: strongestToken });
  }
  scores.sort((a, b) => b.hits - a.hits);
  if (scores[0] && scores[0].hits > 0 && (scores[1]?.hits ?? 0) < scores[0].hits) {
    // Clear winner · at least one hit and strictly more than second place.
    return { resolved: true, slug: scores[0].slug, method: "trigger", matched_on: scores[0].token ?? "?" };
  }

  return { resolved: false, reason: "no_match" };
}

// ─── Helper · extract the founder's latest reply from a compound task prompt.
// The submit route appends "[FOUNDER REPLY]\n{reply}" onto task.prompt so we
// need to peel off the last reply for scoring. Deterministic split.
const REPLY_MARKER = "[FOUNDER REPLY]";
export function extractLatestReply(compoundPrompt: string): string | null {
  if (!compoundPrompt) return null;
  const idx = compoundPrompt.lastIndexOf(REPLY_MARKER);
  if (idx === -1) return null;
  return compoundPrompt.slice(idx + REPLY_MARKER.length).trim();
}
