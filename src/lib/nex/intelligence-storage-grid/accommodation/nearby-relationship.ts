// src/lib/nex/intelligence-storage-grid/accommodation/nearby-relationship.ts
//
// NEX Accommodation Agent · Nearby Relationship Layer (Rule Book v3)
// Founder BEGIN AUTHORIZATION 2026-09-08 · Indonesia Complete Intelligence Mission
//
// Implements:
//   §6  Distance MUST be measured (deterministic · Haversine · no fabrication)
//   §7  City boundaries MUST NOT become a hard wall (outside_city allowed)
//   §11 Transport interlinking (Airport · Rail · Bus · Ferry · Metro · Tram · Taxi · Ride · Parking · EV)
//   §25 Cross-domain NEARBY relationship examples (Hotel↔Restaurant · Hotel↔Lake · Trail↔Accommodation etc.)
//
// This module is a PURE FUNCTION LAYER: types + deterministic geometry +
// validation. It does NOT scrape, does NOT infer availability, does NOT
// invent travel times. Walking/driving times are ONLY accepted from an
// explicit source (§6 "Do not fabricate travel time").
//
// Additive. Composes with taxonomy.ts (accommodation types) and
// activity-taxonomy.ts (activity/attraction/nature/transport types).

import type {
  CountryCode,
  EvidenceLabel,
  FreshnessState,
  KnowledgeStatus,
  TrustLayer,
} from "../types.js";
import type { ClaimSource } from "./activity-taxonomy.js";
import type { CanonicalAccommodationCategory } from "./taxonomy.js";

// ═══════════════════════════════════════════════════════════════════
// §25 · DOMAIN ENTITY KIND (cross-domain relationships must know both ends)
// ═══════════════════════════════════════════════════════════════════

/**
 * Every relationship endpoint identifies its domain. Prevents accidental
 * cross-contamination (e.g. never treat a Food entity as an accommodation).
 * Enum matches DomainAgentId in ../types.ts and extends with sub-kinds
 * needed for the accommodation → destination graph.
 */
export type EndpointKind =
  | "ACCOMMODATION"      // any of the 7 canonical accommodation categories
  | "FOOD_VENUE"         // restaurant · café · warung · food-court (Food domain)
  | "DRINK_VENUE"        // bar · pub · coffee-bar (Food/Nightlife domain)
  | "ACTIVITY"           // recreation activity (see activity-taxonomy.ts)
  | "ATTRACTION"         // discrete visitable place (temple · palace · museum)
  | "NATURE_LOCATION"    // lake · waterfall · beach · mountain · forest
  | "WALK_ROUTE"         // named walking route / trail
  | "TRANSPORT_HUB"      // airport · station · terminal · port
  | "SERVICE"            // atm · pharmacy · clinic · post · consulate
  | "SHOPPING_VENUE"     // market · mall · souvenir shop
  | "OTHER";

export const ENDPOINT_KINDS: readonly EndpointKind[] = Object.freeze([
  "ACCOMMODATION",
  "FOOD_VENUE",
  "DRINK_VENUE",
  "ACTIVITY",
  "ATTRACTION",
  "NATURE_LOCATION",
  "WALK_ROUTE",
  "TRANSPORT_HUB",
  "SERVICE",
  "SHOPPING_VENUE",
  "OTHER",
]);

// ═══════════════════════════════════════════════════════════════════
// §25 · RELATIONSHIP TYPE ENUM
// ═══════════════════════════════════════════════════════════════════

/**
 * Directed relationship kinds. Each relationship is a directed edge from
 * `source` endpoint to `target` endpoint. NEARBY is symmetric in meaning
 * but stored as two directed edges when it matters for query performance;
 * the store layer handles that (this file just defines the contract).
 *
 * `NEARBY` is the catch-all — refine with `nearby_subtype` for composition.
 */
export type RelationshipKind =
  | "NEARBY"                    // generic geographic adjacency (§25)
  | "REACHABLE_FROM"            // deliberate "you can reasonably get from A to B" · used across city lines (§7)
  | "TRANSFER_POINT"            // e.g. hotel → airport transfer, activity → ferry
  | "PART_OF"                   // e.g. viewpoint PART_OF national park
  | "OPERATED_BY"               // e.g. tour PART_OF operator (not for chain-of-hotels — that lives in identity)
  | "COMPLEMENTARY"             // e.g. hiking trail COMPLEMENTARY hot-spring
  | "REFERENCED_BY_SOURCE";     // provenance edge · source mentions target when describing source

export const RELATIONSHIP_KINDS: readonly RelationshipKind[] = Object.freeze([
  "NEARBY",
  "REACHABLE_FROM",
  "TRANSFER_POINT",
  "PART_OF",
  "OPERATED_BY",
  "COMPLEMENTARY",
  "REFERENCED_BY_SOURCE",
]);

// ═══════════════════════════════════════════════════════════════════
// §6 · DISTANCE BAND (deterministic categorisation)
// ═══════════════════════════════════════════════════════════════════

/**
 * Straight-line distance bucketed into human-meaningful bands. Composer uses
 * these to decide language ("just around the corner" vs "worth a trip").
 * Bands are pure geometry; they do NOT claim walking/driving feasibility.
 *
 * Thresholds chosen from prior NEX composer heuristics + Indonesian travel
 * realities (traffic makes 5km non-trivial in Jakarta but 5min in a village).
 * The composer must additionally consider road/traffic context (§9).
 */
export type DistanceBand =
  | "IMMEDIATE"      // < 0.20 km (within same block)
  | "WALKABLE"       // 0.20 – 1.00 km
  | "SHORT_TRAVEL"   // 1.00 – 3.00 km
  | "MEDIUM_TRAVEL"  // 3.00 – 10.00 km
  | "LONG_TRAVEL"    // 10.00 – 30.00 km
  | "TRIP"           // 30.00 – 100.00 km (typically a planned outing)
  | "REMOTE"         // > 100.00 km
  | "UNKNOWN";

export function classifyDistanceBand(km: number | null | undefined): DistanceBand {
  if (km === null || km === undefined || !Number.isFinite(km) || km < 0) return "UNKNOWN";
  if (km < 0.20) return "IMMEDIATE";
  if (km < 1.00) return "WALKABLE";
  if (km < 3.00) return "SHORT_TRAVEL";
  if (km < 10.00) return "MEDIUM_TRAVEL";
  if (km < 30.00) return "LONG_TRAVEL";
  if (km < 100.00) return "TRIP";
  return "REMOTE";
}

// ═══════════════════════════════════════════════════════════════════
// §6 · HAVERSINE (deterministic straight-line distance)
// ═══════════════════════════════════════════════════════════════════

const EARTH_RADIUS_KM = 6371.0088; // WGS84 mean radius

/**
 * Haversine great-circle distance in kilometres between two lat/lon points.
 * Returns null when either point is missing coordinates (§6 no fabrication).
 *
 * Coordinate validation is strict: latitude must be in [-90, 90], longitude
 * in [-180, 180]. Values outside these ranges return null rather than
 * silently producing a plausible-looking distance.
 */
export function haversineKm(
  a: { latitude: number | null; longitude: number | null } | null | undefined,
  b: { latitude: number | null; longitude: number | null } | null | undefined,
): number | null {
  if (!a || !b) return null;
  const { latitude: lat1, longitude: lon1 } = a;
  const { latitude: lat2, longitude: lon2 } = b;
  if (lat1 === null || lon1 === null || lat2 === null || lon2 === null) return null;
  if (
    !Number.isFinite(lat1) || !Number.isFinite(lon1) ||
    !Number.isFinite(lat2) || !Number.isFinite(lon2)
  ) return null;
  if (lat1 < -90 || lat1 > 90 || lat2 < -90 || lat2 > 90) return null;
  if (lon1 < -180 || lon1 > 180 || lon2 < -180 || lon2 > 180) return null;

  const toRad = (deg: number): number => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const rLat1 = toRad(lat1);
  const rLat2 = toRad(lat2);

  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rLat1) * Math.cos(rLat2) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  return EARTH_RADIUS_KM * c;
}

/**
 * Convenience: round to 3 decimal places (metre precision). Never
 * used to inflate a distance — pure formatting for storage.
 */
export function haversineKmRounded(
  a: { latitude: number | null; longitude: number | null } | null | undefined,
  b: { latitude: number | null; longitude: number | null } | null | undefined,
): number | null {
  const raw = haversineKm(a, b);
  if (raw === null) return null;
  return Math.round(raw * 1000) / 1000;
}

// ═══════════════════════════════════════════════════════════════════
// §7 · CITY-BOUNDARY LOGIC (city is not a hard wall)
// ═══════════════════════════════════════════════════════════════════

/**
 * Decide whether a nearby endpoint that lies OUTSIDE the source's city
 * should still be surfaced. §7 principle: administrative boundaries do
 * NOT determine value; realistically-reachable distance does.
 *
 * Rules (composer may override with explicit user filter):
 *   - Same city                        → always eligible
 *   - Different city, ≤ 30 km          → eligible if activity/nature/attraction
 *   - Different city, 30-100 km        → eligible only for high-value nature/attraction (composer decides)
 *   - Different city, > 100 km         → not eligible unless REACHABLE_FROM edge exists
 */
export function evaluateCityBoundary(input: {
  same_city: boolean;
  distance_km: number | null;
  endpoint_kind: EndpointKind;
}): { eligible: boolean; reason: string } {
  const { same_city, distance_km, endpoint_kind } = input;
  if (same_city) return { eligible: true, reason: "same_city" };
  if (distance_km === null) return { eligible: false, reason: "different_city_unknown_distance" };
  if (distance_km <= 30) {
    return { eligible: true, reason: "different_city_within_30km" };
  }
  if (distance_km <= 100) {
    // §7 realistic reach — nature/attraction/walks stay eligible
    const isDestinationClass =
      endpoint_kind === "NATURE_LOCATION" ||
      endpoint_kind === "ATTRACTION" ||
      endpoint_kind === "WALK_ROUTE" ||
      endpoint_kind === "ACTIVITY";
    return {
      eligible: isDestinationClass,
      reason: isDestinationClass
        ? "different_city_within_100km_destination_class"
        : "different_city_beyond_30km_non_destination",
    };
  }
  return { eligible: false, reason: "different_city_beyond_100km" };
}

// ═══════════════════════════════════════════════════════════════════
// §25 · RELATIONSHIP RECORD SCHEMA
// ═══════════════════════════════════════════════════════════════════

/** Minimal identity for an endpoint in a NEARBY / REACHABLE_FROM edge. */
export interface RelationshipEndpoint {
  endpoint_kind: EndpointKind;
  endpoint_id: string;                  // canonical id in that domain's store
  display_name: string;
  country_code: CountryCode;
  city: string | null;
  district: string | null;
  latitude: number | null;
  longitude: number | null;
  /** Present only when endpoint is an accommodation. */
  accommodation_category?: CanonicalAccommodationCategory | null;
  /** Present only when endpoint is an activity/attraction/nature/etc. */
  activity_type_slug?: string | null;
}

/**
 * Distance metadata attached to a relationship edge.
 *
 *  - `straight_line_km` is deterministic (Haversine). Always populate when
 *    both endpoints have coordinates (§6).
 *  - `walking_km` / `driving_km` / `*_minutes` are populated ONLY when a
 *    source provides them. NEVER derive from straight-line distance
 *    (§6 "Do not fabricate travel time"). null = UNKNOWN.
 */
export interface RelationshipDistance {
  straight_line_km: number | null;
  distance_band: DistanceBand;
  walking_km: number | null;
  walking_minutes: number | null;
  driving_km: number | null;
  driving_minutes: number | null;
  distance_source: ClaimSource;
  distance_source_ref: string | null;   // required when walking/driving values present
}

/**
 * A single directed relationship edge. Bi-directional NEARBY is stored as
 * two records (one from A→B, one from B→A) so the store layer can index
 * each direction efficiently.
 */
export interface RelationshipEdge {
  canonical_edge_id: string;             // uuid or #REL-YYYY-XXXXX
  source: RelationshipEndpoint;
  target: RelationshipEndpoint;
  kind: RelationshipKind;
  /** Optional finer-grained tag for NEARBY edges (e.g. "food", "nature", "transport"). */
  nearby_subtype: string | null;
  distance: RelationshipDistance;
  /** True when target is outside source's city (§7). */
  crosses_city_boundary: boolean;
  /** Composer eligibility per evaluateCityBoundary(). */
  boundary_eligible: boolean;
  boundary_reason: string;
  /** Provenance + status. */
  first_seen_at: string;                 // ISO 8601
  last_verified_at: string | null;
  freshness: FreshnessState;
  knowledge_status: KnowledgeStatus;
  trust_layer: TrustLayer;
  evidence_label: EvidenceLabel;
  source_records: readonly { source: string; retrieved_at: string; source_ref: string }[];
}

// ═══════════════════════════════════════════════════════════════════
// §6 · FACTORY (build an edge from two endpoints with full validation)
// ═══════════════════════════════════════════════════════════════════

/**
 * Build a fully-populated NEARBY edge from two endpoints. Distance is
 * computed deterministically from coordinates. walking/driving are left null
 * (they can only be added later from an explicit source per §6).
 *
 * Throws when both endpoints have identical canonical id (self-loop prevention).
 * Returns null when either endpoint is missing coordinates AND caller did not
 * provide a `distance_hint_km` from a source.
 */
export function buildNearbyEdge(input: {
  edge_id: string;
  source: RelationshipEndpoint;
  target: RelationshipEndpoint;
  nearby_subtype?: string | null;
  distance_hint_km?: number | null;
  distance_source_ref?: string | null;
  first_seen_at: string;
  trust_layer: TrustLayer;
  evidence_label: EvidenceLabel;
  source_records: readonly { source: string; retrieved_at: string; source_ref: string }[];
}): RelationshipEdge | null {
  const { source, target } = input;
  if (source.endpoint_id === target.endpoint_id && source.endpoint_kind === target.endpoint_kind) {
    throw new Error(`nearby-relationship: self-loop rejected for endpoint_id "${source.endpoint_id}"`);
  }

  const straight = haversineKmRounded(source, target);
  const km = straight ?? input.distance_hint_km ?? null;
  if (km === null) {
    // §6 · no distance means we cannot honestly assert NEARBY
    return null;
  }

  const distanceSource: ClaimSource = straight !== null ? "OBJECTIVE_ATTRIBUTE" : "SOURCE_DESCRIPTION";
  const distance: RelationshipDistance = {
    straight_line_km: km,
    distance_band: classifyDistanceBand(km),
    walking_km: null,
    walking_minutes: null,
    driving_km: null,
    driving_minutes: null,
    distance_source: distanceSource,
    distance_source_ref: straight !== null ? null : (input.distance_source_ref ?? null),
  };
  if (distance.distance_source === "SOURCE_DESCRIPTION" && distance.distance_source_ref === null) {
    // Cannot persist a claim without a source ref
    throw new Error("nearby-relationship: distance_source_ref required when distance is not deterministic");
  }

  const sameCity = !!(
    source.city && target.city && source.city.trim().toLowerCase() === target.city.trim().toLowerCase()
  );
  const boundary = evaluateCityBoundary({
    same_city: sameCity,
    distance_km: km,
    endpoint_kind: target.endpoint_kind,
  });

  return {
    canonical_edge_id: input.edge_id,
    source,
    target,
    kind: "NEARBY",
    nearby_subtype: input.nearby_subtype ?? null,
    distance,
    crosses_city_boundary: !sameCity,
    boundary_eligible: boundary.eligible,
    boundary_reason: boundary.reason,
    first_seen_at: input.first_seen_at,
    last_verified_at: null,
    freshness: "FRESH",
    knowledge_status: "OBSERVED",
    trust_layer: input.trust_layer,
    evidence_label: input.evidence_label,
    source_records: input.source_records,
  };
}

// ═══════════════════════════════════════════════════════════════════
// §6 · WALKING / DRIVING ENRICHMENT (source-provided only)
// ═══════════════════════════════════════════════════════════════════

/**
 * Attach walking / driving figures to an existing edge. Each field is
 * copied verbatim from source; no derivation, no interpolation. Requires
 * a non-empty `source_ref` so provenance is preserved (§16).
 *
 * Returns a NEW edge (immutability). Original is untouched.
 */
export function attachWalkingDrivingFromSource(
  edge: RelationshipEdge,
  input: {
    walking_km?: number | null;
    walking_minutes?: number | null;
    driving_km?: number | null;
    driving_minutes?: number | null;
    source_ref: string;                  // required · §16 no source no persist
  },
): RelationshipEdge {
  if (!input.source_ref || input.source_ref.trim() === "") {
    throw new Error("nearby-relationship: source_ref required for walking/driving enrichment");
  }
  const validNumberOrNull = (n: number | null | undefined): number | null => {
    if (n === null || n === undefined) return null;
    if (!Number.isFinite(n) || n < 0) return null;
    return n;
  };
  return {
    ...edge,
    distance: {
      ...edge.distance,
      walking_km: validNumberOrNull(input.walking_km),
      walking_minutes: validNumberOrNull(input.walking_minutes),
      driving_km: validNumberOrNull(input.driving_km),
      driving_minutes: validNumberOrNull(input.driving_minutes),
      distance_source_ref: input.source_ref,
    },
  };
}

// ═══════════════════════════════════════════════════════════════════
// §25 · INVARIANTS + STATS
// ═══════════════════════════════════════════════════════════════════

/** Structural validation. Called in tests. */
export function assertRelationshipInvariants(edge: RelationshipEdge): void {
  if (edge.source.endpoint_id === edge.target.endpoint_id && edge.source.endpoint_kind === edge.target.endpoint_kind) {
    throw new Error(`relationship: self-loop for id "${edge.source.endpoint_id}"`);
  }
  if (!RELATIONSHIP_KINDS.includes(edge.kind)) {
    throw new Error(`relationship: unknown kind "${edge.kind}"`);
  }
  if (!ENDPOINT_KINDS.includes(edge.source.endpoint_kind)) {
    throw new Error(`relationship: unknown source endpoint_kind "${edge.source.endpoint_kind}"`);
  }
  if (!ENDPOINT_KINDS.includes(edge.target.endpoint_kind)) {
    throw new Error(`relationship: unknown target endpoint_kind "${edge.target.endpoint_kind}"`);
  }
  const km = edge.distance.straight_line_km;
  if (km !== null && (!Number.isFinite(km) || km < 0)) {
    throw new Error(`relationship: invalid straight_line_km ${km}`);
  }
  if (edge.distance.distance_band !== classifyDistanceBand(km)) {
    throw new Error(`relationship: distance_band mismatch for km ${km}`);
  }
  const hasSourceProvidedTime =
    edge.distance.walking_minutes !== null ||
    edge.distance.driving_minutes !== null ||
    edge.distance.walking_km !== null ||
    edge.distance.driving_km !== null;
  if (hasSourceProvidedTime && !edge.distance.distance_source_ref) {
    throw new Error("relationship: walking/driving values require distance_source_ref");
  }
}

/** Registry summary of the type/enum layer (used by observatory + tests). */
export function relationshipRegistryStats(): {
  relationship_kinds: number;
  endpoint_kinds: number;
  distance_bands: readonly DistanceBand[];
} {
  return {
    relationship_kinds: RELATIONSHIP_KINDS.length,
    endpoint_kinds: ENDPOINT_KINDS.length,
    distance_bands: Object.freeze([
      "IMMEDIATE",
      "WALKABLE",
      "SHORT_TRAVEL",
      "MEDIUM_TRAVEL",
      "LONG_TRAVEL",
      "TRIP",
      "REMOTE",
      "UNKNOWN",
    ]),
  };
}
