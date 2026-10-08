// scripts/nex-canonical/pg-write-adapter.test.ts
//
// Unit tests for the pg.Client → WriteSession adapter.
// Uses vi.mock("pg") · no real network · no credentials.

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

type ClientEvent =
  | { kind: "construct"; cfg: Record<string, unknown> }
  | { kind: "connect" }
  | { kind: "query"; sql: string; params: readonly unknown[] }
  | { kind: "end" };

const mockState = vi.hoisted(() => ({
  events: [] as ClientEvent[],
  connectShouldThrow: null as null | Error,
  queryResponses: new Map<string | RegExp, { rows: unknown[]; error?: Error }>(),
  instanceCount: 0,
}));

vi.mock("pg", () => {
  class Client {
    constructor(cfg: Record<string, unknown>) {
      mockState.instanceCount++;
      mockState.events.push({ kind: "construct", cfg });
    }
    async connect(): Promise<void> {
      mockState.events.push({ kind: "connect" });
      if (mockState.connectShouldThrow) throw mockState.connectShouldThrow;
    }
    async query<T>(
      sql: string,
      params: readonly unknown[] = [],
    ): Promise<{ rows: T[]; rowCount: number }> {
      mockState.events.push({ kind: "query", sql, params });
      for (const [k, v] of mockState.queryResponses.entries()) {
        const match = typeof k === "string" ? sql === k : k.test(sql);
        if (match) {
          if (v.error) throw v.error;
          return { rows: v.rows as T[], rowCount: v.rows.length };
        }
      }
      return { rows: [], rowCount: 0 };
    }
    async end(): Promise<void> {
      mockState.events.push({ kind: "end" });
    }
  }
  return { Client };
});

import {
  PG_WRITE_ADAPTER_REQUIRED_ENV_VARS,
  PgWriteAdapterConfigError,
  createPgWriteSessionFactory,
  parsePgWriteAdapterConfigFromEnv,
} from "./pg-write-adapter";

beforeEach(() => {
  mockState.events.length = 0;
  mockState.connectShouldThrow = null;
  mockState.queryResponses.clear();
  mockState.instanceCount = 0;
});

afterEach(() => {
  mockState.events.length = 0;
  mockState.queryResponses.clear();
});

// ═════════════════════════════════════════════════════════════════════
// §1 · parsePgWriteAdapterConfigFromEnv
// ═════════════════════════════════════════════════════════════════════

const COMPLETE_ENV: NodeJS.ProcessEnv = {
  NEX_CANONICAL_PG_HOST: "fake.pg.host",
  NEX_CANONICAL_PG_DATABASE: "nex_business",
  NEX_CANONICAL_PG_USER: "nex_rw",
  NEX_CANONICAL_PG_PASSWORD: "redacted-in-test",
};

describe("parsePgWriteAdapterConfigFromEnv", () => {
  test("happy path with defaults", () => {
    const c = parsePgWriteAdapterConfigFromEnv(COMPLETE_ENV);
    expect(c.host).toBe("fake.pg.host");
    expect(c.database).toBe("nex_business");
    expect(c.user).toBe("nex_rw");
    expect(c.port).toBe(5432);
    expect(c.ssl).toBe(true);
    expect(c.statementTimeoutMs).toBe(30000);
    expect(c.queryTimeoutMs).toBe(30000);
    expect(c.connectionTimeoutMillis).toBe(10000);
  });

  test.each(PG_WRITE_ADAPTER_REQUIRED_ENV_VARS)(
    "missing %s throws PgWriteAdapterConfigError and names it",
    (missing) => {
      const env = { ...COMPLETE_ENV };
      delete env[missing];
      try {
        parsePgWriteAdapterConfigFromEnv(env);
        expect.fail("expected throw");
      } catch (e) {
        expect(e).toBeInstanceOf(PgWriteAdapterConfigError);
        expect((e as PgWriteAdapterConfigError).missingEnvVars).toContain(missing);
        expect((e as Error).message).toContain(missing);
      }
    },
  );

  test("empty string treated as missing", () => {
    const env = { ...COMPLETE_ENV, NEX_CANONICAL_PG_HOST: "" };
    expect(() => parsePgWriteAdapterConfigFromEnv(env)).toThrow(
      PgWriteAdapterConfigError,
    );
  });

  test("error message never echoes password value", () => {
    const env = { ...COMPLETE_ENV, NEX_CANONICAL_PG_PASSWORD: "secret-123" };
    delete env.NEX_CANONICAL_PG_HOST;
    try {
      parsePgWriteAdapterConfigFromEnv(env);
    } catch (e) {
      expect((e as Error).message).not.toContain("secret-123");
    }
  });

  test("SSL defaults to true · false respected", () => {
    const c = parsePgWriteAdapterConfigFromEnv({
      ...COMPLETE_ENV,
      NEX_CANONICAL_PG_SSL: "false",
    });
    expect(c.ssl).toBe(false);
  });

  test("negative statement timeout rejected", () => {
    const env = {
      ...COMPLETE_ENV,
      NEX_CANONICAL_PG_STATEMENT_TIMEOUT_MS: "-1",
    };
    expect(() => parsePgWriteAdapterConfigFromEnv(env)).toThrow(
      PgWriteAdapterConfigError,
    );
  });
});

// ═════════════════════════════════════════════════════════════════════
// §2 · createPgWriteSessionFactory · open/query/close roundtrip
// ═════════════════════════════════════════════════════════════════════

const CFG = {
  host: "fake",
  port: 15432,
  database: "d",
  user: "u",
  password: "p",
  ssl: false,
  statementTimeoutMs: 1000,
  queryTimeoutMs: 1000,
  connectionTimeoutMillis: 5000,
};

describe("createPgWriteSessionFactory", () => {
  test("openSession creates ONE Client · connects it once", async () => {
    const factory = createPgWriteSessionFactory(CFG);
    const session = await factory.openSession();
    expect(mockState.instanceCount).toBe(1);
    expect(session.id).toContain("pg-write-");
    const connects = mockState.events.filter((e) => e.kind === "connect");
    expect(connects.length).toBe(1);
    await factory.closeSession(session);
  });

  test("Client constructed with the supplied config · statement_timeout + query_timeout + ssl=false", async () => {
    const factory = createPgWriteSessionFactory(CFG);
    const session = await factory.openSession();
    const construct = mockState.events.find((e) => e.kind === "construct")!;
    expect(construct.kind).toBe("construct");
    if (construct.kind === "construct") {
      expect(construct.cfg.host).toBe("fake");
      expect(construct.cfg.statement_timeout).toBe(1000);
      expect(construct.cfg.query_timeout).toBe(1000);
      expect(construct.cfg.ssl).toBe(false);
      expect(construct.cfg.connectionTimeoutMillis).toBe(5000);
    }
    await factory.closeSession(session);
  });

  test("session.query forwards sql + params to the Client", async () => {
    const factory = createPgWriteSessionFactory(CFG);
    const session = await factory.openSession();
    await session.query("SELECT 1 WHERE a=$1", ["x"]);
    const q = mockState.events.find((e) => e.kind === "query");
    expect(q?.kind).toBe("query");
    if (q?.kind === "query") {
      expect(q.sql).toBe("SELECT 1 WHERE a=$1");
      expect(q.params).toEqual(["x"]);
    }
    await factory.closeSession(session);
  });

  test("closeSession ends the Client", async () => {
    const factory = createPgWriteSessionFactory(CFG);
    const session = await factory.openSession();
    await factory.closeSession(session);
    const ends = mockState.events.filter((e) => e.kind === "end");
    expect(ends.length).toBe(1);
  });

  test("double close is safe (second close is a no-op)", async () => {
    const factory = createPgWriteSessionFactory(CFG);
    const session = await factory.openSession();
    await factory.closeSession(session);
    await factory.closeSession(session);
    const ends = mockState.events.filter((e) => e.kind === "end");
    expect(ends.length).toBe(1);
  });

  test("openSession failing to connect propagates the error", async () => {
    mockState.connectShouldThrow = new Error("mock connect refused");
    const factory = createPgWriteSessionFactory(CFG);
    await expect(factory.openSession()).rejects.toThrow(/mock connect refused/);
  });

  test("each openSession() creates a NEW Client instance", async () => {
    const factory = createPgWriteSessionFactory(CFG);
    const a = await factory.openSession();
    const b = await factory.openSession();
    expect(mockState.instanceCount).toBe(2);
    expect(a.id).not.toBe(b.id);
    await factory.closeSession(a);
    await factory.closeSession(b);
  });
});

// ═════════════════════════════════════════════════════════════════════
// §3 · Adapter does NOT issue session-level SET statements of its own
// ═════════════════════════════════════════════════════════════════════

describe("adapter does NOT mutate the session on open", () => {
  test("after openSession · no 'SET ...' query was issued by the adapter", async () => {
    const factory = createPgWriteSessionFactory(CFG);
    const session = await factory.openSession();
    const queries = mockState.events.filter(
      (e): e is Extract<ClientEvent, { kind: "query" }> => e.kind === "query",
    );
    expect(queries.length).toBe(0);
    await factory.closeSession(session);
  });

  test("after openSession · adapter did NOT run SET default_transaction_read_only = off", async () => {
    const factory = createPgWriteSessionFactory(CFG);
    const session = await factory.openSession();
    const matching = mockState.events.filter(
      (e) =>
        e.kind === "query" &&
        /default_transaction_read_only/i.test(e.sql) &&
        /off/i.test(e.sql),
    );
    expect(matching.length).toBe(0);
    await factory.closeSession(session);
  });
});

// ═════════════════════════════════════════════════════════════════════
// §4 · Pure-module grep invariants
// ═════════════════════════════════════════════════════════════════════

describe("pg-write-adapter source · pure invariants", () => {
  const srcPath = path.join(__dirname, "pg-write-adapter.ts");
  const src = fs.readFileSync(srcPath, "utf8");
  const code = src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/[^\n]*/g, "");

  test("CODE does NOT import extract-candidates / pg-executor / pg-fingerprint / identity-matching / entity-universe", () => {
    expect(code).not.toMatch(/from\s+["']\.\/extract-candidates["']/);
    expect(code).not.toMatch(/from\s+["']\.\/pg-executor["']/);
    expect(code).not.toMatch(/from\s+["']\.\/pg-fingerprint["']/);
    expect(code).not.toMatch(/identity-matching/);
    expect(code).not.toMatch(/entity-universe/);
    expect(code).not.toMatch(/\bmatchBusiness\s*\(/);
  });

  test("CODE does NOT issue SET statements of its own", () => {
    expect(code).not.toMatch(/client\.query\s*\(\s*["'`]\s*SET\s+/i);
  });

  test("CODE does NOT read fs / use clock / randomness", () => {
    expect(code).not.toMatch(/\bfs\./);
    expect(code).not.toMatch(/\bnew\s+Date\b/);
    expect(code).not.toMatch(/\bDate\.now\b/);
    expect(code).not.toMatch(/\bMath\.random\b/);
    expect(code).not.toMatch(/\brandomUUID\b/);
    expect(code).not.toMatch(/\brandomBytes\b/);
  });

  test("CODE's only script-local import is ./execute-write-plan (for the type)", () => {
    const localImports = [
      ...code.matchAll(/from\s+["']\.\/([^"']+)["']/g),
    ].map((m) => m[1]);
    for (const imp of localImports) {
      expect(imp).toBe("execute-write-plan");
    }
  });

  test("CODE does NOT implement retry / reconnect logic", () => {
    expect(code).not.toMatch(/\bsetTimeout\s*\(/);
    expect(code).not.toMatch(/\bsetInterval\s*\(/);
    expect(code).not.toMatch(/\breconnect\b/i);
    expect(code).not.toMatch(/\bretry\b/i);
  });
});
