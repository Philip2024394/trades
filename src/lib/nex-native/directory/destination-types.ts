// src/lib/nex-native/directory/destination-types.ts
//
// NEX Directory · Phase C · Destination contract types.
//
// What this module is
//   · The typed destination contract — the discriminated union a
//     canonical row resolves into. Every Directory listing produces
//     exactly one DirectoryDestination; the UI (Phase A) renders
//     a card differently based on the destination kind.
//   · The typed OwnerClaim input shape the resolver consumes. The
//     Phase A service layer fetches claims from NEX's existing
//     owner tables (nex_business, nex_account_profile) and passes
//     them in; the resolver NEVER fabricates a slug or handle.
//
// What this module is NOT
//   · Not the Layer-B canonical resolver — that answers "which
//     canonical entity does this candidate represent?" (identity).
//     This module answers "where inside NEX does the user go when
//     they click this canonical entity?" (destination).
//   · Not a route table — the actual Next.js routes live under
//     src/app/nex-native/*. This module provides typed paths so
//     the UI can href them without reconstructing them locally.
//   · Not a claim flow — the "claim_available" destination kind
//     signals an unclaimed canonical row; the claim surface itself
//     is a future wave (owner-claim architecture is explicitly
//     deferred — not in Phase C's scope).
//
// Architectural invariants
//   · Every resolved kind carries exactly the data the UI needs to
//     render + navigate.
//   · Unresolved cases are explicit (kind: "unresolved") with a
//     typed reason; the UI must NOT make them clickable.
//   · No fabricated URLs — slug/handle come from OwnerClaim, which
//     is the caller's responsibility to supply from a real DB row.

import type { DirectoryClassification } from "./types";

// ═════════════════════════════════════════════════════════════════════
// §1 · The NEX route pattern constants · one source of truth
// ═════════════════════════════════════════════════════════════════════

/**
 * The verbatim Next.js dynamic route pattern for an owner-claimed
 * NEX Business cover. Matches `src/app/nex-native/[businessSlug]/page.tsx`.
 *
 * Pattern token: `{slug}`.
 */
export const NEX_BUSINESS_ROUTE_PATTERN = "/nex-native/{slug}" as const;

/**
 * The verbatim Next.js dynamic route pattern for an owner-claimed
 * NEX user profile. Matches `src/app/nex-native/u/[handle]/page.tsx`.
 *
 * Pattern token: `{handle}`.
 */
export const NEX_USER_PROFILE_ROUTE_PATTERN = "/nex-native/u/{handle}" as const;

// ═════════════════════════════════════════════════════════════════════
// §2 · OwnerClaim · the resolver's claim-lookup input
// ═════════════════════════════════════════════════════════════════════

/**
 * The claim-link a canonical row has into NEX's owner-controlled
 * tables. Supplied by the caller (Phase A service layer) from a real
 * DB row — the resolver NEVER manufactures these values.
 *
 *   kind "business" — this canonical row is linked to a
 *                     `nex_business` row with the given `slug`.
 *                     Destination is the owner's existing cover.
 *   kind "profile"  — this canonical row is linked to a
 *                     `nex_account_profile` row with the given
 *                     `handle` (nex-XXXXX form). Destination is
 *                     the owner's existing user profile.
 *
 * The link itself (canonical_business_id → nex_business.id, or
 * canonical_business_id → nex_account.id) does not currently exist
 * in the DB (migration 169 is deferred for the legacy backfill +
 * cross-DB handling for nex_business.canonical_business_id). Phase
 * A's service layer will supply `null` for every row until that FK
 * lands; the resolver handles that correctly via the
 * "claimed_without_link" unresolved reason when lifecycle says
 * OWNER_CLAIMED but no claim is passed in.
 */
export type OwnerClaim =
  | {
      readonly kind: "business";
      readonly slug: string;
    }
  | {
      readonly kind: "profile";
      readonly handle: string;
    };

// ═════════════════════════════════════════════════════════════════════
// §3 · UnresolvedReason · typed enum of "why not actionable"
// ═════════════════════════════════════════════════════════════════════

/**
 * The sealed set of reasons the resolver can report an unresolved
 * destination. Each one is a genuine, truthful state the DB can
 * express — never a placeholder.
 *
 *   superseded_without_target     — the row's lifecycle_state is
 *                                   SUPERSEDED but `superseded_by_
 *                                   business_id` is NULL. Rare;
 *                                   defensive (migration 167's
 *                                   CHECKs prevent self-loops but
 *                                   not missing targets).
 *   claimed_without_link          — lifecycle_state is OWNER_CLAIMED
 *                                   or OWNER_VERIFIED but no claim
 *                                   lookup result was supplied.
 *                                   Indicates an upstream data
 *                                   inconsistency; the UI must not
 *                                   fabricate a destination.
 *   claim_classification_mismatch — the claim kind (business/profile)
 *                                   does not match the canonical
 *                                   entity's classification
 *                                   (business/person/place). E.g. a
 *                                   person entity received a
 *                                   business-slug claim link.
 *                                   Defensive guard.
 */
export type UnresolvedReason =
  | "superseded_without_target"
  | "claimed_without_link"
  | "claim_classification_mismatch";

// ═════════════════════════════════════════════════════════════════════
// §4 · DirectoryDestination · the discriminated union
// ═════════════════════════════════════════════════════════════════════

/**
 * Where a Directory listing goes when the user acts on it. Every
 * canonical row resolves to exactly one destination.
 *
 *   nex_business              — owner-claimed business cover.
 *                               `path` is the absolute Next.js route
 *                               derived from NEX_BUSINESS_ROUTE_PATTERN.
 *   nex_user_profile          — owner-claimed user profile. `path`
 *                               is the absolute Next.js route derived
 *                               from NEX_USER_PROFILE_ROUTE_PATTERN.
 *                               The existing /u/{handle} page is
 *                               Connect-capable per Phase 3A.
 *   claim_available           — the row has no owner claim yet.
 *                               `classification` tells the UI which
 *                               claim surface to invite the user into
 *                               (business claim vs profile claim).
 *                               The actual claim route is a future
 *                               wave; Phase C only signals the
 *                               invitation.
 *   redirect_to_canonical     — the row is SUPERSEDED by another
 *                               canonical row. The caller should
 *                               re-resolve against `targetBusinessId`
 *                               (which may itself be claimed, place,
 *                               etc. — the chain terminates in a
 *                               non-SUPERSEDED row by lifecycle
 *                               discipline).
 *   place_detail              — the row's entity_type is `place`
 *                               (classification "place"). Not
 *                               claimable; the UI renders a read-only
 *                               Directory detail. The actual detail
 *                               route is Phase A.
 *   unresolved                — the row cannot be given a destination
 *                               honestly. UI MUST NOT make it
 *                               clickable. `reason` is one of the
 *                               sealed UnresolvedReason values.
 */
export type DirectoryDestination =
  | {
      readonly kind: "nex_business";
      readonly slug: string;
      readonly path: string;
    }
  | {
      readonly kind: "nex_user_profile";
      readonly handle: string;
      readonly path: string;
    }
  | {
      readonly kind: "claim_available";
      readonly canonicalBusinessId: string;
      readonly classification: Exclude<DirectoryClassification, "place">;
    }
  | {
      readonly kind: "redirect_to_canonical";
      readonly targetBusinessId: string;
    }
  | {
      readonly kind: "place_detail";
      readonly canonicalBusinessId: string;
    }
  | {
      readonly kind: "unresolved";
      readonly reason: UnresolvedReason;
    };

/**
 * The sealed set of destination `kind` strings. Byte-stable with the
 * union above — the test suite enforces lock-step via the
 * exhaustiveness guard in the resolver.
 */
export const SEALED_DESTINATION_KINDS: readonly DirectoryDestination["kind"][] = [
  "nex_business",
  "nex_user_profile",
  "claim_available",
  "redirect_to_canonical",
  "place_detail",
  "unresolved",
] as const;

/**
 * The sealed set of unresolved reasons. Byte-stable with the union
 * above.
 */
export const SEALED_UNRESOLVED_REASONS: readonly UnresolvedReason[] = [
  "superseded_without_target",
  "claimed_without_link",
  "claim_classification_mismatch",
] as const;

// ═════════════════════════════════════════════════════════════════════
// §5 · Static invariants · module-level
// ═════════════════════════════════════════════════════════════════════
//
// This module is PURE types + two readonly constant arrays. It:
//   · does NOT read the DB
//   · does NOT access the network, filesystem, clock, or randomness
//   · imports only ./types (type-only)
//
// Route pattern discipline
//   · If `src/app/nex-native/[businessSlug]/page.tsx` is ever renamed,
//     update NEX_BUSINESS_ROUTE_PATTERN AND the resolver's path
//     builder in the same wave.
//   · Likewise for `src/app/nex-native/u/[handle]/page.tsx` and
//     NEX_USER_PROFILE_ROUTE_PATTERN.
//
// Discriminated-union discipline
//   · If a new destination kind is ever added, update the resolver's
//     switch (TS will catch the missing case), SEALED_DESTINATION_KINDS,
//     and the test suite's exhaustive-coverage check in the same wave.
