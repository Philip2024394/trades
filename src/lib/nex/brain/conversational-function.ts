// src/lib/nex/brain/conversational-function.ts
//
// NEX Speaking Intelligence · Conversational Function classifier + gate.
// Philip 2026-09-06 · AUTHORIZE · Conversational Function Reclassification
//                                / Social-Turn Protection
//
// PROBLEM
//   T1  "any hotels nex"                    → hotel search  ✓
//   T2  "do you want to know where i am"    → "Yep — found 3."  ✗
//
//   The user's second turn is a NEW conversational act (a personal-
//   context offer), not a hotel result follow-up. The system inherited
//   the previous hotel-result response path because the intent/routing
//   layer read running_topic=hotels and did not reclassify the current
//   utterance's dialogue act.
//
// SCOPE
//   General conversational-function intelligence. NOT a hotel patch.
//   NOT a "do you want to know where i am" regex. The same mechanism
//   handles social greetings, gratitude, personal-context offers /
//   statements, meta-conversation, in English AND Indonesian.
//
// INVARIANT (locked)
//   CURRENT TURN MEANING > STALE PREVIOUS RESPONSE PATH.
//   When the current turn establishes a new dialogue act (social,
//   personal, meta), it MUST override task-response inheritance from
//   prior turns.
//
// SAFETY BOUNDS (per AUTHORIZE §15 "do not overcorrect")
//   Gate fires ONLY for functions that clearly are NEW conversational
//   acts and are NOT task continuations:
//     · SOCIAL_UTTERANCE
//     · GRATITUDE
//     · PERSONAL_CONTEXT_OFFER
//     · PERSONAL_CONTEXT_STATEMENT
//     · META_CONVERSATION
//   Gate does NOT fire for:
//     · TASK_REQUEST / INFORMATION_QUESTION  (normal orchestrate path)
//     · RESULT_FOLLOW_UP                     (existing gate handles it)
//     · ACKNOWLEDGEMENT / CONFIRMATION        (often continuation · risky)
//     · TOPIC_SHIFT / CORRECTION              (abandonment-detector handles)
//     · CLARIFICATION / UNCLASSIFIED          (let downstream reason)
//
// PRESERVATION
//   · G24 scope validation:               untouched
//   · P0 zero-evidence guard:             untouched
//   · P0.3 hotel resolved-reference:      untouched (fires on ordinal path)
//   · P0.4 fresh-conv ordinal gate:       untouched
//   · Result-followup gate (Milestone A): untouched (has explicit skip below)
//   · language-intelligence.ts:           untouched (this file consumes it)
//   · language-lexicon.ts:                untouched
//   · voice pipeline:                     inherits the deterministic reply

import type { SessionState } from "./session";
import { interpretIntent } from "./language-intelligence";
import { classifyPolarity, shouldGateOnPolarity, type PolarityDetection } from "./negation-polarity";

// ─── The conversational-function taxonomy ────────────────────────

export type ConversationalFunction =
  | "TASK_REQUEST"                // "find me a hotel", "any hotels nex"
  | "INFORMATION_QUESTION"        // "what is Yogyakarta?"
  | "RESULT_FOLLOW_UP"            // provenance / more-detail / ordinal
  | "SOCIAL_UTTERANCE"            // hi · hello · how are you · goodbye
  | "GRATITUDE"                   // thanks · terima kasih
  | "ACKNOWLEDGEMENT"             // ok · got it · sure
  | "CONFIRMATION"                // yes · no · y · n
  | "PERSONAL_CONTEXT_OFFER"      // "do you want to know where i am"
  | "PERSONAL_CONTEXT_STATEMENT"  // "i'm in Bandung"
  | "META_CONVERSATION"           // "can i ask you something" · "wait"
  | "TOPIC_SHIFT"                 // "actually forget hotels" · "let's talk X"
  | "CORRECTION"                  // "no i meant restaurants"
  | "CLARIFICATION"               // "what do you mean?"
  // L4 extensions (Philip 2026-09-06 · AUTHORIZE · L4 Dialogue-Act
  // Classification & Conversational Frame Reset):
  | "ASSERTION"                   // "there are hotels here" · "di sini ada hotel"
  | "EMOTIONAL_EXPRESSION"        // "I love this place" · "this is amazing"
  | "AMBIGUOUS_DIALOGUE_ACT"      // signal for uncertainty · not a fallback
  // G12 extension (Philip 2026-09-06 · AUTHORIZE · G12 Negation
  // Intelligence & Intent Polarity):
  | "NEGATED_REQUEST"             // "I don't want a hotel" · "no hotels" · "not a hotel — a restaurant"
  | "UNCLASSIFIED";

/** Hierarchical family label per AUTHORIZE §4 §5 §16. Useful for
 *  downstream routing / observability. Never used as the sole
 *  discriminator — the specific ConversationalFunction is authoritative. */
export type DialogueActFamily =
  | "SOCIAL"                       // greetings · farewells · gratitude · emotional
  | "INFORMATION_EXCHANGE"         // question · assertion · offer · statement · meta
  | "TASK"                         // search-request · result-followup · correction · clarification · topic-shift · confirmation
  | "OTHER";                       // ambiguous · unclassified

export function familyOf(fn: ConversationalFunction): DialogueActFamily {
  switch (fn) {
    case "SOCIAL_UTTERANCE":
    case "GRATITUDE":
    case "ACKNOWLEDGEMENT":
    case "EMOTIONAL_EXPRESSION":
      return "SOCIAL";
    case "INFORMATION_QUESTION":
    case "ASSERTION":
    case "PERSONAL_CONTEXT_OFFER":
    case "PERSONAL_CONTEXT_STATEMENT":
    case "META_CONVERSATION":
      return "INFORMATION_EXCHANGE";
    case "TASK_REQUEST":
    case "RESULT_FOLLOW_UP":
    case "CORRECTION":
    case "CLARIFICATION":
    case "TOPIC_SHIFT":
    case "CONFIRMATION":
    case "NEGATED_REQUEST":
      return "TASK";
    default:
      return "OTHER";
  }
}

export type FunctionDetection = {
  function: ConversationalFunction;
  family: DialogueActFamily;
  confidence: "high" | "medium" | "low";
  reason: string;
  /** G12 · every classification carries the polarity of the message.
   *  Downstream consumers (retrieval, composition) can inspect scope
   *  to decide whether an entity was rejected, an attribute constrained,
   *  or the negation was social/rhetorical (do-not-suppress). */
  polarity: PolarityDetection;
};

// ─── Small tokenizer (mirrors language-intelligence style) ───────

function tokens(message: string): string[] {
  // Strip apostrophes WITHOUT inserting a space so contractions
  // ("i'm" → "im") remain a single token. Other punctuation → space.
  return (message || "")
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[?.!,;:"“”()]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

// ─── Vocabulary (feature primitives · English + Indonesian) ─────
//
// Sets are inspectable and additive. New markers extend the set.

// Greetings · farewells · social openers/closers (both languages)
const SOCIAL_GREETING = new Set([
  "hi", "hello", "hey", "hiya",
  "halo", "hai",
  "selamat", "pagi", "siang", "sore", "malam",
]);
const SOCIAL_FAREWELL = new Set([
  "bye", "goodbye", "farewell",
  "dadah", "sampai",
]);
const SOCIAL_HOW_ARE_YOU_MARKERS = new Set([
  "how", "you", "are", "doing",
  "apa", "kabar",
]);

// Gratitude
const GRATITUDE_MARKERS = new Set([
  "thanks", "thank", "thanx", "thx", "ty",
  "terima", "kasih", "makasih", "terimakasih", "trims",
]);

// Personal-context offer patterns (interrogative + you + want/like + know/tell)
const OFFER_VERBS = new Set(["want", "like", "wanna", "care"]);
const KNOWLEDGE_VERBS = new Set(["know", "hear", "learn"]);
const TELL_VERBS = new Set(["tell", "say", "share"]);

// Personal-context statement pattern (I + be + preposition + location)
const FIRST_PERSON_MARKERS_EN = new Set(["i", "im", "i'm"]);
const FIRST_PERSON_MARKERS_ID = new Set(["saya", "aku", "gue", "gw"]);
const BE_VERBS_EN = new Set(["am", "'m", "was", "is", "are", "were", "be", "been", "being"]);
const BE_VERBS_ID = new Set(["berada", "ada"]);
const LOCATION_PREPS_EN = new Set(["in", "at", "near", "from", "around"]);
const LOCATION_PREPS_ID = new Set(["di", "dari", "dekat"]);

// Meta-conversation openers
const META_MARKERS_EN = [
  ["can", "i", "ask"],           // "can i ask you something"
  ["may", "i", "ask"],
  ["wait"],                       // sole word or opener
  ["hold", "on"],
  ["are", "you", "there"],
  ["still", "there"],
];
const META_MARKERS_ID = [
  ["boleh", "saya", "tanya"],
  ["boleh", "tanya"],
  ["sebentar"],
  ["tunggu"],
];

// Task-request opener heuristic (used for negative rule)
const TASK_OPENERS = new Set([
  "find", "show", "give", "get", "book", "reserve", "recommend",
  "list", "search", "any",
  "cari", "carikan", "tunjukkan", "pesan", "pesankan",
]);

// Information-question interrogatives (existing L1)
const INFO_INTERROGATIVES = new Set([
  "what", "when", "where", "why", "how", "who", "which",
  "apa", "kapan", "dimana", "kenapa", "bagaimana", "siapa", "yang",
]);

// Confirmation shortforms (kept as a distinct function · gate skips them)
const CONFIRMATION_SHORTS = new Set([
  "y", "n", "yes", "no", "yeah", "yep", "nope", "sure", "ok", "okay",
  "iya", "ya", "tidak", "gak",
]);

// Topic-shift markers (existing abandonment-detector handles these)
const TOPIC_SHIFT_MARKERS = new Set(["actually", "forget", "instead", "nevermind"]);

// Correction markers · English + Indonesian.
// "sebenarnya" is Indonesian for "actually" and appears in both
// TOPIC_SHIFT and CORRECTION shapes; the "maksud" (meaning · intent)
// token disambiguates toward CORRECTION.
const CORRECTION_MARKERS = new Set([
  "sorry", "meant",
  "sebenarnya", "maksud", "maksudnya",
]);

// ─── L4 vocabulary extensions (Philip 2026-09-06) ────────────────

/** Emotional-evaluation adjectives — "this is <adj>" or "i love this <adj>".
 *  Deliberately small · easily extended. */
const EMOTIONAL_ADJECTIVES = new Set([
  "amazing", "great", "awesome", "wonderful", "beautiful", "lovely",
  "terrible", "awful", "horrible", "bad", "ugly", "boring",
  "interesting", "fascinating", "nice", "cool",
  "keren", "bagus", "indah", "hebat", "menarik", "jelek", "buruk", "kacau",
]);

/** Emotion verbs used in first-person expression. */
const EMOTION_VERBS = new Set([
  "love", "loved", "loving",
  "hate", "hated", "hating",
  "like", "liked", "liking",
  "dislike", "enjoy", "enjoyed", "enjoying",
  "appreciate", "adore", "admire",
  "suka", "cinta", "benci", "sayang",
]);

/** Demonstratives that a first-person emotion verb can attach to. */
const DEMONSTRATIVES = new Set([
  "this", "that", "these", "those", "it",
  "ini", "itu",
]);

/** Existential subject markers · "there is/are …" / Indonesian
 *  existential "ada X" preceded by a locative. */
const EXPLETIVE_THERE = new Set(["there"]);
const EXISTENCE_VERB_ID = "ada";

// ─── Classifier ──────────────────────────────────────────────────
//
// Feature-based. Composes primitives into functions. Not phrase-based.
// Precedence: high-confidence specific patterns first; fall through to
// UNCLASSIFIED if nothing matches confidently.

function detect(
  fn: ConversationalFunction,
  confidence: "high" | "medium" | "low",
  reason: string,
  polarity: PolarityDetection,
): FunctionDetection {
  return { function: fn, family: familyOf(fn), confidence, reason, polarity };
}

export function classifyConversationalFunction(message: string): FunctionDetection {
  const t = tokens(message);
  // Compute polarity once · used both to override the classification
  // when negation applies at request/action/entity/contrastive scope
  // and to attach to every return for downstream inspection.
  const polarity = classifyPolarity(message);
  if (t.length === 0) {
    return detect("UNCLASSIFIED", "high", "empty_message", polarity);
  }

  // G12 · Negation override · runs BEFORE every existing rule.
  // When the polarity classifier says the utterance is a genuine
  // request/action/entity rejection or a contrastive negation, force
  // the dialogue-act to NEGATED_REQUEST. This is a semantic override
  // that ensures the downstream gate fires and prevents the intent
  // classifier from executing the hotel-search intent that the
  // entity token would otherwise trigger.
  //
  // Explicit protections preserved:
  //   · SOCIAL scope   ("no thanks")                → NOT overridden
  //   · QUESTION scope ("don't you have hotels?")   → NOT overridden
  //   · ATTRIBUTE      ("not expensive")            → NOT overridden
  //   · RESULT         ("don't want the first one") → NOT overridden
  if (shouldGateOnPolarity(polarity)) {
    return detect("NEGATED_REQUEST", "high", `neg_${polarity.scope.toLowerCase()}:${polarity.reason}`, polarity);
  }

  // 1 · Gratitude — one clear token dominates
  if (t.some((x) => GRATITUDE_MARKERS.has(x))) {
    return detect("GRATITUDE", "high", "gratitude_marker", polarity);
  }

  // 2 · Social farewell
  if (t.some((x) => SOCIAL_FAREWELL.has(x))) {
    return detect("SOCIAL_UTTERANCE", "high", "farewell_marker", polarity);
  }

  // 3 · Social greeting — greet marker at position 0 or clearly-standalone
  if (t.length <= 3 && SOCIAL_GREETING.has(t[0])) {
    return detect("SOCIAL_UTTERANCE", "high", "greeting_opener", polarity);
  }
  // "selamat pagi/siang/sore/malam" as Indonesian time-of-day greeting
  if (t[0] === "selamat" && t.length <= 3) {
    return detect("SOCIAL_UTTERANCE", "high", "id_time_greeting", polarity);
  }

  // 4 · "how are you" pattern (English) — interrogative + "you" + BE + limited length
  //     "apa kabar" (Indonesian)
  const hasHow = t.includes("how");
  const hasYou = t.includes("you");
  const hasAre = t.includes("are");
  if (hasHow && hasYou && hasAre && t.length <= 5) {
    return detect("SOCIAL_UTTERANCE", "high", "how_are_you_pattern", polarity);
  }
  if (t[0] === "apa" && t[1] === "kabar") {
    return detect("SOCIAL_UTTERANCE", "high", "id_how_are_you", polarity);
  }

  // 5 · Meta-conversation openers
  for (const marker of META_MARKERS_EN) {
    if (startsWithSequence(t, marker)) {
      return detect("META_CONVERSATION", "high", `meta_en:${marker.join("_")}`, polarity);
    }
  }
  for (const marker of META_MARKERS_ID) {
    if (startsWithSequence(t, marker)) {
      return detect("META_CONVERSATION", "high", `meta_id:${marker.join("_")}`, polarity);
    }
  }

  // 6 · Personal-context OFFER — "do you want to know where i am"
  if (isPersonalContextOffer(t)) {
    return detect("PERSONAL_CONTEXT_OFFER", "high", "offer_verb_pattern", polarity);
  }

  // 7 · Personal-context STATEMENT — "i'm in Bandung"
  if (isPersonalContextStatement(t)) {
    return detect("PERSONAL_CONTEXT_STATEMENT", "high", "first_person_be_place", polarity);
  }

  // 8 · Correction · L4 EXTENDED to cover English + Indonesian shapes.
  //     Must run BEFORE the TOPIC_SHIFT rule because "sebenarnya maksud
  //     saya restoran" contains both "sebenarnya" (a topic-shift marker
  //     shared with correction) AND "maksud" (the correction-disambiguator).
  //     Also runs BEFORE the ASSERTION rule so "sorry, there are hotels
  //     here" is CORRECTION rather than ASSERTION.
  if (isCorrection(t)) {
    return detect("CORRECTION", "high", "correction_marker", polarity);
  }

  // 9 · Topic-shift — must run BEFORE ASSERTION rule so "actually
  //     there are hotels here" is TOPIC_SHIFT rather than ASSERTION.
  if (TOPIC_SHIFT_MARKERS.has(t[0])) {
    return detect("TOPIC_SHIFT", "medium", `shift_opener:${t[0]}`, polarity);
  }

  // 10 · L4 EMOTIONAL_EXPRESSION — first-person emotion verb + object,
  //      or evaluative "this is amazing" / "ini keren".
  //      Must run BEFORE ASSERTION so "i love this place" is
  //      EMOTIONAL_EXPRESSION not (broken) ASSERTION shape.
  if (isEmotionalExpression(t)) {
    return detect("EMOTIONAL_EXPRESSION", "high", "emotion_verb_or_evaluative", polarity);
  }

  // 11 · L4 ASSERTION — existential "there are X" / "there is X" and
  //      Indonesian "di sini ada X" / "ada X di sini" declarative shapes.
  if (isAssertion(t)) {
    return detect("ASSERTION", "high", "existential_declarative", polarity);
  }

  // 12 · Confirmation shortforms — very short reply
  if (t.length <= 2 && t.every((x) => CONFIRMATION_SHORTS.has(x))) {
    return detect("CONFIRMATION", "medium", "confirmation_shortform", polarity);
  }

  // 13 · Task-request — imperative opener
  if (TASK_OPENERS.has(t[0])) {
    return detect("TASK_REQUEST", "high", `task_opener:${t[0]}`, polarity);
  }

  // 14 · Result-follow-up delegation — must run BEFORE the generic
  //      interrogative rule below.
  const intent = interpretIntent(message);
  if (intent.kind === "result_provenance_followup") {
    return detect("RESULT_FOLLOW_UP", "high", "delegated_to_result_followup_gate", polarity);
  }

  // 15 · Information-question — interrogative opener + not the
  //      specialized patterns above.
  if (INFO_INTERROGATIVES.has(t[0])) {
    return detect("INFORMATION_QUESTION", "medium", `interrogative_opener:${t[0]}`, polarity);
  }

  return detect("UNCLASSIFIED", "low", "no_pattern_matched", polarity);
}

// ─── Helper: sequence prefix match ──────────────────────────────

function startsWithSequence(tokens: string[], seq: string[]): boolean {
  if (seq.length > tokens.length) return false;
  for (let i = 0; i < seq.length; i++) {
    if (tokens[i] !== seq[i]) return false;
  }
  return true;
}

// ─── L4 CORRECTION detection ────────────────────────────────────
//
// English: "sorry, i meant X" / "no, i meant X" / "i meant X" / "sorry X"
// Indonesian: "sebenarnya maksud saya X" / "maksud saya X" / "sebenarnya X"
// The presence of "maksud" or "meant" is authoritative.

function isCorrection(t: string[]): boolean {
  if (t.includes("meant")) return true;
  if (t[0] === "sorry" && t.length > 1) return true;
  // Indonesian: "sebenarnya maksud saya" / "maksud saya" / "maksudnya"
  if (t[0] === "maksud" || t[0] === "maksudnya") return true;
  if (t[0] === "sebenarnya" && (t.includes("maksud") || t.includes("maksudnya"))) return true;
  return false;
}

// ─── L4 EMOTIONAL_EXPRESSION detection ──────────────────────────
//
// Two shapes:
//   A · first-person + emotion verb + object
//        "i love this place" / "saya suka tempat ini"
//   B · demonstrative + BE + evaluative adjective
//        "this is amazing" / "ini keren"

function isEmotionalExpression(t: string[]): boolean {
  // Shape A · English: t[0]=I, t[1] emotion verb
  const firstEn = FIRST_PERSON_MARKERS_EN.has(t[0]);
  if (firstEn && t.length >= 2 && EMOTION_VERBS.has(t[1])) return true;
  // Shape A · Indonesian: t[0]=saya/aku, t[1] emotion verb
  const firstId = FIRST_PERSON_MARKERS_ID.has(t[0]);
  if (firstId && t.length >= 2 && EMOTION_VERBS.has(t[1])) return true;
  // Shape B · English: demonstrative + BE + evaluative-adjective
  if (t.length >= 3 && DEMONSTRATIVES.has(t[0]) && BE_VERBS_EN.has(t[1])
      && EMOTIONAL_ADJECTIVES.has(t[2])) return true;
  // Shape B · Indonesian: "ini/itu keren/bagus/menarik"
  if (t.length >= 2 && DEMONSTRATIVES.has(t[0]) && EMOTIONAL_ADJECTIVES.has(t[1])) return true;
  return false;
}

// ─── L4 ASSERTION detection ─────────────────────────────────────
//
// Existential declaratives:
//   English:    "there are hotels here" / "there is a hotel"
//   Indonesian: "di sini ada hotel" / "ada hotel di sini"

function isAssertion(t: string[]): boolean {
  // English: "there is/are …"
  if (EXPLETIVE_THERE.has(t[0]) && t.length >= 2 && BE_VERBS_EN.has(t[1])) return true;
  // Indonesian: "di sini ada X" (locative + ada + noun)
  if (t[0] === "di" && t.length >= 3 && t[2] === EXISTENCE_VERB_ID) return true;
  // Indonesian: "ada X di sini/di …"
  if (t[0] === EXISTENCE_VERB_ID && t.includes("di")) return true;
  return false;
}

// ─── Personal-context OFFER detection ───────────────────────────

function isPersonalContextOffer(t: string[]): boolean {
  // Pattern A: (do|would|will) + you + want|like|wanna + (to)? + know|hear
  //            "do you want to know..." / "would you like to hear..."
  // Pattern B: (should|shall|can|may) + i + tell|say + you
  //            "should i tell you..." / "can i tell you..."
  // Pattern C: "let me tell you" / "i have something to tell you"
  if (t.length < 3) return false;

  // Pattern A
  const aStart = ["do", "would", "will"].includes(t[0]) && t[1] === "you"
                 && OFFER_VERBS.has(t[2]);
  if (aStart) {
    // Optional "to" then a KNOWLEDGE_VERBS token
    const rest = t.slice(3);
    for (let i = 0; i < Math.min(rest.length, 3); i++) {
      if (KNOWLEDGE_VERBS.has(rest[i])) return true;
    }
  }

  // Pattern B
  const bStart = ["should", "shall", "can", "may"].includes(t[0]) && t[1] === "i"
                 && TELL_VERBS.has(t[2]);
  if (bStart) return true;

  // Pattern C · "let me tell you"
  if (t[0] === "let" && t[1] === "me" && t.length > 2 && TELL_VERBS.has(t[2])) return true;

  // Pattern C · "i have something to tell you"
  if (t[0] === "i" && t.includes("something") && t.some((x) => TELL_VERBS.has(x))) return true;

  // Indonesian offer patterns
  //   "kamu mau tahu ..." / "mau tau ..."
  if ((t[0] === "kamu" && t[1] === "mau") || (t[0] === "mau" && ["tau", "tahu"].includes(t[1]))) {
    return true;
  }

  return false;
}

// ─── Personal-context STATEMENT detection ───────────────────────

/** Discourse adverbs that may appear between the first-person marker
 *  and the preposition without changing the personal-context reading:
 *  "i'm actually in X", "i'm currently in X", "i'm really at X".
 *  Skipped when locating the preposition. */
const SKIPPABLE_ADVERBS = new Set([
  "actually", "really", "currently", "now", "just",
  "sekarang", "sedang",
]);

function firstPrepIndex(t: string[], start: number, preps: ReadonlySet<string>): number {
  // Advance past up to 2 skippable adverbs then check for a preposition.
  let i = start;
  let skipped = 0;
  while (i < t.length && skipped < 2 && SKIPPABLE_ADVERBS.has(t[i])) {
    i++; skipped++;
  }
  if (i < t.length && preps.has(t[i])) return i;
  return -1;
}

function isPersonalContextStatement(t: string[]): boolean {
  // English: "i'm in X" / "i am in X" / "i live in X" / "i'm at X"
  //          "i'm actually in X" · "i'm currently at X"
  // The tokenizer strips apostrophes, so "i'm" becomes "im".
  const firstEn = FIRST_PERSON_MARKERS_EN.has(t[0]);
  const firstId = FIRST_PERSON_MARKERS_ID.has(t[0]);
  if (!firstEn && !firstId) return false;

  if (firstEn) {
    // "im in X" (with optional skippable adverb between)
    if (firstPrepIndex(t, 1, LOCATION_PREPS_EN) > 0 && t.length >= 3) return true;
    // "i am in X" / "i live in X" (with optional skippable adverb between)
    if (t.length >= 4 && (BE_VERBS_EN.has(t[1]) || t[1] === "live")) {
      if (firstPrepIndex(t, 2, LOCATION_PREPS_EN) > 1) return true;
    }
  }

  if (firstId) {
    // "saya di X" · "saya sekarang di X"
    if (firstPrepIndex(t, 1, LOCATION_PREPS_ID) > 0 && t.length >= 3) return true;
    if (t.length >= 4 && BE_VERBS_ID.has(t[1])) {
      if (firstPrepIndex(t, 2, LOCATION_PREPS_ID) > 1) return true;
    }
  }

  return false;
}

// ─── Deterministic natural replies ──────────────────────────────

/** Tokens to skip when extracting a contrastive alternative from a
 *  regex match — pronouns / articles / determiners typically follow a
 *  contrast connector before the actual noun. */
const PRONOUN_SKIP: ReadonlySet<string> = new Set([
  "i", "you", "we", "they", "he", "she", "it",
  "the", "a", "an", "some", "any",
  "do", "does", "did", "will", "would",
  "saya", "aku", "kami", "kita",
]);

function pickReply(fn: ConversationalFunction, lang: "en" | "id", message: string, fnDet?: FunctionDetection): string {
  const t = tokens(message);
  if (lang === "id") {
    switch (fn) {
      case "GRATITUDE":
        return "Sama-sama! Ada yang bisa saya bantu lagi?";
      case "SOCIAL_UTTERANCE":
        if (t.some((x) => SOCIAL_FAREWELL.has(x))) return "Sampai jumpa lagi!";
        if (t[0] === "selamat") return "Selamat! Ada yang bisa saya bantu?";
        return "Halo! Ada yang bisa saya bantu?";
      case "PERSONAL_CONTEXT_OFFER":
        return "Boleh — di mana Anda berada?";
      case "PERSONAL_CONTEXT_STATEMENT":
        return "Baik, saya catat. Ada yang bisa saya bantu di sana?";
      case "META_CONVERSATION":
        return "Silakan — apa yang ingin Anda tanyakan?";
      case "EMOTIONAL_EXPRESSION":
        return "Senang mendengarnya! Ada yang bisa saya bantu?";
      case "ASSERTION":
        return "Baik, saya catat. Ada yang bisa saya bantu berikutnya?";
      case "CORRECTION":
        return "Baik, mohon maaf. Bisa Anda ulang apa yang Anda cari?";
      case "NEGATED_REQUEST": {
        // Contrastive: user rejected X but affirmed Y · surface Y.
        let alt: string | undefined = fnDet?.polarity?.contrastive_target;
        if (!alt) {
          const m = message.match(/(?:melainkan|tapi|instead|but|--|—)\s+(?:saya\s+(?:mau|ingin)\s+)?(?:a\s+|an\s+)?(\w+)/i);
          if (m && m[1] && !PRONOUN_SKIP.has(m[1].toLowerCase())) alt = m[1];
        }
        if (alt) return `Baik, ${alt} lebih cocok. Ada preferensi lain?`;
        return "Baik, saya batalkan. Apa yang Anda ingin cari sebagai gantinya?";
      }
      default:
        return "Baik.";
    }
  }
  switch (fn) {
    case "GRATITUDE":
      return "You're welcome! Anything else I can help with?";
    case "SOCIAL_UTTERANCE":
      if (t.some((x) => SOCIAL_FAREWELL.has(x))) return "Take care!";
      if (t.includes("how") && t.includes("you")) return "Good, thanks! What can I help you with?";
      return "Hi! What can I help you with?";
    case "PERSONAL_CONTEXT_OFFER":
      return "Yeah — where are you? That'll help me make things more relevant.";
    case "PERSONAL_CONTEXT_STATEMENT":
      return "Got it. Anything I can help you find there?";
    case "META_CONVERSATION":
      return "Sure — go ahead.";
    case "EMOTIONAL_EXPRESSION":
      return "Glad to hear it! Anything I can help you with?";
    case "ASSERTION":
      return "Got it. Anything I can help you with next?";
    case "CORRECTION":
      return "Got it — sorry about that. Could you tell me again what you're looking for?";
    case "NEGATED_REQUEST": {
      // If contrastive · try the polarity classifier's contrastive_target
      // first (structural), fall back to a small regex.
      let alt: string | undefined = fnDet?.polarity?.contrastive_target;
      if (!alt) {
        const m = message.match(/(?:instead|but|--|—)\s+(?:i\s+(?:do\s+)?want\s+)?(?:a\s+|an\s+)?(\w+)/i);
        if (m && m[1] && !PRONOUN_SKIP.has(m[1].toLowerCase())) alt = m[1];
      }
      if (alt) return `Got it — ${alt} instead. What kind are you after?`;
      return "Got it — no problem. What would you like me to help with instead?";
    }
    default:
      return "Okay.";
  }
}

// ─── Public gate decision ────────────────────────────────────────

/** Functions for which the gate emits a deterministic reply that
 *  overrides any stale task-response inheritance.
 *
 *  L4 additions (Philip 2026-09-06 · AUTHORIZE L4):
 *    · EMOTIONAL_EXPRESSION — G07 protection ("I love this place")
 *    · ASSERTION            — G14 protection ("there are hotels here")
 *    · CORRECTION           — prevents stale-task re-emit after
 *                             "no I meant restaurants"
 *
 *  Not gated (§22 do-not-overcorrect):
 *    TASK_REQUEST · INFORMATION_QUESTION · RESULT_FOLLOW_UP ·
 *    ACKNOWLEDGEMENT · CONFIRMATION · TOPIC_SHIFT · CLARIFICATION ·
 *    AMBIGUOUS_DIALOGUE_ACT · UNCLASSIFIED. */
const GATED_FUNCTIONS: ReadonlySet<ConversationalFunction> = new Set<ConversationalFunction>([
  "SOCIAL_UTTERANCE",
  "GRATITUDE",
  "PERSONAL_CONTEXT_OFFER",
  "PERSONAL_CONTEXT_STATEMENT",
  "META_CONVERSATION",
  "EMOTIONAL_EXPRESSION",
  "ASSERTION",
  "CORRECTION",
  // G12 · Negation Intelligence · negated request must not execute
  // the underlying task. The deterministic reply prevents the stale
  // hotel-list template from being emitted and never fabricates.
  "NEGATED_REQUEST",
]);

/** Frame-transition semantics · exposed for observability.
 *  NEW_ACT: current turn is a gated non-continuation act — the
 *   response path must not inherit stale task template.
 *  CONTINUATION: current turn is a task-continuation shape (result
 *   follow-up · clarification · ordinary question about results) —
 *   existing routing handles it.
 *  UNCERTAIN: signal only · never used to auto-inherit prior task. */
export type FrameTransition = "NEW_ACT" | "CONTINUATION" | "UNCERTAIN";

export type ConversationalFunctionGateDecision =
  | { shouldGate: false; detection: FunctionDetection; frame_transition: FrameTransition; reason: string }
  | {
      shouldGate: true;
      detection: FunctionDetection;
      frame_transition: FrameTransition;
      reason: string;
      reply: string;
      language: "en" | "id";
    };

/** Which functions represent a legitimate continuation of a prior
 *  task turn. Everything else is either a NEW_ACT (gated set) or
 *  UNCERTAIN (unclassified · ambiguous). */
const CONTINUATION_FUNCTIONS: ReadonlySet<ConversationalFunction> = new Set<ConversationalFunction>([
  "RESULT_FOLLOW_UP",
  "CLARIFICATION",
  "CONFIRMATION",
  "ACKNOWLEDGEMENT",
]);

function computeFrameTransition(fn: ConversationalFunction): FrameTransition {
  if (GATED_FUNCTIONS.has(fn)) return "NEW_ACT";
  if (CONTINUATION_FUNCTIONS.has(fn)) return "CONTINUATION";
  // TASK_REQUEST · INFORMATION_QUESTION · TOPIC_SHIFT are new tasks
  // in their own right — the caller may treat them as NEW_ACT for
  // frame-reset purposes without needing gate intervention.
  if (fn === "TASK_REQUEST" || fn === "INFORMATION_QUESTION" || fn === "TOPIC_SHIFT"
      || fn === "NEGATED_REQUEST") {
    return "NEW_ACT";
  }
  return "UNCERTAIN";
}

function detectLanguage(message: string): "en" | "id" {
  const idMarkers = /\b(apa|siapa|dimana|bagaimana|selamat|kenapa|halo|hai|iya|saya|anda|kamu|ceritakan|tentang|belum|tidak|ingin|yang|mana|adalah|akan|sudah|jadi|juga|itu|ini|dengan|pada|untuk|terima|kasih|makasih|sama|di|sini|ada|dari|dekat|maksud|maksudnya|sebenarnya|sebentar|tunggu|boleh|mau|tahu|tau|suka|cinta|benci|keren|bagus|indah|hebat|menarik)\b/i;
  return /[a-z]/i.test(message) && !idMarkers.test(message.toLowerCase()) ? "en" : "id";
}

export function decideConversationalFunctionGate(input: {
  userMessage: string;
  session?: SessionState | null | undefined;
  ownerLanguage?: "en" | "id";
}): ConversationalFunctionGateDecision {
  const detection = classifyConversationalFunction(input.userMessage);
  const frame_transition = computeFrameTransition(detection.function);
  if (!GATED_FUNCTIONS.has(detection.function)) {
    return {
      shouldGate: false,
      detection,
      frame_transition,
      reason: `not_gated_function:${detection.function}`,
    };
  }
  // The gate fires. Language routing.
  const language = input.ownerLanguage ?? detectLanguage(input.userMessage);
  const reply = pickReply(detection.function, language, input.userMessage, detection);
  return {
    shouldGate: true,
    detection,
    frame_transition,
    reason: `gated:${detection.function}:${detection.reason}`,
    reply,
    language,
  };
}
