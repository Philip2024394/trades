// scripts/nex-canonical/execute-write-plan.test.ts
//
// Pure/mock-session unit tests for executeWritePlan.
// No real pg Client. No DB. No network. No credentials.

import { describe, expect, test } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import type {
  CanonicalWritePlan,
  HandoffEvidence,
  InsertCanonicalRow,
} from "./canonical-handoff";
import { EVIDENCE_SCHEMA_VERSION } from "./canonical-handoff";
import {
  DEFAULT_WRITE_EXECUTOR_CONFIG,
  compileWritePlan,
  executeWritePlan,
  type CompiledWritePlan,
  type ExpectedFingerprint,
  type WriteExecutionReport,
  type WriteSession,
  type WriteSessionFactory,
} from "./execute-write-plan";
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
    legacy_source: { table: "nex.food_business", ref: "ref-a", internal_id: null },
    resolver_verdict_summary: {
      kind: "NO_MATCH",
      target_canonical_business_id: null,
      score: 0.1,
    },
    observation_provenance: {
      generator: "scripts/nex-canonical/generate-candidates.ts",
      generation_run_id: "test-run",
      generated_at: "2026-10-08T12:00:00.000Z",
      decision_timestamp: "2026-10-08T12:05:00.000Z",
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
  return { ...base, ...overrides };
}

function insertPlan(
  rowOverrides: Partial<InsertCanonicalRow> = {},
  evidenceOverrides: Partial<HandoffEvidence> = {},
): CanonicalWritePlan {
  return {
    kind: "insert_new",
    row: insertRow(rowOverrides),
    evidence: evidence({
      resolver_verdict_summary: {
        kind: "NO_MATCH",
        target_canonical_business_id: null,
        score: 0.1,
      },
      ...evidenceOverrides,
    }),
  };
}

function mergePlan(
  targetId = "00000000-0000-0000-0000-000000000001",
  overrides: Partial<HandoffEvidence> = {},
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

const expectedFP: ExpectedFingerprint = {
  database: "nex_business",
  user: "nex_rw",
  serverVersionPrefix: "15.",
  schemas: ["nex", "public"],
};

// ═════════════════════════════════════════════════════════════════════
// §0.5 · Mock session
// ═════════════════════════════════════════════════════════════════════

interface MockCall {
  readonly sql: string;
  readonly params: readonly unknown[];
}

interface MockSessionConfig {
  readonly responses?: Map<string | RegExp, { rows: unknown[]; error?: Error }>;
  readonly openShouldFail?: boolean;
  readonly closeShouldFail?: boolean;
}

function createMockFactory(config: MockSessionConfig = {}): {
  factory: WriteSessionFactory;
  calls: MockCall[];
  openCount: () => number;
  closeCount: () => number;
} {
  const calls: MockCall[] = [];
  let opens = 0;
  let closes = 0;

  const factory: WriteSessionFactory = {
    openSession: async () => {
      opens++;
      if (config.openShouldFail) throw new Error("mock open failure");
      const session: WriteSession = {
        id: `mock-${opens}`,
        async query(sql, params) {
          calls.push({ sql, params });
          // Static exact-match responses.
          if (config.responses) {
            for (const [key, resp] of config.responses.entries()) {
              const match =
                typeof key === "string" ? sql === key : key.test(sql);
              if (match) {
                if (resp.error) throw resp.error;
                return {
                  rows: resp.rows as readonly Record<string, unknown>[],
                  rowCount: resp.rows.length,
                };
              }
            }
          }
          return { rows: [], rowCount: 0 };
        },
      };
      return session;
    },
    closeSession: async () => {
      closes++;
      if (config.closeShouldFail) throw new Error("mock close failure");
    },
  };
  return { factory, calls, openCount: () => opens, closeCount: () => closes };
}

/** Build a response set that produces a successful insert_new. */
function responsesForInsertNewHappy(opts: {
  canonicalId: string;
  evidenceId: string;
  omitOsmPrecheck?: boolean;
}): Map<string | RegExp, { rows: unknown[] }> {
  const m = new Map<string | RegExp, { rows: unknown[] }>();
  m.set(/^SELECT current_database\(\)/, { rows: [{ db: "nex_business" }] });
  m.set(/^SELECT current_user AS usr/, { rows: [{ usr: "nex_rw" }] });
  m.set(/^SELECT current_setting\('server_version'\)/, {
    rows: [{ srv_version: "15.4" }],
  });
  m.set(/^SELECT schema_name FROM information_schema/, {
    rows: [{ schema_name: "nex" }, { schema_name: "public" }],
  });
  if (!opts.omitOsmPrecheck) {
    // OSM precheck returns no rows → no collision.
    m.set(/FROM nex\.business_canonical\s+WHERE country = \$1 AND osm_id/, {
      rows: [],
    });
  }
  // Compound write.
  m.set(/^WITH ic AS \(/, {
    rows: [
      {
        evidence_id: opts.evidenceId,
        canonical_business_id: opts.canonicalId,
      },
    ],
  });
  return m;
}

function responsesForMergeMatchHappy(opts: {
  targetId: string;
  evidenceId: string;
  lifecycleState?: string;
  supersededBy?: string | null;
}): Map<string | RegExp, { rows: unknown[] }> {
  const m = new Map<string | RegExp, { rows: unknown[] }>();
  m.set(/^SELECT current_database\(\)/, { rows: [{ db: "nex_business" }] });
  m.set(/^SELECT current_user AS usr/, { rows: [{ usr: "nex_rw" }] });
  m.set(/^SELECT current_setting\('server_version'\)/, {
    rows: [{ srv_version: "15.4" }],
  });
  m.set(/^SELECT schema_name FROM information_schema/, {
    rows: [{ schema_name: "nex" }, { schema_name: "public" }],
  });
  m.set(
    /SELECT canonical_business_id, lifecycle_state, superseded_by_business_id/,
    {
      rows: [
        {
          canonical_business_id: opts.targetId,
          lifecycle_state: opts.lifecycleState ?? "VERIFIED",
          superseded_by_business_id: opts.supersededBy ?? null,
        },
      ],
    },
  );
  m.set(/^INSERT INTO nex\.business_evidence/, {
    rows: [
      {
        evidence_id: opts.evidenceId,
        canonical_business_id: opts.targetId,
      },
    ],
  });
  return m;
}

// ═════════════════════════════════════════════════════════════════════
// §1 · compileWritePlan · structural tests
// ═════════════════════════════════════════════════════════════════════

describe("compileWritePlan · structure", () => {
  test("insert_new · first stage is BEGIN SERIALIZABLE", () => {
    const c = compileWritePlan(insertPlan());
    expect(c.stages[0].label).toBe("begin");
    expect(c.stages[0].sql).toContain("BEGIN TRANSACTION ISOLATION LEVEL SERIALIZABLE");
  });

  test("insert_new · last stage is COMMIT", () => {
    const c = compileWritePlan(insertPlan());
    expect(c.stages[c.stages.length - 1].label).toBe("commit");
    expect(c.stages[c.stages.length - 1].sql).toContain("COMMIT");
  });

  test("fingerprint stages · all four FINGERPRINT_QUERIES appear in order", () => {
    const c = compileWritePlan(insertPlan());
    const labels = c.stages.map((s) => s.label);
    const fp = labels.filter((l) => l.startsWith("fingerprint_"));
    expect(fp).toEqual([
      "fingerprint_database",
      "fingerprint_user",
      "fingerprint_server_version",
      "fingerprint_schemas",
    ]);
  });

  test("insert_new with osm_id · precheck_osm_uniqueness appears before write", () => {
    const c = compileWritePlan(insertPlan({ osm_id: "node/42" }));
    const labels = c.stages.map((s) => s.label);
    const osmIdx = labels.indexOf("precheck_osm_uniqueness");
    const writeIdx = labels.indexOf("write");
    expect(osmIdx).toBeGreaterThan(0);
    expect(writeIdx).toBeGreaterThan(osmIdx);
  });

  test("insert_new without osm_id · NO precheck_osm_uniqueness stage", () => {
    const c = compileWritePlan(insertPlan({ osm_id: null }));
    const labels = c.stages.map((s) => s.label);
    expect(labels).not.toContain("precheck_osm_uniqueness");
  });

  test("insert_new · write stage uses a WITH … INSERT INTO nex.business_canonical … INSERT INTO nex.business_evidence CTE", () => {
    const c = compileWritePlan(insertPlan());
    const writeStage = c.stages.find((s) => s.label === "write")!;
    expect(writeStage.sql).toContain("WITH ic AS");
    expect(writeStage.sql).toContain("INSERT INTO nex.business_canonical");
    expect(writeStage.sql).toContain("INSERT INTO nex.business_evidence");
    expect(writeStage.sql).toContain("RETURNING canonical_business_id");
    expect(writeStage.sql).toContain(
      "RETURNING evidence_id, canonical_business_id",
    );
  });

  test("insert_new · lifecycle_state is hardcoded 'DISCOVERED' in canonical insert", () => {
    const c = compileWritePlan(insertPlan());
    const writeStage = c.stages.find((s) => s.label === "write")!;
    expect(writeStage.sql).toContain("'DISCOVERED'");
  });

  test("merge_match · precheck_target_writable appears before write", () => {
    const c = compileWritePlan(mergePlan("T1"));
    const labels = c.stages.map((s) => s.label);
    expect(labels.indexOf("precheck_target_writable")).toBeGreaterThan(0);
    expect(labels.indexOf("write")).toBeGreaterThan(
      labels.indexOf("precheck_target_writable"),
    );
  });

  test("merge_match · write stage is evidence-only INSERT", () => {
    const c = compileWritePlan(mergePlan("T1"));
    const writeStage = c.stages.find((s) => s.label === "write")!;
    expect(writeStage.sql).toContain("INSERT INTO nex.business_evidence");
    expect(writeStage.sql).not.toContain("INSERT INTO nex.business_canonical");
    expect(writeStage.sql).toContain("RETURNING evidence_id, canonical_business_id");
  });

  test("merge_match · precheck SELECT uses FOR UPDATE", () => {
    const c = compileWritePlan(mergePlan("T1"));
    const stage = c.stages.find((s) => s.label === "precheck_target_writable")!;
    expect(stage.sql).toContain("FOR UPDATE");
  });

  test("insert_new OSM precheck · SELECT uses FOR UPDATE", () => {
    const c = compileWritePlan(insertPlan({ osm_id: "node/42" }));
    const stage = c.stages.find((s) => s.label === "precheck_osm_uniqueness")!;
    expect(stage.sql).toContain("FOR UPDATE");
  });

  test("determinism · same plan compiles to byte-equal stages", () => {
    const plan = insertPlan({ osm_id: "node/42" });
    const a = compileWritePlan(plan);
    const b = compileWritePlan(plan);
    expect(a).toEqual(b);
  });

  test("compileWritePlan does not mutate its input plan", () => {
    const plan = insertPlan({ osm_id: "node/42" });
    const snap = JSON.stringify(plan);
    compileWritePlan(plan);
    expect(JSON.stringify(plan)).toBe(snap);
  });

  test("SET LOCAL statement_timeout uses the configured value", () => {
    const c = compileWritePlan(insertPlan(), {
      statementTimeoutMs: 45000,
      idleInTransactionTimeoutMs: 90000,
    });
    const s = c.stages.find((x) => x.label === "set_statement_timeout")!;
    const i = c.stages.find((x) => x.label === "set_idle_timeout")!;
    expect(s.sql).toContain("45000");
    expect(i.sql).toContain("90000");
  });
});

// ═════════════════════════════════════════════════════════════════════
// §2 · compileWritePlan · parameter layout
// ═════════════════════════════════════════════════════════════════════

describe("compileWritePlan · parameter layout", () => {
  test("insert_new write stage · 29 params in documented order", () => {
    const plan = insertPlan({
      entity_type: "food",
      country: "ID",
      name_canonical: "Test Name",
      aliases: ["alt1", "alt2"],
      phone_e164: "+6281234567890",
      website_apex: "test.id",
      osm_id: "node/42",
      wikidata_qid: "Q1",
      city: "Bandung",
      district: "D",
      coordinates: { lat: -6.9, lng: 107.6 },
    });
    const c = compileWritePlan(plan);
    const write = c.stages.find((s) => s.label === "write")!;
    expect(write.params.length).toBe(29);
    expect(write.params[0]).toBe("food"); // entity_type
    expect(write.params[1]).toBe("ID");   // country
    expect(write.params[2]).toBe("Test Name"); // name_canonical
    expect(write.params[3]).toEqual(["alt1", "alt2"]); // aliases
    expect(write.params[6]).toBe("node/42"); // osm_id
    expect(write.params[10]).toBe(-6.9);  // coord_lat
    expect(write.params[11]).toBe(107.6); // coord_lng
    expect(write.params[12]).toBe(EVIDENCE_SCHEMA_VERSION); // schema_version
    expect(write.params[20]).toBe("NO_MATCH"); // resolver_verdict_kind
    expect(write.params[21]).toBeNull(); // resolver_target_id
  });

  test("merge_match write stage · 18 params · canonical_business_id = target", () => {
    const plan = mergePlan("T1");
    const c = compileWritePlan(plan);
    const write = c.stages.find((s) => s.label === "write")!;
    expect(write.params.length).toBe(18);
    expect(write.params[0]).toBe("T1"); // canonical_business_id
    expect(write.params[1]).toBe(EVIDENCE_SCHEMA_VERSION);
    expect(write.params[9]).toBe("MATCH"); // resolver_verdict_kind
    expect(write.params[10]).toBe("T1");   // resolver_target_id = target
  });

  test("insert_new with null coordinates · lat/lng params are null (DB produces NULL geography)", () => {
    const plan = insertPlan({ coordinates: null });
    const c = compileWritePlan(plan);
    const write = c.stages.find((s) => s.label === "write")!;
    expect(write.params[10]).toBeNull();
    expect(write.params[11]).toBeNull();
  });

  test("OSM precheck · params carry country then osm_id", () => {
    const plan = insertPlan({ country: "ID", osm_id: "node/42" });
    const c = compileWritePlan(plan);
    const osm = c.stages.find((s) => s.label === "precheck_osm_uniqueness")!;
    expect(osm.params).toEqual(["ID", "node/42"]);
  });
});

// ═════════════════════════════════════════════════════════════════════
// §3 · executeWritePlan · insert_new happy path
// ═════════════════════════════════════════════════════════════════════

describe("executeWritePlan · insert_new happy path", () => {
  test("completes · returns new canonical + evidence ids", async () => {
    const { factory, calls } = createMockFactory({
      responses: responsesForInsertNewHappy({
        canonicalId: "new-canonical-id",
        evidenceId: "new-evidence-id",
      }),
    });
    const r = await executeWritePlan({
      plan: insertPlan(),
      session_factory: factory,
      expected_fingerprint: expectedFP,
    });
    expect(isAnswered(r)).toBe(true);
    if (isAnswered(r)) {
      expect(r.value.kind).toBe("insert_new");
      expect(r.value.canonical_business_id).toBe("new-canonical-id");
      expect(r.value.evidence_id).toBe("new-evidence-id");
    }
    // All stages ran · check the final one was COMMIT.
    expect(calls[calls.length - 1].sql).toContain("COMMIT");
  });

  test("fingerprint queries ran BEFORE the write INSERT", async () => {
    const { factory, calls } = createMockFactory({
      responses: responsesForInsertNewHappy({
        canonicalId: "N",
        evidenceId: "E",
      }),
    });
    await executeWritePlan({
      plan: insertPlan(),
      session_factory: factory,
      expected_fingerprint: expectedFP,
    });
    const idxDbFp = calls.findIndex((c) => /current_database/.test(c.sql));
    const idxInsert = calls.findIndex((c) =>
      /INSERT INTO nex\.business_canonical/.test(c.sql),
    );
    expect(idxDbFp).toBeGreaterThanOrEqual(0);
    expect(idxInsert).toBeGreaterThan(idxDbFp);
  });

  test("exactly one session opened and closed", async () => {
    const { factory, openCount, closeCount } = createMockFactory({
      responses: responsesForInsertNewHappy({ canonicalId: "N", evidenceId: "E" }),
    });
    await executeWritePlan({
      plan: insertPlan(),
      session_factory: factory,
      expected_fingerprint: expectedFP,
    });
    expect(openCount()).toBe(1);
    expect(closeCount()).toBe(1);
  });

  test("canonical_business_id captured from write RETURNING propagates into report", async () => {
    const { factory } = createMockFactory({
      responses: responsesForInsertNewHappy({
        canonicalId: "99999999-9999-9999-9999-999999999999",
        evidenceId: "ee",
      }),
    });
    const r = await executeWritePlan({
      plan: insertPlan(),
      session_factory: factory,
      expected_fingerprint: expectedFP,
    });
    if (isAnswered(r)) {
      expect(r.value.canonical_business_id).toBe(
        "99999999-9999-9999-9999-999999999999",
      );
    }
  });
});

// ═════════════════════════════════════════════════════════════════════
// §4 · executeWritePlan · merge_match happy path
// ═════════════════════════════════════════════════════════════════════

describe("executeWritePlan · merge_match happy path", () => {
  test("completes · evidence references target_canonical_business_id", async () => {
    const target = "11111111-1111-1111-1111-111111111111";
    const { factory, calls } = createMockFactory({
      responses: responsesForMergeMatchHappy({ targetId: target, evidenceId: "ev" }),
    });
    const r = await executeWritePlan({
      plan: mergePlan(target),
      session_factory: factory,
      expected_fingerprint: expectedFP,
    });
    expect(isAnswered(r)).toBe(true);
    if (isAnswered(r)) {
      expect(r.value.kind).toBe("merge_match");
      expect(r.value.canonical_business_id).toBe(target);
    }
    // No INSERT INTO business_canonical was issued.
    const canonicalInsertFired = calls.some((c) =>
      /INSERT INTO nex\.business_canonical/.test(c.sql),
    );
    expect(canonicalInsertFired).toBe(false);
  });

  test("precheck target_writable runs BEFORE evidence INSERT", async () => {
    const target = "T1";
    const { factory, calls } = createMockFactory({
      responses: responsesForMergeMatchHappy({ targetId: target, evidenceId: "ev" }),
    });
    await executeWritePlan({
      plan: mergePlan(target),
      session_factory: factory,
      expected_fingerprint: expectedFP,
    });
    const idxPrecheck = calls.findIndex((c) => /FOR UPDATE/.test(c.sql));
    const idxInsert = calls.findIndex((c) =>
      /INSERT INTO nex\.business_evidence/.test(c.sql),
    );
    expect(idxPrecheck).toBeGreaterThanOrEqual(0);
    expect(idxInsert).toBeGreaterThan(idxPrecheck);
  });
});

// ═════════════════════════════════════════════════════════════════════
// §5 · Fingerprint failure branches
// ═════════════════════════════════════════════════════════════════════

describe("executeWritePlan · fingerprint failures", () => {
  async function runWithFingerprint(
    overrides: Partial<{
      db: string;
      usr: string;
      srv_version: string;
      schemas: readonly string[];
    }>,
  ) {
    const responses = new Map<string | RegExp, { rows: unknown[] }>();
    responses.set(/^SELECT current_database\(\)/, {
      rows: [{ db: overrides.db ?? "nex_business" }],
    });
    responses.set(/^SELECT current_user AS usr/, {
      rows: [{ usr: overrides.usr ?? "nex_rw" }],
    });
    responses.set(/^SELECT current_setting\('server_version'\)/, {
      rows: [{ srv_version: overrides.srv_version ?? "15.4" }],
    });
    responses.set(/^SELECT schema_name FROM information_schema/, {
      rows: (overrides.schemas ?? ["nex", "public"]).map((s) => ({
        schema_name: s,
      })),
    });
    const { factory, calls } = createMockFactory({ responses });
    const r = await executeWritePlan({
      plan: insertPlan(),
      session_factory: factory,
      expected_fingerprint: expectedFP,
    });
    return { r, calls };
  }

  test("wrong database → abstained(fingerprint_mismatch) · no write · ROLLBACK issued", async () => {
    const { r, calls } = await runWithFingerprint({ db: "WRONG" });
    expect(isAbstained(r)).toBe(true);
    if (isAbstained(r)) {
      expect(r.reason.code).toBe("fingerprint_mismatch");
    }
    const insertFired = calls.some((c) =>
      /INSERT INTO nex\.business_canonical|INSERT INTO nex\.business_evidence/.test(
        c.sql,
      ),
    );
    expect(insertFired).toBe(false);
    const rollback = calls.some((c) => c.sql === "ROLLBACK");
    expect(rollback).toBe(true);
  });

  test("wrong user → abstained(fingerprint_mismatch)", async () => {
    const { r } = await runWithFingerprint({ usr: "wrong_user" });
    expect(isAbstained(r)).toBe(true);
  });

  test("wrong server_version prefix → abstained(fingerprint_mismatch)", async () => {
    const { r } = await runWithFingerprint({ srv_version: "14.9" });
    expect(isAbstained(r)).toBe(true);
  });

  test("missing required schema → abstained(fingerprint_mismatch)", async () => {
    const { r } = await runWithFingerprint({ schemas: ["public"] });
    expect(isAbstained(r)).toBe(true);
  });
});

// ═════════════════════════════════════════════════════════════════════
// §6 · OSM collision precheck
// ═════════════════════════════════════════════════════════════════════

describe("executeWritePlan · OSM collision precheck", () => {
  test("precheck returns a row → abstained · no canonical/evidence INSERT", async () => {
    const responses = responsesForInsertNewHappy({
      canonicalId: "N",
      evidenceId: "E",
      omitOsmPrecheck: true,
    });
    responses.set(/FROM nex\.business_canonical\s+WHERE country = \$1 AND osm_id/, {
      rows: [{ canonical_business_id: "EXISTING" }],
    });
    const { factory, calls } = createMockFactory({ responses });
    const r = await executeWritePlan({
      plan: insertPlan({ osm_id: "node/42" }),
      session_factory: factory,
      expected_fingerprint: expectedFP,
    });
    expect(isAbstained(r)).toBe(true);
    if (isAbstained(r)) {
      expect(r.reason.code).toBe("osm_uniqueness_collision");
    }
    const canonicalInsert = calls.some((c) =>
      /INSERT INTO nex\.business_canonical/.test(c.sql),
    );
    expect(canonicalInsert).toBe(false);
  });
});

// ═════════════════════════════════════════════════════════════════════
// §7 · merge_match target precheck failures
// ═════════════════════════════════════════════════════════════════════

describe("executeWritePlan · merge_match target precheck failures", () => {
  test("lifecycle DORMANT → abstained(target_not_writable) · no evidence INSERT", async () => {
    const target = "T1";
    const responses = responsesForMergeMatchHappy({
      targetId: target,
      evidenceId: "E",
      lifecycleState: "DORMANT",
    });
    const { factory, calls } = createMockFactory({ responses });
    const r = await executeWritePlan({
      plan: mergePlan(target),
      session_factory: factory,
      expected_fingerprint: expectedFP,
    });
    expect(isAbstained(r)).toBe(true);
    if (isAbstained(r)) {
      expect(r.reason.code).toBe("target_not_writable");
    }
    const insertFired = calls.some((c) =>
      /INSERT INTO nex\.business_evidence/.test(c.sql),
    );
    expect(insertFired).toBe(false);
  });

  test("lifecycle SUPERSEDED → abstained(target_not_writable)", async () => {
    const target = "T1";
    const responses = responsesForMergeMatchHappy({
      targetId: target,
      evidenceId: "E",
      lifecycleState: "SUPERSEDED",
    });
    const { factory } = createMockFactory({ responses });
    const r = await executeWritePlan({
      plan: mergePlan(target),
      session_factory: factory,
      expected_fingerprint: expectedFP,
    });
    expect(isAbstained(r)).toBe(true);
  });

  test("superseded_by_business_id set → abstained(target_already_superseded)", async () => {
    const target = "T1";
    const responses = responsesForMergeMatchHappy({
      targetId: target,
      evidenceId: "E",
      lifecycleState: "VERIFIED",
      supersededBy: "OTHER",
    });
    const { factory } = createMockFactory({ responses });
    const r = await executeWritePlan({
      plan: mergePlan(target),
      session_factory: factory,
      expected_fingerprint: expectedFP,
    });
    expect(isAbstained(r)).toBe(true);
    if (isAbstained(r)) {
      expect(r.reason.code).toBe("target_already_superseded");
    }
  });

  test("target row missing → abstained(target_missing)", async () => {
    const target = "T1";
    const responses = new Map<string | RegExp, { rows: unknown[] }>();
    responses.set(/^SELECT current_database\(\)/, { rows: [{ db: "nex_business" }] });
    responses.set(/^SELECT current_user AS usr/, { rows: [{ usr: "nex_rw" }] });
    responses.set(/^SELECT current_setting\('server_version'\)/, { rows: [{ srv_version: "15.4" }] });
    responses.set(/^SELECT schema_name FROM information_schema/, {
      rows: [{ schema_name: "nex" }, { schema_name: "public" }],
    });
    responses.set(
      /SELECT canonical_business_id, lifecycle_state, superseded_by_business_id/,
      { rows: [] }, // target vanished mid-transaction
    );
    const { factory } = createMockFactory({ responses });
    const r = await executeWritePlan({
      plan: mergePlan(target),
      session_factory: factory,
      expected_fingerprint: expectedFP,
    });
    expect(isAbstained(r)).toBe(true);
    if (isAbstained(r)) {
      expect(r.reason.code).toBe("target_missing");
    }
  });
});

// ═════════════════════════════════════════════════════════════════════
// §8 · Session errors / rollback semantics
// ═════════════════════════════════════════════════════════════════════

describe("executeWritePlan · session errors + rollback", () => {
  test("session.query throws mid-txn → ROLLBACK issued + abstained(session_error)", async () => {
    // Build fresh responses so the write regex is the ONLY one that
    // matches the compound WITH … INSERT statement.
    const responses = new Map<string | RegExp, { rows: unknown[]; error?: Error }>();
    responses.set(/^SELECT current_database\(\)/, { rows: [{ db: "nex_business" }] });
    responses.set(/^SELECT current_user AS usr/, { rows: [{ usr: "nex_rw" }] });
    responses.set(/^SELECT current_setting\('server_version'\)/, {
      rows: [{ srv_version: "15.4" }],
    });
    responses.set(/^SELECT schema_name FROM information_schema/, {
      rows: [{ schema_name: "nex" }, { schema_name: "public" }],
    });
    // Compound write throws.
    responses.set(/^WITH ic AS \(/, {
      rows: [],
      error: new Error("mock pg write failure"),
    });
    const { factory, calls } = createMockFactory({ responses });
    const r = await executeWritePlan({
      plan: insertPlan(),
      session_factory: factory,
      expected_fingerprint: expectedFP,
    });
    expect(isAbstained(r)).toBe(true);
    if (isAbstained(r)) {
      expect(r.reason.code).toBe("session_error");
      expect(r.reason.message).toContain("mock pg write failure");
    }
    const rollback = calls.some((c) => c.sql === "ROLLBACK");
    expect(rollback).toBe(true);
  });

  test("openSession failure → abstained(session_open_failed) · no further calls", async () => {
    const { factory, calls } = createMockFactory({ openShouldFail: true });
    const r = await executeWritePlan({
      plan: insertPlan(),
      session_factory: factory,
      expected_fingerprint: expectedFP,
    });
    expect(isAbstained(r)).toBe(true);
    if (isAbstained(r)) {
      expect(r.reason.code).toBe("session_open_failed");
    }
    expect(calls.length).toBe(0);
  });

  test("closeSession failure does NOT change the primary result", async () => {
    const responses = responsesForInsertNewHappy({ canonicalId: "N", evidenceId: "E" });
    const { factory } = createMockFactory({ responses, closeShouldFail: true });
    const r = await executeWritePlan({
      plan: insertPlan(),
      session_factory: factory,
      expected_fingerprint: expectedFP,
    });
    expect(isAnswered(r)).toBe(true); // write succeeded; close hiccup is swallowed
  });

  test("session always closed · even on failure", async () => {
    const responses = new Map<string | RegExp, { rows: unknown[]; error?: Error }>();
    responses.set(/^SELECT current_database\(\)/, { rows: [{ db: "nex_business" }] });
    responses.set(/^SELECT current_user AS usr/, { rows: [{ usr: "nex_rw" }] });
    responses.set(/^SELECT current_setting\('server_version'\)/, {
      rows: [{ srv_version: "15.4" }],
    });
    responses.set(/^SELECT schema_name FROM information_schema/, {
      rows: [{ schema_name: "nex" }, { schema_name: "public" }],
    });
    responses.set(/^WITH ic AS \(/, {
      rows: [],
      error: new Error("boom"),
    });
    const { factory, closeCount } = createMockFactory({ responses });
    await executeWritePlan({
      plan: insertPlan(),
      session_factory: factory,
      expected_fingerprint: expectedFP,
    });
    expect(closeCount()).toBe(1);
  });
});

// ═════════════════════════════════════════════════════════════════════
// §9 · Credential-safe error surface
// ═════════════════════════════════════════════════════════════════════

describe("executeWritePlan · credential-safe error messages", () => {
  test("pg error containing postgres://user:pass@host is sanitised", async () => {
    const responses = new Map<string | RegExp, { rows: unknown[]; error?: Error }>();
    responses.set(/^SELECT current_database\(\)/, { rows: [{ db: "nex_business" }] });
    responses.set(/^SELECT current_user AS usr/, { rows: [{ usr: "nex_rw" }] });
    responses.set(/^SELECT current_setting\('server_version'\)/, {
      rows: [{ srv_version: "15.4" }],
    });
    responses.set(/^SELECT schema_name FROM information_schema/, {
      rows: [{ schema_name: "nex" }, { schema_name: "public" }],
    });
    responses.set(/^WITH ic AS \(/, {
      rows: [],
      error: new Error("connection failed: postgres://u:supersecret@h:5432/db"),
    });
    const { factory } = createMockFactory({ responses });
    const r = await executeWritePlan({
      plan: insertPlan(),
      session_factory: factory,
      expected_fingerprint: expectedFP,
    });
    expect(isAbstained(r)).toBe(true);
    if (isAbstained(r)) {
      expect(r.reason.message).not.toContain("supersecret");
      expect(r.reason.message).toContain("[redacted]");
    }
  });
});

// ═════════════════════════════════════════════════════════════════════
// §10 · Input immutability
// ═════════════════════════════════════════════════════════════════════

describe("executeWritePlan · input immutability", () => {
  test("insert_new · does not mutate plan.row or plan.evidence", async () => {
    const plan = insertPlan({
      aliases: ["a", "b"],
      coordinates: { lat: 1, lng: 2 },
    });
    const snap = JSON.stringify(plan);
    const { factory } = createMockFactory({
      responses: responsesForInsertNewHappy({ canonicalId: "N", evidenceId: "E" }),
    });
    await executeWritePlan({
      plan,
      session_factory: factory,
      expected_fingerprint: expectedFP,
    });
    expect(JSON.stringify(plan)).toBe(snap);
  });

  test("merge_match · does not mutate the plan", async () => {
    const plan = mergePlan("T1");
    const snap = JSON.stringify(plan);
    const { factory } = createMockFactory({
      responses: responsesForMergeMatchHappy({ targetId: "T1", evidenceId: "E" }),
    });
    await executeWritePlan({
      plan,
      session_factory: factory,
      expected_fingerprint: expectedFP,
    });
    expect(JSON.stringify(plan)).toBe(snap);
  });
});

// ═════════════════════════════════════════════════════════════════════
// §11 · Determinism (compile output)
// ═════════════════════════════════════════════════════════════════════

describe("compileWritePlan · determinism", () => {
  test("insert_new · same output across repeat calls", () => {
    const plan = insertPlan({ osm_id: "node/42" });
    const a: CompiledWritePlan = compileWritePlan(plan);
    const b: CompiledWritePlan = compileWritePlan(plan);
    expect(a).toEqual(b);
  });

  test("merge_match · same output across repeat calls", () => {
    const plan = mergePlan("T1");
    const a = compileWritePlan(plan);
    const b = compileWritePlan(plan);
    expect(a).toEqual(b);
  });
});

// ═════════════════════════════════════════════════════════════════════
// §12 · Pure-module grep invariants
// ═════════════════════════════════════════════════════════════════════

describe("execute-write-plan source · pure module", () => {
  const srcPath = path.join(__dirname, "execute-write-plan.ts");
  const src = fs.readFileSync(srcPath, "utf8");
  const code = src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/[^\n]*/g, "");

  test("CODE does NOT import pg (session is injected)", () => {
    expect(code).not.toMatch(/from\s+["']pg["']/);
    expect(code).not.toMatch(/require\(["']pg["']\)/);
  });

  test("CODE does NOT import Layer A (identity-matching / entity-universe / matchBusiness)", () => {
    expect(code).not.toMatch(/identity-matching/);
    expect(code).not.toMatch(/entity-universe/);
    expect(code).not.toMatch(/\bmatchBusiness\s*\(/);
  });

  test("CODE does NOT read/write the filesystem · no durable JSONL in this wave", () => {
    expect(code).not.toMatch(/\bfs\.readFile/);
    expect(code).not.toMatch(/\bfs\.writeFile/);
    expect(code).not.toMatch(/\bfsp\./);
    expect(code).not.toMatch(/createWriteStream/);
    expect(code).not.toMatch(/\.appendFile/);
  });

  test("CODE does NOT read environment variables / credentials", () => {
    expect(code).not.toMatch(/process\.env/);
    expect(code).not.toMatch(/\bdotenv\b/);
    expect(code).not.toMatch(/\.pgpass/);
  });

  test("CODE does NOT use a clock or randomness", () => {
    expect(code).not.toMatch(/\bnew\s+Date\b/);
    expect(code).not.toMatch(/\bDate\.now\b/);
    expect(code).not.toMatch(/\bMath\.random\b/);
    expect(code).not.toMatch(/\brandomUUID\b/);
    expect(code).not.toMatch(/\brandomBytes\b/);
  });

  test("CODE does NOT reference Supabase", () => {
    expect(code).not.toMatch(/@supabase/);
    expect(code).not.toMatch(/\bsupabase/i);
  });

  test("CODE does NOT re-run approval / resolver / precheckHandoff", () => {
    expect(code).not.toMatch(/\bdecideCandidate\s*\(/);
    expect(code).not.toMatch(/\bdecideBatch\s*\(/);
    expect(code).not.toMatch(/\bresolveCanonical\s*\(/);
    expect(code).not.toMatch(/\bprecheckHandoff\s*\(/);
  });

  test("CODE's local imports are the sealed consumer surface", () => {
    const localImports = [
      ...code.matchAll(/from\s+["']\.\/([^"']+)["']/g),
    ].map((m) => m[1]);
    const allowed = new Set([
      "generate-candidates",
      "canonical-handoff",
      "canonical-row",
      "pg-fingerprint",
      "intelligence-result",
    ]);
    for (const imp of localImports) {
      expect(allowed.has(imp)).toBe(true);
    }
  });

  test("CODE has NO node builtin imports (crypto is NOT needed here)", () => {
    const nodeImports = [
      ...code.matchAll(/from\s+["']node:([^"']+)["']/g),
    ].map((m) => m[1]);
    expect(nodeImports).toEqual([]);
  });
});

// ═════════════════════════════════════════════════════════════════════
// §13 · Verdict-plan invariants
// ═════════════════════════════════════════════════════════════════════

describe("executeWritePlan · verdict-plan invariants", () => {
  test("insert_new report.kind === 'insert_new'", async () => {
    const { factory } = createMockFactory({
      responses: responsesForInsertNewHappy({ canonicalId: "N", evidenceId: "E" }),
    });
    const r = await executeWritePlan({
      plan: insertPlan(),
      session_factory: factory,
      expected_fingerprint: expectedFP,
    });
    if (isAnswered(r)) {
      const report: WriteExecutionReport = r.value;
      expect(report.kind).toBe("insert_new");
    }
  });

  test("merge_match report.kind === 'merge_match'", async () => {
    const { factory } = createMockFactory({
      responses: responsesForMergeMatchHappy({ targetId: "T", evidenceId: "E" }),
    });
    const r = await executeWritePlan({
      plan: mergePlan("T"),
      session_factory: factory,
      expected_fingerprint: expectedFP,
    });
    if (isAnswered(r)) {
      expect(r.value.kind).toBe("merge_match");
    }
  });
});

// ═════════════════════════════════════════════════════════════════════
// §14 · DEFAULT_WRITE_EXECUTOR_CONFIG is frozen + sensible
// ═════════════════════════════════════════════════════════════════════

describe("DEFAULT_WRITE_EXECUTOR_CONFIG", () => {
  test("is Object.freeze'd", () => {
    expect(Object.isFrozen(DEFAULT_WRITE_EXECUTOR_CONFIG)).toBe(true);
  });

  test("has positive millisecond timeouts", () => {
    expect(DEFAULT_WRITE_EXECUTOR_CONFIG.statementTimeoutMs).toBeGreaterThan(0);
    expect(
      DEFAULT_WRITE_EXECUTOR_CONFIG.idleInTransactionTimeoutMs,
    ).toBeGreaterThan(0);
  });
});
