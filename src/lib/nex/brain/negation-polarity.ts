// src/lib/nex/brain/negation-polarity.ts
//
// G12 · Negation Intelligence & Intent Polarity
// Philip 2026-09-06 · AUTHORIZE · G12 · NEGATION INTELLIGENCE & INTENT POLARITY
//
// PROBLEM
//   "I don't want a hotel" still launched a hotel search. The runtime
//   treated the presence of the entity token "hotel" as sufficient to
//   trigger the hotel intent, ignoring the semantic polarity of the
//   utterance. This is a fundamental conversational-intelligence gap.
//
// GOVERNING PRINCIPLE (locked)
//   NEGATION IS MEANING, NOT A KEYWORD.
//
//   NEX must represent the semantic polarity of the utterance and the
//   SCOPE of the negation (what is being negated) BEFORE routing,
//   retrieval, or composition. The LLM is not permitted to decide
//   whether the user negated an intent.
//
// SCOPE OF THIS MODULE
//   Pure classifier. Given a message string, return a PolarityDetection
//   with polarity ∈ {AFFIRMATIVE · NEGATED · CONTRASTIVE · UNKNOWN} and
//   scope ∈ {REQUEST · ACTION · ENTITY · ATTRIBUTE · RESULT · SOCIAL ·
//   QUESTION · CONTRASTIVE · NONE}. No route.ts changes here; the
//   dialogue-act classifier consumes this and produces the NEGATED_REQUEST
//   function that fires the existing gate.
//
// PRESERVATION
//   · L4 dialogue-act classifier · untouched (this file is consumed by it)
//   · G24 scope validation · untouched
//   · P0.3 hotel resolved-reference · untouched
//   · P0.4 fresh-conv ordinal · untouched
//   · Result-followup gate · untouched

// ─── Types ──────────────────────────────────────────────────────

export type Polarity = "AFFIRMATIVE" | "NEGATED" | "CONTRASTIVE" | "UNKNOWN";

/** What is being negated. Only REQUEST / ACTION / ENTITY / CONTRASTIVE
 *  cause the dialogue-act layer to gate. ATTRIBUTE / RESULT / SOCIAL /
 *  QUESTION are legitimate constructions where negation does NOT
 *  cancel the whole task and MUST NOT fire the gate. */
export type NegationScope =
  | "REQUEST"       // "I don't want X" / "I'm not looking for X"
  | "ACTION"        // "don't search" / "don't book"
  | "ENTITY"        // "not a hotel" / "no hotels"
  | "ATTRIBUTE"     // "not expensive" / "not far" · entity still desired
  | "RESULT"        // "not the first one" · task still active
  | "SOCIAL"        // "no thanks" / "I don't know" · not a rejection
  | "QUESTION"      // "don't you have hotels?" · rhetorical form
  | "CONTRASTIVE"   // "not X — Y" / "not X, I want Y"
  | "NONE";         // no negation trigger

export type PolarityDetection = {
  polarity: Polarity;
  scope: NegationScope;
  /** The negated target (e.g. "hotel", "expensive"). Optional; not
   *  every construction yields a clean target token. */
  target?: string;
  /** The affirmed alternative in a contrastive negation
   *  ("not X — Y" → contrastive_target = Y). */
  contrastive_target?: string;
  confidence: "high" | "medium" | "low";
  reason: string;
};

// ─── Tokenizer (same discipline as sibling classifiers) ──────────

function tokens(message: string): string[] {
  return (message || "")
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[?.!,;:"“”()]/g, " ")
    .replace(/—|–|-{2,}/g, " -- ")   // preserve dash-clause boundary for contrastive detection
    .split(/\s+/)
    .filter(Boolean);
}

// ─── Vocabulary (feature primitives · English + Indonesian) ─────

/** Explicit negation triggers. Word-bounded lookups. */
const NEG_TRIGGERS_EN = new Set([
  "not", "no", "never", "none", "cant", "cannot", "dont", "doesnt",
  "didnt", "wont", "wouldnt", "isnt", "arent", "wasnt", "werent",
  "hadnt", "hasnt", "havent", "nor", "neither", "without",
  "skip", "forget", "avoid",
]);

const NEG_TRIGGERS_ID = new Set([
  "tidak", "nggak", "gak", "tak", "belum", "bukan", "jangan",
  "tanpa", "lewati",
]);

/** First-person markers (mirrors conversational-function.ts) */
const FIRST_PERSON_EN = new Set(["i", "im", "we"]);
const FIRST_PERSON_ID = new Set(["saya", "aku", "gue", "gw", "kami", "kita"]);

/** Desire / need / intention verbs (positive-form). */
const DESIRE_VERBS_EN = new Set([
  "want", "need", "wanted", "needed", "wanting", "needing",
  "looking", "seeking", "after", "want",
  "wish", "wishing", "interested",
]);

const DESIRE_VERBS_ID = new Set([
  "mau", "ingin", "butuh", "mencari", "cari", "carikan",
  "perlu", "membutuhkan",
]);

/** Imperative action verbs · the target of "don't <verb>" patterns. */
const IMPERATIVE_ACTION_EN = new Set([
  "find", "show", "search", "look", "book", "reserve", "get",
  "recommend", "give", "list", "bring", "pull",
]);

const IMPERATIVE_ACTION_ID = new Set([
  "cari", "tunjukkan", "cariin", "pesan", "pesankan", "carikan",
  "beri", "berikan",
]);

/** Ordinal / result-context tokens · presence signals RESULT scope. */
const RESULT_TOKENS = new Set([
  "first", "second", "third", "fourth", "fifth",
  "last", "next", "previous", "one",
  "that", "this", "these", "those", "it", "them",
  "pertama", "kedua", "ketiga", "keempat", "kelima",
  "terakhir", "berikutnya", "itu", "ini",
]);

/** Attribute markers · adjectives typically negated as constraints. */
const ATTRIBUTE_ADJECTIVES_EN = new Set([
  "expensive", "cheap", "far", "near", "close", "distant",
  "big", "small", "large", "tiny", "old", "new",
  "hot", "cold", "loud", "quiet", "busy", "empty",
  "fancy", "basic", "luxury", "budget", "central", "remote",
]);

const ATTRIBUTE_ADJECTIVES_ID = new Set([
  "mahal", "murah", "jauh", "dekat", "besar", "kecil",
  "lama", "baru", "ramai", "sepi", "mewah",
]);

/** Social / discourse fixed forms that USE negation lexically but are
 *  NOT rejections of any request. */
const SOCIAL_NEGATIONS_EN: ReadonlyArray<ReadonlyArray<string>> = [
  ["no", "thanks"],
  ["no", "thank", "you"],
  ["no", "problem"],
  ["no", "worries"],
  ["i", "dont", "know"],
  ["i", "dont", "mind"],
  ["i", "dont", "think", "so"],
  ["i", "dont", "care"],
];

const SOCIAL_NEGATIONS_ID: ReadonlyArray<ReadonlyArray<string>> = [
  ["tidak", "apa", "apa"],
  ["tidak", "masalah"],
  ["saya", "tidak", "tahu"],
  ["saya", "tidak", "tau"],
];

/** Question-forming negation openers · negative question, not command. */
const NEG_QUESTION_OPENERS_EN: ReadonlyArray<ReadonlyArray<string>> = [
  ["dont", "you"],
  ["doesnt", "it"],
  ["arent", "you"],
  ["isnt", "it"],
  ["why", "dont"],
  ["why", "not"],
  ["wouldnt", "you"],
  ["couldnt", "you"],
  ["cant", "you"],
];

/** Contrastive markers — "not X but Y" / "not X, Y". A dash-double
 *  ("--") marker is preserved by the tokenizer as its own token. */
const CONTRAST_CONNECTORS = new Set([
  "but", "actually", "instead", "rather", "--",
  "tapi", "melainkan", "sebenarnya",
]);

// ─── Helpers ────────────────────────────────────────────────────

function containsAny(arr: string[], set: ReadonlySet<string>): boolean {
  for (const t of arr) if (set.has(t)) return true;
  return false;
}

function matchSequenceAnywhere(t: string[], seq: ReadonlyArray<string>): boolean {
  outer: for (let i = 0; i <= t.length - seq.length; i++) {
    for (let j = 0; j < seq.length; j++) {
      if (t[i + j] !== seq[j]) continue outer;
    }
    return true;
  }
  return false;
}

function startsWithSequence(t: string[], seq: ReadonlyArray<string>): boolean {
  if (seq.length > t.length) return false;
  for (let i = 0; i < seq.length; i++) if (t[i] !== seq[i]) return false;
  return true;
}

function anyNegTrigger(t: string[]): boolean {
  for (const tok of t) {
    if (NEG_TRIGGERS_EN.has(tok) || NEG_TRIGGERS_ID.has(tok)) return true;
  }
  return false;
}

// ─── Detectors (each returns partial PolarityDetection or null) ──

function detectSocialNegation(t: string[]): PolarityDetection | null {
  for (const seq of SOCIAL_NEGATIONS_EN) {
    if (matchSequenceAnywhere(t, seq)) {
      return {
        polarity: "NEGATED",
        scope: "SOCIAL",
        confidence: "high",
        reason: `social_en:${seq.join("_")}`,
      };
    }
  }
  for (const seq of SOCIAL_NEGATIONS_ID) {
    if (matchSequenceAnywhere(t, seq)) {
      return {
        polarity: "NEGATED",
        scope: "SOCIAL",
        confidence: "high",
        reason: `social_id:${seq.join("_")}`,
      };
    }
  }
  return null;
}

function detectQuestionNegation(t: string[]): PolarityDetection | null {
  // A question mark alone doesn't establish it · look for negative-
  // question openers or a negation-in-relative-clause "which X don't"
  for (const seq of NEG_QUESTION_OPENERS_EN) {
    if (startsWithSequence(t, seq)) {
      return {
        polarity: "NEGATED",
        scope: "QUESTION",
        confidence: "high",
        reason: `neg_question_opener:${seq.join("_")}`,
      };
    }
  }
  // "which hotels don't have parking?" · "which X <neg> …"
  if (t[0] === "which" || t[0] === "yang") {
    for (let i = 0; i < t.length; i++) {
      if (NEG_TRIGGERS_EN.has(t[i]) || NEG_TRIGGERS_ID.has(t[i])) {
        return {
          polarity: "NEGATED",
          scope: "QUESTION",
          confidence: "medium",
          reason: "which_x_neg",
        };
      }
    }
  }
  return null;
}

function detectContrastiveNegation(t: string[]): PolarityDetection | null {
  // Look for a negation trigger followed later by a contrast connector.
  let firstNegAt = -1;
  for (let i = 0; i < t.length; i++) {
    if (NEG_TRIGGERS_EN.has(t[i]) || NEG_TRIGGERS_ID.has(t[i])) {
      firstNegAt = i;
      break;
    }
  }
  if (firstNegAt < 0) return null;
  for (let i = firstNegAt + 1; i < t.length; i++) {
    if (CONTRAST_CONNECTORS.has(t[i])) {
      // Extract the negated target: first noun after the neg trigger
      // (skipping the determiner "a"/"an") — usually the entity token.
      const target = t[firstNegAt + 1] === "a" || t[firstNegAt + 1] === "an"
        ? t[firstNegAt + 2]
        : t[firstNegAt + 1];
      // Contrastive target: after the connector, walk forward skipping
      // pronouns, auxiliaries, desire verbs, articles — land on the
      // first content noun.
      const CONTRAST_SKIP = new Set<string>([
        "i", "you", "we", "they", "he", "she", "it",
        "the", "a", "an", "some", "any",
        "do", "does", "did", "will", "would",
        "want", "wanted", "wanting",
        "need", "needed", "looking", "seeking",
        "saya", "aku", "kami", "kita",
        "mau", "ingin", "butuh", "mencari",
      ]);
      let contrastive_target: string | undefined;
      for (let j = i + 1; j < t.length; j++) {
        if (!CONTRAST_SKIP.has(t[j])) { contrastive_target = t[j]; break; }
      }
      return {
        polarity: "CONTRASTIVE",
        scope: "CONTRASTIVE",
        target,
        contrastive_target,
        confidence: "high",
        reason: `contrastive_connector:${t[i]}`,
      };
    }
  }
  return null;
}

function detectResultScopeNegation(t: string[]): PolarityDetection | null {
  // Negation present AND a result-context reference (first/that/one/etc.)
  // AFTER the negation trigger. Distinguishes "I don't want the first one"
  // (RESULT · task still alive) from "I don't want a hotel" (REQUEST).
  let neg = -1;
  for (let i = 0; i < t.length; i++) {
    if (NEG_TRIGGERS_EN.has(t[i]) || NEG_TRIGGERS_ID.has(t[i])) { neg = i; break; }
  }
  if (neg < 0) return null;
  for (let i = neg + 1; i < t.length; i++) {
    if (RESULT_TOKENS.has(t[i])) {
      return {
        polarity: "NEGATED",
        scope: "RESULT",
        target: t[i],
        confidence: "medium",
        reason: `result_token:${t[i]}`,
      };
    }
  }
  return null;
}

function detectAttributeNegation(t: string[]): PolarityDetection | null {
  // "not expensive" · "that's not far" · "yang tidak mahal"
  // A negation trigger immediately (or one token off) before an
  // attribute-adjective, AND a positive desire elsewhere in the message
  // (so the entity is still affirmed).
  let neg = -1;
  for (let i = 0; i < t.length; i++) {
    if (NEG_TRIGGERS_EN.has(t[i]) || NEG_TRIGGERS_ID.has(t[i])) { neg = i; break; }
  }
  if (neg < 0) return null;
  // Check tokens neg+1 through neg+4 for an attribute adjective.
  // This window captures "not expensive" (adjacent) AND "don't want an
  // expensive hotel" (adjective 3 tokens after the trigger).
  for (let j = neg + 1; j <= neg + 4 && j < t.length; j++) {
    if (ATTRIBUTE_ADJECTIVES_EN.has(t[j]) || ATTRIBUTE_ADJECTIVES_ID.has(t[j])) {
      const hasPosDesire = containsAny(t, DESIRE_VERBS_EN)
                        || containsAny(t, DESIRE_VERBS_ID);
      return {
        polarity: "AFFIRMATIVE",  // entity still desired
        scope: "ATTRIBUTE",
        target: t[j],
        confidence: hasPosDesire ? "high" : "medium",
        reason: `attribute_neg:${t[j]}`,
      };
    }
  }
  return null;
}

function detectActionNegation(t: string[]): PolarityDetection | null {
  // "don't <imperative action verb>" / "jangan <action>"
  // Also "please don't search" · length up to 4 before neg trigger.
  for (let i = 0; i < Math.min(t.length, 4); i++) {
    if (t[i] === "dont" || t[i] === "do" && t[i + 1] === "not" || t[i] === "jangan") {
      const step = t[i] === "do" ? 2 : 1;
      const next = t[i + step];
      if (next && (IMPERATIVE_ACTION_EN.has(next) || IMPERATIVE_ACTION_ID.has(next))) {
        return {
          polarity: "NEGATED",
          scope: "ACTION",
          target: next,
          confidence: "high",
          reason: `neg_action:${next}`,
        };
      }
    }
  }
  return null;
}

function detectRequestNegation(t: string[]): PolarityDetection | null {
  // Look for the sequence: first-person marker, negation trigger,
  // desire verb — in that order — anywhere in the utterance. This
  // handles both "I don't want X" and "Actually, I don't want X".
  // The first-person marker no longer needs to be at position 0.
  let firstIdx = -1;
  for (let i = 0; i < t.length; i++) {
    if (FIRST_PERSON_EN.has(t[i]) || FIRST_PERSON_ID.has(t[i])) { firstIdx = i; break; }
  }
  if (firstIdx < 0) return null;
  // Negation trigger AFTER the first-person marker (within 3 tokens).
  let negIdx = -1;
  for (let i = firstIdx + 1; i < Math.min(t.length, firstIdx + 4); i++) {
    if (NEG_TRIGGERS_EN.has(t[i]) || NEG_TRIGGERS_ID.has(t[i])) { negIdx = i; break; }
  }
  if (negIdx < 0) return null;
  // Desire verb appears somewhere in the utterance.
  const hasDesire = containsAny(t, DESIRE_VERBS_EN)
                 || containsAny(t, DESIRE_VERBS_ID);
  if (!hasDesire) return null;
  const target = t[t.length - 1];
  return {
    polarity: "NEGATED",
    scope: "REQUEST",
    target,
    confidence: "high",
    reason: `first_person_neg_desire`,
  };
}

function detectBareEntityNegation(t: string[]): PolarityDetection | null {
  // "no hotel" / "no hotels" / "not a hotel" / "not hotels" · start of msg
  // "bukan hotel" / "tidak hotel" — Indonesian bare-entity negation
  if (t.length > 4) return null; // bare-entity is short
  const isEnBare = (t[0] === "no" || t[0] === "not")
                && (t.length === 2 || (t.length === 3 && (t[1] === "a" || t[1] === "an")));
  if (isEnBare) {
    return {
      polarity: "NEGATED",
      scope: "ENTITY",
      target: t[t.length - 1],
      confidence: "high",
      reason: "bare_neg_entity_en",
    };
  }
  const isIdBare = (t[0] === "bukan" || t[0] === "tidak") && t.length <= 3;
  if (isIdBare) {
    return {
      polarity: "NEGATED",
      scope: "ENTITY",
      target: t[t.length - 1],
      confidence: "high",
      reason: "bare_neg_entity_id",
    };
  }
  return null;
}

// ─── Public classifier ──────────────────────────────────────────

export function classifyPolarity(message: string): PolarityDetection {
  const t = tokens(message);
  if (t.length === 0) {
    return { polarity: "UNKNOWN", scope: "NONE", confidence: "high", reason: "empty" };
  }
  if (!anyNegTrigger(t)) {
    return { polarity: "AFFIRMATIVE", scope: "NONE", confidence: "high", reason: "no_neg_trigger" };
  }

  // Precedence order · safest-first · specific-before-general.
  //
  // 1 · SOCIAL fixed forms (no thanks · I don't know · etc.) — must run
  //     first so social language doesn't accidentally match REQUEST.
  const social = detectSocialNegation(t);
  if (social) return social;

  // 2 · QUESTION-shape negation (don't you have · why don't · which X don't)
  const question = detectQuestionNegation(t);
  if (question) return question;

  // 3 · CONTRASTIVE ("not X, Y" / "not X — Y")
  const contrastive = detectContrastiveNegation(t);
  if (contrastive) return contrastive;

  // 4 · RESULT-scoped (I don't want the first one · not that one)
  const result = detectResultScopeNegation(t);
  if (result) return result;

  // 5 · ATTRIBUTE-scoped ("not expensive" · entity still desired)
  const attribute = detectAttributeNegation(t);
  if (attribute) return attribute;

  // 6 · ACTION-scoped ("don't search" · "jangan cari")
  const action = detectActionNegation(t);
  if (action) return action;

  // 7 · REQUEST-scoped ("I don't want a hotel")
  const request = detectRequestNegation(t);
  if (request) return request;

  // 8 · Bare ENTITY negation ("no hotel" · "bukan hotel")
  const bare = detectBareEntityNegation(t);
  if (bare) return bare;

  // Trigger present but scope could not be safely established.
  // Per AUTHORIZE §16 · represent uncertainty rather than guess.
  return {
    polarity: "NEGATED",
    scope: "NONE",
    confidence: "low",
    reason: "trigger_present_scope_unresolved",
  };
}

/** Convenience: whether the polarity/scope combination should trigger
 *  the dialogue-act gate (see conversational-function.ts). */
export function shouldGateOnPolarity(p: PolarityDetection): boolean {
  if (p.polarity === "CONTRASTIVE") return true;
  if (p.polarity !== "NEGATED") return false;
  return p.scope === "REQUEST" || p.scope === "ACTION" || p.scope === "ENTITY";
}
