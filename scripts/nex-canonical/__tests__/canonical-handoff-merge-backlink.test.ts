// scripts/nex-canonical/__tests__/canonical-handoff-merge-backlink.test.ts
//
// Pure unit tests for the sealed MERGE-path legacy backlink wiring.
//
// Covers:
//   · `legacyBacklinkSpec` · the pure vertical lookup function in
//     canonical-handoff.ts (food / accommodation / service / mp_seller
//     all return a spec · transport returns null · unknown table returns
//     null)
//   · `compileWritePlan` · the executor's merge_match path now emits an
//     idempotent `backfill_legacy_canonical_id` stage between `write`
//     and `commit` for verticals with a spec AND a non-null
//     legacy_source.internal_id. INSERT paths NEVER emit this stage.
//     MERGE on an "already-linked" source row still emits the stage,
//     but the SQL carries a `WHERE canonical_business_id IS NULL` guard
//     that makes the UPDATE a no-op in-DB.
//
// No DB. No network. No clock. No randomness. No credentials.

import { describe, expect, test } from "vitest";
import {
  EVIDENCE_SCHEMA_VERSION,
  legacyBacklinkSpec,
  type HandoffEvidence,
  type InsertCanonicalRow,
  type CanonicalWritePlan,
} from "../canonical-handoff";
import { compileWritePlan } from "../execute-write-plan";

// ═════════════════════════════════════════════════════════════════════
// §0 · Fixtures
// ═════════════════════════════════════════════════════════════════════

function evidence(overrides: Partial<HandoffEvidence> = {}): HandoffEvidence {
  const base: HandoffEvidence = {
    schema_version: EVIDENCE_SCHEMA_VERSION,
    candidate_id: "cand-m-1",
    candidate_integrity_hash:
      "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    decision_record_id:
      "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    review_package_id:
      "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
    legacy_source: {
      table: "nex.food_business",
      ref: "food-ref-123",
      internal_id: "food-123",
    },
    resolver_verdict_summary: {
      kind: "MATCH",
      target_canonical_business_id: "T1",
      score: 0.95,
    },
    observation_provenance: {
      generator: "scripts/nex-canonical/generate-candidates.ts",
      generation_run_id: "test-run",
      generated_at: "2026-10-10T12:00:00.000Z",
      decision_timestamp: "2026-10-10T12:05:00.000Z",
      founder_id: "philip",
    },
    source_id: "nex.food_business",
  };
  return { ...base, ...overrides };
}

function insertRow(
  overrides: Partial<InsertCanonicalRow> = {},
): InsertCanonicalRow {
  const base: InsertCanonicalRow = {
    entity_type: "food",
    country: "ID",
    lifecycle_state: "DISCOVERED",
    name_canonical: "Warung Backlink",
    aliases: [],
    phone_e164: null,
    website_apex: null,
    osm_id: null,
    wikidata_qid: null,
    city: null,
    district: null,
    street_line: null,
    neighbourhood: null,
    address: null,
    coordinates: null,
  };
  return { ...base, ...overrides };
}

function mergePlan(
  overrides: Partial<HandoffEvidence> = {},
  targetId = "T1",
): CanonicalWritePlan {
  return {
    kind: "merge_match",
    target_canonical_business_id: targetId,
    evidence: evidence({
      resolver_verdict_summary: {
        kind: "MATCH",
        target_canonical_business_id: targetId,
        score: 0.95,
      },
      ...overrides,
    }),
  };
}

function insertPlan(): CanonicalWritePlan {
  return {
    kind: "insert_new",
    row: insertRow(),
    evidence: evidence({
      resolver_verdict_summary: {
        kind: "NO_MATCH",
        target_canonical_business_id: null,
        score: 0.1,
      },
      legacy_source: {
        table: "nex.food_business",
        ref: "food-ref-456",
        internal_id: "food-456",
      },
    }),
  };
}

// ═════════════════════════════════════════════════════════════════════
// §1 · legacyBacklinkSpec · the pure lookup
// ═════════════════════════════════════════════════════════════════════

describe("legacyBacklinkSpec · vertical whitelist", () => {
  test("nex.food_business → spec with internal_id PK", () => {
    const s = legacyBacklinkSpec("nex.food_business");
    expect(s).toEqual({
      table: "nex.food_business",
      idColumn: "internal_id",
      canonicalIdColumn: "canonical_business_id",
    });
  });

  test("nex.accommodation_business → spec with internal_id PK", () => {
    const s = legacyBacklinkSpec("nex.accommodation_business");
    expect(s).toEqual({
      table: "nex.accommodation_business",
      idColumn: "internal_id",
      canonicalIdColumn: "canonical_business_id",
    });
  });

  test("nex.service_business → spec with internal_id PK", () => {
    const s = legacyBacklinkSpec("nex.service_business");
    expect(s).toEqual({
      table: "nex.service_business",
      idColumn: "internal_id",
      canonicalIdColumn: "canonical_business_id",
    });
  });

  test("nex.mp_seller → spec with seller_id PK (different column from the others)", () => {
    const s = legacyBacklinkSpec("nex.mp_seller");
    expect(s).toEqual({
      table: "nex.mp_seller",
      idColumn: "seller_id",
      canonicalIdColumn: "canonical_business_id",
    });
  });

  test("nex.transport_acquisition_record → null (no canonical_business_id column)", () => {
    expect(legacyBacklinkSpec("nex.transport_acquisition_record")).toBeNull();
  });

  test("unknown table → null (silent skip)", () => {
    expect(legacyBacklinkSpec("nex.not_a_real_table")).toBeNull();
    expect(legacyBacklinkSpec("")).toBeNull();
    expect(legacyBacklinkSpec("public.business_canonical")).toBeNull();
  });

  test("pure · same input → same output across repeated calls", () => {
    const a = legacyBacklinkSpec("nex.food_business");
    const b = legacyBacklinkSpec("nex.food_business");
    expect(a).toEqual(b);
  });
});

// ═════════════════════════════════════════════════════════════════════
// §2 · compileWritePlan · merge_match backlink stage
// ═════════════════════════════════════════════════════════════════════

describe("compileWritePlan · merge_match emits backlink UPDATE", () => {
  test("food merge with internal_id · backfill stage appears after write and before commit", () => {
    const c = compileWritePlan(mergePlan());
    const labels = c.stages.map((s) => s.label);
    const writeIdx = labels.indexOf("write");
    const backfillIdx = labels.indexOf("backfill_legacy_canonical_id");
    const commitIdx = labels.indexOf("commit");
    expect(writeIdx).toBeGreaterThan(0);
    expect(backfillIdx).toBeGreaterThan(writeIdx);
    expect(commitIdx).toBeGreaterThan(backfillIdx);
  });

  test("backfill SQL targets nex.food_business with idempotency guard", () => {
    const c = compileWritePlan(mergePlan());
    const stage = c.stages.find(
      (s) => s.label === "backfill_legacy_canonical_id",
    )!;
    expect(stage).toBeDefined();
    expect(stage.sql).toContain("UPDATE nex.food_business");
    expect(stage.sql).toContain("SET canonical_business_id = $1");
    expect(stage.sql).toContain("WHERE internal_id = $2");
    expect(stage.sql).toContain("AND canonical_business_id IS NULL");
    expect(stage.params).toEqual(["T1", "food-123"]);
    expect(stage.expects).toBe("any");
  });

  test("accommodation merge · backfill targets nex.accommodation_business via internal_id", () => {
    const plan = mergePlan({
      legacy_source: {
        table: "nex.accommodation_business",
        ref: "acc-ref-1",
        internal_id: "acc-1",
      },
    });
    const c = compileWritePlan(plan);
    const stage = c.stages.find(
      (s) => s.label === "backfill_legacy_canonical_id",
    )!;
    expect(stage).toBeDefined();
    expect(stage.sql).toContain("UPDATE nex.accommodation_business");
    expect(stage.sql).toContain("WHERE internal_id = $2");
    expect(stage.params).toEqual(["T1", "acc-1"]);
  });

  test("service merge · backfill targets nex.service_business via internal_id", () => {
    const plan = mergePlan({
      legacy_source: {
        table: "nex.service_business",
        ref: "svc-ref-1",
        internal_id: "svc-1",
      },
    });
    const c = compileWritePlan(plan);
    const stage = c.stages.find(
      (s) => s.label === "backfill_legacy_canonical_id",
    )!;
    expect(stage).toBeDefined();
    expect(stage.sql).toContain("UPDATE nex.service_business");
    expect(stage.sql).toContain("WHERE internal_id = $2");
  });

  test("mp_seller merge · backfill targets nex.mp_seller via seller_id (not internal_id)", () => {
    const plan = mergePlan({
      legacy_source: {
        table: "nex.mp_seller",
        ref: "mp-ref-1",
        internal_id: "mp-1",
      },
    });
    const c = compileWritePlan(plan);
    const stage = c.stages.find(
      (s) => s.label === "backfill_legacy_canonical_id",
    )!;
    expect(stage).toBeDefined();
    expect(stage.sql).toContain("UPDATE nex.mp_seller");
    expect(stage.sql).toContain("WHERE seller_id = $2");
  });

  test("transport merge · NO backfill stage (vertical lacks canonical_business_id)", () => {
    const plan = mergePlan({
      legacy_source: {
        table: "nex.transport_acquisition_record",
        ref: "tx-ref-1",
        internal_id: "tx-1",
      },
    });
    const c = compileWritePlan(plan);
    const labels = c.stages.map((s) => s.label);
    expect(labels).not.toContain("backfill_legacy_canonical_id");
  });

  test("unknown vertical · NO backfill stage (silent skip)", () => {
    const plan = mergePlan({
      legacy_source: {
        table: "nex.not_a_real_table",
        ref: "x",
        internal_id: "y",
      },
    });
    const c = compileWritePlan(plan);
    const labels = c.stages.map((s) => s.label);
    expect(labels).not.toContain("backfill_legacy_canonical_id");
  });

  test("merge with null internal_id · NO backfill stage (cannot locate row)", () => {
    const plan = mergePlan({
      legacy_source: {
        table: "nex.food_business",
        ref: "food-ref-no-id",
        internal_id: null,
      },
    });
    const c = compileWritePlan(plan);
    const labels = c.stages.map((s) => s.label);
    expect(labels).not.toContain("backfill_legacy_canonical_id");
  });

  test("INSERT path · NEVER emits backfill stage (new row has nothing to link)", () => {
    const c = compileWritePlan(insertPlan());
    const labels = c.stages.map((s) => s.label);
    expect(labels).not.toContain("backfill_legacy_canonical_id");
  });

  test("determinism · same merge plan compiles to byte-equal stages", () => {
    const plan = mergePlan();
    const a = compileWritePlan(plan);
    const b = compileWritePlan(plan);
    expect(a).toEqual(b);
  });

  test("compileWritePlan does not mutate the merge plan input", () => {
    const plan = mergePlan();
    const snap = JSON.stringify(plan);
    compileWritePlan(plan);
    expect(JSON.stringify(plan)).toBe(snap);
  });

  test("already-linked row · same SQL (idempotency enforced by WHERE guard, not compile)", () => {
    // The compile step cannot know whether the legacy row is already
    // linked · that's a DB-side truth. The SQL carries a
    // `WHERE canonical_business_id IS NULL` guard so a replay on an
    // already-linked row updates 0 rows (safe no-op). Compile emits
    // the same shape regardless of the real DB state.
    const planA = mergePlan();
    const planB = mergePlan();
    const compiledA = compileWritePlan(planA);
    const compiledB = compileWritePlan(planB);
    const stageA = compiledA.stages.find(
      (s) => s.label === "backfill_legacy_canonical_id",
    )!;
    const stageB = compiledB.stages.find(
      (s) => s.label === "backfill_legacy_canonical_id",
    )!;
    expect(stageA.sql).toBe(stageB.sql);
    expect(stageA.sql).toContain("AND canonical_business_id IS NULL");
  });
});
