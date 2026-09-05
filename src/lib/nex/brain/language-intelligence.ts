// src/lib/nex/brain/language-intelligence.ts
//
// NEX LANGUAGE INTELLIGENCE · FOUNDATION SLICE
// Philip 2026-09-05 · AUTHORIZE · NEX LANGUAGE INTELLIGENCE FOUNDATION
//
// PURPOSE
//   This file is the SMALLEST safe foundation of a future NEX-owned
//   Language Intelligence layer. It exists so that the result-followup
//   regression can be solved by SEMANTIC INTERPRETATION rather than by
//   accumulating regex phrases.
//
//   The prior slice matched sentence patterns. Adding "where are these
//   from?" required a new regex; adding "how were these sourced?" would
//   require another. That trajectory is architecturally unacceptable:
//   NEX would need to memorise every English sentence.
//
//   Instead this file decomposes a message into small linguistic
//   FEATURES (interrogative word, referent kind, verb semantic class,
//   postpositions) and lets a small composition function decide the
//   conversational INTENT. New surface forms cost nothing if they use
//   the same feature vocabulary.
//
// IMPLEMENTED NOW (minimum viable)
//   · Interrogative word extraction   (where · how · what · when · why · who · which)
//   · Referent extraction             (deictic plural: these/those/them ·
//                                       deictic singular: this/that/it ·
//                                       pronoun plural: they ·
//                                       ordinal: first/second/... )
//   · Verb-semantic classification    (provenance vs stative_location vs other)
//   · Postposition detection          (from — an origin marker)
//   · Source-noun detection           (source · origin — provenance markers)
//   · Composition rules that emit:
//       - result_provenance_followup
//       - location_query
//       - ordinary
//
// NOT IMPLEMENTED (future NEX Language Intelligence roadmap)
//   Full grammar model · morphology engine · dictionary replacement ·
//   Indonesian grammar · multilingual grammar · spatial/temporal
//   relation vocabulary beyond what this slice needs · LLM-based
//   semantic parser · autonomous language acquisition · language agent.
//   Sense disambiguation of polysemous words (which "lead" is meant?)
//   and homophone routing (their vs there vs they're via STT context)
//   — those consume the lexicon catalogue but require their own gates.
//
// ARCHITECTURAL PRINCIPLE
//   words → linguistic structure → meaning → conversational function
//   → reference → context → evidence → answer.
//   NOT: phrase → regex → response.

import {
  verbCategories, adverbCategories,
  isPolysemous, sensesOf,
  hasHomophones, homophonesOf,
  type VerbCategory, type AdverbCategory, type WordSense,
} from "./language-lexicon";

// ─── Types ──────────────────────────────────────────────────────

export type InterrogativeWord =
  | "where" | "how" | "what" | "when" | "why" | "who" | "which";

export type ReferentKind =
  | "deictic_plural"    // these · those · them
  | "deictic_singular"  // this · that · it
  | "pronoun_plural"    // they
  | "pronoun_singular"  // he · she
  | "ordinal";          // first · second · ...

export type Referent = { kind: ReferentKind; token: string };

export type VerbSemantic =
  | "provenance"        // find · get · discover · source · come (from)
  | "stative_location"  // is · are · sit · locate
  | "other";

/** Token-level lexicon annotation for a message. Populated from
 *  `language-lexicon.ts`. Available for downstream consumers (future
 *  disambiguation modules, tone/register selection, entity typing).
 *  Existing intent-composition rules do NOT depend on this field —
 *  it's additive so no regression risk. */
export type LexiconAnnotation = {
  verbs: Array<{ token: string; categories: VerbCategory[] }>;
  adverbs: Array<{ token: string; categories: AdverbCategory[] }>;
  polysemous_tokens: Array<{ token: string; senses: ReadonlyArray<WordSense> }>;
  homophone_tokens: Array<{ token: string; alternates: ReadonlyArray<string> }>;
};

export type LinguisticFeatures = {
  original_message: string;
  interrogative: InterrogativeWord | null;
  referents: Referent[];
  verb_semantic: VerbSemantic;
  has_from_postposition: boolean;
  has_source_noun: boolean;
  /** Whether the message contains an imperative-shape opener like
   *  "find" · "show" · "give" at position 0 — helps distinguish
   *  "find me a hotel" (imperative) from "where did you find them"
   *  (interrogative). Deterministic. */
  imperative_opener: boolean;
  /** Lexicon-derived per-token annotations. Additive: no existing
   *  intent-composition rule depends on this field. */
  lexicon: LexiconAnnotation;
};

export type MessageIntent =
  | { kind: "result_provenance_followup"; features: LinguisticFeatures; confidence: "high" | "medium" }
  | { kind: "location_query"; features: LinguisticFeatures; confidence: "high" | "medium" }
  | { kind: "ordinary"; features: LinguisticFeatures };

// ─── Small tokenizer (deliberate: no external tokenizer dep) ────

function tokens(message: string): string[] {
  return (message || "")
    .toLowerCase()
    .replace(/[?.!,;:"“”'’()]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

// ─── Interrogative extraction ───────────────────────────────────

const INTERROGATIVE_SET = new Set<InterrogativeWord>([
  "where", "how", "what", "when", "why", "who", "which",
]);

export function extractInterrogative(message: string): InterrogativeWord | null {
  const t = tokens(message);
  if (t.length === 0) return null;
  // Interrogative may appear at position 0 ("where you find them") or
  // after a leading question ("so where did you find them"). Look at
  // the first three tokens. We do NOT scan the whole sentence — a
  // trailing "how" inside a subclause is not the question shape.
  for (let i = 0; i < Math.min(t.length, 3); i++) {
    if (INTERROGATIVE_SET.has(t[i] as InterrogativeWord)) return t[i] as InterrogativeWord;
  }
  return null;
}

// ─── Referent extraction ────────────────────────────────────────

const DEICTIC_PLURAL = new Set(["these", "those", "them"]);
const DEICTIC_SINGULAR = new Set(["this", "that", "it"]);
const PRONOUN_PLURAL = new Set(["they"]);
const PRONOUN_SINGULAR = new Set(["he", "she"]);
const ORDINAL_TOKENS = new Set([
  "first", "second", "third", "fourth", "fifth",
  "sixth", "seventh", "eighth", "ninth", "tenth",
  "last", "next", "previous", "1st", "2nd", "3rd", "4th", "5th",
]);

export function extractReferents(message: string): Referent[] {
  const t = tokens(message);
  const out: Referent[] = [];
  for (const token of t) {
    if (DEICTIC_PLURAL.has(token))       out.push({ kind: "deictic_plural", token });
    else if (DEICTIC_SINGULAR.has(token))out.push({ kind: "deictic_singular", token });
    else if (PRONOUN_PLURAL.has(token))  out.push({ kind: "pronoun_plural", token });
    else if (PRONOUN_SINGULAR.has(token))out.push({ kind: "pronoun_singular", token });
    else if (ORDINAL_TOKENS.has(token))  out.push({ kind: "ordinal", token });
  }
  return out;
}

// ─── Verb-semantic classification ───────────────────────────────
//
// Deliberate binary + "other" — the smallest classifier that
// distinguishes PROVENANCE follow-ups from LOCATION queries.
// Extending the vocabulary means adding a lemma to the correct set,
// not writing a new regex.

const PROVENANCE_VERB_LEMMAS = new Set([
  "find", "found", "finding", "finds",
  "get", "got", "getting", "gets",
  "discover", "discovered", "discovering", "discovers",
  "source", "sourced", "sourcing", "sources",
  "retrieve", "retrieved", "retrieving", "retrieves",
  "pull", "pulled", "pulling", "pulls",
  "come",  // "come from" is idiomatic provenance
  "came",
  "coming",
]);

const STATIVE_LOCATION_VERB_LEMMAS = new Set([
  "is", "are", "was", "were", "be", "being",
  "sit", "sits", "sitting", "sat",
  "located", "locate", "locates", "locating",
  "situated",
]);

/** Return the first verb-class match found in the message.
 *  When both categories appear (rare), provenance wins — this reflects
 *  the empirical observation that stative verbs frequently appear
 *  auxiliary to provenance ones ("where were these found"). */
export function classifyVerbSemantic(message: string): VerbSemantic {
  const t = tokens(message);
  let sawStative = false;
  for (const token of t) {
    if (PROVENANCE_VERB_LEMMAS.has(token)) return "provenance";
    if (STATIVE_LOCATION_VERB_LEMMAS.has(token)) sawStative = true;
  }
  return sawStative ? "stative_location" : "other";
}

// ─── Postposition / source-noun detection ───────────────────────

export function hasFromPostposition(message: string): boolean {
  const t = tokens(message);
  return t.includes("from");
}

const SOURCE_NOUNS = new Set(["source", "sources", "origin", "origins", "provenance"]);

export function hasSourceNoun(message: string): boolean {
  const t = tokens(message);
  return t.some((tok) => SOURCE_NOUNS.has(tok));
}

// ─── Imperative-opener detection ────────────────────────────────

const IMPERATIVE_OPENERS = new Set([
  "find", "show", "give", "list", "search", "recommend",
  "suggest", "get", "tell", "book", "look",
]);

export function hasImperativeOpener(message: string): boolean {
  const t = tokens(message);
  return t.length > 0 && IMPERATIVE_OPENERS.has(t[0]);
}

// ─── Feature aggregation ────────────────────────────────────────

// ─── Lexicon annotation ─────────────────────────────────────────
//
// Walks the message's tokens once and records every hit against the
// lexicon catalogues. O(n) in message length; each check is O(1) set
// or Map lookup. Preserves per-token order so downstream consumers
// can reason about position.

export function annotateLexicon(message: string): LexiconAnnotation {
  const t = tokens(message);
  const verbs: LexiconAnnotation["verbs"] = [];
  const adverbs: LexiconAnnotation["adverbs"] = [];
  const polysemous_tokens: LexiconAnnotation["polysemous_tokens"] = [];
  const homophone_tokens: LexiconAnnotation["homophone_tokens"] = [];
  for (const token of t) {
    const vc = verbCategories(token);
    if (vc.length > 0) verbs.push({ token, categories: vc });
    const ac = adverbCategories(token);
    if (ac.length > 0) adverbs.push({ token, categories: ac });
    if (isPolysemous(token)) {
      polysemous_tokens.push({ token, senses: sensesOf(token) });
    }
    if (hasHomophones(token)) {
      homophone_tokens.push({ token, alternates: homophonesOf(token) });
    }
  }
  return { verbs, adverbs, polysemous_tokens, homophone_tokens };
}

export function analyzeMessage(message: string): LinguisticFeatures {
  return {
    original_message: message,
    interrogative: extractInterrogative(message),
    referents: extractReferents(message),
    verb_semantic: classifyVerbSemantic(message),
    has_from_postposition: hasFromPostposition(message),
    has_source_noun: hasSourceNoun(message),
    imperative_opener: hasImperativeOpener(message),
    lexicon: annotateLexicon(message),
  };
}

// ─── Intent composition ─────────────────────────────────────────
//
// A single semantic classifier boundary. Any conversational function
// added later belongs in this switch — NOT as a new regex table.
//
// RESULT_PROVENANCE_FOLLOWUP fires when the message asks about the
// SOURCE / ORIGIN of results already presented. The requirement of an
// anaphoric-plural referent is what distinguishes it from location
// queries ("where is the hotel" fails on referent kind).
//
// LOCATION_QUERY fires when the message asks WHERE an entity IS. It
// requires a stative verb OR a bare "where is X" shape.

function hasPluralReferent(features: LinguisticFeatures): boolean {
  return features.referents.some(
    (r) => r.kind === "deictic_plural" || r.kind === "pronoun_plural",
  );
}

function hasSingularOrArticleReferent(features: LinguisticFeatures, message: string): boolean {
  const t = tokens(message);
  if (features.referents.some((r) => r.kind === "deictic_singular" || r.kind === "pronoun_singular")) return true;
  // "the hotel" · "the restaurant" · "the place" — bare-NP location shape.
  const theIndex = t.indexOf("the");
  if (theIndex >= 0 && theIndex < t.length - 1) return true;
  return false;
}

export function interpretIntent(message: string): MessageIntent {
  const features = analyzeMessage(message);

  // If the message begins with an imperative and has no interrogative,
  // it's not a followup at all. ("find me a hotel" · "show me hotels".)
  if (features.imperative_opener && features.interrogative === null) {
    return { kind: "ordinary", features };
  }

  // ─── RESULT_PROVENANCE_FOLLOWUP composition rules ───
  //
  // Rule 1 (high confidence):
  //   interrogative ∈ {where, how} AND provenance verb AND plural referent.
  //   e.g. "where you find them" · "how did you find these"
  //
  // Rule 2 (high confidence):
  //   interrogative = where AND plural referent AND "from" postposition.
  //   e.g. "where are these from" · "where did these come from"
  //
  // Rule 3 (medium confidence):
  //   source-noun AND plural referent.
  //   e.g. "what's the source of these"
  //
  // Rule 4 (high confidence):
  //   interrogative = how AND passive stative + provenance postposition indicators.
  //   e.g. "how were these sourced" · "how were these found"
  //   Detected via source-noun (sourced/found as past-participles are lemmatised).

  const plural = hasPluralReferent(features);
  const inter = features.interrogative;

  if (plural && (inter === "where" || inter === "how") && features.verb_semantic === "provenance") {
    return { kind: "result_provenance_followup", features, confidence: "high" };
  }
  if (plural && inter === "where" && features.has_from_postposition) {
    return { kind: "result_provenance_followup", features, confidence: "high" };
  }
  if (plural && features.has_source_noun) {
    return { kind: "result_provenance_followup", features, confidence: "medium" };
  }

  // ─── LOCATION_QUERY composition rules ───
  //
  // interrogative = where AND stative verb AND singular reference OR "the"-NP.
  // e.g. "where is the hotel" · "where are they" (in some contexts)
  //
  // "where are they" is ambiguous: it can be provenance ("where do they
  // come from") or location. Without further disambiguation, when the
  // message has NO from-postposition, NO source-noun, NO provenance
  // verb, and only a plural pronoun + stative verb, we treat it as
  // LOCATION_QUERY (safer default: don't fabricate provenance).
  if (inter === "where" && features.verb_semantic === "stative_location") {
    if (hasSingularOrArticleReferent(features, message)) {
      return { kind: "location_query", features, confidence: "high" };
    }
    // Plural + stative + no from = ambiguous, err toward location so the
    // provenance path never triggers on the wrong sentence.
    return { kind: "location_query", features, confidence: "medium" };
  }

  return { kind: "ordinary", features };
}
