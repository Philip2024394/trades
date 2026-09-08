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
    /** Time filter (tonight/tomorrow) */
    time?: "tonight" | "tomorrow";
    /** Traveller-type filter */
    traveller_type?: "family" | "couples" | "business_traveller" | "backpackers" | "children";
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

// ═══════════════════════════════════════════════════════════════════
// Parser · pure function · zero side effects
// ═══════════════════════════════════════════════════════════════════

const CITIES = new Set(["yogyakarta", "bali", "jakarta", "bandung", "surabaya", "medan", "makassar", "denpasar", "solo", "semarang"]);
const AREAS = new Set(["malioboro"]);
const CATEGORIES = new Set(["hotel", "villa", "guesthouse", "homestay", "hostel", "apartment", "resort", "kos", "penginapan", "wisma", "losmen"]);

export function parseIntent(raw: string): ParsedIntent {
  const normalised = normalise(raw);
  const canonSet = new Set(normalised.canonical_tokens);
  const reasoning: string[] = [];

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

  // Structural override: some patterns are stronger than raw hit count
  let intent_slug: string | null = null;

  // Follow-up "where are they" · "location?" → location_city
  if (slots.is_follow_up_where && !intent_slug) {
    intent_slug = "location_city";
    reasoning.push("structural: follow-up 'where' → location_city");
  }
  // Price question → price_indicative
  if (STRUCTURAL_PATTERNS.price_question.test(normalised.canonical_tokens.join(" ")) && !intent_slug) {
    intent_slug = "price_indicative";
    reasoning.push("structural: price question → price_indicative");
  }
  // Vertical switch ("what about guesthouses" → route back to search-adapter with new category)
  if (slots.is_vertical_switch && !intent_slug && normalised.canonical_tokens.length <= 4) {
    intent_slug = "property_category";  // The composer will interpret this as a re-search request
    reasoning.push("structural: vertical switch → property_category (composer should re-run adapter)");
  }
  // Ordinal reference → property_name (customer wants details about the Nth item)
  if (slots.is_follow_up_ordinal && !intent_slug) {
    intent_slug = "property_name";
    reasoning.push("structural: ordinal reference → property_name (of Nth item in current list)");
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
