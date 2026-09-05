// src/lib/nex/brain/honest-boundary-reply.ts
//
// P0 · Zero-Evidence Fabrication Guard (Philip 2026-09-05 · chief-engineer
// AUTHORIZE · P0 CORRECTION · ZERO-EVIDENCE FABRICATION GUARD).
//
// PURPOSE:
//   When the composition pipeline has RETRIEVED ZERO GROUNDED KNOWLEDGE
//   for a user question that seeks substantive domain facts about a
//   specific subject, the LLM composer MUST NOT be invoked — because
//   composition without knowledge is composition of hallucination
//   (proven case: FOOD T4 "What about Japan?" → LLM invented sushi/
//   sashimi/ramen claims with k_count=0).
//
//   Instead, NEX composes an HONEST BOUNDARY reply deterministically —
//   acknowledging the subject, stating NEX has no grounded knowledge on
//   it, and offering a direction NEX CAN speak to.
//
// NEX HIERARCHY (preserved · doctrine-lock):
//   USER
//     ↓
//   NEX understands meaning
//     ↓
//   NEX retrieves evidence
//     ↓
//   NEX determines evidence/confidence/boundary  ← THIS module owns this hop
//     ↓
//   bounded reasoning context ✗ (skipped when k=0 + subject present)
//     ↓
//   MODEL speaks naturally         ✗ (skipped)
//     ↓
//   NEX verifies claims            ✓ (still runs · gate and verifier are separate)
//     ↓
//   ANSWER (honest boundary)
//
// SCOPE (verbatim from AUTHORIZE):
//   AUTHORIZED: modify composition gate · smallest directly-related
//     response-composition logic · add tests · add diagnostic evidence.
//   NOT AUTHORIZED: fix hotel reference · fix gym attribute fabrication ·
//     fix travel stability · add walker configurations · Phase 5 ·
//     Programmer Agent · redesign conversation system.
//
// DELIBERATE DESIGN CHOICES:
//   1. Deterministic (no LLM call) — LLM cannot bypass its own boundary.
//   2. Language-aware (EN vs ID) — matches NEX personality naturally.
//   3. Small template family with subject interpolation — Philip's rule
//      "do NOT hard-code one canned sentence if that would damage
//      conversational quality" is met via multiple natural phrasings.
//   4. Subject extraction is CONSERVATIVE — false negative means LLM
//      composes freely; false positive means honest boundary. Safer
//      to over-detect than to over-invent.
//   5. NOT an over-broad kill switch — only triggers when we have BOTH
//      (a) zero evidence AND (b) an extractable substantive subject.
//      Meta/social questions like "What do you think?" pass through.

// Wave 4 (§2 primary target) · Recommendation-request classifier owns
// semantic detection of "what should I do in X" / "what would you
// recommend" / "anything good around Y". Extends the P0 guard to fire
// on recommendation requests with zero evidence — where the previous
// subject-extractor would return null and the LLM composer would then
// fabricate domain-specific recommendations.
import { classifyRecommendationIntent } from "./recommendation-intent";

// ─── Subject extraction (does the user ask about a specific thing?) ─
//
// A "subject" is a topical noun the user is asking about. If we can
// identify one, the user expects substantive domain content. If we
// cannot, the user is probably making conversation.
//
// Extractors are ordered by specificity — first match wins.
const SUBJECT_EXTRACTORS: ReadonlyArray<RegExp> = [
  // "what about tuna" · "how about Bali" · "what about Japan?"
  /\b(?:what|how|and|but)\s+about\s+([A-Za-z][A-Za-z0-9 _'-]{0,60}?)(?:[?!.,]|$)/i,
  // "tell me about X" · "tell me more about X"
  /\btell\s+me(?:\s+more)?\s+about\s+([A-Za-z][A-Za-z0-9 _'-]{0,60}?)(?:[?!.,]|$)/i,
  // "explain X" · "describe X" · "define X"
  /\b(?:explain|describe|define)\s+([A-Za-z][A-Za-z0-9 _'-]{0,60}?)(?:[?!.,]|$)/i,
  // "what is X" · "what are X" · "what was/were X"
  /\bwhat\s+(?:is|are|was|were)\s+([A-Za-z][A-Za-z0-9 _'-]{0,60}?)(?:[?!.,]|$)/i,
  // "who is X" · "who are X"
  /\bwho\s+(?:is|are|was|were)\s+([A-Za-z][A-Za-z0-9 _'-]{0,60}?)(?:[?!.,]|$)/i,
  // Indonesian: "apa itu X" · "siapa X" · "bagaimana X"
  /\bapa\s+itu\s+([A-Za-z][A-Za-z0-9 _'-]{0,60}?)(?:[?!.,]|$)/i,
  /\bceritakan\s+tentang\s+([A-Za-z][A-Za-z0-9 _'-]{0,60}?)(?:[?!.,]|$)/i,
  /\btentang\s+([A-Za-z][A-Za-z0-9 _'-]{0,60}?)(?:[?!.,]|$)/i,
];

/** Words that are NOT valid subjects even if pattern-matched.
 *  These are meta/opinion pronouns — the user is not asking about
 *  a domain topic. */
const NON_SUBJECT_STOPS = new Set([
  "you", "yourself", "yourselves",
  "me", "myself",
  "us", "ourselves", "we",
  "them", "themselves", "they",
  "it", "itself",
  "this", "that", "these", "those",
  "everything", "anything", "something", "nothing",
  "much", "many", "more", "less",
  "here", "there",
  // Indonesian equivalents
  "kamu", "anda", "saya", "aku", "kita", "mereka", "ini", "itu",
]);

export function extractSubject(message: string): string | null {
  const trimmed = message.trim();
  if (!trimmed) return null;
  for (const rx of SUBJECT_EXTRACTORS) {
    const m = rx.exec(trimmed);
    if (m && m[1]) {
      const candidate = m[1].trim().toLowerCase();
      if (!candidate) continue;
      // Reject pronouns/stopwords · they don't signify a domain subject.
      const firstWord = candidate.split(/\s+/)[0];
      if (NON_SUBJECT_STOPS.has(firstWord)) continue;
      if (candidate.length < 2) continue;
      // Preserve original casing from the match.
      return m[1].trim();
    }
  }
  return null;
}

// ─── Owner-language detection · matches existing composition heuristic ─
//
// Duplicated (not imported) intentionally · keeps this module portable
// and its behavior explicit for the test suite.
// Word-boundary-anchored so "Japan" (contains "apa") does NOT match an
// Indonesian marker. Existing chat/route.ts uses an unanchored variant —
// deliberately keeping this module's copy anchored to remove that class
// of false positive. Scope of this correction is composition boundary
// only · route.ts detector kept as-is per AUTHORIZE narrow scope.
const ID_MARKERS_RX = /\b(apa|siapa|dimana|bagaimana|selamat|kenapa|halo|hai|iya|saya|anda|kamu|ceritakan|tentang|belum|tidak|ingin|ada|dan|dari|untuk|dengan)\b/i;

export function detectOwnerLanguage(message: string): "en" | "id" {
  return /[a-z]/i.test(message) && !ID_MARKERS_RX.test(message.toLowerCase())
    ? "en"
    : "id";
}

// ─── Boundary template selection ────────────────────────────────────

const TEMPLATES_EN_WITH_SUBJECT: ReadonlyArray<(s: string) => string> = [
  (s) => `I don't have grounded information about ${s} in NEX's knowledge yet.`,
  (s) => `NEX doesn't have verified information on ${s} at the moment.`,
  (s) => `That's outside what NEX currently has grounded — I don't have verified data on ${s}.`,
];

const TEMPLATES_EN_GENERIC: ReadonlyArray<() => string> = [
  () => `I don't have grounded information on that in NEX's knowledge yet.`,
  () => `NEX doesn't have verified information for that yet.`,
];

const TEMPLATES_ID_WITH_SUBJECT: ReadonlyArray<(s: string) => string> = [
  (s) => `Saya belum memiliki informasi terverifikasi tentang ${s} di data NEX.`,
  (s) => `NEX belum punya informasi terverifikasi tentang ${s}.`,
];

const TEMPLATES_ID_GENERIC: ReadonlyArray<() => string> = [
  () => `Saya belum memiliki informasi terverifikasi tentang itu di data NEX.`,
  () => `NEX belum punya informasi terverifikasi untuk itu.`,
];

const SUGGEST_EN = " Want to try an Indonesian topic I can speak to — food, regions, tourism, or transport?";
const SUGGEST_ID = " Ingin bertanya tentang topik Indonesia yang saya kenal — makanan, wilayah, wisata, atau transportasi?";

/** Deterministic template rotator using a stable hash of the message.
 *  Not for security · just to avoid always returning identical text. */
function templateIndex(seedString: string, len: number): number {
  let h = 0;
  for (let i = 0; i < seedString.length; i++) h = (h * 31 + seedString.charCodeAt(i)) | 0;
  return Math.abs(h) % Math.max(len, 1);
}

// ─── Public API ─────────────────────────────────────────────────────

export type HonestBoundaryInput = {
  userMessage: string;
  ownerLanguage?: "en" | "id";
  intent?: string | null;
  /** Optional running conversation topic · used for suggestion tone. */
  runningTopic?: string | null;
};

export type HonestBoundaryDecision =
  | { applies: false; reason: string }
  | {
      applies: true;
      reason: string;
      subject: string | null;
      language: "en" | "id";
      reply: string;
    };

/**
 * Decide whether the honest-boundary should apply to this turn, and
 * if so, build the boundary reply text.
 *
 * The gate fires in TWO cases:
 *
 *   Case A · SUBJECT question with zero evidence (original P0):
 *     "what about Japan?" / "tell me about tuna" / "what is X" / etc.
 *     Requires extractSubject() to return a substantive subject AND
 *     retrieval to have returned k=0.
 *
 *   Case B · RECOMMENDATION request with zero evidence (Wave 4 · §2):
 *     "what should I do in Tokyo?" / "where should I eat?" / "what
 *     would you recommend?" / "anything good around X?" — semantic
 *     recommendation-request classifier owned by recommendation-intent.ts.
 *     Fires even when extractSubject() would return null, because the
 *     recommendation VERB itself indicates the user expects substantive
 *     domain content the composer would otherwise fabricate.
 *
 * The caller MUST have already:
 *   · Run retrieval
 *   · Confirmed hits.length === 0
 *   · Confirmed the composition gate would otherwise open (i.e., we're
 *     in a composition-eligible path)
 */
export function decideHonestBoundary(
  input: HonestBoundaryInput & { hasGroundedKnowledge: boolean },
): HonestBoundaryDecision {
  if (input.hasGroundedKnowledge) {
    return { applies: false, reason: "has_grounded_knowledge" };
  }
  const language = input.ownerLanguage ?? detectOwnerLanguage(input.userMessage);

  // Case A · Subject-question with zero evidence
  const subject = extractSubject(input.userMessage);
  if (subject) {
    const reply = buildBoundaryReply({ subject, language, message: input.userMessage });
    return { applies: true, reason: "zero_evidence_with_subject", subject, language, reply };
  }

  // Case B · Recommendation request with zero evidence · §2 primary target
  // The recommendation-intent classifier owns semantic detection.
  const rec = classifyRecommendationIntent(input.userMessage);
  if (rec.is_recommendation_request) {
    // Prefer location as the subject for the reply; fall back to a
    // generic no-location boundary otherwise.
    const recSubject = rec.location ?? null;
    const reply = recSubject
      ? buildBoundaryReply({ subject: recSubject, language, message: input.userMessage })
      : buildRecommendationBoundaryReply({ verb_class: rec.verb_class, language, message: input.userMessage });
    return {
      applies: true,
      reason: `zero_evidence_recommendation_request:${rec.verb_class}${recSubject ? `:${recSubject}` : ""}`,
      subject: recSubject,
      language,
      reply,
    };
  }

  return { applies: false, reason: "no_extractable_subject" };
}

// ─── Recommendation-boundary templates (no location) ────────────

const REC_TEMPLATES_EN: ReadonlyArray<() => string> = [
  () => `I don't have verified recommendations to make yet in NEX's knowledge.`,
  () => `I'd rather say I don't have grounded recommendations for that yet than guess.`,
];
const REC_TEMPLATES_ID: ReadonlyArray<() => string> = [
  () => `Saya belum memiliki rekomendasi terverifikasi untuk itu di data NEX.`,
  () => `Saya lebih baik bilang belum punya rekomendasi terverifikasi daripada menebak.`,
];

function buildRecommendationBoundaryReply(input: { verb_class: string; language: "en" | "id"; message: string }): string {
  const { language, message } = input;
  if (language === "id") {
    const tmpl = REC_TEMPLATES_ID[templateIndex(message, REC_TEMPLATES_ID.length)];
    return tmpl() + SUGGEST_ID;
  }
  const tmpl = REC_TEMPLATES_EN[templateIndex(message, REC_TEMPLATES_EN.length)];
  return tmpl() + SUGGEST_EN;
}

function buildBoundaryReply(input: { subject: string; language: "en" | "id"; message: string }): string {
  const { subject, language, message } = input;
  if (language === "id") {
    const tmpl = TEMPLATES_ID_WITH_SUBJECT[templateIndex(message, TEMPLATES_ID_WITH_SUBJECT.length)];
    return tmpl(subject) + SUGGEST_ID;
  }
  const tmpl = TEMPLATES_EN_WITH_SUBJECT[templateIndex(message, TEMPLATES_EN_WITH_SUBJECT.length)];
  return tmpl(subject) + SUGGEST_EN;
}

/**
 * Fallback boundary when caller doesn't want subject extraction (e.g.
 * defensive path). Not used by the primary gate but exported for
 * test coverage and future callers.
 */
export function buildGenericBoundaryReply(language: "en" | "id", message = ""): string {
  if (language === "id") {
    const tmpl = TEMPLATES_ID_GENERIC[templateIndex(message, TEMPLATES_ID_GENERIC.length)];
    return tmpl() + SUGGEST_ID;
  }
  const tmpl = TEMPLATES_EN_GENERIC[templateIndex(message, TEMPLATES_EN_GENERIC.length)];
  return tmpl() + SUGGEST_EN;
}
