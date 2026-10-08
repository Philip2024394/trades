// src/lib/nex-native/directory/__tests__/directory-destination.test.ts
//
// NEX Directory · Phase C · resolveDirectoryDestination tests.
//
// Covers
//   · Path builders are byte-stable substitutions
//   · SUPERSEDED precedence · with target · without target · self-cycle
//   · Place classification always → place_detail (regardless of claim)
//   · OWNER_CLAIMED / OWNER_VERIFIED × matching claim → correct destination
//   · OWNER_CLAIMED / OWNER_VERIFIED × no claim → unresolved(claimed_without_link)
//   · Claim-classification mismatch → unresolved(claim_classification_mismatch)
//   · Unclaimed lifecycles × null claim → claim_available
//   · Non-owner-claimed lifecycle × present claim → trust claim
//   · Every sealed destination kind is reachable
//   · Every sealed unresolved reason is reachable
//   · Deterministic resolution (byte-stable over repeated calls)
//   · Batch form preserves order and claim-map semantics

import { describe, expect, it } from "vitest";
import {
  buildNexBusinessPath,
  buildNexUserProfilePath,
  resolveDirectoryDestination,
  resolveDirectoryDestinations,
} from "../resolve-destination";
import {
  NEX_BUSINESS_ROUTE_PATTERN,
  NEX_USER_PROFILE_ROUTE_PATTERN,
  SEALED_DESTINATION_KINDS,
  SEALED_UNRESOLVED_REASONS,
  type DirectoryDestination,
  type OwnerClaim,
  type UnresolvedReason,
} from "../destination-types";
import { projectDirectoryListing } from "../project-canonical-row";
import type {
  DirectoryCanonicalRow,
  DirectoryListingVM,
  EntityType,
  LifecycleState,
} from "../types";

// ═════════════════════════════════════════════════════════════════════
// §1 · Row + VM fixtures
// ═════════════════════════════════════════════════════════════════════

const CANONICAL_ID_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const CANONICAL_ID_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

function minimalRow(
  entity: EntityType,
  lifecycle: LifecycleState,
  canonicalBusinessId: string = CANONICAL_ID_A,
  supersededByBusinessId: string | null = null,
): DirectoryCanonicalRow {
  return {
    canonical_business_id: canonicalBusinessId,
    entity_type: entity,
    country: "ID",
    lifecycle_state: lifecycle,
    name_canonical: "Fixture",
    aliases: [],
    phone_e164: null,
    website_apex: null,
    osm_id: null,
    wikidata_qid: null,
    city: null,
    district: null,
    coordinates: null,
    category_ids: [],
    services_products: null,
    supersedes_business_id: null,
    superseded_by_business_id: supersededByBusinessId,
    last_verified_at: null,
  };
}

function vmOf(
  entity: EntityType,
  lifecycle: LifecycleState,
  canonicalBusinessId: string = CANONICAL_ID_A,
  supersededByBusinessId: string | null = null,
): DirectoryListingVM {
  return projectDirectoryListing({
    row: minimalRow(entity, lifecycle, canonicalBusinessId, supersededByBusinessId),
    media: null,
  });
}

const BUSINESS_CLAIM: OwnerClaim = { kind: "business", slug: "warung-nasi-siti" };
const PROFILE_CLAIM: OwnerClaim = { kind: "profile", handle: "nex-36474" };

// ═════════════════════════════════════════════════════════════════════
// §2 · Path builders
// ═════════════════════════════════════════════════════════════════════

describe("Phase C · path builders", () => {
  it("buildNexBusinessPath substitutes the slug into NEX_BUSINESS_ROUTE_PATTERN", () => {
    expect(buildNexBusinessPath("warung-nasi-siti")).toBe(
      "/nex-native/warung-nasi-siti",
    );
  });

  it("buildNexBusinessPath does not add leading or trailing whitespace", () => {
    expect(buildNexBusinessPath("x")).toBe("/nex-native/x");
  });

  it("buildNexBusinessPath passes the slug through verbatim (no normalisation)", () => {
    expect(buildNexBusinessPath("CamelCase")).toBe("/nex-native/CamelCase");
    expect(buildNexBusinessPath("has-dashes")).toBe("/nex-native/has-dashes");
    expect(buildNexBusinessPath("has_underscore")).toBe(
      "/nex-native/has_underscore",
    );
  });

  it("buildNexUserProfilePath substitutes the handle into NEX_USER_PROFILE_ROUTE_PATTERN", () => {
    expect(buildNexUserProfilePath("nex-36474")).toBe("/nex-native/u/nex-36474");
  });

  it("buildNexUserProfilePath passes the handle through verbatim", () => {
    expect(buildNexUserProfilePath("nex-99999")).toBe("/nex-native/u/nex-99999");
  });

  it("the two route patterns are the single source of truth", () => {
    expect(NEX_BUSINESS_ROUTE_PATTERN).toBe("/nex-native/{slug}");
    expect(NEX_USER_PROFILE_ROUTE_PATTERN).toBe("/nex-native/u/{handle}");
  });
});

// ═════════════════════════════════════════════════════════════════════
// §3 · SUPERSEDED has precedence
// ═════════════════════════════════════════════════════════════════════

describe("resolveDirectoryDestination · SUPERSEDED precedence", () => {
  it("SUPERSEDED with target → redirect_to_canonical", () => {
    const d = resolveDirectoryDestination({
      listing: vmOf("food", "SUPERSEDED", CANONICAL_ID_A, CANONICAL_ID_B),
      claim: null,
    });
    expect(d).toEqual({
      kind: "redirect_to_canonical",
      targetBusinessId: CANONICAL_ID_B,
    });
  });

  it("SUPERSEDED without target → unresolved(superseded_without_target)", () => {
    const d = resolveDirectoryDestination({
      listing: vmOf("food", "SUPERSEDED", CANONICAL_ID_A, null),
      claim: null,
    });
    expect(d).toEqual({
      kind: "unresolved",
      reason: "superseded_without_target",
    });
  });

  it("SUPERSEDED self-cycle → unresolved(superseded_without_target)", () => {
    const d = resolveDirectoryDestination({
      listing: vmOf("food", "SUPERSEDED", CANONICAL_ID_A, CANONICAL_ID_A),
      claim: null,
    });
    expect(d).toEqual({
      kind: "unresolved",
      reason: "superseded_without_target",
    });
  });

  it("SUPERSEDED beats presence of a claim (claim is ignored)", () => {
    const d = resolveDirectoryDestination({
      listing: vmOf("food", "SUPERSEDED", CANONICAL_ID_A, CANONICAL_ID_B),
      claim: BUSINESS_CLAIM,
    });
    expect(d).toEqual({
      kind: "redirect_to_canonical",
      targetBusinessId: CANONICAL_ID_B,
    });
  });

  it("SUPERSEDED beats place classification", () => {
    const d = resolveDirectoryDestination({
      listing: vmOf("place", "SUPERSEDED", CANONICAL_ID_A, CANONICAL_ID_B),
      claim: null,
    });
    expect(d.kind).toBe("redirect_to_canonical");
  });
});

// ═════════════════════════════════════════════════════════════════════
// §4 · Place classification → place_detail
// ═════════════════════════════════════════════════════════════════════

describe("resolveDirectoryDestination · place classification", () => {
  it("place entity → place_detail (regardless of claim)", () => {
    const d = resolveDirectoryDestination({
      listing: vmOf("place", "DISCOVERED"),
      claim: null,
    });
    expect(d).toEqual({
      kind: "place_detail",
      canonicalBusinessId: CANONICAL_ID_A,
    });
  });

  it("place entity ignores a business claim", () => {
    const d = resolveDirectoryDestination({
      listing: vmOf("place", "DISCOVERED"),
      claim: BUSINESS_CLAIM,
    });
    expect(d.kind).toBe("place_detail");
  });

  it("place entity ignores a profile claim", () => {
    const d = resolveDirectoryDestination({
      listing: vmOf("place", "ENRICHED"),
      claim: PROFILE_CLAIM,
    });
    expect(d.kind).toBe("place_detail");
  });

  it("place entity in OWNER_CLAIMED still routes to place_detail (places are not claimable)", () => {
    const d = resolveDirectoryDestination({
      listing: vmOf("place", "OWNER_CLAIMED"),
      claim: null,
    });
    expect(d.kind).toBe("place_detail");
  });

  it("place entity in DORMANT still routes to place_detail", () => {
    const d = resolveDirectoryDestination({
      listing: vmOf("place", "DORMANT"),
      claim: null,
    });
    expect(d.kind).toBe("place_detail");
  });
});

// ═════════════════════════════════════════════════════════════════════
// §5 · OWNER_CLAIMED / OWNER_VERIFIED × matching claim
// ═════════════════════════════════════════════════════════════════════

describe("resolveDirectoryDestination · owner-claimed with matching claim", () => {
  const BUSINESS_TYPES: readonly EntityType[] = [
    "food",
    "accommodation",
    "service",
    "vehicle_rental",
    "marketplace_seller",
    "transport_operator",
  ];

  const PERSON_TYPES: readonly EntityType[] = [
    "professional",
    "transport_driver",
  ];

  for (const et of BUSINESS_TYPES) {
    it(`${et} + OWNER_CLAIMED + business claim → nex_business with built path`, () => {
      const d = resolveDirectoryDestination({
        listing: vmOf(et, "OWNER_CLAIMED"),
        claim: BUSINESS_CLAIM,
      });
      expect(d).toEqual({
        kind: "nex_business",
        slug: "warung-nasi-siti",
        path: "/nex-native/warung-nasi-siti",
      });
    });

    it(`${et} + OWNER_VERIFIED + business claim → nex_business`, () => {
      const d = resolveDirectoryDestination({
        listing: vmOf(et, "OWNER_VERIFIED"),
        claim: BUSINESS_CLAIM,
      });
      expect(d.kind).toBe("nex_business");
    });
  }

  for (const et of PERSON_TYPES) {
    it(`${et} + OWNER_CLAIMED + profile claim → nex_user_profile with built path`, () => {
      const d = resolveDirectoryDestination({
        listing: vmOf(et, "OWNER_CLAIMED"),
        claim: PROFILE_CLAIM,
      });
      expect(d).toEqual({
        kind: "nex_user_profile",
        handle: "nex-36474",
        path: "/nex-native/u/nex-36474",
      });
    });

    it(`${et} + OWNER_VERIFIED + profile claim → nex_user_profile`, () => {
      const d = resolveDirectoryDestination({
        listing: vmOf(et, "OWNER_VERIFIED"),
        claim: PROFILE_CLAIM,
      });
      expect(d.kind).toBe("nex_user_profile");
    });
  }
});

// ═════════════════════════════════════════════════════════════════════
// §6 · OWNER_CLAIMED / OWNER_VERIFIED × no claim
// ═════════════════════════════════════════════════════════════════════

describe("resolveDirectoryDestination · owner-claimed lifecycle without claim link", () => {
  it("OWNER_CLAIMED business entity + null claim → unresolved(claimed_without_link)", () => {
    const d = resolveDirectoryDestination({
      listing: vmOf("food", "OWNER_CLAIMED"),
      claim: null,
    });
    expect(d).toEqual({
      kind: "unresolved",
      reason: "claimed_without_link",
    });
  });

  it("OWNER_VERIFIED business entity + null claim → unresolved(claimed_without_link)", () => {
    const d = resolveDirectoryDestination({
      listing: vmOf("accommodation", "OWNER_VERIFIED"),
      claim: null,
    });
    expect(d.kind).toBe("unresolved");
    expect((d as { reason: UnresolvedReason }).reason).toBe(
      "claimed_without_link",
    );
  });

  it("OWNER_CLAIMED person entity + null claim → unresolved(claimed_without_link)", () => {
    const d = resolveDirectoryDestination({
      listing: vmOf("professional", "OWNER_CLAIMED"),
      claim: null,
    });
    expect(d).toEqual({
      kind: "unresolved",
      reason: "claimed_without_link",
    });
  });
});

// ═════════════════════════════════════════════════════════════════════
// §7 · Claim-classification mismatch
// ═════════════════════════════════════════════════════════════════════

describe("resolveDirectoryDestination · claim-classification mismatch", () => {
  it("business claim on person entity → unresolved(claim_classification_mismatch)", () => {
    const d = resolveDirectoryDestination({
      listing: vmOf("professional", "OWNER_CLAIMED"),
      claim: BUSINESS_CLAIM,
    });
    expect(d).toEqual({
      kind: "unresolved",
      reason: "claim_classification_mismatch",
    });
  });

  it("business claim on transport_driver (person) → mismatch", () => {
    const d = resolveDirectoryDestination({
      listing: vmOf("transport_driver", "OWNER_VERIFIED"),
      claim: BUSINESS_CLAIM,
    });
    expect(d.kind).toBe("unresolved");
    expect((d as { reason: UnresolvedReason }).reason).toBe(
      "claim_classification_mismatch",
    );
  });

  it("profile claim on business entity → unresolved(claim_classification_mismatch)", () => {
    const d = resolveDirectoryDestination({
      listing: vmOf("food", "OWNER_CLAIMED"),
      claim: PROFILE_CLAIM,
    });
    expect(d).toEqual({
      kind: "unresolved",
      reason: "claim_classification_mismatch",
    });
  });

  it("profile claim on transport_operator (business) → mismatch", () => {
    const d = resolveDirectoryDestination({
      listing: vmOf("transport_operator", "OWNER_CLAIMED"),
      claim: PROFILE_CLAIM,
    });
    expect(d.kind).toBe("unresolved");
  });
});

// ═════════════════════════════════════════════════════════════════════
// §8 · Unclaimed lifecycles × null claim → claim_available
// ═════════════════════════════════════════════════════════════════════

describe("resolveDirectoryDestination · unclaimed lifecycle → claim_available", () => {
  const UNCLAIMED_STATES: readonly LifecycleState[] = [
    "DISCOVERED",
    "ENRICHED",
    "VERIFIED",
    "DORMANT",
  ];

  for (const s of UNCLAIMED_STATES) {
    it(`food (business) + ${s} + null claim → claim_available(business)`, () => {
      const d = resolveDirectoryDestination({
        listing: vmOf("food", s),
        claim: null,
      });
      expect(d).toEqual({
        kind: "claim_available",
        canonicalBusinessId: CANONICAL_ID_A,
        classification: "business",
      });
    });

    it(`professional (person) + ${s} + null claim → claim_available(person)`, () => {
      const d = resolveDirectoryDestination({
        listing: vmOf("professional", s),
        claim: null,
      });
      expect(d).toEqual({
        kind: "claim_available",
        canonicalBusinessId: CANONICAL_ID_A,
        classification: "person",
      });
    });
  }
});

// ═════════════════════════════════════════════════════════════════════
// §9 · Non-owner-claimed lifecycle × present claim → trust claim
// ═════════════════════════════════════════════════════════════════════

describe("resolveDirectoryDestination · present claim on non-owner-claimed lifecycle", () => {
  it("business claim on DISCOVERED food → nex_business (claim beats lifecycle)", () => {
    const d = resolveDirectoryDestination({
      listing: vmOf("food", "DISCOVERED"),
      claim: BUSINESS_CLAIM,
    });
    expect(d.kind).toBe("nex_business");
  });

  it("business claim on VERIFIED accommodation → nex_business", () => {
    const d = resolveDirectoryDestination({
      listing: vmOf("accommodation", "VERIFIED"),
      claim: BUSINESS_CLAIM,
    });
    expect(d.kind).toBe("nex_business");
  });

  it("profile claim on ENRICHED professional → nex_user_profile", () => {
    const d = resolveDirectoryDestination({
      listing: vmOf("professional", "ENRICHED"),
      claim: PROFILE_CLAIM,
    });
    expect(d.kind).toBe("nex_user_profile");
  });

  it("profile claim on DORMANT transport_driver → nex_user_profile", () => {
    const d = resolveDirectoryDestination({
      listing: vmOf("transport_driver", "DORMANT"),
      claim: PROFILE_CLAIM,
    });
    expect(d.kind).toBe("nex_user_profile");
  });
});

// ═════════════════════════════════════════════════════════════════════
// §10 · Every sealed destination kind is reachable
// ═════════════════════════════════════════════════════════════════════

describe("resolveDirectoryDestination · exhaustive kind coverage", () => {
  it("the 6 sealed destination kinds are each reachable from a legitimate input", () => {
    const outcomes = new Set<DirectoryDestination["kind"]>();

    outcomes.add(
      resolveDirectoryDestination({
        listing: vmOf("food", "OWNER_CLAIMED"),
        claim: BUSINESS_CLAIM,
      }).kind,
    );
    outcomes.add(
      resolveDirectoryDestination({
        listing: vmOf("professional", "OWNER_CLAIMED"),
        claim: PROFILE_CLAIM,
      }).kind,
    );
    outcomes.add(
      resolveDirectoryDestination({
        listing: vmOf("food", "DISCOVERED"),
        claim: null,
      }).kind,
    );
    outcomes.add(
      resolveDirectoryDestination({
        listing: vmOf("food", "SUPERSEDED", CANONICAL_ID_A, CANONICAL_ID_B),
        claim: null,
      }).kind,
    );
    outcomes.add(
      resolveDirectoryDestination({
        listing: vmOf("place", "DISCOVERED"),
        claim: null,
      }).kind,
    );
    outcomes.add(
      resolveDirectoryDestination({
        listing: vmOf("food", "SUPERSEDED", CANONICAL_ID_A, null),
        claim: null,
      }).kind,
    );

    for (const k of SEALED_DESTINATION_KINDS) {
      expect(outcomes.has(k)).toBe(true);
    }
    expect(outcomes.size).toBe(SEALED_DESTINATION_KINDS.length);
  });

  it("the 3 sealed unresolved reasons are each reachable", () => {
    const reasons = new Set<UnresolvedReason>();

    reasons.add(
      (
        resolveDirectoryDestination({
          listing: vmOf("food", "SUPERSEDED", CANONICAL_ID_A, null),
          claim: null,
        }) as { reason: UnresolvedReason }
      ).reason,
    );
    reasons.add(
      (
        resolveDirectoryDestination({
          listing: vmOf("food", "OWNER_CLAIMED"),
          claim: null,
        }) as { reason: UnresolvedReason }
      ).reason,
    );
    reasons.add(
      (
        resolveDirectoryDestination({
          listing: vmOf("professional", "OWNER_CLAIMED"),
          claim: BUSINESS_CLAIM,
        }) as { reason: UnresolvedReason }
      ).reason,
    );

    for (const r of SEALED_UNRESOLVED_REASONS) {
      expect(reasons.has(r)).toBe(true);
    }
    expect(reasons.size).toBe(SEALED_UNRESOLVED_REASONS.length);
  });
});

// ═════════════════════════════════════════════════════════════════════
// §11 · Determinism
// ═════════════════════════════════════════════════════════════════════

describe("resolveDirectoryDestination · determinism", () => {
  it("repeated calls with the same input produce byte-stable JSON output", () => {
    const listing = vmOf("food", "OWNER_CLAIMED");
    const first = JSON.stringify(
      resolveDirectoryDestination({ listing, claim: BUSINESS_CLAIM }),
    );
    for (let i = 0; i < 20; i++) {
      expect(
        JSON.stringify(
          resolveDirectoryDestination({ listing, claim: BUSINESS_CLAIM }),
        ),
      ).toBe(first);
    }
  });

  it("does not mutate the input listing", () => {
    const listing = vmOf("food", "OWNER_CLAIMED");
    const snapshot = JSON.stringify(listing);
    resolveDirectoryDestination({ listing, claim: BUSINESS_CLAIM });
    expect(JSON.stringify(listing)).toBe(snapshot);
  });

  it("does not mutate the input claim", () => {
    const claim: OwnerClaim = { kind: "business", slug: "x" };
    const snapshot = JSON.stringify(claim);
    resolveDirectoryDestination({
      listing: vmOf("food", "OWNER_CLAIMED"),
      claim,
    });
    expect(JSON.stringify(claim)).toBe(snapshot);
  });
});

// ═════════════════════════════════════════════════════════════════════
// §12 · Batch resolver
// ═════════════════════════════════════════════════════════════════════

describe("resolveDirectoryDestinations · batch form", () => {
  it("preserves input order", () => {
    const a = vmOf("food", "DISCOVERED", "11111111-1111-4111-8111-111111111111");
    const b = vmOf(
      "accommodation",
      "DISCOVERED",
      "22222222-2222-4222-8222-222222222222",
    );
    const c = vmOf(
      "professional",
      "DISCOVERED",
      "33333333-3333-4333-8333-333333333333",
    );
    const dests = resolveDirectoryDestinations({ listings: [a, b, c] });
    expect(dests.length).toBe(3);
    // All three unclaimed → claim_available with canonicalBusinessId
    expect((dests[0] as { canonicalBusinessId: string }).canonicalBusinessId).toBe(
      a.canonicalBusinessId,
    );
    expect((dests[1] as { canonicalBusinessId: string }).canonicalBusinessId).toBe(
      b.canonicalBusinessId,
    );
    expect((dests[2] as { canonicalBusinessId: string }).canonicalBusinessId).toBe(
      c.canonicalBusinessId,
    );
  });

  it("returns [] for an empty input", () => {
    expect(resolveDirectoryDestinations({ listings: [] })).toEqual([]);
  });

  it("attaches a claim from claimsByCanonicalId when the id matches", () => {
    const listing = vmOf("food", "OWNER_CLAIMED");
    const map = new Map<string, OwnerClaim>([
      [listing.canonicalBusinessId, { kind: "business", slug: "x" }],
    ]);
    const [d] = resolveDirectoryDestinations({
      listings: [listing],
      claimsByCanonicalId: map,
    });
    expect(d.kind).toBe("nex_business");
    expect((d as { slug: string }).slug).toBe("x");
  });

  it("falls back to null claim when id is not in the map (OWNER_CLAIMED → unresolved)", () => {
    const listing = vmOf("food", "OWNER_CLAIMED");
    const otherId = "99999999-9999-4999-8999-999999999999";
    const map = new Map<string, OwnerClaim>([
      [otherId, { kind: "business", slug: "other" }],
    ]);
    const [d] = resolveDirectoryDestinations({
      listings: [listing],
      claimsByCanonicalId: map,
    });
    expect(d.kind).toBe("unresolved");
    expect((d as { reason: UnresolvedReason }).reason).toBe(
      "claimed_without_link",
    );
  });

  it("without a claims map, every row resolves with null claim", () => {
    const listings = [
      vmOf("food", "DISCOVERED"),
      vmOf("professional", "ENRICHED"),
      vmOf("place", "DISCOVERED"),
    ];
    const dests = resolveDirectoryDestinations({ listings });
    expect(dests[0].kind).toBe("claim_available");
    expect(dests[1].kind).toBe("claim_available");
    expect(dests[2].kind).toBe("place_detail");
  });
});

// ═════════════════════════════════════════════════════════════════════
// §13 · Phase B integration · pure projector feeds pure resolver
// ═════════════════════════════════════════════════════════════════════

describe("Phase C · integration with Phase B projector", () => {
  it("Phase B VM is a legitimate Phase C input · no re-shape required", () => {
    const vm = projectDirectoryListing({
      row: minimalRow("food", "DISCOVERED"),
      media: null,
    });
    const d = resolveDirectoryDestination({ listing: vm, claim: null });
    expect(d.kind).toBe("claim_available");
  });

  it("the two phases compose · byte-stable over N invocations", () => {
    const row = minimalRow("accommodation", "OWNER_CLAIMED");
    const results: string[] = [];
    for (let i = 0; i < 10; i++) {
      const vm = projectDirectoryListing({ row, media: null });
      const d = resolveDirectoryDestination({
        listing: vm,
        claim: BUSINESS_CLAIM,
      });
      results.push(JSON.stringify(d));
    }
    for (const s of results) {
      expect(s).toBe(results[0]);
    }
  });
});
