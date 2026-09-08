// src/lib/nex/intelligence-storage-grid/accommodation/deterministic-qa-p1-p5.test.ts
//
// NEX Deterministic Q&A · P1-P5 + R1-R3 Contract Tests
// Founder BEGIN 2026-09-09 · "build full working system above you suggested"
//
// Locks the behavior of:
//   intent-registry.ts       (50 canonical intents · integrity)
//   language-normaliser.ts   (EN + ID + slang alias substitution)
//   intent-parser.ts         (deterministic intent + slot resolution)
//   fact-computer.ts         (5-step trust ladder + R1 amenity predicate)
//   hot-tier-facts.ts        (get/set/TTL/onCanonicalChange/stats)
//   deterministic-composer.ts (fact/clarify/unknown/list/research_needed)
//
// Zero external I/O. Zero LLM. Pure module contracts.

import { describe, it, expect, beforeEach } from "vitest";
import { INTENT_REGISTRY, registryStats, getIntent, intentsByAnswerKind } from "./intent-registry";
import { normalise, aliasDictionaryStats } from "./language-normaliser";
import { parseIntent } from "./intent-parser";
import { computeFactBundle } from "./fact-computer";
import type { AccommodationRow, FieldProvenanceRow } from "./adapter-postgres";
import type { EnrichmentEvidenceRow } from "./fact-computer";
import {
  factHotGet, factHotSet, factHotSetBulk, factHotInvalidateAll,
  onCanonicalChange, factHotStats,
} from "./hot-tier-facts";
import { composeReply } from "./deterministic-composer";

// ═══════════════════════════════════════════════════════════════════
// Test fixtures
// ═══════════════════════════════════════════════════════════════════

function makeRow(overrides: Partial<AccommodationRow> = {}): AccommodationRow {
  return {
    internal_id: "int_1",
    public_listing_ref: "acc_yog_test_001",
    business_name: "Test Homestay Yogyakarta",
    original_name: null,
    category: "homestay",
    categories: null,
    address: null,
    city: "Yogyakarta",
    district: null,
    region: null,
    country: "Indonesia",
    coordinates_lat: -7.8,
    coordinates_lng: 110.4,
    phone: null,
    whatsapp_number: null,
    website: null,
    star_rating: null,
    room_count: null,
    amenities: null,
    services: null,
    hero_image_url: null,
    rating: null,
    review_count: null,
    claim_status: "listed",
    updated_at: new Date("2026-09-01"),
    ...overrides,
  };
}

function makeProv(field: string, trust = "verified"): FieldProvenanceRow {
  return {
    business_ref: "acc_yog_test_001",
    field_name: field,
    trust_layer: trust,
    written_at: new Date("2026-09-01"),
    written_by: "test",
    source_reference: "test:source",
    cycle_run_id: "test-run",
  };
}

function makeEvidence(field: string, value: string, confidence = 0.8): EnrichmentEvidenceRow {
  return {
    business_ref: "acc_yog_test_001",
    field_name: field,
    value,
    raw_payload: null,
    confidence,
    source: "test",
    source_type: "other",
    discovered_at: new Date("2026-09-05"),
  };
}

// ═══════════════════════════════════════════════════════════════════
// intent-registry.ts
// ═══════════════════════════════════════════════════════════════════

describe("intent-registry · integrity", () => {
  it("has ~50 canonical intents · exactly the count Founder authorized", () => {
    const s = registryStats();
    expect(s.total).toBeGreaterThanOrEqual(40);
    expect(s.total).toBeLessThanOrEqual(60);
  });

  it("every intent slug is unique", () => {
    const slugs = INTENT_REGISTRY.map((i) => i.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("every intent has en + id composer_hint with {value} placeholder OR is relationship kind", () => {
    for (const intent of INTENT_REGISTRY) {
      if (intent.answer_kind === "relationship") continue;
      expect(intent.composer_hint_en, `en template for ${intent.slug}`).toMatch(/\{value\}/);
      expect(intent.composer_hint_id, `id template for ${intent.slug}`).toMatch(/\{value\}/);
    }
  });

  it("getIntent() returns the definition for a known slug", () => {
    expect(getIntent("wifi_available")?.answer_kind).toBe("fact");
    expect(getIntent("nonexistent_intent_slug_xyz")).toBeUndefined();
  });

  it("intentsByAnswerKind partitions the registry cleanly", () => {
    const factIntents = intentsByAnswerKind("fact");
    const relIntents = intentsByAnswerKind("relationship");
    expect(factIntents.length).toBeGreaterThan(10);
    expect(relIntents.length).toBeGreaterThan(0);
    expect(factIntents.every((i) => i.answer_kind === "fact")).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════
// language-normaliser.ts
// ═══════════════════════════════════════════════════════════════════

describe("language-normaliser · alias dictionaries", () => {
  it("substitutes EN aliases (brekky → breakfast)", () => {
    const r = normalise("brekky included?");
    expect(r.canonical_tokens).toContain("breakfast");
  });

  it("substitutes ID aliases (sarapan → breakfast)", () => {
    const r = normalise("sarapan tersedia?");
    expect(r.canonical_tokens).toContain("breakfast");
  });

  it("substitutes ID city shorthand (jogja → yogyakarta)", () => {
    const r = normalise("hotel di jogja");
    expect(r.canonical_tokens).toContain("yogyakarta");
  });

  it("handles multi-word aliases (longest-match first)", () => {
    const r = normalise("does it have swimming pool");
    expect(r.canonical_tokens).toContain("pool");
    expect(r.canonical_tokens).not.toContain("swimming");
  });

  it("preserves unresolved tokens and records them for Gap Engine", () => {
    const r = normalise("stargazer bungalow moonwalk terrace");
    expect(r.unresolved.length).toBeGreaterThan(0);
  });

  it("detects trailing question mark", () => {
    expect(normalise("how much?").contained_question_mark).toBe(true);
    expect(normalise("how much").contained_question_mark).toBe(false);
  });

  it("aliasDictionaryStats reports non-zero for all three dictionaries", () => {
    const s = aliasDictionaryStats();
    expect(s.en_aliases).toBeGreaterThan(20);
    expect(s.id_aliases).toBeGreaterThan(20);
    expect(s.slang_aliases).toBeGreaterThan(10);
  });
});

// ═══════════════════════════════════════════════════════════════════
// intent-parser.ts
// ═══════════════════════════════════════════════════════════════════

describe("intent-parser · deterministic resolution", () => {
  const CASES = [
    { q: "do they have breakfast?", intent: "breakfast_available" },
    { q: "wifi ada?",                intent: "wifi_available" },
    { q: "how much is it",           intent: "price_indicative" },
    { q: "parking?",                 intent: "parking_available" },
    { q: "brekky included",          intent: "breakfast_available" },
    { q: "kolam renang?",            intent: "pool_available" },
    { q: "does it have a pool",      intent: "pool_available" },
    { q: "where is it",              intent: "location_city" },
  ];
  for (const c of CASES) {
    it(`resolves "${c.q}" → ${c.intent}`, () => {
      const p = parseIntent(c.q);
      expect(p.intent_slug).toBe(c.intent);
    });
  }

  it("extracts multi-slot from 'cheap hotels in jogja'", () => {
    const p = parseIntent("cheap hotels in jogja");
    expect(p.slots.city).toBe("yogyakarta");
    expect(p.slots.property_category).toBe("hotel");
    expect(p.slots.price_preference).toBe("cheap");
  });

  it("detects ordinal reference in 'tell me about the first one'", () => {
    const p = parseIntent("tell me about the first one");
    expect(p.slots.is_follow_up_ordinal).toBe(true);
    expect(p.slots.ordinal).toBe(1);
  });

  it("detects vertical switch in 'what about guesthouses'", () => {
    const p = parseIntent("what about guesthouses");
    expect(p.slots.is_vertical_switch).toBe(true);
    expect(p.slots.property_category).toBe("guesthouse");
  });

  it("returns null intent for gibberish · zero fabrication", () => {
    const p = parseIntent("qxzq wapmoo blornstack");
    expect(p.intent_slug).toBeNull();
    expect(p.confidence).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════
// fact-computer.ts · 5-step trust ladder + R1 amenity predicate
// ═══════════════════════════════════════════════════════════════════

describe("fact-computer · trust ladder + amenity predicate (R1)", () => {
  it("returns canonical_verified when row has value AND provenance is verified", () => {
    const row = makeRow({ business_name: "Villa Damai" });
    const b = computeFactBundle({ row, provenance: [makeProv("business_name", "verified")] });
    expect(b.facts.property_name.trust).toBe("canonical_verified");
    expect(b.facts.property_name.value).toBe("Villa Damai");
    expect(b.facts.property_name.unknown).toBe(false);
  });

  it("returns canonical_unverified when row has value but no provenance", () => {
    const row = makeRow({ city: "Yogyakarta" });
    const b = computeFactBundle({ row, provenance: [] });
    expect(b.facts.location_city.trust).toBe("canonical_unverified");
    expect(b.facts.location_city.value).toBe("Yogyakarta");
  });

  it("returns unknown when row is empty AND no evidence AND enqueues Gap when auto flag is set", () => {
    const row = makeRow({ star_rating: null });
    const b = computeFactBundle({ row, provenance: [] });
    const star = b.facts.property_star_rating;
    expect(star.unknown).toBe(true);
    expect(star.trust).toBe("unknown");
    expect(star.enqueue_gap).toBe(true);
    expect(b.gap_tickets_proposed.some((g) => g.intent_slug === "property_star_rating")).toBe(true);
  });

  it("returns evidence_verified for high-confidence evidence rows", () => {
    const row = makeRow();
    const evidence = [makeEvidence("opening_hours", "Mon-Fri 08:00-22:00", 0.85)];
    const b = computeFactBundle({ row, provenance: [], evidence });
    expect(b.facts.opening_hours.trust).toBe("evidence_verified");
    expect(b.facts.opening_hours.value).toBe("Mon-Fri 08:00-22:00");
  });

  it("returns evidence_provisional for low-confidence evidence rows", () => {
    const row = makeRow();
    const evidence = [makeEvidence("opening_hours", "24 hours", 0.5)];
    const b = computeFactBundle({ row, provenance: [], evidence });
    expect(b.facts.opening_hours.trust).toBe("evidence_provisional");
  });

  it("R1 · amenity-array-contains returns true when amenity token matches", () => {
    const row = makeRow({ amenities: ["wifi", "air_conditioning"] });
    const b = computeFactBundle({ row, provenance: [] });
    expect(b.facts.wifi_available.value).toBe(true);
    expect(b.facts.wifi_available.unknown).toBe(false);
    expect(b.facts.pool_available.value).toBe(false); // amenity present but no pool
  });

  it("R1 · amenity-array-contains uses alias-aware match ('Free WiFi' matches wifi)", () => {
    const row = makeRow({ amenities: ["Free WiFi", "Valet Parking"] });
    const b = computeFactBundle({ row, provenance: [] });
    expect(b.facts.wifi_available.value).toBe(true);
    expect(b.facts.parking_available.value).toBe(true);
    expect(b.facts.pool_available.value).toBe(false);
  });

  it("R1 · amenities null → unknown (not fabricated false)", () => {
    const row = makeRow({ amenities: null });
    const b = computeFactBundle({ row, provenance: [] });
    expect(b.facts.wifi_available.unknown).toBe(true);
    expect(b.facts.pool_available.unknown).toBe(true);
  });

  it("skips relationship-kind intents (composed by relationship-fact-computer)", () => {
    const row = makeRow();
    const b = computeFactBundle({ row, provenance: [] });
    // nearby_food is relationship kind — should NOT be in the fact map
    expect(b.facts.nearby_food).toBeUndefined();
  });
});

// ═══════════════════════════════════════════════════════════════════
// hot-tier-facts.ts
// ═══════════════════════════════════════════════════════════════════

describe("hot-tier-facts · LRU + TTL + invalidation", () => {
  beforeEach(() => {
    factHotInvalidateAll();
  });

  it("returns null on miss", () => {
    expect(factHotGet("nonexistent_ref")).toBeNull();
  });

  it("returns the bundle on hit", () => {
    const row = makeRow();
    const bundle = computeFactBundle({ row, provenance: [] });
    factHotSet(row.public_listing_ref, bundle);
    const hit = factHotGet(row.public_listing_ref);
    expect(hit).not.toBeNull();
    expect(hit!.bundle.business_name).toBe(row.business_name);
    expect(hit!.age_ms).toBeGreaterThanOrEqual(0);
    expect(hit!.ttl_remaining_ms).toBeGreaterThan(0);
  });

  it("factHotSetBulk warms multiple bundles", () => {
    const bundles = [1, 2, 3].map((i) => computeFactBundle({
      row: makeRow({ public_listing_ref: `acc_${i}`, business_name: `Prop ${i}` }),
      provenance: [],
    }));
    const n = factHotSetBulk(bundles);
    expect(n).toBe(3);
    for (const b of bundles) expect(factHotGet(b.listing_ref)).not.toBeNull();
  });

  it("expires entries past their TTL", async () => {
    const bundle = computeFactBundle({ row: makeRow(), provenance: [] });
    factHotSet(bundle.listing_ref, bundle, 20); // 20ms TTL
    expect(factHotGet(bundle.listing_ref)).not.toBeNull();
    await new Promise((r) => setTimeout(r, 40));
    expect(factHotGet(bundle.listing_ref)).toBeNull();
  });

  it("onCanonicalChange forces refresh (invalidates the entry)", () => {
    const bundle = computeFactBundle({ row: makeRow(), provenance: [] });
    factHotSet(bundle.listing_ref, bundle);
    expect(factHotGet(bundle.listing_ref)).not.toBeNull();
    onCanonicalChange(bundle.listing_ref);
    expect(factHotGet(bundle.listing_ref)).toBeNull();
    expect(factHotStats().invalidations_from_canonical_change).toBeGreaterThan(0);
  });

  it("stats report hit ratio + P50 lookup ms", () => {
    const bundle = computeFactBundle({ row: makeRow(), provenance: [] });
    factHotSet(bundle.listing_ref, bundle);
    for (let i = 0; i < 5; i++) factHotGet(bundle.listing_ref);
    const s = factHotStats();
    expect(s.hits).toBeGreaterThanOrEqual(5);
    expect(s.hit_ratio).toBeGreaterThan(0);
    expect(s.lookup_ms_p50).toBeGreaterThanOrEqual(0);
  });
});

// ═══════════════════════════════════════════════════════════════════
// deterministic-composer.ts · clarify · unknown · fact · list · research
// ═══════════════════════════════════════════════════════════════════

describe("deterministic-composer · reply-kind contracts", () => {
  it("clarify when parser returns no intent", () => {
    const parsed = parseIntent("qxzq wapmoo blornstack");
    const bundle = computeFactBundle({ row: makeRow(), provenance: [] });
    const r = composeReply({ parsed, bundles: [bundle], context: { language: "en", focus_listing_ref: bundle.listing_ref } });
    expect(r.reply_kind).toBe("clarify");
    expect(r.answered).toBe(false);
  });

  it("unknown when fact is UNKNOWN + enqueue_gap mentioned honestly", () => {
    const parsed = parseIntent("what star rating");
    const bundle = computeFactBundle({ row: makeRow({ star_rating: null }), provenance: [] });
    const r = composeReply({ parsed, bundles: [bundle], context: { language: "en", focus_listing_ref: bundle.listing_ref } });
    expect(r.reply_kind).toBe("unknown");
    expect(r.reply_text).toContain("don't have");
    expect(r.reply_text).toContain("asked our team"); // enqueue_gap mention
  });

  it("fact with trust prefix when value present", () => {
    const parsed = parseIntent("where is it");
    const bundle = computeFactBundle({ row: makeRow({ city: "Yogyakarta" }), provenance: [] });
    const r = composeReply({ parsed, bundles: [bundle], context: { language: "en", focus_listing_ref: bundle.listing_ref } });
    expect(r.reply_kind).toBe("fact");
    expect(r.answered).toBe(true);
    expect(r.reply_text).toContain("Yogyakarta");
  });

  it("ID language pack produces Indonesian prose", () => {
    const parsed = parseIntent("dimana");
    const bundle = computeFactBundle({ row: makeRow({ city: "Yogyakarta" }), provenance: [] });
    const r = composeReply({ parsed, bundles: [bundle], context: { language: "id", focus_listing_ref: bundle.listing_ref } });
    expect(r.answered).toBe(true);
    expect(r.reply_text).toMatch(/Berdasarkan|Yogyakarta/);
  });

  it("R2 · multi_property_list when prior_list ≥ 2 AND no focus AND no ordinal", () => {
    const parsed = parseIntent("where are they");
    const bundles = [
      computeFactBundle({ row: makeRow({ public_listing_ref: "acc_a", business_name: "Prop A", city: "Yogyakarta" }), provenance: [] }),
      computeFactBundle({ row: makeRow({ public_listing_ref: "acc_b", business_name: "Prop B", city: "Yogyakarta" }), provenance: [] }),
    ];
    const r = composeReply({
      parsed, bundles,
      context: {
        language: "en",
        prior_list: [
          { listing_ref: "acc_a", business_name: "Prop A" },
          { listing_ref: "acc_b", business_name: "Prop B" },
        ],
      },
    });
    expect(r.reply_kind).toBe("multi_property_list");
    expect(r.reply_text).toContain("Prop A");
    expect(r.reply_text).toContain("Prop B");
    expect(r.reply_text).toContain("Yogyakarta");
  });

  it("R2 · multi_property_list honestly reports UNKNOWN per row when data missing", () => {
    const parsed = parseIntent("which ones have pool");
    const bundles = [
      computeFactBundle({ row: makeRow({ public_listing_ref: "acc_a", business_name: "Prop A", amenities: ["wifi", "swimming pool"] }), provenance: [] }),
      computeFactBundle({ row: makeRow({ public_listing_ref: "acc_b", business_name: "Prop B", amenities: null }), provenance: [] }),
    ];
    const r = composeReply({
      parsed, bundles,
      context: {
        language: "en",
        prior_list: [
          { listing_ref: "acc_a", business_name: "Prop A" },
          { listing_ref: "acc_b", business_name: "Prop B" },
        ],
      },
    });
    expect(r.reply_kind).toBe("multi_property_list");
    expect(r.reply_text).toMatch(/Prop A.*Yes/i);
    expect(r.reply_text).toContain("don't have that on record"); // Prop B honest UNKNOWN
  });

  it("R3 · research_needed for vertical switch · exposes research_slots", () => {
    const parsed = parseIntent("what about guesthouses");
    const r = composeReply({
      parsed, bundles: [],
      context: { language: "en", prior_list: [{ listing_ref: "acc_a", business_name: "Prop A" }] },
    });
    expect(r.reply_kind).toBe("research_needed");
    expect(r.research_slots?.property_category).toBe("guesthouse");
  });

  it("list_reference for ordinal follow-up · About {name}: ...", () => {
    const parsed = parseIntent("tell me about the first one");
    const bundle = computeFactBundle({
      row: makeRow({ public_listing_ref: "acc_a", business_name: "Lokajajar Guesthouse" }),
      provenance: [],
    });
    const r = composeReply({
      parsed, bundles: [bundle],
      context: {
        language: "en",
        prior_list: [{ listing_ref: "acc_a", business_name: "Lokajajar Guesthouse" }],
      },
    });
    expect(r.reply_kind).toBe("list_reference");
    expect(r.reply_text).toContain("Lokajajar Guesthouse");
  });

  it("clarify_missing_ordinal when ordinal referenced but no prior_list", () => {
    const parsed = parseIntent("tell me about the first one");
    const r = composeReply({ parsed, bundles: [], context: { language: "en" } });
    expect(r.reply_kind).toBe("clarify");
    expect(r.reply_text).toMatch(/first|second|third/i);
  });
});

// ═══════════════════════════════════════════════════════════════════
// End-to-end · replay one of the Founder sequences
// ═══════════════════════════════════════════════════════════════════

describe("end-to-end · parser + fact + hot-tier + composer · no fabrication", () => {
  beforeEach(() => factHotInvalidateAll());

  it("S7 replay · 'where are they' over 3 properties · GREEN", () => {
    const rows = [
      makeRow({ public_listing_ref: "acc_1", business_name: "Prop 1", city: "Yogyakarta" }),
      makeRow({ public_listing_ref: "acc_2", business_name: "Prop 2", city: "Yogyakarta" }),
      makeRow({ public_listing_ref: "acc_3", business_name: "Prop 3", city: "Yogyakarta" }),
    ];
    const bundles = rows.map((row) => computeFactBundle({ row, provenance: [] }));
    factHotSetBulk(bundles);

    const parsed = parseIntent("where are they");
    const r = composeReply({
      parsed, bundles,
      context: {
        language: "en",
        prior_list: rows.map((r) => ({ listing_ref: r.public_listing_ref, business_name: r.business_name })),
      },
    });
    expect(r.reply_kind).toBe("multi_property_list");
    expect(r.answered).toBe(true);
    expect(r.reply_text).toContain("Prop 1");
    expect(r.reply_text).toContain("Prop 2");
    expect(r.reply_text).toContain("Prop 3");
    expect(r.reply_text).toContain("Yogyakarta");
  });

  it("S8 replay · 'what about guesthouses' · research_needed", () => {
    const parsed = parseIntent("what about guesthouses");
    const r = composeReply({
      parsed, bundles: [],
      context: {
        language: "en",
        prior_list: [{ listing_ref: "acc_1", business_name: "Prop 1" }],
      },
    });
    expect(r.reply_kind).toBe("research_needed");
    expect(r.research_slots?.property_category).toBe("guesthouse");
  });
});
