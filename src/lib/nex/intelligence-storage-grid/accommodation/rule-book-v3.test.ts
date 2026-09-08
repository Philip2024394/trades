// src/lib/nex/intelligence-storage-grid/accommodation/rule-book-v3.test.ts
//
// NEX Accommodation Agent · Rule Book v3 Contract Tests
// Founder BEGIN AUTHORIZATION 2026-09-08 · Indonesia Complete Intelligence Mission
//
// Covers the three new additive modules:
//   activity-taxonomy.ts       (§5 · §15 · §17 refs · §18)
//   nearby-relationship.ts     (§6 · §7 · §11 · §25)
//   evidence-claims.ts         (§16 · §17 · §18)
//
// Focus: prove the CONTRACTS — no fabrication paths, deterministic geometry,
// enum stability, invariants enforced. Nothing here activates any worker
// or touches Postgres.

import { describe, it, expect } from "vitest";
import {
  ACTIVITY_GROUPS,
  ACTIVITY_TYPES,
  ACTIVITY_SLUGS,
  activityRegistryStats,
  activitiesInGroup,
  assertActivityRegistryInvariants,
  getActivityType,
  resolveActivitySlug,
} from "./activity-taxonomy";
import {
  ENDPOINT_KINDS,
  RELATIONSHIP_KINDS,
  assertRelationshipInvariants,
  attachWalkingDrivingFromSource,
  buildNearbyEdge,
  classifyDistanceBand,
  evaluateCityBoundary,
  haversineKm,
  haversineKmRounded,
  relationshipRegistryStats,
  type RelationshipEndpoint,
} from "./nearby-relationship";
import {
  CLAIM_SOURCES,
  CLAIM_SOURCE_RANK,
  POPULARITY_TOKENS,
  SUBJECTIVE_ATTRIBUTES,
  downgradeToUnknown,
  evidenceRegistryStats,
  renderPopularityLabel,
  renderSubjectiveClaim,
  validatePopularityClaim,
  validateSeasonalWindow,
  validateSubjectiveClaim,
  type Claim,
  type PopularityEvidence,
  type SubjectiveClaim,
} from "./evidence-claims";

// ═══════════════════════════════════════════════════════════════════
// activity-taxonomy · §5 · §15
// ═══════════════════════════════════════════════════════════════════

describe("activity-taxonomy · registry invariants (§5)", () => {
  it("passes structural invariants", () => {
    expect(() => assertActivityRegistryInvariants()).not.toThrow();
  });

  it("registry has no duplicate slugs", () => {
    const slugs = new Set(ACTIVITY_TYPES.map((a) => a.slug));
    expect(slugs.size).toBe(ACTIVITY_TYPES.length);
  });

  it("every activity's group is a known ActivityGroup", () => {
    for (const a of ACTIVITY_TYPES) {
      expect(ACTIVITY_GROUPS).toContain(a.group);
    }
  });

  it("stats returns positive totals for every group present", () => {
    const stats = activityRegistryStats();
    expect(stats.total_types).toBe(ACTIVITY_TYPES.length);
    expect(stats.total_aliases).toBeGreaterThan(0);
    for (const g of ACTIVITY_GROUPS) {
      // Not every group is populated in v3, but if it is, count must match
      const inGroup = activitiesInGroup(g);
      expect(stats.by_group[g]).toBe(inGroup.length);
    }
  });

  it("core Founder examples are all present", () => {
    // §5 Nature examples
    for (const slug of ["lake", "waterfall", "river", "beach", "mountain", "volcano", "forest", "jungle", "cave", "island", "coral_reef", "hot_spring", "rice_terrace", "viewpoint", "sunrise_location", "sunset_location"]) {
      expect(getActivityType(slug), `Nature slug missing: ${slug}`).not.toBeNull();
    }
    // §5 Outdoor examples
    for (const slug of ["hiking", "walking", "trekking", "cycling", "running", "swimming", "snorkelling", "diving", "surfing", "fishing", "kayaking", "rafting", "camping", "horse_riding", "golf", "climbing", "wildlife_watching", "bird_watching"]) {
      expect(getActivityType(slug), `Outdoor slug missing: ${slug}`).not.toBeNull();
    }
    // §5 Culture examples
    for (const slug of ["temple", "mosque", "church", "palace", "museum", "historic_site", "traditional_village", "cultural_performance", "festival", "market", "craft_centre", "heritage_area"]) {
      expect(getActivityType(slug), `Culture slug missing: ${slug}`).not.toBeNull();
    }
  });

  it("§11 transport hub entries are all present", () => {
    for (const slug of ["airport", "rail_station", "bus_station", "ferry_terminal", "metro_station", "tram_stop", "taxi_rank", "ride_pickup_zone", "parking", "ev_charging"]) {
      expect(getActivityType(slug), `Transport slug missing: ${slug}`).not.toBeNull();
    }
  });
});

describe("activity-taxonomy · alias resolver (§5)", () => {
  it("resolves canonical slug", () => {
    expect(resolveActivitySlug("hiking")).toBe("hiking");
  });

  it("resolves display name (case-insensitive)", () => {
    expect(resolveActivitySlug("Waterfall")).toBe("waterfall");
    expect(resolveActivitySlug("WATERFALL")).toBe("waterfall");
  });

  it("resolves Indonesian synonyms", () => {
    expect(resolveActivitySlug("danau")).toBe("lake");
    expect(resolveActivitySlug("air terjun")).toBe("waterfall");
    expect(resolveActivitySlug("pantai")).toBe("beach");
    expect(resolveActivitySlug("gunung")).toBe("mountain");
    expect(resolveActivitySlug("candi (Javanese)")).toBe("temple");
    expect(resolveActivitySlug("masjid")).toBe("mosque");
    expect(resolveActivitySlug("pasar")).toBe("market");
    expect(resolveActivitySlug("bandara")).toBe("airport");
  });

  it("returns null on unknown input (§16 UNKNOWN discipline)", () => {
    expect(resolveActivitySlug("unknown-thing")).toBeNull();
    expect(resolveActivitySlug("")).toBeNull();
    expect(resolveActivitySlug(null)).toBeNull();
    expect(resolveActivitySlug(undefined)).toBeNull();
  });

  it("normalises whitespace", () => {
    expect(resolveActivitySlug("  waterfall  ")).toBe("waterfall");
    expect(resolveActivitySlug("air   terjun")).toBe("waterfall");
  });
});

// ═══════════════════════════════════════════════════════════════════
// nearby-relationship · §6 · §7 · §25
// ═══════════════════════════════════════════════════════════════════

describe("nearby-relationship · Haversine (§6 deterministic distance)", () => {
  it("returns 0 for identical points", () => {
    const p = { latitude: -7.7956, longitude: 110.3695 }; // Yogyakarta
    expect(haversineKm(p, p)).toBe(0);
  });

  it("returns null when any coordinate missing (§6 no fabrication)", () => {
    expect(haversineKm(null, null)).toBeNull();
    expect(haversineKm({ latitude: 0, longitude: 0 }, null)).toBeNull();
    expect(haversineKm({ latitude: null, longitude: 0 }, { latitude: 0, longitude: 0 })).toBeNull();
    expect(haversineKm({ latitude: 0, longitude: null }, { latitude: 0, longitude: 0 })).toBeNull();
  });

  it("returns null on invalid coordinate ranges (never silent bad value)", () => {
    expect(haversineKm({ latitude: 91, longitude: 0 }, { latitude: 0, longitude: 0 })).toBeNull();
    expect(haversineKm({ latitude: -91, longitude: 0 }, { latitude: 0, longitude: 0 })).toBeNull();
    expect(haversineKm({ latitude: 0, longitude: 181 }, { latitude: 0, longitude: 0 })).toBeNull();
    expect(haversineKm({ latitude: 0, longitude: -181 }, { latitude: 0, longitude: 0 })).toBeNull();
    expect(haversineKm({ latitude: NaN, longitude: 0 }, { latitude: 0, longitude: 0 })).toBeNull();
    expect(haversineKm({ latitude: Infinity, longitude: 0 }, { latitude: 0, longitude: 0 })).toBeNull();
  });

  it("computes known Yogyakarta → Bali distance within tolerance", () => {
    // Yogyakarta (approx -7.7956, 110.3695) → Denpasar (approx -8.6705, 115.2126)
    // Known ~ 555 km great-circle
    const km = haversineKm(
      { latitude: -7.7956, longitude: 110.3695 },
      { latitude: -8.6705, longitude: 115.2126 },
    );
    expect(km).not.toBeNull();
    expect(km!).toBeGreaterThan(540);
    expect(km!).toBeLessThan(570);
  });

  it("computes known Jakarta → Yogyakarta distance within tolerance", () => {
    // Jakarta (-6.2088, 106.8456) → Yogyakarta (-7.7956, 110.3695)
    // Known ~ 428 km great-circle
    const km = haversineKm(
      { latitude: -6.2088, longitude: 106.8456 },
      { latitude: -7.7956, longitude: 110.3695 },
    );
    expect(km).not.toBeNull();
    expect(km!).toBeGreaterThan(420);
    expect(km!).toBeLessThan(440);
  });

  it("is symmetric", () => {
    const a = { latitude: -7.7956, longitude: 110.3695 };
    const b = { latitude: -8.6705, longitude: 115.2126 };
    expect(haversineKm(a, b)).toBeCloseTo(haversineKm(b, a)!, 6);
  });

  it("rounded variant rounds to millimetre precision", () => {
    const raw = haversineKm(
      { latitude: -7.7956, longitude: 110.3695 },
      { latitude: -7.7957, longitude: 110.3696 },
    )!;
    const rounded = haversineKmRounded(
      { latitude: -7.7956, longitude: 110.3695 },
      { latitude: -7.7957, longitude: 110.3696 },
    )!;
    expect(rounded).toBeCloseTo(raw, 3);
    // Round to 3 decimal places
    expect((rounded * 1000) % 1).toBe(0);
  });
});

describe("nearby-relationship · distance band classifier (§6)", () => {
  it("classifies each threshold band", () => {
    expect(classifyDistanceBand(0.1)).toBe("IMMEDIATE");
    expect(classifyDistanceBand(0.5)).toBe("WALKABLE");
    expect(classifyDistanceBand(2.0)).toBe("SHORT_TRAVEL");
    expect(classifyDistanceBand(7.0)).toBe("MEDIUM_TRAVEL");
    expect(classifyDistanceBand(20.0)).toBe("LONG_TRAVEL");
    expect(classifyDistanceBand(50.0)).toBe("TRIP");
    expect(classifyDistanceBand(500.0)).toBe("REMOTE");
  });

  it("returns UNKNOWN for null / negative / non-finite (never fabricates)", () => {
    expect(classifyDistanceBand(null)).toBe("UNKNOWN");
    expect(classifyDistanceBand(undefined)).toBe("UNKNOWN");
    expect(classifyDistanceBand(-1)).toBe("UNKNOWN");
    expect(classifyDistanceBand(NaN)).toBe("UNKNOWN");
    expect(classifyDistanceBand(Infinity)).toBe("UNKNOWN");
  });

  it("boundary handling at exact thresholds", () => {
    expect(classifyDistanceBand(0.20)).toBe("WALKABLE");    // exactly 0.20 = WALKABLE
    expect(classifyDistanceBand(1.00)).toBe("SHORT_TRAVEL");
    expect(classifyDistanceBand(3.00)).toBe("MEDIUM_TRAVEL");
    expect(classifyDistanceBand(10.00)).toBe("LONG_TRAVEL");
    expect(classifyDistanceBand(30.00)).toBe("TRIP");
    expect(classifyDistanceBand(100.00)).toBe("REMOTE");
  });
});

describe("nearby-relationship · city-boundary eligibility (§7)", () => {
  it("same city is always eligible", () => {
    const r = evaluateCityBoundary({ same_city: true, distance_km: 15, endpoint_kind: "FOOD_VENUE" });
    expect(r.eligible).toBe(true);
    expect(r.reason).toBe("same_city");
  });

  it("different city within 30 km is eligible for any endpoint kind", () => {
    const r = evaluateCityBoundary({ same_city: false, distance_km: 20, endpoint_kind: "FOOD_VENUE" });
    expect(r.eligible).toBe(true);
  });

  it("different city 30-100 km eligible ONLY for destination-class endpoints (§7)", () => {
    const nature = evaluateCityBoundary({ same_city: false, distance_km: 50, endpoint_kind: "NATURE_LOCATION" });
    const food = evaluateCityBoundary({ same_city: false, distance_km: 50, endpoint_kind: "FOOD_VENUE" });
    expect(nature.eligible).toBe(true);
    expect(food.eligible).toBe(false);
  });

  it("different city > 100 km is never auto-eligible (needs REACHABLE_FROM)", () => {
    const r = evaluateCityBoundary({ same_city: false, distance_km: 150, endpoint_kind: "NATURE_LOCATION" });
    expect(r.eligible).toBe(false);
  });

  it("different city with unknown distance is not eligible (§6 no fabrication)", () => {
    const r = evaluateCityBoundary({ same_city: false, distance_km: null, endpoint_kind: "NATURE_LOCATION" });
    expect(r.eligible).toBe(false);
  });
});

describe("nearby-relationship · buildNearbyEdge (§25)", () => {
  const hotel: RelationshipEndpoint = {
    endpoint_kind: "ACCOMMODATION",
    endpoint_id: "AC-001",
    display_name: "Hotel Malioboro",
    country_code: "ID",
    city: "Yogyakarta",
    district: null,
    latitude: -7.7956,
    longitude: 110.3695,
    accommodation_category: "hotel",
  };
  const lake: RelationshipEndpoint = {
    endpoint_kind: "NATURE_LOCATION",
    endpoint_id: "NAT-001",
    display_name: "Lake near Yogya",
    country_code: "ID",
    city: null,
    district: null,
    latitude: -7.6500,
    longitude: 110.4200,
    activity_type_slug: "lake",
  };

  it("builds a valid edge with deterministic distance", () => {
    const edge = buildNearbyEdge({
      edge_id: "REL-001",
      source: hotel,
      target: lake,
      first_seen_at: "2026-09-08T00:00:00Z",
      trust_layer: "L5_OBSERVED_UNVERIFIED",
      evidence_label: "MEASURED",
      source_records: [{ source: "haversine", retrieved_at: "2026-09-08T00:00:00Z", source_ref: "computed" }],
    });
    expect(edge).not.toBeNull();
    expect(edge!.distance.straight_line_km).not.toBeNull();
    expect(edge!.distance.distance_source).toBe("OBJECTIVE_ATTRIBUTE");
    expect(edge!.distance.walking_km).toBeNull();
    expect(edge!.distance.walking_minutes).toBeNull();
    expect(edge!.distance.driving_km).toBeNull();
    expect(edge!.distance.driving_minutes).toBeNull();
    expect(() => assertRelationshipInvariants(edge!)).not.toThrow();
  });

  it("rejects self-loops", () => {
    expect(() => buildNearbyEdge({
      edge_id: "REL-002",
      source: hotel,
      target: hotel,
      first_seen_at: "2026-09-08T00:00:00Z",
      trust_layer: "L5_OBSERVED_UNVERIFIED",
      evidence_label: "MEASURED",
      source_records: [],
    })).toThrow(/self-loop/);
  });

  it("returns null when neither coordinates nor distance_hint provided (§6)", () => {
    const noCoord: RelationshipEndpoint = { ...hotel, latitude: null, longitude: null };
    const edge = buildNearbyEdge({
      edge_id: "REL-003",
      source: noCoord,
      target: lake,
      first_seen_at: "2026-09-08T00:00:00Z",
      trust_layer: "L5_OBSERVED_UNVERIFIED",
      evidence_label: "UNKNOWN",
      source_records: [],
    });
    expect(edge).toBeNull();
  });

  it("uses distance_hint_km with required source_ref when coords missing", () => {
    const noCoord: RelationshipEndpoint = { ...hotel, latitude: null, longitude: null };
    const edge = buildNearbyEdge({
      edge_id: "REL-004",
      source: noCoord,
      target: lake,
      distance_hint_km: 8,
      distance_source_ref: "source://tourism-board/ID/2026",
      first_seen_at: "2026-09-08T00:00:00Z",
      trust_layer: "L4_SECONDARY_SOURCE",
      evidence_label: "DOCUMENTED",
      source_records: [],
    });
    expect(edge).not.toBeNull();
    expect(edge!.distance.straight_line_km).toBe(8);
    expect(edge!.distance.distance_source).toBe("SOURCE_DESCRIPTION");
    expect(edge!.distance.distance_source_ref).toBe("source://tourism-board/ID/2026");
  });

  it("distance_hint without source_ref throws (§16 no source no persist)", () => {
    const noCoord: RelationshipEndpoint = { ...hotel, latitude: null, longitude: null };
    expect(() => buildNearbyEdge({
      edge_id: "REL-005",
      source: noCoord,
      target: lake,
      distance_hint_km: 8,
      first_seen_at: "2026-09-08T00:00:00Z",
      trust_layer: "L5_OBSERVED_UNVERIFIED",
      evidence_label: "UNKNOWN",
      source_records: [],
    })).toThrow(/distance_source_ref required/);
  });

  it("crosses_city_boundary respects city difference (§7)", () => {
    const edge = buildNearbyEdge({
      edge_id: "REL-006",
      source: hotel,
      target: lake,       // city: null
      first_seen_at: "2026-09-08T00:00:00Z",
      trust_layer: "L5_OBSERVED_UNVERIFIED",
      evidence_label: "MEASURED",
      source_records: [],
    });
    expect(edge!.crosses_city_boundary).toBe(true);
  });

  it("attachWalkingDrivingFromSource preserves immutability + requires source_ref", () => {
    const edge = buildNearbyEdge({
      edge_id: "REL-007",
      source: hotel,
      target: lake,
      first_seen_at: "2026-09-08T00:00:00Z",
      trust_layer: "L5_OBSERVED_UNVERIFIED",
      evidence_label: "MEASURED",
      source_records: [],
    })!;
    const enriched = attachWalkingDrivingFromSource(edge, {
      walking_km: 8.5,
      walking_minutes: 105,
      driving_km: 9.1,
      driving_minutes: 25,
      source_ref: "google-maps:distance-matrix",
    });
    expect(enriched.distance.walking_km).toBe(8.5);
    expect(enriched.distance.driving_minutes).toBe(25);
    // Original untouched
    expect(edge.distance.walking_km).toBeNull();
    // Empty source_ref rejected
    expect(() => attachWalkingDrivingFromSource(edge, { walking_km: 1, source_ref: "" })).toThrow(/source_ref required/);
  });

  it("registry stats returns non-empty enums", () => {
    const s = relationshipRegistryStats();
    expect(s.relationship_kinds).toBe(RELATIONSHIP_KINDS.length);
    expect(s.endpoint_kinds).toBe(ENDPOINT_KINDS.length);
    expect(s.distance_bands.length).toBeGreaterThan(0);
  });
});

// ═══════════════════════════════════════════════════════════════════
// evidence-claims · §16 · §17 · §18
// ═══════════════════════════════════════════════════════════════════

describe("evidence-claims · claim source rank (§17)", () => {
  it("OBJECTIVE_ATTRIBUTE outranks all other sources", () => {
    const oa = CLAIM_SOURCE_RANK.OBJECTIVE_ATTRIBUTE;
    for (const src of CLAIM_SOURCES) {
      if (src === "OBJECTIVE_ATTRIBUTE") continue;
      expect(oa).toBeGreaterThan(CLAIM_SOURCE_RANK[src]);
    }
  });

  it("UNKNOWN is strictly lowest", () => {
    const un = CLAIM_SOURCE_RANK.UNKNOWN;
    for (const src of CLAIM_SOURCES) {
      if (src === "UNKNOWN") continue;
      expect(un).toBeLessThan(CLAIM_SOURCE_RANK[src]);
    }
  });

  it("all ranks are distinct", () => {
    const s = evidenceRegistryStats();
    expect(s.claim_source_rank_distinct).toBe(true);
  });
});

describe("evidence-claims · popularity validation (§16 no invented score)", () => {
  const iso = "2026-09-08T00:00:00Z";

  it("rejects when signals empty", () => {
    const ev: PopularityEvidence = {
      token: "popular",
      signals: [],
      computed_at: iso,
      window_days: 30,
      min_count_for_claim: 10,
      claim_source: "SOURCE_DESCRIPTION",
      source_ref: "tourism-board:2026",
    };
    const r = validatePopularityClaim(ev);
    expect(r.ok).toBe(false);
  });

  it("rejects when ONLY NEX_INTERNAL_SEARCH_VOLUME (self-referential loop)", () => {
    const ev: PopularityEvidence = {
      token: "popular",
      signals: [{
        kind: "NEX_INTERNAL_SEARCH_VOLUME",
        count: 1_000_000, sample_size: null,
        source: "nex", retrieved_at: iso,
      }],
      computed_at: iso,
      window_days: 30,
      min_count_for_claim: 10,
      claim_source: "NEX_INFERENCE",
      source_ref: null,
    };
    const r = validatePopularityClaim(ev);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/NEX-internal/);
  });

  it("rejects when evidence count below threshold", () => {
    const ev: PopularityEvidence = {
      token: "popular",
      signals: [{
        kind: "REVIEW_VOLUME",
        count: 3, sample_size: 3,
        source: "verified", retrieved_at: iso,
      }],
      computed_at: iso,
      window_days: 30,
      min_count_for_claim: 100,
      claim_source: "USER_REVIEW_SIGNAL",
      source_ref: "provider:reviews:2026",
    };
    const r = validatePopularityClaim(ev);
    expect(r.ok).toBe(false);
  });

  it("accepts a well-formed source-backed claim", () => {
    const ev: PopularityEvidence = {
      token: "popular",
      signals: [
        { kind: "GOVERNMENT_TOURISM_LIST", count: 1, sample_size: null, source: "id-tourism", retrieved_at: iso },
        { kind: "REVIEW_VOLUME", count: 500, sample_size: 500, source: "reviews-provider", retrieved_at: iso },
      ],
      computed_at: iso,
      window_days: 90,
      min_count_for_claim: 100,
      claim_source: "SOURCE_DESCRIPTION",
      source_ref: "id-tourism://list/2026",
    };
    expect(validatePopularityClaim(ev).ok).toBe(true);
    expect(renderPopularityLabel(ev)).toBe("popular");
  });

  it("renderPopularityLabel returns null for a bad claim (never fabricates)", () => {
    const bad: PopularityEvidence = {
      token: "popular",
      signals: [],
      computed_at: iso, window_days: 30, min_count_for_claim: 1,
      claim_source: "UNKNOWN", source_ref: null,
    };
    expect(renderPopularityLabel(bad)).toBeNull();
  });

  it("rejects unknown popularity token (only whitelist allowed)", () => {
    const ev: PopularityEvidence = {
      // @ts-expect-error - deliberately invalid token
      token: "must_see",
      signals: [{ kind: "SOURCE_STATEMENT", count: 1, sample_size: null, source: "x", retrieved_at: iso }],
      computed_at: iso, window_days: 30, min_count_for_claim: 1,
      claim_source: "SOURCE_DESCRIPTION", source_ref: "x",
    };
    expect(validatePopularityClaim(ev).ok).toBe(false);
  });
});

describe("evidence-claims · subjective claim validation (§17)", () => {
  const iso = "2026-09-08T00:00:00Z";

  it("SOURCE_DESCRIPTION requires source_ref AND source_quote", () => {
    const noRef: SubjectiveClaim = {
      attribute: "scenic", claim_source: "SOURCE_DESCRIPTION",
      source_ref: null, source_quote: "beautiful lake",
      sample_size: null, inference_reasoning: null, observed_at: iso,
    };
    expect(validateSubjectiveClaim(noRef).ok).toBe(false);

    const noQuote: SubjectiveClaim = {
      attribute: "scenic", claim_source: "SOURCE_DESCRIPTION",
      source_ref: "tourism:2026", source_quote: null,
      sample_size: null, inference_reasoning: null, observed_at: iso,
    };
    expect(validateSubjectiveClaim(noQuote).ok).toBe(false);
  });

  it("USER_REVIEW_SIGNAL requires sample_size >= 5", () => {
    const tiny: SubjectiveClaim = {
      attribute: "peaceful", claim_source: "USER_REVIEW_SIGNAL",
      source_ref: "reviews:2026", source_quote: null,
      sample_size: 3, inference_reasoning: null, observed_at: iso,
    };
    expect(validateSubjectiveClaim(tiny).ok).toBe(false);
  });

  it("NEX_INFERENCE requires inference_reasoning", () => {
    const noReason: SubjectiveClaim = {
      attribute: "hidden_gem", claim_source: "NEX_INFERENCE",
      source_ref: null, source_quote: null,
      sample_size: null, inference_reasoning: null, observed_at: iso,
    };
    expect(validateSubjectiveClaim(noReason).ok).toBe(false);
  });

  it("OBJECTIVE_ATTRIBUTE is INVALID for subjective attributes (definitional)", () => {
    const bad: SubjectiveClaim = {
      attribute: "beautiful", claim_source: "OBJECTIVE_ATTRIBUTE",
      source_ref: "x", source_quote: "x",
      sample_size: null, inference_reasoning: null, observed_at: iso,
    };
    expect(validateSubjectiveClaim(bad).ok).toBe(false);
  });

  it("UNKNOWN cannot be persisted as a positive claim", () => {
    const bad: SubjectiveClaim = {
      attribute: "authentic", claim_source: "UNKNOWN",
      source_ref: null, source_quote: null,
      sample_size: null, inference_reasoning: null, observed_at: iso,
    };
    expect(validateSubjectiveClaim(bad).ok).toBe(false);
  });

  it("best_in_class requires comparison scope in source_quote", () => {
    const shortQuote: SubjectiveClaim = {
      attribute: "best_in_class", claim_source: "SOURCE_DESCRIPTION",
      source_ref: "x", source_quote: "the best",
      sample_size: null, inference_reasoning: null, observed_at: iso,
    };
    expect(validateSubjectiveClaim(shortQuote).ok).toBe(false);

    const goodQuote: SubjectiveClaim = {
      attribute: "best_in_class", claim_source: "SOURCE_DESCRIPTION",
      source_ref: "guidebook:2026", source_quote: "the best boutique hotel in central Yogyakarta",
      sample_size: null, inference_reasoning: null, observed_at: iso,
    };
    expect(validateSubjectiveClaim(goodQuote).ok).toBe(true);
  });

  it("renderSubjectiveClaim attributes properly + returns null on invalid claim", () => {
    const good: SubjectiveClaim = {
      attribute: "peaceful", claim_source: "USER_REVIEW_SIGNAL",
      source_ref: "reviews:2026", source_quote: null,
      sample_size: 200, inference_reasoning: null, observed_at: iso,
    };
    const r = renderSubjectiveClaim(good);
    expect(r).not.toBeNull();
    expect(r!.label).toBe("peaceful");
    expect(r!.attribution).toBe("user reviews (n=200)");

    const bad: SubjectiveClaim = {
      attribute: "beautiful", claim_source: "OBJECTIVE_ATTRIBUTE",
      source_ref: null, source_quote: null,
      sample_size: null, inference_reasoning: null, observed_at: iso,
    };
    expect(renderSubjectiveClaim(bad)).toBeNull();
  });
});

describe("evidence-claims · seasonal window validation (§18)", () => {
  it("rejects empty months", () => {
    const r = validateSeasonalWindow({
      kind: "SURF_SEASON", months: [], notes: null,
      claim_source: "SOURCE_DESCRIPTION", source_ref: "surf-report:2026",
    });
    expect(r.ok).toBe(false);
  });

  it("rejects invalid month values", () => {
    const r = validateSeasonalWindow({
      kind: "HIKING_SEASON", months: [1, 2, 13], notes: null,
      claim_source: "SOURCE_DESCRIPTION", source_ref: "park:2026",
    });
    expect(r.ok).toBe(false);
  });

  it("rejects duplicate months", () => {
    const r = validateSeasonalWindow({
      kind: "DIVING_SEASON", months: [4, 5, 5, 6], notes: null,
      claim_source: "SOURCE_DESCRIPTION", source_ref: "dive-op:2026",
    });
    expect(r.ok).toBe(false);
  });

  it("rejects UNKNOWN claim source", () => {
    const r = validateSeasonalWindow({
      kind: "BEST_SEASON", months: [6, 7, 8], notes: null,
      claim_source: "UNKNOWN", source_ref: "x",
    });
    expect(r.ok).toBe(false);
  });

  it("rejects when source_ref missing (§18 safety-adjacent)", () => {
    const r = validateSeasonalWindow({
      kind: "FESTIVAL_PERIOD", months: [3], notes: "Nyepi",
      claim_source: "SOURCE_DESCRIPTION", source_ref: null,
    });
    expect(r.ok).toBe(false);
  });

  it("accepts well-formed window", () => {
    const r = validateSeasonalWindow({
      kind: "SURF_SEASON", months: [4, 5, 6, 7, 8, 9], notes: "Bukit Peninsula dry season",
      claim_source: "SOURCE_DESCRIPTION", source_ref: "surf-guide:2026",
    });
    expect(r.ok).toBe(true);
  });
});

describe("evidence-claims · downgradeToUnknown (§16 audit trail)", () => {
  it("preserves observed_at + trust_layer + source_ref for audit", () => {
    const claim: Claim<string> = {
      value: "some claim",
      claim_source: "SOURCE_DESCRIPTION",
      source_ref: "source:X",
      observed_at: "2026-09-08T00:00:00Z",
      freshness: "FRESH",
      trust_layer: "L3_AUTHORITATIVE_SOURCE",
      evidence_label: "DOCUMENTED",
    };
    const d = downgradeToUnknown(claim, "source could not be verified");
    expect(d.value).toBeNull();
    expect(d.claim_source).toBe("UNKNOWN");
    expect(d.freshness).toBe("UNKNOWN");
    expect(d.evidence_label).toBe("UNKNOWN");
    expect(d.source_ref).toBe("source:X");                        // preserved
    expect(d.trust_layer).toBe("L3_AUTHORITATIVE_SOURCE");        // preserved
    expect(d.observed_at).toBe("2026-09-08T00:00:00Z");           // preserved
    expect(d.downgrade_reason).toBe("source could not be verified");
  });
});

describe("evidence-claims · registry stats", () => {
  it("returns coherent counts", () => {
    const s = evidenceRegistryStats();
    expect(s.popularity_tokens).toBe(POPULARITY_TOKENS.length);
    expect(s.subjective_attributes).toBe(SUBJECTIVE_ATTRIBUTES.length);
    expect(s.claim_sources).toBe(CLAIM_SOURCES.length);
    expect(s.claim_source_rank_distinct).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════
// Cross-module integration · activity + relationship + evidence
// ═══════════════════════════════════════════════════════════════════

describe("cross-module integration · Hotel NEARBY Lake with subjective claim (§25 + §17)", () => {
  it("builds a full evidence-tagged nearby record", () => {
    const hotel: RelationshipEndpoint = {
      endpoint_kind: "ACCOMMODATION",
      endpoint_id: "AC-999", display_name: "Test Hotel",
      country_code: "ID", city: "Yogyakarta", district: null,
      latitude: -7.7956, longitude: 110.3695,
      accommodation_category: "hotel",
    };
    const lake: RelationshipEndpoint = {
      endpoint_kind: "NATURE_LOCATION",
      endpoint_id: "NAT-999", display_name: "Lake",
      country_code: "ID", city: null, district: null,
      latitude: -7.65, longitude: 110.42,
      activity_type_slug: resolveActivitySlug("danau") ?? undefined,   // resolved from Indonesian synonym
    };
    expect(lake.activity_type_slug).toBe("lake");

    const edge = buildNearbyEdge({
      edge_id: "REL-INT-001",
      source: hotel,
      target: lake,
      nearby_subtype: "nature",
      first_seen_at: "2026-09-08T00:00:00Z",
      trust_layer: "L5_OBSERVED_UNVERIFIED",
      evidence_label: "MEASURED",
      source_records: [{ source: "haversine", retrieved_at: "2026-09-08T00:00:00Z", source_ref: "computed" }],
    });
    expect(edge).not.toBeNull();

    // Attach a subjective claim about the lake (must pass validation)
    const claim: SubjectiveClaim = {
      attribute: "scenic",
      claim_source: "SOURCE_DESCRIPTION",
      source_ref: "id-tourism:2026:lake-x",
      source_quote: "Danau ini dikenal sebagai salah satu yang paling indah di Yogyakarta.",
      sample_size: null, inference_reasoning: null,
      observed_at: "2026-09-08T00:00:00Z",
    };
    expect(validateSubjectiveClaim(claim).ok).toBe(true);
    const rendered = renderSubjectiveClaim(claim);
    expect(rendered).not.toBeNull();
    expect(rendered!.attribution).toBe("id-tourism:2026:lake-x");
  });
});
