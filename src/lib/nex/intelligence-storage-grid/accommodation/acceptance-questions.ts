// src/lib/nex/intelligence-storage-grid/accommodation/acceptance-questions.ts
//
// NEX Accommodation Agent · Rule-Book Acceptance Question Corpus
// Founder BEGIN 2026-09-08 · Global Accommodation Intelligence Rule Book Upgrade
//
// Implements:
//   §25 Questions the Accommodation Agent MUST be able to answer
//   §40 Final acceptance test (Property · Type · Country · Room · Beds ·
//        Occupancy · Facilities · Services · Food · Breakfast · Images ·
//        Policies · Location · Nearby · Relationships · Evidence · Freshness
//        · Unknowns)
//   §41 Founder success condition (traveller-question coverage · UNKNOWN
//        where evidence unavailable)
//
// This module is a MACHINE-READABLE CORPUS: each question is linked to the
// specific schema field(s) that must be populated for the agent to answer it
// honestly. It is used by:
//   1. Acceptance tests (does every §25 question map to a populated field?)
//   2. §29 living-document feedback loop (new questions land here)
//   3. Composition/gap-engine prioritisation (unanswered common questions
//      elevate research priority)
//
// It does NOT itself answer questions. It only defines the CONTRACT.
//
// Additive. Zero DDL. Zero modification of existing files.

// ═══════════════════════════════════════════════════════════════════
// §40 · CORPUS QUESTION SHAPE
// ═══════════════════════════════════════════════════════════════════

/**
 * A single acceptance question the Accommodation Agent must be able to
 * answer honestly. `answering_fields` names the property-schema paths
 * that must be populated (any one of them) for the answer to be truthful.
 *
 * When ALL answering_fields are unpopulated, the honest answer is
 * "UNKNOWN — evidence not yet collected". NEVER fabricated (§30 · §41).
 */
export interface AcceptanceQuestion {
  slug: string;
  founder_text: string;                   // verbatim from §25
  language: "en";
  category: AcceptanceCategory;           // §40 grouping
  /** Property-schema field paths (any one populated → question is answerable). */
  answering_fields: readonly string[];
  /** True when this question is COMPARISON-class (needs ≥2 properties). */
  is_comparison: boolean;
  /** True when the question requires media-scope evidence (images). */
  requires_images: boolean;
  /** True when the question requires cross-domain data (Food · Transport etc.). */
  requires_cross_domain: boolean;
  /** True when the question requires structured room/bed inventory (§12). */
  requires_room_intelligence: boolean;
  /** Founder-directive section that mandates this question. */
  founder_section: number;
}

export type AcceptanceCategory =
  | "PROPERTY_LOOKUP"          // §40 · what is the property?
  | "TYPE"                     // §40 · what kind of accommodation?
  | "COUNTRY"                  // §40 · what does this country call it?
  | "ROOM"                     // §40 · what rooms/units exist?
  | "BEDS"                     // §40 · what beds exist?
  | "OCCUPANCY"                // §40 · how many people?
  | "FACILITIES"               // §40 · what does the property have?
  | "SERVICES"                 // §40 · what does it provide?
  | "FOOD"                     // §40 · what food/drink exists?
  | "BREAKFAST"                // §40 · what type and conditions?
  | "IMAGES"                   // §40 · what images exist?
  | "POLICIES"                 // §40 · what rules?
  | "LOCATION"                 // §40 · where is it?
  | "NEARBY"                   // §40 · what is around?
  | "RELATIONSHIPS"            // §40 · connections to other NEX domains
  | "EVIDENCE"                 // §40 · why NEX believes
  | "FRESHNESS"                // §40 · how current
  | "UNKNOWNS"                 // §40 · what NEX still doesn't know
  | "COMPARISON";              // §25 · compare two hotels

export const ACCEPTANCE_CATEGORIES: readonly AcceptanceCategory[] = Object.freeze([
  "PROPERTY_LOOKUP","TYPE","COUNTRY","ROOM","BEDS","OCCUPANCY","FACILITIES","SERVICES",
  "FOOD","BREAKFAST","IMAGES","POLICIES","LOCATION","NEARBY","RELATIONSHIPS","EVIDENCE",
  "FRESHNESS","UNKNOWNS","COMPARISON",
]);

// ═══════════════════════════════════════════════════════════════════
// §25 · CORPUS (every question Founder listed · verbatim)
// ═══════════════════════════════════════════════════════════════════

export const ACCEPTANCE_QUESTIONS: readonly AcceptanceQuestion[] = Object.freeze([
  // LOCATION / PROPERTY_LOOKUP
  { slug: "hotels_near_malioboro", founder_text: "What hotels are near Malioboro?", language: "en", category: "NEARBY",
    answering_fields: ["location.city", "location.latitude", "location.longitude"], is_comparison: false, requires_images: false, requires_cross_domain: false, requires_room_intelligence: false, founder_section: 25 },

  // FACILITIES
  { slug: "which_hotel_has_pool", founder_text: "Which hotel has a pool?", language: "en", category: "FACILITIES",
    answering_fields: ["facilities.swimming_pool", "facilities.indoor_pool", "facilities.outdoor_pool", "facilities.private_pool"], is_comparison: false, requires_images: false, requires_cross_domain: false, requires_room_intelligence: false, founder_section: 25 },
  { slug: "hotel_has_gym", founder_text: "Does it have a gym?", language: "en", category: "FACILITIES",
    answering_fields: ["facilities.gym", "facilities.fitness_centre"], is_comparison: false, requires_images: false, requires_cross_domain: false, requires_room_intelligence: false, founder_section: 25 },
  { slug: "hotel_has_spa", founder_text: "Does it have a spa?", language: "en", category: "FACILITIES",
    answering_fields: ["facilities.spa"], is_comparison: false, requires_images: false, requires_cross_domain: false, requires_room_intelligence: false, founder_section: 25 },
  { slug: "hotel_has_restaurant", founder_text: "Does it have a restaurant?", language: "en", category: "FACILITIES",
    answering_fields: ["facilities.restaurant", "facilities.restaurants_multi", "food_and_drink.has_restaurant"], is_comparison: false, requires_images: false, requires_cross_domain: false, requires_room_intelligence: false, founder_section: 25 },
  { slug: "hotel_has_bar", founder_text: "Is there a bar?", language: "en", category: "FACILITIES",
    answering_fields: ["facilities.bar", "facilities.rooftop_bar", "food_and_drink.has_bar"], is_comparison: false, requires_images: false, requires_cross_domain: false, requires_room_intelligence: false, founder_section: 25 },
  { slug: "hotel_has_parking", founder_text: "Does it have parking?", language: "en", category: "FACILITIES",
    answering_fields: ["facilities.parking", "facilities.private_parking", "facilities.valet_parking"], is_comparison: false, requires_images: false, requires_cross_domain: false, requires_room_intelligence: false, founder_section: 25 },
  { slug: "hotel_has_ev_charging", founder_text: "Does it have EV charging?", language: "en", category: "FACILITIES",
    answering_fields: ["facilities.ev_charging"], is_comparison: false, requires_images: false, requires_cross_domain: false, requires_room_intelligence: false, founder_section: 25 },

  // ROOM / BEDS / OCCUPANCY
  { slug: "hotel_has_family_room", founder_text: "Does it have a family room?", language: "en", category: "ROOM",
    answering_fields: ["policies.children_policy.family_rooms_available", "rooms[].room_category"], is_comparison: false, requires_images: false, requires_cross_domain: false, requires_room_intelligence: true, founder_section: 25 },
  { slug: "room_has_kitchen", founder_text: "Does it have a kitchen?", language: "en", category: "ROOM",
    answering_fields: ["rooms[].has_kitchen", "rooms[].has_kitchenette", "rooms[].has_cooking_facilities"], is_comparison: false, requires_images: false, requires_cross_domain: false, requires_room_intelligence: true, founder_section: 25 },
  { slug: "room_has_balcony", founder_text: "Does it have a balcony?", language: "en", category: "ROOM",
    answering_fields: ["rooms[].has_balcony", "rooms[].has_terrace", "rooms[].has_patio"], is_comparison: false, requires_images: false, requires_cross_domain: false, requires_room_intelligence: true, founder_section: 25 },
  { slug: "room_has_air_conditioning", founder_text: "Does it have air conditioning?", language: "en", category: "ROOM",
    answering_fields: ["rooms[].has_air_conditioning", "facilities.air_conditioning"], is_comparison: false, requires_images: false, requires_cross_domain: false, requires_room_intelligence: false, founder_section: 25 },
  { slug: "room_bed_count", founder_text: "Does the room have one bed or two?", language: "en", category: "BEDS",
    answering_fields: ["rooms[].bed_configurations", "rooms[].total_beds"], is_comparison: false, requires_images: false, requires_cross_domain: false, requires_room_intelligence: true, founder_section: 25 },
  { slug: "room_bed_size", founder_text: "What size is the bed?", language: "en", category: "BEDS",
    answering_fields: ["rooms[].bed_configurations[].bed_type"], is_comparison: false, requires_images: false, requires_cross_domain: false, requires_room_intelligence: true, founder_section: 25 },
  { slug: "can_four_people_stay", founder_text: "Can four people stay?", language: "en", category: "OCCUPANCY",
    answering_fields: ["rooms[].maximum_occupancy", "rooms[].adult_capacity", "rooms[].child_capacity"], is_comparison: false, requires_images: false, requires_cross_domain: false, requires_room_intelligence: true, founder_section: 25 },
  { slug: "cot_available", founder_text: "Does it have a cot?", language: "en", category: "OCCUPANCY",
    answering_fields: ["policies.children_policy.crib_available", "rooms[].bed_configurations[].crib_cot_available"], is_comparison: false, requires_images: false, requires_cross_domain: false, requires_room_intelligence: true, founder_section: 25 },
  { slug: "extra_bed_available", founder_text: "Can I add an extra bed?", language: "en", category: "OCCUPANCY",
    answering_fields: ["policies.children_policy.extra_bed_available", "rooms[].bed_configurations[].extra_bed_available", "policies.extra_bed_policy"], is_comparison: false, requires_images: false, requires_cross_domain: false, requires_room_intelligence: true, founder_section: 25 },

  // FOOD / BREAKFAST
  { slug: "hotel_has_breakfast", founder_text: "Does this hotel have breakfast?", language: "en", category: "BREAKFAST",
    answering_fields: ["food_and_drink.breakfast.kind"], is_comparison: false, requires_images: false, requires_cross_domain: false, requires_room_intelligence: false, founder_section: 25 },
  { slug: "breakfast_included", founder_text: "Is breakfast included?", language: "en", category: "BREAKFAST",
    answering_fields: ["food_and_drink.breakfast.included_in_rate", "food_and_drink.breakfast.kind"], is_comparison: false, requires_images: false, requires_cross_domain: false, requires_room_intelligence: false, founder_section: 25 },
  { slug: "breakfast_kind", founder_text: "What kind of breakfast?", language: "en", category: "BREAKFAST",
    answering_fields: ["food_and_drink.breakfast.kind"], is_comparison: false, requires_images: false, requires_cross_domain: false, requires_room_intelligence: false, founder_section: 25 },
  { slug: "hotel_food_cuisine", founder_text: "What cuisine?", language: "en", category: "FOOD",
    answering_fields: ["food_and_drink.restaurant_cuisines"], is_comparison: false, requires_images: false, requires_cross_domain: false, requires_room_intelligence: false, founder_section: 25 },
  { slug: "hotel_room_service", founder_text: "Does it have room service?", language: "en", category: "SERVICES",
    answering_fields: ["facilities.room_service", "food_and_drink.has_room_service", "services.room_service"], is_comparison: false, requires_images: false, requires_cross_domain: false, requires_room_intelligence: false, founder_section: 25 },

  // POLICIES
  { slug: "check_in_time", founder_text: "What time is check-in?", language: "en", category: "POLICIES",
    answering_fields: ["policies.check_in_time"], is_comparison: false, requires_images: false, requires_cross_domain: false, requires_room_intelligence: false, founder_section: 25 },
  { slug: "check_out_time", founder_text: "What time is check-out?", language: "en", category: "POLICIES",
    answering_fields: ["policies.check_out_time"], is_comparison: false, requires_images: false, requires_cross_domain: false, requires_room_intelligence: false, founder_section: 25 },
  { slug: "pets_allowed", founder_text: "Are pets allowed?", language: "en", category: "POLICIES",
    answering_fields: ["policies.pet_policy.pets_allowed"], is_comparison: false, requires_images: false, requires_cross_domain: false, requires_room_intelligence: false, founder_section: 25 },
  { slug: "children_allowed", founder_text: "Are children allowed?", language: "en", category: "POLICIES",
    answering_fields: ["policies.children_policy.children_allowed"], is_comparison: false, requires_images: false, requires_cross_domain: false, requires_room_intelligence: false, founder_section: 25 },
  { slug: "wheelchair_accessible", founder_text: "Is it wheelchair accessible?", language: "en", category: "POLICIES",
    answering_fields: ["accessibility.wheelchair_access", "accessibility.accessible_entrance"], is_comparison: false, requires_images: false, requires_cross_domain: false, requires_room_intelligence: false, founder_section: 25 },

  // SERVICES / TRANSPORT
  { slug: "airport_transfer_available", founder_text: "Is there airport transfer?", language: "en", category: "SERVICES",
    answering_fields: ["facilities.airport_transfer", "facilities.airport_shuttle", "services.airport_transfer", "services.shuttle"], is_comparison: false, requires_images: false, requires_cross_domain: false, requires_room_intelligence: false, founder_section: 25 },
  { slug: "airport_distance", founder_text: "How far is it from the airport?", language: "en", category: "LOCATION",
    answering_fields: ["location.airport_distance_km"], is_comparison: false, requires_images: false, requires_cross_domain: true, requires_room_intelligence: false, founder_section: 25 },
  { slug: "station_distance", founder_text: "How far is it from the station?", language: "en", category: "LOCATION",
    answering_fields: ["location.station_distance_km"], is_comparison: false, requires_images: false, requires_cross_domain: true, requires_room_intelligence: false, founder_section: 25 },

  // NEARBY
  { slug: "what_is_nearby", founder_text: "What is nearby?", language: "en", category: "NEARBY",
    answering_fields: ["nearby[]"], is_comparison: false, requires_images: false, requires_cross_domain: true, requires_room_intelligence: false, founder_section: 25 },
  { slug: "restaurants_nearby", founder_text: "What restaurants are nearby?", language: "en", category: "NEARBY",
    answering_fields: ["nearby[].category=restaurant"], is_comparison: false, requires_images: false, requires_cross_domain: true, requires_room_intelligence: false, founder_section: 25 },
  { slug: "japanese_restaurants_nearby", founder_text: "What Japanese restaurants are nearby?", language: "en", category: "NEARBY",
    answering_fields: ["nearby[].category=restaurant + food_domain_cuisine=japanese"], is_comparison: false, requires_images: false, requires_cross_domain: true, requires_room_intelligence: false, founder_section: 25 },
  { slug: "cafes_nearby", founder_text: "What cafés are nearby?", language: "en", category: "NEARBY",
    answering_fields: ["nearby[].category=cafe"], is_comparison: false, requires_images: false, requires_cross_domain: true, requires_room_intelligence: false, founder_section: 25 },
  { slug: "attractions_nearby", founder_text: "What attractions are nearby?", language: "en", category: "NEARBY",
    answering_fields: ["nearby[].category=attraction"], is_comparison: false, requires_images: false, requires_cross_domain: true, requires_room_intelligence: false, founder_section: 25 },

  // ROOM / IMAGES
  { slug: "which_rooms", founder_text: "What rooms does it have?", language: "en", category: "ROOM",
    answering_fields: ["rooms[]"], is_comparison: false, requires_images: false, requires_cross_domain: false, requires_room_intelligence: true, founder_section: 25 },
  { slug: "show_rooms", founder_text: "Show me the rooms.", language: "en", category: "IMAGES",
    answering_fields: ["images[].scope=ROOM_SPECIFIC", "images[].classification=ROOM"], is_comparison: false, requires_images: true, requires_cross_domain: false, requires_room_intelligence: true, founder_section: 25 },
  { slug: "show_pool", founder_text: "Show me the pool.", language: "en", category: "IMAGES",
    answering_fields: ["images[].classification=POOL"], is_comparison: false, requires_images: true, requires_cross_domain: false, requires_room_intelligence: false, founder_section: 25 },
  { slug: "show_restaurant", founder_text: "Show me the restaurant.", language: "en", category: "IMAGES",
    answering_fields: ["images[].classification=RESTAURANT"], is_comparison: false, requires_images: true, requires_cross_domain: false, requires_room_intelligence: false, founder_section: 25 },
  { slug: "show_exterior", founder_text: "Show me the exterior.", language: "en", category: "IMAGES",
    answering_fields: ["images[].classification=PROPERTY_EXTERIOR"], is_comparison: false, requires_images: true, requires_cross_domain: false, requires_room_intelligence: false, founder_section: 25 },
  { slug: "show_best_room", founder_text: "Show me the best room.", language: "en", category: "IMAGES",
    answering_fields: ["rooms[].room_category", "images[].scope=ROOM_SPECIFIC"], is_comparison: false, requires_images: true, requires_cross_domain: false, requires_room_intelligence: true, founder_section: 25 },

  // COMPARISON
  { slug: "compare_two_hotels", founder_text: "Compare two hotels.", language: "en", category: "COMPARISON",
    answering_fields: ["identity", "facilities", "food_and_drink", "policies", "location", "nearby"], is_comparison: true, requires_images: false, requires_cross_domain: false, requires_room_intelligence: false, founder_section: 25 },
  { slug: "which_is_closer", founder_text: "Which is closer?", language: "en", category: "COMPARISON",
    answering_fields: ["location.latitude", "location.longitude"], is_comparison: true, requires_images: false, requires_cross_domain: false, requires_room_intelligence: false, founder_section: 25 },
  { slug: "which_has_pool", founder_text: "Which has a pool?", language: "en", category: "COMPARISON",
    answering_fields: ["facilities.swimming_pool"], is_comparison: true, requires_images: false, requires_cross_domain: false, requires_room_intelligence: false, founder_section: 25 },
  { slug: "which_has_breakfast", founder_text: "Which has breakfast?", language: "en", category: "COMPARISON",
    answering_fields: ["food_and_drink.breakfast.kind"], is_comparison: true, requires_images: false, requires_cross_domain: false, requires_room_intelligence: false, founder_section: 25 },
  { slug: "which_has_family_rooms", founder_text: "Which has family rooms?", language: "en", category: "COMPARISON",
    answering_fields: ["policies.children_policy.family_rooms_available"], is_comparison: true, requires_images: false, requires_cross_domain: false, requires_room_intelligence: true, founder_section: 25 },
  { slug: "which_has_better_nearby_food", founder_text: "Which has better nearby food options?", language: "en", category: "COMPARISON",
    answering_fields: ["nearby[].category=restaurant"], is_comparison: true, requires_images: false, requires_cross_domain: true, requires_room_intelligence: false, founder_section: 25 },
  { slug: "which_has_more_facilities", founder_text: "Which has more facilities?", language: "en", category: "COMPARISON",
    answering_fields: ["facilities[]"], is_comparison: true, requires_images: false, requires_cross_domain: false, requires_room_intelligence: false, founder_section: 25 },
  { slug: "which_has_more_evidence", founder_text: "Which has more evidence?", language: "en", category: "EVIDENCE",
    answering_fields: ["evidence.total_evidence_refs", "evidence.verified_field_count"], is_comparison: true, requires_images: false, requires_cross_domain: false, requires_room_intelligence: false, founder_section: 25 },

  // EVIDENCE / FRESHNESS / UNKNOWNS
  { slug: "which_information_is_uncertain", founder_text: "Which information is uncertain?", language: "en", category: "EVIDENCE",
    answering_fields: ["evidence.unverified_field_count", "evidence.conflicting_field_count"], is_comparison: false, requires_images: false, requires_cross_domain: false, requires_room_intelligence: false, founder_section: 25 },
  { slug: "what_has_changed_recently", founder_text: "What has changed recently?", language: "en", category: "FRESHNESS",
    answering_fields: ["freshness.last_full_refresh_iso", "freshness.oldest_field_written_at_iso"], is_comparison: false, requires_images: false, requires_cross_domain: false, requires_room_intelligence: false, founder_section: 25 },
]);

// ═══════════════════════════════════════════════════════════════════
// §40 · ACCEPTANCE TEST WIRING
// ═══════════════════════════════════════════════════════════════════

/**
 * The 18 §40 acceptance topics. Each maps to a corpus category. This function
 * returns the set of questions covering each topic — used by tests to prove
 * every §40 topic has at least one canonical question wired to schema fields.
 */
export const FOUNDER_40_TOPICS: readonly {
  topic: string;
  category: AcceptanceCategory;
}[] = Object.freeze([
  { topic: "Property",      category: "PROPERTY_LOOKUP" },
  { topic: "Type",          category: "TYPE" },
  { topic: "Country",       category: "COUNTRY" },
  { topic: "Room",          category: "ROOM" },
  { topic: "Beds",          category: "BEDS" },
  { topic: "Occupancy",     category: "OCCUPANCY" },
  { topic: "Facilities",    category: "FACILITIES" },
  { topic: "Services",      category: "SERVICES" },
  { topic: "Food",          category: "FOOD" },
  { topic: "Breakfast",     category: "BREAKFAST" },
  { topic: "Images",        category: "IMAGES" },
  { topic: "Policies",      category: "POLICIES" },
  { topic: "Location",      category: "LOCATION" },
  { topic: "Nearby",        category: "NEARBY" },
  { topic: "Relationships", category: "RELATIONSHIPS" },
  { topic: "Evidence",      category: "EVIDENCE" },
  { topic: "Freshness",     category: "FRESHNESS" },
  { topic: "Unknowns",      category: "UNKNOWNS" },
]);

// ═══════════════════════════════════════════════════════════════════
// HELPERS + STATS
// ═══════════════════════════════════════════════════════════════════

export function questionsForCategory(category: AcceptanceCategory): readonly AcceptanceQuestion[] {
  return ACCEPTANCE_QUESTIONS.filter((q) => q.category === category);
}

export function questionBySlug(slug: string): AcceptanceQuestion | null {
  return ACCEPTANCE_QUESTIONS.find((q) => q.slug === slug) ?? null;
}

/**
 * §40 topic-coverage check. Returns per-topic whether at least one question
 * exists in the corpus for that topic. Topics with zero coverage are the
 * gaps that must be filled before §40 GREEN.
 */
export function founder40TopicCoverage(): readonly { topic: string; category: AcceptanceCategory; question_count: number }[] {
  return FOUNDER_40_TOPICS.map((t) => ({
    topic: t.topic,
    category: t.category,
    question_count: questionsForCategory(t.category).length,
  }));
}

/** Registry summary for observatory + tests. */
export function acceptanceQuestionRegistryStats(): {
  total_questions: number;
  by_category: Record<AcceptanceCategory, number>;
  comparison_questions: number;
  image_questions: number;
  cross_domain_questions: number;
  room_intelligence_questions: number;
  founder_40_topics_covered: number;
  founder_40_topics_uncovered: readonly string[];
} {
  const byCategory: Record<string, number> = {};
  for (const c of ACCEPTANCE_CATEGORIES) byCategory[c] = 0;
  let comp = 0, img = 0, xdom = 0, room = 0;
  for (const q of ACCEPTANCE_QUESTIONS) {
    byCategory[q.category]++;
    if (q.is_comparison) comp++;
    if (q.requires_images) img++;
    if (q.requires_cross_domain) xdom++;
    if (q.requires_room_intelligence) room++;
  }
  const coverage = founder40TopicCoverage();
  const covered = coverage.filter((c) => c.question_count > 0).length;
  const uncovered = coverage.filter((c) => c.question_count === 0).map((c) => c.topic);
  return {
    total_questions: ACCEPTANCE_QUESTIONS.length,
    by_category: byCategory as Record<AcceptanceCategory, number>,
    comparison_questions: comp,
    image_questions: img,
    cross_domain_questions: xdom,
    room_intelligence_questions: room,
    founder_40_topics_covered: covered,
    founder_40_topics_uncovered: uncovered,
  };
}
