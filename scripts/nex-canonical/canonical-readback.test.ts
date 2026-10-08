// scripts/nex-canonical/canonical-readback.test.ts
//
// Unit tests for the independent read-back verifier.
// Uses an in-memory ReadbackSession · no real pg · no credentials.

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import type {
  CanonicalWritePlan,
  HandoffEvidence,
  InsertCanonicalRow,
} from "./canonical-handoff";
import { EVIDENCE_SCHEMA_VERSION } from "./canonical-handoff";
import {
  buildFieldComparisons,
  verifyFirstWriteReadback,
  type ReadbackSession,
  type ReadbackSessionFactory,
} from "./canonical-readback";
import { isAbstained, isAnswered } from "./intelligence-result";

// ═════════════════════════════════════════════════════════════════════
// §0 · Fixtures
// ═════════════════════════════════════════════════════════════════════

function evidence(overrides: Partial<HandoffEvidence> = {}): HandoffEvidence {
  const base: HandoffEvidence = {
    schema_version: EVIDENCE_SCHEMA_VERSION,
    candidate_id: "cand-a",
    candidate_integrity_hash:
      "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    decision_record_id:
      "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    review_package_id:
      "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
    legacy_source: {
      table: "nex.food_business",
      ref: "ref-a",
      internal_id: null,
    },
    resolver_verdict_summary: {
      kind: "NO_MATCH",
      target_canonical_business_id: null,
      score: 0.1,
    },
    observation_provenance: {
      generator: "scripts/nex-canonical/generate-candidates.ts",
      generation_run_id: "run",
      generated_at: "2026-10-08T00:00:00.000Z",
      decision_timestamp: "2026-10-08T00:05:00.000Z",
      founder_id: "philip",
    },
    source_id: "nex.food_business",
  };
  return { ...base, ...overrides };
}

function insertRow(overrides: Partial<InsertCanonicalRow> = {}): InsertCanonicalRow {
  const base: InsertCanonicalRow = {
    entity_type: "food",
    country: "ID",
    lifecycle_state: "DISCOVERED",
    name_canonical: "Synthetic X",
    aliases: ["Alt"],
    phone_e164: null,
    website_apex: null,
    osm_id: null,
    wikidata_qid: null,
    city: "Bandung",
    district: null,
    // Migration 178 + address wiring · null in the shared fixture so
    // the sparse-row readback assertions continue to hold.
    street_line: null,
    neighbourhood: null,
    address: null,
    coordinates: null,
  };
  return { ...base, ...overrides };
}

function insertPlan(): CanonicalWritePlan {
  return { kind: "insert_new", row: insertRow(), evidence: evidence() };
}

/** Build a mock session factory that answers readback queries from a
 *  pre-built scenario. */
function makeFactory(scenario: {
  canonicalRow?: Record<string, unknown> | null;
  evidenceRow?: Record<string, unknown> | null;
  canonicalCount?: number;
  evidenceByCanonical?: number;
  evidenceByDecision?: number;
  openShouldFail?: boolean;
  queryShouldFailOn?: RegExp;
}): { factory: ReadbackSessionFactory; calls: string[] } {
  const calls: string[] = [];
  return {
    factory: {
      openSession: async () => {
        if (scenario.openShouldFail) throw new Error("open failed");
        const session: ReadbackSession = {
          id: "mock-readback",
          query: async <T>(sql: string): Promise<{ rows: readonly T[]; rowCount: number }> => {
            calls.push(sql);
            if (scenario.queryShouldFailOn && scenario.queryShouldFailOn.test(sql)) {
              throw new Error("mock readback failure");
            }
            // Check COUNT queries FIRST · they share "FROM nex.business_canonical
            // WHERE canonical_business_id" with the row-fetch, so order matters.
            if (/^SELECT COUNT.*FROM nex\.business_canonical/.test(sql)) {
              return {
                rows: [{ count: String(scenario.canonicalCount ?? 1) }] as unknown as readonly T[],
                rowCount: 1,
              };
            }
            if (/^SELECT COUNT.*FROM nex\.business_evidence\s+WHERE canonical_business_id/.test(sql)) {
              return {
                rows: [{ count: String(scenario.evidenceByCanonical ?? 1) }] as unknown as readonly T[],
                rowCount: 1,
              };
            }
            if (/^SELECT COUNT.*FROM nex\.business_evidence\s+WHERE decision_record_id/.test(sql)) {
              return {
                rows: [{ count: String(scenario.evidenceByDecision ?? 1) }] as unknown as readonly T[],
                rowCount: 1,
              };
            }
            if (/^SELECT canonical_business_id,/.test(sql)) {
              const row = scenario.canonicalRow;
              return { rows: (row ? [row] : []) as readonly T[], rowCount: row ? 1 : 0 };
            }
            if (/^SELECT evidence_id,/.test(sql)) {
              const row = scenario.evidenceRow;
              return { rows: (row ? [row] : []) as readonly T[], rowCount: row ? 1 : 0 };
            }
            return { rows: [] as readonly T[], rowCount: 0 };
          },
        };
        return session;
      },
      closeSession: async () => {},
    },
    calls,
  };
}

// ═════════════════════════════════════════════════════════════════════
// §1 · buildFieldComparisons · pure field equality
// ═════════════════════════════════════════════════════════════════════

describe("buildFieldComparisons", () => {
  const plan = insertPlan();

  test("all fields match when canonical + evidence rows mirror the plan", () => {
    const canonicalRow = {
      canonical_business_id: "canon-1",
      entity_type: "food",
      country: "ID",
      lifecycle_state: "DISCOVERED",
      name_canonical: "Synthetic X",
      name_norm: "synthetic x",
      aliases: ["Alt"],
      phone_e164: null,
      website_apex: null,
      osm_id: null,
      wikidata_qid: null,
      city: "Bandung",
      district: null,
      // Migration 178 + address wiring · mirror the sparse plan.row.
      street_line: null,
      neighbourhood: null,
      address: null,
    };
    const evidenceRow = {
      evidence_id: "ev-1",
      canonical_business_id: "canon-1",
      schema_version: EVIDENCE_SCHEMA_VERSION,
      candidate_id: "cand-a",
      candidate_integrity_hash:
        "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      decision_record_id:
        "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      review_package_id:
        "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
      legacy_source_table: "nex.food_business",
      legacy_source_ref: "ref-a",
      legacy_source_internal_id: null,
      resolver_verdict_kind: "NO_MATCH",
      resolver_target_id: null,
      resolver_score: 0.1,
      observation_generator: "scripts/nex-canonical/generate-candidates.ts",
      observation_run_id: "run",
      observation_founder_id: "philip",
      source_id: "nex.food_business",
    };
    const comps = buildFieldComparisons(plan, canonicalRow, evidenceRow);
    for (const c of comps) {
      expect(c.match).toBe(true);
    }
  });

  test("name_canonical mismatch flags that specific field", () => {
    const comps = buildFieldComparisons(
      plan,
      {
        canonical_business_id: "canon-1",
        entity_type: "food",
        country: "ID",
        lifecycle_state: "DISCOVERED",
        name_canonical: "DIFFERENT",
        aliases: ["Alt"],
        phone_e164: null,
        website_apex: null,
        osm_id: null,
        wikidata_qid: null,
        city: "Bandung",
        district: null,
      },
      null,
    );
    const nameComp = comps.find((c) => c.field === "canonical.name_canonical");
    expect(nameComp?.match).toBe(false);
  });

  test("resolver_score · numeric string from DB equals numeric from plan", () => {
    const row = {
      canonical_business_id: "canon-1",
      entity_type: "food",
      country: "ID",
      lifecycle_state: "DISCOVERED",
      name_canonical: "Synthetic X",
      aliases: ["Alt"],
      phone_e164: null,
      website_apex: null,
      osm_id: null,
      wikidata_qid: null,
      city: "Bandung",
      district: null,
    };
    const evRow = {
      candidate_id: "cand-a",
      candidate_integrity_hash:
        "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      decision_record_id:
        "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      review_package_id:
        "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
      schema_version: EVIDENCE_SCHEMA_VERSION,
      legacy_source_table: "nex.food_business",
      legacy_source_ref: "ref-a",
      legacy_source_internal_id: null,
      resolver_verdict_kind: "NO_MATCH",
      resolver_target_id: null,
      resolver_score: "0.1", // DB returns as text (via ::text cast); numericEqual tolerates
      observation_generator: "scripts/nex-canonical/generate-candidates.ts",
      observation_run_id: "run",
      observation_founder_id: "philip",
      source_id: "nex.food_business",
    };
    const comps = buildFieldComparisons(plan, row, evRow);
    const scoreComp = comps.find((c) => c.field === "evidence.resolver_score")!;
    expect(scoreComp.match).toBe(true);
  });

  test("null expected matches undefined observed (DB NULL semantics)", () => {
    const row = {
      canonical_business_id: "canon-1",
      entity_type: "food",
      country: "ID",
      lifecycle_state: "DISCOVERED",
      name_canonical: "Synthetic X",
      aliases: ["Alt"],
      phone_e164: null,
      website_apex: null,
      osm_id: null,
      wikidata_qid: null,
      city: "Bandung",
      district: null,
    };
    const evRow = {
      candidate_id: "cand-a",
      candidate_integrity_hash:
        "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      decision_record_id:
        "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      review_package_id:
        "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
      schema_version: EVIDENCE_SCHEMA_VERSION,
      legacy_source_table: "nex.food_business",
      legacy_source_ref: "ref-a",
      resolver_verdict_kind: "NO_MATCH",
      resolver_target_id: null,
      resolver_score: 0.1,
      observation_generator: "scripts/nex-canonical/generate-candidates.ts",
      observation_run_id: "run",
      observation_founder_id: "philip",
      source_id: "nex.food_business",
    };
    const comps = buildFieldComparisons(plan, row, evRow);
    const internalComp = comps.find((c) => c.field === "evidence.legacy_source_internal_id")!;
    expect(internalComp.match).toBe(true);
  });
});

// ═════════════════════════════════════════════════════════════════════
// §2 · verifyFirstWriteReadback · flow
// ═════════════════════════════════════════════════════════════════════

describe("verifyFirstWriteReadback", () => {
  test("happy path · all rows found · all fields match · no duplicates", async () => {
    const plan = insertPlan();
    const { factory } = makeFactory({
      canonicalRow: {
        canonical_business_id: "canon-1",
        entity_type: "food",
        country: "ID",
        lifecycle_state: "DISCOVERED",
        name_canonical: "Synthetic X",
        aliases: ["Alt"],
        phone_e164: null,
        website_apex: null,
        osm_id: null,
        wikidata_qid: null,
        city: "Bandung",
        district: null,
        // Migration 178 + address wiring · mirror the sparse plan.row.
        street_line: null,
        neighbourhood: null,
        address: null,
      },
      evidenceRow: {
        evidence_id: "ev-1",
        canonical_business_id: "canon-1",
        schema_version: EVIDENCE_SCHEMA_VERSION,
        candidate_id: "cand-a",
        candidate_integrity_hash:
          "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        decision_record_id:
          "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
        review_package_id:
          "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
        legacy_source_table: "nex.food_business",
        legacy_source_ref: "ref-a",
        legacy_source_internal_id: null,
        resolver_verdict_kind: "NO_MATCH",
        resolver_target_id: null,
        resolver_score: 0.1,
        observation_generator: "scripts/nex-canonical/generate-candidates.ts",
        observation_run_id: "run",
        observation_founder_id: "philip",
        source_id: "nex.food_business",
      },
      canonicalCount: 1,
      evidenceByCanonical: 1,
      evidenceByDecision: 1,
    });
    const r = await verifyFirstWriteReadback({
      session_factory: factory,
      plan,
      canonical_business_id: "canon-1",
      evidence_id: "ev-1",
    });
    expect(isAnswered(r)).toBe(true);
    if (isAnswered(r)) {
      expect(r.value.canonical_row_found).toBe(true);
      expect(r.value.evidence_row_found).toBe(true);
      expect(r.value.all_fields_match).toBe(true);
      expect(r.value.no_duplicates).toBe(true);
    }
  });

  test("canonical row missing · flagged · all_fields_match=false", async () => {
    const plan = insertPlan();
    const { factory } = makeFactory({
      canonicalRow: null,
      evidenceRow: null,
      canonicalCount: 0,
      evidenceByCanonical: 0,
      evidenceByDecision: 0,
    });
    const r = await verifyFirstWriteReadback({
      session_factory: factory,
      plan,
      canonical_business_id: "missing",
      evidence_id: "missing",
    });
    if (isAnswered(r)) {
      expect(r.value.canonical_row_found).toBe(false);
      expect(r.value.evidence_row_found).toBe(false);
      expect(r.value.all_fields_match).toBe(false);
      expect(r.value.no_duplicates).toBe(false);
    }
  });

  test("duplicate rows · no_duplicates=false", async () => {
    const plan = insertPlan();
    const { factory } = makeFactory({
      canonicalRow: {
        canonical_business_id: "canon-1",
        entity_type: "food",
        country: "ID",
        lifecycle_state: "DISCOVERED",
        name_canonical: "Synthetic X",
        aliases: ["Alt"],
        phone_e164: null,
        website_apex: null,
        osm_id: null,
        wikidata_qid: null,
        city: "Bandung",
        district: null,
        // Migration 178 + address wiring · mirror the sparse plan.row.
        street_line: null,
        neighbourhood: null,
        address: null,
      },
      evidenceRow: {
        evidence_id: "ev-1",
        canonical_business_id: "canon-1",
        schema_version: EVIDENCE_SCHEMA_VERSION,
        candidate_id: "cand-a",
        candidate_integrity_hash:
          "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        decision_record_id:
          "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
        review_package_id:
          "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
        legacy_source_table: "nex.food_business",
        legacy_source_ref: "ref-a",
        legacy_source_internal_id: null,
        resolver_verdict_kind: "NO_MATCH",
        resolver_target_id: null,
        resolver_score: 0.1,
        observation_generator: "scripts/nex-canonical/generate-candidates.ts",
        observation_run_id: "run",
        observation_founder_id: "philip",
        source_id: "nex.food_business",
      },
      canonicalCount: 1,
      evidenceByCanonical: 2, // DUPLICATE
      evidenceByDecision: 2,
    });
    const r = await verifyFirstWriteReadback({
      session_factory: factory,
      plan,
      canonical_business_id: "canon-1",
      evidence_id: "ev-1",
    });
    if (isAnswered(r)) {
      expect(r.value.no_duplicates).toBe(false);
    }
  });

  test("open failure → abstained(readback_session_open_failed)", async () => {
    const plan = insertPlan();
    const { factory } = makeFactory({ openShouldFail: true });
    const r = await verifyFirstWriteReadback({
      session_factory: factory,
      plan,
      canonical_business_id: "canon-1",
      evidence_id: "ev-1",
    });
    expect(isAbstained(r)).toBe(true);
    if (isAbstained(r)) {
      expect(r.reason.code).toBe("readback_session_open_failed");
    }
  });

  test("query failure mid-readback → abstained(readback_query_failed)", async () => {
    const plan = insertPlan();
    const { factory } = makeFactory({
      queryShouldFailOn: /COUNT.*FROM nex\.business_canonical/,
    });
    const r = await verifyFirstWriteReadback({
      session_factory: factory,
      plan,
      canonical_business_id: "canon-1",
      evidence_id: "ev-1",
    });
    expect(isAbstained(r)).toBe(true);
    if (isAbstained(r)) {
      expect(r.reason.code).toBe("readback_query_failed");
    }
  });
});

// ═════════════════════════════════════════════════════════════════════
// §3 · Pure-module grep invariants
// ═════════════════════════════════════════════════════════════════════

describe("canonical-readback source · pure invariants", () => {
  const srcPath = path.join(__dirname, "canonical-readback.ts");
  const src = fs.readFileSync(srcPath, "utf8");
  const code = src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/[^\n]*/g, "");

  test("verifier does NOT invoke the write executor", () => {
    expect(code).not.toMatch(/\bexecuteWritePlan\s*\(/);
    expect(code).not.toMatch(/\bresolveCanonical\s*\(/);
    expect(code).not.toMatch(/\bprecheckHandoff\s*\(/);
  });

  test("verifier does NOT issue INSERT / UPDATE / DELETE / DDL", () => {
    expect(code).not.toMatch(/\bINSERT\s+INTO\b/i);
    expect(code).not.toMatch(/\bUPDATE\s+\w+\s+SET\b/i);
    expect(code).not.toMatch(/\bDELETE\s+FROM\b/i);
    expect(code).not.toMatch(/\bCREATE\s+TABLE\b/i);
    expect(code).not.toMatch(/\bALTER\s+TABLE\b/i);
    expect(code).not.toMatch(/\bDROP\s+TABLE\b/i);
    expect(code).not.toMatch(/\bTRUNCATE\b/i);
  });

  test("verifier does NOT invoke the resolver or Layer A", () => {
    expect(code).not.toMatch(/identity-matching/);
    expect(code).not.toMatch(/entity-universe/);
    expect(code).not.toMatch(/\bmatchBusiness\s*\(/);
  });

  test("verifier applies session-level read-only on open", () => {
    expect(code).toMatch(/SET default_transaction_read_only = on/);
  });

  test("verifier does NOT use clock / randomness", () => {
    expect(code).not.toMatch(/\bnew\s+Date\b/);
    expect(code).not.toMatch(/\bDate\.now\b/);
    expect(code).not.toMatch(/\bMath\.random\b/);
    expect(code).not.toMatch(/\brandomUUID\b/);
    expect(code).not.toMatch(/\brandomBytes\b/);
  });
});
