// src/lib/nex/brain/world-adapters/types.ts
//
// Stage 3.34 · Phase 27 · World Access Contract (Philip 2026-08-31).
//
// CONSTITUTIONAL. Locks the Brain's relationship with the World.
//
//   NEX does NOT memorise the World. NEX has RELIABLE ACCESS to the World.
//
// Every adapter under ./world-adapters implements this contract so the
// Brain doesn't care whether the underlying source is Postgres, an HTTP
// API, or another approved World subsystem. When a directory record
// changes, the next `searchWorld()` call sees the update — no sync, no
// cache, no rebuild.
//
// The Registry pattern makes new verticals plug in without touching
// composers: register the adapter here, add the vertical to the
// dispatch map in ./index.ts, and Presentation renders it uniformly.
//
// Golden rules (never violate):
//   1. Never fabricate a field. Unknown stays unknown (null).
//   2. Never invent price/rating/availability/booking.
//   3. Respect the vertical's own visibility gate (same rule the public
//      /accommodation | /food | /nex-market pages use).
//   4. Provenance MUST accompany every record (which source, when read).
//   5. Number of records returned = number of REAL matches. Never pad.

/**
 * Verticals the Brain can query. Grow this union when adding an
 * adapter — the dispatch registry in ./index.ts enforces exhaustiveness.
 */
export type WorldVertical =
  | "accommodation"
  | "food"
  | "service"
  | "commerce"      // marketplace products/sellers
  | "transport"     // mobility (rides, deliveries)
  | "places";       // future: tourism, landmarks

export type MarketCode = "ID" | "UK" | "US";

/**
 * Canonical record shape the Brain receives from any adapter.
 * All fields except `id`, `name`, `vertical`, `market`, `provenance`
 * are OPTIONAL — an adapter only populates what its source actually
 * knows. This is the honesty invariant expressed as a type.
 */
export type WorldRecord = {
  /** Stable canonical id · unique within (vertical, market). */
  id: string;
  /** Human-readable name for display in cards, replies, references. */
  name: string;
  vertical: WorldVertical;
  market: MarketCode;

  /** Sub-classification (e.g. accommodation: "hotel"|"guesthouse"|"villa"|"kos"). */
  category?: string;
  categories?: readonly string[];

  /** Geographic anchoring. */
  city?: string;
  district?: string;
  area?: string;
  address?: string;
  latitude?: number;
  longitude?: number;

  /** Contact — expose an action only if the field is present. */
  phone?: string;
  whatsapp?: string;
  website?: string;
  socialLinks?: Readonly<Record<string, string>>;

  /** Media — only surface images an owner or approved source provided. */
  heroImage?: string;
  images?: readonly string[];

  /** Ratings/reviews — nullable · never fabricate. */
  rating?: number;
  reviewCount?: number;
  starRating?: number;

  /** Inventory / capacity (vertical-specific · e.g. rooms for hotels). */
  roomCount?: number;
  amenities?: readonly string[];

  /** Editorial/description (owner or moderated). */
  description?: string;
  openingHours?: string;

  /** Pricing · always in local currency minor units when present.
   *  Nullable because the directory rarely publishes live prices. */
  price?: number;
  priceRange?: { min: number; max: number; currency: string };

  /** Availability signal — nullable. Real live-booking data only. */
  availability?: "available" | "limited" | "unavailable";

  /** Trust / promotion state. Adapters MUST filter out records the
   *  vertical's visibility rule excludes; this field is metadata for
   *  the Brain to reason about claimed vs unclaimed listings. */
  claimStatus?: "listed" | "invited" | "claimed" | "paying";
  verified?: boolean;

  /** Provenance · MANDATORY on every record. Which source, when read.
   *  Used by Confidence + Reflection to justify claims. */
  provenance: {
    sourceKey: string;      // e.g. "nex.accommodation_business"
    sourceTier: "directory_live" | "editorial" | "live_api" | "curated";
    readAt: string;         // ISO timestamp of the DB read
    ownerProvided?: boolean;
  };

  /** When the record was last modified in the source (if the source
   *  tracks it). Enables Freshness/staleness reasoning. */
  updatedAt?: string;
};

/**
 * Search input. Every adapter accepts the same shape; adapters ignore
 * fields their vertical doesn't understand (e.g. Commerce ignores
 * `amenities`, Accommodation ignores `brand`).
 */
export type WorldSearchInput = {
  vertical: WorldVertical;
  market: MarketCode;

  /** Free-text query · adapter decides how to tokenize / rank. */
  query?: string;

  /** Structured filters — the Brain's Intent + Slots feed here. */
  city?: string;
  area?: string;
  category?: string;
  categories?: readonly string[];
  budget?: "budget" | "mid" | "luxury";
  guests?: number;
  amenities?: readonly string[];

  /** Geo-radius from a centroid (km). Only applied when adapter has coords. */
  nearLat?: number;
  nearLng?: number;
  radiusKm?: number;

  /** Result window. */
  limit?: number;   // default 50
  offset?: number;  // default 0

  /** Ranking preference. Adapter picks a sensible default. */
  sort?: "relevance" | "distance" | "rating" | "price_asc" | "price_desc" | "recent";
};

export type WorldSearchResult = {
  vertical: WorldVertical;
  market: MarketCode;
  /** Ranked list of REAL records that survived the visibility gate. */
  records: readonly WorldRecord[];
  /** Total available before pagination — useful for "N total matches". */
  totalAvailable: number;
  /** How long the underlying query took (ms). For latency budgeting. */
  latencyMs: number;
  /** Non-null when the adapter had to degrade (e.g. skipped geo filter
   *  because coords are missing on most rows). The Brain surfaces this
   *  as an honesty caveat. */
  degradedReason?: string;
};

/**
 * Every vertical adapter implements this. The Brain never talks to a
 * pool, table, or connector directly — always through an adapter.
 */
export interface WorldAdapter {
  vertical: WorldVertical;
  /** Return records honouring the vertical's visibility gate. */
  search(input: WorldSearchInput): Promise<WorldSearchResult>;
  /** Fetch one record by id (for Reference Resolution follow-ups). */
  getById?(input: { id: string; market: MarketCode }): Promise<WorldRecord | null>;
}
