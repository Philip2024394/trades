// src/lib/nex-native/directory/resolve-destination.ts
//
// NEX Directory · Phase C · Pure destination resolver.
//
// What this module is
//   · The one authoritative place where a `DirectoryListingVM` +
//     optional `OwnerClaim` becomes a `DirectoryDestination`.
//   · Pure. Deterministic. Exhaustive. TypeScript's `never` check
//     guards against unmapped destination kinds / lifecycle states.
//   · The resolver answers one question: "Where inside NEX does the
//     user go when they click this canonical entity?"
//
// What this module is NOT
//   · Not a Layer-B identity resolver (that lives at
//     scripts/nex-canonical/canonical-resolver.ts and answers
//     "which canonical entity does this candidate represent?").
//   · Not a URL fabricator — slug + handle values come from the
//     caller via OwnerClaim; the resolver NEVER manufactures them.
//   · Not a database caller — no supabase, no network, no clock.
//   · Not a redirect follower — if a row is SUPERSEDED, the
//     resolver returns `redirect_to_canonical` with the target id
//     and the caller re-resolves against that row. Chasing the
//     chain belongs in the service layer so it can batch the
//     lookup against the DB.
//
// Resolution rules (sealed in test §4)
//
//   1. SUPERSEDED precedence
//      · If lifecycle_state === "SUPERSEDED":
//          · If supersededByBusinessId is non-null and not self:
//              → redirect_to_canonical
//          · Else:
//              → unresolved("superseded_without_target")
//      This runs FIRST because a SUPERSEDED row should never render
//      as its own content; the chain target is authoritative.
//
//   2. Place
//      · If classification === "place":
//          → place_detail
//      Places are read-only Directory detail; they are never
//      claimable regardless of claim lookup result.
//
//   3. Owner-claimed with claim
//      · If lifecycle_state ∈ { OWNER_CLAIMED, OWNER_VERIFIED }:
//          · If claim is null:
//              → unresolved("claimed_without_link")
//          · If claim.kind === "business" and classification !== "business":
//              → unresolved("claim_classification_mismatch")
//          · If claim.kind === "profile" and classification !== "person":
//              → unresolved("claim_classification_mismatch")
//          · Else:
//              → nex_business | nex_user_profile (with built path)
//
//   4. Owner-claimed without lifecycle
//      · If the caller still passed a claim for a row that is NOT
//        in an owner-claimed lifecycle state, we trust the claim
//        over the lifecycle (a lifecycle backfill race). Same
//        classification check applies.
//
//   5. Default
//      · Everything else:
//          · If classification === "place": → place_detail
//            (unreachable; §2 already handled)
//          · Else: → claim_available (business or person)
//
// Readability note
//   · The function body uses an exhaustive switch on classification
//     ONLY inside the claim path builders — the outer flow is a
//     cascade of guards. If a future entity_type is added to the
//     sealed enum, the Phase B classify-entity-type.ts switch is
//     where the compiler will first complain; this file's inner
//     switch is a defence-in-depth exhaustiveness check.

import {
  NEX_BUSINESS_ROUTE_PATTERN,
  NEX_USER_PROFILE_ROUTE_PATTERN,
  type DirectoryDestination,
  type OwnerClaim,
} from "./destination-types";
import type { DirectoryListingVM } from "./types";

// ═════════════════════════════════════════════════════════════════════
// §1 · Path builders · one authoritative place
// ═════════════════════════════════════════════════════════════════════

/** Build the absolute Next.js route for an owner-claimed NEX Business
 *  cover. Deterministic string substitution — the slug is passed
 *  through verbatim; the caller is responsible for having fetched a
 *  real, non-empty slug from `nex_business.slug`. */
export function buildNexBusinessPath(slug: string): string {
  return NEX_BUSINESS_ROUTE_PATTERN.replace("{slug}", slug);
}

/** Build the absolute Next.js route for an owner-claimed NEX user
 *  profile. Deterministic string substitution — the handle is passed
 *  through verbatim; the caller is responsible for having fetched a
 *  real, non-empty handle from `nex_account.nex_handle`. */
export function buildNexUserProfilePath(handle: string): string {
  return NEX_USER_PROFILE_ROUTE_PATTERN.replace("{handle}", handle);
}

// ═════════════════════════════════════════════════════════════════════
// §2 · resolveDirectoryDestination · the one authoritative resolver
// ═════════════════════════════════════════════════════════════════════

export interface ResolveDirectoryDestinationArgs {
  readonly listing: DirectoryListingVM;
  /** Optional owner-claim lookup. Supplied by the Phase A service
   *  layer from a real DB row (nex_business.slug WHERE
   *  canonical_business_id = …  OR  nex_account_profile.handle via
   *  the equivalent future FK). Pass `null` when no claim link
   *  exists. The resolver NEVER fabricates slug/handle values. */
  readonly claim: OwnerClaim | null;
}

export function resolveDirectoryDestination(
  args: ResolveDirectoryDestinationArgs,
): DirectoryDestination {
  const { listing, claim } = args;

  // ─────────── 1 · SUPERSEDED has precedence ────────────────────
  if (listing.lifecycleState === "SUPERSEDED") {
    const target = listing.supersededByBusinessId;
    if (target === null || target === listing.canonicalBusinessId) {
      return { kind: "unresolved", reason: "superseded_without_target" };
    }
    return { kind: "redirect_to_canonical", targetBusinessId: target };
  }

  // ─────────── 2 · Places are read-only Directory detail ────────
  if (listing.classification === "place") {
    return {
      kind: "place_detail",
      canonicalBusinessId: listing.canonicalBusinessId,
    };
  }

  // ─────────── 3 · Owner-claim path (claim present) ─────────────
  if (claim !== null) {
    if (claim.kind === "business") {
      if (listing.classification !== "business") {
        return {
          kind: "unresolved",
          reason: "claim_classification_mismatch",
        };
      }
      return {
        kind: "nex_business",
        slug: claim.slug,
        path: buildNexBusinessPath(claim.slug),
      };
    }
    if (claim.kind === "profile") {
      if (listing.classification !== "person") {
        return {
          kind: "unresolved",
          reason: "claim_classification_mismatch",
        };
      }
      return {
        kind: "nex_user_profile",
        handle: claim.handle,
        path: buildNexUserProfilePath(claim.handle),
      };
    }
    // Exhaustiveness guard — if a future OwnerClaim variant is added
    // without updating this branch, TS will catch it at compile time.
    const _exhaustive: never = claim;
    throw new Error(
      `resolveDirectoryDestination: unmapped claim kind for ${JSON.stringify(_exhaustive)}`,
    );
  }

  // ─────────── 4 · Owner-claimed lifecycle but no claim link ────
  if (
    listing.lifecycleState === "OWNER_CLAIMED" ||
    listing.lifecycleState === "OWNER_VERIFIED"
  ) {
    return { kind: "unresolved", reason: "claimed_without_link" };
  }

  // ─────────── 5 · Default · unclaimed · claim_available ────────
  // listing.classification is business | person here (place handled above).
  return {
    kind: "claim_available",
    canonicalBusinessId: listing.canonicalBusinessId,
    classification: listing.classification,
  };
}

// ═════════════════════════════════════════════════════════════════════
// §3 · Batch resolver convenience
// ═════════════════════════════════════════════════════════════════════

/**
 * Batch form. Preserves input order. Pass `claimsByCanonicalId` to
 * supply per-row claims; rows without an entry are resolved with
 * `claim = null`.
 *
 * Pure. No side effects. Deterministic. Same input → same output.
 */
export function resolveDirectoryDestinations(args: {
  readonly listings: readonly DirectoryListingVM[];
  readonly claimsByCanonicalId?: ReadonlyMap<string, OwnerClaim>;
}): DirectoryDestination[] {
  const map = args.claimsByCanonicalId;
  const out: DirectoryDestination[] = [];
  for (const listing of args.listings) {
    const claim =
      map === undefined
        ? null
        : (map.get(listing.canonicalBusinessId) ?? null);
    out.push(resolveDirectoryDestination({ listing, claim }));
  }
  return out;
}

// ═════════════════════════════════════════════════════════════════════
// §4 · Static invariants · module-level
// ═════════════════════════════════════════════════════════════════════
//
// This module is PURE. It:
//   · does NOT read the DB
//   · does NOT access the network, filesystem, clock, or randomness
//   · imports only ./destination-types + ./types (type-level) +
//     the two route pattern constants
//
// Byte-stability
//   · Given byte-identical inputs, the resolver returns byte-identical
//     outputs. The test suite enforces this via deterministic
//     resolution cases.
//
// No fabrication
//   · The slug + handle values ONLY come from the caller's OwnerClaim.
//     If a caller fabricates them, that is a service-layer bug;
//     static grep assertions in the no-fabrication test suite
//     prevent this file from inventing substitutes.
//
// Supersession chain terminates
//   · This resolver DOES NOT follow the supersession chain. The caller
//     is responsible for re-resolving against `targetBusinessId`.
//     The resolver returns `redirect_to_canonical` and stops. Chain
//     termination is a service-layer concern (bounded iteration with
//     a cycle guard belongs there, where the DB fetch happens).
