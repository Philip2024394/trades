// NEX Indonesia Data Machine · canonical types.
//
// Everything that flows through the acquisition pipeline eventually
// becomes an EntityRecord. This file defines the shape once so
// walkers, pipeline, verification, conflict resolution, dedupe,
// retrieval and HQ reporting share one vocabulary.
//
// Design tenets (Philip 2026-08-30):
//   · One canonical entity model · Place, Business, Government,
//     Knowledge, Service — all subtypes of EntityRecord.
//   · Every record carries lifecycle, provenance, geo, freshness,
//     quality, and (when applicable) contactability.
//   · Records are IMMUTABLE observations. Multiple observations of
//     the same real-world thing merge into one canonical entity via
//     the entity-resolution layer — the observations themselves are
//     preserved so provenance is never destroyed.
//   · Backward-compatible with existing KnowledgeRecord — the older
//     type is a valid EntityRecord with EntityKind="knowledge" and
//     default provenance/quality values filled in on load.

// ─── Lifecycle ─────────────────────────────────────────────────────

/** Every record traverses this state machine from acquisition to
 *  serving. Failed records go into FAILED but are NEVER silently
 *  dropped — the failure reason is preserved for audit. */
export type RecordLifecycle =
  | "DISCOVERED"    // a walker found a candidate reference
  | "ACQUIRED"      // raw payload fetched from source
  | "NORMALIZED"    // parsed into EntityRecord shape
  | "VALIDATING"    // being cross-checked against other sources
  | "VERIFIED"      // confidence exceeds min threshold, ready to enrich
  | "ENRICHED"      // Q&A generated, geo hierarchy filled, related entities linked
  | "PUBLISHED"     // served to users
  | "STALE"         // past its refreshAfter; scheduled for re-verification
  | "REFRESHING"    // walker is re-acquiring
  | "UPDATED"       // refresh brought new information; new observation attached
  | "SUPERSEDED"    // a newer/better record has taken this one's place
  | "FAILED";       // permanent failure (goes to dead-letter, retained for audit)

// ─── Source tiering ────────────────────────────────────────────────

/** Authority tier of a source. Determines conflict-resolution
 *  weight — Tier A wins over Tier C without corroboration. */
export type SourceTier =
  | "A"   // authoritative (government, BMKG, MAGMA, BPJPH, official business site with cert)
  | "B"   // strong commercial (established directories, verified profiles, big OTAs)
  | "C"   // discovery (OSM, public directories, general web)
  | "D";  // weak signal (social, unverified UGC — discovery only, never a fact source)

/** How reliable this specific source has been over time (0..1). Updated
 *  by observed accuracy vs. corroboration. */
export type SourceReliability = number;

/**
 * Country/region scope the source belongs to · Philip 2026-08-31
 * market-scoped-knowledge doctrine · CONSTITUTIONAL.
 *
 * Every walker / seed / live source MUST declare a market. Retrieval
 * uses market to prevent UK staircase knowledge from ever surfacing
 * for an Indonesian user (and vice-versa). Market is inferred nowhere
 * · always explicit at the producer.
 *
 * "UNIVERSAL" is reserved for genuinely market-agnostic knowledge
 * (physics, chemistry, cross-market travel documents). Not for
 * "we forgot to set it". Missing = UNKNOWN.
 */
export type Market = "ID" | "UK" | "US" | "UNIVERSAL" | "UNKNOWN";

export type ProvenanceRef = {
  /** Walker ID that produced the observation. */
  walkerId: string;
  /** Source system identifier. */
  sourceKey: string;
  /** Human-readable source name. */
  sourceName: string;
  sourceTier: SourceTier;
  sourceReliability?: SourceReliability;
  /**
   * Market/country the source's knowledge belongs to. When absent
   * (legacy pre-doctrine records), treated as UNKNOWN by retrieval
   * filters · loud rather than silent. Backfill via `data:backfill-market`.
   */
  market?: Market;
  /** URL / path / identifier of the specific record. */
  sourceUrl?: string;
  /** ISO date · first time this observation was seen. */
  firstDiscoveredAt: string;
  /** ISO date · most recent time this observation was fetched. */
  lastCheckedAt: string;
  /** ISO date · most recent time the observation's content changed. */
  lastChangedAt: string;
  /** Extraction / observation timestamp for this specific reading. */
  observedAt: string;
};

// ─── Freshness ─────────────────────────────────────────────────────

/** How quickly this class of information goes stale. Drives the
 *  supervisor's refresh scheduling. */
export type FreshnessPolicy =
  | "live"          // sub-minute (weather, earthquake, volcano alert)
  | "very_fast"     // minutes (traffic, transport disruption)
  | "hourly"        // hourly (opening status, availability, events tonight)
  | "daily"         // day (prices, event details)
  | "weekly"        // week (business contactability, restaurant status)
  | "monthly"       // month (business metadata, place descriptions)
  | "seasonal"      // 3 months (tourism seasonality, festival calendar)
  | "long_lived";   // > 6 months (history, geography, culture, traditions)

export type FreshnessState = {
  policy: FreshnessPolicy;
  /** ISO date · last successful verification. */
  lastVerifiedAt?: string;
  /** ISO date · when this record next requires re-check. */
  nextRefreshAt?: string;
  /** Computed 0..1 · 0 = fresh, 1 = badly stale. */
  staleness?: number;
};

// ─── Geo hierarchy ─────────────────────────────────────────────────

/** Where in Indonesia this record refers to. Every walker must
 *  produce at least province + region when the record is geographic. */
export type GeoLocation = {
  /** ISO 3166-2 subdivision code (e.g. "ID-BA" for Bali) or NEX-internal
   *  province slug for the 38 provinces. */
  province?: string;
  /** kota/kabupaten (regency/city) name. */
  regency?: string;
  /** kecamatan (district) name. */
  district?: string;
  /** kelurahan/desa (village) name. */
  village?: string;
  /** Neighborhood or informal area. */
  neighborhood?: string;
  /** Decimal latitude. */
  lat?: number;
  /** Decimal longitude. */
  lng?: number;
  /** Confidence in this geo assignment (0..1). */
  geoConfidence?: number;
  /** The Indonesian island (Sumatra / Java / Kalimantan / Sulawesi / Papua / Nusa Tenggara / Maluku / Bali). */
  island?: string;
};

// ─── Contactability (commercial entities) ─────────────────────────

export type ContactChannel = {
  kind: "phone" | "whatsapp" | "email" | "website" | "instagram" | "facebook" | "tiktok" | "booking" | "other";
  value: string;
  /** ISO date · when this channel was last confirmed reachable. */
  lastVerifiedAt?: string;
  verified: boolean;
};

export type ContactabilityLevel =
  | "unknown"          // we don't have contact info
  | "exists"           // record exists but no verified channel
  | "contactable"      // at least one verified channel
  | "bookable"         // a booking URL/API exists
  | "transaction_ready"; // NEX can complete a transaction

// ─── Quality scoring ──────────────────────────────────────────────

/** 8-dimension quality score. Each subscore is 0..1. `overall` is
 *  the weighted composite the retrieval layer sorts on. */
export type QualityScore = {
  identity: number;       // do we know what this is?
  location: number;       // do we know where it is?
  contact: number;        // can we reach it?
  sourceQuality: number;  // how good is the source(s)?
  freshness: number;      // how recent is verification?
  completeness: number;   // how many important fields are filled?
  verification: number;   // has it been cross-checked?
  conflict: number;       // penalty for unresolved conflicts (1=none, 0=all)
  overall: number;        // weighted composite
};

// ─── Change events ────────────────────────────────────────────────

/** A single field change detected between an old observation and a
 *  new one. Preserved on the entity for audit and for user-facing
 *  "this changed on X" surfaces. */
export type ChangeEvent = {
  at: string;
  field: string;
  from: unknown;
  to: unknown;
  sourceKey: string;
  reason?: string;
};

// ─── Entity kinds ─────────────────────────────────────────────────

export type EntityKind =
  | "place"        // beach, mountain, village, landmark, natural feature
  | "business"     // restaurant, hotel, shop, service provider (commercial)
  | "government"   // airport, hospital, immigration, government office (infra)
  | "knowledge"    // fact/article about culture, food, tradition (encyclopedic)
  | "service";     // orderable service (taxi ride, delivery, quote)

// ─── The canonical entity record ──────────────────────────────────
//
// Every walker eventually produces one of these. Fields marked
// REQUIRED are enforced by the pipeline validator; optional fields
// depend on entity kind.

export type EntityRecord = {
  /** Canonical NEX entity ID (stable across observations). REQUIRED. */
  id: string;
  /** The kind of thing this describes. REQUIRED. */
  kind: EntityKind;
  /** Category within the kind ("landmark.beach", "business.restaurant"). */
  category?: string;
  /** Display name. REQUIRED. */
  name: string;
  /** Longer description. Optional for compact records. */
  description?: string;
  /** Free-text tags / keywords. */
  keywords: string[];

  /** Lifecycle stage. REQUIRED. */
  lifecycle: RecordLifecycle;
  /** ISO date · when this stage was entered. */
  lifecycleChangedAt: string;
  /** Reason for the last lifecycle change (for FAILED / SUPERSEDED / STALE). */
  lifecycleReason?: string;

  /** Every source that has observed this entity. Never empty. */
  provenance: ProvenanceRef[];

  /** How stale is it allowed to be. */
  freshness: FreshnessState;

  /** Where it is (for geographic entities; may be empty for pure knowledge). */
  geo?: GeoLocation;

  /** Contact info (commercial entities). */
  contacts?: ContactChannel[];
  contactability?: ContactabilityLevel;

  /** 8-dimension quality score. */
  quality?: QualityScore;

  /** Change history across observations. */
  changeHistory?: ChangeEvent[];

  /** Free-form kind-specific payload (menu, room types, hours JSON,
   *  festival dates, cultural notes, etc.). Not searched by default;
   *  the answer engine reads it when the user asks for detail. */
  attributes?: Record<string, unknown>;

  /** Related entity IDs by relation type ("near", "part_of", "serves"). */
  relations?: Record<string, string[]>;

  /** Q&A variants generated by the pipeline (unchanged from existing
   *  knowledge walkers). */
  questions?: string[];
  aliases?: string[];
};
