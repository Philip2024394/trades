// src/lib/nex-native/directory/classify-entity-type.ts
//
// NEX Directory · Phase B · Pure classification helper.
//
// What this module is
//   · A pure, exhaustive classification of the sealed 9-value
//     entity_type enum into Directory classifications
//     (business / person / place).
//   · The sole authoritative mapping — Phase C destination routing,
//     Phase A UI chrome, and any later analytics all consume this
//     function. No parallel mappings allowed.
//
// What this module is NOT
//   · Not a routing decision — "which NEX surface does this entity
//     deep-link into?" is Phase C. This module only answers "what
//     kind of thing is this?"
//   · Not public category taxonomy — public categories (Restaurants,
//     Cafés & Coffee, Hotels, Villas, etc.) are a separate concern
//     surfaced via `categoryIds` + the post-175 directory view.
//
// Classification rules (sealed by migration 167 comments)
//   business — place-of-business or legal-entity-oriented commercial
//              listing. Owner-claimable via nex_business.
//
//              food                — restaurants, cafés, bars (place-at-address)
//              accommodation       — hotels, villas, guesthouses
//              service             — place-based service (gyms, salons, dentists, car-repair)
//              vehicle_rental      — rental business at a fixed base location
//              marketplace_seller  — seller keyed to a NEX account, product-focused
//              transport_operator  — legal-entity transport company (bus / taxi / ferry)
//
//   person   — natural-person-oriented listing where the offering is
//              the individual's expertise or labour. Owner-claim
//              creates the NEX user profile.
//
//              professional        — consultants, agencies, freelancers, mobile trades
//              transport_driver    — natural person offering transport
//
//   place    — public or semi-public location, not a claimable business.
//
//              place               — attractions, temples, parks, landmarks

import type { DirectoryClassification, EntityType } from "./types";

// ═════════════════════════════════════════════════════════════════════
// §1 · Sealed classification sets · readonly arrays for test invariants
// ═════════════════════════════════════════════════════════════════════

/** The sealed set of entity_types the Directory treats as businesses.
 *  Owner-claim lands on nex_business / face-cover routing (Phase C). */
export const BUSINESS_ENTITY_TYPES: readonly EntityType[] = [
  "food",
  "accommodation",
  "service",
  "vehicle_rental",
  "marketplace_seller",
  "transport_operator",
] as const;

/** The sealed set of entity_types the Directory treats as persons.
 *  Owner-claim lands on the NEX user profile (Phase C). */
export const PERSON_ENTITY_TYPES: readonly EntityType[] = [
  "professional",
  "transport_driver",
] as const;

/** The sealed set of entity_types the Directory treats as places. Not
 *  claimable; destination is the read-only Directory detail only. */
export const PLACE_ENTITY_TYPES: readonly EntityType[] = [
  "place",
] as const;

// ═════════════════════════════════════════════════════════════════════
// §2 · classifyEntityType · the one authoritative function
// ═════════════════════════════════════════════════════════════════════

/**
 * Classify a canonical entity_type as business / person / place.
 *
 * Pure. Deterministic. Exhaustive. TypeScript's `never` check guards
 * against a future entity_type being added without the classification
 * being updated in the same wave — if migration 167's CHECK gains a
 * tenth value, the switch here will fail to compile until this
 * function (and the three sealed sets above) are updated.
 */
export function classifyEntityType(
  entityType: EntityType,
): DirectoryClassification {
  switch (entityType) {
    case "food":
    case "accommodation":
    case "service":
    case "vehicle_rental":
    case "marketplace_seller":
    case "transport_operator":
      return "business";
    case "professional":
    case "transport_driver":
      return "person";
    case "place":
      return "place";
    default: {
      // Exhaustiveness guard — if the EntityType union ever grows,
      // TS will catch this at compile time.
      const _exhaustive: never = entityType;
      throw new Error(
        `classifyEntityType: unmapped entity_type "${String(_exhaustive)}" · ` +
          `migration 167 added a value without updating ` +
          `src/lib/nex-native/directory/classify-entity-type.ts`,
      );
    }
  }
}

// ═════════════════════════════════════════════════════════════════════
// §3 · Static invariants · module-level
// ═════════════════════════════════════════════════════════════════════
//
// This module is PURE. It:
//   · does NOT read the DB
//   · does NOT access the network, filesystem, clock, or randomness
//   · imports only type-level symbols from ./types
//   · is the sole authority on business/person/place classification
//
// Three sealed sets + one function. If a future wave needs to adjust
// the classification (e.g. transport_operator moves from business to
// person because of a legal-model change), both the switch AND the
// three sealed sets must be updated in lock-step. The classification
// test suite enforces that lock-step via disjoint-union invariants.
