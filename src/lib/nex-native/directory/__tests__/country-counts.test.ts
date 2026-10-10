// src/lib/nex-native/directory/__tests__/country-counts.test.ts
//
// NEX Directory · Phase A · country-counts reader tests.
//
// Covers
//   · listCountryCounts composes the sealed SELECT shape (GROUP BY country,
//     ORDER BY n DESC, country ASC) against nex.business_directory_v
//   · Opens a connection, sets default_transaction_read_only, runs the
//     count query, and always calls client.end() (even on error)
//   · Maps raw rows to CountryCount[] with isoAlpha2 + numeric count
//   · joinWithIso is pure · deterministic · preserves entries whose
//     country code is absent from the ISO metadata (name: null)
//   · joinWithIso stable under empty inputs
//
// Pure-logic strategy
//   The `pg.Client` import at the top of country-counts.ts is intercepted
//   via vi.mock so no real network / driver is instantiated. Each test
//   constructs a fresh mock Client that records every call it receives
//   so assertions can inspect SQL shape AND side-effect ordering.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ─── Mock pg.Client ──────────────────────────────────────────────────
//
// `vi.mock` is hoisted to the top of the file by Vitest, so the factory
// cannot reference module-scope class declarations. We publish the
// recording state onto `globalThis` so the hoisted factory can read it
// without triggering TDZ errors, and the tests update that same state.

type QueryCall = { sql: string; params: readonly unknown[] | undefined };

interface PgMockState {
  connectCalls: number;
  endCalls: number;
  queries: QueryCall[];
  nextQueryResult: { rows: readonly Record<string, unknown>[] };
  queryShouldThrow: Error | null;
}

declare global {
  // eslint-disable-next-line no-var
  var __NEX_PG_MOCK_STATE__: PgMockState | undefined;
}

globalThis.__NEX_PG_MOCK_STATE__ = {
  connectCalls: 0,
  endCalls: 0,
  queries: [],
  nextQueryResult: { rows: [] },
  queryShouldThrow: null,
};

vi.mock("pg", () => {
  class MockClient {
    constructor(public opts: { connectionString: string }) {}
    async connect(): Promise<void> {
      globalThis.__NEX_PG_MOCK_STATE__!.connectCalls += 1;
    }
    async query(
      sql: string,
      params?: readonly unknown[],
    ): Promise<{ rows: readonly Record<string, unknown>[] }> {
      const s = globalThis.__NEX_PG_MOCK_STATE__!;
      s.queries.push({ sql, params });
      // Only throw on the SELECT (the one that lives inside the
      // reader's try/finally). The SET statement runs outside the
      // try block · a throw there would correctly bypass .end() so
      // the "always ends" assertion would be a false positive. The
      // SELECT discriminator is the "SELECT " prefix.
      if (s.queryShouldThrow && sql.trimStart().toUpperCase().startsWith("SELECT")) {
        throw s.queryShouldThrow;
      }
      return s.nextQueryResult;
    }
    async end(): Promise<void> {
      globalThis.__NEX_PG_MOCK_STATE__!.endCalls += 1;
    }
  }
  return { Client: MockClient };
});

import {
  joinWithIso,
  listCountryCounts,
  type CountryCount,
  type CountryPickerEntry,
} from "../country-counts";

function state(): PgMockState {
  return globalThis.__NEX_PG_MOCK_STATE__!;
}

beforeEach(() => {
  const s = state();
  s.connectCalls = 0;
  s.endCalls = 0;
  s.queries = [];
  s.nextQueryResult = { rows: [] };
  s.queryShouldThrow = null;
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ═════════════════════════════════════════════════════════════════════
// §1 · listCountryCounts · wire shape
// ═════════════════════════════════════════════════════════════════════

describe("listCountryCounts · wire shape", () => {
  it("opens the client with the given connection string, connects, sets read-only, runs the SELECT, and ends", async () => {
    state().nextQueryResult = {
      rows: [
        { country: "ID", n: "7" },
        { country: "US", n: "0" },
      ],
    };
    const out = await listCountryCounts({
      connectionString: "postgres://user:pass@host/db",
    });

    const s = state();
    expect(s.connectCalls).toBe(1);
    expect(s.endCalls).toBe(1);
    // Exactly two statements: SET then SELECT.
    expect(s.queries.length).toBe(2);
    expect(s.queries[0].sql).toContain("default_transaction_read_only = on");
    expect(s.queries[1].sql).toContain("SELECT country");
    expect(out[0]).toEqual({ isoAlpha2: "ID", count: 7 });
  });

  it("reads the sealed publication view · nex.business_directory_v (never business_canonical)", async () => {
    await listCountryCounts({ connectionString: "postgres://x/y" });
    const sql = state().queries[1].sql;
    expect(sql).toContain("FROM nex.business_directory_v");
    expect(sql).not.toContain("business_canonical");
  });

  it("the SELECT groups by country and orders by n DESC, country ASC for stable rendering", async () => {
    await listCountryCounts({ connectionString: "postgres://x/y" });
    const sql = state().queries[1].sql;
    expect(sql).toContain("GROUP BY country");
    expect(sql).toContain("ORDER BY n DESC, country ASC");
  });

  it("casts COUNT(*) to bigint so pg driver returns a string we then Number()", async () => {
    // pg driver's default type parser returns bigint as string. The
    // reader's `Number(r.n)` normalises that back to a JS number;
    // tests exercise both pg type-return shapes.
    state().nextQueryResult = {
      rows: [
        { country: "ID", n: "7" },
        { country: "GB", n: 3 },
      ],
    };
    const out = await listCountryCounts({ connectionString: "postgres://x/y" });
    expect(out).toEqual<readonly CountryCount[]>([
      { isoAlpha2: "ID", count: 7 },
      { isoAlpha2: "GB", count: 3 },
    ]);
  });

  it("returns an empty array when the view yields zero rows (empty-state honesty)", async () => {
    state().nextQueryResult = { rows: [] };
    const out = await listCountryCounts({ connectionString: "postgres://x/y" });
    expect(out).toEqual([]);
  });

  it("always ends the client even when the SELECT throws (try/finally)", async () => {
    // The reader wraps the SELECT inside try/finally so .end() runs
    // even when the view errors (schema missing, perm denied). The
    // pg mock is wired to throw only on SELECT statements.
    state().queryShouldThrow = new Error("relation does not exist");
    await expect(
      listCountryCounts({ connectionString: "postgres://x/y" }),
    ).rejects.toThrow(/relation does not exist/);
    expect(state().endCalls).toBe(1);
  });

  it("takes no parameters bound to the SELECT (no user-controlled input)", async () => {
    await listCountryCounts({ connectionString: "postgres://x/y" });
    // The query uses no bind params · the whole statement is static.
    expect(state().queries[1].params).toBeUndefined();
  });
});

// ═════════════════════════════════════════════════════════════════════
// §2 · joinWithIso · pure, deterministic
// ═════════════════════════════════════════════════════════════════════

describe("joinWithIso · pure logic", () => {
  const iso = [
    { isoAlpha2: "ID", name: "Indonesia", region: "Asia" },
    { isoAlpha2: "GB", name: "United Kingdom", region: "Europe" },
  ];

  it("merges name + region per entry in the SAME order as the counts input", () => {
    const counts: CountryCount[] = [
      { isoAlpha2: "ID", count: 7 },
      { isoAlpha2: "GB", count: 3 },
    ];
    const out = joinWithIso(counts, iso);
    expect(out).toEqual<readonly CountryPickerEntry[]>([
      { isoAlpha2: "ID", name: "Indonesia", region: "Asia", count: 7 },
      { isoAlpha2: "GB", name: "United Kingdom", region: "Europe", count: 3 },
    ]);
  });

  it("preserves entries whose country code is NOT in the ISO list · name/region=null", () => {
    const counts: CountryCount[] = [
      { isoAlpha2: "ID", count: 7 },
      { isoAlpha2: "ZZ", count: 1 },
    ];
    const out = joinWithIso(counts, iso);
    expect(out[1]).toEqual({
      isoAlpha2: "ZZ",
      name: null,
      region: null,
      count: 1,
    });
  });

  it("returns an empty array when counts is empty · pure", () => {
    expect(joinWithIso([], iso)).toEqual([]);
  });

  it("is pure · calling twice with identical inputs produces identical outputs", () => {
    const counts: CountryCount[] = [{ isoAlpha2: "ID", count: 7 }];
    const a = joinWithIso(counts, iso);
    const b = joinWithIso(counts, iso);
    expect(a).toEqual(b);
  });
});
