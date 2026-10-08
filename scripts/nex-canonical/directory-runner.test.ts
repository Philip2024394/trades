// scripts/nex-canonical/directory-runner.test.ts
//
// Comprehensive tests for the Directory engine · state machine +
// checkpoint log + source + runner. All sessions and sources are
// injected mocks · no real pg, no credentials, no network.

import { afterEach, beforeEach, describe, expect, test } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import type { Candidate } from "./generate-candidates";
import type { CanonicalResolverInput, CanonicalRow } from "./canonical-row";
import type {
  ApprovedCandidateHandoff,
  SourceRegistryRow,
} from "./canonical-handoff";
import { EVIDENCE_SCHEMA_VERSION } from "./canonical-handoff";
import type {
  WriteSession,
  WriteSessionFactory,
  ExpectedFingerprint,
} from "./execute-write-plan";
import type {
  ReadbackSession,
  ReadbackSessionFactory,
} from "./canonical-readback";
import {
  type CheckpointEvent,
  type CandidateOutcome,
  parseCheckpointLog,
  reduceCheckpointLog,
  serializeCheckpointLog,
  stableStringify,
  summarizeDerivedState,
  isCandidateFinal,
  isCandidateWritten,
} from "./directory-log";
import {
  createMockDirectorySource,
  type DirectorySource,
  type DiscoverBatchResult,
} from "./directory-source";
import {
  DEFAULT_RUNNER_CONFIG,
  runDirectoryCountry,
  type ApprovalProvider,
  type CurrentCanonicalRowProvider,
  type OsmCollisionProvider,
  type ResolverPoolProvider,
  type RunnerDeps,
  type RunnerIO,
  type SourceRegistryRowProvider,
} from "./directory-runner";

// ═════════════════════════════════════════════════════════════════════
// §0 · Shared fixtures
// ═════════════════════════════════════════════════════════════════════

function cand(id: string, overrides: Partial<Candidate> = {}): Candidate {
  const base: Candidate = {
    candidate_id: id,
    status: "pending_founder_review",
    entity_type: "food",
    country: "ID",
    identity: {
      name_canonical: `Warung ${id}`,
      aliases: ["x"],
      phone_e164: null,
      website_apex: null,
      osm_id: null,
      wikidata_qid: null,
      city: "Bandung",
      district: null,
      // Migration 178 fields · null on this helper so existing tests
      // continue to exercise the sparse-row shape.
      street_line: null,
      neighbourhood: null,
      address: null,
      coordinates: { lat: -6.9, lng: 107.6 },
    },
    legacy_source: {
      table: "nex.food_business",
      ref: `ref-${id}`,
      internal_id: null,
    },
    risk_categories: ["R1"],
    selection_score: 0.5,
    selection_rationale: [{ risk_category: "R1", contribution: 0.5, note: "n" }],
    generation_source: {
      generator: "scripts/nex-canonical/generate-candidates.ts",
      generated_at: "2026-10-08T00:00:00.000Z",
      generation_run_id: "run-test",
    },
    caveats: [],
  };
  return { ...base, ...overrides };
}

function sourceRow(): SourceRegistryRow {
  return {
    source_id: "nex.food_business",
    source_type: "LEGACY_NEX",
    display_name: "legacy",
    can_collect: true,
    can_store: true,
    can_display: false,
    can_derive: true,
    can_redistribute: false,
    attribution_required: true,
  };
}

const EXPECTED_FP: ExpectedFingerprint = {
  database: "nex_business",
  user: "nex_rw",
  serverVersionPrefix: "15.",
  schemas: ["nex", "public"],
};

/** Build an in-memory checkpoint IO · tests inspect the log afterwards. */
function createCheckpointIO(): {
  io: Pick<RunnerIO, "checkpointAppend" | "checkpointLoad">;
  events: CheckpointEvent[];
} {
  const events: CheckpointEvent[] = [];
  return {
    io: {
      checkpointAppend: async (e) => {
        events.push(e);
      },
      checkpointLoad: async () => [...events],
    },
    events,
  };
}

/** Build an injected clock that increments by 1 second each call. */
function createTickingClock(): { now: () => Date; reset: () => void } {
  let counter = 0;
  const start = Date.parse("2026-10-08T00:00:00.000Z");
  return {
    now: () => new Date(start + counter++ * 1000),
    reset: () => {
      counter = 0;
    },
  };
}

/** Build a stateful in-memory DB that both the write and readback
 *  factories share · the write mock "inserts" by storing params; the
 *  readback mock "selects" by returning stored rows. This lets
 *  verifyFirstWriteReadback's field-by-field comparison PASS because
 *  the readback echoes exactly what the plan put in. */
function createInMemoryDirectoryDb(): {
  writeFactory: WriteSessionFactory;
  readbackFactory: ReadbackSessionFactory;
  canonical: Map<string, Record<string, unknown>>;
  evidence: Map<string, Record<string, unknown>>;
} {
  const canonical = new Map<string, Record<string, unknown>>();
  const evidence = new Map<string, Record<string, unknown>>();
  let seq = 0;

  const writeFactory: WriteSessionFactory = {
    openSession: async (): Promise<WriteSession> => ({
      id: "mem-write",
      query: async <T>(sql: string, params: readonly unknown[]) => {
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
        if (/^WITH ic AS \(/.test(sql)) {
          seq++;
          const canonicalId = `canon-${seq}`;
          const evidenceId = `ev-${seq}`;
          // Post-178 + address wiring (see execute-write-plan.ts):
          //   $11=street_line, $12=neighbourhood, $13=address jsonb
          //   (sent as JSON string or null), $14/$15=coord lat/lng.
          //   Evidence params shift to $16..$32 (indices 15..31).
          //
          // The mock stores the address as the parsed object so the
          // readback compare path exercises the same shape it would
          // see from the pg driver returning jsonb.
          const rawAddress = params[12];
          const parsedAddress =
            typeof rawAddress === "string"
              ? JSON.parse(rawAddress)
              : (rawAddress ?? null);
          canonical.set(canonicalId, {
            canonical_business_id: canonicalId,
            entity_type: params[0],
            country: params[1],
            lifecycle_state: "DISCOVERED",
            name_canonical: params[2],
            aliases: params[3],
            phone_e164: params[4],
            website_apex: params[5],
            osm_id: params[6],
            wikidata_qid: params[7],
            city: params[8],
            district: params[9],
            street_line: params[10],
            neighbourhood: params[11],
            address: parsedAddress,
          });
          evidence.set(evidenceId, {
            evidence_id: evidenceId,
            canonical_business_id: canonicalId,
            schema_version: params[15],
            candidate_id: params[16],
            candidate_integrity_hash: params[17],
            decision_record_id: params[18],
            review_package_id: params[19],
            legacy_source_table: params[20],
            legacy_source_ref: params[21],
            legacy_source_internal_id: params[22],
            resolver_verdict_kind: params[23],
            resolver_target_id: params[24],
            resolver_score: params[25],
            observation_generator: params[26],
            observation_run_id: params[27],
            observation_generated_at: params[28],
            observation_decision_timestamp: params[29],
            observation_founder_id: params[30],
            source_id: params[31],
          });
          return {
            rows: [{ evidence_id: evidenceId, canonical_business_id: canonicalId }] as unknown as readonly T[],
            rowCount: 1,
          };
        }
        if (/^INSERT INTO nex\.business_evidence/.test(sql)) {
          seq++;
          const evidenceId = `ev-merge-${seq}`;
          const targetId = String(params[0]);
          evidence.set(evidenceId, {
            evidence_id: evidenceId,
            canonical_business_id: targetId,
            schema_version: params[1],
            candidate_id: params[2],
            candidate_integrity_hash: params[3],
            decision_record_id: params[4],
            review_package_id: params[5],
            legacy_source_table: params[6],
            legacy_source_ref: params[7],
            legacy_source_internal_id: params[8],
            resolver_verdict_kind: params[9],
            resolver_target_id: params[10],
            resolver_score: params[11],
            observation_generator: params[12],
            observation_run_id: params[13],
            observation_generated_at: params[14],
            observation_decision_timestamp: params[15],
            observation_founder_id: params[16],
            source_id: params[17],
          });
          return {
            rows: [{ evidence_id: evidenceId, canonical_business_id: targetId }] as unknown as readonly T[],
            rowCount: 1,
          };
        }
        return { rows: [] as readonly T[], rowCount: 0 };
      },
    }),
    closeSession: async () => {},
  };

  const readbackFactory: ReadbackSessionFactory = {
    openSession: async (): Promise<ReadbackSession> => ({
      id: "mem-readback",
      query: async <T>(sql: string, params: readonly unknown[]) => {
        if (/^SELECT COUNT.*FROM nex\.business_canonical/.test(sql)) {
          const id = String(params[0]);
          const n = canonical.has(id) ? 1 : 0;
          return { rows: [{ count: String(n) }] as unknown as readonly T[], rowCount: 1 };
        }
        if (/^SELECT COUNT.*FROM nex\.business_evidence\s+WHERE canonical_business_id/.test(sql)) {
          const id = String(params[0]);
          let n = 0;
          for (const e of evidence.values()) if (e.canonical_business_id === id) n++;
          return { rows: [{ count: String(n) }] as unknown as readonly T[], rowCount: 1 };
        }
        if (/^SELECT COUNT.*FROM nex\.business_evidence\s+WHERE decision_record_id/.test(sql)) {
          const id = String(params[0]);
          let n = 0;
          for (const e of evidence.values()) if (e.decision_record_id === id) n++;
          return { rows: [{ count: String(n) }] as unknown as readonly T[], rowCount: 1 };
        }
        if (/^SELECT canonical_business_id,/.test(sql)) {
          const id = String(params[0]);
          const row = canonical.get(id);
          return { rows: (row ? [row] : []) as unknown as readonly T[], rowCount: row ? 1 : 0 };
        }
        if (/^SELECT evidence_id,/.test(sql)) {
          const id = String(params[0]);
          const row = evidence.get(id);
          return { rows: (row ? [row] : []) as unknown as readonly T[], rowCount: row ? 1 : 0 };
        }
        return { rows: [] as readonly T[], rowCount: 0 };
      },
    }),
    closeSession: async () => {},
  };

  return { writeFactory, readbackFactory, canonical, evidence };
}

/** DEPRECATED single-shot factories · kept only for a couple of
 *  tests that don't need the stateful in-memory DB. */
function createHappyWriteFactory(opts: {
  canonicalId: string;
  evidenceId: string;
}): { factory: WriteSessionFactory; calls: string[] } {
  const calls: string[] = [];
  const factory: WriteSessionFactory = {
    openSession: async (): Promise<WriteSession> => ({
      id: "mock-write",
      query: async <T>(
        sql: string,
      ): Promise<{ rows: readonly T[]; rowCount: number }> => {
        calls.push(sql);
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
                evidence_id: opts.evidenceId,
                canonical_business_id: opts.canonicalId,
              },
            ] as unknown as readonly T[],
            rowCount: 1,
          };
        if (/^INSERT INTO nex\.business_evidence/.test(sql))
          return {
            rows: [
              {
                evidence_id: opts.evidenceId,
                canonical_business_id: opts.canonicalId,
              },
            ] as unknown as readonly T[],
            rowCount: 1,
          };
        return { rows: [] as readonly T[], rowCount: 0 };
      },
    }),
    closeSession: async () => {},
  };
  return { factory, calls };
}

/** Build a mock ReadbackSessionFactory that reports all fields match
 *  and no duplicates. */
function createHappyReadbackFactory(opts: {
  canonicalId: string;
  evidenceId: string;
}): ReadbackSessionFactory {
  return {
    openSession: async (): Promise<ReadbackSession> => ({
      id: "mock-readback",
      query: async <T>(sql: string): Promise<{ rows: readonly T[]; rowCount: number }> => {
        if (/^SELECT COUNT.*FROM nex\.business_canonical/.test(sql))
          return { rows: [{ count: "1" }] as unknown as readonly T[], rowCount: 1 };
        if (/^SELECT COUNT.*FROM nex\.business_evidence/.test(sql))
          return { rows: [{ count: "1" }] as unknown as readonly T[], rowCount: 1 };
        if (/^SELECT canonical_business_id,/.test(sql))
          return {
            rows: [
              {
                canonical_business_id: opts.canonicalId,
                entity_type: "food",
                country: "ID",
                lifecycle_state: "DISCOVERED",
                name_canonical: "ignored · field comparator uses plan",
                aliases: ["x"],
                phone_e164: null,
                website_apex: null,
                osm_id: null,
                wikidata_qid: null,
                city: "Bandung",
                district: null,
              },
            ] as unknown as readonly T[],
            rowCount: 1,
          };
        if (/^SELECT evidence_id,/.test(sql))
          return {
            rows: [
              {
                evidence_id: opts.evidenceId,
                canonical_business_id: opts.canonicalId,
                schema_version: EVIDENCE_SCHEMA_VERSION,
                candidate_id: "ignored",
                candidate_integrity_hash: "ignored",
                decision_record_id: "ignored",
                review_package_id: "ignored",
                legacy_source_table: "nex.food_business",
                legacy_source_ref: "ignored",
                legacy_source_internal_id: null,
                resolver_verdict_kind: "NO_MATCH",
                resolver_target_id: null,
                resolver_score: 0,
                observation_generator: "scripts/nex-canonical/generate-candidates.ts",
                observation_run_id: "run-test",
                observation_founder_id: "ignored",
                source_id: "nex.food_business",
              },
            ] as unknown as readonly T[],
            rowCount: 1,
          };
        return { rows: [] as readonly T[], rowCount: 0 };
      },
    }),
    closeSession: async () => {},
  };
}

/** Build a happy-path deps bundle. Overrides can replace any field.
 *  By default uses the stateful in-memory DB so verifyFirstWriteReadback
 *  returns matching rows and verification passes. */
function makeDeps(
  source: DirectorySource,
  overrides: Partial<RunnerDeps> = {},
): RunnerDeps {
  const db = createInMemoryDirectoryDb();
  const base: RunnerDeps = {
    source,
    approvalProvider: async ({ package: pkg, candidate_id }) => {
      // auto-approve · reuse the sealed decideCandidate
      const { decideCandidate } = await import("./candidate-approval");
      const applicable = pkg.report.anomalies.filter(
        (a) => a.candidate_ids.length === 0 || a.candidate_ids.includes(candidate_id),
      );
      return decideCandidate({
        package: pkg,
        candidateId: candidate_id,
        decision: "approve",
        founderId: "test-approver",
        founderNote: "auto-approve for test",
        acknowledgedAnomalyRules: applicable.map((a) => a.rule),
        decisionTimestamp: "2026-10-08T00:10:00.000Z",
        supersedes: null,
      });
    },
    // Default pool · one strawman entry that will NEVER match the
    // test Candidates (very different name, different city, no
    // coordinates). The resolver will see a non-empty pool, score
    // every entry below 0.55, and return NO_MATCH · unlocking the
    // happy write path. Tests that need AMBIGUOUS or specific pools
    // override this field.
    resolverPoolProvider: async () => [
      {
        canonical_business_id: "strawman-pool-entry-0000",
        entity_type: "food",
        country: "ID",
        name_canonical: "Totally Different Strawman Business",
        name_norm: "totally different strawman business",
        aliases: [],
        phone_e164: null,
        website_apex: null,
        osm_id: null,
        wikidata_qid: null,
        city: "Different-City",
        coordinates: null,
      },
    ],
    sourceRegistryRowProvider: async () => sourceRow(),
    currentCanonicalRowProvider: async () => null,
    osmCollisionProvider: async () => null,
    writeSessionFactory: db.writeFactory,
    readbackSessionFactory: db.readbackFactory,
    expectedFingerprint: EXPECTED_FP,
  };
  return { ...base, ...overrides };
}

// ═════════════════════════════════════════════════════════════════════
// §1 · directory-log · stableStringify + parse/serialize
// ═════════════════════════════════════════════════════════════════════

describe("stableStringify", () => {
  test("sorts object keys alphabetically", () => {
    expect(stableStringify({ b: 1, a: 2 })).toBe('{"a":2,"b":1}');
  });
  test("preserves array order", () => {
    expect(stableStringify([3, 1, 2])).toBe("[3,1,2]");
  });
  test("null handled", () => {
    expect(stableStringify(null)).toBe("null");
  });
});

describe("serializeCheckpointLog / parseCheckpointLog", () => {
  test("round-trips a non-empty log", () => {
    const evs: CheckpointEvent[] = [
      {
        kind: "run_started",
        ts: "2026-10-08T00:00:00.000Z",
        country: "ID",
        sources: ["s1"],
      },
      {
        kind: "source_started",
        ts: "2026-10-08T00:00:01.000Z",
        country: "ID",
        source_id: "s1",
        cursor: null,
      },
    ];
    const text = serializeCheckpointLog(evs);
    const parsed = parseCheckpointLog(text);
    expect(parsed.length).toBe(2);
    expect(parsed[0].kind).toBe("run_started");
    expect(parsed[1].kind).toBe("source_started");
  });

  test("empty log → empty string", () => {
    expect(serializeCheckpointLog([])).toBe("");
  });

  test("parseCheckpointLog rejects invalid JSON with line info", () => {
    try {
      parseCheckpointLog("{bad\n");
      expect.fail("expected throw");
    } catch (e) {
      expect(e).toBeDefined();
      expect(String(e)).toContain("line 1");
    }
  });

  test("parseCheckpointLog rejects non-object line", () => {
    expect(() => parseCheckpointLog("42\n")).toThrow(/kind/);
  });

  test("blank lines tolerated", () => {
    expect(parseCheckpointLog("\n")).toEqual([]);
  });
});

// ═════════════════════════════════════════════════════════════════════
// §2 · directory-log · reducer
// ═════════════════════════════════════════════════════════════════════

describe("reduceCheckpointLog", () => {
  test("empty log → empty derived state", () => {
    const d = reduceCheckpointLog([]);
    expect(d.country).toBeNull();
    expect(d.sources.size).toBe(0);
    expect(d.candidates.size).toBe(0);
    expect(d.country_finished).toBe(false);
  });

  test("run_started registers the country and the source", () => {
    const d = reduceCheckpointLog([
      { kind: "run_started", ts: "t", country: "ID", sources: ["s1"] },
    ]);
    expect(d.country).toBe("ID");
    expect(d.sources.get("s1")?.state).toBe("active");
  });

  test("source_exhausted sets state exhausted", () => {
    const d = reduceCheckpointLog([
      { kind: "run_started", ts: "t", country: "ID", sources: ["s1"] },
      { kind: "source_exhausted", ts: "t", country: "ID", source_id: "s1" },
    ]);
    expect(d.sources.get("s1")?.state).toBe("exhausted");
  });

  test("candidate_written sets outcome and ids", () => {
    const d = reduceCheckpointLog([
      {
        kind: "candidate_written",
        ts: "t",
        candidate_id: "c-1",
        canonical_business_id: "canon-1",
        evidence_id: "ev-1",
        plan_kind: "insert_new",
      },
    ]);
    const c = d.candidates.get("c-1")!;
    expect(c.outcome).toBe("written");
    expect(c.canonical_business_id).toBe("canon-1");
    expect(c.evidence_id).toBe("ev-1");
  });

  test("candidate_quarantined sets terminal outcome", () => {
    const d = reduceCheckpointLog([
      {
        kind: "candidate_quarantined",
        ts: "t",
        candidate_id: "c-1",
        outcome: "resolver_ambiguous",
        reason: "two near-equal scores",
      },
    ]);
    expect(d.candidates.get("c-1")?.outcome).toBe("resolver_ambiguous");
  });

  test("country_finished flips the flag", () => {
    const d = reduceCheckpointLog([
      {
        kind: "country_finished",
        ts: "t",
        country: "ID",
        reason: "all_sources_exhausted",
      },
    ]);
    expect(d.country_finished).toBe(true);
    expect(d.country_finish_reason).toBe("all_sources_exhausted");
  });
});

describe("isCandidateFinal / isCandidateWritten", () => {
  test("pending candidate is not final", () => {
    expect(
      isCandidateFinal({
        candidate_id: "c",
        source_id: null,
        outcome: null,
        canonical_business_id: null,
        evidence_id: null,
        verified: false,
      }),
    ).toBe(false);
  });

  test("written candidate is final AND written", () => {
    const s = {
      candidate_id: "c",
      source_id: null,
      outcome: "written" as CandidateOutcome,
      canonical_business_id: "x",
      evidence_id: "y",
      verified: true,
    };
    expect(isCandidateFinal(s)).toBe(true);
    expect(isCandidateWritten(s)).toBe(true);
  });

  test("quarantined candidate is final but NOT written", () => {
    const s = {
      candidate_id: "c",
      source_id: null,
      outcome: "resolver_ambiguous" as CandidateOutcome,
      canonical_business_id: null,
      evidence_id: null,
      verified: false,
    };
    expect(isCandidateFinal(s)).toBe(true);
    expect(isCandidateWritten(s)).toBe(false);
  });
});

describe("summarizeDerivedState", () => {
  test("empty state → zeros", () => {
    const s = summarizeDerivedState(reduceCheckpointLog([]));
    expect(s.candidate_count_total).toBe(0);
    expect(s.candidate_count_written).toBe(0);
    expect(s.source_count_total).toBe(0);
  });
});

// ═════════════════════════════════════════════════════════════════════
// §3 · directory-source · mock source behaviour
// ═════════════════════════════════════════════════════════════════════

describe("createMockDirectorySource", () => {
  test("returns steps in cursor-matched order", async () => {
    const src = createMockDirectorySource({
      source_id: "s1",
      country: "ID",
      steps: [
        {
          cursor: null,
          result: {
            kind: "more",
            candidates: [cand("c-1")],
            next_cursor: { page: 1 },
          },
        },
        {
          cursor: { page: 1 },
          result: { kind: "exhausted" },
        },
      ],
    });
    const a = await src.discoverBatch(null);
    expect(a.kind).toBe("more");
    const b = await src.discoverBatch({ page: 1 });
    expect(b.kind).toBe("exhausted");
  });

  test("mismatched cursor → permanent_failure", async () => {
    const src = createMockDirectorySource({
      source_id: "s1",
      country: "ID",
      steps: [{ cursor: null, result: { kind: "exhausted" } }],
    });
    const r = await src.discoverBatch({ page: 99 });
    expect(r.kind).toBe("permanent_failure");
  });
});

// ═════════════════════════════════════════════════════════════════════
// §4 · directory-runner · happy path (single candidate, single source)
// ═════════════════════════════════════════════════════════════════════

describe("runDirectoryCountry · happy path", () => {
  test("one candidate · one source · one batch · one exhaust · country finished", async () => {
    const { io: cio, events } = createCheckpointIO();
    const clock = createTickingClock();
    const src = createMockDirectorySource({
      source_id: "nex.food_business",
      country: "ID",
      steps: [
        {
          cursor: null,
          result: { kind: "more", candidates: [cand("c-1")], next_cursor: { p: 1 } },
        },
        { cursor: { p: 1 }, result: { kind: "exhausted" } },
      ],
    });
    const report = await runDirectoryCountry({
      country: "ID",
      io: { ...cio, now: clock.now, sleep: async () => {} },
      deps: makeDeps(src),
    });
    expect(report.country).toBe("ID");
    expect(report.runner_state).toBe("FINISHED_COUNTRY");
    expect(report.summary.candidate_count_written).toBe(1);
    expect(report.summary.candidate_count_total).toBe(1);
    expect(report.summary.source_count_exhausted).toBe(1);
    // country_finished event present
    expect(events.some((e) => e.kind === "country_finished")).toBe(true);
    // candidate_verified present
    expect(events.some((e) => e.kind === "candidate_verified")).toBe(true);
  });
});

// ═════════════════════════════════════════════════════════════════════
// §5 · Source lifecycle · retrying, failed, exhausted
// ═════════════════════════════════════════════════════════════════════

describe("runDirectoryCountry · source lifecycle", () => {
  test("temporary failure then success · source retries and continues", async () => {
    const { io: cio, events } = createCheckpointIO();
    const clock = createTickingClock();
    const src = createMockDirectorySource({
      source_id: "s1",
      country: "ID",
      steps: [
        {
          cursor: null,
          result: { kind: "temporary_failure", reason: "rate limited" },
        },
        {
          cursor: null,
          result: {
            kind: "more",
            candidates: [cand("c-1")],
            next_cursor: { p: 1 },
          },
        },
        { cursor: { p: 1 }, result: { kind: "exhausted" } },
      ],
    });
    const report = await runDirectoryCountry({
      country: "ID",
      config: { ...DEFAULT_RUNNER_CONFIG, maxTemporaryRetries: 2 },
      io: { ...cio, now: clock.now, sleep: async () => {} },
      deps: makeDeps(src),
    });
    expect(events.some((e) => e.kind === "source_retrying")).toBe(true);
    expect(events.some((e) => e.kind === "candidate_written")).toBe(true);
    expect(report.runner_state).toBe("FINISHED_COUNTRY");
  });

  test("temporary failure beyond max retries → source_failed · country finished (all_sources_failed)", async () => {
    const { io: cio, events } = createCheckpointIO();
    const clock = createTickingClock();
    const src = createMockDirectorySource({
      source_id: "s1",
      country: "ID",
      steps: [
        {
          cursor: null,
          result: { kind: "temporary_failure", reason: "down" },
        },
        {
          cursor: null,
          result: { kind: "temporary_failure", reason: "down" },
        },
      ],
    });
    const report = await runDirectoryCountry({
      country: "ID",
      config: { ...DEFAULT_RUNNER_CONFIG, maxTemporaryRetries: 1 },
      io: { ...cio, now: clock.now, sleep: async () => {} },
      deps: makeDeps(src),
    });
    const sourceFailed = events.find((e) => e.kind === "source_failed");
    expect(sourceFailed).toBeDefined();
    const finished = events.find((e) => e.kind === "country_finished");
    expect(finished).toBeDefined();
    if (finished && finished.kind === "country_finished") {
      expect(finished.reason).toBe("all_sources_failed");
    }
    expect(report.summary.candidate_count_written).toBe(0);
  });

  test("permanent failure · source_failed · country still finishes · DOES NOT infinite loop", async () => {
    const { io: cio, events } = createCheckpointIO();
    const clock = createTickingClock();
    const src = createMockDirectorySource({
      source_id: "s1",
      country: "ID",
      steps: [
        {
          cursor: null,
          result: { kind: "permanent_failure", reason: "config error" },
        },
      ],
    });
    const report = await runDirectoryCountry({
      country: "ID",
      io: { ...cio, now: clock.now, sleep: async () => {} },
      deps: makeDeps(src),
    });
    expect(events.some((e) => e.kind === "source_failed")).toBe(true);
    expect(report.summary.candidate_count_written).toBe(0);
    expect(events.some((e) => e.kind === "country_finished")).toBe(true);
  });

  test("exhausted immediately on first fetch · source_exhausted · country finished · zero candidates processed", async () => {
    const { io: cio, events } = createCheckpointIO();
    const clock = createTickingClock();
    const src = createMockDirectorySource({
      source_id: "s1",
      country: "ID",
      steps: [{ cursor: null, result: { kind: "exhausted" } }],
    });
    const report = await runDirectoryCountry({
      country: "ID",
      io: { ...cio, now: clock.now, sleep: async () => {} },
      deps: makeDeps(src),
    });
    expect(events.some((e) => e.kind === "source_exhausted")).toBe(true);
    expect(events.some((e) => e.kind === "country_finished")).toBe(true);
    expect(report.summary.candidate_count_total).toBe(0);
  });
});

// ═════════════════════════════════════════════════════════════════════
// §6 · Candidate isolation · one bad apple does not stop processing
// ═════════════════════════════════════════════════════════════════════

describe("runDirectoryCountry · per-candidate isolation", () => {
  test("shape-rejected candidate quarantined · next candidate still processed", async () => {
    const { io: cio, events } = createCheckpointIO();
    const clock = createTickingClock();
    // Trigger a genuine shape rejection: entity_type outside the
    // sealed 9-value enum. The validator refuses this, the runner
    // emits candidate_shape_rejected, and the next candidate still
    // proceeds through the pipeline.
    const bad = {
      ...cand("bad-1"),
      entity_type: "not-a-sealed-type",
    } as unknown as Candidate;
    const good = cand("good-1");
    const src = createMockDirectorySource({
      source_id: "s1",
      country: "ID",
      steps: [
        {
          cursor: null,
          result: {
            kind: "more",
            candidates: [bad, good],
            next_cursor: { p: 1 },
          },
        },
        { cursor: { p: 1 }, result: { kind: "exhausted" } },
      ],
    });
    const report = await runDirectoryCountry({
      country: "ID",
      io: { ...cio, now: clock.now, sleep: async () => {} },
      deps: makeDeps(src),
    });
    expect(events.some((e) => e.kind === "candidate_shape_rejected")).toBe(true);
    expect(events.some(
      (e) => e.kind === "candidate_written" && e.candidate_id === "good-1",
    )).toBe(true);
    expect(report.summary.candidate_count_written).toBe(1);
  });

  test("approval returns null → candidate quarantined · processing continues", async () => {
    const { io: cio, events } = createCheckpointIO();
    const clock = createTickingClock();
    const src = createMockDirectorySource({
      source_id: "s1",
      country: "ID",
      steps: [
        {
          cursor: null,
          result: {
            kind: "more",
            candidates: [cand("c-1"), cand("c-2")],
            next_cursor: { p: 1 },
          },
        },
        { cursor: { p: 1 }, result: { kind: "exhausted" } },
      ],
    });
    const callCount = { n: 0 };
    const deps = makeDeps(src, {
      approvalProvider: async () => {
        callCount.n++;
        return null; // always defer
      },
    });
    await runDirectoryCountry({
      country: "ID",
      io: { ...cio, now: clock.now, sleep: async () => {} },
      deps,
    });
    expect(callCount.n).toBe(2);
    const quarantined = events.filter((e) => e.kind === "candidate_quarantined");
    expect(quarantined.length).toBeGreaterThanOrEqual(2);
    expect(events.some((e) => e.kind === "candidate_written")).toBe(false);
  });

  test("resolver ambiguous → candidate quarantined · next candidate processed", async () => {
    const { io: cio, events } = createCheckpointIO();
    const clock = createTickingClock();
    const src = createMockDirectorySource({
      source_id: "s1",
      country: "ID",
      steps: [
        {
          cursor: null,
          result: {
            kind: "more",
            candidates: [cand("amb-1"), cand("good-1")],
            next_cursor: { p: 1 },
          },
        },
        { cursor: { p: 1 }, result: { kind: "exhausted" } },
      ],
    });
    const ambId = "amb-1";
    const poolFlag = { first: true };
    const strawman = {
      canonical_business_id: "strawman-pool-entry-0000",
      entity_type: "food" as const,
      country: "ID",
      name_canonical: "Totally Different Strawman Business",
      name_norm: "totally different strawman business",
      aliases: [] as readonly string[],
      phone_e164: null,
      website_apex: null,
      osm_id: null,
      wikidata_qid: null,
      city: "Different-City",
      coordinates: null,
    };
    const deps = makeDeps(src, {
      resolverPoolProvider: async (args) => {
        void args;
        if (poolFlag.first) {
          poolFlag.first = false;
          // Two near-equal matches for amb-1 · produces AMBIGUOUS
          return [
            {
              canonical_business_id: "A",
              entity_type: "food" as const,
              country: "ID",
              name_canonical: "Warung amb-1",
              name_norm: "warung amb 1",
              aliases: ["x"] as readonly string[],
              phone_e164: null,
              website_apex: null,
              osm_id: null,
              wikidata_qid: null,
              city: "Bandung",
              coordinates: { lat: -6.9, lng: 107.6 },
            },
            {
              canonical_business_id: "B",
              entity_type: "food" as const,
              country: "ID",
              name_canonical: "Warung amb-1",
              name_norm: "warung amb 1",
              aliases: ["x"] as readonly string[],
              phone_e164: null,
              website_apex: null,
              osm_id: null,
              wikidata_qid: null,
              city: "Bandung",
              coordinates: { lat: -6.9, lng: 107.6 },
            },
          ];
        }
        // For good-1: strawman pool · resolver returns NO_MATCH
        return [strawman];
      },
    });
    await runDirectoryCountry({
      country: "ID",
      io: { ...cio, now: clock.now, sleep: async () => {} },
      deps,
    });
    // amb-1 was quarantined as resolver_ambiguous
    const ambQuar = events.find(
      (e) =>
        e.kind === "candidate_quarantined" &&
        e.candidate_id === ambId &&
        e.outcome === "resolver_ambiguous",
    );
    expect(ambQuar).toBeDefined();
    // good-1 was still written
    expect(events.some(
      (e) => e.kind === "candidate_written" && e.candidate_id === "good-1",
    )).toBe(true);
  });

  test("resolver abstains (empty pool + no signals) · quarantined · next candidate still runs", async () => {
    const { io: cio, events } = createCheckpointIO();
    const clock = createTickingClock();
    const noSignal: Candidate = {
      ...cand("ns-1"),
      identity: {
        name_canonical: "Nameless",
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
        coordinates: null, // no medium signal → abstained(insufficient_signal)
      },
    };
    const src = createMockDirectorySource({
      source_id: "s1",
      country: "ID",
      steps: [
        {
          cursor: null,
          result: {
            kind: "more",
            candidates: [noSignal, cand("ok-1")],
            next_cursor: { p: 1 },
          },
        },
        { cursor: { p: 1 }, result: { kind: "exhausted" } },
      ],
    });
    await runDirectoryCountry({
      country: "ID",
      io: { ...cio, now: clock.now, sleep: async () => {} },
      deps: makeDeps(src),
    });
    const abs = events.find(
      (e) => e.kind === "candidate_resolver_abstained" && e.candidate_id === "ns-1",
    );
    expect(abs).toBeDefined();
    expect(events.some(
      (e) => e.kind === "candidate_written" && e.candidate_id === "ok-1",
    )).toBe(true);
  });
});

// ═════════════════════════════════════════════════════════════════════
// §7 · Resume dedup · already-written candidate skipped
// ═════════════════════════════════════════════════════════════════════

describe("runDirectoryCountry · resume dedup", () => {
  test("candidate already in the log as written is skipped on second run", async () => {
    const existing: CheckpointEvent[] = [
      {
        kind: "candidate_written",
        ts: "2026-10-08T00:00:00.000Z",
        candidate_id: "c-1",
        canonical_business_id: "canon-prev",
        evidence_id: "ev-prev",
        plan_kind: "insert_new",
      },
    ];
    const events: CheckpointEvent[] = [...existing];
    const io: Pick<RunnerIO, "checkpointAppend" | "checkpointLoad"> = {
      checkpointAppend: async (e) => {
        events.push(e);
      },
      checkpointLoad: async () => [...events],
    };
    const clock = createTickingClock();
    const src = createMockDirectorySource({
      source_id: "s1",
      country: "ID",
      steps: [
        {
          cursor: null,
          result: {
            kind: "more",
            candidates: [cand("c-1"), cand("c-2")],
            next_cursor: { p: 1 },
          },
        },
        { cursor: { p: 1 }, result: { kind: "exhausted" } },
      ],
    });
    await runDirectoryCountry({
      country: "ID",
      io: { ...io, now: clock.now, sleep: async () => {} },
      deps: makeDeps(src),
    });
    const dupSkipped = events.filter(
      (e) => e.kind === "candidate_duplicate_skipped" && e.candidate_id === "c-1",
    );
    expect(dupSkipped.length).toBe(1);
    const writtenC1 = events.filter(
      (e) =>
        e.kind === "candidate_written" &&
        e.candidate_id === "c-1" &&
        e.ts !== "2026-10-08T00:00:00.000Z",
    );
    expect(writtenC1.length).toBe(0);
    // c-2 was still processed
    expect(events.some(
      (e) => e.kind === "candidate_written" && e.candidate_id === "c-2",
    )).toBe(true);
  });
});

// ═════════════════════════════════════════════════════════════════════
// §8 · Observability · every meaningful transition is in the log
// ═════════════════════════════════════════════════════════════════════

describe("runDirectoryCountry · observability", () => {
  test("happy flow produces discovery → review → decision → resolve → precheck → write → verify events", async () => {
    const { io: cio, events } = createCheckpointIO();
    const clock = createTickingClock();
    const src = createMockDirectorySource({
      source_id: "s1",
      country: "ID",
      steps: [
        {
          cursor: null,
          result: {
            kind: "more",
            candidates: [cand("c-1")],
            next_cursor: { p: 1 },
          },
        },
        { cursor: { p: 1 }, result: { kind: "exhausted" } },
      ],
    });
    await runDirectoryCountry({
      country: "ID",
      io: { ...cio, now: clock.now, sleep: async () => {} },
      deps: makeDeps(src),
    });
    const kinds = events.map((e) => e.kind);
    expect(kinds).toContain("candidate_discovered");
    expect(kinds).toContain("candidate_reviewed");
    expect(kinds).toContain("candidate_decided");
    expect(kinds).toContain("candidate_resolved");
    expect(kinds).toContain("candidate_precheck_passed");
    expect(kinds).toContain("candidate_written");
    expect(kinds).toContain("candidate_verified");
  });

  test("summarizeDerivedState reflects the written candidate", async () => {
    const { io: cio, events } = createCheckpointIO();
    const clock = createTickingClock();
    const src = createMockDirectorySource({
      source_id: "s1",
      country: "ID",
      steps: [
        {
          cursor: null,
          result: {
            kind: "more",
            candidates: [cand("c-1")],
            next_cursor: { p: 1 },
          },
        },
        { cursor: { p: 1 }, result: { kind: "exhausted" } },
      ],
    });
    await runDirectoryCountry({
      country: "ID",
      io: { ...cio, now: clock.now, sleep: async () => {} },
      deps: makeDeps(src),
    });
    const summary = summarizeDerivedState(reduceCheckpointLog(events));
    expect(summary.candidate_count_written).toBe(1);
    expect(summary.candidate_count_pending).toBe(0);
    expect(summary.country_finished).toBe(true);
  });
});

// ═════════════════════════════════════════════════════════════════════
// §9 · Source permission denied is isolated per candidate
// ═════════════════════════════════════════════════════════════════════

describe("runDirectoryCountry · source permission", () => {
  test("source with can_derive=false → candidates quarantined · country still processes", async () => {
    const { io: cio, events } = createCheckpointIO();
    const clock = createTickingClock();
    const src = createMockDirectorySource({
      source_id: "s1",
      country: "ID",
      steps: [
        {
          cursor: null,
          result: {
            kind: "more",
            candidates: [cand("c-1")],
            next_cursor: { p: 1 },
          },
        },
        { cursor: { p: 1 }, result: { kind: "exhausted" } },
      ],
    });
    const deps = makeDeps(src, {
      sourceRegistryRowProvider: async () => ({
        ...sourceRow(),
        can_derive: false,
      }),
    });
    await runDirectoryCountry({
      country: "ID",
      io: { ...cio, now: clock.now, sleep: async () => {} },
      deps,
    });
    expect(events.some(
      (e) =>
        e.kind === "candidate_precheck_blocked" &&
        e.reason_kind === "source_permission_denied",
    )).toBe(true);
    expect(events.some((e) => e.kind === "candidate_written")).toBe(false);
    // Source still exhausted · country still finishes.
    expect(events.some((e) => e.kind === "country_finished")).toBe(true);
  });
});

// ═════════════════════════════════════════════════════════════════════
// §10 · Pure-module grep invariants
// ═════════════════════════════════════════════════════════════════════

describe("directory-runner source · scope invariants", () => {
  const srcPath = path.join(__dirname, "directory-runner.ts");
  const src = fs.readFileSync(srcPath, "utf8");
  const code = src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/[^\n]*/g, "");

  test("runner does NOT import pg · DB access is injected", () => {
    expect(code).not.toMatch(/from\s+["']pg["']/);
  });

  test("runner does NOT invoke Layer A (identity-matching / entity-universe / matchBusiness)", () => {
    expect(code).not.toMatch(/identity-matching/);
    expect(code).not.toMatch(/entity-universe/);
    expect(code).not.toMatch(/\bmatchBusiness\s*\(/);
  });

  test("runner does NOT emit INSERT/UPDATE/DELETE/DDL · it delegates to executeWritePlan", () => {
    expect(code).not.toMatch(/\bINSERT\s+INTO\b/i);
    expect(code).not.toMatch(/\bUPDATE\s+\w+\s+SET\b/i);
    expect(code).not.toMatch(/\bDELETE\s+FROM\b/i);
    expect(code).not.toMatch(/\bCREATE\s+TABLE\b/i);
    expect(code).not.toMatch(/\bALTER\s+TABLE\b/i);
    expect(code).not.toMatch(/\bDROP\s+TABLE\b/i);
  });

  test("runner does NOT read env or filesystem for credentials", () => {
    expect(code).not.toMatch(/process\.env/);
    expect(code).not.toMatch(/\bfs\.readFile/);
    expect(code).not.toMatch(/\bfs\.writeFile/);
    expect(code).not.toMatch(/dotenv/);
  });

  test("runner does NOT build its own clock · everything times via io.now()", () => {
    expect(code).not.toMatch(/\bnew\s+Date\b/);
    expect(code).not.toMatch(/\bDate\.now\s*\(/);
  });

  test("directory-log source is pure · no DB · no fs · no network", () => {
    const logSrcPath = path.join(__dirname, "directory-log.ts");
    const logSrc = fs.readFileSync(logSrcPath, "utf8");
    const logCode = logSrc
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/[^\n]*/g, "");
    expect(logCode).not.toMatch(/from\s+["']pg["']/);
    expect(logCode).not.toMatch(/process\.env/);
    expect(logCode).not.toMatch(/\bfs\./);
    expect(logCode).not.toMatch(/\bnew\s+Date\b/);
  });

  test("directory-source source is pure · no DB · no fs · no network", () => {
    const srcSrcPath = path.join(__dirname, "directory-source.ts");
    const srcSrc = fs.readFileSync(srcSrcPath, "utf8");
    const srcCode = srcSrc
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/[^\n]*/g, "");
    expect(srcCode).not.toMatch(/from\s+["']pg["']/);
    expect(srcCode).not.toMatch(/process\.env/);
    expect(srcCode).not.toMatch(/\bfs\./);
  });
});

// ═════════════════════════════════════════════════════════════════════
// §11 · Default config invariants
// ═════════════════════════════════════════════════════════════════════

describe("DEFAULT_RUNNER_CONFIG", () => {
  test("is Object.freeze'd", () => {
    expect(Object.isFrozen(DEFAULT_RUNNER_CONFIG)).toBe(true);
  });

  test("has positive caps and non-negative backoff", () => {
    expect(DEFAULT_RUNNER_CONFIG.maxBatchesPerSource).toBeGreaterThan(0);
    expect(DEFAULT_RUNNER_CONFIG.maxCandidatesPerSource).toBeGreaterThan(0);
    expect(DEFAULT_RUNNER_CONFIG.maxTemporaryRetries).toBeGreaterThanOrEqual(0);
    expect(DEFAULT_RUNNER_CONFIG.retryBaseDelayMs).toBeGreaterThanOrEqual(0);
  });
});

// ═════════════════════════════════════════════════════════════════════
// §12 · No-false-completion rule
// ═════════════════════════════════════════════════════════════════════

describe("runDirectoryCountry · no false completion", () => {
  test("empty batch is NOT country completion · source must explicitly exhaust", async () => {
    const { io: cio, events } = createCheckpointIO();
    const clock = createTickingClock();
    const src = createMockDirectorySource({
      source_id: "s1",
      country: "ID",
      steps: [
        {
          cursor: null,
          result: { kind: "more", candidates: [], next_cursor: null },
        },
        { cursor: null, result: { kind: "exhausted" } },
      ],
    });
    const report = await runDirectoryCountry({
      country: "ID",
      io: { ...cio, now: clock.now, sleep: async () => {} },
      deps: makeDeps(src),
    });
    // Country finishes only AFTER the explicit exhausted event.
    const batchFetched = events.filter(
      (e) => e.kind === "source_batch_fetched",
    );
    expect(batchFetched.length).toBeGreaterThanOrEqual(1);
    expect(events.some((e) => e.kind === "source_exhausted")).toBe(true);
    expect(events.some((e) => e.kind === "country_finished")).toBe(true);
    expect(report.summary.candidate_count_total).toBe(0);
  });
});
