// src/lib/nex/brain/recommendation-intent.ts
//
// NEX Speaking Intelligence · Wave 4 · Recommendation-request classifier
// Philip 2026-09-06 · AUTHORIZE · WAVE 4 · §2 §10 §26
//
// PURPOSE (§2 primary target)
//   "What should I do in Tokyo?" and its equivalents (§2) currently
//   slip past the P0 zero-evidence guard because the guard's subject
//   extractor only matches question-about-a-thing patterns
//   ("what about X", "tell me about X", "what is X"). Recommendation
//   requests use a different shape:
//     "what should I do in X"
//     "where should I eat/go"
//     "what would you recommend"
//     "anything good around X"
//     "what to see in X"
//
// PRINCIPLE (§26 no phrase-specific patches)
//   This is a SEMANTIC classifier — it composes small structural
//   pieces (interrogative + modal + task-verb + optional location
//   preposition) rather than pattern-matching whole phrases. Adding
//   new surface forms costs nothing if they use the same vocabulary.

// ─── Types ─────────────────────────────────────────────────────

export type RecommendationVerbClass =
  | "do"            // "do", "see", "check out", "explore", "visit"
  | "eat"           // "eat", "try", "have"
  | "go"            // "go", "head", "travel"
  | "recommend"     // "recommend", "suggest"
  | "find_good"     // "anything good", "any good X", "something nice"
  | "none";

export type RecommendationDetection = {
  is_recommendation_request: boolean;
  verb_class: RecommendationVerbClass;
  location: string | null;            // extracted geography if pinned
  domain_hint: string | null;         // "restaurant" / "hotel" / "place" if inferrable
  markers: string[];
  reason: string;
};

// ─── Tokenizer (word-level · punctuation stripped) ─────────────

function tokens(message: string): string[] {
  return (message || "")
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[?.!,;:"“”()]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

// ─── Structural vocabulary (EN + ID) ───────────────────────────

const INTERROGATIVES = new Set([
  "what", "where", "which", "how",
  "apa", "dimana", "bagaimana", "mana",
]);

const MODALS = new Set([
  "should", "can", "could", "would", "shall", "might", "must",
  "sebaiknya", "bisa", "boleh", "harus",
]);

const SUBJECT_PRONOUNS = new Set([
  "i", "we", "you",
  "saya", "kita", "kami", "anda", "kamu",
]);

const TASK_VERBS_DO = new Set([
  "do", "see", "visit", "explore", "check", "experience", "try", "watch",
  "lihat", "kunjungi", "coba", "eksplor", "jelajahi",
]);
const TASK_VERBS_EAT = new Set([
  "eat", "dine", "grab", "have", "get",
  "makan", "santap", "cari",
]);
const TASK_VERBS_GO = new Set([
  "go", "head", "travel", "visit",
  "pergi", "menuju", "berkunjung",
]);
const TASK_VERBS_RECOMMEND = new Set([
  "recommend", "suggest", "advise",
  "rekomendasikan", "sarankan", "sarankan",
]);

const FIND_GOOD_STARTERS: ReadonlyArray<ReadonlyArray<string>> = [
  ["anything", "good"],
  ["any", "good"],
  ["something", "good"],
  ["something", "nice"],
  ["ada", "yang", "bagus"],
  ["ada", "rekomendasi"],
];

/** Recommendation NOUNS. When the message contains one of these as a
 *  noun (not a verb) with an interrogative shape, treat it as a
 *  recommendation request. Catches "any suggestions?" / "recommendations
 *  please?" / "ada saran?" that don't fit the interrogative+modal+verb
 *  pattern. */
const RECOMMENDATION_NOUNS = new Set([
  "suggestion", "suggestions",
  "recommendation", "recommendations",
  "advice", "tips", "ideas",
  "saran", "rekomendasi",
]);

const LOCATION_PREPOSITIONS = new Set([
  "in", "at", "around", "near", "to",
  "di", "ke", "sekitar", "dekat",
]);

const DOMAIN_HINT_TOKENS: Record<string, string> = {
  restaurant: "food", restaurants: "food",
  cafe: "food", cafes: "food", cafés: "food",
  food: "food", eat: "food", dining: "food",
  hotel: "accommodation", hotels: "accommodation",
  stay: "accommodation", stays: "accommodation",
  place: "places", places: "places", spot: "places", spots: "places",
  gym: "service", gyms: "service",
  bar: "food", bars: "food",
  attraction: "places", attractions: "places",
};

// ─── Helpers ──────────────────────────────────────────────────

function startsWithSequence(t: string[], seq: ReadonlyArray<string>): boolean {
  if (seq.length > t.length) return false;
  for (let i = 0; i < seq.length; i++) if (t[i] !== seq[i]) return false;
  return true;
}

function classifyTaskVerb(verb: string): RecommendationVerbClass {
  if (TASK_VERBS_DO.has(verb)) return "do";
  if (TASK_VERBS_EAT.has(verb)) return "eat";
  if (TASK_VERBS_GO.has(verb)) return "go";
  if (TASK_VERBS_RECOMMEND.has(verb)) return "recommend";
  return "none";
}

/** Extract the location word(s) after a location preposition. Returns
 *  the location as it appeared in the original message (preserves case
 *  for downstream display). */
function extractLocation(originalMessage: string, tks: string[]): string | null {
  for (let i = 0; i < tks.length - 1; i++) {
    if (LOCATION_PREPOSITIONS.has(tks[i])) {
      // Take the next 1-3 tokens as the location · stop at punctuation
      // or a modal / interrogative.
      const parts: string[] = [];
      for (let j = i + 1; j < Math.min(tks.length, i + 4); j++) {
        const t = tks[j];
        if (INTERROGATIVES.has(t) || MODALS.has(t) || SUBJECT_PRONOUNS.has(t)) break;
        // Skip common articles
        if (t === "the" || t === "a" || t === "an") { if (parts.length === 0) continue; else break; }
        parts.push(t);
      }
      if (parts.length === 0) continue;
      // Reconstruct with original casing by matching against the message.
      const joined = parts.join(" ");
      // Case-preserve by looking up the joined phrase in the original.
      const rx = new RegExp(joined.replace(/\s+/g, "\\s+"), "i");
      const m = rx.exec(originalMessage);
      if (m) return m[0].replace(/\s+/g, " ").trim();
      return joined;
    }
  }
  return null;
}

function extractDomainHint(tks: string[]): string | null {
  for (const t of tks) {
    if (DOMAIN_HINT_TOKENS[t]) return DOMAIN_HINT_TOKENS[t];
  }
  return null;
}

// ─── Classifier ─────────────────────────────────────────────────

export function classifyRecommendationIntent(message: string): RecommendationDetection {
  const t = tokens(message);
  const markers: string[] = [];
  const none = (reason: string): RecommendationDetection => ({
    is_recommendation_request: false, verb_class: "none",
    location: null, domain_hint: null, markers, reason,
  });
  if (t.length === 0) return none("empty");

  // 1 · "anything good in X" / "any good X" · find-good starter (§2)
  for (const seq of FIND_GOOD_STARTERS) {
    if (startsWithSequence(t, seq)) {
      markers.push(`find_good_start:${seq.join("_")}`);
      return {
        is_recommendation_request: true,
        verb_class: "find_good",
        location: extractLocation(message, t),
        domain_hint: extractDomainHint(t),
        markers,
        reason: "find_good_starter",
      };
    }
  }

  // 2 · "what would you recommend" / "can you suggest" · verb-forward
  //     variant · looks for RECOMMEND / SUGGEST verb regardless of prefix.
  const recVerbIdx = t.findIndex((x) => TASK_VERBS_RECOMMEND.has(x));
  if (recVerbIdx > 0) {
    // Guardrail: an interrogative or modal must appear earlier so we
    // don't falsely fire on "I recommend Tokyo" (a statement).
    const earlier = t.slice(0, recVerbIdx);
    const isQuestion = earlier.some((x) => INTERROGATIVES.has(x)) || earlier.some((x) => MODALS.has(x));
    if (isQuestion) {
      markers.push(`recommend_verb_at:${recVerbIdx}`);
      return {
        is_recommendation_request: true,
        verb_class: "recommend",
        location: extractLocation(message, t),
        domain_hint: extractDomainHint(t),
        markers,
        reason: "recommend_verb_in_question",
      };
    }
  }

  // 3 · Interrogative + modal + subject + task-verb pattern:
  //     "what should I do in Tokyo" · "where can I eat" · "where should we go"
  //     Search first four tokens for the pattern shape.
  const first4 = t.slice(0, 4);
  const hasInterrogative = first4.some((x) => INTERROGATIVES.has(x));
  const hasModal = first4.some((x) => MODALS.has(x));
  const hasSubject = first4.some((x) => SUBJECT_PRONOUNS.has(x));
  if (hasInterrogative && hasModal && hasSubject) {
    // Find the first task verb in positions 2-5
    for (let i = 2; i < Math.min(t.length, 6); i++) {
      const vc = classifyTaskVerb(t[i]);
      if (vc !== "none" && vc !== "recommend") {
        markers.push(`interrogative_modal_${vc}`);
        return {
          is_recommendation_request: true,
          verb_class: vc,
          location: extractLocation(message, t),
          domain_hint: extractDomainHint(t),
          markers,
          reason: `interrogative_modal_${vc}`,
        };
      }
    }
  }

  // 4 · "what to see/do/eat in X" · imperative-shortened variant
  //     "what" + "to" + task-verb
  if (t[0] === "what" && t[1] === "to") {
    const vc = classifyTaskVerb(t[2] ?? "");
    if (vc !== "none" && vc !== "recommend") {
      markers.push(`what_to_${vc}`);
      return {
        is_recommendation_request: true,
        verb_class: vc,
        location: extractLocation(message, t),
        domain_hint: extractDomainHint(t),
        markers,
        reason: `what_to_${vc}`,
      };
    }
  }

  // 4.5 · Recommendation NOUN with interrogative shape
  //       "any suggestions?" / "recommendations please?" / "ada saran?"
  //       The message must be short and contain a recommendation noun
  //       without being a statement or task command.
  if (t.length <= 8) {
    const nounIdx = t.findIndex((x) => RECOMMENDATION_NOUNS.has(x));
    if (nounIdx >= 0) {
      // Guard: reject when the noun is preceded by a possessive
      // ("my suggestions"/"your ideas" is a statement).
      const prev = nounIdx > 0 ? t[nounIdx - 1] : null;
      const isPossessed = prev === "my" || prev === "your" || prev === "their" || prev === "his" || prev === "her";
      if (!isPossessed) {
        markers.push(`recommendation_noun:${t[nounIdx]}`);
        return {
          is_recommendation_request: true,
          verb_class: "recommend",
          location: extractLocation(message, t),
          domain_hint: extractDomainHint(t),
          markers,
          reason: `recommendation_noun:${t[nounIdx]}`,
        };
      }
    }
  }

  // 5 · "where would you go" · "where to eat"
  if (t[0] === "where") {
    // "where would you go" — earlier check would already catch (interrogative + modal + subject + go)
    // "where to eat" — same as pattern 4 above
    if (t[1] === "to") {
      const vc = classifyTaskVerb(t[2] ?? "");
      if (vc !== "none" && vc !== "recommend") {
        markers.push(`where_to_${vc}`);
        return {
          is_recommendation_request: true,
          verb_class: vc,
          location: extractLocation(message, t),
          domain_hint: extractDomainHint(t),
          markers,
          reason: `where_to_${vc}`,
        };
      }
    }
  }

  return none("no_pattern_matched");
}

// ─── Convenience: is this message a recommendation ask? ────────

export function isRecommendationRequest(message: string): boolean {
  return classifyRecommendationIntent(message).is_recommendation_request;
}
