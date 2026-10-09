// scripts/nex-canonical/rule-5m-proof-3-determinism.test.ts
//
// Rule 5m · Proof 3 · Resolver determinism.
//
// SEALED CLAIM:
//   Given byte-identical candidate + canonical pool, the Layer-B resolver's
//   verdict is byte-stable. Running the resolver 100 times on the same inputs
//   produces identical kind, score, target_canonical_business_id, and
//   score_breakdown.
//
// EVIDENCE BINDING:
//   See `docs/doctrine/nex-rule-5m-proof-manifest-2026-10-09.md` · Proof 3.
//   This test is the named proof artefact for the manifest.
//
// SCOPE:
//   The resolver module is architecturally pure (no clock / randomness /
//   network / env). This proof pins that invariant to a runnable test so a
//   future violation (e.g. accidental Date.now() call) fails loudly.

import { describe, expect, test } from "vitest";
import type { Candidate } from "./generate-candidates";
import type { CanonicalResolverInput } from "./canonical-row";
import { resolveCanonical } from "./canonical-resolver";
import { isAnswered } from "./intelligence-result";

// ═════════════════════════════════════════════════════════════════════
// Fixed fixtures · byte-identical across every iteration
// ═════════════════════════════════════════════════════════════════════

const FIXED_CANDIDATE: Candidate = {
  candidate_id: "det-fixture-001",
  status: "pending_founder_review",
  entity_type: "food",
  country: "ID",
  identity: {
    name_canonical: "Warung Bu Siti · Fixture",
    aliases: [],
    phone_e164: null,
    website_apex: null,
    osm_id: null,
    wikidata_qid: null,
    city: "Yogyakarta",
    district: null,
    coordinates: { lat: -7.7956, lng: 110.3695 },
  },
  legacy_source: {
    table: "nex.food_business",
    ref: "det-fixture-001-ref",
    internal_id: null,
  },
  risk_categories: ["R1"],
  selection_score: 0.5,
  selection_rationale: [
    { risk_category: "R1", contribution: 0.5, note: "deterministic fixture" },
  ],
  generation_source: {
    generator: "scripts/nex-canonical/generate-candidates.ts",
    generated_at: "2026-10-09T00:00:00.000Z",
    generation_run_id: "rule-5m-proof-3-run",
  },
  caveats: [],
};

const FIXED_POOL: readonly CanonicalResolverInput[] = [
  {
    canonical_business_id: "11111111-1111-1111-1111-111111111111",
    entity_type: "food",
    country: "ID",
    name_canonical: "Warung Bu Siti · Fixture",
    name_norm: "warung bu siti fixture",
    aliases: [],
    phone_e164: null,
    website_apex: null,
    osm_id: null,
    wikidata_qid: null,
    city: "Yogyakarta",
    coordinates: { lat: -7.7956, lng: 110.3695 },
  },
  {
    canonical_business_id: "22222222-2222-2222-2222-222222222222",
    entity_type: "food",
    country: "ID",
    name_canonical: "Different Place",
    name_norm: "different place",
    aliases: [],
    phone_e164: null,
    website_apex: null,
    osm_id: null,
    wikidata_qid: null,
    city: "Yogyakarta",
    coordinates: null,
  },
];

// ═════════════════════════════════════════════════════════════════════
// §1 · 100× byte-equal run
// ═════════════════════════════════════════════════════════════════════

describe("Rule 5m · Proof 3 · resolver determinism", () => {
  test("100 consecutive resolves on the same inputs produce byte-equal verdicts", () => {
    const first = JSON.stringify(resolveCanonical({ candidate: FIXED_CANDIDATE, pool: FIXED_POOL }));
    for (let i = 0; i < 99; i++) {
      const next = JSON.stringify(
        resolveCanonical({ candidate: FIXED_CANDIDATE, pool: FIXED_POOL }),
      );
      expect(next).toBe(first);
    }
  });

  test("deep-equal result shape across repeat runs", () => {
    const first = resolveCanonical({ candidate: FIXED_CANDIDATE, pool: FIXED_POOL });
    const second = resolveCanonical({ candidate: FIXED_CANDIDATE, pool: FIXED_POOL });
    const third = resolveCanonical({ candidate: FIXED_CANDIDATE, pool: FIXED_POOL });
    expect(second).toEqual(first);
    expect(third).toEqual(first);
  });

  test("Answered verdict carries byte-stable score + target when MATCH or NO_MATCH", () => {
    const result = resolveCanonical({ candidate: FIXED_CANDIDATE, pool: FIXED_POOL });
    if (isAnswered(result)) {
      // Re-run and assert byte-stable score.
      const result2 = resolveCanonical({ candidate: FIXED_CANDIDATE, pool: FIXED_POOL });
      if (!isAnswered(result2)) {
        throw new Error("Second run disagreed with first on answered/abstained");
      }
      expect(result2.value).toEqual(result.value);
    } else {
      // Abstained · still assert byte-stable abstention reason.
      const result2 = resolveCanonical({ candidate: FIXED_CANDIDATE, pool: FIXED_POOL });
      expect(JSON.stringify(result2)).toBe(JSON.stringify(result));
    }
  });
});

// ═════════════════════════════════════════════════════════════════════
// §2 · Permutation invariance of the pool
// ═════════════════════════════════════════════════════════════════════

describe("Rule 5m · Proof 3 · pool order invariance", () => {
  test("reversing the pool order produces the same verdict kind", () => {
    const forwards = resolveCanonical({ candidate: FIXED_CANDIDATE, pool: FIXED_POOL });
    const reversed = resolveCanonical({
      candidate: FIXED_CANDIDATE,
      pool: [...FIXED_POOL].reverse(),
    });
    if (isAnswered(forwards) && isAnswered(reversed)) {
      expect(reversed.value.kind).toBe(forwards.value.kind);
    } else {
      expect(reversed).toEqual(forwards);
    }
  });
});
