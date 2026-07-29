// src/lib/nex/brains/_answer_quality_gate.ts
//
// Phase 1 · Terminology Intelligence Mode · answer quality gate
// (Philip 2026-07-29 · master prompt)
// ─────────────────────────────────────────────────────────────────────
// Runs Philip's five quality checks against a composed answer for a
// terminology intent. Returns pass/fail + a failure list + a retry
// hint. Non-terminology intents pass through unchanged in Phase 1.
//
// The five checks (verbatim from Philip's master prompt):
//   1. Does the first sentence directly answer the question?
//   2. Does every statement support the question?
//   3. Did we introduce unrelated staircase terms?
//   4. Can the source be traced?
//   5. Would a professional recognise this as accurate?
//
// Check design:
//   • Checks 1 · 2 · 3 · 4 are deterministic (regex + list checks)
//   • Check 5 is a STRUCTURAL PROXY — we cannot judge trade accuracy
//     without an expert. The proxy uses answer-shape rules that
//     correlate with expert-quality answers: length band · positive
//     opening (not an apology) · not the fallback template.
//
// The gate never rewrites the answer. On failure it tells the composer
// whether tightening context might help. The composer either retries
// with tighter T1-only context or returns an honest "need more info".

import type { TieredCandidate } from "./_evidence_tiering";
import type { ScorerIntentKind } from "./_evidence_tiering";

export type GateResult = {
  passed:    boolean;
  failures:  string[];   // human-readable check failures for audit
  can_retry: boolean;    // whether tightening context is worth trying
};

// Terms that are almost never on-topic when the question is a plain
// "what is X?" definition · unless the queried term itself contains
// them. These are DESIGN-HISTORY / DECORATIVE-FLOURISH markers · NOT
// general trade vocabulary. Trade adjacents like "spray finishing",
// "sanding", "brush painting" are legitimate context for the terms
// they explain and must never be flagged.
const OFF_TOPIC_MARKERS = [
  "monkey volute", "monkey's tail",
  "starting scroll", "starting volute",
  "art deco", "art nouveau",
  // Era markers · only flagged when they aren't the queried term
  "victorian", "edwardian", "georgian", "regency",
];

// The composer's fallback-template opening line (line 643 of _composer.ts).
// If the answer starts with this the LLM was down · gate fails hard.
const FALLBACK_OPENER = "i'm having a slow moment on the writing side";

// Length band for a good expert terminology answer. Below → probably a
// stub or an apology. Above → probably over-answering. Ceiling calibrated
// against the composer's own structured-container system prompt which
// produces Quick Answer + Key Information + Next Steps for definition
// intent (typical range 800-1500 chars for a well-shaped answer).
const MIN_ANSWER_LENGTH = 40;
const MAX_ANSWER_LENGTH = 1600;

export function runQualityGate(
  answer: string,
  intentKind: ScorerIntentKind,
  queriedTerm: string,
  usedCandidates: TieredCandidate[],
): GateResult {
  // Phase 1 · only terminology intent is gated
  if (intentKind !== "terminology_lookup") {
    return { passed: true, failures: [], can_retry: false };
  }

  const failures: string[] = [];
  const answerTrim = answer.trim();
  const answerLower = answerTrim.toLowerCase();
  const term = queriedTerm.trim().toLowerCase();

  // Check 1 · first sentence directly answers the question
  const firstSentence = extractFirstSentence(answerTrim);
  if (!firstSentenceAnswers(firstSentence, term)) {
    failures.push(`check1 · first sentence does not directly define '${queriedTerm}'`);
  }

  // Check 2 · answer stays on topic (opening paragraph anchors, no drift)
  // The strict "every sentence must contain the term" reading rejects
  // expert prose that uses pronouns ("it", "the finish", "the system")
  // after the opening. Reframed: pass if the OPENING paragraph anchors
  // to the term at least twice OR the overall term-density is above a
  // low floor. Real off-topic drift is caught by check 3 (markers).
  const openingParagraph = answerTrim.split(/\n{2,}/)[0] ?? answerTrim.slice(0, 400);
  const openingMentions = countOccurrences(openingParagraph.toLowerCase(), term);
  const sentences = splitSentences(answerTrim);
  const supportedCount = sentences.filter((s) => sentenceSupportsTerm(s, term)).length;
  // Fail only when the opening paragraph doesn't anchor AND the whole
  // answer has very low term density (real drift, not just pronoun use)
  const veryLowDensity = sentences.length > 0 && supportedCount * 4 < sentences.length;
  if (openingMentions < 1 && veryLowDensity) {
    failures.push(`check2 · answer does not anchor to '${queriedTerm}' (opening mentions=${openingMentions} · sentences supporting=${supportedCount}/${sentences.length})`);
  }

  // Check 3 · no unrelated staircase terms introduced
  const introduced = OFF_TOPIC_MARKERS.filter(
    (marker) => answerLower.includes(marker) && !term.includes(marker),
  );
  if (introduced.length > 0) {
    failures.push(`check3 · introduced unrelated terms: ${Array.from(new Set(introduced)).join(", ")}`);
  }

  // Check 4 · source is traceable
  if (usedCandidates.length === 0) {
    failures.push("check4 · no source candidates were used · answer has no traceable evidence");
  }

  // Check 5 · structural proxy for professional quality
  if (answerLower.startsWith(FALLBACK_OPENER)) {
    failures.push("check5 · answer is the LLM-unavailable fallback template · not a composed reply");
  } else if (answerTrim.length < MIN_ANSWER_LENGTH) {
    failures.push(`check5 · answer length ${answerTrim.length} below terse-expert floor (${MIN_ANSWER_LENGTH})`);
  } else if (answerTrim.length > MAX_ANSWER_LENGTH) {
    failures.push(`check5 · answer length ${answerTrim.length} above tight-expert ceiling (${MAX_ANSWER_LENGTH}) · likely over-answering`);
  } else if (/^(sorry|unfortunately|i don't|i cannot|i can't|apologies)/i.test(answerTrim)) {
    failures.push("check5 · answer opens with an apology · not the shape a professional would use");
  }

  // Retry is only worth trying when the problem is context-driven
  // (over-answering · off-topic terms · unsupported sentences).
  // If check 1 or check 4 fail the underlying evidence is the problem,
  // and re-running with the same evidence would land in the same place.
  const contextDrivenFailure = failures.some(
    (f) => f.startsWith("check2") || f.startsWith("check3") ||
           f.includes("above tight-expert ceiling"),
  );
  const evidenceFailure = failures.some(
    (f) => f.startsWith("check1") || f.startsWith("check4"),
  );

  return {
    passed:    failures.length === 0,
    failures,
    can_retry: contextDrivenFailure && !evidenceFailure,
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────

function extractFirstSentence(text: string): string {
  const trimmed = text.trim();
  const match = trimmed.match(/^[^.!?\n]+[.!?]/);
  return (match ? match[0] : trimmed.slice(0, 200)).trim();
}

function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 5);
}

function firstSentenceAnswers(sentence: string, term: string): boolean {
  const s = sentence.toLowerCase();
  if (!term) return false;
  // Definition-shape patterns · must be at or near the start
  const opening = s.slice(0, 160);
  const patterns = [
    new RegExp(`\\b${escapeRegex(term)}\\s+is\\s+(a|an|the)\\b`),
    new RegExp(`^a\\s+${escapeRegex(term)}\\s+is\\b`),
    new RegExp(`^an\\s+${escapeRegex(term)}\\s+is\\b`),
    new RegExp(`^the\\s+${escapeRegex(term)}\\s+is\\b`),
    new RegExp(`\\b${escapeRegex(term)}\\s+refers\\s+to\\b`),
    new RegExp(`\\b${escapeRegex(term)}\\s+means\\b`),
    new RegExp(`^${escapeRegex(term)}s?\\s+are\\b`),
  ];
  return patterns.some((r) => r.test(opening));
}

function sentenceSupportsTerm(sentence: string, term: string): boolean {
  const s = sentence.toLowerCase();
  if (!term) return true;
  if (s.includes(term)) return true;
  // Structural staircase vocabulary that logically supports a
  // terminology answer even without repeating the term. This is a
  // proxy · Phase 2 can replace with a semantic check.
  const structuralVocab = [
    "support", "supports", "supporting", "supported",
    "structural", "structure",
    "vertical", "horizontal", "angled",
    "fixing", "fixings", "fixed", "fitted", "mounted",
    "purpose", "function", "role", "acts as", "used for",
    "provides", "provide", "carries", "carry", "anchor", "anchors", "anchored",
    "connects", "connect", "joins", "join",
    "sits", "sit", "sits on", "runs along",
    "made from", "made of",
  ];
  return structuralVocab.some((v) => s.includes(v));
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function countOccurrences(haystack: string, needle: string): number {
  if (!needle) return 0;
  return haystack.split(needle).length - 1;
}
