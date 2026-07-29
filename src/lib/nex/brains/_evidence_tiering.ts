// src/lib/nex/brains/_evidence_tiering.ts
//
// Phase 1 · Terminology Intelligence Mode · tier scorer (Philip 2026-07-29)
// ─────────────────────────────────────────────────────────────────────────
// Given a retrieved candidate, the intent, and the queried term, returns
// a tier (1 / 2 / 3) that says how directly the candidate answers THIS
// specific question.
//
// Philip's rule (2026-07-29): tier assignment is INTENT-RELATIVE. The
// same fact can be Tier 1 for a design-history question and Tier 3 for
// a terminology question. The scorer never assigns a permanent tier.
//
// Terminology intent tiers:
//   T1  primary subject IS the queried term AND the snippet reads as a
//       direct definition
//   T2  primary subject IS the queried term but the snippet is supporting
//       context (purpose · common mistakes · related-term explanation)
//   T3  the queried term is only mentioned; the primary subject is a
//       different concept (background · related but not asked)
//
// Non-terminology intents are unmodified in Phase 1 — every candidate
// scores T2 (neutral) so the expert filter passes them through unchanged.
// Phase 2 extends scoring to comparison / how_to / fault_diagnosis / etc.

import type { RetrievalHit } from "./_router";

export type Tier = 1 | 2 | 3;

export type TieredCandidate = {
  hit: RetrievalHit;
  tier: Tier;
  reason: string;      // short justification · shows in audit trail
};

// Kinds of intent this scorer knows how to differentiate. Kept as a
// string union rather than importing IntentKind from _intent.ts to
// avoid a coupling loop and to keep this file focused on tier logic.
export type ScorerIntentKind =
  | "terminology_lookup"
  | "other";

export function scoreCandidate(
  hit: RetrievalHit,
  intentKind: ScorerIntentKind,
  queriedTerm: string,
): TieredCandidate {
  if (intentKind === "terminology_lookup") {
    return scoreTerminology(hit, queriedTerm);
  }
  return { hit, tier: 2, reason: "non-terminology intent · Phase 1 pass-through (T2)" };
}

export function scoreCandidates(
  hits: RetrievalHit[],
  intentKind: ScorerIntentKind,
  queriedTerm: string,
): TieredCandidate[] {
  return hits.map((h) => scoreCandidate(h, intentKind, queriedTerm));
}

// ─── Terminology scoring ─────────────────────────────────────────────

function scoreTerminology(hit: RetrievalHit, queriedTerm: string): TieredCandidate {
  const term = normalise(queriedTerm);
  const snippet = normalise(hit.snippet);
  const moduleIsTerminology = String(hit.module).toLowerCase() === "terminology";

  // T1 · glossary hit (definitional by construction · the retriever only
  // emits glossary hits when the queried term matches term.term or the
  // authored definition). ref_id shape: "glossary:<term>".
  if (hit.ref_id.startsWith("glossary:")) {
    const glossaryTerm = normalise(hit.ref_id.slice("glossary:".length));
    if (termsAlign(glossaryTerm, term)) {
      return {
        hit,
        tier: 1,
        reason: `glossary hit for '${glossaryTerm}' · retriever emitted this on term-or-definition match with '${queriedTerm}'`,
      };
    }
  }

  const subjectMatches = snippetSubjectMatches(snippet, term);
  const readsAsDefinition = looksLikeDefinition(snippet, term);
  const termAppearsAtAll = snippetMentionsTerm(snippet, term);

  // T1 · module signal OR subject-match combined with definition shape
  if ((moduleIsTerminology && subjectMatches && readsAsDefinition) ||
      (subjectMatches && readsAsDefinition)) {
    return {
      hit,
      tier: 1,
      reason: `subject matches '${queriedTerm}' · snippet reads as definition${moduleIsTerminology ? " · terminology module" : ""}`,
    };
  }

  // T2 · subject matches but the snippet is context, not a definition
  if (subjectMatches || (moduleIsTerminology && termAppearsAtAll)) {
    return {
      hit,
      tier: 2,
      reason: `subject relates to '${queriedTerm}' · snippet is supporting context`,
    };
  }

  // T3 · term mentioned in passing but hit is about something else
  if (termAppearsAtAll) {
    return {
      hit,
      tier: 3,
      reason: `'${queriedTerm}' mentioned but primary subject differs`,
    };
  }

  // Term does not appear at all → still T3 (weakest relevance)
  return {
    hit,
    tier: 3,
    reason: `'${queriedTerm}' not mentioned · retrieval kept this hit on weak signal`,
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────

function normalise(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]+/g, " ")
    .replace(/\s+/g, " ");
}

/**
 * The snippet's primary subject matches the queried term when the first
 * clause of the snippet is about the term. We look for the term appearing
 * before the first sentence break, in a definition-like position.
 */
function snippetSubjectMatches(snippetNorm: string, termNorm: string): boolean {
  if (!snippetNorm || !termNorm) return false;
  // Look inside the first 120 characters — the snippet's opening.
  const opening = snippetNorm.slice(0, 120);
  const termWithMargins = new RegExp(`(^|\\s)${escapeRegex(termNorm)}(\\s|$|s\\s|s$)`);
  if (!termWithMargins.test(opening)) return false;
  // Reject openings that clearly frame the term as an example / aside
  const asides = [
    /^(also|see|note|for example|traditionally|in some cases|historically)/,
  ];
  if (asides.some((r) => r.test(opening))) return false;
  return true;
}

function snippetMentionsTerm(snippetNorm: string, termNorm: string): boolean {
  if (!snippetNorm || !termNorm) return false;
  return new RegExp(`(^|\\s)${escapeRegex(termNorm)}(\\s|$|s\\s|s$)`).test(snippetNorm);
}

/**
 * A snippet "reads as a definition" when it opens with a canonical
 * definition pattern for the queried term. This is a deterministic
 * proxy — Phase 2 can add embedding-based confirmation.
 */
function looksLikeDefinition(snippetNorm: string, termNorm: string): boolean {
  if (!snippetNorm || !termNorm) return false;
  const t = escapeRegex(termNorm);
  const patterns = [
    new RegExp(`^${t}\\s+is\\s+(a|an|the)\\b`),
    new RegExp(`^a\\s+${t}\\s+is\\b`),
    new RegExp(`^an\\s+${t}\\s+is\\b`),
    new RegExp(`^the\\s+${t}\\s+is\\b`),
    new RegExp(`^${t}\\s+refers\\s+to\\b`),
    new RegExp(`^${t}\\s+means\\b`),
    new RegExp(`^${t}s?\\s+are\\s+(the|a)\\b`),
    // Definition sentence that starts mid-snippet after a colon or dash
    new RegExp(`[:\\-]\\s+${t}\\s+is\\s+(a|an|the)\\b`),
  ];
  return patterns.some((r) => r.test(snippetNorm));
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Two terms "align" when they refer to the same concept — exact match,
 * one-word plural/singular, or one contained inside the other with a
 * whole-word boundary. Used to match a queried term against a glossary
 * key (which may be capitalised or hyphenated).
 */
function termsAlign(a: string, b: string): boolean {
  const na = normalise(a);
  const nb = normalise(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  if (na.replace(/s$/, "") === nb.replace(/s$/, "")) return true;
  const bounded = (needle: string, hay: string) =>
    new RegExp(`(^|\\s)${escapeRegex(needle)}(\\s|$)`).test(hay);
  return bounded(na, nb) || bounded(nb, na);
}
