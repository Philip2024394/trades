// scripts/nex-canonical/first-live-write.test.ts
//
// Unit tests for the one-shot orchestrator + synthetic fixture + env gate.
// No real pg · no credentials · the one-shot latch is explicitly reset
// between tests via the test-only helper.

import { afterEach, beforeEach, describe, expect, test } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import type { CanonicalWritePlan } from "./canonical-handoff";
import type { WriteSession, WriteSessionFactory } from "./execute-write-plan";
import {
  type ReadbackSession,
  type ReadbackSessionFactory,
} from "./canonical-readback";
import {
  OrchestratorAlreadyConsumedError,
  REQUIRED_WRITE_ENV_VARS,
  SYNTHETIC_FIRST_WRITE_CANDIDATE,
  SYNTHETIC_FOUNDER_ID,
  SYNTHETIC_SOURCE_REGISTRY_ROW,
  _isConsumedForTests,
  _resetOneShotLatchForTests,
  buildPreflightSummary,
  buildSyntheticFirstWritePlan,
  checkRequiredEnvVars,
  computeCandidateIntegrityHashLocal,
  runFirstLiveCanonicalWrite,
} from "./first-live-write";
import { validateCandidate } from "./candidate-validator";
import { EVIDENCE_SCHEMA_VERSION } from "./canonical-handoff";
import { isAbstained, isAnswered } from "./intelligence-result";

beforeEach(() => _resetOneShotLatchForTests());
afterEach(() => _resetOneShotLatchForTests());

// ═════════════════════════════════════════════════════════════════════
// §1 · Synthetic Candidate fixture validity
// ═════════════════════════════════════════════════════════════════════

describe("SYNTHETIC_FIRST_WRITE_CANDIDATE", () => {
  test("passes the sealed candidate validator (no shape drift)", () => {
    expect(() =>
      validateCandidate(SYNTHETIC_FIRST_WRITE_CANDIDATE),
    ).not.toThrow();
  });

  test("name_canonical is unmistakably synthetic (not production content)", () => {
    expect(SYNTHETIC_FIRST_WRITE_CANDIDATE.identity.name_canonical).toMatch(
      /SYNTHETIC/i,
    );
  });

  test("caveats explicitly tag this as a non-promotion fixture", () => {
    const caveats = SYNTHETIC_FIRST_WRITE_CANDIDATE.caveats.join(" | ");
    expect(caveats).toMatch(/SYNTHETIC/i);
    expect(caveats).toMatch(/do not promote/i);
  });

  test("candidate carries at least one strong/medium identity signal (coordinates)", () => {
    expect(SYNTHETIC_FIRST_WRITE_CANDIDATE.identity.coordinates).not.toBeNull();
  });
});

// ═════════════════════════════════════════════════════════════════════
// §2 · buildSyntheticFirstWritePlan
// ═════════════════════════════════════════════════════════════════════

describe("buildSyntheticFirstWritePlan", () => {
  test("produces an insert_new CanonicalWritePlan", () => {
    const ctx = buildSyntheticFirstWritePlan();
    expect(ctx.plan.kind).toBe("insert_new");
  });

  test("deterministic · same output across calls", () => {
    const a = buildSyntheticFirstWritePlan();
    const b = buildSyntheticFirstWritePlan();
    expect(a.plan).toEqual(b.plan);
    expect(a.decisionRecord.decision_record_id).toBe(
      b.decisionRecord.decision_record_id,
    );
    expect(a.reviewPackage.package_id).toBe(b.reviewPackage.package_id);
  });

  test("evidence binds to the exact candidate_integrity_hash", () => {
    const ctx = buildSyntheticFirstWritePlan();
    const expected = computeCandidateIntegrityHashLocal(
      SYNTHETIC_FIRST_WRITE_CANDIDATE,
    );
    expect(ctx.plan.evidence.candidate_integrity_hash).toBe(expected);
  });

  test("evidence binds to the exact decision_record_id", () => {
    const ctx = buildSyntheticFirstWritePlan();
    expect(ctx.plan.evidence.decision_record_id).toBe(
      ctx.decisionRecord.decision_record_id,
    );
  });

  test("evidence binds to the exact review_package_id", () => {
    const ctx = buildSyntheticFirstWritePlan();
    expect(ctx.plan.evidence.review_package_id).toBe(
      ctx.reviewPackage.package_id,
    );
  });

  test("evidence.schema_version = 'evidence-v1'", () => {
    const ctx = buildSyntheticFirstWritePlan();
    expect(ctx.plan.evidence.schema_version).toBe(EVIDENCE_SCHEMA_VERSION);
  });

  test("resolver_verdict_summary.kind = 'NO_MATCH' · target_canonical_business_id null", () => {
    const ctx = buildSyntheticFirstWritePlan();
    expect(ctx.plan.evidence.resolver_verdict_summary.kind).toBe("NO_MATCH");
    expect(
      ctx.plan.evidence.resolver_verdict_summary.target_canonical_business_id,
    ).toBeNull();
  });

  test("insert_new.row.lifecycle_state = 'DISCOVERED'", () => {
    const ctx = buildSyntheticFirstWritePlan();
    if (ctx.plan.kind === "insert_new") {
      expect(ctx.plan.row.lifecycle_state).toBe("DISCOVERED");
    }
  });

  test("insert_new.row carries the fixture's identity verbatim", () => {
    const ctx = buildSyntheticFirstWritePlan();
    if (ctx.plan.kind === "insert_new") {
      expect(ctx.plan.row.name_canonical).toBe(
        SYNTHETIC_FIRST_WRITE_CANDIDATE.identity.name_canonical,
      );
      expect(ctx.plan.row.entity_type).toBe(
        SYNTHETIC_FIRST_WRITE_CANDIDATE.entity_type,
      );
      expect(ctx.plan.row.country).toBe(
        SYNTHETIC_FIRST_WRITE_CANDIDATE.country,
      );
      expect(ctx.plan.row.city).toBe(
        SYNTHETIC_FIRST_WRITE_CANDIDATE.identity.city,
      );
    }
  });

  test("source_id = SYNTHETIC_SOURCE_REGISTRY_ROW.source_id", () => {
    const ctx = buildSyntheticFirstWritePlan();
    expect(ctx.plan.evidence.source_id).toBe(
      SYNTHETIC_SOURCE_REGISTRY_ROW.source_id,
    );
  });

  test("founder_id in observation_provenance = SYNTHETIC_FOUNDER_ID", () => {
    const ctx = buildSyntheticFirstWritePlan();
    expect(ctx.plan.evidence.observation_provenance.founder_id).toBe(
      SYNTHETIC_FOUNDER_ID,
    );
  });
});

// ═════════════════════════════════════════════════════════════════════
// §3 · One-shot latch
// ═════════════════════════════════════════════════════════════════════

describe("one-shot latch", () => {
  const expectedFP = {
    database: "nex_business",
    user: "nex_rw",
    serverVersionPrefix: "15.",
    schemas: ["nex", "public"] as readonly string[],
  };

  function noopWriteFactory(): WriteSessionFactory {
    return {
      openSession: async () =>
        ({
          id: "noop",
          query: async () => ({ rows: [], rowCount: 0 }),
        }) satisfies WriteSession,
      closeSession: async () => {},
    };
  }

  function noopReadbackFactory(): ReadbackSessionFactory {
    return {
      openSession: async () =>
        ({
          id: "noop",
          query: async () => ({ rows: [], rowCount: 0 }),
        }) satisfies ReadbackSession,
      closeSession: async () => {},
    };
  }

  test("second call throws OrchestratorAlreadyConsumedError", async () => {
    const ctx = buildSyntheticFirstWritePlan();
    expect(_isConsumedForTests()).toBe(false);
    const first = runFirstLiveCanonicalWrite({
      plan: ctx.plan,
      write_session_factory: noopWriteFactory(),
      readback_session_factory: noopReadbackFactory(),
      expected_fingerprint: expectedFP,
    });
    // Await the first call to let the latch consume.
    await first;
    expect(_isConsumedForTests()).toBe(true);
    await expect(
      runFirstLiveCanonicalWrite({
        plan: ctx.plan,
        write_session_factory: noopWriteFactory(),
        readback_session_factory: noopReadbackFactory(),
        expected_fingerprint: expectedFP,
      }),
    ).rejects.toThrow(OrchestratorAlreadyConsumedError);
  });

  test("the latch is consumed EVEN WHEN the write fails · one-shot is strict", async () => {
    const ctx = buildSyntheticFirstWritePlan();
    // Write factory where openSession fails · executeWritePlan returns
    // abstained · but the latch is already consumed before the write.
    const brokenFactory: WriteSessionFactory = {
      openSession: async () => {
        throw new Error("mock open failure");
      },
      closeSession: async () => {},
    };
    await runFirstLiveCanonicalWrite({
      plan: ctx.plan,
      write_session_factory: brokenFactory,
      readback_session_factory: noopReadbackFactory(),
      expected_fingerprint: expectedFP,
    });
    expect(_isConsumedForTests()).toBe(true);
    await expect(
      runFirstLiveCanonicalWrite({
        plan: ctx.plan,
        write_session_factory: noopWriteFactory(),
        readback_session_factory: noopReadbackFactory(),
        expected_fingerprint: expectedFP,
      }),
    ).rejects.toThrow(OrchestratorAlreadyConsumedError);
  });
});

// ═════════════════════════════════════════════════════════════════════
// §4 · Env preflight · env presence + non-secret summary
// ═════════════════════════════════════════════════════════════════════

describe("checkRequiredEnvVars", () => {
  test("ok=true when all 8 are present", () => {
    const env: NodeJS.ProcessEnv = {};
    for (const n of REQUIRED_WRITE_ENV_VARS) env[n] = "x";
    const r = checkRequiredEnvVars(env);
    expect(r.ok).toBe(true);
    expect(r.missing).toEqual([]);
    expect(r.present.length).toBe(REQUIRED_WRITE_ENV_VARS.length);
  });

  test("ok=false · missing lists only the missing names", () => {
    const env: NodeJS.ProcessEnv = {};
    for (const n of REQUIRED_WRITE_ENV_VARS) env[n] = "x";
    delete env.NEX_CANONICAL_PG_PASSWORD;
    delete env.NEX_CANONICAL_PG_EXPECTED_SCHEMAS;
    const r = checkRequiredEnvVars(env);
    expect(r.ok).toBe(false);
    expect(r.missing).toContain("NEX_CANONICAL_PG_PASSWORD");
    expect(r.missing).toContain("NEX_CANONICAL_PG_EXPECTED_SCHEMAS");
  });

  test("empty string treated as missing · values not returned", () => {
    const env: NodeJS.ProcessEnv = {};
    for (const n of REQUIRED_WRITE_ENV_VARS) env[n] = "x";
    env.NEX_CANONICAL_PG_PASSWORD = "";
    const r = checkRequiredEnvVars(env);
    expect(r.missing).toContain("NEX_CANONICAL_PG_PASSWORD");
    // The returned object only mentions NAMES; no value field exists.
    const serialized = JSON.stringify(r);
    expect(serialized).not.toContain("x"); // defensive · values aren't echoed
  });

  test("REQUIRED_WRITE_ENV_VARS has exactly 8 entries · 4 credentials + 4 fingerprint", () => {
    expect(REQUIRED_WRITE_ENV_VARS.length).toBe(8);
  });
});

describe("buildPreflightSummary", () => {
  test("builds the non-secret summary · no credential values appear", () => {
    const env: NodeJS.ProcessEnv = {
      NEX_CANONICAL_PG_EXPECTED_DATABASE: "nex_business",
      NEX_CANONICAL_PG_EXPECTED_USER: "nex_rw",
      NEX_CANONICAL_PG_EXPECTED_SERVER_VERSION_PREFIX: "15.",
      NEX_CANONICAL_PG_EXPECTED_SCHEMAS: "nex,public",
      NEX_CANONICAL_PG_PASSWORD: "SHOULD-NEVER-APPEAR",
    };
    const s = buildPreflightSummary(env);
    expect(s.fixture_candidate_id).toBe(
      SYNTHETIC_FIRST_WRITE_CANDIDATE.candidate_id,
    );
    expect(s.entity_type).toBe("food");
    expect(s.country).toBe("ID");
    expect(s.intended_resolver_verdict).toBe("NO_MATCH");
    expect(s.intended_plan_kind).toBe("insert_new");
    expect(s.expected_fingerprint_database_name).toBe("nex_business");
    expect(s.expected_fingerprint_user_name).toBe("nex_rw");
    expect(s.expected_server_version_prefix).toBe("15.");
    expect(s.expected_schemas).toEqual(["nex", "public"]);
    const serialized = JSON.stringify(s);
    expect(serialized).not.toContain("SHOULD-NEVER-APPEAR");
  });
});

// ═════════════════════════════════════════════════════════════════════
// §5 · runFirstLiveCanonicalWrite · mocked write + readback
// ═════════════════════════════════════════════════════════════════════

describe("runFirstLiveCanonicalWrite · mocked happy path", () => {
  const expectedFP = {
    database: "nex_business",
    user: "nex_rw",
    serverVersionPrefix: "15.",
    schemas: ["nex", "public"] as readonly string[],
  };

  test("completes · write + readback report returned", async () => {
    const ctx = buildSyntheticFirstWritePlan();

    // Mock write factory · simulate a successful executeWritePlan by
    // returning the right rows for every stage.
    const writeFactory: WriteSessionFactory = {
      openSession: async () => ({
        id: "mock-write",
        query: async <T>(sql: string): Promise<{ rows: readonly T[]; rowCount: number }> => {
          if (/current_database/.test(sql))
            return { rows: [{ db: "nex_business" }] as unknown as readonly T[], rowCount: 1 };
          if (/current_user AS usr/.test(sql))
            return { rows: [{ usr: "nex_rw" }] as unknown as readonly T[], rowCount: 1 };
          if (/current_setting\('server_version'\)/.test(sql))
            return { rows: [{ srv_version: "15.4" }] as unknown as readonly T[], rowCount: 1 };
          if (/information_schema\.schemata/.test(sql))
            return {
              rows: [{ schema_name: "nex" }, { schema_name: "public" }] as unknown as readonly T[],
              rowCount: 2,
            };
          if (/^WITH ic AS \(/.test(sql))
            return {
              rows: [
                {
                  evidence_id: "ev-synthetic-1",
                  canonical_business_id: "canon-synthetic-1",
                },
              ] as unknown as readonly T[],
              rowCount: 1,
            };
          return { rows: [] as readonly T[], rowCount: 0 };
        },
      }),
      closeSession: async () => {},
    };

    // Mock readback factory · return the "correct" rows that mirror
    // the plan the orchestrator built.
    const planRow = ctx.plan.kind === "insert_new" ? ctx.plan.row : null;
    const readbackFactory: ReadbackSessionFactory = {
      openSession: async () => ({
        id: "mock-readback",
        query: async <T>(sql: string): Promise<{ rows: readonly T[]; rowCount: number }> => {
          if (/COUNT.*FROM nex\.business_canonical/.test(sql))
            return { rows: [{ count: "1" }] as unknown as readonly T[], rowCount: 1 };
          if (/COUNT.*FROM nex\.business_evidence/.test(sql))
            return { rows: [{ count: "1" }] as unknown as readonly T[], rowCount: 1 };
          if (/FROM nex\.business_canonical\s+WHERE canonical_business_id/.test(sql))
            return {
              rows: [
                {
                  canonical_business_id: "canon-synthetic-1",
                  entity_type: planRow?.entity_type,
                  country: planRow?.country,
                  lifecycle_state: planRow?.lifecycle_state,
                  name_canonical: planRow?.name_canonical,
                  aliases: planRow?.aliases,
                  phone_e164: planRow?.phone_e164,
                  website_apex: planRow?.website_apex,
                  osm_id: planRow?.osm_id,
                  wikidata_qid: planRow?.wikidata_qid,
                  city: planRow?.city,
                  district: planRow?.district,
                },
              ] as unknown as readonly T[],
              rowCount: 1,
            };
          if (/FROM nex\.business_evidence\s+WHERE evidence_id/.test(sql))
            return {
              rows: [
                {
                  evidence_id: "ev-synthetic-1",
                  canonical_business_id: "canon-synthetic-1",
                  schema_version: ctx.plan.evidence.schema_version,
                  candidate_id: ctx.plan.evidence.candidate_id,
                  candidate_integrity_hash:
                    ctx.plan.evidence.candidate_integrity_hash,
                  decision_record_id: ctx.plan.evidence.decision_record_id,
                  review_package_id: ctx.plan.evidence.review_package_id,
                  legacy_source_table: ctx.plan.evidence.legacy_source.table,
                  legacy_source_ref: ctx.plan.evidence.legacy_source.ref,
                  legacy_source_internal_id:
                    ctx.plan.evidence.legacy_source.internal_id,
                  resolver_verdict_kind:
                    ctx.plan.evidence.resolver_verdict_summary.kind,
                  resolver_target_id:
                    ctx.plan.evidence.resolver_verdict_summary
                      .target_canonical_business_id,
                  resolver_score:
                    ctx.plan.evidence.resolver_verdict_summary.score,
                  observation_generator:
                    ctx.plan.evidence.observation_provenance.generator,
                  observation_run_id:
                    ctx.plan.evidence.observation_provenance.generation_run_id,
                  observation_founder_id:
                    ctx.plan.evidence.observation_provenance.founder_id,
                  source_id: ctx.plan.evidence.source_id,
                },
              ] as unknown as readonly T[],
              rowCount: 1,
            };
          return { rows: [] as readonly T[], rowCount: 0 };
        },
      }),
      closeSession: async () => {},
    };

    const r = await runFirstLiveCanonicalWrite({
      plan: ctx.plan,
      write_session_factory: writeFactory,
      readback_session_factory: readbackFactory,
      expected_fingerprint: expectedFP,
    });
    expect(isAnswered(r)).toBe(true);
    if (isAnswered(r)) {
      expect(r.value.stage).toBe("complete");
      expect(r.value.plan_kind).toBe("insert_new");
      expect(r.value.write_report.canonical_business_id).toBe(
        "canon-synthetic-1",
      );
      expect(r.value.readback_report.all_fields_match).toBe(true);
      expect(r.value.readback_report.no_duplicates).toBe(true);
      expect(r.value.readback_matches_plan).toBe(true);
    }
  });

  test("write abstained → orchestrator returns abstained(write_abstained)", async () => {
    const ctx = buildSyntheticFirstWritePlan();
    const brokenFactory: WriteSessionFactory = {
      openSession: async () => {
        throw new Error("mock open failure");
      },
      closeSession: async () => {},
    };
    const dummyReadback: ReadbackSessionFactory = {
      openSession: async () => ({
        id: "noop",
        query: async () => ({ rows: [], rowCount: 0 }),
      }),
      closeSession: async () => {},
    };
    const r = await runFirstLiveCanonicalWrite({
      plan: ctx.plan,
      write_session_factory: brokenFactory,
      readback_session_factory: dummyReadback,
      expected_fingerprint: expectedFP,
    });
    expect(isAbstained(r)).toBe(true);
    if (isAbstained(r)) {
      expect(r.reason.code).toBe("write_abstained");
    }
  });
});

// ═════════════════════════════════════════════════════════════════════
// §6 · Pure-module grep invariants
// ═════════════════════════════════════════════════════════════════════

describe("first-live-write source · scope invariants", () => {
  const srcPath = path.join(__dirname, "first-live-write.ts");
  const src = fs.readFileSync(srcPath, "utf8");
  const code = src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/[^\n]*/g, "");

  test("CODE does NOT import pg directly · session factories are injected", () => {
    expect(code).not.toMatch(/from\s+["']pg["']/);
  });

  test("CODE does NOT auto-run on import · no top-level await / IIFE", () => {
    expect(code).not.toMatch(/^await\s/m);
    expect(code).not.toMatch(/\(\s*async\s*\(\s*\)\s*=>/);
  });

  test("CODE does NOT invoke β / country runner / canonical insert bypass", () => {
    expect(code).not.toMatch(/\brunCandidateExtraction\s*\(/);
    expect(code).not.toMatch(/\bcountryRunner\b/);
    expect(code).not.toMatch(/\bcanonicalInsert\s*\(/);
  });

  test("CODE does NOT use Date.now / new Date / Math.random / randomUUID", () => {
    expect(code).not.toMatch(/\bnew\s+Date\b/);
    expect(code).not.toMatch(/\bDate\.now\b/);
    expect(code).not.toMatch(/\bMath\.random\b/);
    expect(code).not.toMatch(/\brandomUUID\b/);
    expect(code).not.toMatch(/\brandomBytes\b/);
  });

  test("CODE does NOT import Layer A · identity-matching / entity-universe / matchBusiness", () => {
    expect(code).not.toMatch(/identity-matching/);
    expect(code).not.toMatch(/entity-universe/);
    expect(code).not.toMatch(/\bmatchBusiness\s*\(/);
  });
});
