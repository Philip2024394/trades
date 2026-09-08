// src/lib/nex/intelligence-storage-grid/accommodation/activity-taxonomy.ts
//
// NEX Accommodation Agent · Activity / Destination Taxonomy (Rule Book v3)
// Founder BEGIN AUTHORIZATION 2026-09-08 · Indonesia Complete Intelligence Mission
//
// This module implements the rule-book upgrade the Founder authorized in the
// 37-section directive. Accommodation is no longer just "properties" — it is
// the anchor from which travellers reach food · drink · nature · culture ·
// walks · activities · attractions · transport (§4 · §5 · §25 · §35).
//
// This file defines the CONTRACT (types · enums · registries · aliases). It
// does NOT collect anything, does NOT wire to chat, does NOT activate any
// worker. Collection · composition · observatory · gap-engine activation are
// deferred to separate Founder BEGINs per §22 · §36 hard-stop discipline.
//
// PRESERVES all prior rule-book work:
//   - Canonical 7-value accommodation category enum (taxonomy.ts §1)
//   - PropertyRecord shape (property-schema.ts §9-§24)
//   - Postgres schema (never modified)
//
// EXTENDS with:
//   - Activity groups (Nature · Outdoor · Culture · Entertainment · Wellness ·
//     Food Experience · Shopping · Nightlife · Transport-Adjacent) per §5
//   - Extensible activity type registry (§5 taxonomy must remain expandable)
//   - Activity information checklist schema per §15
//   - Attraction / Nature-Location / Walk-Trail subtype refinements per §25
//   - Alias resolver (deterministic string → canonical activity slug)
//   - Seasonality categories per §18 (advisory only · never safety inference)
//
// Additive only. Zero modifications to existing files. Composes with
// `nearby-relationship.ts` (§6 · §7 · §25) and `evidence-claims.ts` (§16-§18).

import type {
  CountryCode,
  EvidenceLabel,
  FreshnessState,
  KnowledgeStatus,
  TrustLayer,
} from "../types.js";

// ═══════════════════════════════════════════════════════════════════
// §5 · ACTIVITY GROUPS (top-level taxonomy)
// ═══════════════════════════════════════════════════════════════════

/**
 * Top-level activity grouping. Every activity slug belongs to exactly one
 * group. Groups exist so the response composer can offer coherent bundles
 * (§8 "Nearby / Food / Walks / Nature / Activities / Attractions / Shopping /
 * Transport") without over-specifying.
 *
 * The taxonomy MUST remain expandable (§5 final line). New groups may be
 * added in future revisions; slugs already in production must not be
 * renamed without a compatibility layer.
 */
export type ActivityGroup =
  | "NATURE"           // §5 Nature block · lakes · waterfalls · forests · viewpoints
  | "OUTDOOR"          // §5 Outdoor block · hiking · surfing · diving · cycling
  | "CULTURE"          // §5 Culture block · temples · palaces · museums · heritage
  | "ENTERTAINMENT"    // §5 Entertainment/Leisure block · markets · nightlife · cinema
  | "WELLNESS"         // spa · yoga · retreat · thermal · onsen · massage (subset of Entertainment/Leisure)
  | "FOOD_EXPERIENCE"  // cooking class · food tour · tasting · brewery visit
  | "SHOPPING"         // markets · malls · craft centres · boutique streets
  | "NIGHTLIFE"        // bars · clubs · live music · night market
  | "TRANSPORT_HUB"    // airport · rail · bus · ferry · port · station (§11 interlinking)
  | "SERVICE"          // laundry · atm · pharmacy · post · clinic · hospital · consulate
  | "OTHER";           // catch-all · MUST become a specific group over time

export const ACTIVITY_GROUPS: readonly ActivityGroup[] = Object.freeze([
  "NATURE",
  "OUTDOOR",
  "CULTURE",
  "ENTERTAINMENT",
  "WELLNESS",
  "FOOD_EXPERIENCE",
  "SHOPPING",
  "NIGHTLIFE",
  "TRANSPORT_HUB",
  "SERVICE",
  "OTHER",
]);

// ═══════════════════════════════════════════════════════════════════
// §5 · ACTIVITY TYPE REGISTRY
// ═══════════════════════════════════════════════════════════════════

/**
 * One entry per activity type. Registry is intentionally flat and machine-
 * readable so composers can filter/rank without a giant switch statement.
 *
 * `synonyms` power the alias resolver (§25 relationship layer sometimes
 * ingests messy source labels · "walking route" · "trekking path" ·
 * "jungle trek" · must all normalise to `hiking` when semantics match).
 *
 * `typical_visit_minutes` is INDICATIVE only. It is NOT a claim about a
 * specific location. Never use it to fabricate opening hours or travel
 * budgets in a chat response (§16 · §36).
 *
 * `seasonality_relevance` marks activities where season materially affects
 * usefulness (surf season · migration windows). Actual seasonality claims
 * still require source evidence (§18) — this flag only tells the composer
 * whether to ASK the evidence layer.
 */
export interface ActivityTypeEntry {
  slug: string;
  group: ActivityGroup;
  display_name: string;
  synonyms: readonly string[];
  typical_visit_minutes: { min: number; max: number } | null;
  seasonality_relevance: boolean;
  requires_evidence_note: string | null;
}

// ---- NATURE ----------------------------------------------------------------

const NATURE_ACTIVITIES: readonly ActivityTypeEntry[] = Object.freeze([
  { slug: "lake",             group: "NATURE", display_name: "Lake",
    synonyms: ["danau", "loch", "reservoir"],
    typical_visit_minutes: { min: 30, max: 240 }, seasonality_relevance: false, requires_evidence_note: null },
  { slug: "waterfall",        group: "NATURE", display_name: "Waterfall",
    synonyms: ["air terjun", "cascade", "falls"],
    typical_visit_minutes: { min: 30, max: 180 }, seasonality_relevance: true,
    requires_evidence_note: "Flow varies dramatically with wet/dry season · never claim year-round scenic value without source." },
  { slug: "river",            group: "NATURE", display_name: "River",
    synonyms: ["sungai", "stream", "creek"],
    typical_visit_minutes: null, seasonality_relevance: true, requires_evidence_note: null },
  { slug: "beach",            group: "NATURE", display_name: "Beach",
    synonyms: ["pantai", "shore", "coast"],
    typical_visit_minutes: { min: 60, max: 480 }, seasonality_relevance: true, requires_evidence_note: null },
  { slug: "mountain",         group: "NATURE", display_name: "Mountain",
    synonyms: ["gunung", "peak", "summit"],
    typical_visit_minutes: null, seasonality_relevance: true, requires_evidence_note: null },
  { slug: "volcano",          group: "NATURE", display_name: "Volcano",
    synonyms: ["gunung berapi", "kawah", "crater"],
    typical_visit_minutes: null, seasonality_relevance: true,
    requires_evidence_note: "Active status varies · NEVER infer safety from historic data · always defer to official monitoring." },
  { slug: "forest",           group: "NATURE", display_name: "Forest",
    synonyms: ["hutan", "woodland"],
    typical_visit_minutes: null, seasonality_relevance: false, requires_evidence_note: null },
  { slug: "jungle",           group: "NATURE", display_name: "Jungle",
    synonyms: ["rimba", "rainforest"],
    typical_visit_minutes: null, seasonality_relevance: true, requires_evidence_note: null },
  { slug: "cave",             group: "NATURE", display_name: "Cave",
    synonyms: ["gua", "grotto", "cavern"],
    typical_visit_minutes: { min: 45, max: 180 }, seasonality_relevance: true,
    requires_evidence_note: "Flooding risk in wet season · never claim accessibility without source." },
  { slug: "island",           group: "NATURE", display_name: "Island",
    synonyms: ["pulau", "isle"],
    typical_visit_minutes: null, seasonality_relevance: true, requires_evidence_note: null },
  { slug: "coral_reef",       group: "NATURE", display_name: "Coral Reef",
    synonyms: ["terumbu karang", "reef"],
    typical_visit_minutes: null, seasonality_relevance: true, requires_evidence_note: null },
  { slug: "hot_spring",       group: "NATURE", display_name: "Hot Spring",
    synonyms: ["pemandian air panas", "sumber air panas", "onsen (geological)"],
    typical_visit_minutes: { min: 30, max: 180 }, seasonality_relevance: false, requires_evidence_note: null },
  { slug: "rice_terrace",     group: "NATURE", display_name: "Rice Terrace",
    synonyms: ["sawah bertingkat", "paddy terrace"],
    typical_visit_minutes: { min: 30, max: 180 }, seasonality_relevance: true,
    requires_evidence_note: "Visual appeal varies by planting cycle · never claim year-round green scenery without source." },
  { slug: "viewpoint",        group: "NATURE", display_name: "Viewpoint",
    synonyms: ["titik pandang", "lookout", "observation deck (natural)"],
    typical_visit_minutes: { min: 15, max: 120 }, seasonality_relevance: true, requires_evidence_note: null },
  { slug: "sunrise_location", group: "NATURE", display_name: "Sunrise Location",
    synonyms: ["tempat matahari terbit"],
    typical_visit_minutes: { min: 60, max: 180 }, seasonality_relevance: false,
    requires_evidence_note: "Sunrise time varies by date · use astronomical data · never fabricate." },
  { slug: "sunset_location",  group: "NATURE", display_name: "Sunset Location",
    synonyms: ["tempat matahari terbenam"],
    typical_visit_minutes: { min: 60, max: 180 }, seasonality_relevance: false,
    requires_evidence_note: "Sunset time varies by date · use astronomical data · never fabricate." },
]);

// ---- OUTDOOR ---------------------------------------------------------------

const OUTDOOR_ACTIVITIES: readonly ActivityTypeEntry[] = Object.freeze([
  { slug: "hiking",       group: "OUTDOOR", display_name: "Hiking",
    synonyms: ["hike", "walking route (long)", "trekking (short)", "jalur pendakian"],
    typical_visit_minutes: { min: 60, max: 480 }, seasonality_relevance: true, requires_evidence_note: null },
  { slug: "walking",      group: "OUTDOOR", display_name: "Walking",
    synonyms: ["walking route", "stroll", "jalan santai"],
    typical_visit_minutes: { min: 20, max: 180 }, seasonality_relevance: false, requires_evidence_note: null },
  { slug: "trekking",     group: "OUTDOOR", display_name: "Trekking",
    synonyms: ["multi-day trek", "expedition walk", "trek panjang"],
    typical_visit_minutes: null, seasonality_relevance: true,
    requires_evidence_note: "Multi-day treks require permits/guides in many Indonesian parks · never omit permit info." },
  { slug: "cycling",      group: "OUTDOOR", display_name: "Cycling",
    synonyms: ["bike ride", "bersepeda"],
    typical_visit_minutes: null, seasonality_relevance: false, requires_evidence_note: null },
  { slug: "running",      group: "OUTDOOR", display_name: "Running",
    synonyms: ["jogging", "trail run", "lari"],
    typical_visit_minutes: null, seasonality_relevance: false, requires_evidence_note: null },
  { slug: "swimming",     group: "OUTDOOR", display_name: "Swimming",
    synonyms: ["berenang"],
    typical_visit_minutes: { min: 30, max: 240 }, seasonality_relevance: true, requires_evidence_note: null },
  { slug: "snorkelling",  group: "OUTDOOR", display_name: "Snorkelling",
    synonyms: ["snorkeling", "snorkel"],
    typical_visit_minutes: { min: 60, max: 240 }, seasonality_relevance: true,
    requires_evidence_note: "Visibility/currents vary · never claim conditions without source." },
  { slug: "diving",       group: "OUTDOOR", display_name: "Diving",
    synonyms: ["scuba diving", "menyelam"],
    typical_visit_minutes: null, seasonality_relevance: true,
    requires_evidence_note: "Certification required · visibility/currents vary · never claim safe without source." },
  { slug: "surfing",      group: "OUTDOOR", display_name: "Surfing",
    synonyms: ["surf", "berselancar"],
    typical_visit_minutes: null, seasonality_relevance: true,
    requires_evidence_note: "Wave conditions vary by season/tide · never claim ideal without source." },
  { slug: "fishing",      group: "OUTDOOR", display_name: "Fishing",
    synonyms: ["memancing", "angling"],
    typical_visit_minutes: null, seasonality_relevance: true,
    requires_evidence_note: "Permits often required · check local regulations." },
  { slug: "kayaking",     group: "OUTDOOR", display_name: "Kayaking",
    synonyms: ["kayak"],
    typical_visit_minutes: { min: 60, max: 240 }, seasonality_relevance: true, requires_evidence_note: null },
  { slug: "rafting",      group: "OUTDOOR", display_name: "Rafting",
    synonyms: ["arung jeram", "white water rafting"],
    typical_visit_minutes: { min: 90, max: 240 }, seasonality_relevance: true,
    requires_evidence_note: "River level/grade varies · never claim safe grade without source." },
  { slug: "camping",      group: "OUTDOOR", display_name: "Camping",
    synonyms: ["berkemah"],
    typical_visit_minutes: null, seasonality_relevance: true, requires_evidence_note: null },
  { slug: "horse_riding", group: "OUTDOOR", display_name: "Horse Riding",
    synonyms: ["berkuda", "equestrian"],
    typical_visit_minutes: { min: 30, max: 180 }, seasonality_relevance: false, requires_evidence_note: null },
  { slug: "golf",         group: "OUTDOOR", display_name: "Golf",
    synonyms: ["golfing"],
    typical_visit_minutes: { min: 180, max: 300 }, seasonality_relevance: false, requires_evidence_note: null },
  { slug: "climbing",     group: "OUTDOOR", display_name: "Climbing",
    synonyms: ["rock climbing", "panjat tebing", "bouldering"],
    typical_visit_minutes: null, seasonality_relevance: true, requires_evidence_note: null },
  { slug: "wildlife_watching", group: "OUTDOOR", display_name: "Wildlife Watching",
    synonyms: ["nature watching", "safari (nature)"],
    typical_visit_minutes: null, seasonality_relevance: true,
    requires_evidence_note: "Species presence seasonal · never guarantee sightings." },
  { slug: "bird_watching", group: "OUTDOOR", display_name: "Bird Watching",
    synonyms: ["birding", "pengamatan burung"],
    typical_visit_minutes: null, seasonality_relevance: true,
    requires_evidence_note: "Migration windows apply · never guarantee sightings." },
]);

// ---- CULTURE ---------------------------------------------------------------

const CULTURE_ACTIVITIES: readonly ActivityTypeEntry[] = Object.freeze([
  { slug: "temple",              group: "CULTURE", display_name: "Temple",
    synonyms: ["pura (Balinese)", "candi (Javanese)", "vihara (Buddhist)", "klenteng (Chinese)"],
    typical_visit_minutes: { min: 30, max: 180 }, seasonality_relevance: false,
    requires_evidence_note: "Dress code often required · never omit." },
  { slug: "mosque",              group: "CULTURE", display_name: "Mosque",
    synonyms: ["masjid"],
    typical_visit_minutes: { min: 15, max: 60 }, seasonality_relevance: false,
    requires_evidence_note: "Visiting hours restricted around prayer times · dress code applies." },
  { slug: "church",              group: "CULTURE", display_name: "Church",
    synonyms: ["gereja", "cathedral", "basilica"],
    typical_visit_minutes: { min: 15, max: 90 }, seasonality_relevance: false, requires_evidence_note: null },
  { slug: "palace",              group: "CULTURE", display_name: "Palace",
    synonyms: ["kraton", "istana", "keraton"],
    typical_visit_minutes: { min: 60, max: 180 }, seasonality_relevance: false, requires_evidence_note: null },
  { slug: "museum",              group: "CULTURE", display_name: "Museum",
    synonyms: ["gallery (educational)"],
    typical_visit_minutes: { min: 45, max: 180 }, seasonality_relevance: false, requires_evidence_note: null },
  { slug: "historic_site",       group: "CULTURE", display_name: "Historic Site",
    synonyms: ["heritage site", "ruins", "situs bersejarah"],
    typical_visit_minutes: { min: 60, max: 240 }, seasonality_relevance: false, requires_evidence_note: null },
  { slug: "traditional_village", group: "CULTURE", display_name: "Traditional Village",
    synonyms: ["kampung adat", "desa adat"],
    typical_visit_minutes: { min: 60, max: 240 }, seasonality_relevance: false,
    requires_evidence_note: "Communities are living cultures · never promote intrusive tourism practices." },
  { slug: "cultural_performance", group: "CULTURE", display_name: "Cultural Performance",
    synonyms: ["dance performance", "wayang", "gamelan", "pertunjukan budaya"],
    typical_visit_minutes: { min: 45, max: 180 }, seasonality_relevance: false,
    requires_evidence_note: "Schedules vary · never claim regular showings without source." },
  { slug: "festival",            group: "CULTURE", display_name: "Festival",
    synonyms: ["festival", "perayaan"],
    typical_visit_minutes: null, seasonality_relevance: true,
    requires_evidence_note: "Dates are calendar-specific · always verify year." },
  { slug: "market",              group: "CULTURE", display_name: "Market",
    synonyms: ["pasar", "traditional market", "pasar tradisional"],
    typical_visit_minutes: { min: 30, max: 180 }, seasonality_relevance: false, requires_evidence_note: null },
  { slug: "craft_centre",        group: "CULTURE", display_name: "Craft Centre",
    synonyms: ["pusat kerajinan", "artisan workshop", "craft village"],
    typical_visit_minutes: { min: 30, max: 180 }, seasonality_relevance: false, requires_evidence_note: null },
  { slug: "heritage_area",       group: "CULTURE", display_name: "Heritage Area",
    synonyms: ["kawasan bersejarah", "old town", "kota tua"],
    typical_visit_minutes: { min: 60, max: 240 }, seasonality_relevance: false, requires_evidence_note: null },
]);

// ---- ENTERTAINMENT / LEISURE ----------------------------------------------

const ENTERTAINMENT_ACTIVITIES: readonly ActivityTypeEntry[] = Object.freeze([
  { slug: "night_market",     group: "ENTERTAINMENT", display_name: "Night Market",
    synonyms: ["pasar malam"],
    typical_visit_minutes: { min: 45, max: 180 }, seasonality_relevance: false, requires_evidence_note: null },
  { slug: "cinema",           group: "ENTERTAINMENT", display_name: "Cinema",
    synonyms: ["bioskop", "movie theatre"],
    typical_visit_minutes: { min: 90, max: 180 }, seasonality_relevance: false, requires_evidence_note: null },
  { slug: "entertainment_venue", group: "ENTERTAINMENT", display_name: "Entertainment Venue",
    synonyms: ["theatre", "gedung pertunjukan"],
    typical_visit_minutes: null, seasonality_relevance: false, requires_evidence_note: null },
]);

// ---- WELLNESS -------------------------------------------------------------

const WELLNESS_ACTIVITIES: readonly ActivityTypeEntry[] = Object.freeze([
  { slug: "spa",         group: "WELLNESS", display_name: "Spa",
    synonyms: ["day spa"],
    typical_visit_minutes: { min: 60, max: 180 }, seasonality_relevance: false, requires_evidence_note: null },
  { slug: "wellness_centre", group: "WELLNESS", display_name: "Wellness Centre",
    synonyms: ["yoga studio", "retreat centre", "pusat kesehatan"],
    typical_visit_minutes: null, seasonality_relevance: false, requires_evidence_note: null },
  { slug: "thermal_bath", group: "WELLNESS", display_name: "Thermal Bath",
    synonyms: ["hot spring facility"],
    typical_visit_minutes: { min: 60, max: 180 }, seasonality_relevance: false, requires_evidence_note: null },
]);

// ---- FOOD EXPERIENCE ------------------------------------------------------

const FOOD_EXPERIENCE_ACTIVITIES: readonly ActivityTypeEntry[] = Object.freeze([
  { slug: "cooking_class", group: "FOOD_EXPERIENCE", display_name: "Cooking Class",
    synonyms: ["cooking experience", "kelas memasak"],
    typical_visit_minutes: { min: 120, max: 300 }, seasonality_relevance: false, requires_evidence_note: null },
  { slug: "food_tour",     group: "FOOD_EXPERIENCE", display_name: "Food Tour",
    synonyms: ["culinary tour", "tur kuliner"],
    typical_visit_minutes: { min: 120, max: 240 }, seasonality_relevance: false, requires_evidence_note: null },
  { slug: "tasting_experience", group: "FOOD_EXPERIENCE", display_name: "Tasting Experience",
    synonyms: ["tasting", "coffee tasting", "chocolate tasting"],
    typical_visit_minutes: { min: 45, max: 120 }, seasonality_relevance: false, requires_evidence_note: null },
]);

// ---- SHOPPING -------------------------------------------------------------

const SHOPPING_ACTIVITIES: readonly ActivityTypeEntry[] = Object.freeze([
  { slug: "shopping_mall",    group: "SHOPPING", display_name: "Shopping Mall",
    synonyms: ["mall", "plaza"],
    typical_visit_minutes: null, seasonality_relevance: false, requires_evidence_note: null },
  { slug: "shopping_street",  group: "SHOPPING", display_name: "Shopping Street",
    synonyms: ["shopping district", "high street"],
    typical_visit_minutes: null, seasonality_relevance: false, requires_evidence_note: null },
  { slug: "souvenir_shop",    group: "SHOPPING", display_name: "Souvenir Shop",
    synonyms: ["toko oleh-oleh", "gift shop"],
    typical_visit_minutes: { min: 15, max: 60 }, seasonality_relevance: false, requires_evidence_note: null },
]);

// ---- NIGHTLIFE ------------------------------------------------------------

const NIGHTLIFE_ACTIVITIES: readonly ActivityTypeEntry[] = Object.freeze([
  { slug: "bar",              group: "NIGHTLIFE", display_name: "Bar",
    synonyms: [],
    typical_visit_minutes: null, seasonality_relevance: false, requires_evidence_note: null },
  { slug: "nightclub",        group: "NIGHTLIFE", display_name: "Nightclub",
    synonyms: ["club", "diskotek"],
    typical_visit_minutes: null, seasonality_relevance: false, requires_evidence_note: null },
  { slug: "live_music_venue", group: "NIGHTLIFE", display_name: "Live Music Venue",
    synonyms: ["music bar", "live house"],
    typical_visit_minutes: null, seasonality_relevance: false, requires_evidence_note: null },
]);

// ---- TRANSPORT HUB (§11) --------------------------------------------------

const TRANSPORT_ACTIVITIES: readonly ActivityTypeEntry[] = Object.freeze([
  { slug: "airport",       group: "TRANSPORT_HUB", display_name: "Airport",
    synonyms: ["bandara"],
    typical_visit_minutes: null, seasonality_relevance: false, requires_evidence_note: null },
  { slug: "rail_station",  group: "TRANSPORT_HUB", display_name: "Rail Station",
    synonyms: ["train station", "stasiun kereta"],
    typical_visit_minutes: null, seasonality_relevance: false, requires_evidence_note: null },
  { slug: "bus_station",   group: "TRANSPORT_HUB", display_name: "Bus Station",
    synonyms: ["terminal bus"],
    typical_visit_minutes: null, seasonality_relevance: false, requires_evidence_note: null },
  { slug: "ferry_terminal", group: "TRANSPORT_HUB", display_name: "Ferry Terminal",
    synonyms: ["pelabuhan feri", "port (passenger)"],
    typical_visit_minutes: null, seasonality_relevance: true,
    requires_evidence_note: "Ferry services frequently affected by weather · never claim schedule reliability without source." },
  { slug: "metro_station", group: "TRANSPORT_HUB", display_name: "Metro Station",
    synonyms: ["MRT station", "subway"],
    typical_visit_minutes: null, seasonality_relevance: false, requires_evidence_note: null },
  { slug: "tram_stop",     group: "TRANSPORT_HUB", display_name: "Tram Stop",
    synonyms: ["light rail stop"],
    typical_visit_minutes: null, seasonality_relevance: false, requires_evidence_note: null },
  { slug: "taxi_rank",     group: "TRANSPORT_HUB", display_name: "Taxi Rank",
    synonyms: ["taxi stand", "pangkalan taksi"],
    typical_visit_minutes: null, seasonality_relevance: false, requires_evidence_note: null },
  { slug: "ride_pickup_zone", group: "TRANSPORT_HUB", display_name: "Ride-Share Pickup Zone",
    synonyms: ["Grab pickup", "Gojek pickup"],
    typical_visit_minutes: null, seasonality_relevance: false, requires_evidence_note: null },
  { slug: "parking",       group: "TRANSPORT_HUB", display_name: "Parking",
    synonyms: ["parkir", "car park"],
    typical_visit_minutes: null, seasonality_relevance: false, requires_evidence_note: null },
  { slug: "ev_charging",   group: "TRANSPORT_HUB", display_name: "EV Charging",
    synonyms: ["electric vehicle charger", "SPKLU"],
    typical_visit_minutes: null, seasonality_relevance: false, requires_evidence_note: null },
]);

// ---- SERVICE (useful nearby services) -------------------------------------

const SERVICE_ACTIVITIES: readonly ActivityTypeEntry[] = Object.freeze([
  { slug: "atm",         group: "SERVICE", display_name: "ATM",
    synonyms: [], typical_visit_minutes: null, seasonality_relevance: false, requires_evidence_note: null },
  { slug: "pharmacy",    group: "SERVICE", display_name: "Pharmacy",
    synonyms: ["apotek", "chemist"],
    typical_visit_minutes: null, seasonality_relevance: false, requires_evidence_note: null },
  { slug: "clinic",      group: "SERVICE", display_name: "Clinic",
    synonyms: ["klinik", "walk-in clinic"],
    typical_visit_minutes: null, seasonality_relevance: false,
    requires_evidence_note: "Never promise service availability or emergency capacity." },
  { slug: "hospital",    group: "SERVICE", display_name: "Hospital",
    synonyms: ["rumah sakit"],
    typical_visit_minutes: null, seasonality_relevance: false,
    requires_evidence_note: "Never promise service availability or emergency capacity." },
  { slug: "laundry",     group: "SERVICE", display_name: "Laundry",
    synonyms: ["laundromat", "cuci baju"],
    typical_visit_minutes: null, seasonality_relevance: false, requires_evidence_note: null },
  { slug: "post_office", group: "SERVICE", display_name: "Post Office",
    synonyms: ["kantor pos"],
    typical_visit_minutes: null, seasonality_relevance: false, requires_evidence_note: null },
  { slug: "consulate",   group: "SERVICE", display_name: "Consulate",
    synonyms: ["embassy", "kedutaan", "konsulat"],
    typical_visit_minutes: null, seasonality_relevance: false, requires_evidence_note: null },
]);

// ---- CONSOLIDATED REGISTRY ------------------------------------------------

export const ACTIVITY_TYPES: readonly ActivityTypeEntry[] = Object.freeze([
  ...NATURE_ACTIVITIES,
  ...OUTDOOR_ACTIVITIES,
  ...CULTURE_ACTIVITIES,
  ...ENTERTAINMENT_ACTIVITIES,
  ...WELLNESS_ACTIVITIES,
  ...FOOD_EXPERIENCE_ACTIVITIES,
  ...SHOPPING_ACTIVITIES,
  ...NIGHTLIFE_ACTIVITIES,
  ...TRANSPORT_ACTIVITIES,
  ...SERVICE_ACTIVITIES,
]);

/** All activity slugs, frozen. */
export const ACTIVITY_SLUGS: readonly string[] = Object.freeze(
  ACTIVITY_TYPES.map((a) => a.slug)
);

// ═══════════════════════════════════════════════════════════════════
// §5 · ALIAS INDEX (deterministic string → canonical slug)
// ═══════════════════════════════════════════════════════════════════

/** Lower-cased, trimmed. Same behaviour as taxonomy.ts alias resolver. */
function normaliseAliasKey(input: string): string {
  return input.trim().toLowerCase().replace(/\s+/g, " ");
}

const _ALIAS_INDEX: Map<string, string> = (() => {
  const m = new Map<string, string>();
  for (const a of ACTIVITY_TYPES) {
    m.set(normaliseAliasKey(a.slug), a.slug);
    m.set(normaliseAliasKey(a.display_name), a.slug);
    for (const syn of a.synonyms) m.set(normaliseAliasKey(syn), a.slug);
  }
  return m;
})();

/** Resolve any known label/synonym to a canonical activity slug. Returns null when unknown (§16 UNKNOWN discipline). */
export function resolveActivitySlug(input: string | null | undefined): string | null {
  if (!input) return null;
  const key = normaliseAliasKey(input);
  if (!key) return null;
  return _ALIAS_INDEX.get(key) ?? null;
}

/** Look up an activity type entry by slug. */
export function getActivityType(slug: string): ActivityTypeEntry | null {
  return ACTIVITY_TYPES.find((a) => a.slug === slug) ?? null;
}

/** All activity slugs in a given group. */
export function activitiesInGroup(group: ActivityGroup): readonly ActivityTypeEntry[] {
  return ACTIVITY_TYPES.filter((a) => a.group === group);
}

// ═══════════════════════════════════════════════════════════════════
// §17 · CLAIM SOURCE (re-exported reference · owned by evidence-claims.ts)
// ═══════════════════════════════════════════════════════════════════

/**
 * Every subjective / descriptive claim about an activity MUST carry a
 * ClaimSource tag. Owned by `evidence-claims.ts`; referenced here so this
 * module's schema types can express the constraint. Do NOT redefine.
 */
export type ClaimSource =
  | "SOURCE_DESCRIPTION"   // e.g. tourism board or property description quoted verbatim
  | "OBJECTIVE_ATTRIBUTE"  // measurable · e.g. distance_km · elevation_m
  | "USER_REVIEW_SIGNAL"   // aggregated user reviews · with sample size
  | "NEX_INFERENCE"        // NEX-derived · MUST include reasoning
  | "UNKNOWN";             // no evidence

// ═══════════════════════════════════════════════════════════════════
// §18 · SEASONAL WINDOWS (advisory only · never safety inference)
// ═══════════════════════════════════════════════════════════════════

export type SeasonalKind =
  | "BEST_SEASON"
  | "WET_SEASON_RELEVANT"
  | "DRY_SEASON_RELEVANT"
  | "SEASONAL_CLOSURE"
  | "FESTIVAL_PERIOD"
  | "MIGRATION_WINDOW"
  | "SURF_SEASON"
  | "DIVING_SEASON"
  | "HIKING_SEASON"
  | "WEATHER_ACCESSIBILITY";

/**
 * Seasonal advisory. Months use ISO 1..12 numbering. `notes` is copied
 * verbatim from source (never paraphrased in a way that could imply safety).
 * `source_ref` is required — an empty source_ref MUST NOT be persisted.
 */
export interface SeasonalWindow {
  kind: SeasonalKind;
  months: readonly number[];        // 1..12
  notes: string | null;
  claim_source: ClaimSource;
  source_ref: string | null;        // canonical evidence pointer · required when persisted (§16)
}

// ═══════════════════════════════════════════════════════════════════
// §15 · ACTIVITY INFORMATION CHECKLIST (record schema)
// ═══════════════════════════════════════════════════════════════════

/**
 * Coordinates. Latitude/longitude MUST be null when unknown. NEVER fabricate.
 * `accuracy_m` is meters (source-provided when known · null when unknown).
 */
export interface ActivityCoordinates {
  latitude: number | null;
  longitude: number | null;
  accuracy_m: number | null;
}

/** Free-text description with language tag and claim source discipline. */
export interface ActivityDescription {
  text: string;
  language: string | null;           // ISO 639-1
  claim_source: ClaimSource;
  source_ref: string | null;
}

/**
 * Distance to a reference point (usually a property). Values MUST be either
 * source-provided or deterministically computed (see nearby-relationship.ts
 * Haversine). Never inferred from "same city" alone (§6 · §7).
 */
export interface ActivityDistance {
  reference_kind: "PROPERTY" | "CITY_CENTRE" | "TRANSPORT_HUB" | "OTHER";
  reference_id: string | null;
  straight_line_km: number | null;         // Haversine · deterministic
  walking_km: number | null;               // ONLY when source provides · never fabricated
  driving_km: number | null;               // ONLY when source provides · never fabricated
  walking_minutes: number | null;          // ONLY when source provides · never fabricated
  driving_minutes: number | null;          // ONLY when source provides · never fabricated
  claim_source: ClaimSource;
  source_ref: string | null;
}

/** Cost claim. NEVER assume free by default (§16). Absent = UNKNOWN. */
export interface ActivityCost {
  is_free: boolean | null;                  // null = UNKNOWN · never assume
  price_range: { min: number; max: number; currency: string } | null;
  claim_source: ClaimSource;
  source_ref: string | null;
}

/** Booking requirement. Absent = UNKNOWN. */
export interface ActivityBooking {
  required: boolean | null;                 // null = UNKNOWN
  advance_days: number | null;
  channel: "IN_PERSON" | "PHONE" | "ONLINE" | "GUIDE_ONLY" | "UNKNOWN";
  claim_source: ClaimSource;
  source_ref: string | null;
}

/** Accessibility (physical). Family suitability separate (§15 explicit distinction). */
export interface ActivityAccessibility {
  wheelchair_access: boolean | null;
  stroller_friendly: boolean | null;
  step_count_approx: number | null;
  paved_surface: boolean | null;
  claim_source: ClaimSource;
  source_ref: string | null;
}

/** Family suitability. Only set when EXPLICITLY established (§15). Never inferred. */
export interface ActivityFamilySuitability {
  suitable_for_children: boolean | null;    // null = not explicitly established
  minimum_age: number | null;
  child_facilities: readonly string[];      // e.g. ["stroller_rental", "changing_room"]
  claim_source: ClaimSource;
  source_ref: string | null;
}

/**
 * Complete Activity record. Every field with claim potential carries its own
 * claim_source + source_ref. Missing evidence → null (§16 UNKNOWN discipline).
 */
export interface ActivityRecord {
  // Identity
  canonical_activity_id: string;                // internal uuid or #ACT-YYYY-XXXXX
  public_ref: string;                           // #ACT-YYYY-XXXXX
  name: string;
  original_name: string | null;
  original_language: string | null;
  activity_type_slug: string;                   // one of ACTIVITY_SLUGS
  activity_group: ActivityGroup;                // derived · MUST match slug's group

  // Description
  description: ActivityDescription | null;

  // Location
  coordinates: ActivityCoordinates;
  country_code: CountryCode;
  region: string | null;
  city: string | null;                          // may be null when activity is outside a city (§7)
  district: string | null;
  outside_city_boundary: boolean;               // §7 flag · TRUE means "reachable but not in city"

  // Distance (multiple references possible)
  distances: readonly ActivityDistance[];

  // Practical
  cost: ActivityCost;
  booking: ActivityBooking;
  accessibility: ActivityAccessibility;
  family_suitability: ActivityFamilySuitability;

  // Time
  opening_windows: readonly {
    days: readonly string[];                    // ["mon","tue",...]
    open: string;                               // "HH:MM"
    close: string;                              // "HH:MM"
    claim_source: ClaimSource;
    source_ref: string | null;
  }[];
  seasonal_windows: readonly SeasonalWindow[];

  // Images (referenced · NEVER copied unless licensed §12)
  image_refs: readonly {
    image_ref: string;                          // stable pointer · own-store or licensed source
    classification: string;                     // see property-schema.ImageClassification (broader here)
    provenance: {
      source: string;
      licence: string | null;
      captured_at: string | null;
    };
  }[];

  // Provenance + status
  first_seen_at: string;                        // ISO 8601
  last_verified_at: string | null;              // ISO 8601 · null = never verified
  freshness: FreshnessState;
  knowledge_status: KnowledgeStatus;
  trust_layer: TrustLayer;
  evidence_label: EvidenceLabel;
  source_records: readonly { source: string; retrieved_at: string; source_ref: string }[];
}

// ═══════════════════════════════════════════════════════════════════
// §5 · STATS + INVARIANTS
// ═══════════════════════════════════════════════════════════════════

/** Enforce that every registry entry has a valid group + unique slug. Called in tests. */
export function assertActivityRegistryInvariants(): void {
  const seen = new Set<string>();
  for (const a of ACTIVITY_TYPES) {
    if (seen.has(a.slug)) throw new Error(`activity-taxonomy: duplicate slug "${a.slug}"`);
    seen.add(a.slug);
    if (!ACTIVITY_GROUPS.includes(a.group)) throw new Error(`activity-taxonomy: invalid group "${a.group}" on slug "${a.slug}"`);
    if (!a.display_name || a.display_name.trim() === "") throw new Error(`activity-taxonomy: missing display_name for slug "${a.slug}"`);
    if (a.typical_visit_minutes) {
      if (a.typical_visit_minutes.min > a.typical_visit_minutes.max) {
        throw new Error(`activity-taxonomy: typical_visit_minutes.min > max for slug "${a.slug}"`);
      }
    }
  }
}

/** Registry summary. Useful for observability + tests. */
export function activityRegistryStats(): {
  total_types: number;
  by_group: Record<ActivityGroup, number>;
  types_with_seasonality: number;
  types_with_evidence_note: number;
  total_aliases: number;
} {
  const byGroup: Record<string, number> = {};
  for (const g of ACTIVITY_GROUPS) byGroup[g] = 0;
  let seasonal = 0;
  let evidenceNote = 0;
  for (const a of ACTIVITY_TYPES) {
    byGroup[a.group]++;
    if (a.seasonality_relevance) seasonal++;
    if (a.requires_evidence_note) evidenceNote++;
  }
  return {
    total_types: ACTIVITY_TYPES.length,
    by_group: byGroup as Record<ActivityGroup, number>,
    types_with_seasonality: seasonal,
    types_with_evidence_note: evidenceNote,
    total_aliases: _ALIAS_INDEX.size,
  };
}
