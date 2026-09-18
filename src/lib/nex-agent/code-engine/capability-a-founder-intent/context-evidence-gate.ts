// src/lib/nex-agent/code-engine/capability-a-founder-intent/context-evidence-gate.ts
//
// NEX Context Evidence Gate (CEG) · Founder-authorised 2026-09-16
//
// Founder directive: "Design and implement a small deterministic Context
// Evidence Gate, test it against the Section 8 failures, then re-run the
// existing regression suite and deliberately try to break the new gate. No
// LLM. No commits. No pushes."
//
// This module is the CANDIDATE implementation for NEX-02 Context Intelligence
// (PROPOSED · see src/lib/nex/master-ai/known-nex-designations.ts). NEX-02
// status remains PROPOSED until founder-approved. Its intelligence_status
// is UNKNOWN until proven by evidence.
//
// SCOPE ALIGNMENT (founder Section 16 · "Do not overbuild"):
//   Alpha.10 wires the CEG only into REQUIREMENT extractor (highest priority).
//   Alpha.11+ may wire it into DELIVERABLE / VERB / CONCEPT once founder approves.
//
// FOUNDER PHILOSOPHY (encoded here):
//   "When NEX cannot know, it says UNKNOWN rather than guessing."
//   Verdicts are conservative — under doubt, REJECT the match rather than
//   confidently emit a false positive.
//
// This file lives inside INTELLIGENCE_CORE (protected layer). Modification
// requires re-certification per Safety Doctrine §4.

// ─── Verdict + kind types ───────────────────────────────────────────────────

export type Nex1GateVerdict = "ACCEPT" | "REJECT" | "UNKNOWN";

export type Nex1MatchKind = "VERB" | "DELIVERABLE" | "REQUIREMENT" | "CONCEPT";

// ─── Universal linguistic reference sets ─────────────────────────────────────

/**
 * Small pragmatic set of irregular past-participle forms. English perfective
 * is `have + past-participle`; if we see the modal + have + word-of-this-shape,
 * we treat the entire span as English perfective (not requirement).
 */
export const IRREGULAR_PAST_PARTICIPLES: ReadonlySet<string> = new Set([
  "chosen", "been", "done", "made", "given", "taken", "seen", "gone",
  "come", "become", "brought", "thought", "bought", "caught", "taught",
  "known", "shown", "grown", "drawn", "sent", "meant", "kept", "slept",
  "felt", "held", "told", "sold", "said", "paid", "laid", "led",
  "put", "cut", "hit", "set", "let", "run", "understood", "forgotten",
  "spoken", "broken", "frozen", "driven", "ridden", "hidden", "bitten",
  "written", "forbidden", "awoken", "found", "left", "lost",
  "beaten", "stolen", "torn", "worn", "sworn", "shot", "hurt", "burst",
  "sung", "swum", "won", "meant", "read",
]);

export const ARTICLES: ReadonlySet<string> = new Set(["the", "a", "an"]);

export const POSSESSIVES: ReadonlySet<string> = new Set([
  "my", "your", "our", "his", "her", "their", "its",
]);

export const TIME_UNITS: ReadonlySet<string> = new Set([
  "second", "seconds", "minute", "minutes", "hour", "hours",
  "day", "days", "week", "weeks", "month", "months", "year", "years",
  "moment", "moments", "instant", "quarter", "quarters",
  "decade", "decades", "century", "centuries",
  "ms", "us", "ns", // technical: milliseconds/microseconds/nanoseconds
]);

export const ENGLISH_QUANTIFIERS: ReadonlySet<string> = new Set([
  "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten",
  "a", "an", "the", "some", "any", "many", "few", "several",
  "single", "couple", "handful",
]);

export const SPECULATIVE_FRAMES: ReadonlySet<string> = new Set([
  "whether", "if", "unless",
]);

// Bare modals that suffer perfective/passive false positives.
export const WEAK_BARE_MODALS: ReadonlySet<string> = new Set([
  "must", "should", "shall", "would",
]);

// ─── Universal signal checks ─────────────────────────────────────────────────

export function isPastParticipleShape(word: string): boolean {
  const w = word.toLowerCase().replace(/[.,;!?]+$/, "");
  if (w.length > 3 && w.endsWith("ed")) return true;
  if (IRREGULAR_PAST_PARTICIPLES.has(w)) return true;
  return false;
}

/**
 * Return the lowercase first N words after the given character position in the
 * goal string, stripped of surrounding whitespace and trailing punctuation.
 * Used to inspect what follows a marker match.
 */
export function wordsAfter(goal: string, charIdx: number, n: number): readonly string[] {
  const rest = goal.slice(charIdx).replace(/^\s+/, "");
  const tokens = rest.split(/\s+/).slice(0, n).map((t) => t.toLowerCase().replace(/[.,;!?]+$/, ""));
  return tokens;
}

/**
 * Return the lowercase first N words BEFORE the given char position (searched
 * within the preceding ~50 characters).
 */
export function wordsBefore(goal: string, charIdx: number, n: number, windowChars = 50): readonly string[] {
  const start = Math.max(0, charIdx - windowChars);
  const window = goal.slice(start, charIdx).replace(/[.,;!?]+$/, "").trim();
  const tokens = window.split(/\s+/).map((t) => t.toLowerCase()).filter((t) => t.length > 0);
  return tokens.slice(-n);
}

export function isSpeculativeContext(goal: string, markerCharStart: number): boolean {
  const before = goal.slice(Math.max(0, markerCharStart - 50), markerCharStart).toLowerCase();
  return /\b(whether|if|unless)\b/.test(before);
}

// ─── REQUIREMENT gate ────────────────────────────────────────────────────────

/**
 * The alpha.10 REQUIREMENT gate. Returns a verdict for a matched requirement
 * marker at the given char position with the given prefix.
 *
 * Patterns REJECTED (English false positives):
 *   R1 · Modal (must/should/shall/would) + "have" + past-participle → perfective
 *   R2 · Modal + "be" + past-participle → passive future
 *   R3 · Bare modal in speculative frame (`whether`/`if`/`unless` preceding)
 *   R4 · "within" + article + time-unit → temporal ("within an hour")
 *   R5 · "within" + digit-only + time-unit → temporal ("within 10 seconds")
 *   R6 · "only" + English quantifier → English quantifier ("only one thing")
 *
 * Strong markers ("must be able to", "must not", "should not", "shall not",
 * "verify/confirm/prove the/that") are NEVER speculatively-rejected — they
 * are strong intent signals.
 *
 * "needs to / need to / has to / have to" are LEFT ALONE in alpha.10 pending
 * a founder decision — the audit found them ambiguous, not clearly wrong.
 */
export function requirementMarkerGate(
  goal: string,
  markerPrefix: string,
  markerCharStart: number,
  markerCharEnd: number,
): Nex1GateVerdict {
  const prefixLower = markerPrefix.toLowerCase().trim();
  const nextWords = wordsAfter(goal, markerCharEnd, 3);
  const [w1 = "", w2 = ""] = nextWords;

  // Strong markers · never speculatively rejected.
  const STRONG_MARKERS: ReadonlySet<string> = new Set([
    "must be able to",
    "must not",
    "should not",
    "shall not",
    "verify the", "verify that",
    "confirm the", "confirm that",
    "prove the", "prove that",
    "inside the",
  ]);

  if (STRONG_MARKERS.has(prefixLower)) return "ACCEPT";

  // R1 · Modal + have + past-participle → English perfective
  if (WEAK_BARE_MODALS.has(prefixLower)) {
    if (w1 === "have" && w2 && isPastParticipleShape(w2)) return "REJECT";
    if (w1 === "be" && w2 && isPastParticipleShape(w2)) return "REJECT"; // R2 · passive
    // R3 · bare modal in speculative frame
    if (isSpeculativeContext(goal, markerCharStart)) return "REJECT";
    return "ACCEPT";
  }

  // R4 · "within" + article + time-unit → temporal
  // R5 · "within" + digit + time-unit → temporal
  if (prefixLower === "within") {
    if (ARTICLES.has(w1) && TIME_UNITS.has(w2)) return "REJECT";
    if (/^\d+$/.test(w1) && TIME_UNITS.has(w2)) return "REJECT";
    if (TIME_UNITS.has(w1)) return "REJECT";
    return "ACCEPT";
  }

  // R6 · "only" + English quantifier → English quantifier
  if (prefixLower === "only") {
    if (ENGLISH_QUANTIFIERS.has(w1)) return "REJECT";
    return "ACCEPT";
  }

  // "needs to / need to / has to / have to" · UN-GATED in alpha.10 · founder decision
  return "ACCEPT";
}

// ─── DELIVERABLE / VERB / CONCEPT gates (declared, not wired in alpha.10) ────
//
// These are SCAFFOLDING for future alphas. Founder said "small deterministic
// Context Evidence Gate" — alpha.10 wires only REQUIREMENT. The others are
// declared to make the reusable framework visible + testable.

/**
 * VERB gate · scaffolding · not wired in alpha.10. Reserved for future work.
 *
 * Anticipated rule: token preceded by article/possessive suggests noun use →
 * REJECT the verb match. Otherwise ACCEPT.
 */
export function verbCandidateGate(
  tokens: readonly { text: string }[],
  tokenIdx: number,
): Nex1GateVerdict {
  if (tokenIdx <= 0) return "ACCEPT";
  const prev = tokens[tokenIdx - 1]!.text.toLowerCase();
  if (ARTICLES.has(prev) || POSSESSIVES.has(prev)) return "REJECT";
  return "ACCEPT";
}

/**
 * DELIVERABLE gate · scaffolding · not wired in alpha.10.
 *
 * Anticipated rule: ACCEPT only when a technical anchor is present in the
 * surrounding context; otherwise REJECT bare English words matching phrases.
 */
export function deliverableGate(
  _goal: string,
  _phrase: string,
  _matchCharStart: number,
  _hasTechnicalAnchorNearby: boolean,
): Nex1GateVerdict {
  return "UNKNOWN"; // not wired yet
}

/**
 * CONCEPT gate · scaffolding · not wired in alpha.10.
 *
 * Anticipated rule: ACCEPT when technical anchor nearby; REJECT when preceded
 * by article AND no technical anchor.
 */
export function conceptGate(
  _tokens: readonly { text: string }[],
  _tokenIdx: number,
  _hasTechnicalAnchorNearby: boolean,
): Nex1GateVerdict {
  return "UNKNOWN"; // not wired yet
}
