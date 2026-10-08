// scripts/nex-canonical/canonical-resolver.test.ts
//
// Pure unit tests for the Layer-B canonical resolver.
// No DB. No network. No pg Client. No clock. No randomness.

import { describe, expect, test } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import type { Candidate } from "./generate-candidates";
import type { CanonicalResolverInput } from "./canonical-row";
import type { ResolverVerdict } from "./canonical-handoff";
import {
  AMBIGUOUS_THRESHOLD,
  LAYER_B_WEIGHTS,
  MATCH_SEPARATION_MIN,
  MATCH_THRESHOLD,
  resolveCanonical,
  scorePair,
} from "./canonical-resolver";
import { isAbstained, isAnswered } from "./intelligence-result";

// ═════════════════════════════════════════════════════════════════════
// §0 · Fixtures
// ═════════════════════════════════════════════════════════════════════

function cand(overrides: Partial<Candidate> & { candidate_id: string }): Candidate {
  const base: Candidate = {
    candidate_id: overrides.candidate_id,
    status: "pending_founder_review",
    entity_type: "food",
    country: "ID",
    identity: {
      name_canonical: "Warung Bu Siti",
      aliases: [],
      phone_e164: null,
      website_apex: null,
      osm_id: null,
      wikidata_qid: null,
      city: null,
      district: null,
      coordinates: null,
    },
    legacy_source: {
      table: "nex.food_business",
      ref: `ref-${overrides.candidate_id}`,
      internal_id: null,
    },
    risk_categories: ["R1"],
    selection_score: 0.5,
    selection_rationale: [{ risk_category: "R1", contribution: 0.5, note: "n" }],
    generation_source: {
      generator: "scripts/nex-canonical/generate-candidates.ts",
      generated_at: "2026-10-08T12:00:00.000Z",
      generation_run_id: "test-run",
    },
    caveats: [],
  };
  return { ...base, ...overrides } as Candidate;
}

function row(
  id: string,
  overrides: Partial<CanonicalResolverInput> = {},
): CanonicalResolverInput {
  return {
    canonical_business_id: id,
    entity_type: "food",
    country: "ID",
    name_canonical: "Warung Bu Siti",
    name_norm: "warung bu siti",
    aliases: [],
    phone_e164: null,
    website_apex: null,
    osm_id: null,
    wikidata_qid: null,
    city: null,
    coordinates: null,
    ...overrides,
  };
}

// ═════════════════════════════════════════════════════════════════════
// §1 · Threshold constants
// ═════════════════════════════════════════════════════════════════════

describe("thresholds", () => {
  test("MATCH_THRESHOLD = 0.85 · AMBIGUOUS_THRESHOLD = 0.55", () => {
    expect(MATCH_THRESHOLD).toBe(0.85);
    expect(AMBIGUOUS_THRESHOLD).toBe(0.55);
  });

  test("MATCH_SEPARATION_MIN is a positive gap between top and runner-up", () => {
    expect(MATCH_SEPARATION_MIN).toBeGreaterThan(0);
    expect(MATCH_SEPARATION_MIN).toBeLessThan(1);
  });

  test("LAYER_B_WEIGHTS is frozen", () => {
    expect(Object.isFrozen(LAYER_B_WEIGHTS)).toBe(true);
  });
});

// ═════════════════════════════════════════════════════════════════════
// §2 · scorePair · strong external identifiers
// ═════════════════════════════════════════════════════════════════════

describe("scorePair · OSM id", () => {
  test("exact OSM agreement sets the strong-id floor", () => {
    const c = cand({ candidate_id: "a", identity: { ...candIdentity(), osm_id: "node/42" } });
    const r = row("T", { osm_id: "node/42" });
    const p = scorePair(c, r);
    expect(p.score).toBeGreaterThanOrEqual(LAYER_B_WEIGHTS.STRONG_ID_AGREEMENT_FLOOR);
    expect(p.breakdown.some((b) => b.key === "osm_id_exact")).toBe(true);
  });

  test("OSM contradiction caps the score below MATCH", () => {
    const c = cand({ candidate_id: "a", identity: { ...candIdentity(), osm_id: "node/42" } });
    const r = row("T", { osm_id: "node/99" });
    const p = scorePair(c, r);
    expect(p.score).toBeLessThanOrEqual(LAYER_B_WEIGHTS.STRONG_ID_CONTRADICTION_CAP);
    expect(p.score).toBeLessThan(MATCH_THRESHOLD);
    expect(p.breakdown.some((b) => b.key === "osm_id_contradiction")).toBe(true);
  });

  test("weak name similarity cannot override OSM contradiction", () => {
    const c = cand({
      candidate_id: "a",
      identity: {
        ...candIdentity(),
        osm_id: "node/42",
        name_canonical: "Warung Bu Siti",
        phone_e164: "+6281234567890",
        website_apex: "warungsiti.id",
      },
    });
    const r = row("T", {
      osm_id: "node/99",
      name_canonical: "Warung Bu Siti",
      name_norm: "warung bu siti",
      phone_e164: "+6281234567890",
      website_apex: "warungsiti.id",
    });
    const p = scorePair(c, r);
    expect(p.score).toBeLessThanOrEqual(LAYER_B_WEIGHTS.STRONG_ID_CONTRADICTION_CAP);
    expect(p.score).toBeLessThan(MATCH_THRESHOLD);
  });
});

describe("scorePair · Wikidata QID", () => {
  test("exact Wikidata agreement sets the strong-id floor", () => {
    const c = cand({ candidate_id: "a", identity: { ...candIdentity(), wikidata_qid: "Q42" } });
    const r = row("T", { wikidata_qid: "Q42" });
    const p = scorePair(c, r);
    expect(p.score).toBeGreaterThanOrEqual(LAYER_B_WEIGHTS.STRONG_ID_AGREEMENT_FLOOR);
  });

  test("Wikidata contradiction caps the score below MATCH", () => {
    const c = cand({ candidate_id: "a", identity: { ...candIdentity(), wikidata_qid: "Q1" } });
    const r = row("T", { wikidata_qid: "Q99" });
    const p = scorePair(c, r);
    expect(p.score).toBeLessThan(MATCH_THRESHOLD);
    expect(p.breakdown.some((b) => b.key === "wikidata_qid_contradiction")).toBe(true);
  });
});

// ═════════════════════════════════════════════════════════════════════
// §3 · scorePair · contact identifiers
// ═════════════════════════════════════════════════════════════════════

describe("scorePair · phone + website", () => {
  test("phone exact + website exact + name exact → MATCH-range score", () => {
    const c = cand({
      candidate_id: "a",
      identity: {
        ...candIdentity(),
        phone_e164: "+6281234567890",
        website_apex: "warungsiti.id",
      },
    });
    const r = row("T", {
      phone_e164: "+6281234567890",
      website_apex: "warungsiti.id",
    });
    const p = scorePair(c, r);
    const expected =
      LAYER_B_WEIGHTS.PHONE_EXACT +
      LAYER_B_WEIGHTS.WEBSITE_EXACT +
      LAYER_B_WEIGHTS.NAME_EXACT;
    expect(p.score).toBeCloseTo(Math.min(1, expected), 5);
    expect(p.score).toBeGreaterThanOrEqual(MATCH_THRESHOLD);
  });

  test("phone exact alone (no name match) is NOT enough for MATCH", () => {
    const c = cand({
      candidate_id: "a",
      identity: {
        ...candIdentity(),
        name_canonical: "Different Name Xyz",
        phone_e164: "+6281234567890",
      },
    });
    const r = row("T", {
      name_canonical: "Warung Bu Siti",
      name_norm: "warung bu siti",
      phone_e164: "+6281234567890",
    });
    const p = scorePair(c, r);
    expect(p.score).toBeLessThan(MATCH_THRESHOLD);
    expect(p.score).toBeGreaterThanOrEqual(LAYER_B_WEIGHTS.PHONE_EXACT - 0.001);
  });
});

// ═════════════════════════════════════════════════════════════════════
// §4 · scorePair · name signals
// ═════════════════════════════════════════════════════════════════════

describe("scorePair · name signals", () => {
  test("exact normalized-name match adds NAME_EXACT", () => {
    const c = cand({ candidate_id: "a" });
    const r = row("T");
    const p = scorePair(c, r);
    expect(p.breakdown.some((b) => b.key === "name_norm_exact")).toBe(true);
  });

  test("token-jaccard contributes when names overlap but are not equal", () => {
    const c = cand({
      candidate_id: "a",
      identity: { ...candIdentity(), name_canonical: "Warung Siti Bandung" },
    });
    const r = row("T", {
      name_canonical: "Warung Bu Siti",
      name_norm: "warung bu siti",
    });
    const p = scorePair(c, r);
    const nameEntry = p.breakdown.find(
      (b) => b.key === "name_jaccard" || b.key === "name_norm_exact",
    );
    expect(nameEntry).toBeDefined();
  });

  test("alias overlap one-shot bonus · candidate alias matches canonical name", () => {
    const c = cand({
      candidate_id: "a",
      identity: {
        ...candIdentity(),
        name_canonical: "Totally Different Name",
        aliases: ["Warung Bu Siti"],
      },
    });
    const r = row("T");
    const p = scorePair(c, r);
    expect(p.breakdown.some((b) => b.key === "alias_overlap")).toBe(true);
  });

  test("alias bonus is one-shot even with many matching aliases", () => {
    const c = cand({
      candidate_id: "a",
      identity: {
        ...candIdentity(),
        name_canonical: "Totally Different Name",
        aliases: ["Warung Bu Siti", "warung bu siti", "WARUNG BU SITI"],
      },
    });
    const r = row("T");
    const p = scorePair(c, r);
    const aliasEntries = p.breakdown.filter((b) => b.key === "alias_overlap");
    expect(aliasEntries.length).toBe(1);
  });
});

// ═════════════════════════════════════════════════════════════════════
// §5 · scorePair · geographic signals
// ═════════════════════════════════════════════════════════════════════

describe("scorePair · city + coordinates", () => {
  test("city exact match adds CITY_EXACT when both sides non-null", () => {
    const c = cand({
      candidate_id: "a",
      identity: { ...candIdentity(), city: "Bandung" },
    });
    const r = row("T", { city: "Bandung" });
    const p = scorePair(c, r);
    expect(p.breakdown.some((b) => b.key === "city_exact")).toBe(true);
  });

  test("coordinates within 50m adds COORD_WITHIN_50M", () => {
    const c = cand({
      candidate_id: "a",
      identity: { ...candIdentity(), coordinates: { lat: -6.9, lng: 107.6 } },
    });
    // Approximately 10 metres NE
    const r = row("T", { coordinates: { lat: -6.9 + 0.00005, lng: 107.6 + 0.00005 } });
    const p = scorePair(c, r);
    expect(p.breakdown.some((b) => b.key === "coord_within_50m")).toBe(true);
  });

  test("coordinates within 200m but outside 50m adds COORD_WITHIN_200M", () => {
    const c = cand({
      candidate_id: "a",
      identity: { ...candIdentity(), coordinates: { lat: 0, lng: 0 } },
    });
    const r = row("T", { coordinates: { lat: 0.001, lng: 0 } }); // ~111m
    const p = scorePair(c, r);
    expect(p.breakdown.some((b) => b.key === "coord_within_200m")).toBe(true);
    expect(p.breakdown.some((b) => b.key === "coord_within_50m")).toBe(false);
  });

  test("coordinates > 1km → no proximity bonus", () => {
    const c = cand({
      candidate_id: "a",
      identity: { ...candIdentity(), coordinates: { lat: 0, lng: 0 } },
    });
    const r = row("T", { coordinates: { lat: 0.1, lng: 0.1 } });
    const p = scorePair(c, r);
    expect(p.breakdown.some((b) => b.key.startsWith("coord_within"))).toBe(false);
  });

  test("proximity alone (no name/phone/website) is NOT enough for MATCH", () => {
    const c = cand({
      candidate_id: "a",
      identity: {
        ...candIdentity(),
        name_canonical: "Totally Different",
        coordinates: { lat: -6.9, lng: 107.6 },
      },
    });
    const r = row("T", {
      name_canonical: "Warung Bu Siti",
      name_norm: "warung bu siti",
      coordinates: { lat: -6.9, lng: 107.6 },
    });
    const p = scorePair(c, r);
    expect(p.score).toBeLessThan(MATCH_THRESHOLD);
  });
});

// ═════════════════════════════════════════════════════════════════════
// §6 · scorePair · country + entity-type vetoes
// ═════════════════════════════════════════════════════════════════════

describe("scorePair · country veto", () => {
  test("different countries → score = 0, hard veto", () => {
    const c = cand({ candidate_id: "a", country: "ID" });
    const r = row("T", { country: "MY" });
    const p = scorePair(c, r);
    expect(p.score).toBe(0);
    expect(p.breakdown.some((b) => b.key === "country_mismatch_veto")).toBe(true);
  });

  test("country veto fires even with everything else matching", () => {
    const c = cand({
      candidate_id: "a",
      country: "ID",
      identity: {
        ...candIdentity(),
        osm_id: "node/42",
        phone_e164: "+6281234567890",
      },
    });
    const r = row("T", {
      country: "SG",
      osm_id: "node/42",
      phone_e164: "+6281234567890",
    });
    const p = scorePair(c, r);
    expect(p.score).toBe(0);
  });
});

describe("scorePair · entity_type mismatch cap", () => {
  test("entity_type mismatch caps the score at ENTITY_TYPE_MISMATCH_CAP", () => {
    const c = cand({
      candidate_id: "a",
      entity_type: "food",
      identity: {
        ...candIdentity(),
        name_canonical: "Hotel X",
        phone_e164: "+6281234567890",
      },
    });
    const r = row("T", {
      entity_type: "accommodation",
      name_canonical: "Hotel X",
      name_norm: "hotel x",
      phone_e164: "+6281234567890",
    });
    const p = scorePair(c, r);
    expect(p.score).toBeLessThanOrEqual(LAYER_B_WEIGHTS.ENTITY_TYPE_MISMATCH_CAP);
  });
});

// ═════════════════════════════════════════════════════════════════════
// §7 · resolveCanonical · verdict routing
// ═════════════════════════════════════════════════════════════════════

describe("resolveCanonical · MATCH verdict", () => {
  test("exact OSM id match with clean pool → MATCH", () => {
    const c = cand({
      candidate_id: "a",
      identity: { ...candIdentity(), osm_id: "node/42" },
    });
    const pool = [
      row("T1", { osm_id: "node/42" }),
      row("T2", { osm_id: "node/99", name_canonical: "Other", name_norm: "other" }),
    ];
    const r = resolveCanonical({ candidate: c, pool });
    expect(isAnswered(r)).toBe(true);
    if (isAnswered(r)) {
      expect(r.value.kind).toBe("MATCH");
      if (r.value.kind === "MATCH") {
        expect(r.value.target_canonical_business_id).toBe("T1");
        expect(r.value.score).toBeGreaterThanOrEqual(MATCH_THRESHOLD);
        expect(r.value.score_breakdown.length).toBeGreaterThan(0);
      }
    }
  });

  test("MATCH never produced when runner-up is within MATCH_SEPARATION_MIN", () => {
    // Both rows have identical signals → scores are equal → separation = 0
    const c = cand({
      candidate_id: "a",
      identity: {
        ...candIdentity(),
        phone_e164: "+6281234567890",
      },
    });
    const pool = [
      row("T1", { phone_e164: "+6281234567890" }),
      row("T2", { phone_e164: "+6281234567890" }),
    ];
    const r = resolveCanonical({ candidate: c, pool });
    expect(isAnswered(r)).toBe(true);
    if (isAnswered(r)) {
      expect(r.value.kind).toBe("AMBIGUOUS");
    }
  });
});

describe("resolveCanonical · AMBIGUOUS verdict", () => {
  test("top score in [AMBIGUOUS, MATCH) → AMBIGUOUS", () => {
    const c = cand({
      candidate_id: "a",
      identity: {
        ...candIdentity(),
        phone_e164: "+6281234567890",
      },
    });
    // phone + name = 0.45 + 0.35 = 0.80 · in the ambiguous band
    const pool = [row("T1", { phone_e164: "+6281234567890" })];
    const r = resolveCanonical({ candidate: c, pool });
    if (isAnswered(r)) {
      expect(r.value.kind).toBe("AMBIGUOUS");
      if (r.value.kind === "AMBIGUOUS") {
        expect(r.value.competing.length).toBeGreaterThanOrEqual(1);
        expect(r.value.best_score).toBeGreaterThanOrEqual(AMBIGUOUS_THRESHOLD);
        expect(r.value.best_score).toBeLessThan(MATCH_THRESHOLD);
      }
    }
  });

  test("two close high scores → AMBIGUOUS with multiple competing", () => {
    const c = cand({
      candidate_id: "a",
      identity: {
        ...candIdentity(),
        osm_id: "node/42",
      },
    });
    const pool = [
      row("T1", { osm_id: "node/42" }),
      row("T2", { osm_id: "node/42", canonical_business_id: "T2" }), // dup OSM in canonical (bug but defensive)
    ];
    const r = resolveCanonical({ candidate: c, pool });
    if (isAnswered(r) && r.value.kind === "AMBIGUOUS") {
      expect(r.value.competing.length).toBeGreaterThanOrEqual(2);
    }
  });
});

describe("resolveCanonical · NO_MATCH verdict", () => {
  test("pool evaluated with sufficient signal but no row reaches AMBIGUOUS_THRESHOLD → NO_MATCH", () => {
    const c = cand({
      candidate_id: "a",
      identity: {
        ...candIdentity(),
        phone_e164: "+6281234567890", // strong signal → eligible for resolution
        name_canonical: "Totally Unique Name A1B2C3",
      },
    });
    const pool = [
      row("T1", {
        name_canonical: "A Completely Different Business",
        name_norm: "a completely different business",
      }),
    ];
    const r = resolveCanonical({ candidate: c, pool });
    expect(isAnswered(r)).toBe(true);
    if (isAnswered(r)) {
      expect(r.value.kind).toBe("NO_MATCH");
      if (r.value.kind === "NO_MATCH") {
        expect(r.value.best_score).toBeLessThan(AMBIGUOUS_THRESHOLD);
      }
    }
  });

  test("country mismatch across pool → NO_MATCH (all scores = 0)", () => {
    const c = cand({
      candidate_id: "a",
      country: "ID",
      identity: { ...candIdentity(), osm_id: "node/42" },
    });
    const pool = [
      row("T1", { country: "MY", osm_id: "node/42" }),
      row("T2", { country: "SG", osm_id: "node/42" }),
    ];
    const r = resolveCanonical({ candidate: c, pool });
    if (isAnswered(r)) {
      expect(r.value.kind).toBe("NO_MATCH");
    }
  });
});

// ═════════════════════════════════════════════════════════════════════
// §8 · resolveCanonical · ABSTAINED paths
// ═════════════════════════════════════════════════════════════════════

describe("resolveCanonical · ABSTAINED paths (never NO_MATCH in disguise)", () => {
  test("empty pool → abstained(empty_pool)", () => {
    const c = cand({
      candidate_id: "a",
      identity: { ...candIdentity(), osm_id: "node/42" },
    });
    const r = resolveCanonical({ candidate: c, pool: [] });
    expect(isAbstained(r)).toBe(true);
    if (isAbstained(r)) {
      expect(r.reason.code).toBe("empty_pool");
    }
  });

  test("insufficient signal (name only · no strong/medium signal) → abstained(insufficient_signal)", () => {
    const c = cand({ candidate_id: "a" }); // name only, all optionals null
    const pool = [row("T")];
    const r = resolveCanonical({ candidate: c, pool });
    expect(isAbstained(r)).toBe(true);
    if (isAbstained(r)) {
      expect(r.reason.code).toBe("insufficient_signal");
    }
  });

  test("name + city alone is insufficient (city is weak signal)", () => {
    const c = cand({
      candidate_id: "a",
      identity: { ...candIdentity(), city: "Bandung" },
    });
    const r = resolveCanonical({ candidate: c, pool: [row("T", { city: "Bandung" })] });
    expect(isAbstained(r)).toBe(true);
  });

  test("name + aliases alone is insufficient", () => {
    const c = cand({
      candidate_id: "a",
      identity: { ...candIdentity(), aliases: ["X", "Y"] },
    });
    const r = resolveCanonical({ candidate: c, pool: [row("T")] });
    expect(isAbstained(r)).toBe(true);
  });

  test("name + coordinates IS sufficient (coordinates are a medium signal)", () => {
    const c = cand({
      candidate_id: "a",
      identity: { ...candIdentity(), coordinates: { lat: 0, lng: 0 } },
    });
    const r = resolveCanonical({ candidate: c, pool: [row("T")] });
    expect(isAnswered(r)).toBe(true);
  });

  test("blank name → abstained(malformed_input)", () => {
    const c = cand({
      candidate_id: "a",
      identity: { ...candIdentity(), name_canonical: "   " },
    });
    const r = resolveCanonical({ candidate: c, pool: [row("T")] });
    expect(isAbstained(r)).toBe(true);
    if (isAbstained(r)) {
      expect(r.reason.code).toBe("malformed_input");
    }
  });
});

// ═════════════════════════════════════════════════════════════════════
// §9 · Determinism + immutability
// ═════════════════════════════════════════════════════════════════════

describe("determinism + immutability", () => {
  test("same inputs → same verdict + same score + same breakdown", () => {
    const c = cand({
      candidate_id: "a",
      identity: { ...candIdentity(), osm_id: "node/42" },
    });
    const pool = [row("T1", { osm_id: "node/42" })];
    const a = resolveCanonical({ candidate: c, pool });
    const b = resolveCanonical({ candidate: c, pool });
    expect(a).toEqual(b);
  });

  test("deterministic ordering of competing candidates (score desc, id asc on tie)", () => {
    const c = cand({
      candidate_id: "a",
      identity: { ...candIdentity(), phone_e164: "+6281234567890" },
    });
    const pool = [
      row("Z-second", { phone_e164: "+6281234567890" }),
      row("A-second", { phone_e164: "+6281234567890" }),
    ];
    const r = resolveCanonical({ candidate: c, pool });
    if (isAnswered(r) && r.value.kind === "AMBIGUOUS") {
      // Equal scores · tiebreak by id ascending
      expect(r.value.competing[0].canonical_business_id).toBe("A-second");
      expect(r.value.competing[1].canonical_business_id).toBe("Z-second");
    }
  });

  test("does not mutate the Candidate", () => {
    const c = cand({
      candidate_id: "a",
      identity: { ...candIdentity(), osm_id: "node/42", aliases: ["x"] },
    });
    const snap = JSON.stringify(c);
    resolveCanonical({ candidate: c, pool: [row("T", { osm_id: "node/42" })] });
    expect(JSON.stringify(c)).toBe(snap);
  });

  test("does not mutate the pool", () => {
    const pool = [row("T1", { osm_id: "node/42" }), row("T2")];
    const snap = JSON.stringify(pool);
    resolveCanonical({
      candidate: cand({
        candidate_id: "a",
        identity: { ...candIdentity(), osm_id: "node/42" },
      }),
      pool,
    });
    expect(JSON.stringify(pool)).toBe(snap);
  });

  test("MATCH score_breakdown is deterministic across runs", () => {
    const c = cand({
      candidate_id: "a",
      identity: { ...candIdentity(), osm_id: "node/42", phone_e164: "+6281234567890" },
    });
    const pool = [row("T1", { osm_id: "node/42", phone_e164: "+6281234567890" })];
    const r1 = resolveCanonical({ candidate: c, pool });
    const r2 = resolveCanonical({ candidate: c, pool });
    expect(r1).toEqual(r2);
  });
});

// ═════════════════════════════════════════════════════════════════════
// §10 · Verdict shape · compatible with canonical-handoff.ts
// ═════════════════════════════════════════════════════════════════════

describe("verdict shape · consumable by canonical-handoff.precheckHandoff", () => {
  test("MATCH verdict has target_canonical_business_id + score + score_breakdown", () => {
    const c = cand({
      candidate_id: "a",
      identity: { ...candIdentity(), osm_id: "node/42" },
    });
    const pool = [row("T1", { osm_id: "node/42" })];
    const r = resolveCanonical({ candidate: c, pool });
    if (isAnswered(r) && r.value.kind === "MATCH") {
      const v: ResolverVerdict = r.value; // TS assignability check
      expect(v.kind).toBe("MATCH");
      expect(typeof v.target_canonical_business_id).toBe("string");
      expect(typeof v.score).toBe("number");
      expect(Array.isArray(v.score_breakdown)).toBe(true);
    }
  });

  test("AMBIGUOUS verdict has competing[] + best_score", () => {
    const c = cand({
      candidate_id: "a",
      identity: { ...candIdentity(), phone_e164: "+6281234567890" },
    });
    const pool = [row("T1", { phone_e164: "+6281234567890" })];
    const r = resolveCanonical({ candidate: c, pool });
    if (isAnswered(r) && r.value.kind === "AMBIGUOUS") {
      const v: ResolverVerdict = r.value;
      expect(v.kind).toBe("AMBIGUOUS");
      expect(Array.isArray(v.competing)).toBe(true);
      expect(typeof v.best_score).toBe("number");
    }
  });

  test("NO_MATCH verdict has best_score", () => {
    const c = cand({
      candidate_id: "a",
      identity: {
        ...candIdentity(),
        phone_e164: "+6281234567890",
        name_canonical: "AbsolutelyUniqueXyz",
      },
    });
    const pool = [
      row("T1", { name_canonical: "Other", name_norm: "other" }),
    ];
    const r = resolveCanonical({ candidate: c, pool });
    if (isAnswered(r) && r.value.kind === "NO_MATCH") {
      const v: ResolverVerdict = r.value;
      expect(v.kind).toBe("NO_MATCH");
      expect(typeof v.best_score).toBe("number");
    }
  });
});

// ═════════════════════════════════════════════════════════════════════
// §11 · Specific invariants
// ═════════════════════════════════════════════════════════════════════

describe("verdict invariants", () => {
  test("AMBIGUOUS never produces a MATCH or NO_MATCH shape", () => {
    const c = cand({
      candidate_id: "a",
      identity: { ...candIdentity(), phone_e164: "+6281234567890" },
    });
    const pool = [row("T1", { phone_e164: "+6281234567890" })];
    const r = resolveCanonical({ candidate: c, pool });
    if (isAnswered(r) && r.value.kind === "AMBIGUOUS") {
      expect(r.value.kind).not.toBe("MATCH");
      expect(r.value.kind).not.toBe("NO_MATCH");
    }
  });

  test("weak name similarity does not override OSM contradiction", () => {
    const c = cand({
      candidate_id: "a",
      identity: {
        ...candIdentity(),
        osm_id: "node/42",
        name_canonical: "Warung Bu Siti",
        phone_e164: "+6281234567890",
      },
    });
    const pool = [
      row("T1", {
        osm_id: "node/99",
        name_canonical: "Warung Bu Siti",
        name_norm: "warung bu siti",
        phone_e164: "+6281234567890",
      }),
    ];
    const r = resolveCanonical({ candidate: c, pool });
    expect(isAnswered(r)).toBe(true);
    if (isAnswered(r)) {
      expect(r.value.kind).toBe("NO_MATCH"); // capped at 0.20, below AMBIGUOUS
    }
  });

  test("entity_type mismatch does not become MATCH even with phone + website + name agreement", () => {
    const c = cand({
      candidate_id: "a",
      entity_type: "food",
      identity: {
        ...candIdentity(),
        phone_e164: "+6281234567890",
        website_apex: "x.id",
      },
    });
    const pool = [
      row("T1", {
        entity_type: "accommodation",
        phone_e164: "+6281234567890",
        website_apex: "x.id",
      }),
    ];
    const r = resolveCanonical({ candidate: c, pool });
    if (isAnswered(r)) {
      expect(r.value.kind).toBe("NO_MATCH"); // capped at 0.30
    }
  });
});

// ═════════════════════════════════════════════════════════════════════
// §12 · Pure-module grep invariants
// ═════════════════════════════════════════════════════════════════════

describe("canonical-resolver source · pure module", () => {
  const srcPath = path.join(__dirname, "canonical-resolver.ts");
  const src = fs.readFileSync(srcPath, "utf8");
  const code = src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/[^\n]*/g, "");

  test("CODE does NOT import pg / pg-executor / pg-fingerprint / extract-candidates", () => {
    expect(code).not.toMatch(/from\s+["']pg["']/);
    expect(code).not.toMatch(/from\s+["']\.\/pg-executor["']/);
    expect(code).not.toMatch(/from\s+["']\.\/pg-fingerprint["']/);
    expect(code).not.toMatch(/from\s+["']\.\/extract-candidates["']/);
  });

  test("CODE does NOT depend on Layer A (identity-matching / entity-universe / matchBusiness)", () => {
    expect(code).not.toMatch(/identity-matching/);
    expect(code).not.toMatch(/entity-universe/);
    expect(code).not.toMatch(/\bmatchBusiness\s*\(/);
  });

  test("CODE does NOT read env / fs / network / Supabase", () => {
    expect(code).not.toMatch(/process\.env/);
    expect(code).not.toMatch(/\bfs\.read/);
    expect(code).not.toMatch(/\bfs\.write/);
    expect(code).not.toMatch(/@supabase/);
    expect(code).not.toMatch(/\bsupabase/i);
    expect(code).not.toMatch(/\bnet\./);
    expect(code).not.toMatch(/\bhttp\./);
  });

  test("CODE does NOT use a clock / randomness", () => {
    expect(code).not.toMatch(/\bnew\s+Date\b/);
    expect(code).not.toMatch(/\bDate\.now\b/);
    expect(code).not.toMatch(/\bMath\.random\b/);
    expect(code).not.toMatch(/\brandomUUID\b/);
    expect(code).not.toMatch(/\brandomBytes\b/);
  });

  test("CODE does NOT implement executeWritePlan / canonical-insert / country runner", () => {
    expect(code).not.toMatch(/\bexecuteWritePlan\b/);
    expect(code).not.toMatch(/\bcanonicalInsert\b/);
    expect(code).not.toMatch(/\bcountryRunner\b/);
    expect(code).not.toMatch(/\.query\s*\(/);
    expect(code).not.toMatch(/\bINSERT\s+INTO\b/i);
    expect(code).not.toMatch(/\bUPDATE\s+\w+\s+SET\b/i);
    expect(code).not.toMatch(/\bDELETE\s+FROM\b/i);
  });

  test("CODE's only local imports are the sealed consumer surface", () => {
    const localImports = [
      ...code.matchAll(/from\s+["']\.\/([^"']+)["']/g),
    ].map((m) => m[1]);
    const allowed = new Set([
      "generate-candidates",
      "canonical-row",
      "canonical-handoff",
      "intelligence-result",
    ]);
    for (const imp of localImports) {
      expect(allowed.has(imp)).toBe(true);
    }
  });

  test("CODE does NOT contain any node builtin import (hashing/crypto is not needed here)", () => {
    const nodeImports = [
      ...code.matchAll(/from\s+["']node:([^"']+)["']/g),
    ].map((m) => m[1]);
    expect(nodeImports).toEqual([]);
  });
});

// ═════════════════════════════════════════════════════════════════════
// §0 helper · default identity scaffolding
// ═════════════════════════════════════════════════════════════════════

function candIdentity(): Candidate["identity"] {
  return {
    name_canonical: "Warung Bu Siti",
    aliases: [],
    phone_e164: null,
    website_apex: null,
    osm_id: null,
    wikidata_qid: null,
    city: null,
    district: null,
    coordinates: null,
  };
}
