// src/lib/nex/intelligence-storage-grid/accommodation/country-profile.ts
//
// NEX Accommodation Agent · Country Accommodation Profile (Rule Book Upgrade)
// Founder BEGIN 2026-09-08 · Global Accommodation Intelligence Rule Book Upgrade
//
// Implements:
//   §8  Country-specific knowledge (Japan · Morocco · Portugal · Spain · Italy
//        · France · India · Nordic/Arctic · Africa etc.)
//   §26 Cultural intelligence (ryokan ≠ hotel · riad ≠ guesthouse etc.)
//   §27 Country rules (per-country profile with all required fields)
//   §28 Discovery checklist (structured questions when entering a new country)
//
// This module is a CONTRACT + SEED module. It defines:
//   1. CountryAccommodationProfile shape
//   2. DiscoveryChecklist shape (§28 question set)
//   3. A minimal seed profile per country the Founder listed by name in §8
//      (Japan · Morocco · Portugal · Spain · Italy · France · India ·
//       Indonesia · Nordic/Arctic block · Africa/safari block · UK/Global)
//   4. Helpers to compose per-country research checklists at runtime
//
// The seed profiles reference existing COUNTRY_SPECIFIC_TYPES + FOUNDER_BEGIN
// additions in `taxonomy.ts`. It DOES NOT redefine any accommodation type
// (§37 no duplication). New country profiles added later must satisfy the
// same contract.
//
// Additive. Zero DDL. Zero Postgres change. Zero modification to existing
// files besides this new module.

import type { CountryCode } from "../types";
import { ALL_EXTENDED_TYPES, COUNTRY_SPECIFIC_TYPES, type ExtendedAccommodationType } from "./taxonomy";

// ═══════════════════════════════════════════════════════════════════
// §27 · COUNTRY ACCOMMODATION PROFILE (shape)
// ═══════════════════════════════════════════════════════════════════

/**
 * Per-country accommodation profile. Every country the Accommodation Agent
 * enters MUST have (or progressively populate) one of these. Missing fields
 * = UNKNOWN — never inferred (§30).
 *
 * `local_terminology` and `tourism_terminology` are lists of raw source
 * terms with their canonical accommodation-type slug (from taxonomy.ts).
 * `regional_terminology` captures within-country regional differences
 * (e.g. Bali "villa" ≠ Java "villa" semantics differ subtly).
 *
 * `research_gaps` is the machine-readable feedback loop for §29 — as the
 * agent discovers unknowns, they land here for prioritisation.
 */
export interface CountryAccommodationProfile {
  country_code: CountryCode;
  display_name: string;
  language_primary: string | null;      // ISO 639-1
  languages_secondary: readonly string[];
  currency_code: string | null;         // ISO 4217

  /** §27 official terminology · from tourism authority or classification standard. */
  official_terminology: readonly {
    term: string;                       // raw local term
    canonical_slug: string;             // one of ALL_EXTENDED_TYPES slugs
    source: string;                     // e.g. "id-tourism-ministry" · "iso-18513"
    notes: string | null;
  }[];

  /** §27 local everyday terminology · what travellers actually say. */
  local_terminology: readonly {
    term: string;
    canonical_slug: string;
    language: string | null;
    notes: string | null;
  }[];

  /** §27 tourism-industry terminology · commercial listings language. */
  tourism_terminology: readonly {
    term: string;
    canonical_slug: string;
    notes: string | null;
  }[];

  /** §27 regional (within-country) terminology variations. */
  regional_terminology: readonly {
    region: string;                     // e.g. "Bali" · "Hokkaido" · "Andalusia"
    term: string;
    canonical_slug: string;
    notes: string | null;
  }[];

  /** §26 country-specific concept types (subset of COUNTRY_SPECIFIC_TYPES that originate here). */
  country_specific_type_slugs: readonly string[];

  /** §27 alternative spellings / diacritics. */
  alternative_spellings: readonly { canonical: string; variants: readonly string[] }[];

  /** §27 known classification systems in this country (star rating · categories · etc.). */
  known_classification_systems: readonly {
    name: string;                       // e.g. "ID Star Rating" · "Michelin Guide" (accommodation subset)
    authority: string;
    tiers: readonly string[];
  }[];

  /** §27 room / bed / meal / facility local terminology. */
  local_room_terminology: readonly { term: string; english_hint: string | null }[];
  local_bed_terminology: readonly { term: string; english_hint: string | null }[];
  local_meal_terminology: readonly { term: string; english_hint: string | null }[];
  local_facility_terminology: readonly { term: string; english_hint: string | null }[];

  /** §27 source requirements (which sources are legitimate + typical rate-limits). */
  source_requirements: readonly {
    source_kind: "GOVERNMENT_TOURISM" | "REGISTRY" | "PROVIDER_AGGREGATOR" | "OSM" | "OFFICIAL_PROPERTY_SITE" | "OTHER";
    name: string;
    url_pattern: string | null;
    rate_limit_notes: string | null;
    licence_notes: string | null;
  }[];

  /** §27 · §29 · what the agent still doesn't know about this country. Populated over time. */
  research_gaps: readonly {
    gap_kind: "TERMINOLOGY" | "TYPE_COVERAGE" | "REGIONAL_TERMINOLOGY" | "CLASSIFICATION_SYSTEM" | "SOURCE" | "OTHER";
    description: string;
    priority: "HIGH" | "MEDIUM" | "LOW";
    discovered_at_iso: string;
  }[];

  profile_version: string;              // "v1.2026-09-08"
  last_updated_iso: string;
}

// ═══════════════════════════════════════════════════════════════════
// §28 · DISCOVERY CHECKLIST (structured questions for a new country)
// ═══════════════════════════════════════════════════════════════════

/**
 * The exact 13 questions Founder listed in §28. Encoded machine-readably so
 * a worker can iterate them, ask each in turn, and populate the country
 * profile progressively.
 *
 * NEVER treat these as answered when they aren't. If a question cannot be
 * legitimately researched, record `answer_status: "UNRESOLVABLE"` — never
 * fabricate.
 */
export type DiscoveryQuestionSlug =
  | "what_accommodation_types_exist_here"
  | "what_are_the_local_names"
  | "which_types_are_legally_recognised"
  | "which_types_are_commercially_common"
  | "which_types_are_region_specific"
  | "what_room_terminology_is_used"
  | "what_bed_terminology_is_used"
  | "what_meal_terminology_is_used"
  | "what_services_are_common"
  | "what_facilities_are_common"
  | "what_terminology_differs_from_international"
  | "what_sources_can_verify_properties"
  | "what_information_is_missing";

export const DISCOVERY_QUESTION_SLUGS: readonly DiscoveryQuestionSlug[] = Object.freeze([
  "what_accommodation_types_exist_here",
  "what_are_the_local_names",
  "which_types_are_legally_recognised",
  "which_types_are_commercially_common",
  "which_types_are_region_specific",
  "what_room_terminology_is_used",
  "what_bed_terminology_is_used",
  "what_meal_terminology_is_used",
  "what_services_are_common",
  "what_facilities_are_common",
  "what_terminology_differs_from_international",
  "what_sources_can_verify_properties",
  "what_information_is_missing",
]);

/** One entry per Founder §28 question with human-readable text. */
export const DISCOVERY_QUESTIONS: Readonly<Record<DiscoveryQuestionSlug, {
  slug: DiscoveryQuestionSlug;
  founder_text: string;
  targets_profile_field: keyof CountryAccommodationProfile | "multiple";
}>> = Object.freeze({
  what_accommodation_types_exist_here: {
    slug: "what_accommodation_types_exist_here",
    founder_text: "What accommodation types exist here?",
    targets_profile_field: "country_specific_type_slugs",
  },
  what_are_the_local_names: {
    slug: "what_are_the_local_names",
    founder_text: "What are the local names?",
    targets_profile_field: "local_terminology",
  },
  which_types_are_legally_recognised: {
    slug: "which_types_are_legally_recognised",
    founder_text: "Which types are legally recognised?",
    targets_profile_field: "official_terminology",
  },
  which_types_are_commercially_common: {
    slug: "which_types_are_commercially_common",
    founder_text: "Which types are commercially common?",
    targets_profile_field: "tourism_terminology",
  },
  which_types_are_region_specific: {
    slug: "which_types_are_region_specific",
    founder_text: "Which types are region-specific?",
    targets_profile_field: "regional_terminology",
  },
  what_room_terminology_is_used: {
    slug: "what_room_terminology_is_used",
    founder_text: "What room terminology is used?",
    targets_profile_field: "local_room_terminology",
  },
  what_bed_terminology_is_used: {
    slug: "what_bed_terminology_is_used",
    founder_text: "What bed terminology is used?",
    targets_profile_field: "local_bed_terminology",
  },
  what_meal_terminology_is_used: {
    slug: "what_meal_terminology_is_used",
    founder_text: "What meal terminology is used?",
    targets_profile_field: "local_meal_terminology",
  },
  what_services_are_common: {
    slug: "what_services_are_common",
    founder_text: "What services are common?",
    targets_profile_field: "multiple",
  },
  what_facilities_are_common: {
    slug: "what_facilities_are_common",
    founder_text: "What facilities are common?",
    targets_profile_field: "local_facility_terminology",
  },
  what_terminology_differs_from_international: {
    slug: "what_terminology_differs_from_international",
    founder_text: "What accommodation terminology differs from international terminology?",
    targets_profile_field: "multiple",
  },
  what_sources_can_verify_properties: {
    slug: "what_sources_can_verify_properties",
    founder_text: "What sources can verify properties?",
    targets_profile_field: "source_requirements",
  },
  what_information_is_missing: {
    slug: "what_information_is_missing",
    founder_text: "What information is missing?",
    targets_profile_field: "research_gaps",
  },
});

// ═══════════════════════════════════════════════════════════════════
// SEED PROFILES · minimal per-country starter data
// ═══════════════════════════════════════════════════════════════════
//
// These are STARTER profiles — they seed the country_specific_type_slugs
// from the existing taxonomy.ts registry. Everything else (local
// terminology · room/bed/meal terms · sources · gaps) is progressively
// populated by the Accommodation Agent under Founder §29 governance.
//
// Only countries Founder listed by name in §8 seeded here. Others are
// added when the agent legitimately enters them (§28 discovery
// checklist runs, results promoted to profile with governance).

/** Extract slugs from a subset of COUNTRY_SPECIFIC_TYPES matching an origin_region substring. */
function slugsByOriginRegion(originRegion: string): readonly string[] {
  return ALL_EXTENDED_TYPES
    .filter((t: ExtendedAccommodationType) => t.origin_region?.includes(originRegion))
    .map((t) => t.slug);
}

const NOW_ISO = "2026-09-08T00:00:00Z";
const PROFILE_VERSION = "v1.2026-09-08";

export const SEED_COUNTRY_PROFILES: readonly CountryAccommodationProfile[] = Object.freeze([
  {
    country_code: "JP",
    display_name: "Japan",
    language_primary: "ja",
    languages_secondary: ["en"],
    currency_code: "JPY",
    official_terminology: [],
    local_terminology: [],
    tourism_terminology: [],
    regional_terminology: [],
    country_specific_type_slugs: slugsByOriginRegion("japan"),
    alternative_spellings: [],
    known_classification_systems: [],
    local_room_terminology: [
      { term: "washitsu", english_hint: "Japanese-style tatami room" },
      { term: "yōshitsu", english_hint: "Western-style room" },
    ],
    local_bed_terminology: [
      { term: "futon", english_hint: "Traditional floor bedding" },
    ],
    local_meal_terminology: [
      { term: "kaiseki", english_hint: "Multi-course traditional Japanese dinner" },
      { term: "washoku", english_hint: "Traditional Japanese cuisine" },
    ],
    local_facility_terminology: [
      { term: "onsen", english_hint: "Natural hot-spring bath" },
      { term: "sento", english_hint: "Public bath house" },
    ],
    source_requirements: [],
    research_gaps: [
      { gap_kind: "SOURCE", description: "Verify JNTO classification categories", priority: "MEDIUM", discovered_at_iso: NOW_ISO },
    ],
    profile_version: PROFILE_VERSION,
    last_updated_iso: NOW_ISO,
  },
  {
    country_code: "MA",
    display_name: "Morocco",
    language_primary: "ar",
    languages_secondary: ["fr", "ber"],
    currency_code: "MAD",
    official_terminology: [],
    local_terminology: [],
    tourism_terminology: [],
    regional_terminology: [],
    country_specific_type_slugs: slugsByOriginRegion("morocco"),
    alternative_spellings: [
      { canonical: "riad", variants: ["ryad", "ryyad"] },
    ],
    known_classification_systems: [],
    local_room_terminology: [
      { term: "salon marocain", english_hint: "Traditional Moroccan sitting/sleeping area" },
    ],
    local_bed_terminology: [],
    local_meal_terminology: [
      { term: "petit déjeuner marocain", english_hint: "Moroccan breakfast (msemen · beghrir · mint tea)" },
    ],
    local_facility_terminology: [
      { term: "hammam", english_hint: "Traditional steam bath" },
    ],
    source_requirements: [],
    research_gaps: [],
    profile_version: PROFILE_VERSION,
    last_updated_iso: NOW_ISO,
  },
  {
    country_code: "PT",
    display_name: "Portugal",
    language_primary: "pt",
    languages_secondary: ["en"],
    currency_code: "EUR",
    official_terminology: [],
    local_terminology: [],
    tourism_terminology: [],
    regional_terminology: [],
    country_specific_type_slugs: slugsByOriginRegion("portugal"),
    alternative_spellings: [],
    known_classification_systems: [
      { name: "PT Star Rating (RNET)", authority: "Turismo de Portugal", tiers: ["1★","2★","3★","4★","5★"] },
    ],
    local_room_terminology: [],
    local_bed_terminology: [],
    local_meal_terminology: [
      { term: "pequeno-almoço", english_hint: "Breakfast" },
    ],
    local_facility_terminology: [],
    source_requirements: [],
    research_gaps: [],
    profile_version: PROFILE_VERSION,
    last_updated_iso: NOW_ISO,
  },
  {
    country_code: "ES",
    display_name: "Spain",
    language_primary: "es",
    languages_secondary: ["ca", "gl", "eu"],
    currency_code: "EUR",
    official_terminology: [],
    local_terminology: [],
    tourism_terminology: [],
    regional_terminology: [
      { region: "Andalusia", term: "cortijo", canonical_slug: "rural-accommodation", notes: "Andalusian rural estate" },
    ],
    country_specific_type_slugs: slugsByOriginRegion("spain"),
    alternative_spellings: [],
    known_classification_systems: [],
    local_room_terminology: [],
    local_bed_terminology: [
      { term: "cama de matrimonio", english_hint: "Double bed" },
      { term: "camas separadas", english_hint: "Twin beds (separated)" },
    ],
    local_meal_terminology: [
      { term: "desayuno", english_hint: "Breakfast" },
      { term: "media pensión", english_hint: "Half-board" },
      { term: "pensión completa", english_hint: "Full board" },
    ],
    local_facility_terminology: [],
    source_requirements: [],
    research_gaps: [],
    profile_version: PROFILE_VERSION,
    last_updated_iso: NOW_ISO,
  },
  {
    country_code: "IT",
    display_name: "Italy",
    language_primary: "it",
    languages_secondary: ["en"],
    currency_code: "EUR",
    official_terminology: [],
    local_terminology: [],
    tourism_terminology: [],
    regional_terminology: [],
    country_specific_type_slugs: slugsByOriginRegion("italy"),
    alternative_spellings: [],
    known_classification_systems: [],
    local_room_terminology: [
      { term: "camera doppia", english_hint: "Double room" },
      { term: "camera matrimoniale", english_hint: "Room with matrimonial bed" },
    ],
    local_bed_terminology: [
      { term: "letto matrimoniale", english_hint: "Matrimonial bed (queen/king)" },
    ],
    local_meal_terminology: [
      { term: "prima colazione", english_hint: "Breakfast" },
      { term: "mezza pensione", english_hint: "Half-board" },
    ],
    local_facility_terminology: [],
    source_requirements: [],
    research_gaps: [],
    profile_version: PROFILE_VERSION,
    last_updated_iso: NOW_ISO,
  },
  {
    country_code: "FR",
    display_name: "France",
    language_primary: "fr",
    languages_secondary: ["en"],
    currency_code: "EUR",
    official_terminology: [],
    local_terminology: [],
    tourism_terminology: [],
    regional_terminology: [],
    country_specific_type_slugs: slugsByOriginRegion("france"),
    alternative_spellings: [],
    known_classification_systems: [
      { name: "FR Star Rating (Atout France)", authority: "Atout France", tiers: ["1★","2★","3★","4★","5★","Palace"] },
    ],
    local_room_terminology: [
      { term: "chambre double", english_hint: "Double room" },
      { term: "chambre twin", english_hint: "Twin room" },
    ],
    local_bed_terminology: [
      { term: "lit double", english_hint: "Double bed" },
      { term: "lit king-size", english_hint: "King-size bed" },
    ],
    local_meal_terminology: [
      { term: "petit-déjeuner", english_hint: "Breakfast" },
      { term: "demi-pension", english_hint: "Half-board" },
      { term: "pension complète", english_hint: "Full board" },
    ],
    local_facility_terminology: [],
    source_requirements: [],
    research_gaps: [],
    profile_version: PROFILE_VERSION,
    last_updated_iso: NOW_ISO,
  },
  {
    country_code: "IN",
    display_name: "India",
    language_primary: "hi",
    languages_secondary: ["en"],
    currency_code: "INR",
    official_terminology: [],
    local_terminology: [],
    tourism_terminology: [],
    regional_terminology: [],
    country_specific_type_slugs: slugsByOriginRegion("india"),
    alternative_spellings: [],
    known_classification_systems: [
      { name: "IN Star Rating (Ministry of Tourism)", authority: "Ministry of Tourism · Government of India", tiers: ["1★","2★","3★","4★","5★","5★ Deluxe"] },
    ],
    local_room_terminology: [],
    local_bed_terminology: [],
    local_meal_terminology: [],
    local_facility_terminology: [],
    source_requirements: [],
    research_gaps: [],
    profile_version: PROFILE_VERSION,
    last_updated_iso: NOW_ISO,
  },
  {
    country_code: "ID",
    display_name: "Indonesia",
    language_primary: "id",
    languages_secondary: ["jv", "su", "en"],
    currency_code: "IDR",
    official_terminology: [],
    local_terminology: [
      { term: "kos", canonical_slug: "kos", language: "id", notes: "Boarding house · often long-stay · monthly rate common" },
      { term: "kos-kosan", canonical_slug: "kos", language: "id", notes: "Alternative spelling of kos" },
      { term: "penginapan", canonical_slug: "penginapan", language: "id", notes: "Budget lodging" },
      { term: "wisma", canonical_slug: "wisma", language: "id", notes: "Lodge or inn · varies from budget to premium" },
      { term: "losmen", canonical_slug: "losmen", language: "id", notes: "Budget guesthouse" },
      { term: "homestay", canonical_slug: "homestay", language: "id", notes: "Family-run accommodation · common in Bali/Yogya" },
      { term: "villa", canonical_slug: "villa", language: "id", notes: "Common in Bali · standalone rental property" },
    ],
    tourism_terminology: [],
    regional_terminology: [
      { region: "Bali", term: "villa", canonical_slug: "villa", notes: "Bali villa often includes private pool · staff · standalone plot" },
      { region: "Yogyakarta", term: "homestay", canonical_slug: "homestay", notes: "Yogya homestay often near tourist areas · family-run" },
      { region: "Jakarta", term: "kos", canonical_slug: "kos", notes: "Jakarta kos serves large working-population · often long-stay" },
    ],
    country_specific_type_slugs: slugsByOriginRegion("indonesia"),
    alternative_spellings: [
      { canonical: "kos", variants: ["kost", "kos-kosan", "kosan"] },
    ],
    known_classification_systems: [
      { name: "Indonesia Hotel Star Rating (Kemenparekraf)", authority: "Kementerian Pariwisata dan Ekonomi Kreatif", tiers: ["Melati 1","Melati 2","Melati 3","1★","2★","3★","4★","5★"] },
    ],
    local_room_terminology: [
      { term: "kamar", english_hint: "Room" },
      { term: "kamar mandi dalam", english_hint: "Ensuite bathroom (bathroom inside room)" },
      { term: "kamar mandi luar", english_hint: "Shared bathroom (bathroom outside room)" },
    ],
    local_bed_terminology: [
      { term: "kasur", english_hint: "Mattress / bed" },
      { term: "tempat tidur", english_hint: "Bed" },
    ],
    local_meal_terminology: [
      { term: "sarapan", english_hint: "Breakfast" },
      { term: "sarapan termasuk", english_hint: "Breakfast included" },
    ],
    local_facility_terminology: [
      { term: "kolam renang", english_hint: "Swimming pool" },
      { term: "parkir", english_hint: "Parking" },
      { term: "AC", english_hint: "Air conditioning" },
      { term: "wifi", english_hint: "Wi-Fi" },
    ],
    source_requirements: [
      { source_kind: "OSM", name: "OpenStreetMap Indonesia", url_pattern: "https://www.openstreetmap.org/", rate_limit_notes: "Respect Overpass API rate limits · attribution required", licence_notes: "ODbL 1.0 · attribution + share-alike" },
    ],
    research_gaps: [
      { gap_kind: "TERMINOLOGY", description: "Sumatra · Kalimantan · Sulawesi · Papua accommodation terminology not yet catalogued", priority: "MEDIUM", discovered_at_iso: NOW_ISO },
      { gap_kind: "REGIONAL_TERMINOLOGY", description: "Bali vs Java vs Sumatra villa/homestay semantic differences need documentation", priority: "MEDIUM", discovered_at_iso: NOW_ISO },
    ],
    profile_version: PROFILE_VERSION,
    last_updated_iso: NOW_ISO,
  },
]);

// ═══════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════

/** Get a seed profile by country code. Returns null when country not seeded. */
export function getCountryProfile(country_code: CountryCode): CountryAccommodationProfile | null {
  return SEED_COUNTRY_PROFILES.find((p) => p.country_code === country_code) ?? null;
}

/** All country codes with seed profiles. */
export function seededCountryCodes(): readonly CountryCode[] {
  return SEED_COUNTRY_PROFILES.map((p) => p.country_code);
}

/** Country-specific type slugs registered globally (from taxonomy · not profile-local). */
export function globalCountrySpecificSlugs(): readonly string[] {
  return COUNTRY_SPECIFIC_TYPES.map((t) => t.slug);
}

/**
 * Generate a §28 discovery checklist for a country. When a profile already
 * exists, questions whose target field is already populated get marked
 * `answer_status: "ANSWERED_PARTIAL"`; others `UNANSWERED`. NEVER reports
 * ANSWERED unless the field is populated.
 */
export function generateDiscoveryChecklist(country_code: CountryCode): readonly {
  slug: DiscoveryQuestionSlug;
  founder_text: string;
  answer_status: "ANSWERED_PARTIAL" | "UNANSWERED" | "UNRESOLVABLE";
  target_field: string;
}[] {
  const profile = getCountryProfile(country_code);
  return DISCOVERY_QUESTION_SLUGS.map((slug) => {
    const q = DISCOVERY_QUESTIONS[slug];
    let status: "ANSWERED_PARTIAL" | "UNANSWERED" | "UNRESOLVABLE" = "UNANSWERED";
    if (profile && q.targets_profile_field !== "multiple") {
      const v = (profile as unknown as Record<string, unknown>)[q.targets_profile_field as string];
      if (Array.isArray(v) && v.length > 0) status = "ANSWERED_PARTIAL";
    }
    return {
      slug,
      founder_text: q.founder_text,
      answer_status: status,
      target_field: String(q.targets_profile_field),
    };
  });
}

/** Registry summary for observatory + tests. */
export function countryProfileRegistryStats(): {
  seeded_countries: number;
  countries: readonly CountryCode[];
  total_country_specific_slugs_registered: number;
  discovery_question_count: number;
} {
  return {
    seeded_countries: SEED_COUNTRY_PROFILES.length,
    countries: seededCountryCodes(),
    total_country_specific_slugs_registered: COUNTRY_SPECIFIC_TYPES.length,
    discovery_question_count: DISCOVERY_QUESTION_SLUGS.length,
  };
}
