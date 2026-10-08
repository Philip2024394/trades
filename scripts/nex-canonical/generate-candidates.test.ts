// scripts/nex-canonical/generate-candidates.test.ts
//
// Unit tests for the PURE functions in generate-candidates.ts.
// NO DB · NO IO · NO legacy data · deterministic given input.
//
// Scope boundary (authorized this wave):
//   · Only pure selection/ranking/assembly functions are tested.
//   · The orchestrator generateCandidates() is NOT tested here because
//     exercising it would require a QueryExecutor and real / mock rows,
//     which crosses into the "no mock fallback" line in Rule 5n.
//   · The non-executing guard is NOT tested here because triggering it
//     would require spawning a child Node process.

import { describe, expect, test } from "vitest";
import {
  clamp01,
  computeSharedSignals,
  deriveEntityType,
  deterministicCandidateId,
  extractOsmId,
  extractWebsiteApex,
  isAsciiLatin,
  pickTopKPerCategory,
  QUARANTINED_NEX_BUSINESS_CATEGORIES,
  QUARANTINED_TRANSPORT_PROVIDER_KINDS,
  RISK_CATEGORIES,
  rowToCandidate,
  SCORERS,
  scoreR1LiveAccommodation,
  scoreR2OsmWikidataLinked,
  scoreR3DuplicateSource,
  scoreR4SameNameDifferentOwner,
  scoreR5CrossVerticalSibling,
  scoreR6ThinEvidence,
  scoreR7IntraSourceDuplicate,
  scoreR8WebsiteSplit,
  scoreR9Transliteration,
  scoreR10GeographicCollision,
  SEALED_ENTITY_TYPES,
  selectionNameKey,
  type LegacyRow,
  type RiskCategory,
} from "./generate-candidates";

/** Factory for a minimal LegacyRow in tests. */
function row(partial: Partial<LegacyRow>): LegacyRow {
  return {
    legacy_table: "nex.food_business",
    legacy_ref: "#FL-TEST-00001",
    internal_id: null,
    business_name: "Test Business",
    aliases: [],
    phone_raw: null,
    website_raw: null,
    osm_source_reference: null,
    wikidata_qid_hint: null,
    country: "ID",
    city: null,
    district: null,
    coordinates_lat: null,
    coordinates_lng: null,
    claim_status: null,
    owner_status: null,
    entity_type_hint: null,
    shares_source_reference_with_other_row: false,
    shares_name_city_with_other_row: false,
    shares_coord_bucket_with_other_vertical: false,
    extra: {},
    ...partial,
  };
}

describe("clamp01 · [0,1] bounds", () => {
  test("passes-through within range", () => {
    expect(clamp01(0)).toBe(0);
    expect(clamp01(0.5)).toBe(0.5);
    expect(clamp01(1)).toBe(1);
  });
  test("floors negative inputs", () => {
    expect(clamp01(-0.0001)).toBe(0);
    expect(clamp01(-100)).toBe(0);
  });
  test("caps above-one inputs", () => {
    expect(clamp01(1.0001)).toBe(1);
    expect(clamp01(999)).toBe(1);
  });
  test("NaN maps to 0", () => {
    expect(clamp01(Number.NaN)).toBe(0);
  });
});

describe("isAsciiLatin · R9 selection helper", () => {
  test("ASCII strings return true", () => {
    expect(isAsciiLatin("Hello World")).toBe(true);
    expect(isAsciiLatin("hotel-1")).toBe(true);
    expect(isAsciiLatin("")).toBe(true);
  });
  test("non-ASCII strings return false", () => {
    expect(isAsciiLatin("Café")).toBe(false);
    expect(isAsciiLatin("日本橋")).toBe(false);
    expect(isAsciiLatin("Jerry's")).toBe(true); // ASCII apostrophe
    expect(isAsciiLatin("Jerry’s")).toBe(false); // smart apostrophe
  });
});

describe("selectionNameKey · mirrors nex.name_norm() behaviour for selection", () => {
  test("basic lowercase", () => {
    expect(selectionNameKey("Hello World")).toBe("hello world");
  });
  test("strip apostrophes + punctuation", () => {
    expect(selectionNameKey("Jerry's Café")).toBe("jerrys caf");
  });
  test("collapse multiple spaces", () => {
    expect(selectionNameKey("Hello   World")).toBe("hello world");
  });
  test("trim leading/trailing", () => {
    expect(selectionNameKey("  spaced  ")).toBe("spaced");
  });
  test("em-dash removal", () => {
    expect(selectionNameKey("Café — Du Lac")).toBe("caf du lac");
  });
  test("empty input", () => {
    expect(selectionNameKey("")).toBe("");
  });
});

describe("extractOsmId · parse source_reference", () => {
  test("node/", () => {
    expect(extractOsmId("node/12345")).toBe("node/12345");
  });
  test("way/", () => {
    expect(extractOsmId("way/67890")).toBe("way/67890");
  });
  test("relation/", () => {
    expect(extractOsmId("relation/42")).toBe("relation/42");
  });
  test("non-matching returns null", () => {
    expect(extractOsmId("tourism=hotel")).toBeNull();
    expect(extractOsmId(null)).toBeNull();
  });
});

describe("extractWebsiteApex · URL → apex host", () => {
  test("https URL", () => {
    expect(extractWebsiteApex("https://www.example.com/page")).toBe("example.com");
  });
  test("http URL", () => {
    expect(extractWebsiteApex("http://example.co.id")).toBe("example.co.id");
  });
  test("no scheme", () => {
    expect(extractWebsiteApex("example.com")).toBe("example.com");
  });
  test("non-URL returns null", () => {
    expect(extractWebsiteApex("not a url")).toBeNull();
    expect(extractWebsiteApex(null)).toBeNull();
  });
});

describe("deterministicCandidateId · stable id format", () => {
  test("same inputs → same output", () => {
    const a = deterministicCandidateId("run-2026-10-08-abcdefgh", 42);
    const b = deterministicCandidateId("run-2026-10-08-abcdefgh", 42);
    expect(a).toBe(b);
  });
  test("different index → different id", () => {
    const a = deterministicCandidateId("run-2026-10-08-abcdefgh", 0);
    const b = deterministicCandidateId("run-2026-10-08-abcdefgh", 1);
    expect(a).not.toBe(b);
  });
  test("5-digit zero padding", () => {
    expect(deterministicCandidateId("abcdefgh00", 7)).toBe("cand-abcdefgh-00007");
  });
});

describe("scoreR1LiveAccommodation · R1 feeder", () => {
  test("non-accommodation table scores 0", () => {
    expect(
      scoreR1LiveAccommodation(row({ legacy_table: "nex.food_business" })),
    ).toBe(0);
  });
  test("non-listed accommodation scores 0", () => {
    expect(
      scoreR1LiveAccommodation(
        row({ legacy_table: "nex.accommodation_business", claim_status: "discovered" }),
      ),
    ).toBe(0);
  });
  test("baseline listed = 0.4", () => {
    expect(
      scoreR1LiveAccommodation(
        row({ legacy_table: "nex.accommodation_business", claim_status: "listed" }),
      ),
    ).toBeCloseTo(0.4, 5);
  });
  test("full-signal listed = 1.0", () => {
    expect(
      scoreR1LiveAccommodation(
        row({
          legacy_table: "nex.accommodation_business",
          claim_status: "listed",
          phone_raw: "+6281234567890",
          coordinates_lat: -7.8,
          coordinates_lng: 110.3,
          website_raw: "https://example.com",
        }),
      ),
    ).toBeCloseTo(1.0, 5);
  });
});

describe("scoreR2OsmWikidataLinked · R2 feeder", () => {
  test("no OSM reference → 0", () => {
    expect(scoreR2OsmWikidataLinked(row({}))).toBe(0);
  });
  test("OSM only, no QID → 0.3", () => {
    expect(
      scoreR2OsmWikidataLinked(row({ osm_source_reference: "node/1" })),
    ).toBe(0.3);
  });
  test("OSM + QID → 0.6", () => {
    expect(
      scoreR2OsmWikidataLinked(
        row({ osm_source_reference: "node/1", wikidata_qid_hint: "Q42" }),
      ),
    ).toBeCloseTo(0.6, 5);
  });
  test("full-signal → 1.0", () => {
    expect(
      scoreR2OsmWikidataLinked(
        row({
          osm_source_reference: "node/1",
          wikidata_qid_hint: "Q42",
          coordinates_lat: 1,
          coordinates_lng: 2,
          phone_raw: "+1",
          website_raw: "x.com",
        }),
      ),
    ).toBeCloseTo(1.0, 5);
  });
});

describe("scoreR3DuplicateSource · R3 feeder", () => {
  test("no shared source → 0", () => {
    expect(
      scoreR3DuplicateSource(row({ shares_source_reference_with_other_row: false })),
    ).toBe(0);
  });
  test("baseline shared → 0.5", () => {
    expect(
      scoreR3DuplicateSource(row({ shares_source_reference_with_other_row: true })),
    ).toBeCloseTo(0.5, 5);
  });
});

describe("scoreR4SameNameDifferentOwner · R4 feeder", () => {
  test("no name/city collision → 0", () => {
    expect(scoreR4SameNameDifferentOwner(row({}))).toBe(0);
  });
  test("collision + coords + phone", () => {
    expect(
      scoreR4SameNameDifferentOwner(
        row({
          shares_name_city_with_other_row: true,
          coordinates_lat: 1,
          coordinates_lng: 2,
          phone_raw: "+1",
        }),
      ),
    ).toBeCloseTo(1.0, 5);
  });
});

describe("scoreR5CrossVerticalSibling · R5 feeder", () => {
  test("no cross-vertical overlap → 0", () => {
    expect(scoreR5CrossVerticalSibling(row({}))).toBe(0);
  });
  test("overlap boost", () => {
    expect(
      scoreR5CrossVerticalSibling(
        row({
          shares_coord_bucket_with_other_vertical: true,
          coordinates_lat: 1,
          coordinates_lng: 2,
        }),
      ),
    ).toBeCloseTo(0.8, 5);
  });
});

describe("scoreR6ThinEvidence · R6 feeder", () => {
  test("empty name → 0", () => {
    expect(scoreR6ThinEvidence(row({ business_name: "" }))).toBe(0);
    expect(scoreR6ThinEvidence(row({ business_name: "   " }))).toBe(0);
  });
  test("two or more signals → 0 (not thin enough)", () => {
    expect(
      scoreR6ThinEvidence(
        row({ phone_raw: "+1", website_raw: "x.com" }),
      ),
    ).toBe(0);
  });
  test("one signal → 0.6", () => {
    expect(scoreR6ThinEvidence(row({ phone_raw: "+1" }))).toBe(0.6);
  });
  test("zero signals → 0.9", () => {
    expect(scoreR6ThinEvidence(row({}))).toBe(0.9);
  });
});

describe("scoreR7IntraSourceDuplicate · R7 feeder", () => {
  test("non-food → 0", () => {
    expect(
      scoreR7IntraSourceDuplicate(
        row({
          legacy_table: "nex.accommodation_business",
          shares_source_reference_with_other_row: true,
        }),
      ),
    ).toBe(0);
  });
  test("food, no sharing → 0", () => {
    expect(
      scoreR7IntraSourceDuplicate(
        row({
          legacy_table: "nex.food_business",
          shares_source_reference_with_other_row: false,
        }),
      ),
    ).toBe(0);
  });
  test("food + sharing → 0.7", () => {
    expect(
      scoreR7IntraSourceDuplicate(
        row({
          legacy_table: "nex.food_business",
          shares_source_reference_with_other_row: true,
        }),
      ),
    ).toBe(0.7);
  });
});

describe("scoreR8WebsiteSplit · R8 feeder", () => {
  test("website present, target present", () => {
    expect(
      scoreR8WebsiteSplit(row({ website_raw: "x.com" }), "present"),
    ).toBeCloseTo(0.4, 5);
  });
  test("website present, target absent → 0", () => {
    expect(
      scoreR8WebsiteSplit(row({ website_raw: "x.com" }), "absent"),
    ).toBe(0);
  });
  test("website absent, target absent", () => {
    expect(
      scoreR8WebsiteSplit(row({ website_raw: null }), "absent"),
    ).toBeCloseTo(0.4, 5);
  });
  test("website absent, target present → 0", () => {
    expect(
      scoreR8WebsiteSplit(row({ website_raw: null }), "present"),
    ).toBe(0);
  });
});

describe("scoreR9Transliteration · R9 feeder", () => {
  test("no aliases → 0", () => {
    expect(scoreR9Transliteration(row({ aliases: [] }))).toBe(0);
  });
  test("ASCII primary + Unicode alias", () => {
    expect(
      scoreR9Transliteration(
        row({ business_name: "Hotel One", aliases: ["ホテルワン"] }),
      ),
    ).toBe(0.6);
  });
  test("Unicode primary + ASCII alias", () => {
    expect(
      scoreR9Transliteration(
        row({ business_name: "ホテルワン", aliases: ["Hotel One"] }),
      ),
    ).toBe(0.6);
  });
  test("both ASCII, no variance → 0", () => {
    expect(
      scoreR9Transliteration(
        row({ business_name: "Hotel One", aliases: ["Hotel 1"] }),
      ),
    ).toBe(0);
  });
});

describe("scoreR10GeographicCollision · R10 feeder", () => {
  test("no name/city collision → 0", () => {
    expect(scoreR10GeographicCollision(row({}))).toBe(0);
  });
  test("collision + coords present → 0.75", () => {
    expect(
      scoreR10GeographicCollision(
        row({
          shares_name_city_with_other_row: true,
          coordinates_lat: 1,
          coordinates_lng: 2,
        }),
      ),
    ).toBe(0.75);
  });
  test("collision but no coords → 0", () => {
    expect(
      scoreR10GeographicCollision(
        row({ shares_name_city_with_other_row: true }),
      ),
    ).toBe(0);
  });
});

describe("computeSharedSignals · pure precomputation", () => {
  test("empty input → empty output", () => {
    const out = computeSharedSignals([]);
    expect(out).toEqual([]);
  });
  test("single row has no shared flags set", () => {
    const [out] = computeSharedSignals([row({ business_name: "Solo" })]);
    expect(out.shares_source_reference_with_other_row).toBe(false);
    expect(out.shares_name_city_with_other_row).toBe(false);
    expect(out.shares_coord_bucket_with_other_vertical).toBe(false);
  });
  test("two rows with same name + city flag shares_name_city", () => {
    const out = computeSharedSignals([
      row({
        legacy_ref: "A",
        business_name: "Café Lac",
        city: "Yogyakarta",
        country: "ID",
      }),
      row({
        legacy_ref: "B",
        business_name: "Café Lac",
        city: "Yogyakarta",
        country: "ID",
      }),
    ]);
    expect(out[0].shares_name_city_with_other_row).toBe(true);
    expect(out[1].shares_name_city_with_other_row).toBe(true);
  });
  test("two rows at same coord bucket but different vertical", () => {
    const out = computeSharedSignals([
      row({
        legacy_table: "nex.food_business",
        legacy_ref: "A",
        coordinates_lat: 1.0001,
        coordinates_lng: 2.0001,
      }),
      row({
        legacy_table: "nex.accommodation_business",
        legacy_ref: "B",
        coordinates_lat: 1.0002,
        coordinates_lng: 2.0002,
      }),
    ]);
    expect(out[0].shares_coord_bucket_with_other_vertical).toBe(true);
    expect(out[1].shares_coord_bucket_with_other_vertical).toBe(true);
  });
});

describe("deriveEntityType · Rule 5l quarantines + sealed enum", () => {
  test("food_business → food", () => {
    expect(deriveEntityType(row({ legacy_table: "nex.food_business" }))).toBe("food");
  });
  test("accommodation_business → accommodation", () => {
    expect(
      deriveEntityType(row({ legacy_table: "nex.accommodation_business" })),
    ).toBe("accommodation");
  });
  test("service_business → service", () => {
    expect(deriveEntityType(row({ legacy_table: "nex.service_business" }))).toBe(
      "service",
    );
  });
  test("mp_seller → marketplace_seller", () => {
    expect(deriveEntityType(row({ legacy_table: "nex.mp_seller" }))).toBe(
      "marketplace_seller",
    );
  });
  test("transport unknown → null (Rule 5l quarantine)", () => {
    expect(
      deriveEntityType(
        row({
          legacy_table: "nex.transport_acquisition_record",
          extra: { provider_kind: "unknown" },
        }),
      ),
    ).toBeNull();
  });
  test("transport driver → transport_driver", () => {
    expect(
      deriveEntityType(
        row({
          legacy_table: "nex.transport_acquisition_record",
          extra: { provider_kind: "individual_driver" },
        }),
      ),
    ).toBe("transport_driver");
  });
  test("transport fleet_operator → transport_operator", () => {
    expect(
      deriveEntityType(
        row({
          legacy_table: "nex.transport_acquisition_record",
          extra: { provider_kind: "fleet_operator" },
        }),
      ),
    ).toBe("transport_operator");
  });
  test("nex_business quarantined categories → null", () => {
    for (const cat of QUARANTINED_NEX_BUSINESS_CATEGORIES) {
      expect(
        deriveEntityType(
          row({
            legacy_table: "nex_business",
            extra: { business_category: cat },
          }),
        ),
      ).toBeNull();
    }
  });
  test("nex_business 'event' MUST be quarantined", () => {
    expect(
      deriveEntityType(
        row({
          legacy_table: "nex_business",
          extra: { business_category: "event" },
        }),
      ),
    ).toBeNull();
  });
  test("nex_business 'restaurant' → food", () => {
    expect(
      deriveEntityType(
        row({
          legacy_table: "nex_business",
          extra: { business_category: "restaurant" },
        }),
      ),
    ).toBe("food");
  });
  test("unknown table → null", () => {
    expect(deriveEntityType(row({ legacy_table: "nex.unknown_table" }))).toBeNull();
  });
});

describe("rowToCandidate · status invariants", () => {
  test("every candidate carries status 'pending_founder_review'", () => {
    const cand = rowToCandidate({
      row: row({
        business_name: "Hotel X",
        country: "ID",
        entity_type_hint: "accommodation",
      }),
      risk_categories: ["R1"],
      selection_score: 0.5,
      selection_rationale: [],
      run_id: "nex-cand-2026-10-08-01",
      run_time_iso: "2026-10-08T00:00:00Z",
      index_in_run: 0,
    });
    expect(cand.status).toBe("pending_founder_review");
  });
  test("entity_type is sealed enum", () => {
    const cand = rowToCandidate({
      row: row({
        business_name: "Hotel X",
        entity_type_hint: "accommodation",
      }),
      risk_categories: ["R1"],
      selection_score: 0.5,
      selection_rationale: [],
      run_id: "nex-cand-2026-10-08-01",
      run_time_iso: "2026-10-08T00:00:00Z",
      index_in_run: 0,
    });
    expect(SEALED_ENTITY_TYPES).toContain(cand.entity_type);
  });
  test("phone passed through only if E.164 shaped", () => {
    const okE164 = rowToCandidate({
      row: row({
        business_name: "A",
        entity_type_hint: "food",
        phone_raw: "+6281234567890",
      }),
      risk_categories: ["R1"],
      selection_score: 0.5,
      selection_rationale: [],
      run_id: "r",
      run_time_iso: "2026-10-08T00:00:00Z",
      index_in_run: 0,
    });
    expect(okE164.identity.phone_e164).toBe("+6281234567890");
    const malformed = rowToCandidate({
      row: row({
        business_name: "A",
        entity_type_hint: "food",
        phone_raw: "0821-1234-5678",
      }),
      risk_categories: ["R1"],
      selection_score: 0.5,
      selection_rationale: [],
      run_id: "r",
      run_time_iso: "2026-10-08T00:00:00Z",
      index_in_run: 1,
    });
    expect(malformed.identity.phone_e164).toBeNull();
    expect(malformed.caveats.some((c) => c.includes("phone_raw"))).toBe(true);
  });
  test("wikidata_qid passed through only if Q-regex matches", () => {
    const good = rowToCandidate({
      row: row({
        business_name: "A",
        entity_type_hint: "place",
        wikidata_qid_hint: "Q42",
      }),
      risk_categories: ["R2"],
      selection_score: 0.5,
      selection_rationale: [],
      run_id: "r",
      run_time_iso: "2026-10-08T00:00:00Z",
      index_in_run: 0,
    });
    expect(good.identity.wikidata_qid).toBe("Q42");
    const bad = rowToCandidate({
      row: row({
        business_name: "A",
        entity_type_hint: "place",
        wikidata_qid_hint: "NOT-A-QID",
      }),
      risk_categories: ["R2"],
      selection_score: 0.5,
      selection_rationale: [],
      run_id: "r",
      run_time_iso: "2026-10-08T00:00:00Z",
      index_in_run: 1,
    });
    expect(bad.identity.wikidata_qid).toBeNull();
    expect(bad.caveats.some((c) => c.toLowerCase().includes("wikidata"))).toBe(true);
  });
  test("missing entity_type_hint throws", () => {
    expect(() =>
      rowToCandidate({
        row: row({ entity_type_hint: null }),
        risk_categories: ["R1"],
        selection_score: 0.5,
        selection_rationale: [],
        run_id: "r",
        run_time_iso: "2026-10-08T00:00:00Z",
        index_in_run: 0,
      }),
    ).toThrow(/entity_type_hint/);
  });
});

describe("pickTopKPerCategory · deterministic ordering", () => {
  test("empty input → every category empty", () => {
    const picked = pickTopKPerCategory([], 10);
    for (const cat of RISK_CATEGORIES) {
      expect(picked.get(cat.code)).toEqual([]);
    }
  });
  test("ties broken by legacy_table then legacy_ref ASC", () => {
    const r1 = row({ legacy_table: "nex.food_business", legacy_ref: "B" });
    const r2 = row({ legacy_table: "nex.food_business", legacy_ref: "A" });
    const r3 = row({ legacy_table: "nex.accommodation_business", legacy_ref: "Z" });
    const scored = [
      { row: r1, byCategory: new Map<RiskCategory, number>([["R1", 0.5]]) },
      { row: r2, byCategory: new Map<RiskCategory, number>([["R1", 0.5]]) },
      { row: r3, byCategory: new Map<RiskCategory, number>([["R1", 0.5]]) },
    ];
    const picked = pickTopKPerCategory(scored, 10);
    const r1List = picked.get("R1")!;
    expect(r1List.length).toBe(3);
    expect(r1List[0].row.legacy_ref).toBe("Z"); // accommodation sorts before food
    expect(r1List[1].row.legacy_ref).toBe("A"); // food A before food B
    expect(r1List[2].row.legacy_ref).toBe("B");
  });
  test("respects topK cap", () => {
    const scored = Array.from({ length: 20 }, (_, i) => ({
      row: row({ legacy_ref: `R-${String(i).padStart(2, "0")}` }),
      byCategory: new Map<RiskCategory, number>([["R6", 0.5]]),
    }));
    const picked = pickTopKPerCategory(scored, 5);
    expect(picked.get("R6")!.length).toBe(5);
  });
  test("same input in different order produces same output", () => {
    const base = Array.from({ length: 10 }, (_, i) => ({
      row: row({ legacy_ref: `R-${i}` }),
      byCategory: new Map<RiskCategory, number>([["R2", (i + 1) / 10]]),
    }));
    const picked1 = pickTopKPerCategory(base, 5);
    const picked2 = pickTopKPerCategory([...base].reverse(), 5);
    expect(picked1.get("R2")!.map((p) => p.row.legacy_ref)).toEqual(
      picked2.get("R2")!.map((p) => p.row.legacy_ref),
    );
  });
});

describe("SCORERS map · every category present", () => {
  test("one scorer per sealed R1-R10", () => {
    for (const cat of RISK_CATEGORIES) {
      expect(typeof SCORERS[cat.code]).toBe("function");
    }
  });
});

describe("sealed invariants · defensive assertions", () => {
  test("SEALED_ENTITY_TYPES is exactly 9 values", () => {
    expect(SEALED_ENTITY_TYPES.length).toBe(9);
  });
  test("RISK_CATEGORIES is exactly 10 values", () => {
    expect(RISK_CATEGORIES.length).toBe(10);
  });
  test("all quarantined nex_business categories cannot resolve to entity_type", () => {
    for (const cat of QUARANTINED_NEX_BUSINESS_CATEGORIES) {
      const et = deriveEntityType(
        row({
          legacy_table: "nex_business",
          extra: { business_category: cat },
        }),
      );
      expect(et).toBeNull();
    }
  });
  test("quarantined transport provider_kind cannot resolve", () => {
    for (const kind of QUARANTINED_TRANSPORT_PROVIDER_KINDS) {
      const et = deriveEntityType(
        row({
          legacy_table: "nex.transport_acquisition_record",
          extra: { provider_kind: kind },
        }),
      );
      expect(et).toBeNull();
    }
  });
});
