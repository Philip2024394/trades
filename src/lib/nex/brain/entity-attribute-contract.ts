// src/lib/nex/brain/entity-attribute-contract.ts
//
// Universal Entity Attribute Contract
// Philip 2026-09-06 · AUTHORIZE · UNIVERSAL ENTITY INTELLIGENCE
//
// PURPOSE (§5 §10 §11 §12)
//   Bridge NEX's stored entity data (WorldRecord + amenities[]) into a
//   structured attribute state per vertical:
//
//     KNOWN_YES · KNOWN_NO · UNKNOWN
//
//   The stored WorldRecord.amenities is a flat string[] · this module
//   turns it into a typed attribute map so the conversation layer can
//   answer "does the first one have a pool?" without treating a missing
//   attribute as an implicit no (§10 "UNKNOWN ≠ NO").
//
// CONTRACT (§5)
//   AttributeContract: per (vertical, attribute) definition · what
//     tokens in the amenities[] array count as evidence, what field on
//     the WorldRecord counts as evidence, what display name to use.
//   AttributeMap: per WorldRecord · state per contract attribute.
//   InformationCoverage: for §13 · verified / partial / unknown metrics.
//
// PRESERVATION
//   Never fabricates. Never infers KNOWN_NO from silence. Only:
//     · A first-class WorldRecord field set to non-null → KNOWN_YES
//     · A canonical amenity token in amenities[] → KNOWN_YES
//     · Explicit negation flag (not present today · reserved) → KNOWN_NO
//     · Everything else → UNKNOWN

import type { WorldRecord, WorldVertical } from "./world-adapters/types";

// ─── Types ──────────────────────────────────────────────────────

/**
 * 6-valued attribute state (Philip 2026-09-06 · AUTHORIZE · Universal
 * Entity Intelligence v2 · §7).
 *
 *   KNOWN_YES     · owner-verified or authoritative-source-confirmed true
 *   KNOWN_NO      · authoritative "not present" evidence
 *   UNKNOWN       · no evidence either way — never rendered as "no"
 *   UNVERIFIED    · evidence exists (e.g. OSM amenity tag) but has not
 *                   been owner-confirmed. Not to be presented as an
 *                   established fact.
 *   CONFLICTING   · two evidence sources disagree — do not silently
 *                   pick a winner
 *   STALE         · evidence exists but is past its freshness window
 *
 * The 3-valued lineage (KNOWN_YES · KNOWN_NO · UNKNOWN) is preserved so
 * older callers can pattern-match on those without breakage; new
 * callers can distinguish UNVERIFIED / CONFLICTING / STALE explicitly.
 */
export type AttributeState =
  | "KNOWN_YES"
  | "KNOWN_NO"
  | "UNKNOWN"
  | "UNVERIFIED"
  | "CONFLICTING"
  | "STALE";

export type AttributeCategory =
  | "facility"      // pool, parking, gym, restaurant, ...
  | "room"          // room_count, ac, tv, wifi in-room
  | "service"       // breakfast, room service, airport transfer
  | "contact"       // phone, whatsapp, website, email
  | "commercial"    // price, availability, booking
  | "identity"      // name, address, city
  | "product"       // brand, condition, warranty
  | "food"          // cuisine, dishes, opening hours
  | "gym"           // equipment, classes, hours
  | "service_trade" // service types, coverage area
  | "villa"         // villa-specific attributes (bedrooms, bathrooms, capacity)
  | "meta";         // rating, review_count, star_rating, verified

/** Evidence-source tier · used to decide UNVERIFIED vs KNOWN_YES. Only
 *  owner-attested sources (owner-claimed / member) upgrade to KNOWN_YES.
 *  Directory listings + OSM tags stay UNVERIFIED until owner claim. */
export type EvidenceTier =
  | "owner_verified"    // owner_status ∈ {verified, claimed} or NEX capability integration
  | "authoritative"     // authoritative external source (currently unused; reserved)
  | "directory"         // NEX directory / OSM community tag · unverified
  | "unknown";          // no evidence

export type AttributeDef = {
  id: string;                       // e.g. "pool"
  category: AttributeCategory;
  displayEn: string;                // "Swimming pool"
  displayId: string;                // "Kolam renang"
  keywords: string[];               // amenity tokens or query tokens
  /** When set: reading this WorldRecord property === positive evidence
   *  if the value is present and not null / not empty. Whether it
   *  resolves to KNOWN_YES or UNVERIFIED depends on evidence tier.
   *  Never used to derive KNOWN_NO. */
  fieldEvidence?: (r: WorldRecord) => boolean;
  /** Freshness window in milliseconds. Evidence older than this becomes
   *  STALE. Default: 90 days for facility/room attributes, unbounded
   *  for identity (address/coordinates). */
  freshnessMs?: number;
};

export type AttributeMapEntry = {
  attribute: AttributeDef;
  state: AttributeState;
  /** Where the positive evidence came from. undefined for UNKNOWN. */
  evidence?: "amenity_token" | "field" | "provenance";
  /** Evidence tier used to resolve state. undefined when state is UNKNOWN. */
  evidenceTier?: EvidenceTier;
  /** Optional freshness observation: age of the evidence in ms since
   *  the record's updatedAt. undefined when not measurable. */
  evidenceAgeMs?: number;
};

export type AttributeMap = ReadonlyArray<AttributeMapEntry>;

/**
 * Information-coverage metric · §13. Includes the 6-valued state counts
 * plus a derived "usable coverage" (KNOWN_YES ÷ total) that stays a
 * conservative measure of what NEX can present as established fact.
 */
export type InformationCoverage = {
  vertical: WorldVertical;
  total_attributes: number;
  known_yes: number;
  known_no: number;
  unknown: number;
  unverified: number;
  conflicting: number;
  stale: number;
  /** KNOWN_YES ÷ total · integer 0-100. Excludes UNVERIFIED to remain
   *  a conservative "what NEX can affirmatively say" measure. */
  coverage_pct: number;
  /** (KNOWN_YES + UNVERIFIED) ÷ total · integer 0-100. Reports the
   *  broader "evidence exists at some tier" fraction. Non-authoritative. */
  evidence_pct: number;
};

// ─── Canonical attribute tokens · what an amenity string can be ─

/** Case-insensitive · trimmed · matches against the amenities[] tokens
 *  stored in nex.accommodation_business (and equivalent). Populated
 *  from real production data patterns. */
const AMENITY_ALIASES: Record<string, string[]> = {
  pool:              ["pool", "swimming pool", "swimmingpool", "kolam", "kolam renang"],
  parking:           ["parking", "car park", "car parking", "carpark", "parkir"],
  wifi:              ["wifi", "wi-fi", "wi fi", "wireless", "internet"],
  restaurant:        ["restaurant", "resto", "restoran", "dining"],
  cafe:              ["cafe", "café", "kafe", "coffee shop", "coffee"],
  bar:               ["bar", "lounge", "pub"],
  gym:               ["gym", "fitness", "fitness centre", "fitness center", "workout"],
  spa:               ["spa", "wellness", "massage"],
  garden:            ["garden", "kebun", "taman"],
  terrace:           ["terrace", "rooftop", "teras", "rooftop terrace"],
  laundry:           ["laundry", "laundry service", "cuci", "cuci baju", "washer"],
  meeting_room:      ["meeting", "meeting room", "conference", "ruang rapat"],
  elevator:          ["elevator", "lift"],
  reception:         ["reception", "front desk", "24 hour reception", "24/7 reception"],
  security:          ["security", "cctv", "24 hour security"],
  accessibility:     ["accessibility", "wheelchair", "wheelchair accessible", "disability"],
  ac:                ["ac", "aircon", "air-conditioning", "air conditioning", "airconditioner", "ac unit"],
  tv:                ["tv", "television", "cable tv", "satellite tv"],
  balcony:           ["balcony", "balkon", "private balcony"],
  kitchen:           ["kitchen", "kitchenette", "dapur"],
  fridge:            ["fridge", "refrigerator", "mini fridge", "mini bar", "minibar"],
  breakfast:         ["breakfast", "sarapan", "breakfast included", "breakfast buffet"],
  airport_transfer:  ["airport transfer", "airport shuttle", "shuttle", "antar jemput"],
  room_service:      ["room service", "24 hour room service"],
  luggage_storage:   ["luggage storage", "luggage", "storage"],
  housekeeping:      ["housekeeping", "daily cleaning", "cleaning"],
  front_desk:        ["front desk", "24 hour front desk", "24/7 front desk"],
  transport_help:    ["transport assistance", "transport help", "taxi", "car rental"],
  // Food-vertical amenity/facility tokens
  delivery:          ["delivery", "food delivery"],
  takeaway:          ["takeaway", "take away", "take-away", "takeout"],
  outdoor_seating:   ["outdoor seating", "outdoor", "al fresco", "terrace seating"],
  reservations:      ["reservation", "reservations", "table booking"],
  vegetarian:        ["vegetarian", "vegetarian friendly", "vegetarian options"],
  vegan:             ["vegan", "vegan options"],
  halal:             ["halal", "halal food"],
  // Gym-vertical
  personal_trainer:  ["personal trainer", "trainer", "coach", "personal training"],
  group_classes:     ["group classes", "classes", "yoga", "spinning", "hiit"],
  showers:           ["showers", "changing room", "lockers"],
  // Service-trade vertical
  emergency:         ["24 hour", "24/7", "emergency", "emergency call out"],
  free_quote:        ["free quote", "free estimate", "no obligation"],
  // Villa-specific · sourced from typical villa listing tags
  bedrooms:          ["bedrooms", "bedroom", "kamar tidur"],
  bathrooms:         ["bathrooms", "bathroom", "kamar mandi"],
  capacity:          ["capacity", "sleeps", "guests", "kapasitas", "maksimal"],
  private_pool:      ["private pool", "private swimming pool", "kolam pribadi"],
  full_kitchen:      ["full kitchen", "equipped kitchen", "dapur lengkap"],
};

// ─── Contract definitions per vertical ──────────────────────────

// Field-evidence functions consult first-class WorldRecord fields
// (never invent data · never treat absence as KNOWN_NO).
const HAS_ROOM_COUNT: (r: WorldRecord) => boolean = (r) =>
  typeof (r as unknown as { roomCount?: number }).roomCount === "number"
  && ((r as unknown as { roomCount?: number }).roomCount ?? 0) > 0;
const HAS_PHONE: (r: WorldRecord) => boolean = (r) => Boolean(r.phone);
const HAS_WHATSAPP: (r: WorldRecord) => boolean = (r) => Boolean(r.whatsapp);
const HAS_WEBSITE: (r: WorldRecord) => boolean = (r) => Boolean(r.website);
const HAS_PRICE: (r: WorldRecord) => boolean = (r) =>
  (r as unknown as { price?: number | null }).price != null
  || (r as unknown as { priceRange?: unknown }).priceRange != null;
const HAS_STAR_RATING: (r: WorldRecord) => boolean = (r) =>
  typeof (r as unknown as { starRating?: number }).starRating === "number";
const HAS_RATING: (r: WorldRecord) => boolean = (r) =>
  typeof (r as unknown as { rating?: number }).rating === "number";
const HAS_ADDRESS: (r: WorldRecord) => boolean = (r) => Boolean(r.address);
const HAS_COORDS: (r: WorldRecord) => boolean = (r) =>
  (r as unknown as { latitude?: number }).latitude != null
  && (r as unknown as { longitude?: number }).longitude != null;

/** Accommodation attribute contract · derived from the real column
 *  set at nex.accommodation_business (audit report). */
const ACCOMMODATION_CONTRACT: AttributeDef[] = [
  // identity
  { id: "address", category: "identity", displayEn: "Address", displayId: "Alamat", keywords: [], fieldEvidence: HAS_ADDRESS },
  { id: "coordinates", category: "identity", displayEn: "Map location", displayId: "Titik peta", keywords: [], fieldEvidence: HAS_COORDS },
  // contact
  { id: "phone", category: "contact", displayEn: "Phone", displayId: "Telepon", keywords: [], fieldEvidence: HAS_PHONE },
  { id: "whatsapp", category: "contact", displayEn: "WhatsApp", displayId: "WhatsApp", keywords: [], fieldEvidence: HAS_WHATSAPP },
  { id: "website", category: "contact", displayEn: "Website", displayId: "Situs web", keywords: [], fieldEvidence: HAS_WEBSITE },
  // rooms
  { id: "room_count", category: "room", displayEn: "Room count", displayId: "Jumlah kamar", keywords: [], fieldEvidence: HAS_ROOM_COUNT },
  { id: "ac", category: "room", displayEn: "Air conditioning", displayId: "AC", keywords: AMENITY_ALIASES.ac },
  { id: "wifi", category: "facility", displayEn: "Wi-Fi", displayId: "Wi-Fi", keywords: AMENITY_ALIASES.wifi },
  { id: "tv", category: "room", displayEn: "TV", displayId: "TV", keywords: AMENITY_ALIASES.tv },
  { id: "balcony", category: "room", displayEn: "Balcony", displayId: "Balkon", keywords: AMENITY_ALIASES.balcony },
  { id: "kitchen", category: "room", displayEn: "Kitchen", displayId: "Dapur", keywords: AMENITY_ALIASES.kitchen },
  { id: "fridge", category: "room", displayEn: "Fridge", displayId: "Kulkas", keywords: AMENITY_ALIASES.fridge },
  // facilities
  { id: "pool", category: "facility", displayEn: "Pool", displayId: "Kolam renang", keywords: AMENITY_ALIASES.pool },
  { id: "parking", category: "facility", displayEn: "Parking", displayId: "Parkir", keywords: AMENITY_ALIASES.parking },
  { id: "restaurant", category: "facility", displayEn: "Restaurant", displayId: "Restoran", keywords: AMENITY_ALIASES.restaurant },
  { id: "cafe", category: "facility", displayEn: "Café", displayId: "Kafe", keywords: AMENITY_ALIASES.cafe },
  { id: "bar", category: "facility", displayEn: "Bar", displayId: "Bar", keywords: AMENITY_ALIASES.bar },
  { id: "gym", category: "facility", displayEn: "Gym", displayId: "Gym", keywords: AMENITY_ALIASES.gym },
  { id: "spa", category: "facility", displayEn: "Spa", displayId: "Spa", keywords: AMENITY_ALIASES.spa },
  { id: "garden", category: "facility", displayEn: "Garden", displayId: "Taman", keywords: AMENITY_ALIASES.garden },
  { id: "terrace", category: "facility", displayEn: "Terrace", displayId: "Teras", keywords: AMENITY_ALIASES.terrace },
  { id: "elevator", category: "facility", displayEn: "Elevator", displayId: "Lift", keywords: AMENITY_ALIASES.elevator },
  // services
  { id: "laundry", category: "service", displayEn: "Laundry", displayId: "Layanan cuci", keywords: AMENITY_ALIASES.laundry },
  { id: "breakfast", category: "service", displayEn: "Breakfast", displayId: "Sarapan", keywords: AMENITY_ALIASES.breakfast },
  { id: "airport_transfer", category: "service", displayEn: "Airport transfer", displayId: "Antar jemput bandara", keywords: AMENITY_ALIASES.airport_transfer },
  { id: "room_service", category: "service", displayEn: "Room service", displayId: "Layanan kamar", keywords: AMENITY_ALIASES.room_service },
  { id: "housekeeping", category: "service", displayEn: "Housekeeping", displayId: "Kebersihan", keywords: AMENITY_ALIASES.housekeeping },
  { id: "front_desk", category: "service", displayEn: "Front desk", displayId: "Resepsionis", keywords: AMENITY_ALIASES.front_desk },
  // villa-specific · relevant when record.category === "villa"
  // Currently the underlying schema does not populate these as
  // first-class fields, so they'll typically report UNKNOWN until an
  // enrichment slice attaches structured villa metadata. Contract is
  // stated so downstream code can consume it without special-casing.
  { id: "bedrooms", category: "villa", displayEn: "Bedrooms", displayId: "Kamar tidur", keywords: AMENITY_ALIASES.bedrooms },
  { id: "bathrooms", category: "villa", displayEn: "Bathrooms", displayId: "Kamar mandi", keywords: AMENITY_ALIASES.bathrooms },
  { id: "capacity", category: "villa", displayEn: "Guest capacity", displayId: "Kapasitas tamu", keywords: AMENITY_ALIASES.capacity },
  { id: "private_pool", category: "villa", displayEn: "Private pool", displayId: "Kolam pribadi", keywords: AMENITY_ALIASES.private_pool },
  { id: "full_kitchen", category: "villa", displayEn: "Full kitchen", displayId: "Dapur lengkap", keywords: AMENITY_ALIASES.full_kitchen },
  // meta
  { id: "star_rating", category: "meta", displayEn: "Star rating", displayId: "Peringkat bintang", keywords: [], fieldEvidence: HAS_STAR_RATING },
  { id: "rating", category: "meta", displayEn: "Guest rating", displayId: "Rating tamu", keywords: [], fieldEvidence: HAS_RATING },
];

/** Food attribute contract · nex.food_business shares name/contact/
 *  location shape · adds cuisine + dietary + delivery. */
const FOOD_CONTRACT: AttributeDef[] = [
  { id: "address", category: "identity", displayEn: "Address", displayId: "Alamat", keywords: [], fieldEvidence: HAS_ADDRESS },
  { id: "coordinates", category: "identity", displayEn: "Map location", displayId: "Titik peta", keywords: [], fieldEvidence: HAS_COORDS },
  { id: "phone", category: "contact", displayEn: "Phone", displayId: "Telepon", keywords: [], fieldEvidence: HAS_PHONE },
  { id: "whatsapp", category: "contact", displayEn: "WhatsApp", displayId: "WhatsApp", keywords: [], fieldEvidence: HAS_WHATSAPP },
  { id: "website", category: "contact", displayEn: "Website", displayId: "Situs web", keywords: [], fieldEvidence: HAS_WEBSITE },
  { id: "delivery", category: "food", displayEn: "Delivery", displayId: "Antar", keywords: AMENITY_ALIASES.delivery },
  { id: "takeaway", category: "food", displayEn: "Takeaway", displayId: "Bawa pulang", keywords: AMENITY_ALIASES.takeaway },
  { id: "outdoor_seating", category: "food", displayEn: "Outdoor seating", displayId: "Tempat duduk luar", keywords: AMENITY_ALIASES.outdoor_seating },
  { id: "reservations", category: "food", displayEn: "Reservations", displayId: "Reservasi", keywords: AMENITY_ALIASES.reservations },
  { id: "vegetarian", category: "food", displayEn: "Vegetarian options", displayId: "Menu vegetarian", keywords: AMENITY_ALIASES.vegetarian },
  { id: "vegan", category: "food", displayEn: "Vegan options", displayId: "Menu vegan", keywords: AMENITY_ALIASES.vegan },
  { id: "halal", category: "food", displayEn: "Halal", displayId: "Halal", keywords: AMENITY_ALIASES.halal },
  { id: "wifi", category: "facility", displayEn: "Wi-Fi", displayId: "Wi-Fi", keywords: AMENITY_ALIASES.wifi },
  { id: "parking", category: "facility", displayEn: "Parking", displayId: "Parkir", keywords: AMENITY_ALIASES.parking },
  { id: "rating", category: "meta", displayEn: "Guest rating", displayId: "Rating tamu", keywords: [], fieldEvidence: HAS_RATING },
];

/** Service-trade attribute contract · nex.service_business. */
const SERVICE_CONTRACT: AttributeDef[] = [
  { id: "address", category: "identity", displayEn: "Address", displayId: "Alamat", keywords: [], fieldEvidence: HAS_ADDRESS },
  { id: "coordinates", category: "identity", displayEn: "Map location", displayId: "Titik peta", keywords: [], fieldEvidence: HAS_COORDS },
  { id: "phone", category: "contact", displayEn: "Phone", displayId: "Telepon", keywords: [], fieldEvidence: HAS_PHONE },
  { id: "whatsapp", category: "contact", displayEn: "WhatsApp", displayId: "WhatsApp", keywords: [], fieldEvidence: HAS_WHATSAPP },
  { id: "website", category: "contact", displayEn: "Website", displayId: "Situs web", keywords: [], fieldEvidence: HAS_WEBSITE },
  { id: "emergency", category: "service_trade", displayEn: "24 hour / emergency", displayId: "Layanan 24 jam", keywords: AMENITY_ALIASES.emergency },
  { id: "free_quote", category: "service_trade", displayEn: "Free quote", displayId: "Estimasi gratis", keywords: AMENITY_ALIASES.free_quote },
  { id: "personal_trainer", category: "gym", displayEn: "Personal trainer", displayId: "Personal trainer", keywords: AMENITY_ALIASES.personal_trainer },
  { id: "group_classes", category: "gym", displayEn: "Group classes", displayId: "Kelas grup", keywords: AMENITY_ALIASES.group_classes },
  { id: "showers", category: "gym", displayEn: "Showers / lockers", displayId: "Kamar mandi / loker", keywords: AMENITY_ALIASES.showers },
];

/** Commerce (product/marketplace) attribute contract. */
const COMMERCE_CONTRACT: AttributeDef[] = [
  { id: "phone", category: "contact", displayEn: "Phone", displayId: "Telepon", keywords: [], fieldEvidence: HAS_PHONE },
  { id: "whatsapp", category: "contact", displayEn: "WhatsApp", displayId: "WhatsApp", keywords: [], fieldEvidence: HAS_WHATSAPP },
  { id: "website", category: "contact", displayEn: "Website", displayId: "Situs web", keywords: [], fieldEvidence: HAS_WEBSITE },
  { id: "price", category: "commercial", displayEn: "Price", displayId: "Harga", keywords: [], fieldEvidence: HAS_PRICE },
];

/** Transport attribute contract. */
const TRANSPORT_CONTRACT: AttributeDef[] = [
  { id: "phone", category: "contact", displayEn: "Phone", displayId: "Telepon", keywords: [], fieldEvidence: HAS_PHONE },
  { id: "whatsapp", category: "contact", displayEn: "WhatsApp", displayId: "WhatsApp", keywords: [], fieldEvidence: HAS_WHATSAPP },
  { id: "price", category: "commercial", displayEn: "Price", displayId: "Harga", keywords: [], fieldEvidence: HAS_PRICE },
];

/** Places · minimum viable contract. */
const PLACES_CONTRACT: AttributeDef[] = [
  { id: "address", category: "identity", displayEn: "Address", displayId: "Alamat", keywords: [], fieldEvidence: HAS_ADDRESS },
  { id: "coordinates", category: "identity", displayEn: "Map location", displayId: "Titik peta", keywords: [], fieldEvidence: HAS_COORDS },
];

/** Public catalog mapping. */
export const ATTRIBUTE_CONTRACTS: Record<WorldVertical, AttributeDef[]> = {
  accommodation: ACCOMMODATION_CONTRACT,
  food:          FOOD_CONTRACT,
  service:       SERVICE_CONTRACT,
  commerce:      COMMERCE_CONTRACT,
  transport:     TRANSPORT_CONTRACT,
  places:        PLACES_CONTRACT,
};

// ─── Projection ─────────────────────────────────────────────────

function normalizeToken(s: string): string {
  return s.toLowerCase().trim().replace(/[-_]/g, " ").replace(/\s+/g, " ");
}

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_FRESHNESS_MS = 90 * DAY_MS;

/**
 * Derive the evidence tier of the RECORD as a whole.
 *
 * - owner_verified · owner has explicitly claimed / been verified /
 *   is a paying member (i.e. authoritative)
 * - directory      · listed but not owner-claimed (typical Phase A row)
 * - unknown        · nothing listed yet
 */
function recordEvidenceTier(record: WorldRecord): EvidenceTier {
  const os = (record as unknown as { ownerStatus?: string }).ownerStatus;
  const cs = record.claimStatus;
  if (os === "verified" || cs === "claimed" || cs === "paying") return "owner_verified";
  if (cs === "listed" || cs === "invited" || os === "responded" || os === "contacted") return "directory";
  return "unknown";
}

/**
 * Age of the record in ms · derived from the record's updatedAt.
 * When updatedAt is missing / malformed, returns undefined so callers
 * can distinguish "no freshness signal" from "verifiably stale".
 */
function recordAgeMs(record: WorldRecord, nowMs = Date.now()): number | undefined {
  const raw = (record as unknown as { updatedAt?: string }).updatedAt;
  if (!raw || typeof raw !== "string") return undefined;
  const t = Date.parse(raw);
  if (Number.isNaN(t)) return undefined;
  const age = nowMs - t;
  return age >= 0 ? age : 0;
}

/**
 * §7 6-valued state derivation.
 *
 *   directory evidence + owner_verified tier             → KNOWN_YES
 *   directory evidence + directory tier (unclaimed)      → UNVERIFIED
 *   directory evidence + record is STALE past window     → STALE
 *   no evidence at all                                    → UNKNOWN
 *   evidence conflicting across sources                   → CONFLICTING
 *
 * KNOWN_NO is reserved for authoritative "not present" evidence, which
 * is not currently produced by any source in the pipeline. The state
 * exists in the type so future evidence adapters can emit it without
 * another type change.
 */
function resolveStateWithEvidence(input: {
  hasFieldEvidence: boolean;
  amenityTokenMatches: string[];
  recordTier: EvidenceTier;
  ageMs: number | undefined;
  freshnessMs: number;
}): {
  state: AttributeState;
  evidence?: AttributeMapEntry["evidence"];
  evidenceTier?: EvidenceTier;
} {
  const { hasFieldEvidence, amenityTokenMatches, recordTier, ageMs, freshnessMs } = input;
  const positiveEvidence = hasFieldEvidence || amenityTokenMatches.length > 0;
  if (!positiveEvidence) {
    return { state: "UNKNOWN" };
  }
  // CONFLICTING · two DISTINCT canonical amenity tokens both firing on
  // the same attribute is not a conflict (they're aliases). A conflict
  // would require field-evidence AND amenity-evidence disagreeing —
  // which never happens today since field evidence is presence-only
  // (never "not present"). Reserved for when negation-evidence exists.
  // For now, only produce CONFLICTING when we've explicitly detected
  // both KNOWN_YES and KNOWN_NO evidence from different sources.
  // Not reachable in current sources; kept for future use.

  // STALE · positive evidence exists but the record is past the
  // freshness window. Only applies when ageMs is measurable AND the
  // record tier isn't owner_verified (owner-verified evidence doesn't
  // go stale from a passive freshness clock).
  if (ageMs !== undefined && ageMs > freshnessMs && recordTier !== "owner_verified") {
    return {
      state: "STALE",
      evidence: hasFieldEvidence ? "field" : "amenity_token",
      evidenceTier: recordTier,
    };
  }
  // KNOWN_YES · owner-verified record + positive evidence
  if (recordTier === "owner_verified") {
    return {
      state: "KNOWN_YES",
      evidence: hasFieldEvidence ? "field" : "amenity_token",
      evidenceTier: recordTier,
    };
  }
  // UNVERIFIED · directory-listed record + positive evidence but no
  // owner confirmation. This is the §14 category C invariant: evidence
  // exists, but NEX should not present it as an established fact.
  return {
    state: "UNVERIFIED",
    evidence: hasFieldEvidence ? "field" : "amenity_token",
    evidenceTier: recordTier,
  };
}

/**
 * Build the attribute state map for a single record.
 *
 * State semantics (Philip 2026-09-06 · v2):
 *   - KNOWN_YES  · owner-verified evidence
 *   - UNVERIFIED · directory evidence (OSM / listed) without owner claim
 *   - STALE      · positive evidence past freshness window
 *   - UNKNOWN    · no evidence at all
 *   - KNOWN_NO / CONFLICTING · reserved (no source produces them today)
 */
export function projectAttributes(record: WorldRecord, opts?: { nowMs?: number }): AttributeMap {
  const vertical = record.vertical;
  const contract = ATTRIBUTE_CONTRACTS[vertical] ?? [];
  const amenities: string[] = ((record as unknown as { amenities?: readonly string[] }).amenities ?? []) as string[];
  const amenityTokens = new Set(amenities.map(normalizeToken).filter(Boolean));
  const recordTier = recordEvidenceTier(record);
  const ageMs = recordAgeMs(record, opts?.nowMs);

  return contract.map((attr) => {
    const hasFieldEvidence = !!(attr.fieldEvidence && attr.fieldEvidence(record));
    const matches: string[] = [];
    if (attr.keywords.length > 0) {
      for (const kw of attr.keywords) {
        if (amenityTokens.has(normalizeToken(kw))) matches.push(kw);
      }
    }
    // Identity attributes are considered evergreen — no freshness clock.
    // Facility / room / service attributes use per-attribute freshness
    // (defaulting to 90 days).
    const freshnessMs = attr.freshnessMs
      ?? (attr.category === "identity" || attr.category === "meta"
            ? Number.POSITIVE_INFINITY
            : DEFAULT_FRESHNESS_MS);

    const resolved = resolveStateWithEvidence({
      hasFieldEvidence, amenityTokenMatches: matches,
      recordTier, ageMs, freshnessMs,
    });
    const entry: AttributeMapEntry = {
      attribute: attr,
      state: resolved.state,
      evidence: resolved.evidence,
      evidenceTier: resolved.evidenceTier,
      evidenceAgeMs: ageMs,
    };
    return entry;
  });
}

// ─── Information coverage metric (§13) ─────────────────────────

export function computeCoverage(record: WorldRecord, opts?: { nowMs?: number }): InformationCoverage {
  const map = projectAttributes(record, opts);
  const total = map.length;
  let known_yes = 0, known_no = 0, unknown = 0, unverified = 0, conflicting = 0, stale = 0;
  for (const e of map) {
    switch (e.state) {
      case "KNOWN_YES":    known_yes++; break;
      case "KNOWN_NO":     known_no++; break;
      case "UNKNOWN":      unknown++; break;
      case "UNVERIFIED":   unverified++; break;
      case "CONFLICTING":  conflicting++; break;
      case "STALE":        stale++; break;
    }
  }
  const coverage_pct = total === 0 ? 0 : Math.round((known_yes / total) * 100);
  const evidence_pct = total === 0 ? 0 : Math.round(((known_yes + unverified) / total) * 100);
  return {
    vertical: record.vertical,
    total_attributes: total,
    known_yes, known_no, unknown, unverified, conflicting, stale,
    coverage_pct, evidence_pct,
  };
}

// ─── Lookup by keyword (for attribute questions) ────────────────

/** Given a user's keyword ("pool" · "wifi" · "laundry" · "kolam"),
 *  find the matching AttributeDef in the contract for `vertical`. */
export function findAttributeByKeyword(vertical: WorldVertical, keyword: string): AttributeDef | null {
  const contract = ATTRIBUTE_CONTRACTS[vertical] ?? [];
  const k = normalizeToken(keyword);
  for (const attr of contract) {
    if (normalizeToken(attr.id) === k) return attr;
    if (attr.keywords.some((kw) => normalizeToken(kw) === k)) return attr;
    if (normalizeToken(attr.displayEn) === k) return attr;
    if (normalizeToken(attr.displayId) === k) return attr;
  }
  return null;
}

/** State lookup helper. */
export function getAttributeState(map: AttributeMap, attributeId: string): AttributeState {
  const entry = map.find((e) => e.attribute.id === attributeId);
  return entry ? entry.state : "UNKNOWN";
}
