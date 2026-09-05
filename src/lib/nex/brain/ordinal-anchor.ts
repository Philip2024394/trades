// src/lib/nex/brain/ordinal-anchor.ts
//
// P0.4 · Fresh-Conversation Ordinal Contamination Guard
// (Philip 2026-09-05 · AUTHORIZE · P0.4 CORRECTION)
//
// INVARIANT ENFORCED:
//   ORDINAL/DEICTIC REFERENCE REQUIRES A VALID CONVERSATIONAL ANCHOR.
//
// A conversational reference such as "the first one" / "the first hotel"
// / "that hotel" / "the previous one" MUST only resolve to an entity
// when NEX has an authoritative conversational anchor (prior presented
// entities · resolved reference · active goal). Without an anchor,
// the message is a REFERENCE REQUEST WITHOUT ANTECEDENT — NEX must
// remain honest instead of manufacturing conversational context from
// lexical coincidence.
//
// PROVEN DEFECT (before this module):
//   Fresh conversation · "Tell me about the first hotel." → NEX
//   composed "The first hotel in the conversation is Griya Sentana,
//   located in Special Region of Yogyakarta..." — inventing
//   conversational context that never existed. Griya Sentana is a
//   real record, but it is NOT what the user meant.
//
// ARCHITECTURAL PRINCIPLE (from AUTHORIZE §13):
//   "A database record is evidence of an entity. It is NOT evidence
//    that the user meant that entity."
//
// LEGITIMATE VS ILLEGITIMATE:
//   "the first hotel"           → ORDINAL REFERENCE · needs anchor
//   "the first one"             → ORDINAL REFERENCE · needs anchor
//   "that hotel"                → DEICTIC REFERENCE · needs anchor
//   "the previous one"          → DEICTIC REFERENCE · needs anchor
//   "the First Living Hotel"    → ENTITY-NAME SEARCH · no gate (proper noun · not adjacent to category noun after ordinal)
//   "Find First Living Hotel"   → ENTITY-NAME SEARCH · no gate
//   "Find hotels near Malioboro"→ SEARCH INTENT · no gate

import type { SessionState } from "./session";

// ─── Ordinal / deictic detection ─────────────────────────────────
//
// Deliberately CONSERVATIVE detectors: false negative (miss an ordinal
// phrase) means the existing P0 guard catches it later. False positive
// (gate an explicit entity search) breaks legitimate use. So patterns
// are precise and only match when a category NOUN is IMMEDIATELY after
// the ordinal word.

const ORDINAL_WORDS = [
  "first", "second", "third", "fourth", "fifth",
  "sixth", "seventh", "eighth", "ninth", "tenth",
  "next", "previous", "prior", "last",
] as const;

/** Common category nouns the user might attach to an ordinal in a
 *  reference request. Kept small on purpose — only category words
 *  that would signal "one of the prior results" rather than a proper
 *  noun. Category nouns are singular OR simple plural. */
const CATEGORY_NOUNS = [
  "one", "ones",
  "hotel", "hotels", "villa", "villas", "guesthouse", "guesthouses",
  "hostel", "hostels", "kos", "homestay", "homestays",
  "restaurant", "restaurants", "warung", "cafe", "cafes", "coffee",
  "gym", "gyms", "salon", "salons", "dentist", "dentists",
  "optician", "opticians", "pharmacy", "pharmacies",
  "place", "places", "location", "locations",
  "listing", "listings", "result", "results",
  "business", "businesses", "provider", "providers",
  "option", "options", "choice", "choices", "item", "items",
  "airport", "airports", "restaurant", "cafe",
  "product", "products", "seller", "sellers",
] as const;

/** Deictic words paired with a category noun. */
const DEICTIC_WORDS = ["that", "this"] as const;

/** Category nouns joined into a non-capturing alternation regex fragment.
 *  Escaped for safety (though these are literal words). */
const CATEGORY_ALT = Array.from(new Set(CATEGORY_NOUNS))
  .map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
  .join("|");
const ORDINAL_ALT = ORDINAL_WORDS.join("|");
const DEICTIC_ALT = DEICTIC_WORDS.join("|");

/** Regex patterns for reference detection.
 *  All are case-INSENSITIVE. All require adjacency between ordinal
 *  word and category noun so proper-noun compounds like "First
 *  Living Hotel" don't match (because "living" is between "first"
 *  and "hotel"). */
const ORDINAL_CATEGORY_RX = new RegExp(
  `\\bthe\\s+(?:${ORDINAL_ALT})\\s+(?:${CATEGORY_ALT})\\b`,
  "i",
);
const BARE_ORDINAL_CATEGORY_RX = new RegExp(
  `\\b(?:${ORDINAL_ALT})\\s+(?:${CATEGORY_ALT})\\b`,
  "i",
);
const DEICTIC_CATEGORY_RX = new RegExp(
  `\\b(?:${DEICTIC_ALT})\\s+(?:${CATEGORY_ALT})\\b`,
  "i",
);
/** Special-case reference phrasings. */
const SPECIAL_REFERENCE_RX = /\b(?:the\s+one\s+(?:you|we|nex)\s+(?:mentioned|talked\s+about|showed|suggested)|the\s+previous\s+one|the\s+one\s+i\s+picked)\b/i;
/** "which one/hotel/etc." — user asking us to choose */
const WHICH_ONE_RX = new RegExp(
  `\\bwhich\\s+(?:${CATEGORY_ALT})\\b`,
  "i",
);

export type OrdinalReferenceKind = "ordinal_the" | "ordinal_bare" | "deictic" | "which" | "special";

export type OrdinalReferenceDetection = {
  matched: boolean;
  kind: OrdinalReferenceKind | null;
  matched_phrase: string | null;
  /** Category noun the user referenced (hotel · restaurant · gym · one · etc.) */
  category_noun: string | null;
};

/** Detect whether the message contains an ordinal or deictic
 *  reference that requires a conversational anchor. Returns a
 *  precise decision · no LLM. */
export function detectOrdinalReference(message: string): OrdinalReferenceDetection {
  const trimmed = (message ?? "").trim();
  if (!trimmed) return { matched: false, kind: null, matched_phrase: null, category_noun: null };
  // Order matters: prefer more-specific patterns first so we identify the strongest reference kind.
  const specialMatch = SPECIAL_REFERENCE_RX.exec(trimmed);
  if (specialMatch) return { matched: true, kind: "special", matched_phrase: specialMatch[0], category_noun: extractCategory(specialMatch[0]) };
  const ordinalTheMatch = ORDINAL_CATEGORY_RX.exec(trimmed);
  if (ordinalTheMatch) return { matched: true, kind: "ordinal_the", matched_phrase: ordinalTheMatch[0], category_noun: extractCategory(ordinalTheMatch[0]) };
  const deicticMatch = DEICTIC_CATEGORY_RX.exec(trimmed);
  if (deicticMatch) return { matched: true, kind: "deictic", matched_phrase: deicticMatch[0], category_noun: extractCategory(deicticMatch[0]) };
  const whichMatch = WHICH_ONE_RX.exec(trimmed);
  if (whichMatch) return { matched: true, kind: "which", matched_phrase: whichMatch[0], category_noun: extractCategory(whichMatch[0]) };
  const bareMatch = BARE_ORDINAL_CATEGORY_RX.exec(trimmed);
  if (bareMatch) return { matched: true, kind: "ordinal_bare", matched_phrase: bareMatch[0], category_noun: extractCategory(bareMatch[0]) };
  return { matched: false, kind: null, matched_phrase: null, category_noun: null };
}

function extractCategory(phrase: string): string | null {
  const tokens = phrase.toLowerCase().split(/\s+/);
  const catSet = new Set(CATEGORY_NOUNS);
  for (let i = tokens.length - 1; i >= 0; i--) {
    if (catSet.has(tokens[i] as (typeof CATEGORY_NOUNS)[number])) return tokens[i];
  }
  return null;
}

// ─── Valid conversational anchor detection ───────────────────────

/** Returns true when the session state contains an authoritative
 *  conversational anchor for ordinal/deictic resolution.
 *
 *  Valid anchors — both MUST originate from a PRIOR turn:
 *   1. currentReference.resolved === true — NEX previously (or freshly)
 *      bound an entity through deterministic resolution
 *   2. session.entities contains presented business_name / place / area
 *      entities from nex_reply — these are deposited AFTER a reply is
 *      sent, so their presence implies a prior turn happened
 *
 *  DELIBERATELY EXCLUDED: session.goal · goals can be created within
 *  the SAME turn as the user's message (e.g., accommodation composer
 *  creates a goal in response to "find me a hotel"), so a goal alone
 *  is NOT evidence of a prior turn's presentation. Treating it as an
 *  anchor caused the P0.4 gate to fail-open on fresh accommodation
 *  requests such as "Tell me about the first hotel."
 *
 *  Fresh conversation (no session · no entities · no reference) → false. */
export function hasValidConversationalAnchor(
  session: SessionState | null | undefined,
): boolean {
  if (!session) return false;
  // Check 1: any resolved reference (fresh this turn or from prior turn)
  const ref = session.currentReference as unknown as { resolved?: boolean } | undefined;
  if (ref?.resolved === true) return true;
  // Check 2: presented entities in session window (deposited after prior reply)
  const entities = session.entities ?? [];
  const hasPresented = entities.some((e) =>
    (e.kind === "business_name" || e.kind === "place" || e.kind === "area")
    && e.source === "nex_reply",
  );
  if (hasPresented) return true;
  return false;
}

// ─── Gate decision ───────────────────────────────────────────────

export type OrdinalGateDecision =
  | { shouldGate: false; reason: string }
  | {
      shouldGate: true;
      reason: string;
      detection: OrdinalReferenceDetection;
      boundary_reply: string;
      language: "en" | "id";
    };

/**
 * Decide whether to gate ordinal-contamination for this turn.
 *
 * Gate FIRES when:
 *   1. detectOrdinalReference(message) matches AND
 *   2. hasValidConversationalAnchor(session) is false
 *
 * Gate does NOT fire when:
 *   · No ordinal pattern in message (normal retrieval proceeds)
 *   · Ordinal pattern present but session has a valid anchor (P0.3
 *     hydration or normal composition proceeds)
 *   · Explicit entity search ("Find First Living Hotel") — the pattern
 *     detector requires ordinal + category adjacency, so "First
 *     Living Hotel" (with "Living" between) never matches.
 */
export function decideOrdinalGate(input: {
  userMessage: string;
  session: SessionState | null | undefined;
  ownerLanguage?: "en" | "id";
}): OrdinalGateDecision {
  const detection = detectOrdinalReference(input.userMessage);
  if (!detection.matched) {
    return { shouldGate: false, reason: "no_ordinal_pattern" };
  }
  if (hasValidConversationalAnchor(input.session)) {
    return { shouldGate: false, reason: "valid_anchor_present" };
  }
  const language = input.ownerLanguage ?? detectOwnerLanguage(input.userMessage);
  const category = detection.category_noun ?? "one";
  return {
    shouldGate: true,
    reason: `ordinal_no_anchor:${detection.kind}:${category}`,
    detection,
    boundary_reply: buildOrdinalBoundaryReply({ category, language, kind: detection.kind! }),
    language,
  };
}

// ─── Boundary reply builder ──────────────────────────────────────

function detectOwnerLanguage(message: string): "en" | "id" {
  // ONLY Indonesian-specific words. Do NOT include words that overlap
  // with English (e.g. "hotel" is both). Includes common Indonesian
  // function words that reliably indicate an Indonesian message.
  const idMarkers = /\b(apa|siapa|dimana|bagaimana|selamat|kenapa|halo|hai|iya|saya|anda|kamu|ceritakan|tentang|belum|tidak|ingin|yang|mana|adalah|akan|sudah|jadi|juga|itu|ini|dengan|pada|untuk)\b/i;
  return /[a-z]/i.test(message) && !idMarkers.test(message.toLowerCase())
    ? "en"
    : "id";
}

/** Category-aware boundary phrasings. Uses "one" as neutral fallback
 *  for generic ordinals like "the first one" so the reply doesn't
 *  awkwardly say "which one do you mean?" for a categorised query. */
function buildOrdinalBoundaryReply(input: {
  category: string;
  language: "en" | "id";
  kind: OrdinalReferenceKind;
}): string {
  const { category, language, kind } = input;
  // Normalize plural → singular for natural phrasing
  const normalized = normalizeCategoryForPhrasing(category);
  if (language === "id") {
    if (normalized === "one") {
      return `Yang mana yang Anda maksud? Saya belum menampilkan daftar apa pun di percakapan ini. Ingin saya mencari sesuatu?`;
    }
    return `${capitalize(normalized)} yang mana yang Anda maksud? Saya belum menampilkan daftar ${normalized} di percakapan ini. Ingin saya mencari beberapa?`;
  }
  if (normalized === "one") {
    return `Which one do you mean? I don't have a previous list in this conversation. Want me to find some?`;
  }
  const article = kind === "which" ? "" : "";
  void article;
  return `Which ${normalized} do you mean? I don't have a previous ${normalized} list in this conversation. Want me to find some?`;
}

const PLURAL_TO_SINGULAR: Record<string, string> = {
  ones: "one",
  hotels: "hotel", villas: "villa", guesthouses: "guesthouse",
  hostels: "hostel", homestays: "homestay",
  restaurants: "restaurant", cafes: "cafe",
  gyms: "gym", salons: "salon", dentists: "dentist",
  opticians: "optician", pharmacies: "pharmacy",
  places: "place", locations: "location",
  listings: "listing", results: "result",
  businesses: "business", providers: "provider",
  options: "option", choices: "choice", items: "item",
  airports: "airport",
  products: "product", sellers: "seller",
};

function normalizeCategoryForPhrasing(category: string): string {
  const lower = category.toLowerCase();
  return PLURAL_TO_SINGULAR[lower] ?? lower;
}

function capitalize(s: string): string {
  return s.length > 0 ? s[0].toUpperCase() + s.slice(1) : s;
}
