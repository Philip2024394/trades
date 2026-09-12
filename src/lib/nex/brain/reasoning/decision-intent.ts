// src/lib/nex/brain/reasoning/decision-intent.ts
//
// NEX Wave 7 · Conversational Entity Reasoning
// Philip 2026-09-06 · CEREMONIAL AUTHORIZE
//
// PURPOSE (§2 · §11 · §12)
//   Unified semantic classifier for entity-reasoning dialogue acts.
//   Distinguishes 10 ENTITY_*_REQUEST kinds so a downstream composer
//   can produce the correct grounded reply.
//
//   Extends — DOES NOT REPLACE — the existing detectors:
//     · detectRecommendationIntent (recommendation.ts)
//     · detectComparisonIntent      (comparison.ts)
//   AND adds detectors this slice needs that don't exist yet:
//     · pros/cons
//     · best-for
//     · suitability
//     · why / explain-yourself
//     · epistemic challenge (are-you-sure / how do you know)
//     · unknown-request (what don't you know?)
//     · evidence-request (what are you basing that on?)
//
// SEMANTIC · NOT PHRASE-LIST (§12)
//   Compose vocabulary tokens (modal · verb · noun · marker) into
//   structural patterns. Equivalent expressions must classify the same.
//   EN + ID.

import { detectRecommendationIntent } from "../recommendation";
import { detectComparisonIntent } from "../comparison";

// ─── Types ──────────────────────────────────────────────────────

export type DecisionIntentKind =
  | "ENTITY_OPINION_REQUEST"          // "what do you think of it?"
  | "ENTITY_RECOMMENDATION_REQUEST"   // "which would you choose?"
  | "ENTITY_COMPARISON"               // "compare the first two"
  | "ENTITY_PROS_CONS"                // "pros and cons?"
  | "ENTITY_BEST_FOR"                 // "which is best for me?"
  | "ENTITY_SUITABILITY"              // "would this work for our family?"
  | "ENTITY_RANKING"                  // "which is cheapest?" (factual ranking)
  | "ENTITY_REASON_REQUEST"           // "why?" / "explain"
  | "ENTITY_UNKNOWN_REQUEST"          // "what don't you know?"
  | "ENTITY_EVIDENCE_REQUEST"         // "what are you basing that on?"
  | "NONE";

export type DecisionIntentDetection = {
  kind: DecisionIntentKind;
  markers: string[];
  language: "EN" | "ID" | "MIXED";
  confidence: "HIGH" | "MEDIUM" | "LOW";
  reason: string;
};

// ─── Tokenizer ──────────────────────────────────────────────────

function tokens(message: string): string[] {
  return (message || "")
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[?.!,;:"“”()]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

// ─── Vocabulary (EN + ID) ───────────────────────────────────────
// Each set contains distinctive tokens for its dialogue act. No
// phrase-list · these are word-level semantic markers.

const OPINION_TOKENS = new Set([
  "think", "opinion", "feel",
  "pikir", "pendapat", "menurut",
]);

// "why" · "how do you know" · "explain"
const REASON_TOKENS = new Set([
  "why", "explain", "because",
  "kenapa", "mengapa", "jelaskan",
]);

// "how do you know" · "how did you decide" — REASON compound
const KNOW_TOKENS = new Set(["know", "decide", "tahu", "putuskan"]);

// "are you sure" · "certain" · "confident"
const EPISTEMIC_CHALLENGE_TOKENS = new Set([
  "sure", "certain", "confident", "positive",
  "yakin", "pasti", "benar",
]);

// "what don't you know" · "not sure about"
// (require negation to fire · not just "know" alone)
const NEGATION_TOKENS = new Set([
  "dont", "not", "no", "isnt", "arent", "cant",
  "tidak", "belum", "bukan",
]);

const UNKNOWN_TOKENS = new Set([
  "unknown", "uncertain", "unclear", "missing",
  "unsure",
  "belum", "belum diketahui",
]);

// "basing" · "based on" · "evidence" · "on what basis?"
// Integration Recovery 2026-09-06: added "basis" (EN), "dasarnya"
// (ID · dasar + -nya possessive suffix) to close natural-variation
// gaps the reasoning gate must handle per §11.
const EVIDENCE_TOKENS = new Set([
  "basing", "based", "basis", "evidence", "source", "proof",
  "dasar", "dasarnya", "bukti", "sumber",
]);

// "pros and cons" · "advantages disadvantages"
const PROS_TOKENS = new Set([
  "pros", "advantages", "upsides", "benefits", "goods",
  "kelebihan", "keunggulan",
]);
const CONS_TOKENS = new Set([
  "cons", "disadvantages", "downsides", "drawbacks", "bads",
  "kekurangan", "kelemahan",
]);

// "best for" · "for me" / "for us" / "for our family"
const BEST_FOR_TOKENS = new Set(["best", "terbaik"]);
const FOR_TOKENS = new Set(["for", "untuk", "bagi"]);
const SELF_TOKENS = new Set([
  "me", "us", "our", "my", "family", "kids", "children", "us",
  "saya", "kami", "kita", "keluarga", "anak", "anak-anak",
]);

// suitability · "would this work" / "would it work"
const SUITABILITY_TOKENS = new Set(["work", "suit", "suitable", "fit", "cocok", "sesuai"]);

// Integration Recovery 2026-09-06: choice-question detector.
// Composes interrogative(which/mana) + subject-you + choice-verb.
// Handles "mana yang akan kamu pilih?" (ID) and equivalent EN forms
// that the phrase-anchored detectRecommendationIntent misses.
const CHOICE_VERB_TOKENS = new Set([
  "pilih", "pilihan", "rekomendasi", "rekomendasikan", "sarankan",
  "pick", "choose", "recommend",
]);
const SUBJECT_YOU_TOKENS = new Set(["you", "kamu", "anda"]);

// factual ranking · "cheapest / closest / highest" superlatives
const RANKING_SUPERLATIVE_SUFFIX = /(est|iest)$/;
const RANKING_LEXICON = new Set([
  "cheapest", "closest", "biggest", "smallest", "highest", "lowest",
  "furthest", "farthest", "fastest", "slowest", "nearest",
  "termurah", "terdekat", "terbesar", "terkecil", "tertinggi", "terjauh",
]);

// question interrogatives — most reasoning acts require an
// interrogative shape (or an imperative like "explain")
const INTERROGATIVE_TOKENS = new Set([
  "what", "which", "who", "how", "why", "when", "where",
  "apa", "yang", "mana", "siapa", "bagaimana", "kenapa", "mengapa",
]);
const IMPERATIVE_TOKENS = new Set([
  "explain", "compare", "recommend",
  "jelaskan", "bandingkan", "rekomendasikan",
]);

// language heuristic · presence of ID-only tokens marks ID
const ID_STRONG_TOKENS = new Set([
  "yang", "apa", "mana", "kenapa", "mengapa", "bandingkan",
  "kelebihan", "kekurangan", "kelemahan", "keunggulan",
  "tahu", "yakin", "pasti", "cocok", "sesuai",
  "termurah", "terdekat", "terbesar",
  "saya", "kami", "kita", "keluarga", "anak",
  "menurut", "pendapat", "pikir",
  "bagi", "untuk",
  "pertama", "kedua", "ketiga", "terakhir", "dan",
]);

// ─── Language detection ─────────────────────────────────────────

function detectLanguage(t: string[]): "EN" | "ID" | "MIXED" {
  let id = 0, en = 0;
  for (const tok of t) {
    if (ID_STRONG_TOKENS.has(tok)) id++;
    else if (/^[a-z]+$/.test(tok)) en++;
  }
  if (id > 0 && en > 0) return "MIXED";
  if (id > 0) return "ID";
  return "EN";
}

// ─── Detectors ──────────────────────────────────────────────────

function containsAny(t: string[], set: Set<string>): string[] {
  const hits: string[] = [];
  for (const tok of t) if (set.has(tok)) hits.push(tok);
  return hits;
}

function isRankingSuperlative(t: string[]): string | null {
  for (const tok of t) {
    if (RANKING_LEXICON.has(tok)) return tok;
    // catch general -est superlatives ("smartest", "quietest")
    if (tok.length >= 5 && RANKING_SUPERLATIVE_SUFFIX.test(tok) && !["best", "worst"].includes(tok)) return tok;
  }
  return null;
}

// "what/which don't/dont you know"
function isUnknownRequest(t: string[]): boolean {
  const hasNeg = containsAny(t, NEGATION_TOKENS).length > 0;
  const hasKnow = containsAny(t, KNOW_TOKENS).length > 0;
  const hasUnknown = containsAny(t, UNKNOWN_TOKENS).length > 0;
  const hasInterrogative = containsAny(t, INTERROGATIVE_TOKENS).length > 0;
  if (hasUnknown && hasInterrogative) return true;
  return hasNeg && hasKnow && hasInterrogative;
}

// "how do you know" / "how did you know" · "what makes you say that"
function isReasonRequest(t: string[]): boolean {
  if (t.length === 1 && (t[0] === "why" || t[0] === "kenapa" || t[0] === "mengapa")) return true;
  const hasReason = containsAny(t, REASON_TOKENS).length > 0;
  if (hasReason) return true;
  const hasHow = t.includes("how") || t.includes("bagaimana");
  const hasKnow = containsAny(t, KNOW_TOKENS).length > 0;
  if (hasHow && hasKnow) return true;
  // "makes you say that"
  if (t.includes("makes") && (t.includes("say") || t.includes("think"))) return true;
  return false;
}

// "are you sure" / "certain about that" / "confident"
function isEpistemicChallenge(t: string[]): boolean {
  const hasChallenge = containsAny(t, EPISTEMIC_CHALLENGE_TOKENS).length > 0;
  if (!hasChallenge) return false;
  // Must be about NEX ("you" / "kamu" / "anda") OR an isolated
  // "sure?" · "certain?"
  const aboutNex = t.includes("you") || t.includes("kamu") || t.includes("anda");
  return aboutNex || t.length <= 3;
}

// "what are you basing that on?" · "on what evidence?"
function isEvidenceRequest(t: string[]): boolean {
  const hasEv = containsAny(t, EVIDENCE_TOKENS).length > 0;
  return hasEv;
}

// "pros and cons?" · "any downsides?"
function isProsCons(t: string[]): boolean {
  const hasPros = containsAny(t, PROS_TOKENS).length > 0;
  const hasCons = containsAny(t, CONS_TOKENS).length > 0;
  return hasPros || hasCons;
}

// "best for me/us/our family" · "for four people"
function isBestFor(t: string[]): boolean {
  const hasBest = containsAny(t, BEST_FOR_TOKENS).length > 0;
  const hasFor = containsAny(t, FOR_TOKENS).length > 0;
  const hasSelf = containsAny(t, SELF_TOKENS).length > 0;
  return hasBest && hasFor && hasSelf;
}

// "would this work for us" · "suitable for a family"
function isSuitability(t: string[]): boolean {
  const hasWork = containsAny(t, SUITABILITY_TOKENS).length > 0;
  const hasSelf = containsAny(t, SELF_TOKENS).length > 0;
  return hasWork && (hasSelf || containsAny(t, FOR_TOKENS).length > 0);
}

// "what do you think" · "your opinion"
function isOpinionRequest(t: string[]): boolean {
  const hasOpinion = containsAny(t, OPINION_TOKENS).length > 0;
  const aboutNex = t.includes("you") || t.includes("your") || t.includes("kamu") || t.includes("anda") || t.includes("menurut");
  return hasOpinion && aboutNex;
}

// "which will you choose?" · "mana yang akan kamu pilih?"
// Requires interrogative(which/mana) + subject(you/kamu/anda) +
// choice-verb(pilih/pick/choose/recommend). Composed, not phrase-list.
function isChoiceQuestion(t: string[]): boolean {
  const hasWhich = t.includes("which") || t.includes("mana");
  if (!hasWhich) return false;
  const hasSubjectYou = containsAny(t, SUBJECT_YOU_TOKENS).length > 0;
  const hasChoiceVerb = containsAny(t, CHOICE_VERB_TOKENS).length > 0;
  return hasSubjectYou && hasChoiceVerb;
}

// ─── Main classifier ────────────────────────────────────────────

export function classifyDecisionIntent(message: string): DecisionIntentDetection {
  const t = tokens(message);
  const markers: string[] = [];
  const lang = detectLanguage(t);
  const none = (reason: string): DecisionIntentDetection => ({
    kind: "NONE", markers, language: lang, confidence: "LOW", reason,
  });
  if (t.length === 0) return none("empty");

  // Order matters · most specific first, then more general.

  // 1 · epistemic challenge · very short · often "are you sure?"
  if (isEpistemicChallenge(t)) {
    markers.push("epistemic_challenge");
    return { kind: "ENTITY_EVIDENCE_REQUEST", markers, language: lang, confidence: "HIGH", reason: "epistemic_challenge:sure" };
  }

  // 2 · evidence request · "on what basis?" / "what's your source?"
  if (isEvidenceRequest(t)) {
    markers.push("evidence_request");
    return { kind: "ENTITY_EVIDENCE_REQUEST", markers, language: lang, confidence: "HIGH", reason: "evidence_request" };
  }

  // 3 · unknown request · "what don't you know?"
  if (isUnknownRequest(t)) {
    markers.push("unknown_request");
    return { kind: "ENTITY_UNKNOWN_REQUEST", markers, language: lang, confidence: "HIGH", reason: "unknown_request" };
  }

  // 4 · reason request · "why?" / "how do you know"
  if (isReasonRequest(t)) {
    markers.push("reason_request");
    return { kind: "ENTITY_REASON_REQUEST", markers, language: lang, confidence: "HIGH", reason: "reason_request" };
  }

  // 5 · pros/cons
  if (isProsCons(t)) {
    markers.push("pros_cons");
    return { kind: "ENTITY_PROS_CONS", markers, language: lang, confidence: "HIGH", reason: "pros_cons" };
  }

  // 6 · best-for · "which is best for me/us" (BEFORE comparison so
  // "which is best for me" doesn't get captured by comparison's
  // "which is best" trigger)
  if (isBestFor(t)) {
    markers.push("best_for");
    return { kind: "ENTITY_BEST_FOR", markers, language: lang, confidence: "HIGH", reason: "best_for" };
  }

  // 7 · comparison · reuse existing detector
  if (detectComparisonIntent(message)) {
    markers.push("comparison_intent");
    return { kind: "ENTITY_COMPARISON", markers, language: lang, confidence: "HIGH", reason: "comparison_intent" };
  }

  // 8 · suitability · "would this work for four people?"
  if (isSuitability(t)) {
    markers.push("suitability");
    return { kind: "ENTITY_SUITABILITY", markers, language: lang, confidence: "MEDIUM", reason: "suitability" };
  }

  // 9 · factual ranking · superlative + interrogative
  const rankSuper = isRankingSuperlative(t);
  if (rankSuper) {
    const hasInterrogative = containsAny(t, INTERROGATIVE_TOKENS).length > 0;
    if (hasInterrogative) {
      markers.push(`ranking:${rankSuper}`);
      return { kind: "ENTITY_RANKING", markers, language: lang, confidence: "HIGH", reason: `ranking:${rankSuper}` };
    }
  }

  // 10 · recommendation · reuse existing detector
  if (detectRecommendationIntent(message)) {
    markers.push("recommendation_intent");
    return { kind: "ENTITY_RECOMMENDATION_REQUEST", markers, language: lang, confidence: "HIGH", reason: "recommendation_intent" };
  }

  // 10b · choice-question · composed detector for ID/EN variants the
  //       phrase-anchored recommendation detector doesn't cover, e.g.
  //       "mana yang akan kamu pilih?". Integration Recovery 2026-09-06.
  if (isChoiceQuestion(t)) {
    markers.push("choice_question");
    return { kind: "ENTITY_RECOMMENDATION_REQUEST", markers, language: lang, confidence: "HIGH", reason: "choice_question" };
  }

  // 11 · opinion · "what do you think of it?"
  if (isOpinionRequest(t)) {
    markers.push("opinion_request");
    return { kind: "ENTITY_OPINION_REQUEST", markers, language: lang, confidence: "MEDIUM", reason: "opinion_request" };
  }

  return none("no_decision_intent_matched");
}
