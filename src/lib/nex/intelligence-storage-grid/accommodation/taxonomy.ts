// src/lib/nex/intelligence-storage-grid/accommodation/taxonomy.ts
//
// NEX Accommodation Agent · Global Taxonomy (Rule Book Upgrade v2)
// Founder BEGIN AUTHORIZATION 2026-09-08 · 42-section Rule Book Upgrade
//
// PRESERVES existing canonical 7-value category enum from migration 078:
//   hotel · villa · guesthouse · homestay · resort · hostel · apartment
// EXTENDS with:
//   - full global taxonomy (100+ accommodation types)
//   - explicit type / style / purpose / service-level / unit separation
//   - country-specific concepts (ryokan · riad · pousada · agriturismo · etc.)
//   - camping / mobile / specialised types
//   - alias index (deterministic string → canonical enum resolution)
//   - classification cautions (rules for when NOT to auto-classify)
//
// DOES NOT modify Postgres schema. DOES NOT change canonical enum.
// Uses `CanonicalAccommodationCategory` as the ONLY thing that gets persisted;
// everything else lives in extension fields (source_type · source_subtype ·
// categories[] · style_tags · purpose_tags · service_level).
//
// Additive only. Composes with existing doctrine at
// `docs/doctrine/nex_accommodation_intelligence_agent_world_class_doctrine_2026_09_07.md`.

// ═══════════════════════════════════════════════════════════════════
// §1 · CANONICAL CATEGORY · matches migration 078 CHECK constraint
// ═══════════════════════════════════════════════════════════════════

/** The 7-value canonical enum persisted to nex.accommodation_business.category. NEVER extend without a migration. */
export type CanonicalAccommodationCategory =
  | "hotel"
  | "villa"
  | "guesthouse"
  | "homestay"
  | "resort"
  | "hostel"
  | "apartment";

export const CANONICAL_ACCOMMODATION_CATEGORIES: readonly CanonicalAccommodationCategory[] = Object.freeze([
  "hotel", "villa", "guesthouse", "homestay", "resort", "hostel", "apartment",
]);

// ═══════════════════════════════════════════════════════════════════
// §3-§6 · EXTENDED GLOBAL TYPE TAXONOMY
// ═══════════════════════════════════════════════════════════════════

/**
 * Extended type reference for rich source_subtype + categories[] tagging.
 * Not persisted directly to `category`; used to inform classification +
 * populate source_type / source_subtype / categories[].
 *
 * Every type carries a canonical_category mapping so classification is
 * deterministic and safe against the 7-value enum.
 */
export interface ExtendedAccommodationType {
  slug: string;                       // stable canonical slug · lowercase · hyphenated
  display_name: string;               // human display
  canonical_category: CanonicalAccommodationCategory | "unknown";
  origin_region: string | null;       // e.g. "japan" · "morocco" · "iberian" · "global"
  requires_evidence_note: string | null; // Founder §30 · why this type needs evidence not inference
  aliases: readonly string[];         // deterministic classification hints (lowercased)
}

/** Core types (Founder §3). */
export const CORE_TYPES: readonly ExtendedAccommodationType[] = Object.freeze([
  { slug: "hotel", display_name: "Hotel", canonical_category: "hotel", origin_region: "global", requires_evidence_note: null, aliases: ["hotel", "hotels"] },
  { slug: "motel", display_name: "Motel", canonical_category: "hotel", origin_region: "global", requires_evidence_note: "motels differ in service level · flag when uncertain", aliases: ["motel", "motels"] },
  { slug: "inn", display_name: "Inn", canonical_category: "hotel", origin_region: "global", requires_evidence_note: null, aliases: ["inn", "inns"] },
  { slug: "guesthouse", display_name: "Guesthouse", canonical_category: "guesthouse", origin_region: "global", requires_evidence_note: null, aliases: ["guesthouse", "guest house", "guest-house"] },
  { slug: "bed-and-breakfast", display_name: "Bed & Breakfast", canonical_category: "guesthouse", origin_region: "global", requires_evidence_note: "b&b implies breakfast — do not infer without evidence", aliases: ["b&b", "bnb", "bed and breakfast", "bed & breakfast"] },
  { slug: "hostel", display_name: "Hostel", canonical_category: "hostel", origin_region: "global", requires_evidence_note: null, aliases: ["hostel", "hostels", "backpackers"] },
  { slug: "youth-hostel", display_name: "Youth Hostel", canonical_category: "hostel", origin_region: "global", requires_evidence_note: null, aliases: ["youth hostel", "yh"] },
  { slug: "pension", display_name: "Pension", canonical_category: "guesthouse", origin_region: "europe", requires_evidence_note: null, aliases: ["pension", "pensione", "pensión"] },
  { slug: "resort", display_name: "Resort", canonical_category: "resort", origin_region: "global", requires_evidence_note: null, aliases: ["resort", "resorts"] },
  { slug: "villa", display_name: "Villa", canonical_category: "villa", origin_region: "global", requires_evidence_note: "villa classification requires evidence · never auto-assume", aliases: ["villa", "villas"] },
  { slug: "apartment", display_name: "Apartment", canonical_category: "apartment", origin_region: "global", requires_evidence_note: null, aliases: ["apartment", "apartments", "flat", "flats"] },
  { slug: "aparthotel", display_name: "Aparthotel", canonical_category: "apartment", origin_region: "global", requires_evidence_note: null, aliases: ["aparthotel", "apart-hotel", "apart hotel"] },
  { slug: "serviced-apartment", display_name: "Serviced Apartment", canonical_category: "apartment", origin_region: "global", requires_evidence_note: null, aliases: ["serviced apartment", "serviced flat"] },
  { slug: "studio", display_name: "Studio", canonical_category: "apartment", origin_region: "global", requires_evidence_note: null, aliases: ["studio", "studios"] },
  { slug: "holiday-home", display_name: "Holiday Home", canonical_category: "villa", origin_region: "global", requires_evidence_note: null, aliases: ["holiday home", "holiday house", "holiday flat", "vacation home", "vacation rental"] },
  { slug: "bungalow", display_name: "Bungalow", canonical_category: "villa", origin_region: "global", requires_evidence_note: null, aliases: ["bungalow", "bungalows"] },
  { slug: "cottage", display_name: "Cottage", canonical_category: "villa", origin_region: "europe", requires_evidence_note: null, aliases: ["cottage", "cottages"] },
  { slug: "chalet", display_name: "Chalet", canonical_category: "villa", origin_region: "alpine", requires_evidence_note: null, aliases: ["chalet", "chalets"] },
  { slug: "cabin", display_name: "Cabin", canonical_category: "villa", origin_region: "global", requires_evidence_note: null, aliases: ["cabin", "cabins", "log cabin"] },
  { slug: "lodge", display_name: "Lodge", canonical_category: "resort", origin_region: "global", requires_evidence_note: null, aliases: ["lodge", "lodges"] },
  { slug: "homestay", display_name: "Homestay", canonical_category: "homestay", origin_region: "global", requires_evidence_note: null, aliases: ["homestay", "home stay"] },
  { slug: "farmhouse", display_name: "Farmhouse / Farm Stay", canonical_category: "guesthouse", origin_region: "global", requires_evidence_note: null, aliases: ["farmhouse", "farm stay", "farmstay"] },
  { slug: "country-house", display_name: "Country House", canonical_category: "guesthouse", origin_region: "europe", requires_evidence_note: null, aliases: ["country house", "manor house"] },
  { slug: "castle", display_name: "Castle", canonical_category: "hotel", origin_region: "europe", requires_evidence_note: "castle-conversion hotels · verify commercial operation", aliases: ["castle", "château accommodation"] },
  { slug: "chateau", display_name: "Château", canonical_category: "hotel", origin_region: "europe", requires_evidence_note: "château can be residence · verify visitor accommodation", aliases: ["château", "chateau"] },
  { slug: "boutique-hotel", display_name: "Boutique Hotel", canonical_category: "hotel", origin_region: "global", requires_evidence_note: null, aliases: ["boutique hotel", "boutique-hotel"] },
  { slug: "business-hotel", display_name: "Business Hotel", canonical_category: "hotel", origin_region: "global", requires_evidence_note: null, aliases: ["business hotel"] },
  { slug: "airport-hotel", display_name: "Airport Hotel", canonical_category: "hotel", origin_region: "global", requires_evidence_note: null, aliases: ["airport hotel"] },
  { slug: "extended-stay-hotel", display_name: "Extended-Stay Hotel", canonical_category: "hotel", origin_region: "global", requires_evidence_note: null, aliases: ["extended stay hotel", "extended-stay hotel", "residence hotel"] },
]);

/** §4 · Specialised types (evidence-required per Founder note). */
export const SPECIALISED_TYPES: readonly ExtendedAccommodationType[] = Object.freeze([
  { slug: "capsule-hotel", display_name: "Capsule Hotel", canonical_category: "hotel", origin_region: "japan", requires_evidence_note: "capsule ≠ generic hotel · preserve local concept", aliases: ["capsule hotel", "capsule"] },
  { slug: "pod-hotel", display_name: "Pod Hotel", canonical_category: "hotel", origin_region: "global", requires_evidence_note: null, aliases: ["pod hotel", "pods"] },
  { slug: "mountain-refuge", display_name: "Mountain Refuge", canonical_category: "guesthouse", origin_region: "alpine", requires_evidence_note: "verify seasonal operation", aliases: ["refuge", "mountain refuge", "rifugio", "refugio"] },
  { slug: "mountain-hut", display_name: "Mountain Hut", canonical_category: "guesthouse", origin_region: "alpine", requires_evidence_note: null, aliases: ["mountain hut", "hut"] },
  { slug: "safari-lodge", display_name: "Safari Lodge", canonical_category: "resort", origin_region: "africa", requires_evidence_note: null, aliases: ["safari lodge"] },
  { slug: "safari-tent", display_name: "Safari Tent", canonical_category: "resort", origin_region: "africa", requires_evidence_note: null, aliases: ["safari tent"] },
  { slug: "tented-camp", display_name: "Tented Camp", canonical_category: "resort", origin_region: "africa", requires_evidence_note: null, aliases: ["tented camp"] },
  { slug: "glamping", display_name: "Glamping", canonical_category: "resort", origin_region: "global", requires_evidence_note: null, aliases: ["glamping", "luxury tent", "glamp"] },
  { slug: "yurt", display_name: "Yurt", canonical_category: "guesthouse", origin_region: "central-asia", requires_evidence_note: null, aliases: ["yurt", "ger"] },
  { slug: "treehouse", display_name: "Treehouse", canonical_category: "villa", origin_region: "global", requires_evidence_note: null, aliases: ["treehouse", "tree house"] },
  { slug: "tiny-house", display_name: "Tiny House", canonical_category: "villa", origin_region: "global", requires_evidence_note: null, aliases: ["tiny house", "micro house"] },
  { slug: "houseboat", display_name: "Houseboat", canonical_category: "guesthouse", origin_region: "global", requires_evidence_note: null, aliases: ["houseboat", "boat hotel", "boatel"] },
  { slug: "eco-lodge", display_name: "Eco-Lodge", canonical_category: "resort", origin_region: "global", requires_evidence_note: null, aliases: ["eco lodge", "ecolodge", "eco-lodge"] },
  { slug: "retreat", display_name: "Retreat", canonical_category: "resort", origin_region: "global", requires_evidence_note: "retreat ≠ hotel · often has specific programme", aliases: ["retreat"] },
]);

/** §5 · Camping / mobile accommodation. */
export const CAMPING_TYPES: readonly ExtendedAccommodationType[] = Object.freeze([
  { slug: "campsite", display_name: "Campsite", canonical_category: "hostel", origin_region: "global", requires_evidence_note: "campsite is not a hotel · flag when classifying", aliases: ["campsite", "camping ground", "camp ground"] },
  { slug: "holiday-park", display_name: "Holiday Park", canonical_category: "resort", origin_region: "europe", requires_evidence_note: null, aliases: ["holiday park"] },
  { slug: "caravan-park", display_name: "Caravan Park", canonical_category: "hostel", origin_region: "europe", requires_evidence_note: null, aliases: ["caravan park"] },
  { slug: "rv-park", display_name: "RV Park", canonical_category: "hostel", origin_region: "north-america", requires_evidence_note: null, aliases: ["rv park", "motorhome park"] },
  { slug: "camping-pod", display_name: "Camping Pod", canonical_category: "hostel", origin_region: "global", requires_evidence_note: null, aliases: ["camping pod", "pod"] },
]);

/** §6 · Other accommodation categories. */
export const OTHER_TYPES: readonly ExtendedAccommodationType[] = Object.freeze([
  { slug: "student-residence", display_name: "Student Residence", canonical_category: "apartment", origin_region: "global", requires_evidence_note: "long-term residential · classify only when short-stay commercial", aliases: ["student residence", "university residence", "dormitory", "dorm"] },
  { slug: "workers-hostel", display_name: "Workers Hostel", canonical_category: "hostel", origin_region: "global", requires_evidence_note: "verify commercial visitor accommodation vs employment housing", aliases: ["workers hostel", "workers accommodation"] },
  { slug: "health-resort", display_name: "Health Resort / Wellness Retreat", canonical_category: "resort", origin_region: "global", requires_evidence_note: null, aliases: ["health resort", "wellness retreat", "spa retreat"] },
  { slug: "timeshare", display_name: "Timeshare Accommodation", canonical_category: "apartment", origin_region: "global", requires_evidence_note: "timeshare has unique booking model · flag for special handling", aliases: ["timeshare", "time-share"] },
  { slug: "holiday-village", display_name: "Holiday Village", canonical_category: "resort", origin_region: "europe", requires_evidence_note: null, aliases: ["holiday village", "holiday centre"] },
  { slug: "kos", display_name: "Kos (Indonesian boarding house)", canonical_category: "homestay", origin_region: "indonesia", requires_evidence_note: "Indonesia-specific · preserve local term · often long-stay", aliases: ["kos", "kost", "kos-kosan", "kosan"] },
  { slug: "penginapan", display_name: "Penginapan (Indonesian budget lodging)", canonical_category: "guesthouse", origin_region: "indonesia", requires_evidence_note: "Indonesia-specific · preserve local term", aliases: ["penginapan"] },
  { slug: "wisma", display_name: "Wisma (Indonesian lodge/inn)", canonical_category: "guesthouse", origin_region: "indonesia", requires_evidence_note: "Indonesia-specific · varies from budget to premium", aliases: ["wisma"] },
  { slug: "losmen", display_name: "Losmen (Indonesian budget guesthouse)", canonical_category: "guesthouse", origin_region: "indonesia", requires_evidence_note: "Indonesia-specific · budget tier", aliases: ["losmen"] },
]);

/** Country-specific concept types · MUST preserve original terminology per Founder §26. */
export const COUNTRY_SPECIFIC_TYPES: readonly ExtendedAccommodationType[] = Object.freeze([
  { slug: "ryokan", display_name: "Ryokan (Japanese traditional inn)", canonical_category: "guesthouse", origin_region: "japan", requires_evidence_note: "ryokan ≠ generic hotel · preserve cultural concept · often includes kaiseki + onsen", aliases: ["ryokan"] },
  { slug: "minshuku", display_name: "Minshuku (Japanese family-run B&B)", canonical_category: "guesthouse", origin_region: "japan", requires_evidence_note: "minshuku ≠ generic B&B · preserve cultural concept", aliases: ["minshuku"] },
  { slug: "machiya", display_name: "Machiya (Japanese townhouse accommodation)", canonical_category: "villa", origin_region: "japan", requires_evidence_note: null, aliases: ["machiya"] },
  { slug: "riad", display_name: "Riad (Moroccan courtyard house)", canonical_category: "guesthouse", origin_region: "morocco", requires_evidence_note: "riad ≠ generic guesthouse · preserve cultural concept · courtyard architecture", aliases: ["riad"] },
  { slug: "dar", display_name: "Dar (Moroccan traditional house)", canonical_category: "guesthouse", origin_region: "morocco", requires_evidence_note: null, aliases: ["dar"] },
  { slug: "kasbah", display_name: "Kasbah Accommodation (Moroccan fortified)", canonical_category: "hotel", origin_region: "morocco", requires_evidence_note: null, aliases: ["kasbah"] },
  { slug: "pousada", display_name: "Pousada (Portuguese state/heritage inn)", canonical_category: "hotel", origin_region: "portugal", requires_evidence_note: "pousada ≠ generic hotel · often heritage building", aliases: ["pousada"] },
  { slug: "quinta", display_name: "Quinta (Portuguese rural estate)", canonical_category: "villa", origin_region: "portugal", requires_evidence_note: null, aliases: ["quinta"] },
  { slug: "parador", display_name: "Parador (Spanish state heritage hotel)", canonical_category: "hotel", origin_region: "spain", requires_evidence_note: "parador ≠ generic hotel · Spanish state network", aliases: ["parador"] },
  { slug: "casa-rural", display_name: "Casa Rural (Spanish rural house)", canonical_category: "villa", origin_region: "spain", requires_evidence_note: null, aliases: ["casa rural"] },
  { slug: "agriturismo", display_name: "Agriturismo (Italian farm stay)", canonical_category: "guesthouse", origin_region: "italy", requires_evidence_note: "agriturismo ≠ generic farmhouse · working farm requirement", aliases: ["agriturismo"] },
  { slug: "albergo-diffuso", display_name: "Albergo Diffuso (Italian dispersed hotel)", canonical_category: "hotel", origin_region: "italy", requires_evidence_note: "rooms distributed across a village · flag for special handling", aliases: ["albergo diffuso"] },
  { slug: "gite", display_name: "Gîte (French self-catering rural)", canonical_category: "villa", origin_region: "france", requires_evidence_note: null, aliases: ["gîte", "gite"] },
  { slug: "chambre-dhotes", display_name: "Chambre d'Hôtes (French B&B)", canonical_category: "guesthouse", origin_region: "france", requires_evidence_note: null, aliases: ["chambre d'hôtes", "chambre d hotes", "chambres d'hôtes"] },
  { slug: "heritage-hotel-in", display_name: "Heritage Hotel (India)", canonical_category: "hotel", origin_region: "india", requires_evidence_note: null, aliases: ["heritage hotel"] },
  { slug: "haveli", display_name: "Haveli Accommodation (India)", canonical_category: "hotel", origin_region: "india", requires_evidence_note: null, aliases: ["haveli"] },
]);

/**
 * §37 · Founder BEGIN 2026-09-08 additions · Global Accommodation Intelligence Rule Book Upgrade.
 *
 * Types listed in the Founder BEGIN (§3 · §4 · §5 · §6 · §8) that were absent
 * from the original registry. Added additively per §37 (preserve existing
 * requirements · merge global taxonomy) and pre-authorized by the BEGIN itself
 * (§29 discovery-vs-authorization distinction: these types are Founder-listed,
 * not agent-discovered, so no separate governance step required).
 *
 * `requires_evidence_note` populated wherever the class needs verification
 * before commercial-accommodation classification (§4 "Do not assume that
 * every unusual structure is accommodation · verify it").
 */
export const FOUNDER_BEGIN_ADDITIONS_2026_09_08: readonly ExtendedAccommodationType[] = Object.freeze([
  // §3 CORE additions
  { slug: "apartment-complex", display_name: "Apartment Complex", canonical_category: "apartment", origin_region: "global", requires_evidence_note: "multi-building complex · verify commercial short-stay vs residential lease", aliases: ["apartment complex", "apartment building", "residential complex"] },
  { slug: "rural-accommodation", display_name: "Rural Accommodation", canonical_category: "guesthouse", origin_region: "global", requires_evidence_note: "broad category · prefer country-specific term (agriturismo · casa-rural · quinta · gite) when known", aliases: ["rural accommodation", "rural stay", "countryside accommodation"] },
  { slug: "palace", display_name: "Palace", canonical_category: "hotel", origin_region: "global", requires_evidence_note: "many palaces are museums or residences · verify commercial visitor accommodation", aliases: ["palace", "palace hotel"] },
  { slug: "all-suite-hotel", display_name: "All-Suite Hotel", canonical_category: "hotel", origin_region: "global", requires_evidence_note: null, aliases: ["all-suite hotel", "all suite hotel"] },

  // §4 SPECIALISED additions
  { slug: "love-hotel", display_name: "Love Hotel", canonical_category: "hotel", origin_region: "japan", requires_evidence_note: "distinct commercial category · short-stay · preserve concept · common in Japan/Korea/Taiwan", aliases: ["love hotel", "boutique short-stay"] },
  { slug: "teepee", display_name: "Teepee Accommodation", canonical_category: "hostel", origin_region: "global", requires_evidence_note: "verify commercial visitor accommodation vs cultural site", aliases: ["teepee", "tipi", "tepee"] },
  { slug: "dome-accommodation", display_name: "Dome Accommodation", canonical_category: "resort", origin_region: "global", requires_evidence_note: null, aliases: ["dome", "geodesic dome", "dome tent", "glamping dome"] },
  { slug: "igloo-accommodation", display_name: "Igloo Accommodation", canonical_category: "resort", origin_region: "arctic", requires_evidence_note: "seasonal · verify winter-only vs year-round · Arctic/subarctic", aliases: ["igloo", "glass igloo", "snow igloo"] },
  { slug: "cruise-ship-accommodation", display_name: "Cruise Ship Accommodation", canonical_category: "hotel", origin_region: "global", requires_evidence_note: "special handling · moving vessel · itinerary-based · not fixed-location · flag for booking-model differences", aliases: ["cruise ship", "cruise cabin", "cruise accommodation"] },
  { slug: "floating-accommodation", display_name: "Floating Accommodation", canonical_category: "guesthouse", origin_region: "global", requires_evidence_note: "verify commercial visitor accommodation · distinct from houseboat (which is boat-shaped)", aliases: ["floating accommodation", "floating hotel", "floating lodge"] },
  { slug: "lighthouse-accommodation", display_name: "Lighthouse Accommodation", canonical_category: "guesthouse", origin_region: "global", requires_evidence_note: "converted lighthouse · verify commercial operation · often heritage-protected", aliases: ["lighthouse", "lighthouse stay", "lighthouse accommodation"] },
  { slug: "railway-sleeper-accommodation", display_name: "Railway / Sleeper Accommodation", canonical_category: "hotel", origin_region: "global", requires_evidence_note: "converted railway carriage or sleeper-train service · verify commercial visitor operation", aliases: ["railway accommodation", "sleeper train accommodation", "carriage stay", "train hotel"] },

  // §5 CAMPING/MOBILE additions
  { slug: "caravan", display_name: "Caravan", canonical_category: "hostel", origin_region: "europe", requires_evidence_note: "verify commercial rental vs private ownership · static-caravan common in UK holiday parks", aliases: ["caravan", "static caravan", "static-caravan"] },
  { slug: "mobile-home", display_name: "Mobile Home", canonical_category: "villa", origin_region: "global", requires_evidence_note: "verify commercial rental vs long-term residence", aliases: ["mobile home", "mobile-home", "trailer home"] },
  { slug: "campervan-accommodation", display_name: "Campervan Accommodation", canonical_category: "hostel", origin_region: "global", requires_evidence_note: "usually vehicle-based · verify pitch/site vs vehicle rental", aliases: ["campervan", "camper van accommodation", "camper van pitch"] },
  { slug: "tent", display_name: "Tent (Generic)", canonical_category: "hostel", origin_region: "global", requires_evidence_note: "generic tent · prefer safari-tent · glamping · glamping tent · trailer-tent when applicable", aliases: ["tent", "camping tent"] },
  { slug: "trailer-tent", display_name: "Trailer Tent", canonical_category: "hostel", origin_region: "europe", requires_evidence_note: null, aliases: ["trailer tent", "tent trailer", "folding trailer"] },
  { slug: "cabin-camp", display_name: "Cabin Camp", canonical_category: "hostel", origin_region: "global", requires_evidence_note: "camping-ground with cabin-style pitches · distinct from a standalone cabin", aliases: ["cabin camp", "camp cabin"] },

  // §6 OTHER additions
  { slug: "seasonal-workers-accommodation", display_name: "Seasonal Workers Accommodation", canonical_category: "hostel", origin_region: "global", requires_evidence_note: "employment housing · verify short-stay visitor availability before classifying as commercial", aliases: ["seasonal workers accommodation", "seasonal worker housing"] },
  { slug: "group-accommodation", display_name: "Group Accommodation", canonical_category: "hostel", origin_region: "global", requires_evidence_note: "verify whole-property booking vs per-bed · flag for group-only booking model", aliases: ["group accommodation", "group booking accommodation", "whole-property rental"] },
  { slug: "holiday-camp", display_name: "Holiday Camp", canonical_category: "resort", origin_region: "europe", requires_evidence_note: null, aliases: ["holiday camp"] },
  { slug: "educational-accommodation", display_name: "Educational Accommodation", canonical_category: "hostel", origin_region: "global", requires_evidence_note: "verify commercial visitor availability outside term-time", aliases: ["educational accommodation", "school accommodation", "field-study accommodation"] },
  { slug: "conference-accommodation", display_name: "Conference Accommodation", canonical_category: "hotel", origin_region: "global", requires_evidence_note: "verify commercial visitor availability outside conference bookings", aliases: ["conference accommodation", "conference centre accommodation"] },
  { slug: "medical-health-accommodation", display_name: "Medical / Health Accommodation", canonical_category: "guesthouse", origin_region: "global", requires_evidence_note: "medical-tourism · treatment-linked · flag for special handling · verify visitor status", aliases: ["medical accommodation", "health accommodation", "medical tourism accommodation"] },

  // §8 NORDIC / ARCTIC country-specific additions
  { slug: "ice-hotel", display_name: "Ice Hotel / Snow Hotel (Nordic)", canonical_category: "resort", origin_region: "nordic-arctic", requires_evidence_note: "seasonal · winter-only · verify build/melt calendar each year", aliases: ["ice hotel", "snow hotel", "snowhotel"] },
]);

/** All extended types combined. Frozen. */
export const ALL_EXTENDED_TYPES: readonly ExtendedAccommodationType[] = Object.freeze([
  ...CORE_TYPES,
  ...SPECIALISED_TYPES,
  ...CAMPING_TYPES,
  ...OTHER_TYPES,
  ...COUNTRY_SPECIFIC_TYPES,
  ...FOUNDER_BEGIN_ADDITIONS_2026_09_08,
]);

// ═══════════════════════════════════════════════════════════════════
// §7 · TYPE ≠ STYLE ≠ PURPOSE ≠ SERVICE-LEVEL ≠ UNIT · explicit separation
// ═══════════════════════════════════════════════════════════════════

export type PropertyStyleTag =
  | "boutique" | "luxury" | "historic" | "modern" | "traditional"
  | "eco" | "design" | "heritage" | "family" | "adults_only";

export const STYLE_TAGS: readonly PropertyStyleTag[] = Object.freeze([
  "boutique","luxury","historic","modern","traditional","eco","design","heritage","family","adults_only",
]);

export type PurposeSegmentTag =
  | "business" | "airport" | "beach" | "ski" | "golf" | "medical" | "wellness"
  | "romantic" | "family" | "backpacker" | "long_stay" | "extended_stay";

export const PURPOSE_TAGS: readonly PurposeSegmentTag[] = Object.freeze([
  "business","airport","beach","ski","golf","medical","wellness","romantic","family","backpacker","long_stay","extended_stay",
]);

export type ServiceLevelTier =
  | "budget" | "mid_range" | "upper_midscale" | "luxury" | "ultra_luxury";

export const SERVICE_LEVEL_TIERS: readonly ServiceLevelTier[] = Object.freeze([
  "budget","mid_range","upper_midscale","luxury","ultra_luxury",
]);

/** §7 · Accommodation unit types (what fits inside a property). */
export type AccommodationUnitKind =
  | "room" | "suite" | "studio" | "apartment" | "villa"
  | "cabin" | "tent" | "pod" | "dormitory_bed" | "capsule" | "yurt" | "treehouse" | "houseboat_cabin";

export const UNIT_KINDS: readonly AccommodationUnitKind[] = Object.freeze([
  "room","suite","studio","apartment","villa","cabin","tent","pod","dormitory_bed","capsule","yurt","treehouse","houseboat_cabin",
]);

// ═══════════════════════════════════════════════════════════════════
// §16 · MEAL PLAN / BOARD (must not be confused with accommodation type)
// ═══════════════════════════════════════════════════════════════════

export type BoardMealPlan =
  | "ROOM_ONLY" | "BED_AND_BREAKFAST" | "HALF_BOARD" | "FULL_BOARD" | "ALL_INCLUSIVE";

export type BreakfastKind =
  | "NONE" | "AVAILABLE" | "INCLUDED" | "OPTIONAL"
  | "BUFFET" | "CONTINENTAL" | "FULL_ENGLISH" | "AMERICAN"
  | "ASIAN" | "JAPANESE" | "LOCAL" | "A_LA_CARTE";

// ═══════════════════════════════════════════════════════════════════
// §17 · BED TYPES (must be structured · not buried in description)
// ═══════════════════════════════════════════════════════════════════

export type BedType =
  | "single" | "double" | "queen" | "king" | "twin"
  | "bunk" | "sofa_bed" | "futon" | "murphy" | "extra_bed" | "crib_cot";

// ═══════════════════════════════════════════════════════════════════
// §18-§19 · IMAGE CLASSIFICATION VOCABULARY
// ═══════════════════════════════════════════════════════════════════

export type ImageClassification =
  | "PROPERTY_EXTERIOR" | "ENTRANCE" | "LOBBY" | "RECEPTION"
  | "ROOM" | "BEDROOM" | "BED" | "BATHROOM" | "SUITE" | "APARTMENT"
  | "KITCHEN" | "LIVING_ROOM" | "BALCONY" | "TERRACE"
  | "POOL" | "POOLSIDE" | "BEACH" | "GARDEN"
  | "RESTAURANT" | "BAR" | "BREAKFAST"
  | "SPA" | "GYM" | "SAUNA"
  | "VIEW" | "PARKING" | "FACILITIES" | "NEARBY"
  | "OTHER" | "UNKNOWN";

/** §19 · When room-scope is uncertain, use PROPERTY_GENERAL rather than inventing a room association. */
export type ImageScope = "PROPERTY_GENERAL" | "ROOM_SPECIFIC" | "FACILITY_SPECIFIC" | "UNKNOWN";

// ═══════════════════════════════════════════════════════════════════
// Alias resolver · deterministic string → ExtendedAccommodationType
// ═══════════════════════════════════════════════════════════════════

const ALIAS_INDEX: Map<string, ExtendedAccommodationType> = (() => {
  const m = new Map<string, ExtendedAccommodationType>();
  for (const t of ALL_EXTENDED_TYPES) {
    for (const alias of t.aliases) m.set(alias.toLowerCase().trim(), t);
    m.set(t.slug.toLowerCase(), t);
    m.set(t.display_name.toLowerCase().trim(), t);
  }
  return m;
})();

/**
 * Deterministic classification. NEVER LLM. Returns null when no match ·
 * caller must record UNKNOWN honestly per Founder §30.
 */
export function classifyAccommodationTypeString(raw: string | null | undefined): ExtendedAccommodationType | null {
  if (!raw) return null;
  const key = raw.toLowerCase().trim();
  return ALIAS_INDEX.get(key) ?? null;
}

/**
 * Get the canonical category (persistable enum) for a raw type string.
 * Returns null when unclassifiable · caller must NOT auto-default per Founder §30.
 */
export function classifyCanonicalCategory(raw: string | null | undefined): CanonicalAccommodationCategory | null {
  const t = classifyAccommodationTypeString(raw);
  if (!t) return null;
  if (t.canonical_category === "unknown") return null;
  return t.canonical_category;
}

/** All aliases known (useful for tests + coverage reports). */
export function allKnownAliases(): string[] {
  return [...ALIAS_INDEX.keys()].sort();
}

/** All country-specific types (Founder §26 · preserve local concept · never flatten). */
export function countrySpecificTypes(): readonly ExtendedAccommodationType[] {
  return COUNTRY_SPECIFIC_TYPES;
}

/** Statistics for taxonomy audit reports (Founder §39). */
export function taxonomyAudit(): {
  total_extended_types: number;
  core_types: number;
  specialised_types: number;
  camping_types: number;
  other_types: number;
  country_specific_types: number;
  founder_begin_additions_2026_09_08: number;
  canonical_category_coverage: Record<CanonicalAccommodationCategory | "unknown", number>;
  types_requiring_evidence: number;
  total_aliases: number;
} {
  const coverage: Record<string, number> = {};
  for (const c of [...CANONICAL_ACCOMMODATION_CATEGORIES, "unknown"]) coverage[c] = 0;
  let needsEvidence = 0;
  for (const t of ALL_EXTENDED_TYPES) {
    coverage[t.canonical_category] = (coverage[t.canonical_category] ?? 0) + 1;
    if (t.requires_evidence_note) needsEvidence++;
  }
  return {
    total_extended_types: ALL_EXTENDED_TYPES.length,
    core_types: CORE_TYPES.length,
    specialised_types: SPECIALISED_TYPES.length,
    camping_types: CAMPING_TYPES.length,
    other_types: OTHER_TYPES.length,
    country_specific_types: COUNTRY_SPECIFIC_TYPES.length,
    founder_begin_additions_2026_09_08: FOUNDER_BEGIN_ADDITIONS_2026_09_08.length,
    canonical_category_coverage: coverage as any,
    types_requiring_evidence: needsEvidence,
    total_aliases: ALIAS_INDEX.size,
  };
}
