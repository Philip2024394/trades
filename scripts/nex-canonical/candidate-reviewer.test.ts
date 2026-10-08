// scripts/nex-canonical/candidate-reviewer.test.ts
//
// Pure unit tests for the candidate review-summary generator.
// No DB. No network. No pg Client.

import { describe, expect, test } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import {
  DEFERRED_UNTIL_LATER,
  computeDistribution,
  findDuplicates,
  reviewCandidates,
  tallyBy,
  type AnomalyRule,
} from "./candidate-reviewer";
import { SEALED_ENTITY_TYPES, type Candidate } from "./generate-candidates";

// ═════════════════════════════════════════════════════════════════════
// §0 · Candidate fixture builder
// ═════════════════════════════════════════════════════════════════════

function cand(overrides: Partial<Candidate> & { candidate_id: string }): Candidate {
  const base: Candidate = {
    candidate_id: overrides.candidate_id,
    status: "pending_founder_review",
    entity_type: "food",
    country: "ID",
    identity: {
      name_canonical: `name-${overrides.candidate_id}`,
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
      generation_run_id: "nex-cand-v1-2026-10-08",
    },
    caveats: [],
  };
  return { ...base, ...overrides } as Candidate;
}

// ═════════════════════════════════════════════════════════════════════
// §1 · computeDistribution
// ═════════════════════════════════════════════════════════════════════

describe("computeDistribution", () => {
  test("empty input yields all-zero deterministic result", () => {
    const d = computeDistribution([]);
    expect(d).toEqual({
      count: 0,
      min: 0,
      p25: 0,
      median: 0,
      p75: 0,
      max: 0,
      mean: 0,
    });
  });

  test("single value", () => {
    const d = computeDistribution([0.5]);
    expect(d.count).toBe(1);
    expect(d.min).toBe(0.5);
    expect(d.max).toBe(0.5);
    expect(d.median).toBe(0.5);
    expect(d.mean).toBe(0.5);
  });

  test("ten evenly spaced values", () => {
    const d = computeDistribution([
      0.0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9,
    ]);
    expect(d.count).toBe(10);
    expect(d.min).toBe(0);
    expect(d.max).toBe(0.9);
    expect(d.mean).toBeCloseTo(0.45, 5);
  });

  test("same input · same output (deterministic)", () => {
    const a = computeDistribution([3, 1, 2, 5, 4]);
    const b = computeDistribution([3, 1, 2, 5, 4]);
    expect(a).toEqual(b);
  });

  test("rejects NaN / Infinity", () => {
    expect(() => computeDistribution([1, Number.NaN])).toThrow(/non-finite/);
    expect(() =>
      computeDistribution([1, Number.POSITIVE_INFINITY]),
    ).toThrow(/non-finite/);
  });

  test("percentiles use lower-index selection on ties", () => {
    const d = computeDistribution([0, 0, 0, 0, 1, 1, 1, 1]);
    // n=8 · p25 index = floor(0.25*7) = 1 → sorted[1] = 0
    expect(d.p25).toBe(0);
    expect(d.p75).toBe(1);
  });
});

// ═════════════════════════════════════════════════════════════════════
// §2 · tallyBy
// ═════════════════════════════════════════════════════════════════════

describe("tallyBy", () => {
  test("counts occurrences", () => {
    const t = tallyBy(["a", "b", "a", "c", "a", "b"]);
    expect(t.a).toBe(3);
    expect(t.b).toBe(2);
    expect(t.c).toBe(1);
  });

  test("empty input yields empty record", () => {
    expect(tallyBy([] as string[])).toEqual({});
  });
});

// ═════════════════════════════════════════════════════════════════════
// §3 · findDuplicates
// ═════════════════════════════════════════════════════════════════════

describe("findDuplicates", () => {
  test("returns duplicates sorted alphabetically", () => {
    const d = findDuplicates(
      [{ k: "b" }, { k: "a" }, { k: "a" }, { k: "b" }, { k: "c" }],
      (x) => x.k,
    );
    expect(d).toEqual(["a", "b"]);
  });

  test("no duplicates yields empty array", () => {
    expect(findDuplicates([{ k: "a" }, { k: "b" }], (x) => x.k)).toEqual([]);
  });
});

// ═════════════════════════════════════════════════════════════════════
// §4 · reviewCandidates · totals & distributions
// ═════════════════════════════════════════════════════════════════════

describe("reviewCandidates · totals & distributions", () => {
  test("empty input · zero totals · zero anomalies · deferred preserved", () => {
    const r = reviewCandidates([]);
    expect(r.total_candidates).toBe(0);
    expect(r.anomalies).toEqual([]);
    expect(r.deferred.length).toBeGreaterThan(0);
    expect(r.pinned_run_metadata.generator).toBe("MIXED");
    expect(r.pinned_run_metadata.generation_run_id).toBe("MIXED");
    expect(r.selection_score_distribution.count).toBe(0);
  });

  test("entity_type distribution reflects every sealed type when present", () => {
    const candidates = SEALED_ENTITY_TYPES.map((et, i) =>
      cand({ candidate_id: `c-${i}`, entity_type: et }),
    );
    const r = reviewCandidates(candidates);
    for (const et of SEALED_ENTITY_TYPES) {
      expect(r.by_entity_type[et]).toBe(1);
    }
  });

  test("country distribution", () => {
    const r = reviewCandidates([
      cand({ candidate_id: "a", country: "ID" }),
      cand({ candidate_id: "b", country: "ID" }),
      cand({ candidate_id: "c", country: "MY" }),
    ]);
    expect(r.by_country).toEqual({ ID: 2, MY: 1 });
  });

  test("source table distribution", () => {
    const r = reviewCandidates([
      cand({
        candidate_id: "a",
        legacy_source: { table: "nex.food_business", ref: "r1", internal_id: null },
      }),
      cand({
        candidate_id: "b",
        legacy_source: { table: "nex.accommodation_business", ref: "r2", internal_id: null },
      }),
      cand({
        candidate_id: "c",
        legacy_source: { table: "nex.food_business", ref: "r3", internal_id: null },
      }),
    ]);
    expect(r.by_source_table).toEqual({
      "nex.food_business": 2,
      "nex.accommodation_business": 1,
    });
  });

  test("risk-category distribution counts each category attachment separately", () => {
    const r = reviewCandidates([
      cand({ candidate_id: "a", risk_categories: ["R1", "R3"] }),
      cand({ candidate_id: "b", risk_categories: ["R3"] }),
      cand({ candidate_id: "c", risk_categories: [] }),
    ]);
    expect(r.by_risk_category.R1).toBe(1);
    expect(r.by_risk_category.R3).toBe(2);
    expect(r.by_risk_category.R5).toBe(0);
    expect(r.candidates_with_multiple_risk_categories).toBe(1);
    expect(r.candidates_with_zero_risk_categories).toBe(1);
  });

  test("selection_score distribution", () => {
    const r = reviewCandidates([
      cand({ candidate_id: "a", selection_score: 0.2 }),
      cand({ candidate_id: "b", selection_score: 0.5 }),
      cand({ candidate_id: "c", selection_score: 0.8 }),
    ]);
    expect(r.selection_score_distribution.count).toBe(3);
    expect(r.selection_score_distribution.min).toBe(0.2);
    expect(r.selection_score_distribution.max).toBe(0.8);
    expect(r.selection_score_distribution.median).toBe(0.5);
  });
});

// ═════════════════════════════════════════════════════════════════════
// §5 · identity_coverage
// ═════════════════════════════════════════════════════════════════════

describe("reviewCandidates · identity_coverage", () => {
  test("all nulls yields zero coverage across the board", () => {
    const r = reviewCandidates([cand({ candidate_id: "a" })]);
    const c = r.identity_coverage;
    expect(c.phone_e164_present).toBe(0);
    expect(c.website_apex_present).toBe(0);
    expect(c.osm_id_present).toBe(0);
    expect(c.wikidata_qid_present).toBe(0);
    expect(c.city_present).toBe(0);
    expect(c.district_present).toBe(0);
    expect(c.coordinates_present).toBe(0);
    expect(c.aliases_non_empty).toBe(0);
  });

  test("every identity field populated increments every counter", () => {
    const r = reviewCandidates([
      cand({
        candidate_id: "a",
        identity: {
          name_canonical: "N",
          aliases: ["x"],
          phone_e164: "+6212345",
          website_apex: "a.id",
          osm_id: "node/1",
          wikidata_qid: "Q1",
          city: "Bandung",
          district: "D",
          coordinates: { lat: 0, lng: 0 },
        },
      }),
    ]);
    const c = r.identity_coverage;
    expect(c.phone_e164_present).toBe(1);
    expect(c.website_apex_present).toBe(1);
    expect(c.osm_id_present).toBe(1);
    expect(c.wikidata_qid_present).toBe(1);
    expect(c.city_present).toBe(1);
    expect(c.district_present).toBe(1);
    expect(c.coordinates_present).toBe(1);
    expect(c.aliases_non_empty).toBe(1);
  });
});

// ═════════════════════════════════════════════════════════════════════
// §6 · Anomaly rules (each decided from Candidate alone)
// ═════════════════════════════════════════════════════════════════════

function anomalyRules(rs: readonly { rule: AnomalyRule }[]): AnomalyRule[] {
  return rs.map((a) => a.rule).sort();
}

describe("anomaly · duplicate_candidate_id", () => {
  test("fires when two candidates share the same candidate_id", () => {
    const r = reviewCandidates([
      cand({ candidate_id: "dup" }),
      cand({ candidate_id: "dup", legacy_source: { table: "t", ref: "r2", internal_id: null } }),
      cand({ candidate_id: "unique" }),
    ]);
    const a = r.anomalies.find((x) => x.rule === "duplicate_candidate_id");
    expect(a).toBeDefined();
    expect(a?.severity).toBe("bug_suspected");
    expect(a?.candidate_ids).toEqual(["dup"]);
  });

  test("silent when all candidate_ids are unique", () => {
    const r = reviewCandidates([
      cand({ candidate_id: "a" }),
      cand({ candidate_id: "b" }),
    ]);
    expect(r.anomalies.find((x) => x.rule === "duplicate_candidate_id")).toBeUndefined();
  });
});

describe("anomaly · duplicate_legacy_source", () => {
  test("fires when (table, ref) pairs collide", () => {
    const r = reviewCandidates([
      cand({
        candidate_id: "a",
        legacy_source: { table: "nex.food_business", ref: "r1", internal_id: null },
      }),
      cand({
        candidate_id: "b",
        legacy_source: { table: "nex.food_business", ref: "r1", internal_id: null },
      }),
      cand({
        candidate_id: "c",
        legacy_source: { table: "nex.food_business", ref: "r2", internal_id: null },
      }),
    ]);
    const a = r.anomalies.find((x) => x.rule === "duplicate_legacy_source");
    expect(a).toBeDefined();
    expect(a?.candidate_ids.sort()).toEqual(["a", "b"]);
  });

  test("different tables same ref · NOT a duplicate", () => {
    const r = reviewCandidates([
      cand({
        candidate_id: "a",
        legacy_source: { table: "nex.food_business", ref: "r1", internal_id: null },
      }),
      cand({
        candidate_id: "b",
        legacy_source: { table: "nex.service_business", ref: "r1", internal_id: null },
      }),
    ]);
    expect(r.anomalies.find((x) => x.rule === "duplicate_legacy_source")).toBeUndefined();
  });
});

describe("anomaly · zero_risk_categories", () => {
  test("fires for a candidate with empty risk_categories", () => {
    const r = reviewCandidates([
      cand({ candidate_id: "a", risk_categories: [], selection_rationale: [] }),
    ]);
    const a = r.anomalies.find((x) => x.rule === "zero_risk_categories");
    expect(a?.candidate_ids).toEqual(["a"]);
  });
});

describe("anomaly · risk_rationale_mismatch", () => {
  test("fires when rationale references a category not in risk_categories", () => {
    const r = reviewCandidates([
      cand({
        candidate_id: "a",
        risk_categories: ["R1"],
        selection_rationale: [
          { risk_category: "R3", contribution: 0.5, note: "n" },
        ],
      }),
    ]);
    const a = r.anomalies.find((x) => x.rule === "risk_rationale_mismatch");
    expect(a?.candidate_ids).toEqual(["a"]);
  });

  test("fires when risk_categories has a category with no rationale entry", () => {
    const r = reviewCandidates([
      cand({
        candidate_id: "a",
        risk_categories: ["R1", "R2"],
        selection_rationale: [
          { risk_category: "R1", contribution: 0.5, note: "n" },
        ],
      }),
    ]);
    const a = r.anomalies.find((x) => x.rule === "risk_rationale_mismatch");
    expect(a?.candidate_ids).toEqual(["a"]);
  });

  test("does not fire when risk_categories and rationale categories agree", () => {
    const r = reviewCandidates([
      cand({
        candidate_id: "a",
        risk_categories: ["R1", "R3"],
        selection_rationale: [
          { risk_category: "R1", contribution: 0.3, note: "n" },
          { risk_category: "R3", contribution: 0.4, note: "n" },
        ],
      }),
    ]);
    expect(r.anomalies.find((x) => x.rule === "risk_rationale_mismatch")).toBeUndefined();
  });
});

describe("anomaly · score_boundary", () => {
  test("fires for score exactly 0", () => {
    const r = reviewCandidates([
      cand({ candidate_id: "a", selection_score: 0, risk_categories: [], selection_rationale: [] }),
      cand({ candidate_id: "b", selection_score: 0.5 }),
    ]);
    // Both score_boundary and zero_risk_categories may fire for "a".
    const sb = r.anomalies.find((x) => x.rule === "score_boundary");
    expect(sb?.candidate_ids).toEqual(["a"]);
    expect(sb?.severity).toBe("flag");
  });

  test("fires for score exactly 1", () => {
    const r = reviewCandidates([
      cand({ candidate_id: "a", selection_score: 1 }),
    ]);
    expect(r.anomalies.find((x) => x.rule === "score_boundary")?.candidate_ids).toEqual(["a"]);
  });

  test("does not fire for interior scores", () => {
    const r = reviewCandidates([
      cand({ candidate_id: "a", selection_score: 0.001 }),
      cand({ candidate_id: "b", selection_score: 0.999 }),
    ]);
    expect(r.anomalies.find((x) => x.rule === "score_boundary")).toBeUndefined();
  });
});

describe("anomaly · thin_identity", () => {
  test("fires when every identity signal is empty/null", () => {
    const r = reviewCandidates([
      cand({ candidate_id: "a" }),
    ]);
    const t = r.anomalies.find((x) => x.rule === "thin_identity");
    expect(t?.candidate_ids).toEqual(["a"]);
    expect(t?.severity).toBe("flag");
  });

  test("does not fire when at least one identity signal is present", () => {
    const r = reviewCandidates([
      cand({
        candidate_id: "a",
        identity: {
          name_canonical: "N",
          aliases: [],
          phone_e164: null,
          website_apex: "example.id",
          osm_id: null,
          wikidata_qid: null,
          city: null,
          district: null,
          coordinates: null,
        },
      }),
    ]);
    expect(r.anomalies.find((x) => x.rule === "thin_identity")).toBeUndefined();
  });

  test("city alone is NOT enough to escape thin_identity", () => {
    // city is a weak signal; the rule treats a city-only identity as thin
    // because it carries no uniqueness beyond name + city.
    const r = reviewCandidates([
      cand({
        candidate_id: "a",
        identity: {
          name_canonical: "N",
          aliases: [],
          phone_e164: null,
          website_apex: null,
          osm_id: null,
          wikidata_qid: null,
          city: "Bandung",
          district: null,
          coordinates: null,
        },
      }),
    ]);
    expect(r.anomalies.find((x) => x.rule === "thin_identity")?.candidate_ids).toEqual(["a"]);
  });

  test("aliases alone IS enough to escape thin_identity", () => {
    const r = reviewCandidates([
      cand({
        candidate_id: "a",
        identity: {
          name_canonical: "N",
          aliases: ["Alt"],
          phone_e164: null,
          website_apex: null,
          osm_id: null,
          wikidata_qid: null,
          city: null,
          district: null,
          coordinates: null,
        },
      }),
    ]);
    expect(r.anomalies.find((x) => x.rule === "thin_identity")).toBeUndefined();
  });
});

describe("anomaly · mixed_generation_run_id / mixed_generated_at", () => {
  test("mixed run_id fires when the set spans two runs", () => {
    const r = reviewCandidates([
      cand({
        candidate_id: "a",
        generation_source: {
          generator: "scripts/nex-canonical/generate-candidates.ts",
          generated_at: "2026-10-08T12:00:00.000Z",
          generation_run_id: "run-A",
        },
      }),
      cand({
        candidate_id: "b",
        generation_source: {
          generator: "scripts/nex-canonical/generate-candidates.ts",
          generated_at: "2026-10-08T12:00:00.000Z",
          generation_run_id: "run-B",
        },
      }),
    ]);
    const a = r.anomalies.find((x) => x.rule === "mixed_generation_run_id");
    expect(a).toBeDefined();
    expect(a?.severity).toBe("flag");
    expect(r.pinned_run_metadata.generation_run_id).toBe("MIXED");
    expect(r.pinned_run_metadata.distinct_run_ids.length).toBe(2);
  });

  test("mixed generated_at fires independently of run_id", () => {
    const r = reviewCandidates([
      cand({
        candidate_id: "a",
        generation_source: {
          generator: "scripts/nex-canonical/generate-candidates.ts",
          generated_at: "2026-10-08T12:00:00.000Z",
          generation_run_id: "same",
        },
      }),
      cand({
        candidate_id: "b",
        generation_source: {
          generator: "scripts/nex-canonical/generate-candidates.ts",
          generated_at: "2026-10-08T12:00:01.000Z",
          generation_run_id: "same",
        },
      }),
    ]);
    expect(r.anomalies.find((x) => x.rule === "mixed_generated_at")).toBeDefined();
  });

  test("single run · zero mixed-* anomalies", () => {
    const r = reviewCandidates([
      cand({ candidate_id: "a" }),
      cand({ candidate_id: "b" }),
    ]);
    expect(r.anomalies.find((x) => x.rule === "mixed_generation_run_id")).toBeUndefined();
    expect(r.anomalies.find((x) => x.rule === "mixed_generated_at")).toBeUndefined();
  });
});

// ═════════════════════════════════════════════════════════════════════
// §7 · determinism · same input → same output
// ═════════════════════════════════════════════════════════════════════

describe("reviewCandidates · determinism", () => {
  test("same input produces structurally-equal output", () => {
    const input = [
      cand({ candidate_id: "a", selection_score: 0.3 }),
      cand({ candidate_id: "b", selection_score: 0.7 }),
      cand({ candidate_id: "c", selection_score: 0.5 }),
    ];
    expect(reviewCandidates(input)).toEqual(reviewCandidates(input));
  });

  test("anomaly candidate_ids are sorted alphabetically", () => {
    const r = reviewCandidates([
      cand({ candidate_id: "z-dup" }),
      cand({ candidate_id: "a-dup" }),
      cand({ candidate_id: "a-dup" }),
      cand({ candidate_id: "z-dup" }),
    ]);
    const dup = r.anomalies.find((x) => x.rule === "duplicate_candidate_id");
    expect(dup?.candidate_ids).toEqual(["a-dup", "z-dup"]);
  });
});

// ═════════════════════════════════════════════════════════════════════
// §8 · deferred list
// ═════════════════════════════════════════════════════════════════════

describe("deferred list · explicit scope boundary", () => {
  test("every ReviewReport includes the sealed deferred list", () => {
    const r = reviewCandidates([]);
    expect(r.deferred).toEqual(DEFERRED_UNTIL_LATER);
  });

  test("deferred list names the resolver, DB, ground-truth, and population limitations", () => {
    const joined = DEFERRED_UNTIL_LATER.join(" | ");
    expect(joined).toMatch(/resolver/i);
    expect(joined).toMatch(/legacy population|DB|live/i);
    expect(joined).toMatch(/ground.?truth|approval/i);
    expect(joined).toMatch(/entity.?type|business_category|Rule 5l/i);
  });

  test("deferred list is a frozen array · reviewer cannot mutate it", () => {
    expect(Object.isFrozen(DEFERRED_UNTIL_LATER)).toBe(true);
    expect(() => {
      (DEFERRED_UNTIL_LATER as string[]).push("sneaky");
    }).toThrow();
  });
});

// ═════════════════════════════════════════════════════════════════════
// §9 · pinned run metadata
// ═════════════════════════════════════════════════════════════════════

describe("pinned run metadata", () => {
  test("single run · generator / generation_run_id / generated_at all pinned", () => {
    const r = reviewCandidates([
      cand({ candidate_id: "a" }),
      cand({ candidate_id: "b" }),
    ]);
    expect(r.pinned_run_metadata.generator).toBe(
      "scripts/nex-canonical/generate-candidates.ts",
    );
    expect(r.pinned_run_metadata.generation_run_id).toBe(
      "nex-cand-v1-2026-10-08",
    );
    expect(r.pinned_run_metadata.generated_at).toBe(
      "2026-10-08T12:00:00.000Z",
    );
    expect(r.pinned_run_metadata.distinct_run_ids).toEqual([
      "nex-cand-v1-2026-10-08",
    ]);
  });
});

// ═════════════════════════════════════════════════════════════════════
// §10 · pure-module grep invariants
// ═════════════════════════════════════════════════════════════════════

describe("candidate-reviewer source · pure module invariants", () => {
  const srcPath = path.join(__dirname, "candidate-reviewer.ts");
  const src = fs.readFileSync(srcPath, "utf8");
  const code = src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/[^\n]*/g, "");

  test("CODE does NOT import pg", () => {
    expect(code).not.toMatch(/from\s+["']pg["']/);
    expect(code).not.toMatch(/require\(["']pg["']/);
  });

  test("CODE does NOT import pg-executor / pg-fingerprint / extract-candidates", () => {
    expect(code).not.toMatch(/from\s+["']\.\/pg-executor["']/);
    expect(code).not.toMatch(/from\s+["']\.\/pg-fingerprint["']/);
    expect(code).not.toMatch(/from\s+["']\.\/extract-candidates["']/);
  });

  test("CODE does NOT invoke or import the resolver", () => {
    expect(code).not.toMatch(/identity-matching/);
    expect(code).not.toMatch(/entity-universe/);
    expect(code).not.toMatch(/\bmatchBusiness\s*\(/);
  });

  test("CODE does NOT read or write the filesystem", () => {
    expect(code).not.toMatch(/\bfs\.readFile/);
    expect(code).not.toMatch(/\bfs\.writeFile/);
    expect(code).not.toMatch(/\bfsp\./);
    expect(code).not.toMatch(/\bcreateWriteStream/);
  });

  test("CODE does NOT reference Supabase, credentials, or process.env", () => {
    expect(code).not.toMatch(/@supabase/);
    expect(code).not.toMatch(/supabase/i);
    expect(code).not.toMatch(/\bdotenv\b/);
    expect(code).not.toMatch(/process\.env/);
    expect(code).not.toMatch(/\.pgpass/);
  });

  test("CODE's only local imports are ./generate-candidates and ./candidate-validator", () => {
    const localImports = [
      ...code.matchAll(/from\s+["']\.\/([^"']+)["']/g),
    ].map((m) => m[1]);
    for (const imp of localImports) {
      expect(["generate-candidates", "candidate-validator"]).toContain(imp);
    }
  });
});
