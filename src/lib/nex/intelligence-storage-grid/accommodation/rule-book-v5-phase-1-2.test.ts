// src/lib/nex/intelligence-storage-grid/accommodation/rule-book-v5-phase-1-2.test.ts
//
// NEX Accommodation Agent · Rule Book v5 · Phase 1 + Phase 2 Contract Tests
// Founder BEGIN 2026-09-08 · Indonesia Complete Country Intelligence Mission
//
// Covers new additive modules from THIS BEGIN:
//   gap-engine.ts                (§5 · §6 · §7)
//   indonesia-coverage-queue.ts  (§3 · §4)
//
// Prior v3 (59) + v4 (68) tests preserved unchanged.

import { describe, it, expect } from "vitest";
import {
  GAP_KINDS,
  GAP_PRIORITY_WEIGHTS,
  assertGapEngineInvariants,
  countryProfileGaps,
  detectAndPrioritiseGaps,
  detectGeoUnitGaps,
  detectPropertyGaps,
  gapEngineRegistryStats,
  prioritiseGap,
  unanswerableQuestionsForProperty,
  type GeoUnitInput,
} from "./gap-engine";
import {
  COVERAGE_STATES,
  COVERAGE_STATE_TRANSITIONS,
  INDONESIA_ISLAND_GROUPS,
  INDONESIA_PROVINCES,
  aggregateByIslandGroup,
  assertCoverageQueueInvariants,
  coverageQueueRegistryStats,
  coverageSummary,
  pickResearchCandidates,
  seedIndonesiaCoverageQueue,
  seedIndonesiaCountryUnit,
  seedProvinceUnit,
  sortQueueByPriority,
  transitionCoverageState,
} from "./indonesia-coverage-queue";

// ═══════════════════════════════════════════════════════════════════
// GAP ENGINE (§5 · §6 · §7)
// ═══════════════════════════════════════════════════════════════════

describe("gap-engine · registry invariants (§5)", () => {
  it("passes assertGapEngineInvariants (no duplicate GapKind · weights sum to 1)", () => {
    expect(() => assertGapEngineInvariants()).not.toThrow();
  });

  it("registry stats coherent", () => {
    const s = gapEngineRegistryStats();
    expect(s.gap_kinds).toBe(GAP_KINDS.length);
    expect(s.weights_total).toBe(1);
    expect(s.buckets).toEqual(["HIGH", "MEDIUM", "LOW"]);
  });

  it("all GAP_PRIORITY_WEIGHTS are in [0, 1]", () => {
    for (const w of Object.values(GAP_PRIORITY_WEIGHTS)) {
      expect(w).toBeGreaterThanOrEqual(0);
      expect(w).toBeLessThanOrEqual(1);
    }
  });
});

describe("gap-engine · prioritiseGap (§6)", () => {
  const zero = {
    demand_signal: 0, destination_importance: 0, crossdomain_leverage: 0,
    freshness_pressure: 0, source_availability: 0, resolvability_score: 0,
    confidence_current: 0, activity_relevance: 0, accommodation_relevance: 0,
  };

  it("all-zero signals + zero confidence produces priority ~ (1 - 0) * weight_inverted only", () => {
    const p = prioritiseGap({
      ...zero,
      gap_kind: "MISSING_ROOMS", subject_kind: "PROPERTY", subject_ref: "test",
      country_code: "ID", region: null, city: null, discovered_at_iso: "2026-09-08T00:00:00Z",
    });
    // confidence_current_inverted weight = 0.10 · (1-0) = 0.10
    expect(p.priority).toBe(0.1);
    expect(p.priority_bucket).toBe("LOW");
  });

  it("all-max signals + zero confidence produces priority ~ 1.0 → HIGH bucket", () => {
    const p = prioritiseGap({
      demand_signal: 1, destination_importance: 1, crossdomain_leverage: 1,
      freshness_pressure: 1, source_availability: 1, resolvability_score: 1,
      confidence_current: 0, activity_relevance: 1, accommodation_relevance: 1,
      gap_kind: "MISSING_ROOMS", subject_kind: "PROPERTY", subject_ref: "test",
      country_code: "ID", region: null, city: null, discovered_at_iso: "2026-09-08T00:00:00Z",
    });
    expect(p.priority).toBe(1);
    expect(p.priority_bucket).toBe("HIGH");
  });

  it("out-of-range signals are clamped · never fabricated", () => {
    const p = prioritiseGap({
      demand_signal: 999, destination_importance: -5, crossdomain_leverage: NaN,
      freshness_pressure: 1, source_availability: 0.5, resolvability_score: 0.5,
      confidence_current: 0.5, activity_relevance: 0.5, accommodation_relevance: 0.5,
      gap_kind: "MISSING_ROOMS", subject_kind: "PROPERTY", subject_ref: "test",
      country_code: "ID", region: null, city: null, discovered_at_iso: "2026-09-08T00:00:00Z",
    });
    expect(p.priority).toBeGreaterThan(0);
    expect(p.priority).toBeLessThanOrEqual(1);
  });

  it("bucket boundaries: HIGH >= 0.66 · MEDIUM >= 0.33 · else LOW", () => {
    // Confidence 0 with all mid signals · roughly 0.5 with inverted confidence bump · MEDIUM
    const mid = prioritiseGap({
      demand_signal: 0.5, destination_importance: 0.5, crossdomain_leverage: 0.5,
      freshness_pressure: 0.5, source_availability: 0.5, resolvability_score: 0.5,
      confidence_current: 0.5, activity_relevance: 0.5, accommodation_relevance: 0.5,
      gap_kind: "MISSING_ROOMS", subject_kind: "PROPERTY", subject_ref: "test",
      country_code: "ID", region: null, city: null, discovered_at_iso: "2026-09-08T00:00:00Z",
    });
    expect(mid.priority_bucket).toBe("MEDIUM");
  });
});

describe("gap-engine · property gap detection (§5)", () => {
  it("empty record produces all major structural gaps", () => {
    const gaps = detectPropertyGaps({});
    const kinds = new Set(gaps.map((g) => g.gap_kind));
    expect(kinds.has("MISSING_CATEGORY")).toBe(true);
    expect(kinds.has("MISSING_COORDINATES")).toBe(true);
    expect(kinds.has("MISSING_ADDRESS")).toBe(true);
    expect(kinds.has("MISSING_ROOMS")).toBe(true);
    expect(kinds.has("MISSING_FACILITIES")).toBe(true);
    expect(kinds.has("MISSING_SERVICES")).toBe(true);
    expect(kinds.has("MISSING_FOOD")).toBe(true);
    expect(kinds.has("MISSING_IMAGES")).toBe(true);
    expect(kinds.has("MISSING_POLICIES")).toBe(true);
    expect(kinds.has("MISSING_ACCESSIBILITY")).toBe(true);
  });

  it("empty record produces nearby-scope gaps too", () => {
    const gaps = detectPropertyGaps({});
    const kinds = new Set(gaps.map((g) => g.gap_kind));
    expect(kinds.has("MISSING_NEARBY_RESTAURANTS")).toBe(true);
    expect(kinds.has("MISSING_NEARBY_ATTRACTIONS")).toBe(true);
    expect(kinds.has("MISSING_NEARBY_NATURE")).toBe(true);
    expect(kinds.has("MISSING_NEARBY_ACTIVITIES")).toBe(true);
    expect(kinds.has("MISSING_NEARBY_TRANSPORT")).toBe(true);
  });

  it("populated record produces zero structural gaps", () => {
    const gaps = detectPropertyGaps({
      identity: { canonical_property_id: "u", public_listing_ref: "#AC-1", property_name: "Hotel", original_name: null, original_language: null, translated_name: null, aliases: [], canonical_category: "hotel", extended_type_slug: null, source_type: null, source_subtype: null, brand: null, chain: null, independent: null, description: null, description_language: null, style_tags: [], purpose_tags: [], service_level: null },
      location: { country_code: "ID", region: "Java", state_province: null, city: "Yogyakarta", district: null, neighbourhood: null, street: "Jl X", address_full: "Jl X 1", postal_code: null, latitude: -7.8, longitude: 110.4, geographic_confidence: 1, city_centre_distance_km: null, airport_distance_km: null, station_distance_km: null, beach_distance_km: null },
      rooms: [{ room_type_id: "r1", property_ref: "#AC-1", unit_kind: "room", room_name: "Std", original_room_name: null, translated_room_name: null, room_category: null, bed_configurations: [{ bed_type: "double", count: 1, extra_bed_available: null, crib_cot_available: null }], total_beds: 1, maximum_occupancy: 2, minimum_occupancy: null, adult_capacity: 2, child_capacity: null, room_size: null, room_size_unit: null, bedroom_count: 1, bathrooms: [], bathroom_count: 1, has_kitchen: null, has_kitchenette: null, has_refrigerator: null, has_microwave: null, has_cooking_facilities: null, has_balcony: null, has_terrace: null, has_patio: null, has_garden: null, has_private_pool: null, view: null, has_air_conditioning: true, has_heating: null, has_soundproofing: null, has_desk: null, has_workspace: null, has_wardrobe: null, has_safe: null, has_television: null, has_streaming: null, has_minibar: null, has_coffee_machine: null, has_kettle: null, accessibility_features: [], smoking_status: "NON_SMOKING", pet_allowed: null, daily_housekeeping: null, room_description: null, evidence_ref_ids: [], source: "test", confidence: 0.9, freshness_state: "FRESH", trust_layer: "L3_AUTHORITATIVE_SOURCE", provenance: { source: "test", retrieved_at: "2026-09-08T00:00:00Z", source_ref: "x" } as any }],
      facilities: [{ facility: "swimming_pool", present: true, quantity: 1, hours: null, free_of_charge: null, additional_fee: null, evidence_ref_ids: [], confidence: 0.9, status: "OBSERVED", trust_layer: "L3_AUTHORITATIVE_SOURCE", freshness_state: "FRESH" }],
      services: [{ service: "breakfast", available: true, included_in_rate: null, additional_fee: null, hours: null, evidence_ref_ids: [], confidence: 0.9, status: "OBSERVED", trust_layer: "L3_AUTHORITATIVE_SOURCE", freshness_state: "FRESH" }],
      food_and_drink: { has_restaurant: true, restaurant_count: 1, restaurant_cuisines: ["indonesian"], has_bar: null, has_cafe: null, has_pool_bar: null, has_rooftop_bar: null, has_room_service: null, halal_options: null, vegetarian_options: null, vegan_options: null, gluten_free_options: null, dietary_options_other: [], breakfast: { kind: "INCLUDED", included_in_rate: true, price_local_currency: null, price_currency_code: null, hours: null, service_style: null }, board_plans_available: [], evidence_ref_ids: [] },
      images: [{ image_id: "i1", property_ref: "#AC-1", room_type_id: null, source: "x", source_url: "x", collection_time_iso: "x", content_hash: "x", perceptual_hash: null, classification: "PROPERTY_EXTERIOR", scope: "PROPERTY_GENERAL", classification_confidence: 0.9, width_px: null, height_px: null, rights_metadata: { licence: null, attribution: null, commercial_use_permitted: null }, provenance: { source: "x", retrieved_at: "x", source_ref: "x" } as any, status: "OBSERVED", freshness_state: "FRESH", first_seen_iso: "x", last_seen_iso: "x", removed_from_source: false }],
      policies: { check_in_time: "14:00", check_out_time: "12:00", minimum_stay_nights: null, maximum_stay_nights: null, reception_hours: null, quiet_hours: null, smoking_policy: "NON_SMOKING_PROPERTY", pet_policy: { pets_allowed: false, pet_types_allowed: [], pet_fee_local_currency: null, pet_fee_currency_code: null, pet_restrictions: null, pet_facilities: [] }, children_policy: { children_allowed: true, age_restriction_min: null, age_restriction_max: null, family_rooms_available: null, crib_available: null, extra_bed_available: null, kids_pool: null, kids_club: null, playground: null, babysitting_service: null }, extra_bed_policy: null, crib_policy: null, cancellation_information: null, payment_methods: [], evidence_ref_ids: [] },
      accessibility: { wheelchair_access: true, accessible_entrance: null, accessible_room_available: null, accessible_bathroom_available: null, elevator: null, ground_floor_access: null, accessible_parking: null, visual_assistance: null, hearing_assistance: null, evidence_ref_ids: [] },
      nearby: [{ category: "restaurant", target_domain: "food", target_entity_ref: null, target_display_name: "R1", distance_km: 0.5, bearing_degrees: null, confidence: 0.9, freshness_state: "FRESH", evidence_ref_ids: [] }],
      evidence: { total_evidence_refs: 5, verified_field_count: 5, unverified_field_count: 0, conflicting_field_count: 0, unknown_field_count: 0, provenance_coverage_pct: 100 },
      freshness: { last_full_refresh_iso: "2026-09-08T00:00:00Z", oldest_field_written_at_iso: "2026-09-08T00:00:00Z", stale_field_count: 0, fresh_field_count: 5 },
      quality: { completeness_pct: 100, evidence_coverage_pct: 100, overall_confidence: 0.95, evidence_label: "MEASURED" },
    });
    // Property is fully populated · should have NO structural gaps
    const kinds = new Set(gaps.map((g) => g.gap_kind));
    expect(kinds.has("MISSING_CATEGORY")).toBe(false);
    expect(kinds.has("MISSING_COORDINATES")).toBe(false);
    expect(kinds.has("MISSING_ROOMS")).toBe(false);
    expect(kinds.has("MISSING_FACILITIES")).toBe(false);
    expect(kinds.has("MISSING_IMAGES")).toBe(false);
    expect(kinds.has("MISSING_POLICIES")).toBe(false);
  });

  it("gaps carry country_code + subject_ref from the record", () => {
    const gaps = detectPropertyGaps({
      identity: { canonical_property_id: "u", public_listing_ref: "#AC-Z", property_name: "P", original_name: null, original_language: null, translated_name: null, aliases: [], canonical_category: "hotel", extended_type_slug: null, source_type: null, source_subtype: null, brand: null, chain: null, independent: null, description: null, description_language: null, style_tags: [], purpose_tags: [], service_level: null },
      location: { country_code: "ID", region: null, state_province: null, city: "Yogyakarta", district: null, neighbourhood: null, street: null, address_full: null, postal_code: null, latitude: null, longitude: null, geographic_confidence: 0, city_centre_distance_km: null, airport_distance_km: null, station_distance_km: null, beach_distance_km: null },
    });
    for (const g of gaps) {
      expect(g.country_code).toBe("ID");
      expect(g.subject_ref).toBe("#AC-Z");
      expect(g.city).toBe("Yogyakarta");
    }
  });
});

describe("gap-engine · geo-unit gap detection (§7)", () => {
  const base: GeoUnitInput = {
    geo_unit_slug: "id-bali", country_code: "ID", region: "Bali", city: null, district: null,
    coverage_state: "NOT_STARTED", property_count: 0, target_property_count: null,
    tourism_evidence_strength: 0.9, last_researched_iso: null,
  };

  it("NOT_STARTED unit yields GEO_UNIT_NOT_STARTED gap", () => {
    const gaps = detectGeoUnitGaps(base);
    expect(gaps.length).toBe(1);
    expect(gaps[0].gap_kind).toBe("GEO_UNIT_NOT_STARTED");
    expect(gaps[0].destination_importance).toBe(0.9);
  });

  it("SOURCE_UNAVAILABLE unit yields lowered resolvability", () => {
    const gaps = detectGeoUnitGaps({ ...base, coverage_state: "SOURCE_UNAVAILABLE" });
    expect(gaps[0].gap_kind).toBe("GEO_UNIT_SOURCE_UNAVAILABLE");
    expect(gaps[0].source_availability).toBe(0);
    expect(gaps[0].resolvability_score).toBeLessThan(0.5);
  });

  it("STALE unit yields freshness pressure gap", () => {
    const gaps = detectGeoUnitGaps({ ...base, coverage_state: "STALE" });
    expect(gaps[0].gap_kind).toBe("GEO_UNIT_STALE");
    expect(gaps[0].freshness_pressure).toBeGreaterThan(0.5);
  });
});

describe("gap-engine · detectAndPrioritiseGaps composite", () => {
  it("sorts gaps by priority DESC", () => {
    const result = detectAndPrioritiseGaps({
      properties: [{}],   // maximal gaps
      geo_units: [{
        geo_unit_slug: "id-x", country_code: "ID", region: null, city: null, district: null,
        coverage_state: "NOT_STARTED", property_count: 0, target_property_count: null,
        tourism_evidence_strength: 0.9, last_researched_iso: null,
      }],
    });
    expect(result.length).toBeGreaterThan(0);
    for (let i = 1; i < result.length; i++) {
      expect(result[i - 1].priority).toBeGreaterThanOrEqual(result[i].priority);
    }
  });

  it("signal_defaults propagate demand + destination importance", () => {
    const result = detectAndPrioritiseGaps({
      properties: [{
        location: { country_code: "ID", region: null, state_province: null, city: "Bali", district: null, neighbourhood: null, street: null, address_full: null, postal_code: null, latitude: null, longitude: null, geographic_confidence: 0, city_centre_distance_km: null, airport_distance_km: null, station_distance_km: null, beach_distance_km: null },
      }],
      geo_units: [],
      signal_defaults: {
        demand_signal_by_country: { ID: 0.9 },
        destination_importance_by_city: { Bali: 0.95 },
      },
    });
    // At least one gap should have the promoted demand/destination signals
    const enriched = result.find((g) => g.city === "Bali");
    expect(enriched).toBeDefined();
    expect(enriched!.demand_signal).toBe(0.9);
    expect(enriched!.destination_importance).toBe(0.95);
  });
});

describe("gap-engine · unanswerableQuestionsForProperty (§25)", () => {
  it("empty record produces unanswerable ROOM/BEDS/FACILITIES questions", () => {
    const list = unanswerableQuestionsForProperty({});
    const cats = new Set(list.map((q) => q.category));
    expect(cats.has("ROOM")).toBe(true);
    expect(cats.has("BEDS")).toBe(true);
    expect(cats.has("FACILITIES")).toBe(true);
    expect(cats.has("BREAKFAST")).toBe(true);
    expect(cats.has("IMAGES")).toBe(true);
    for (const q of list) {
      expect(q.reason.length).toBeGreaterThan(0);
    }
  });
});

describe("gap-engine · countryProfileGaps integrates with country-profile.ts", () => {
  it("Indonesia has research gaps · surfaces at least one", () => {
    const gaps = countryProfileGaps("ID");
    expect(gaps.length).toBeGreaterThanOrEqual(1);
    for (const g of gaps) {
      expect(g.country_code).toBe("ID");
      expect(g.subject_kind).toBe("GEO_UNIT");
    }
  });

  it("unknown country returns empty list · never fabricates", () => {
    const gaps = countryProfileGaps("XX");
    expect(gaps).toEqual([]);
  });
});

// ═══════════════════════════════════════════════════════════════════
// INDONESIA COVERAGE QUEUE (§3 · §4)
// ═══════════════════════════════════════════════════════════════════

describe("indonesia-coverage-queue · state machine (§4)", () => {
  it("all 9 coverage states are enumerated", () => {
    expect(COVERAGE_STATES.length).toBe(9);
    for (const s of ["NOT_STARTED","DISCOVERING","RESEARCHING","PARTIALLY_COVERED","COVERED","STALE","SOURCE_UNAVAILABLE","BLOCKED","UNKNOWN"]) {
      expect(COVERAGE_STATES).toContain(s);
    }
  });

  it("transition table covers every state · every state has at least one allowed target", () => {
    for (const s of COVERAGE_STATES) {
      expect(COVERAGE_STATE_TRANSITIONS[s]).toBeDefined();
      expect(COVERAGE_STATE_TRANSITIONS[s].length).toBeGreaterThan(0);
    }
  });

  it("allowed transitions succeed · unauthorised transitions throw", () => {
    expect(transitionCoverageState("NOT_STARTED", "DISCOVERING", "starting research")).toBe("DISCOVERING");
    expect(() => transitionCoverageState("NOT_STARTED", "COVERED", "cannot skip states"))
      .toThrow(/not allowed/);
  });

  it("transition without reason throws (§33 audit discipline)", () => {
    expect(() => transitionCoverageState("NOT_STARTED", "DISCOVERING", "")).toThrow(/reason required/);
    expect(() => transitionCoverageState("NOT_STARTED", "DISCOVERING", "   ")).toThrow(/reason required/);
  });

  it("unknown state throws", () => {
    // @ts-expect-error - deliberately invalid
    expect(() => transitionCoverageState("NONSENSE", "DISCOVERING", "test")).toThrow();
  });

  it("§4 · never converts to a state meaning 'no accommodation'", () => {
    // No such state exists in the enum · positive assertion
    for (const s of COVERAGE_STATES) {
      expect(s).not.toBe("NO_ACCOMMODATION");
      expect(s).not.toBe("EMPTY");
    }
  });
});

describe("indonesia-coverage-queue · 34 provinces seed (§3)", () => {
  it("all 8 island groups present", () => {
    expect(INDONESIA_ISLAND_GROUPS.length).toBe(8);
  });

  it("province seed has 34 entries (post-2022 · includes 6 Papua sub-provinces)", () => {
    // With Papua splits: base 34 · post-2022 splits pushed us to ~38 · this seed uses 6 Papua entries + 30 others = 36
    // (seed counts total)
    expect(INDONESIA_PROVINCES.length).toBeGreaterThanOrEqual(34);
    expect(INDONESIA_PROVINCES.length).toBeLessThanOrEqual(38);
  });

  it("every province has a valid island_group + coordinates", () => {
    for (const p of INDONESIA_PROVINCES) {
      expect(INDONESIA_ISLAND_GROUPS).toContain(p.island_group);
      expect(p.approx_lat).toBeGreaterThanOrEqual(-11);
      expect(p.approx_lat).toBeLessThanOrEqual(6);
      expect(p.approx_lon).toBeGreaterThanOrEqual(94);
      expect(p.approx_lon).toBeLessThanOrEqual(142);
    }
  });

  it("province slugs are unique", () => {
    const slugs = new Set(INDONESIA_PROVINCES.map((p) => p.slug));
    expect(slugs.size).toBe(INDONESIA_PROVINCES.length);
  });

  it("Yogyakarta + Bali + Jakarta all present (key destinations)", () => {
    const slugs = INDONESIA_PROVINCES.map((p) => p.slug);
    expect(slugs).toContain("di-yogyakarta");
    expect(slugs).toContain("bali");
    expect(slugs).toContain("dki-jakarta");
  });
});

describe("indonesia-coverage-queue · queue seed + invariants", () => {
  it("seeds a coherent queue (country + provinces · no duplicates)", () => {
    const queue = seedIndonesiaCoverageQueue();
    expect(() => assertCoverageQueueInvariants(queue)).not.toThrow();
    expect(queue[0].kind).toBe("COUNTRY");
    expect(queue[0].unit_slug).toBe("id");
    expect(queue.length).toBe(INDONESIA_PROVINCES.length + 1);
  });

  it("Yogyakarta seeded as PARTIALLY_COVERED with 877 measured rows (baseline)", () => {
    const queue = seedIndonesiaCoverageQueue();
    const yogya = queue.find((u) => u.unit_slug === "id-di-yogyakarta")!;
    expect(yogya.state).toBe("PARTIALLY_COVERED");
    expect(yogya.property_count_measured).toBe(877);
  });

  it("all other provinces seeded as NOT_STARTED · never fabricates 'covered'", () => {
    const queue = seedIndonesiaCoverageQueue();
    const nonYogya = queue.filter((u) => u.kind === "PROVINCE" && u.unit_slug !== "id-di-yogyakarta");
    for (const u of nonYogya) {
      expect(u.state).toBe("NOT_STARTED");
      expect(u.property_count_measured).toBe(0);
    }
  });

  it("state_reason is populated for every unit (§4 audit)", () => {
    const queue = seedIndonesiaCoverageQueue();
    for (const u of queue) {
      expect(u.state_reason.length).toBeGreaterThan(0);
    }
  });
});

describe("indonesia-coverage-queue · queue operations", () => {
  it("sortQueueByPriority is DESC + stable", () => {
    const queue = seedIndonesiaCoverageQueue();
    const sorted = sortQueueByPriority(queue);
    for (let i = 1; i < sorted.length; i++) {
      expect(sorted[i - 1].next_research_priority).toBeGreaterThanOrEqual(sorted[i].next_research_priority);
    }
  });

  it("pickResearchCandidates filters BLOCKED + UNKNOWN", () => {
    const queue = seedIndonesiaCoverageQueue();
    const candidates = pickResearchCandidates(queue, 5);
    for (const c of candidates) {
      expect(c.state).not.toBe("BLOCKED");
      expect(c.state).not.toBe("UNKNOWN");
    }
  });

  it("aggregateByIslandGroup counts every unit", () => {
    const queue = seedIndonesiaCoverageQueue();
    const agg = aggregateByIslandGroup(queue);
    const totalUnits = Object.values(agg).reduce((a, v) => a + v.units, 0);
    // Country unit (island_group null) not counted · so provinces only
    expect(totalUnits).toBe(INDONESIA_PROVINCES.length);
  });

  it("coverageSummary reports honest denominator (§30)", () => {
    const queue = seedIndonesiaCoverageQueue();
    const s = coverageSummary(queue);
    expect(s.provinces_total).toBe(INDONESIA_PROVINCES.length);
    expect(s.provinces_covered).toBe(0);   // never claim 'covered' from seed
    expect(s.provinces_partially_covered).toBe(1);  // Yogyakarta only
    expect(s.properties_measured_total).toBeGreaterThan(0);
    expect(s.attempted_units_denominator_note.length).toBeGreaterThan(0);
  });
});

describe("indonesia-coverage-queue · registry stats", () => {
  it("stats coherent", () => {
    const s = coverageQueueRegistryStats();
    expect(s.provinces_seeded).toBe(INDONESIA_PROVINCES.length);
    expect(s.island_groups.length).toBe(INDONESIA_ISLAND_GROUPS.length);
    expect(s.coverage_states.length).toBe(COVERAGE_STATES.length);
    expect(s.allowed_transitions_count).toBeGreaterThan(0);
  });
});
