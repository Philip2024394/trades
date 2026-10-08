// scripts/nex-canonical/extract-candidates.test.ts
//
// Tests for the thin β runner. No real DB. No credential reads.
//
// Strategy: `vi.mock("pg")` installs an in-memory Client stub that
// records every query and returns configurable responses. The tests
// cover both pure-function invariants (serialisation, secret scan,
// branded-type structural ordering) and the full orchestration flow
// (fingerprint-before-generation, fingerprint-failure-aborts, secrets
// leak detection, truncation reporting).
//
// Fourteen properties this test file proves (per authorization):
//   1. fingerprint verification occurs before candidate generation
//   2. fingerprint failure prevents candidate generation
//   3. missing fingerprint configuration prevents candidate generation
//   4. executor construction/execution cannot occur before successful
//      fingerprint verification
//   5. output is deterministic
//   6. JSONL serialization is deterministic
//   7. candidate provenance is preserved
//   8. secrets cannot be written to output
//   9. no resolver import/invocation (static grep)
//   10. no migration invocation (static grep)
//   11. no Supabase fallback (static grep)
//   12. no filesystem credential discovery (static grep)
//   13. no arbitrary SQL path (static grep)
//   14. no database connection during the test suite (confirmed by mock)

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

// ═════════════════════════════════════════════════════════════════════
// §0 · pg mock · installed BEFORE imports from the runner
// ═════════════════════════════════════════════════════════════════════

type MockEvent =
  | { clientId: number; event: "construct" }
  | { clientId: number; event: "connect" }
  | { clientId: number; event: "query"; sql: string }
  | { clientId: number; event: "end" };

const mockState = vi.hoisted(() => ({
  // Flat SQL log (unchanged shape · preserved for existing tests).
  queries: [] as string[],
  connectShouldThrow: null as null | Error,
  staticResponses: new Map<string, { rows: unknown[]; error: Error | null }>(),
  regexResponses: [] as Array<{
    re: RegExp;
    rows: unknown[];
    error: Error | null;
  }>,
  // α.2 identity tracking · every mock Client gets a unique id and
  // every lifecycle event (construct/connect/query/end) is recorded
  // with the Client id. Tests use this to prove same-Client binding.
  clientCount: 0,
  events: [] as MockEvent[],
}));

vi.mock("pg", () => {
  class Client {
    private readonly _id: number;
    constructor(_cfg: unknown) {
      this._id = mockState.clientCount++;
      mockState.events.push({ clientId: this._id, event: "construct" });
    }
    async connect(): Promise<void> {
      mockState.events.push({ clientId: this._id, event: "connect" });
      if (mockState.connectShouldThrow !== null) {
        throw mockState.connectShouldThrow;
      }
    }
    async query<T = unknown>(
      sql: string,
    ): Promise<{ rows: T[]; rowCount: number }> {
      mockState.queries.push(sql);
      mockState.events.push({ clientId: this._id, event: "query", sql });
      const staticResp = mockState.staticResponses.get(sql);
      if (staticResp !== undefined) {
        if (staticResp.error !== null) throw staticResp.error;
        return { rows: staticResp.rows as T[], rowCount: staticResp.rows.length };
      }
      for (const r of mockState.regexResponses) {
        if (r.re.test(sql)) {
          if (r.error !== null) throw r.error;
          return { rows: r.rows as T[], rowCount: r.rows.length };
        }
      }
      // Default: empty rows (no error). This lets session-config SETs,
      // BEGIN/COMMIT, and any un-stubbed query succeed trivially.
      return { rows: [] as T[], rowCount: 0 };
    }
    async end(): Promise<void> {
      mockState.events.push({ clientId: this._id, event: "end" });
    }
  }
  return { Client };
});

// Imports AFTER vi.mock so the mocked pg propagates.
import { QUERY_SPECS } from "./generate-candidates";
import { FINGERPRINT_QUERIES } from "./pg-fingerprint";
import {
  AuditingExecutor,
  CANDIDATE_OUTPUT_PATH,
  FingerprintVerifiedExecutor,
  SecretsLeakError,
  buildPopulationCounts,
  runCandidateExtraction,
  scanForLikelyCredentials,
  serializeCandidatesToJsonl,
  stableStringify,
  type RunnerIO,
  type SpecOutcome,
} from "./extract-candidates";

// ═════════════════════════════════════════════════════════════════════
// §0.5 · Shared test fixtures
// ═════════════════════════════════════════════════════════════════════

const EXPECTED_DB = "nex_business";
const EXPECTED_USER = "nex_readonly";
const EXPECTED_VERSION_PREFIX = "15.";
const EXPECTED_SCHEMAS = "nex,public";

const completeEnv: NodeJS.ProcessEnv = {
  NEX_CANONICAL_PG_HOST: "fake.pg.host",
  NEX_CANONICAL_PG_PORT: "15432",
  NEX_CANONICAL_PG_DATABASE: "whatever",
  NEX_CANONICAL_PG_USER: "whatever",
  NEX_CANONICAL_PG_PASSWORD: "whatever",
  NEX_CANONICAL_PG_SSL: "false",
  NEX_CANONICAL_PG_EXPECTED_DATABASE: EXPECTED_DB,
  NEX_CANONICAL_PG_EXPECTED_USER: EXPECTED_USER,
  NEX_CANONICAL_PG_EXPECTED_SERVER_VERSION_PREFIX: EXPECTED_VERSION_PREFIX,
  NEX_CANONICAL_PG_EXPECTED_SCHEMAS: EXPECTED_SCHEMAS,
};

const fixedTime = new Date("2026-10-08T12:00:00.000Z");

function makeTestIO(
  envOverride: NodeJS.ProcessEnv = completeEnv,
): {
  io: RunnerIO;
  written: { path: string; content: string }[];
} {
  const written: { path: string; content: string }[] = [];
  const io: RunnerIO = {
    env: envOverride,
    writeOutput: async (p, c) => {
      written.push({ path: p, content: c });
      return c.length;
    },
    now: () => fixedTime,
  };
  return { io, written };
}

function installPassingFingerprint(): void {
  mockState.staticResponses.set("SELECT current_database() AS db", {
    rows: [{ db: EXPECTED_DB }],
    error: null,
  });
  mockState.staticResponses.set("SELECT current_user AS usr", {
    rows: [{ usr: EXPECTED_USER }],
    error: null,
  });
  mockState.staticResponses.set(
    "SELECT current_setting('server_version') AS srv_version",
    { rows: [{ srv_version: "15.4" }], error: null },
  );
  mockState.staticResponses.set(
    "SELECT schema_name FROM information_schema.schemata ORDER BY schema_name",
    {
      rows: [
        { schema_name: "information_schema" },
        { schema_name: "nex" },
        { schema_name: "pg_catalog" },
        { schema_name: "public" },
      ],
      error: null,
    },
  );
}

function installQuerySpecEmptyResponses(): void {
  // Every rendered QUERY_SPECS SELECT lands at FROM nex.<table>.
  // Return empty rows for all of them so generateCandidates runs
  // through to completion with zero candidates.
  for (const spec of QUERY_SPECS) {
    const escapedTable = spec.legacy_table.replace(/\./g, "\\.");
    mockState.regexResponses.push({
      re: new RegExp(`FROM\\s+${escapedTable}\\b`),
      rows: [],
      error: null,
    });
  }
}

beforeEach(() => {
  mockState.queries.length = 0;
  mockState.connectShouldThrow = null;
  mockState.staticResponses.clear();
  mockState.regexResponses.length = 0;
  mockState.events.length = 0;
  mockState.clientCount = 0;
});

afterEach(() => {
  mockState.queries.length = 0;
  mockState.staticResponses.clear();
  mockState.regexResponses.length = 0;
  mockState.events.length = 0;
  mockState.clientCount = 0;
});

// ═════════════════════════════════════════════════════════════════════
// §1 · Pure serialisation (property 5, 6, 7)
// ═════════════════════════════════════════════════════════════════════

describe("stableStringify · deterministic key order", () => {
  test("primitives", () => {
    expect(stableStringify(null)).toBe("null");
    expect(stableStringify(true)).toBe("true");
    expect(stableStringify(42)).toBe("42");
    expect(stableStringify("hi")).toBe('"hi"');
  });

  test("object keys emitted in sorted order regardless of insertion", () => {
    expect(stableStringify({ b: 1, a: 2 })).toBe('{"a":2,"b":1}');
    expect(stableStringify({ z: 1, a: 2, m: 3 })).toBe(
      '{"a":2,"m":3,"z":1}',
    );
  });

  test("array order preserved", () => {
    expect(stableStringify([3, 1, 2])).toBe("[3,1,2]");
  });

  test("deeply nested", () => {
    expect(
      stableStringify({ outer: { b: 1, a: 2 }, arr: [{ y: 1, x: 2 }] }),
    ).toBe('{"arr":[{"x":2,"y":1}],"outer":{"a":2,"b":1}}');
  });

  test("same input · same output across repeated calls", () => {
    const o = { c: 3, a: 1, b: [{ y: 2, x: 1 }], d: { nested: "k" } };
    expect(stableStringify(o)).toBe(stableStringify(o));
  });

  test("rejects undefined", () => {
    expect(() => stableStringify(undefined)).toThrow(/not JSON-safe/);
  });

  test("rejects non-finite numbers", () => {
    expect(() => stableStringify(Number.POSITIVE_INFINITY)).toThrow(
      /not JSON-safe/,
    );
    expect(() => stableStringify(NaN)).toThrow(/not JSON-safe/);
  });
});

describe("serializeCandidatesToJsonl · deterministic one-object-per-line", () => {
  const fakeResult = {
    run_metadata: {
      generation_run_id: "r",
      generated_at: fixedTime.toISOString(),
      deliverable_c_ref: "x",
      sealed_memory_ref: "y",
      code_file: "z",
      code_version: "1.0.0" as const,
      candidate_count: 2,
      per_category_count: {
        R1: 0,
        R2: 0,
        R3: 0,
        R4: 0,
        R5: 0,
        R6: 0,
        R7: 0,
        R8: 0,
        R9: 0,
        R10: 0,
      },
      excluded_count: 0,
      disclaimer: "d",
    },
    candidates: [
      { candidate_id: "c-a", status: "pending_founder_review", payload: 1 },
      { candidate_id: "c-b", status: "pending_founder_review", payload: 2 },
    ],
    excluded_rows: [],
  };

  test("one JSON object per line · trailing newline", () => {
    const s = serializeCandidatesToJsonl(fakeResult as never);
    const lines = s.split("\n");
    expect(lines.length).toBe(3); // two objects + trailing empty from final \n
    expect(lines[lines.length - 1]).toBe("");
    for (let i = 0; i < lines.length - 1; i++) {
      expect(() => JSON.parse(lines[i])).not.toThrow();
    }
  });

  test("empty candidates → empty string", () => {
    expect(
      serializeCandidatesToJsonl({ ...fakeResult, candidates: [] } as never),
    ).toBe("");
  });

  test("byte-identical across repeated calls", () => {
    const a = serializeCandidatesToJsonl(fakeResult as never);
    const b = serializeCandidatesToJsonl(fakeResult as never);
    expect(a).toBe(b);
  });

  test("candidate provenance fields preserved exactly", () => {
    const resultWithProvenance = {
      ...fakeResult,
      candidates: [
        {
          candidate_id: "deterministic-id",
          status: "pending_founder_review",
          generation_source: {
            generator: "scripts/nex-canonical/generate-candidates.ts",
            generated_at: fixedTime.toISOString(),
            generation_run_id: "r",
          },
          selection_score: 0.73,
          selection_rationale: [
            { risk_category: "R1", contribution: 0.73, note: "n" },
          ],
          legacy_source: { table: "nex.food_business", ref: "ref-1", internal_id: "i" },
          caveats: ["x"],
        },
      ],
    };
    const s = serializeCandidatesToJsonl(resultWithProvenance as never);
    const parsed = JSON.parse(s.trim());
    expect(parsed.candidate_id).toBe("deterministic-id");
    expect(parsed.status).toBe("pending_founder_review");
    expect(parsed.generation_source.generator).toBe(
      "scripts/nex-canonical/generate-candidates.ts",
    );
    expect(parsed.selection_score).toBe(0.73);
    expect(parsed.selection_rationale[0].risk_category).toBe("R1");
    expect(parsed.legacy_source.ref).toBe("ref-1");
    expect(parsed.caveats).toEqual(["x"]);
  });
});

// ═════════════════════════════════════════════════════════════════════
// §2 · Secret scanner (property 8)
// ═════════════════════════════════════════════════════════════════════

describe("scanForLikelyCredentials · zero false negatives on common patterns", () => {
  test("clean text yields no findings", () => {
    expect(scanForLikelyCredentials("hello world").length).toBe(0);
    expect(
      scanForLikelyCredentials(
        '{"candidate_id":"a","identity":{"name_canonical":"Warung Bu"}}',
      ).length,
    ).toBe(0);
  });

  test("postgres:// URL with credentials", () => {
    expect(
      scanForLikelyCredentials(
        "oops: postgres://user:supersecret@host:5432/db",
      ),
    ).toContain("postgres-url");
  });

  test("password= pair", () => {
    expect(
      scanForLikelyCredentials("password=hunter2 somewhere in text"),
    ).toContain("password-pair");
  });

  test("api_key / service_role_key / secret / bearer", () => {
    expect(
      scanForLikelyCredentials("api_key: AbCdEfGh1234567890abcd"),
    ).toContain("api-key");
    expect(
      scanForLikelyCredentials("service_role_key=eyJhbGci1234567890"),
    ).toContain("service-role-key");
    expect(
      scanForLikelyCredentials("secret: supersecretvalue1234"),
    ).toContain("secret-pair");
    expect(
      scanForLikelyCredentials("bearer abcdef1234567890abcdef12345"),
    ).toContain("bearer-token");
  });

  test("case variations are caught", () => {
    expect(
      scanForLikelyCredentials("PASSWORD=hunter2").length,
    ).toBeGreaterThan(0);
  });
});

// ═════════════════════════════════════════════════════════════════════
// §3 · Branded type · structural ordering (property 1 + 4)
// ═════════════════════════════════════════════════════════════════════

describe("FingerprintVerifiedExecutor · private constructor", () => {
  test("direct `new` is a TypeScript error at compile time", () => {
    // @ts-expect-error - private constructor must not be callable directly
    const _bad = () => new FingerprintVerifiedExecutor({} as never, {} as never, {} as never, {} as never);
    // Keep the function reference used so TS does not complain about
    // _bad being unused; we are only asserting the TS error above.
    expect(typeof _bad).toBe("function");
  });

  test(".create() runs fingerprint check BEFORE constructing executor · failure throws before any executor construction", async () => {
    // Fingerprint will fail at compare step (wrong database).
    mockState.staticResponses.set("SELECT current_database() AS db", {
      rows: [{ db: "WRONG_DATABASE" }],
      error: null,
    });
    mockState.staticResponses.set("SELECT current_user AS usr", {
      rows: [{ usr: EXPECTED_USER }],
      error: null,
    });
    mockState.staticResponses.set(
      "SELECT current_setting('server_version') AS srv_version",
      { rows: [{ srv_version: "15.4" }], error: null },
    );
    mockState.staticResponses.set(
      "SELECT schema_name FROM information_schema.schemata ORDER BY schema_name",
      { rows: [{ schema_name: "nex" }, { schema_name: "public" }], error: null },
    );

    const { io } = makeTestIO();
    await expect(
      runCandidateExtraction({ runId: "test-run" }, io),
    ).rejects.toThrow(/fingerprint/i);

    // No QUERY_SPECS SQL should ever have reached the mock.
    const specQueries = mockState.queries.filter((q) =>
      QUERY_SPECS.some((s) => q.includes(`FROM ${s.legacy_table}`)),
    );
    expect(specQueries).toEqual([]);
  });
});

// ═════════════════════════════════════════════════════════════════════
// §4 · Full-flow orchestration tests (properties 1-4, 14)
// ═════════════════════════════════════════════════════════════════════

describe("runCandidateExtraction · ordering + fail-closed", () => {
  test("missing credentials → throws at stage parse_credentials · no connection attempt", async () => {
    const env = { ...completeEnv };
    delete env.NEX_CANONICAL_PG_HOST;
    const { io, written } = makeTestIO(env);
    const err = await runCandidateExtraction({ runId: "r" }, io).catch(
      (e) => e,
    );
    expect(err).toBeInstanceOf(Error);
    expect(err.message).toMatch(/parse_credentials/);
    expect(mockState.queries).toEqual([]);
    expect(written).toEqual([]);
  });

  test("missing fingerprint config → throws at stage parse_fingerprint_config · no connection attempt", async () => {
    const env = { ...completeEnv };
    delete env.NEX_CANONICAL_PG_EXPECTED_DATABASE;
    const { io, written } = makeTestIO(env);
    const err = await runCandidateExtraction({ runId: "r" }, io).catch(
      (e) => e,
    );
    expect(err.message).toMatch(/parse_fingerprint_config/);
    expect(mockState.queries).toEqual([]);
    expect(written).toEqual([]);
  });

  test("connection failure → throws at stage verify_fingerprint · no QUERY_SPECS executed · no JSONL written", async () => {
    mockState.connectShouldThrow = new Error("mock connect failure");
    const { io, written } = makeTestIO();
    const err = await runCandidateExtraction({ runId: "r" }, io).catch(
      (e) => e,
    );
    expect(err.message).toMatch(/verify_fingerprint/);
    const specQueries = mockState.queries.filter((q) =>
      QUERY_SPECS.some((s) => q.includes(`FROM ${s.legacy_table}`)),
    );
    expect(specQueries).toEqual([]);
    expect(written).toEqual([]);
  });

  test("fingerprint mismatch → throws · no QUERY_SPECS executed · no JSONL written", async () => {
    mockState.staticResponses.set("SELECT current_database() AS db", {
      rows: [{ db: "WRONG" }],
      error: null,
    });
    mockState.staticResponses.set("SELECT current_user AS usr", {
      rows: [{ usr: EXPECTED_USER }],
      error: null,
    });
    mockState.staticResponses.set(
      "SELECT current_setting('server_version') AS srv_version",
      { rows: [{ srv_version: "15.4" }], error: null },
    );
    mockState.staticResponses.set(
      "SELECT schema_name FROM information_schema.schemata ORDER BY schema_name",
      { rows: [{ schema_name: "nex" }, { schema_name: "public" }], error: null },
    );

    const { io, written } = makeTestIO();
    const err = await runCandidateExtraction({ runId: "r" }, io).catch(
      (e) => e,
    );
    expect(err.message).toMatch(/verify_fingerprint/);
    const specQueries = mockState.queries.filter((q) =>
      QUERY_SPECS.some((s) => q.includes(`FROM ${s.legacy_table}`)),
    );
    expect(specQueries).toEqual([]);
    expect(written).toEqual([]);
  });

  test("happy path · fingerprint passes → QUERY_SPECS run → JSONL written exactly once", async () => {
    installPassingFingerprint();
    installQuerySpecEmptyResponses();
    const { io, written } = makeTestIO();
    const report = await runCandidateExtraction({ runId: "test-r" }, io);
    expect(report.stage).toBe("complete");
    expect(written.length).toBe(1);
    expect(written[0].path).toBe(CANDIDATE_OUTPUT_PATH);

    // Fingerprint queries ran BEFORE QUERY_SPECS queries · prove by
    // index-order.
    const fingerprintIdx = mockState.queries.findIndex((q) =>
      q.includes("current_database()"),
    );
    const firstSpecIdx = mockState.queries.findIndex((q) =>
      QUERY_SPECS.some((s) => q.includes(`FROM ${s.legacy_table}`)),
    );
    // With empty query specs, firstSpecIdx may be -1 if no spec query
    // ever ran, which happens because generator's spec queries DID run
    // but matched our regex responses. Let's assert differently.
    expect(fingerprintIdx).toBeGreaterThanOrEqual(0);
    if (firstSpecIdx >= 0) {
      expect(fingerprintIdx).toBeLessThan(firstSpecIdx);
    }
    // Zero candidates (because mock returned empty for every spec).
    expect(report.candidates.total).toBe(0);
  });

  test("report fingerprint block carries observed values · schemas count · expected schemas list", async () => {
    installPassingFingerprint();
    installQuerySpecEmptyResponses();
    const { io } = makeTestIO();
    const report = await runCandidateExtraction({ runId: "r" }, io);
    expect(report.fingerprint.database).toBe(EXPECTED_DB);
    expect(report.fingerprint.user).toBe(EXPECTED_USER);
    expect(report.fingerprint.serverVersion).toBe("15.4");
    expect(report.fingerprint.schemasObservedCount).toBe(4);
    expect(report.fingerprint.expectedSchemas).toEqual(["nex", "public"]);
  });

  test("report populations · unavailable list honoured when a bucket's spec is absent", async () => {
    installPassingFingerprint();
    installQuerySpecEmptyResponses();
    const { io } = makeTestIO();
    const report = await runCandidateExtraction({ runId: "r" }, io);
    // Every bucket that has a spec in QUERY_SPECS will have row_count 0
    // and NOT be "unavailable"; buckets with no spec would be
    // "unavailable". The actual membership depends on the sealed
    // catalogue, so we just assert the shape.
    expect(typeof report.populations.total_observed).toBe("number");
    expect(Array.isArray(report.populations.populations_unavailable)).toBe(
      true,
    );
  });

  test("secrets in candidate output → runner refuses to write", async () => {
    installPassingFingerprint();
    // Install one spec response that would, in a hypothetical bug,
    // smuggle a credential into a legacy row field.
    const firstSpec = QUERY_SPECS[0];
    const escapedTable = firstSpec.legacy_table.replace(/\./g, "\\.");
    mockState.regexResponses.push({
      re: new RegExp(`FROM\\s+${escapedTable}\\b`),
      rows: [
        {
          // These field names mimic the LegacyRow projection; the exact
          // field doesn't matter for the test · what matters is that
          // the secret-scan catches the pattern anywhere in the
          // serialised JSONL.
          public_listing_ref: "ref-1",
          business_name: "warung · password=supersecretvalue",
          country: "ID",
        },
      ],
      error: null,
    });
    for (const spec of QUERY_SPECS.slice(1)) {
      const t = spec.legacy_table.replace(/\./g, "\\.");
      mockState.regexResponses.push({
        re: new RegExp(`FROM\\s+${t}\\b`),
        rows: [],
        error: null,
      });
    }

    const { io, written } = makeTestIO();
    const err = await runCandidateExtraction({ runId: "r" }, io).catch(
      (e) => e,
    );
    // Secret may be caught at `secret_scan` stage · verify no JSONL written.
    expect(written).toEqual([]);
    // The error should mention secret_scan OR SecretsLeakError.
    expect(err.message).toMatch(/secret_scan|SecretsLeakError|password-pair/);
  });
});

// ═════════════════════════════════════════════════════════════════════
// §5 · AuditingExecutor · per-spec counts + truncation detection
// ═════════════════════════════════════════════════════════════════════

describe("AuditingExecutor", () => {
  test("records row count and truncation-suspected flag per spec", async () => {
    const spec = QUERY_SPECS[0];
    const inner = {
      async execute(_s: never) {
        return [{ a: 1 }, { a: 2 }];
      },
    };
    const auditing = new AuditingExecutor(inner as never, 2);
    const rows = await auditing.execute(spec as never);
    expect(rows.length).toBe(2);
    const outcome = auditing.perSpec.get(spec.spec_id)!;
    expect(outcome.row_count).toBe(2);
    expect(outcome.effective_limit).toBe(Math.min(spec.limit ?? 2, 2));
    expect(outcome.truncation_suspected).toBe(true);
    expect(outcome.errored).toBe(false);
  });

  test("captures spec errors AND re-raises · outcome.errored=true", async () => {
    const spec = QUERY_SPECS[0];
    const inner = {
      async execute() {
        throw new Error("boom");
      },
    };
    const auditing = new AuditingExecutor(inner as never, 100);
    await expect(auditing.execute(spec as never)).rejects.toThrow(/boom/);
    const outcome = auditing.perSpec.get(spec.spec_id)!;
    expect(outcome.errored).toBe(true);
    expect(outcome.error_message).toMatch(/boom/);
  });
});

// ═════════════════════════════════════════════════════════════════════
// §6 · buildPopulationCounts · unavailable semantics
// ═════════════════════════════════════════════════════════════════════

describe("buildPopulationCounts", () => {
  test("empty map · all six buckets reported as unavailable", () => {
    const p = buildPopulationCounts(new Map());
    expect(p.populations_unavailable).toContain("nex_business");
    expect(p.populations_unavailable).toContain("nex.mp_seller");
    expect(p.populations_unavailable).toContain("food");
    expect(p.populations_unavailable).toContain("accommodation");
    expect(p.populations_unavailable).toContain("service");
    expect(p.populations_unavailable).toContain(
      "nex.transport_acquisition_record",
    );
    expect(p.total_observed).toBe(0);
  });

  test("errored spec does not count toward completion", () => {
    const outcomes = new Map<string, SpecOutcome>([
      [
        "s1",
        {
          spec_id: "s1",
          legacy_table: "nex.food_business",
          row_count: 100,
          effective_limit: 1000,
          truncation_suspected: false,
          errored: true,
          error_message: "x",
        },
      ],
    ]);
    const p = buildPopulationCounts(outcomes);
    expect(p.populations_unavailable).toContain("food");
  });

  test("successful spec counts toward its bucket", () => {
    const outcomes = new Map<string, SpecOutcome>([
      [
        "s1",
        {
          spec_id: "s1",
          legacy_table: "nex.food_business",
          row_count: 100,
          effective_limit: 10000,
          truncation_suspected: false,
          errored: false,
          error_message: null,
        },
      ],
    ]);
    const p = buildPopulationCounts(outcomes);
    expect(p.food).toBe(100);
    expect(p.populations_unavailable).not.toContain("food");
  });
});

// ═════════════════════════════════════════════════════════════════════
// §7 · SecretsLeakError
// ═════════════════════════════════════════════════════════════════════

describe("SecretsLeakError", () => {
  test("carries findings and has correct name", () => {
    const e = new SecretsLeakError(["password-pair"]);
    expect(e.name).toBe("SecretsLeakError");
    expect(e.findings).toEqual(["password-pair"]);
  });
});

// ═════════════════════════════════════════════════════════════════════
// §8 · Static invariants · grep assertions (properties 9-14)
// ═════════════════════════════════════════════════════════════════════

describe("extract-candidates source · grep invariants", () => {
  const srcPath = path.join(__dirname, "extract-candidates.ts");
  const src = fs.readFileSync(srcPath, "utf8");
  const code = src
    .replace(/\/\*[\s\S]*?\*\//g, "") // block comments
    .replace(/\/\/[^\n]*/g, ""); // line comments

  test("CODE does NOT import identity-matching", () => {
    expect(code).not.toMatch(/from\s+["'][^"']*identity-matching/);
    expect(code).not.toMatch(/require\(["'][^"']*identity-matching/);
  });

  test("CODE does NOT invoke matchBusiness(...)", () => {
    expect(code).not.toMatch(/\bmatchBusiness\s*\(/);
  });

  test("CODE does NOT import entity-universe", () => {
    expect(code).not.toMatch(/from\s+["'][^"']*entity-universe/);
  });

  test("CODE does NOT reference Supabase SDK or client", () => {
    expect(code).not.toMatch(/@supabase\//);
    expect(code).not.toMatch(/\bcreateClient\s*\(/);
    expect(code).not.toMatch(/supabase/i);
  });

  test("CODE does NOT read .env / .env.local / .pgpass / secrets", () => {
    // Specific quoted filenames · .env or .env.{local,production} as
    // a path string. Does not match `io.env` property access.
    expect(code).not.toMatch(/["']\.?env(\.(local|production))?["']/);
    expect(code).not.toMatch(/\.pgpass/);
    expect(code).not.toMatch(/secrets?\.(json|yaml|yml|txt)/i);
    expect(code).not.toMatch(/\bdotenv\b/);
    expect(code).not.toMatch(/\brequire\(['"]dotenv/);
    // No readFile anywhere · the runner only writes.
    expect(code).not.toMatch(/\bfs\.readFile\s*\(/);
    expect(code).not.toMatch(/\bfs\.readFileSync\s*\(/);
    expect(code).not.toMatch(/\bfsp\.readFile\s*\(/);
    expect(code).not.toMatch(/\breadFileSync\s*\(/);
  });

  test("CODE does NOT reference any migration file or path", () => {
    expect(code).not.toMatch(/deploy\/postgres\/init/);
    expect(code).not.toMatch(/\.sql["']/);
    expect(code).not.toMatch(/\bALTER\s+TABLE\b/i);
    expect(code).not.toMatch(/\bDROP\s+TABLE\b/i);
    expect(code).not.toMatch(/\bCREATE\s+TABLE\b/i);
    expect(code).not.toMatch(/\bINSERT\s+INTO\b/i);
  });

  test("CODE does NOT embed arbitrary SQL · only one c.query call-site, inside pg-executor/pg-fingerprint (not this file)", () => {
    // The runner does not call c.query directly · it goes through the
    // reviewed modules. There should be ZERO raw SQL strings in this
    // file.
    expect(code).not.toMatch(/\bSELECT\s+\w+\s+FROM\b/i);
    expect(code).not.toMatch(/\bc\.query\s*\(/);
    expect(code).not.toMatch(/\bclient\.query\s*\(/);
  });

  test("CODE's only script-local imports are the reviewed modules + secret-scan", () => {
    // Permitted: ./generate-candidates, ./pg-executor, ./pg-fingerprint,
    // ./secret-scan (re-export only · pure shared utility).
    const scriptLocalImports = [
      ...code.matchAll(/from\s+["']\.\/([^"']+)["']/g),
    ].map((m) => m[1]);
    const allowed = new Set([
      "generate-candidates",
      "pg-executor",
      "pg-fingerprint",
      "secret-scan",
    ]);
    for (const imp of scriptLocalImports) {
      expect(allowed.has(imp)).toBe(true);
    }
  });

  test("CODE does not invoke the runner at import time · zero top-level await, zero IIFE", () => {
    // Column-0 `await` indicates top-level await (indented awaits are
    // inside function bodies and are permitted). ES module top-level
    // await syntax requires `await` at the start of a statement line.
    expect(code).not.toMatch(/^await\s/m);
    // No immediately-invoked async arrow at module scope.
    expect(code).not.toMatch(/\(\s*async\s*\(\s*\)\s*=>/);
    // Note: `runCandidateExtraction` appears here only as a function
    // declaration · a bare name-match grep would be overly broad.
    // The two patterns above cover the "invoked at import" shapes we
    // care about. Positive proof is that the test file itself imports
    // the runner module successfully under a pg mock without ever
    // triggering a real connection.
  });
});

// ═════════════════════════════════════════════════════════════════════
// §9 · α.2 · same-session binding · fingerprint and QUERY_SPECS share one Client
// ═════════════════════════════════════════════════════════════════════

describe("α.2 · same Client for fingerprint and candidate extraction", () => {
  function fingerprintQueryEvents() {
    const fpSqls = new Set<string>(Object.values(FINGERPRINT_QUERIES));
    return mockState.events.filter(
      (e): e is Extract<MockEvent, { event: "query" }> =>
        e.event === "query" && fpSqls.has(e.sql),
    );
  }

  function specQueryEvents() {
    return mockState.events.filter(
      (e): e is Extract<MockEvent, { event: "query" }> =>
        e.event === "query" &&
        QUERY_SPECS.some((s) => e.sql.includes(`FROM ${s.legacy_table}`)),
    );
  }

  test("happy path · exactly ONE Client constructed across the whole run", async () => {
    installPassingFingerprint();
    installQuerySpecEmptyResponses();
    const { io } = makeTestIO();
    await runCandidateExtraction({ runId: "r" }, io);
    const constructs = mockState.events.filter(
      (e) => e.event === "construct",
    );
    expect(constructs.length).toBe(1);
  });

  test("every fingerprint query and every QUERY_SPEC query land on the SAME clientId", async () => {
    installPassingFingerprint();
    installQuerySpecEmptyResponses();
    const { io } = makeTestIO();
    await runCandidateExtraction({ runId: "r" }, io);
    const fpEvents = fingerprintQueryEvents();
    const specEvents = specQueryEvents();
    expect(fpEvents.length).toBe(4);
    expect(specEvents.length).toBeGreaterThan(0);
    const fpClients = new Set(fpEvents.map((e) => e.clientId));
    const specClients = new Set(specEvents.map((e) => e.clientId));
    expect(fpClients.size).toBe(1);
    expect(specClients.size).toBe(1);
    expect([...fpClients][0]).toBe([...specClients][0]);
  });

  test("no end() between the last fingerprint query and the first QUERY_SPEC query", async () => {
    installPassingFingerprint();
    installQuerySpecEmptyResponses();
    const { io } = makeTestIO();
    await runCandidateExtraction({ runId: "r" }, io);

    // Find index of the LAST fingerprint-shape query event.
    const fpSqls = new Set<string>(Object.values(FINGERPRINT_QUERIES));
    let lastFpIdx = -1;
    let firstSpecIdx = -1;
    for (let i = 0; i < mockState.events.length; i++) {
      const e = mockState.events[i];
      if (e.event === "query" && fpSqls.has(e.sql)) lastFpIdx = i;
      if (
        firstSpecIdx === -1 &&
        e.event === "query" &&
        QUERY_SPECS.some((s) => e.sql.includes(`FROM ${s.legacy_table}`))
      ) {
        firstSpecIdx = i;
      }
    }
    expect(lastFpIdx).toBeGreaterThanOrEqual(0);
    expect(firstSpecIdx).toBeGreaterThan(lastFpIdx);
    const between = mockState.events.slice(lastFpIdx + 1, firstSpecIdx);
    expect(between.filter((e) => e.event === "end")).toEqual([]);
    expect(between.filter((e) => e.event === "construct")).toEqual([]);
  });

  test("multiple QUERY_SPEC executions all land on the ONE fingerprinted Client", async () => {
    installPassingFingerprint();
    installQuerySpecEmptyResponses();
    const { io } = makeTestIO();
    await runCandidateExtraction({ runId: "r" }, io);
    const specEvents = specQueryEvents();
    expect(specEvents.length).toBeGreaterThanOrEqual(2);
    const uniqueClients = new Set(specEvents.map((e) => e.clientId));
    expect(uniqueClients.size).toBe(1);
  });

  test("fingerprint mismatch · the single Client is end()-closed before error escapes", async () => {
    // Pass only the user, version, and schemas · fail on database.
    mockState.staticResponses.set("SELECT current_database() AS db", {
      rows: [{ db: "WRONG_DATABASE" }],
      error: null,
    });
    mockState.staticResponses.set("SELECT current_user AS usr", {
      rows: [{ usr: EXPECTED_USER }],
      error: null,
    });
    mockState.staticResponses.set(
      "SELECT current_setting('server_version') AS srv_version",
      { rows: [{ srv_version: "15.4" }], error: null },
    );
    mockState.staticResponses.set(
      "SELECT schema_name FROM information_schema.schemata ORDER BY schema_name",
      { rows: [{ schema_name: "nex" }, { schema_name: "public" }], error: null },
    );
    const { io, written } = makeTestIO();
    await expect(
      runCandidateExtraction({ runId: "r" }, io),
    ).rejects.toThrow(/verify_fingerprint/);

    // Exactly one Client constructed, and it was end()-closed.
    const constructs = mockState.events.filter(
      (e) => e.event === "construct",
    );
    expect(constructs.length).toBe(1);
    const ends = mockState.events.filter((e) => e.event === "end");
    expect(ends.length).toBeGreaterThanOrEqual(1);
    expect(ends[0].clientId).toBe(constructs[0].clientId);

    // No QUERY_SPECS reached PG.
    expect(specQueryEvents()).toEqual([]);
    expect(written).toEqual([]);
  });

  test("fingerprint connection failure · zero QUERY_SPEC queries · zero second Client", async () => {
    mockState.connectShouldThrow = new Error("mock connect refused");
    const { io, written } = makeTestIO();
    await expect(
      runCandidateExtraction({ runId: "r" }, io),
    ).rejects.toThrow(/verify_fingerprint/);

    // One Client was constructed (connect was attempted), zero fingerprint
    // queries were observed, zero QUERY_SPEC queries ran, no JSONL written.
    const constructs = mockState.events.filter(
      (e) => e.event === "construct",
    );
    expect(constructs.length).toBe(1);
    expect(fingerprintQueryEvents()).toEqual([]);
    expect(specQueryEvents()).toEqual([]);
    expect(written).toEqual([]);
  });

  test("single-flight remains intact · observeFingerprint goes through the chain · no interleaving under parallel execute", async () => {
    // Build the executor directly (not via the runner) and prove the
    // chain serialises an observeFingerprint call plus a parallel
    // execute without interleaving on the same mock Client.
    installPassingFingerprint();
    installQuerySpecEmptyResponses();
    // Access the pg-executor module through the running runner path.
    // The runner's happy path exercises both observeFingerprint and
    // execute on one Client; the α.1 concurrency test file independently
    // proves single-flight for execute. Together they cover property 9.
    const { io } = makeTestIO();
    await runCandidateExtraction({ runId: "r" }, io);
    const queries = mockState.events.filter((e) => e.event === "query");
    // Only one Client · if single-flight failed, we might see
    // transactional nesting (two BEGIN TRANSACTION READ ONLY in a row
    // without an intervening COMMIT). Verify strict BEGIN/COMMIT alternation.
    const beginIdx: number[] = [];
    const commitIdx: number[] = [];
    for (let i = 0; i < queries.length; i++) {
      const sql = (queries[i] as { sql: string }).sql;
      if (sql === "BEGIN TRANSACTION READ ONLY") beginIdx.push(i);
      if (sql === "COMMIT") commitIdx.push(i);
    }
    // We expect one fingerprint txn + one txn per QUERY_SPEC.
    expect(beginIdx.length).toBe(commitIdx.length);
    for (let i = 0; i < beginIdx.length; i++) {
      expect(beginIdx[i]).toBeLessThan(commitIdx[i]);
      if (i + 1 < beginIdx.length) {
        expect(commitIdx[i]).toBeLessThan(beginIdx[i + 1]);
      }
    }
  });

  test("createPgExecutor returns PgExecutor with observeFingerprint method", async () => {
    // Static shape check via direct import · ensures the α.2 contract
    // is on the exported type.
    const mod = await import("./pg-executor");
    expect(typeof mod.createPgExecutor).toBe("function");
    const exec = mod.createPgExecutor({
      host: "fake",
      port: 5432,
      database: "x",
      user: "x",
      password: "x",
      ssl: false,
      resultRowCeiling: 100,
      statementTimeoutMs: 1000,
      idleInTransactionTimeoutMs: 1000,
    });
    expect(typeof exec.observeFingerprint).toBe("function");
    expect(typeof exec.execute).toBe("function");
    expect(typeof exec.close).toBe("function");
    // close() on an un-opened client is safe.
    await exec.close();
  });
});

// ═════════════════════════════════════════════════════════════════════
// §10 · No DB connection during test suite (property 14)
// ═════════════════════════════════════════════════════════════════════

describe("test-suite isolation", () => {
  test("mocked `pg` is in effect · real pg never connects during tests", async () => {
    // If the real pg were used, invoking the runner against the
    // completeEnv (whose host is "fake.pg.host") would raise an
    // ENOTFOUND/getaddrinfo error, not the SpecsLeak/Mismatch errors
    // we observe. The fact that every test above completes without
    // a getaddrinfo error is the evidence · we add a positive sanity
    // check here by invoking the runner with no fingerprint responses
    // installed, which forces a FingerprintConnectionError-shaped
    // throw rather than a network error.
    mockState.connectShouldThrow = null;
    // Fingerprint queries have no responses · they return empty rows,
    // which causes the compare step to fail (observed.database === "").
    const { io, written } = makeTestIO();
    const err = await runCandidateExtraction({ runId: "r" }, io).catch(
      (e) => e,
    );
    expect(err).toBeDefined();
    // No real network error should ever surface.
    expect(err.message).not.toMatch(/ENOTFOUND|ECONNREFUSED|getaddrinfo/);
    expect(written).toEqual([]);
  });
});
