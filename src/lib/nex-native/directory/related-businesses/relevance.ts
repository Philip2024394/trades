// src/lib/nex-native/directory/related-businesses/relevance.ts
//
// NEX Directory · Related Businesses · pure category→related-category
// map + ranking helper.
//
// What this module is
//   · Pure, deterministic, environment-neutral helper that answers:
//     "given a canonical anchor whose entity_type is X, which groups
//      of nearby businesses are relevant to show, in what order, with
//      what weight?"
//   · Consumed by the server-only reader `./service.ts`. Each returned
//     RelatedGroup is one strip the UI will render.
//
// What this module is NOT
//   · Not a database reader (no I/O, no network, no clock, no random).
//   · Not a destination router (that is Phase C).
//   · Not an authority on publication gates (publication is enforced
//     inside `nex.business_directory_v`).
//
// Architectural invariants
//   · Exhaustive switch over AnchorCategory → the TS `never` guard
//     catches an unmapped entity_type at compile time.
//   · All weights in [0, 1]. Weight 1.0 is "most relevant to show in
//     this slot", 0.5 is "less relevant but worth surfacing when space
//     allows". The reader multiplies the inverse-distance score by
//     this weight · the final rank is `(1 / (1 + d/500)) * weight`.
//   · No fabrication. If a group has no results today (e.g. no
//     vehicle_rental canonicals seeded yet) the reader simply drops
//     the group from the response. This module names the groups it
//     would like to show if data exists · it never asserts data exists.
//
// Sealed vocabulary
//   · "Rentals"              — vehicle_rental listings
//   · "Airport transfer"     — transport_driver + transport_operator
//                              with a future subcategory tag
//                              `airport_pickup` once vertical payload
//                              fields are wired
//   · "Food & drink"         — food listings (same vertical)
//   · "Laundry"              — service listings with category_slug
//                              'laundry'
//   · "Attractions"          — place listings
//   · "Accommodation"        — accommodation listings
//
// No "partner" / "recommended by" language anywhere in this file.

import type { EntityType } from "../types";

// ═════════════════════════════════════════════════════════════════════
// §1 · AnchorCategory · the entity_type set this module routes on
// ═════════════════════════════════════════════════════════════════════

/** The entity_type values that may appear as the anchor of a Directory
 *  detail page. Exactly the sealed 9-value entity_type enum from
 *  `nex.business_canonical.ck_bc_entity_type`. Kept as its own alias so
 *  this module is self-documenting and so a future wave that wants to
 *  restrict the set (e.g. "we only show related businesses for anchors
 *  of these N kinds") can tighten it without touching EntityType. */
export type AnchorCategory = EntityType;

// ═════════════════════════════════════════════════════════════════════
// §2 · RelatedGroup · the shape of one strip the UI will render
// ═════════════════════════════════════════════════════════════════════

/** One group the reader queries for and the UI renders as one
 *  horizontally-scrollable strip. Pure data; no behaviour. */
export interface RelatedGroup {
  /** The strip header shown to the visitor (sealed vocabulary above). */
  readonly label: string;
  /** Optional emoji / sealed name for the strip header. Not a stock
   *  photo URL · the UI chooses how to render it. */
  readonly icon?: string;
  /** One or more entity_type values to filter the view by. */
  readonly entityTypes: readonly EntityType[];
  /** Optional sub-filter via `business_canonical.category_ids`. When
   *  non-empty, the reader additionally restricts rows to those whose
   *  `category_ids && $slugs::text[]`. */
  readonly categorySlugs?: readonly string[];
  /** Optional sub-filter via `verticalPayload.*` fields. Reserved for a
   *  future wave when vertical payload is seeded. The reader does NOT
   *  apply this today · leaving the field here keeps the contract
   *  stable so the reader can wire it later without a type break. */
  readonly subcategoryTags?: readonly string[];
  /** Relevance weight in [0, 1]. The reader uses this to rank results
   *  across groups when a global cross-group sort is wanted; within a
   *  single strip the ordering is by distance ascending. */
  readonly relevanceWeight: number;
}

// ═════════════════════════════════════════════════════════════════════
// §3 · groupsForAnchor · the one authoritative mapping
// ═════════════════════════════════════════════════════════════════════

/** Return the ordered list of RelatedGroups to query for an anchor.
 *
 *  Deterministic. Exhaustive over AnchorCategory. The order of the
 *  returned array is the order the UI will render the strips (when
 *  the strip has at least one result). Groups whose data is not yet
 *  seeded (e.g. vehicle_rental in Indonesia today) still appear in
 *  the returned array · the reader is responsible for omitting them
 *  from its response when the DB returns zero rows.
 *
 *  Weights are capped at 1.0 and clamped at 0.0 by test invariants.
 */
export function groupsForAnchor(
  anchor: AnchorCategory,
): readonly RelatedGroup[] {
  switch (anchor) {
    case "accommodation":
      return [
        {
          label: "Rentals",
          icon: "scooter",
          entityTypes: ["vehicle_rental"],
          relevanceWeight: 1.0,
        },
        {
          label: "Airport transfer",
          icon: "airplane",
          entityTypes: ["transport_driver", "transport_operator"],
          // Reserved for the day verticalPayload carries an
          // `airport_pickup` tag · the reader does not apply this
          // filter today. The strip is still useful raw: nearby
          // transport operators are honest related businesses.
          subcategoryTags: ["airport_pickup"],
          relevanceWeight: 1.0,
        },
        {
          label: "Food & drink",
          icon: "food",
          entityTypes: ["food"],
          relevanceWeight: 0.9,
        },
        {
          label: "Laundry",
          icon: "laundry",
          entityTypes: ["service"],
          categorySlugs: ["laundry"],
          relevanceWeight: 0.8,
        },
        {
          label: "Attractions",
          icon: "landmark",
          entityTypes: ["place"],
          relevanceWeight: 0.7,
        },
      ] as const;
    case "food":
      return [
        {
          label: "Rentals",
          icon: "scooter",
          entityTypes: ["vehicle_rental"],
          relevanceWeight: 0.6,
        },
        {
          label: "Food & drink · more nearby",
          icon: "food",
          entityTypes: ["food"],
          relevanceWeight: 0.6,
        },
        {
          label: "Attractions",
          icon: "landmark",
          entityTypes: ["place"],
          relevanceWeight: 0.8,
        },
      ] as const;
    case "vehicle_rental":
      return [
        {
          label: "Food & drink",
          icon: "food",
          entityTypes: ["food"],
          relevanceWeight: 0.9,
        },
        {
          label: "Accommodation",
          icon: "bed",
          entityTypes: ["accommodation"],
          relevanceWeight: 0.9,
        },
        {
          label: "Airport",
          icon: "airplane",
          entityTypes: ["transport_driver", "transport_operator"],
          subcategoryTags: ["airport_pickup"],
          relevanceWeight: 0.8,
        },
      ] as const;
    case "service":
      return [
        {
          label: "Food & drink",
          icon: "food",
          entityTypes: ["food"],
          relevanceWeight: 0.8,
        },
        {
          label: "Accommodation",
          icon: "bed",
          entityTypes: ["accommodation"],
          relevanceWeight: 0.7,
        },
        {
          label: "Rentals",
          icon: "scooter",
          entityTypes: ["vehicle_rental"],
          relevanceWeight: 0.6,
        },
      ] as const;
    case "transport_driver":
    case "transport_operator":
      return [
        {
          label: "Accommodation",
          icon: "bed",
          entityTypes: ["accommodation"],
          relevanceWeight: 0.9,
        },
        {
          label: "Food & drink",
          icon: "food",
          entityTypes: ["food"],
          relevanceWeight: 0.8,
        },
        {
          label: "Attractions",
          icon: "landmark",
          entityTypes: ["place"],
          relevanceWeight: 0.7,
        },
      ] as const;
    case "marketplace_seller":
      return [
        {
          label: "Food & drink",
          icon: "food",
          entityTypes: ["food"],
          relevanceWeight: 0.7,
        },
        {
          label: "Accommodation",
          icon: "bed",
          entityTypes: ["accommodation"],
          relevanceWeight: 0.6,
        },
      ] as const;
    case "place":
      return [
        {
          label: "Food & drink",
          icon: "food",
          entityTypes: ["food"],
          relevanceWeight: 0.9,
        },
        {
          label: "Accommodation",
          icon: "bed",
          entityTypes: ["accommodation"],
          relevanceWeight: 0.9,
        },
        {
          label: "Rentals",
          icon: "scooter",
          entityTypes: ["vehicle_rental"],
          relevanceWeight: 0.8,
        },
      ] as const;
    case "professional":
      return [
        {
          label: "Food & drink",
          icon: "food",
          entityTypes: ["food"],
          relevanceWeight: 0.7,
        },
        {
          label: "Accommodation",
          icon: "bed",
          entityTypes: ["accommodation"],
          relevanceWeight: 0.6,
        },
      ] as const;
    default: {
      // Exhaustiveness guard — if EntityType grows, TS will catch this
      // at compile time.
      const _exhaustive: never = anchor;
      throw new Error(
        `groupsForAnchor: unmapped anchor "${String(_exhaustive)}" · ` +
          `update src/lib/nex-native/directory/related-businesses/relevance.ts`,
      );
    }
  }
}

// ═════════════════════════════════════════════════════════════════════
// §4 · rankScore · pure proximity-weighted score helper
// ═════════════════════════════════════════════════════════════════════

/** Compute the final rank for one result:
 *    rank = (1 / (1 + distance_m / 500)) * relevanceWeight
 *
 *  Pure. Returns a finite number in [0, relevanceWeight]. Negative or
 *  non-finite distances are clamped to 0 metres (treated as "at the
 *  anchor"). The reader uses this when a global cross-group sort is
 *  needed; the UI itself sorts within a strip by distance ascending. */
export function rankScore(distanceM: number, relevanceWeight: number): number {
  const d = Number.isFinite(distanceM) && distanceM > 0 ? distanceM : 0;
  const w =
    Number.isFinite(relevanceWeight) && relevanceWeight > 0
      ? Math.min(relevanceWeight, 1)
      : 0;
  return (1 / (1 + d / 500)) * w;
}

// ═════════════════════════════════════════════════════════════════════
// §5 · formatDistanceLabel · pure distance → short display string
// ═════════════════════════════════════════════════════════════════════

/** Render a distance in metres as a short human label:
 *    < 1000 m   → "350 m"            (rounded to nearest 10 m)
 *    < 10 km    → "1.2 km"            (one decimal)
 *    ≥ 10 km    → "12 km"             (integer)
 *
 *  Pure, deterministic, locale-free. Negative / non-finite values
 *  return the empty string so the UI collapses the distance pill
 *  honestly rather than render "NaN m". */
export function formatDistanceLabel(distanceM: number): string {
  if (!Number.isFinite(distanceM) || distanceM < 0) return "";
  if (distanceM < 1000) {
    const rounded = Math.round(distanceM / 10) * 10;
    return `${rounded} m`;
  }
  const km = distanceM / 1000;
  if (km < 10) return `${km.toFixed(1)} km`;
  return `${Math.round(km)} km`;
}
