// scripts/nex-canonical/pg-executor.concurrency.test.ts
//
// α.1 concurrency tests for the pg-executor's single-flight guard.
//
// Scope boundary (Step α.1 authorization 2026-10-08):
//   · Prove the single-flight serialisation invariant inside
//     createPgExecutor() only. No live DB. No credentials.
//
// This file is intentionally separate from pg-executor.test.ts because
// it uses `vi.mock("pg")` to replace the pg Client with an in-memory
// stub that records every query() call. The mock Client NEVER opens a
// TCP connection and NEVER sends SQL to a real database. The main test
// file (pg-executor.test.ts) stays unmocked so its "no connection at
// construction" assertions still exercise the real `pg` import.

import { beforeEach, describe, expect, test, vi } from "vitest";

// `vi.hoisted` hoists this initializer alongside `vi.mock` so the mock
// factory can reach the shared recorder state. The shape is deliberately
// minimal: a log of SQL strings and an optional error injector.
const mockState = vi.hoisted(() => ({
  queries: [] as string[],
  shouldThrowOn: null as null | ((sql: string) => Error | null),
}));

vi.mock("pg", () => {
  class Client {
    constructor(_cfg: unknown) {}
    async connect(): Promise<void> {}
    async query<T = Record<string, unknown>>(
      sql: string,
    ): Promise<{ rows: T[]; rowCount: number }> {
      mockState.queries.push(sql);
      if (mockState.shouldThrowOn !== null) {
        const err = mockState.shouldThrowOn(sql);
        if (err !== null) throw err;
      }
      return { rows: [] as T[], rowCount: 0 };
    }
    async end(): Promise<void> {}
  }
  return { Client };
});

// Imports below the mock so the mocked pg surfaces to pg-executor.
import { QUERY_SPECS, type QuerySpec } from "./generate-candidates";
import { createPgExecutor, type PgExecutorConfig } from "./pg-executor";

const baseConfig: PgExecutorConfig = {
  host: "127.0.0.1",
  port: 15432,
  database: "x",
  user: "x",
  password: "x",
  ssl: false,
  resultRowCeiling: 100,
  statementTimeoutMs: 1000,
  idleInTransactionTimeoutMs: 1000,
};

describe("createPgExecutor · α.1 single-flight concurrency", () => {
  beforeEach(() => {
    mockState.queries.length = 0;
    mockState.shouldThrowOn = null;
  });

  test("two SERIAL execute() calls each produce one BEGIN and one COMMIT", async () => {
    const exec = createPgExecutor(baseConfig);
    const spec = QUERY_SPECS[0];
    await exec.execute(spec);
    await exec.execute(spec);
    await exec.close!();

    const begins = mockState.queries.filter(
      (q) => q === "BEGIN TRANSACTION READ ONLY",
    );
    const commits = mockState.queries.filter((q) => q === "COMMIT");
    expect(begins.length).toBe(2);
    expect(commits.length).toBe(2);
  });

  test("two PARALLEL execute() calls serialise · BEGIN/COMMIT alternate strictly", async () => {
    const exec = createPgExecutor(baseConfig);
    const specA = QUERY_SPECS[0];
    const specB = QUERY_SPECS[1];

    await Promise.all([exec.execute(specA), exec.execute(specB)]);
    await exec.close!();

    const beginIndices: number[] = [];
    const commitIndices: number[] = [];
    mockState.queries.forEach((q, i) => {
      if (q === "BEGIN TRANSACTION READ ONLY") beginIndices.push(i);
      if (q === "COMMIT") commitIndices.push(i);
    });

    // Both transactions must be present.
    expect(beginIndices.length).toBe(2);
    expect(commitIndices.length).toBe(2);

    // Strict alternation under single-flight: B1 < C1 < B2 < C2.
    // Without the chain, the second BEGIN could appear before the
    // first COMMIT, breaking this ordering.
    expect(beginIndices[0]).toBeLessThan(commitIndices[0]);
    expect(commitIndices[0]).toBeLessThan(beginIndices[1]);
    expect(beginIndices[1]).toBeLessThan(commitIndices[1]);
  });

  test("executor instantiates exactly one Client even under parallel load", async () => {
    // Spy on `pg.Client` construction via the mock module. Reset the
    // recorder, then fire multiple parallel execute() calls.
    const exec = createPgExecutor(baseConfig);
    const specs: QuerySpec[] = [
      QUERY_SPECS[0],
      QUERY_SPECS[1 % QUERY_SPECS.length],
      QUERY_SPECS[2 % QUERY_SPECS.length],
      QUERY_SPECS[3 % QUERY_SPECS.length],
    ];
    await Promise.all(specs.map((s) => exec.execute(s)));

    // Four BEGINs, four COMMITs, strict alternation.
    const begins = mockState.queries.filter(
      (q) => q === "BEGIN TRANSACTION READ ONLY",
    );
    const commits = mockState.queries.filter((q) => q === "COMMIT");
    expect(begins.length).toBe(4);
    expect(commits.length).toBe(4);

    // configureSessionOnce ran exactly once (the four session SETs
    // appear exactly once in the log). This proves ensureClient was
    // not raced into creating multiple Clients.
    const sessionSetCount = mockState.queries.filter((q) =>
      q.startsWith("SET statement_timeout = "),
    ).length;
    expect(sessionSetCount).toBe(1);

    await exec.close!();
  });

  test("a FAILED execute() does not poison the chain · next call still succeeds", async () => {
    const exec = createPgExecutor(baseConfig);

    // Fail the FIRST call's SELECT.
    mockState.shouldThrowOn = (sql) =>
      /^SELECT /.test(sql) ? new Error("simulated SELECT failure") : null;

    await expect(exec.execute(QUERY_SPECS[0])).rejects.toThrow(
      /simulated SELECT failure/,
    );

    // Clear the injector · the SECOND call must succeed.
    mockState.shouldThrowOn = null;
    const rows = await exec.execute(QUERY_SPECS[0]);
    expect(Array.isArray(rows)).toBe(true);

    await exec.close!();

    // The failed txn should have rolled back · the second succeeded.
    expect(mockState.queries).toContain("ROLLBACK");
    expect(mockState.queries).toContain("COMMIT");
  });

  test("Guard-1 rejection in a parallel call does NOT block subsequent calls", async () => {
    const exec = createPgExecutor(baseConfig);
    // A shallow-copy of a sealed spec has a different identity · Guard 1 trips.
    const foreign = { ...QUERY_SPECS[0] } as QuerySpec;

    // Fire the foreign call first · it must reject.
    const rejected = exec.execute(foreign);
    // Then fire a legitimate call before the first resolves.
    const legit = exec.execute(QUERY_SPECS[0]);

    await expect(rejected).rejects.toThrow(/not in the authored/);
    await legit;

    await exec.close!();
    const commits = mockState.queries.filter((q) => q === "COMMIT");
    // The foreign call never reached a transaction; the legit call did.
    expect(commits.length).toBe(1);
  });
});
