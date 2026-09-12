// src/lib/nex/entity-universe/query.ts
//
// NEX Entity Universe · Read-side helpers
// Philip 2026-09-06 · FOUNDER CEREMONIAL AUTHORIZATION · Agent Runtime Phase B
//
// §21 · customer queries flow through here to reach the underlying
// evidence. Never fabricate. Never guess. Never return HISTORICAL as
// current (§4).

import type {
  BusinessId,
  BusinessIdentity,
  BusinessPlacement,
  CitySlug,
  ProvinceCode,
  WorldRecordRef,
} from "./types";
import type { WorldVertical } from "../brain/world-adapters/types";
import {
  readAllBusinesses,
  readAllPlacements,
  readAllPlacementsForBusiness,
  readActivePlacementsForBusiness,
  readBusiness,
  readChangesForBusiness,
} from "./persistence";

// ── Business detail (§21 · composes identity + placements + changes) ──

export type BusinessDetail = {
  identity: BusinessIdentity;
  active_placements: BusinessPlacement[];
  historical_placements: BusinessPlacement[];
  closed_placements: BusinessPlacement[];
  ambiguous_placements: BusinessPlacement[];
  change_history_count: number;
  /** §22 · honest evidence-based summary flags the reader can render. */
  discovery_flags: {
    has_active_location: boolean;
    has_multiple_active_locations: boolean;
    has_any_historical_location: boolean;
    has_ambiguity: boolean;
  };
};

export function readBusinessDetail(business_id: BusinessId): BusinessDetail | null {
  const identity = readBusiness(business_id);
  if (!identity) return null;
  const allPlacements = readAllPlacementsForBusiness(business_id);
  const active = allPlacements.filter((p) => p.status === "ACTIVE" || p.status === "STARTING");
  const historical = allPlacements.filter((p) => p.status === "HISTORICAL");
  const closed = allPlacements.filter((p) => p.status === "CLOSED");
  const ambiguous = allPlacements.filter((p) => p.status === "AMBIGUOUS" || p.status === "CONFLICTING");
  const changesCount = readChangesForBusiness(business_id).length;
  return {
    identity,
    active_placements: active,
    historical_placements: historical,
    closed_placements: closed,
    ambiguous_placements: ambiguous,
    change_history_count: changesCount,
    discovery_flags: {
      has_active_location: active.length > 0,
      has_multiple_active_locations: active.length > 1,
      has_any_historical_location: historical.length > 0,
      has_ambiguity: ambiguous.length > 0,
    },
  };
}

// ── Discovery queries ──────────────────────────────────────────────

/** Return all businesses with at least one ACTIVE placement in the
 *  given city. Never returns HISTORICAL / CLOSED / REMOVED placements
 *  as "in this city" (§4 immutable). */
export function findActiveBusinessesByCity(city_slug: CitySlug): { business: BusinessIdentity; placement: BusinessPlacement }[] {
  const placements = readAllPlacements().filter(
    (p) => p.location.city_slug === city_slug && p.status === "ACTIVE",
  );
  const businesses = readAllBusinesses();
  const bmap = new Map(businesses.map((b) => [b.business_id, b]));
  const out: { business: BusinessIdentity; placement: BusinessPlacement }[] = [];
  for (const p of placements) {
    const b = bmap.get(p.business_id);
    if (b) out.push({ business: b, placement: p });
  }
  return out;
}

export function findActiveBusinessesByProvince(province_code: ProvinceCode): { business: BusinessIdentity; placement: BusinessPlacement }[] {
  const placements = readAllPlacements().filter(
    (p) => p.location.province_code === province_code && p.status === "ACTIVE",
  );
  const businesses = readAllBusinesses();
  const bmap = new Map(businesses.map((b) => [b.business_id, b]));
  const out: { business: BusinessIdentity; placement: BusinessPlacement }[] = [];
  for (const p of placements) {
    const b = bmap.get(p.business_id);
    if (b) out.push({ business: b, placement: p });
  }
  return out;
}

export function findActiveBusinessesByCategory(input: {
  vertical: WorldVertical;
  sub_category?: string | null;
  city_slug?: CitySlug | null;
}): { business: BusinessIdentity; placement: BusinessPlacement }[] {
  const placements = readAllPlacements().filter((p) => {
    if (p.status !== "ACTIVE") return false;
    if (p.category.vertical !== input.vertical) return false;
    if (input.sub_category != null) {
      const inList = p.category.sub_category === input.sub_category
        || p.category.additional_sub_categories.includes(input.sub_category);
      if (!inList) return false;
    }
    if (input.city_slug != null && p.location.city_slug !== input.city_slug) return false;
    return true;
  });
  const businesses = readAllBusinesses();
  const bmap = new Map(businesses.map((b) => [b.business_id, b]));
  const out: { business: BusinessIdentity; placement: BusinessPlacement }[] = [];
  for (const p of placements) {
    const b = bmap.get(p.business_id);
    if (b) out.push({ business: b, placement: p });
  }
  return out;
}

/** Given a WorldRecord.id, return the BusinessIdentity + all of its
 *  placements. Empty when the world record has not yet been linked
 *  into the universe. */
export function findBusinessForWorldRecord(world_record_ref: WorldRecordRef): BusinessDetail | null {
  const linked = readAllPlacements().find((p) => p.world_record_ref === world_record_ref);
  if (!linked) return null;
  return readBusinessDetail(linked.business_id);
}

/** All ACTIVE placements for a business — the answer to "does that
 *  business have another branch?" */
export function siblingActiveLocations(business_id: BusinessId): BusinessPlacement[] {
  return readActivePlacementsForBusiness(business_id);
}

/** Where did the business used to be? Ordered oldest first. */
export function historicalLocations(business_id: BusinessId): BusinessPlacement[] {
  return readAllPlacementsForBusiness(business_id)
    .filter((p) => p.status === "HISTORICAL")
    .sort((a, b) => a.registered_at_iso.localeCompare(b.registered_at_iso));
}
