// src/lib/nex/intelligence-storage-grid/accommodation/intent-parser.ts
//
// Founder BEGIN 2026-09-09 · INTENT + SLOT PARSER (P1)
//
// Deterministic language → canonical intent resolution. Zero embeddings.
// Zero LLM. Runs in <1 ms.
//
// Pipeline:
//   raw query → normalise() → token→intent mapping → structured intent+slots
//
// Fallbacks (in order · deterministic):
//   1. Token keyword hit against per-intent trigger set
//   2. Combination-of-tokens (e.g. "does" + "breakfast" → breakfast_available)
//   3. Structural pattern (ordinal reference · "where are they" · "how much")
//   4. UNRESOLVED — caller can decide to try semantic-fallback layer OR
//      surface an honest "I'm not sure what you're asking about" reply

import { normalise, type NormaliserResult } from "./language-normaliser";
import { INTENT_REGISTRY, type IntentDefinition } from "./intent-registry";

// ═══════════════════════════════════════════════════════════════════
// Per-intent trigger tokens (canonical tokens that fire the intent)
// ═══════════════════════════════════════════════════════════════════

const INTENT_TRIGGERS: Record<string, readonly string[]> = Object.freeze({
  // Property identity
  property_name:          ["name", "called"],
  property_category:      ["type", "kind", "hotel", "villa", "guesthouse", "homestay", "hostel", "apartment", "resort", "kos", "penginapan"],
  property_brand:         ["brand"],
  property_star_rating:   ["star", "stars", "rated"],
  property_rating:        ["rating"],
  reviews_count:          ["reviews", "review_count", "reviews_count"],

  // Location
  location_city:          ["city"],
  location_district:      ["district"],
  location_neighbourhood: ["neighbourhood"],
  location_address:       ["address", "street"],
  location_coordinates:   ["coordinates", "coords", "gps"],
  distance_to_landmark:   ["distance", "far", "km"],

  // Contact
  property_phone:         ["phone", "number", "contact"],
  property_whatsapp:      ["whatsapp", "wa"],
  property_website:       ["website", "web", "url"],
  property_email:         ["email"],

  // Rooms & beds
  room_types:             ["room", "rooms"],
  room_count:             ["room_count"],
  beds_configuration:     ["bed"],
  capacity:               ["capacity", "sleep"],

  // Amenities
  wifi_available:         ["wifi"],
  air_conditioning_available: ["air_conditioning"],
  parking_available:      ["parking"],
  pool_available:         ["pool"],
  gym_available:          ["gym"],
  spa_available:          ["spa"],
  laundry_available:      ["laundry"],
  elevator_available:     ["elevator"],
  balcony_available:      ["balcony"],
  view_available:         ["view"],
  smoking_policy:         ["smoke", "smoking"],

  // Food & drink
  breakfast_available:    ["breakfast"],
  restaurant_available:   ["restaurant"],
  bar_available:          ["bar"],
  room_service_available: ["room_service"],

  // Policies
  check_in_time:          ["checkin", "check_in", "check-in"],
  check_out_time:         ["checkout", "check_out", "check-out"],
  cancellation_policy:    ["cancel", "cancellation"],
  pet_policy:             ["pet", "pets", "dog", "cat"],
  children_policy:        ["children", "kids"],
  opening_hours:          ["hours", "open"],
  payment_methods:        ["payment", "pay"],

  // Accessibility
  wheelchair_access:      ["wheelchair"],
  accessible_room_available: ["accessible"],

  // Pricing / availability
  price_indicative:       ["price", "cost", "rate"],
  availability_tonight:   ["tonight", "tomorrow", "availability"],

  // Nearby (relationships)
  nearby_food:            ["restaurant", "food", "cafe", "eat"],
  nearby_attractions:     ["attraction", "attractions", "sight", "sights"],
  nearby_transport:       ["transport", "bus", "train", "station"],
  distance_to_malioboro:  ["malioboro"],
  distance_to_airport:    ["airport"],

  // Media
  hero_image:             ["photo", "image", "picture"],

  // Traveller-fit
  suitable_for_families:  ["family"],
  suitable_for_couples:   ["couples"],
  suitable_for_business:  ["business_traveller"],
  suitable_for_backpackers: ["backpackers"],
});

// ═══════════════════════════════════════════════════════════════════
// Structural pattern detectors (Q2 follow-up types)
// ═══════════════════════════════════════════════════════════════════

const STRUCTURAL_PATTERNS = Object.freeze({
  ordinal_reference: /(ordinal_1|ordinal_2|ordinal_3|first|second|third)/,
  question_where:    /question_where/,
  question_has:      /question_has/,
  question_count:    /question_count/,
  price_question:    /(price)/,
  price_preference:  /(price_cheap|price_expensive)/,
  vertical_switch:   /(guesthouse|hotel|villa|homestay|apartment|hostel|resort|kos|penginapan|wisma|losmen)/,
  action_show:       /action_show/,
  action_book:       /action_book/,
  action_compare:    /action_compare/,
});

// ═══════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════

export interface ParsedIntent {
  intent_slug: string | null;
  intent: IntentDefinition | null;
  slots: {
    /** e.g. "hotel" · "guesthouse" · "villa" — from vertical_switch pattern */
    property_category?: string;
    /** e.g. "yogyakarta" · "bali" */
    city?: string;
    /** e.g. "malioboro" — a landmark reference within the city */
    area?: string;
    /** Cheap/expensive · from price_preference */
    price_preference?: "cheap" | "expensive";
    /** Ordinal (1/2/3) when a follow-up references a prior list item */
    ordinal?: number;
    /** Time filter · Founder BEGIN LCC 2026-09-09 expanded window vocabulary */
    time?: "tonight" | "tomorrow" | "today" | "this_weekend" | "next_week";
    /** Traveller-type filter */
    traveller_type?: "family" | "couples" | "business_traveller" | "backpackers" | "children";
    /** Founder BEGIN LCC 2026-09-09 · property-name resolution.
     *  When `known_names` are provided AND a canonical business_name (or
     *  substring long enough) appears in the message · fill this. Fixes the
     *  Melia bug where "how many rooms does Hotel Melia Purosani have?"
     *  collapsed to property_category=hotel. */
    property_name_match?: {
      listing_ref: string;
      business_name: string;
      matched_span: string;
    };
    /** Structural signals */
    is_question: boolean;
    is_follow_up_where: boolean;
    is_follow_up_has: boolean;
    is_follow_up_ordinal: boolean;
    is_vertical_switch: boolean;
    is_action_show: boolean;
    is_action_book: boolean;
  };
  confidence: number;      // 0..1 · rough deterministic score
  normalised: NormaliserResult;
  reasoning: readonly string[];
}

/**
 * Founder BEGIN LCC 2026-09-09 · optional known-names dictionary the parser
 * can use to detect specific-entity questions. The chat route passes in the
 * hot-tier's canonical names on every turn. Empty dictionary = pure legacy
 * behaviour (no property-name detection).
 */
export interface ParseOptions {
  known_names?: Iterable<{ listing_ref: string; business_name: string }>;
}

// ═══════════════════════════════════════════════════════════════════
// Parser · pure function · zero side effects
// ═══════════════════════════════════════════════════════════════════

const CITIES = new Set(["yogyakarta", "bali", "jakarta", "bandung", "surabaya", "medan", "makassar", "denpasar", "solo", "semarang"]);
const AREAS = new Set(["malioboro"]);
const CATEGORIES = new Set(["hotel", "villa", "guesthouse", "homestay", "hostel", "apartment", "resort", "kos", "penginapan", "wisma", "losmen"]);

// Founder BEGIN LCC 2026-09-09 · which intents count as "per-property fact"
// intents that should WIN over property_category when both a property name
// and a fact trigger are present. property_category by itself means "list
// this category" (list_in_city). But "how many ROOMS does <hotel-name> have"
// must resolve to room_count, not property_category.
const PER_PROPERTY_FACT_INTENTS = new Set([
  "room_count", "room_types", "beds_configuration", "capacity",
  "wifi_available", "air_conditioning_available", "parking_available",
  "pool_available", "gym_available", "spa_available", "laundry_available",
  "elevator_available", "balcony_available", "view_available", "smoking_policy",
  "breakfast_available", "restaurant_available", "bar_available", "room_service_available",
  "check_in_time", "check_out_time", "cancellation_policy", "pet_policy",
  "children_policy", "opening_hours", "payment_methods",
  "wheelchair_access", "accessible_room_available",
  "price_indicative",
  "property_phone", "property_whatsapp", "property_website", "property_email",
  "location_district", "location_neighbourhood", "location_address", "location_coordinates",
  "distance_to_landmark", "distance_to_malioboro", "distance_to_airport",
  "property_star_rating", "property_rating", "reviews_count", "property_brand",
  "hero_image",
]);

export function parseIntent(raw: string, options?: ParseOptions): ParsedIntent {
  const normalised = normalise(raw);
  const canonSet = new Set(normalised.canonical_tokens);
  const reasoning: string[] = [];
  const lowerRaw = raw.toLowerCase();

  // Extract slots first · they inform intent choice
  const slots: ParsedIntent["slots"] = {
    is_question: normalised.contained_question_mark || normalised.canonical_tokens.some((t) => t.startsWith("question_")),
    is_follow_up_where: STRUCTURAL_PATTERNS.question_where.test(normalised.canonical_tokens.join(" ")),
    is_follow_up_has:   STRUCTURAL_PATTERNS.question_has.test(normalised.canonical_tokens.join(" ")),
    is_follow_up_ordinal: STRUCTURAL_PATTERNS.ordinal_reference.test(normalised.canonical_tokens.join(" ")),
    is_vertical_switch:  STRUCTURAL_PATTERNS.vertical_switch.test(normalised.canonical_tokens.join(" ")),
    is_action_show:      STRUCTURAL_PATTERNS.action_show.test(normalised.canonical_tokens.join(" ")),
    is_action_book:      STRUCTURAL_PATTERNS.action_book.test(normalised.canonical_tokens.join(" ")),
  };
  for (const t of normalised.canonical_tokens) {
    if (CATEGORIES.has(t)) slots.property_category = t;
    if (CITIES.has(t)) slots.city = t;
    if (AREAS.has(t)) slots.area = t;
    if (t === "price_cheap") slots.price_preference = "cheap";
    if (t === "price_expensive") slots.price_preference = "expensive";
    if (t === "tonight") slots.time = "tonight";
    if (t === "tomorrow") slots.time = "tomorrow";
    if (t === "ordinal_1") slots.ordinal = 1;
    if (t === "ordinal_2") slots.ordinal = 2;
    if (t === "ordinal_3") slots.ordinal = 3;
    if (t === "family") slots.traveller_type = "family";
    if (t === "couples") slots.traveller_type = "couples";
    if (t === "business_traveller") slots.traveller_type = "business_traveller";
    if (t === "backpackers") slots.traveller_type = "backpackers";
    if (t === "children") slots.traveller_type = "children";
  }
  // Founder BEGIN LCC 2026-09-09 · expanded date/window vocabulary picked up
  // directly from the raw message. The language-normaliser doesn't tokenise
  // multi-word windows so we substring-scan here. Deterministic.
  if (!slots.time) {
    if (/\bthis weekend\b/i.test(lowerRaw)) slots.time = "this_weekend";
    else if (/\bnext week\b/i.test(lowerRaw)) slots.time = "next_week";
    else if (/\btoday\b/i.test(lowerRaw)) slots.time = "today";
    else if (/\btomorrow\b/i.test(lowerRaw)) slots.time = "tomorrow";
    else if (/\btonight\b/i.test(lowerRaw)) slots.time = "tonight";
  }
  // Founder BEGIN LCC 2026-09-09 · alias "jogja" → "yogyakarta" (colloquial
  // Indonesian). The normaliser doesn't fold this yet.
  if (!slots.city && /\bjogja\b/i.test(lowerRaw)) {
    slots.city = "yogyakarta";
  }

  // Founder BEGIN LCC 2026-09-09 · property-name resolution. Fixes Melia bug.
  // Try longest substring match of any known business_name against the raw
  // message (case-insensitive · alphanumeric-tolerant). Longest hit wins so
  // "Grand Aston Yogyakarta" beats "Grand" if both are in the dictionary.
  if (options?.known_names) {
    let best: { listing_ref: string; business_name: string; matched_span: string } | null = null;
    for (const cand of options.known_names) {
      if (!cand?.business_name) continue;
      const nameLower = cand.business_name.toLowerCase().trim();
      if (nameLower.length < 4) continue; // avoid noise from very short names
      if (lowerRaw.includes(nameLower)) {
        if (!best || nameLower.length > best.matched_span.length) {
          best = {
            listing_ref: cand.listing_ref,
            business_name: cand.business_name,
            matched_span: nameLower,
          };
        }
        continue;
      }
      // Try token-subset match: all tokens of the name must appear as words
      // in the raw message. Handles "Melia Purosani" → "Hotel Melia Purosani".
      const nameTokens = nameLower.split(/\s+/).filter((t) => t.length >= 3);
      if (nameTokens.length >= 2) {
        const allPresent = nameTokens.every((t) => new RegExp(`\\b${escapeRegex(t)}\\b`, "i").test(lowerRaw));
        if (allPresent) {
          const span = nameTokens.join(" ");
          if (!best || span.length > best.matched_span.length) {
            best = {
              listing_ref: cand.listing_ref,
              business_name: cand.business_name,
              matched_span: span,
            };
          }
        }
      }
    }
    if (best) {
      slots.property_name_match = best;
      reasoning.push(`property_name matched: ${best.business_name} (${best.listing_ref})`);
    }
  }
  if (slots.property_category) reasoning.push(`category=${slots.property_category}`);
  if (slots.city) reasoning.push(`city=${slots.city}`);
  if (slots.area) reasoning.push(`area=${slots.area}`);
  if (slots.price_preference) reasoning.push(`price_pref=${slots.price_preference}`);
  if (slots.ordinal) reasoning.push(`ordinal=${slots.ordinal}`);
  if (slots.time) reasoning.push(`time=${slots.time}`);
  if (slots.traveller_type) reasoning.push(`traveller=${slots.traveller_type}`);

  // Score each intent by token-trigger overlap
  const scores: { slug: string; hits: number }[] = [];
  for (const [slug, triggers] of Object.entries(INTENT_TRIGGERS)) {
    let hits = 0;
    for (const trig of triggers) if (canonSet.has(trig)) hits++;
    if (hits > 0) scores.push({ slug, hits });
  }
  scores.sort((a, b) => b.hits - a.hits);

  // Founder BEGIN LCC 2026-09-09 · When a property_name is matched, per-property
  // fact intents beat property_category. Rerank so a fact-intent hit (even if
  // tied on token count) wins over property_category if a name is present.
  if (slots.property_name_match) {
    const factHit = scores.find((s) => PER_PROPERTY_FACT_INTENTS.has(s.slug));
    if (factHit) {
      const catIdx = scores.findIndex((s) => s.slug === "property_category");
      if (catIdx !== -1) scores.splice(catIdx, 1);
      // Move the fact hit to the top
      const fi = scores.findIndex((s) => s.slug === factHit.slug);
      if (fi > 0) {
        const [it] = scores.splice(fi, 1);
        scores.unshift(it);
      }
      reasoning.push(`property_name present · reranked ${factHit.slug} above property_category`);
    }
  }

  // Structural override: some patterns are stronger than raw hit count
  let intent_slug: string | null = null;

  // Founder BEGIN LCC 2026-09-09 · vertical_switch tightening.
  // The original vertical_switch pattern (any category token in ≤4 tokens)
  // stole every fresh list request. A real vertical switch is a follow-up
  // like "what about guesthouses" or "any villas" — the "what about/how
  // about/any" phrasing must be present in the raw message.
  const rawHasSwitchPhrase = /\b(what about|how about)\b/i.test(lowerRaw);
  const isRealVerticalSwitch = slots.is_vertical_switch && rawHasSwitchPhrase && normalised.canonical_tokens.length <= 4;

  // Follow-up "where are they" · "location?" → location_city
  if (slots.is_follow_up_where && !intent_slug) {
    intent_slug = "location_city";
    reasoning.push("structural: follow-up 'where' → location_city");
  }
  // Price question → price_indicative (only when NOT combined with a category-list
  // — "cheap hotels in jogja" should be list_in_city with a cheap slot, not
  // a single-property price question).
  const hasCategoryOrList = !!(slots.property_category || slots.property_name_match);
  if (
    STRUCTURAL_PATTERNS.price_question.test(normalised.canonical_tokens.join(" "))
    && !intent_slug
    && !hasCategoryOrList
  ) {
    intent_slug = "price_indicative";
    reasoning.push("structural: price question → price_indicative");
  }
  // Ordinal reference → property_name (customer wants details about the Nth item)
  if (slots.is_follow_up_ordinal && !intent_slug) {
    intent_slug = "property_name";
    reasoning.push("structural: ordinal reference → property_name (of Nth item in current list)");
  }
  // Founder BEGIN LCC 2026-09-09 · list_in_city routing.
  // Fires when: category token present · no property-name match · no per-property
  // fact intent hit · not a real vertical-switch follow-up.
  if (!intent_slug && slots.property_category && !slots.property_name_match && !isRealVerticalSwitch) {
    const hasFactHit = scores.some((s) => PER_PROPERTY_FACT_INTENTS.has(s.slug));
    if (!hasFactHit) {
      intent_slug = "list_in_city";
      reasoning.push(`structural: category-only query · routing to list_in_city (category=${slots.property_category})`);
    }
  }
  // Vertical switch ("what about guesthouses" → route back to search-adapter with new category)
  if (isRealVerticalSwitch && !intent_slug) {
    intent_slug = "property_category";  // The composer will interpret this as a re-search request
    reasoning.push("structural: vertical switch → property_category (composer should re-run adapter)");
  }
  // Otherwise pick the top-scored trigger match
  if (!intent_slug && scores.length > 0) {
    intent_slug = scores[0].slug;
    reasoning.push(`token-trigger hit: ${scores[0].slug} (hits=${scores[0].hits})`);
  }

  // Confidence heuristic
  let confidence = 0;
  if (intent_slug) {
    const topScore = scores[0]?.hits ?? 0;
    const runnerUp = scores[1]?.hits ?? 0;
    confidence = Math.min(1, 0.4 + topScore * 0.15 - runnerUp * 0.05);
    if (slots.city) confidence = Math.min(1, confidence + 0.1);
    if (slots.property_category) confidence = Math.min(1, confidence + 0.1);
  }

  const intent = intent_slug ? (INTENT_REGISTRY.find((i) => i.slug === intent_slug) ?? null) : null;

  return {
    intent_slug,
    intent,
    slots,
    confidence: Math.round(confidence * 100) / 100,
    normalised,
    reasoning,
  };
}

// ═══════════════════════════════════════════════════════════════════
// Local helpers
// ═══════════════════════════════════════════════════════════════════

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
