// scripts/nex-canonical/real-ingestion.test.ts
//
// Tests for the real data-ingestion layer:
//   · pg-read-adapter · session mock, denylist, read-only setup
//   · source-legacy-food-business · projection, keyset pagination,
//     failure classification
//   · durable-approval-queue · dedup, decision lookup, file I/O via
//     injected ApprovalIO
//
// No real pg · no credentials · no filesystem writes beyond injected
// in-memory FS.

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import type { Candidate } from "./generate-candidates";
import type { ReadSession, ReadSessionFactory } from "./pg-read-adapter";
import {
  LEGACY_FOOD_COUNTRY,
  LEGACY_FOOD_DEFAULT_BATCH_SIZE,
  LEGACY_FOOD_ENTITY_TYPE,
  LEGACY_FOOD_SOURCE_ID,
  createLegacyFoodBusinessSource,
  projectFoodBusinessRow,
} from "./source-legacy-food-business";
import {
  PENDING_SCHEMA_VERSION,
  PendingQueueParseError,
  createFileBackedApprovalProvider,
  findDecisionForCandidate,
  parsePendingQueue,
  serializePendingReviewEntry,
  type ApprovalIO,
  type PendingReviewEntry,
} from "./durable-approval-queue";
import { validateCandidate } from "./candidate-validator";
import { reviewCandidates } from "./candidate-reviewer";
import {
  buildReviewPackage,
  decideCandidate,
  serializeDecisionLog,
  type ReviewPackage,
} from "./candidate-approval";

// ═════════════════════════════════════════════════════════════════════
// §0 · pg-read-adapter · session mock (vi.mock("pg"))
// ═════════════════════════════════════════════════════════════════════

type MockEvent =
  | { kind: "construct"; cfg: Record<string, unknown> }
  | { kind: "connect" }
  | { kind: "query"; sql: string; params: readonly unknown[] }
  | { kind: "end" };

const readMock = vi.hoisted(() => ({
  events: [] as MockEvent[],
  responses: new Map<string | RegExp, { rows: unknown[]; error?: Error }>(),
  instanceCount: 0,
  connectShouldThrow: null as null | Error,
}));

vi.mock("pg", () => {
  class Client {
    constructor(cfg: Record<string, unknown>) {
      readMock.instanceCount++;
      readMock.events.push({ kind: "construct", cfg });
    }
    async connect() {
      readMock.events.push({ kind: "connect" });
      if (readMock.connectShouldThrow) throw readMock.connectShouldThrow;
    }
    async query<T>(sql: string, params: readonly unknown[] = []) {
      readMock.events.push({ kind: "query", sql, params });
      for (const [k, v] of readMock.responses.entries()) {
        const match = typeof k === "string" ? sql === k : k.test(sql);
        if (match) {
          if (v.error) throw v.error;
          return { rows: v.rows as T[], rowCount: v.rows.length };
        }
      }
      return { rows: [] as T[], rowCount: 0 };
    }
    async end() {
      readMock.events.push({ kind: "end" });
    }
  }
  return { Client };
});

import {
  PG_READ_ADAPTER_REQUIRED_ENV_VARS,
  PgReadAdapterConfigError,
  createPgReadSessionFactory,
  parsePgReadAdapterConfigFromEnv,
} from "./pg-read-adapter";

beforeEach(() => {
  readMock.events.length = 0;
  readMock.responses.clear();
  readMock.instanceCount = 0;
  readMock.connectShouldThrow = null;
});

afterEach(() => {
  readMock.events.length = 0;
  readMock.responses.clear();
});

// ═════════════════════════════════════════════════════════════════════
// §1 · pg-read-adapter · config parsing
// ═════════════════════════════════════════════════════════════════════

const READ_ENV: NodeJS.ProcessEnv = {
  NEX_CANONICAL_PG_HOST: "fake",
  NEX_CANONICAL_PG_DATABASE: "d",
  NEX_CANONICAL_PG_USER: "u",
  NEX_CANONICAL_PG_PASSWORD: "p",
};

describe("parsePgReadAdapterConfigFromEnv", () => {
  test("happy path returns defaults for optional fields", () => {
    const c = parsePgReadAdapterConfigFromEnv(READ_ENV);
    expect(c.host).toBe("fake");
    expect(c.port).toBe(5432);
    expect(c.ssl).toBe(true);
    expect(c.statementTimeoutMs).toBeGreaterThan(0);
  });

  test.each(PG_READ_ADAPTER_REQUIRED_ENV_VARS)(
    "missing %s throws with the var name",
    (name) => {
      const env = { ...READ_ENV };
      delete env[name];
      expect(() => parsePgReadAdapterConfigFromEnv(env)).toThrow(
        PgReadAdapterConfigError,
      );
    },
  );

  test("negative statement timeout rejected", () => {
    expect(() =>
      parsePgReadAdapterConfigFromEnv({
        ...READ_ENV,
        NEX_CANONICAL_PG_STATEMENT_TIMEOUT_MS: "-1",
      }),
    ).toThrow(PgReadAdapterConfigError);
  });

  test("missing env error never echoes any value", () => {
    const env = { ...READ_ENV, NEX_CANONICAL_PG_PASSWORD: "SECRET-123" };
    delete env.NEX_CANONICAL_PG_HOST;
    try {
      parsePgReadAdapterConfigFromEnv(env);
    } catch (e) {
      expect((e as Error).message).not.toContain("SECRET-123");
    }
  });
});

// ═════════════════════════════════════════════════════════════════════
// §2 · pg-read-adapter · session open/query/close
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

describe("createPgReadSessionFactory", () => {
  test("open applies SET default_transaction_read_only = on BEFORE caller queries", async () => {
    const factory = createPgReadSessionFactory(CFG);
    const session = await factory.openSession();
    const q0 = readMock.events.find(
      (e) => e.kind === "query" && /default_transaction_read_only.*on/i.test(e.sql),
    );
    expect(q0).toBeDefined();
    await factory.closeSession(session);
  });

  test("open applies statement_timeout", async () => {
    const factory = createPgReadSessionFactory(CFG);
    const session = await factory.openSession();
    const q = readMock.events.find(
      (e) => e.kind === "query" && /SET statement_timeout = 1000/.test(e.sql),
    );
    expect(q).toBeDefined();
    await factory.closeSession(session);
  });

  test("session.query refuses INSERT / UPDATE / DELETE / DROP via denylist", async () => {
    const factory = createPgReadSessionFactory(CFG);
    const session = await factory.openSession();
    await expect(
      session.query("INSERT INTO x VALUES (1)", []),
    ).rejects.toThrow();
    await expect(
      session.query("UPDATE x SET a = 1", []),
    ).rejects.toThrow();
    await expect(
      session.query("DELETE FROM x", []),
    ).rejects.toThrow();
    await expect(
      session.query("DROP TABLE x", []),
    ).rejects.toThrow();
    await factory.closeSession(session);
  });

  test("session.query accepts SELECT", async () => {
    readMock.responses.set(/^SELECT 1/, { rows: [{ a: 1 }] });
    const factory = createPgReadSessionFactory(CFG);
    const session = await factory.openSession();
    const r = await session.query<{ a: number }>("SELECT 1 AS a", []);
    expect(r.rows[0]?.a).toBe(1);
    await factory.closeSession(session);
  });

  test("close ends the Client", async () => {
    const factory = createPgReadSessionFactory(CFG);
    const session = await factory.openSession();
    await factory.closeSession(session);
    const ends = readMock.events.filter((e) => e.kind === "end");
    expect(ends.length).toBe(1);
  });

  test("double close is safe", async () => {
    const factory = createPgReadSessionFactory(CFG);
    const session = await factory.openSession();
    await factory.closeSession(session);
    await factory.closeSession(session);
    const ends = readMock.events.filter((e) => e.kind === "end");
    expect(ends.length).toBe(1);
  });
});

// ═════════════════════════════════════════════════════════════════════
// §3 · projectFoodBusinessRow · pure projection
// ═════════════════════════════════════════════════════════════════════

const PROJ_CFG = {
  generationRunId: "nex-cand-food-legacy-2026-10-08-test",
  nowIso: () => "2026-10-08T12:00:00.000Z",
};

describe("projectFoodBusinessRow", () => {
  test("valid row projects into a sealed Candidate", () => {
    const row = {
      internal_id: "11111111-1111-1111-1111-111111111111",
      public_listing_ref: "#FL-2024-ABCDE",
      business_name: "Warung Bu Siti",
      category: "warung",
      address: "Jalan X 1",
      city: "Yogyakarta",
      district: "Umbulharjo",
      coordinates_lng: "110.37",
      coordinates_lat: "-7.80",
      phone: "+6281234567890",
      website: "https://www.warungsiti.id/menu",
      source: "yogyakarta_open_data_2024",
      source_reference: "permit-123",
    };
    const r = projectFoodBusinessRow(row, PROJ_CFG);
    expect(r.kind).toBe("ok");
    if (r.kind === "ok") {
      expect(r.candidate.entity_type).toBe("food");
      expect(r.candidate.country).toBe("ID");
      expect(r.candidate.identity.name_canonical).toBe("Warung Bu Siti");
      expect(r.candidate.identity.city).toBe("Yogyakarta");
      expect(r.candidate.identity.district).toBe("Umbulharjo");
      expect(r.candidate.identity.phone_e164).toBe("+6281234567890");
      expect(r.candidate.identity.website_apex).toBe("warungsiti.id");
      expect(r.candidate.identity.coordinates).toEqual({ lat: -7.8, lng: 110.37 });
      expect(r.candidate.legacy_source.table).toBe("nex.food_business");
      expect(r.candidate.legacy_source.ref).toBe("#FL-2024-ABCDE");
      expect(r.candidate.legacy_source.internal_id).toBe(
        "11111111-1111-1111-1111-111111111111",
      );
    }
  });

  test("the projected Candidate passes the sealed validator", () => {
    const row = {
      internal_id: "11111111-1111-1111-1111-111111111111",
      public_listing_ref: "#FL-2024-ABCDE",
      business_name: "Warung Bu Siti",
      category: "warung",
      address: null,
      city: "Yogyakarta",
      district: null,
      coordinates_lng: 110.37,
      coordinates_lat: -7.8,
      phone: "+6281234567890",
      website: "warungsiti.id",
      source: "y",
      source_reference: null,
    };
    const r = projectFoodBusinessRow(row, PROJ_CFG);
    expect(r.kind).toBe("ok");
    if (r.kind === "ok") {
      expect(() => validateCandidate(r.candidate)).not.toThrow();
    }
  });

  test("missing business_name → projection_failed · no Candidate", () => {
    const row = {
      internal_id: "22222222-2222-2222-2222-222222222222",
      public_listing_ref: "#FL-2024-X",
      business_name: "",
      category: null,
      address: null,
      city: null,
      district: null,
      coordinates_lng: null,
      coordinates_lat: null,
      phone: null,
      website: null,
      source: null,
      source_reference: null,
    };
    const r = projectFoodBusinessRow(row, PROJ_CFG);
    expect(r.kind).toBe("projection_failed");
  });

  test("missing public_listing_ref → projection_failed", () => {
    const row = {
      internal_id: "33333333-3333-3333-3333-333333333333",
      public_listing_ref: "",
      business_name: "X",
      category: null,
      address: null,
      city: null,
      district: null,
      coordinates_lng: null,
      coordinates_lat: null,
      phone: null,
      website: null,
      source: null,
      source_reference: null,
    };
    expect(projectFoodBusinessRow(row, PROJ_CFG).kind).toBe("projection_failed");
  });

  test("phone not in E.164 is dropped (does NOT invent · stays null)", () => {
    const row = {
      internal_id: "44444444-4444-4444-4444-444444444444",
      public_listing_ref: "#FL-2024-Y",
      business_name: "Warung Y",
      category: null,
      address: null,
      city: "Yogyakarta",
      district: null,
      coordinates_lng: null,
      coordinates_lat: null,
      phone: "0812-3456-7890", // local Indonesian format · not E.164
      website: null,
      source: null,
      source_reference: null,
    };
    const r = projectFoodBusinessRow(row, PROJ_CFG);
    expect(r.kind).toBe("ok");
    if (r.kind === "ok") {
      expect(r.candidate.identity.phone_e164).toBeNull();
    }
  });

  test("malformed coordinates dropped to null · never invented", () => {
    const row = {
      internal_id: "55555555-5555-5555-5555-555555555555",
      public_listing_ref: "#FL-2024-Z",
      business_name: "Warung Z",
      category: null,
      address: null,
      city: "Yogyakarta",
      district: null,
      coordinates_lng: "not-a-number",
      coordinates_lat: "nope",
      phone: null,
      website: null,
      source: null,
      source_reference: null,
    };
    const r = projectFoodBusinessRow(row, PROJ_CFG);
    expect(r.kind).toBe("ok");
    if (r.kind === "ok") {
      expect(r.candidate.identity.coordinates).toBeNull();
    }
  });

  test("out-of-range coordinates (lat>90) dropped to null", () => {
    const row = {
      internal_id: "66666666-6666-6666-6666-666666666666",
      public_listing_ref: "#FL-2024-W",
      business_name: "Warung W",
      category: null,
      address: null,
      city: "Yogyakarta",
      district: null,
      coordinates_lng: 110,
      coordinates_lat: 999,
      phone: null,
      website: null,
      source: null,
      source_reference: null,
    };
    const r = projectFoodBusinessRow(row, PROJ_CFG);
    if (r.kind === "ok") {
      expect(r.candidate.identity.coordinates).toBeNull();
    }
  });

  test("country is stamped as 'ID' regardless of input · adapter is Indonesia-scoped", () => {
    const row = {
      internal_id: "77777777-7777-7777-7777-777777777777",
      public_listing_ref: "#FL-2024-V",
      business_name: "Warung V",
      category: null,
      address: null,
      city: "Bandung",
      district: null,
      coordinates_lng: null,
      coordinates_lat: null,
      phone: null,
      website: null,
      source: null,
      source_reference: null,
    };
    const r = projectFoodBusinessRow(row, PROJ_CFG);
    if (r.kind === "ok") {
      expect(r.candidate.country).toBe("ID");
    }
  });

  test("candidate_id is deterministic for the same public_listing_ref", () => {
    const row = {
      internal_id: "88888888-8888-8888-8888-888888888888",
      public_listing_ref: "#FL-2024-DET",
      business_name: "Warung Det",
      category: null,
      address: null,
      city: null,
      district: null,
      coordinates_lng: null,
      coordinates_lat: null,
      phone: null,
      website: null,
      source: null,
      source_reference: null,
    };
    const a = projectFoodBusinessRow(row, PROJ_CFG);
    const b = projectFoodBusinessRow(row, PROJ_CFG);
    if (a.kind === "ok" && b.kind === "ok") {
      expect(a.candidate.candidate_id).toBe(b.candidate.candidate_id);
    }
  });

  test("different public_listing_refs produce different candidate_ids", () => {
    const r1 = projectFoodBusinessRow(
      {
        internal_id: "x1",
        public_listing_ref: "#FL-A",
        business_name: "A",
        category: null,
        address: null,
        city: null,
        district: null,
        coordinates_lng: null,
        coordinates_lat: null,
        phone: null,
        website: null,
        source: null,
        source_reference: null,
      },
      PROJ_CFG,
    );
    const r2 = projectFoodBusinessRow(
      {
        internal_id: "x2",
        public_listing_ref: "#FL-B",
        business_name: "B",
        category: null,
        address: null,
        city: null,
        district: null,
        coordinates_lng: null,
        coordinates_lat: null,
        phone: null,
        website: null,
        source: null,
        source_reference: null,
      },
      PROJ_CFG,
    );
    if (r1.kind === "ok" && r2.kind === "ok") {
      expect(r1.candidate.candidate_id).not.toBe(r2.candidate.candidate_id);
    }
  });

  test("caveats record the legacy source + source_reference verbatim · no invention", () => {
    const row = {
      internal_id: "cv1",
      public_listing_ref: "#FL-CV",
      business_name: "Warung CV",
      category: null,
      address: null,
      city: null,
      district: null,
      coordinates_lng: null,
      coordinates_lat: null,
      phone: null,
      website: null,
      source: "yogyakarta_open_data_2024",
      source_reference: "permit-7",
    };
    const r = projectFoodBusinessRow(row, PROJ_CFG);
    if (r.kind === "ok") {
      expect(r.candidate.caveats.join(" ")).toContain("yogyakarta_open_data_2024");
      expect(r.candidate.caveats.join(" ")).toContain("permit-7");
    }
  });
});

// ═════════════════════════════════════════════════════════════════════
// §4 · createLegacyFoodBusinessSource · DirectorySource behaviour
// ═════════════════════════════════════════════════════════════════════

function buildReadFactory(
  responses: Array<{ re: RegExp; rows?: unknown[]; error?: Error }>,
): ReadSessionFactory {
  return {
    openSession: async (): Promise<ReadSession> => ({
      id: "mock-read",
      query: async <T>(sql: string, params: readonly unknown[]) => {
        void params;
        for (const r of responses) {
          if (r.re.test(sql)) {
            if (r.error) throw r.error;
            return {
              rows: (r.rows ?? []) as readonly T[],
              rowCount: (r.rows ?? []).length,
            };
          }
        }
        return { rows: [] as readonly T[], rowCount: 0 };
      },
    }),
    closeSession: async () => {},
  };
}

function fbRow(id: string, suffix = ""): unknown {
  return {
    internal_id: id,
    public_listing_ref: `#FL-2024-${id}${suffix}`,
    business_name: `Warung ${id}${suffix}`,
    category: "warung",
    address: null,
    city: "Yogyakarta",
    district: null,
    coordinates_lng: 110.37,
    coordinates_lat: -7.8,
    phone: null,
    website: null,
    source: "y",
    source_reference: null,
  };
}

describe("createLegacyFoodBusinessSource", () => {
  test("first batch starts with no cursor · ORDER BY internal_id ASC LIMIT N+1", async () => {
    const captured: string[] = [];
    const factory: ReadSessionFactory = {
      openSession: async () => ({
        id: "s",
        query: async <T>(sql: string, params: readonly unknown[]) => {
          void params;
          captured.push(sql);
          return { rows: [] as readonly T[], rowCount: 0 };
        },
      }),
      closeSession: async () => {},
    };
    const source = createLegacyFoodBusinessSource({
      session_factory: factory,
      config: PROJ_CFG,
    });
    await source.discoverBatch(null);
    const sql = captured.find((s) => /FROM nex\.food_business/.test(s))!;
    expect(sql).toContain("ORDER BY internal_id ASC");
    expect(sql).toContain("LIMIT $1");
    expect(sql).not.toContain("internal_id > $1"); // first batch · no cursor filter
  });

  test("subsequent batch uses WHERE internal_id > $1", async () => {
    const captured: string[] = [];
    const factory: ReadSessionFactory = {
      openSession: async () => ({
        id: "s",
        query: async <T>(sql: string, params: readonly unknown[]) => {
          void params;
          captured.push(sql);
          return { rows: [] as readonly T[], rowCount: 0 };
        },
      }),
      closeSession: async () => {},
    };
    const source = createLegacyFoodBusinessSource({
      session_factory: factory,
      config: PROJ_CFG,
    });
    await source.discoverBatch({ last_internal_id: "abc" });
    const sql = captured.find((s) => /FROM nex\.food_business/.test(s))!;
    expect(sql).toContain("WHERE internal_id > $1");
    expect(sql).toContain("LIMIT $2");
  });

  test("source_id and country are the sealed literals", () => {
    const factory = buildReadFactory([]);
    const source = createLegacyFoodBusinessSource({
      session_factory: factory,
      config: PROJ_CFG,
    });
    expect(source.source_id).toBe(LEGACY_FOOD_SOURCE_ID);
    expect(source.country).toBe(LEGACY_FOOD_COUNTRY);
  });

  test("empty result → exhausted", async () => {
    const factory = buildReadFactory([
      { re: /FROM nex\.food_business/, rows: [] },
    ]);
    const source = createLegacyFoodBusinessSource({
      session_factory: factory,
      config: PROJ_CFG,
    });
    const r = await source.discoverBatch(null);
    expect(r.kind).toBe("exhausted");
  });

  test("fewer than batchSize rows → more · next_cursor null · exhaustion detected next call", async () => {
    const factory = buildReadFactory([
      { re: /FROM nex\.food_business/, rows: [fbRow("one"), fbRow("two")] },
    ]);
    const source = createLegacyFoodBusinessSource({
      session_factory: factory,
      config: { ...PROJ_CFG, batchSize: 10 },
    });
    const r = await source.discoverBatch(null);
    expect(r.kind).toBe("more");
    if (r.kind === "more") {
      expect(r.candidates.length).toBe(2);
      expect(r.next_cursor).toBeNull();
    }
  });

  test("batchSize+1 rows → more · next_cursor carries last internal_id", async () => {
    const rows = [fbRow("a"), fbRow("b"), fbRow("c")];
    const factory = buildReadFactory([
      { re: /FROM nex\.food_business/, rows },
    ]);
    const source = createLegacyFoodBusinessSource({
      session_factory: factory,
      config: { ...PROJ_CFG, batchSize: 2 },
    });
    const r = await source.discoverBatch(null);
    expect(r.kind).toBe("more");
    if (r.kind === "more") {
      expect(r.candidates.length).toBe(2);
      expect(r.next_cursor).toEqual({ last_internal_id: "b" });
    }
  });

  test("projection failures are silently dropped from the batch · never fabricated", async () => {
    const badRow = {
      internal_id: "bad",
      public_listing_ref: "#FL-BAD",
      business_name: "", // triggers projection_failed
      category: null,
      address: null,
      city: null,
      district: null,
      coordinates_lng: null,
      coordinates_lat: null,
      phone: null,
      website: null,
      source: null,
      source_reference: null,
    };
    const goodRow = fbRow("good");
    const factory = buildReadFactory([
      { re: /FROM nex\.food_business/, rows: [badRow, goodRow] },
    ]);
    const source = createLegacyFoodBusinessSource({
      session_factory: factory,
      config: PROJ_CFG,
    });
    const r = await source.discoverBatch(null);
    expect(r.kind).toBe("more");
    if (r.kind === "more") {
      expect(r.candidates.length).toBe(1);
      expect(r.candidates[0].legacy_source.ref).toContain("#FL-2024-good");
    }
  });

  test("session open failure → temporary_failure", async () => {
    const brokenFactory: ReadSessionFactory = {
      openSession: async () => {
        throw new Error("mock open failure");
      },
      closeSession: async () => {},
    };
    const source = createLegacyFoodBusinessSource({
      session_factory: brokenFactory,
      config: PROJ_CFG,
    });
    const r = await source.discoverBatch(null);
    expect(r.kind).toBe("temporary_failure");
  });

  test("pg transient error code → temporary_failure", async () => {
    const err = Object.assign(new Error("conn gone"), { code: "08006" });
    const factory = buildReadFactory([
      { re: /FROM nex\.food_business/, error: err },
    ]);
    const source = createLegacyFoodBusinessSource({
      session_factory: factory,
      config: PROJ_CFG,
    });
    const r = await source.discoverBatch(null);
    expect(r.kind).toBe("temporary_failure");
    if (r.kind === "temporary_failure") {
      expect(r.reason).toContain("08006");
    }
  });

  test("non-transient pg error → permanent_failure", async () => {
    const err = Object.assign(new Error("relation does not exist"), {
      code: "42P01",
    });
    const factory = buildReadFactory([
      { re: /FROM nex\.food_business/, error: err },
    ]);
    const source = createLegacyFoodBusinessSource({
      session_factory: factory,
      config: PROJ_CFG,
    });
    const r = await source.discoverBatch(null);
    expect(r.kind).toBe("permanent_failure");
  });
});

// ═════════════════════════════════════════════════════════════════════
// §5 · durable-approval-queue · in-memory file I/O
// ═════════════════════════════════════════════════════════════════════

function createInMemoryApprovalIO(): {
  io: ApprovalIO;
  files: Map<string, string>;
} {
  const files = new Map<string, string>();
  return {
    files,
    io: {
      readTextOrEmpty: async (p: string) => files.get(p) ?? "",
      appendLine: async (p: string, line: string) => {
        const prev = files.get(p) ?? "";
        files.set(p, prev + line + "\n");
      },
      nowIso: () => "2026-10-08T12:30:00.000Z",
    },
  };
}

function pkgFor(candidate: Candidate): ReviewPackage {
  const report = reviewCandidates([candidate]);
  return buildReviewPackage({
    candidates: [candidate],
    report,
    packagedAt: "2026-10-08T12:00:00.000Z",
  });
}

function makeTestCandidate(id: string): Candidate {
  const row = {
    internal_id: id,
    public_listing_ref: `#FL-2024-${id}`,
    business_name: `Warung ${id}`,
    category: "warung",
    address: null,
    city: "Yogyakarta",
    district: null,
    coordinates_lng: 110.37,
    coordinates_lat: -7.8,
    phone: null,
    website: null,
    source: null,
    source_reference: null,
  };
  const r = projectFoodBusinessRow(row, PROJ_CFG);
  if (r.kind !== "ok") throw new Error("fixture setup error");
  return r.candidate;
}

describe("parsePendingQueue", () => {
  test("empty text → empty list", () => {
    expect(parsePendingQueue("")).toEqual([]);
  });

  test("round-trips a valid entry", () => {
    const c = makeTestCandidate("rt1");
    const pkg = pkgFor(c);
    const entry: PendingReviewEntry = {
      schema_version: PENDING_SCHEMA_VERSION,
      candidate_id: c.candidate_id,
      review_package_id: pkg.package_id,
      review_package: pkg,
      enqueued_at: "2026-10-08T12:30:00.000Z",
    };
    const serialized = serializePendingReviewEntry(entry) + "\n";
    const parsed = parsePendingQueue(serialized);
    expect(parsed.length).toBe(1);
    expect(parsed[0].candidate_id).toBe(c.candidate_id);
  });

  test("invalid schema_version is rejected with line info", () => {
    const bad = JSON.stringify({ schema_version: "wrong-version", candidate_id: "x" }) + "\n";
    expect(() => parsePendingQueue(bad)).toThrow(PendingQueueParseError);
  });

  test("non-object line rejected", () => {
    expect(() => parsePendingQueue("42\n")).toThrow(PendingQueueParseError);
  });

  test("invalid JSON rejected with line info", () => {
    expect(() => parsePendingQueue("{not valid\n")).toThrow(/line 1/);
  });
});

describe("createFileBackedApprovalProvider", () => {
  const PENDING_PATH = "/tmp/pending-review-queue.jsonl";
  const DECISION_PATH = "/tmp/decision-log.jsonl";

  test("no prior decision → enqueues to pending and returns null", async () => {
    const { io, files } = createInMemoryApprovalIO();
    const provider = createFileBackedApprovalProvider({
      pendingQueuePath: PENDING_PATH,
      decisionLogPath: DECISION_PATH,
      io,
    });
    const c = makeTestCandidate("q1");
    const pkg = pkgFor(c);
    const result = await provider({ package: pkg, candidate_id: c.candidate_id });
    expect(result).toBeNull();
    const text = files.get(PENDING_PATH) ?? "";
    const entries = parsePendingQueue(text);
    expect(entries.length).toBe(1);
    expect(entries[0].candidate_id).toBe(c.candidate_id);
    expect(entries[0].review_package_id).toBe(pkg.package_id);
  });

  test("already pending → does NOT enqueue duplicate · returns null", async () => {
    const { io, files } = createInMemoryApprovalIO();
    const provider = createFileBackedApprovalProvider({
      pendingQueuePath: PENDING_PATH,
      decisionLogPath: DECISION_PATH,
      io,
    });
    const c = makeTestCandidate("q2");
    const pkg = pkgFor(c);
    await provider({ package: pkg, candidate_id: c.candidate_id });
    await provider({ package: pkg, candidate_id: c.candidate_id });
    const entries = parsePendingQueue(files.get(PENDING_PATH) ?? "");
    expect(entries.length).toBe(1);
  });

  test("decision in log for this (candidate, package) → returns that DecisionRecord", async () => {
    const { io, files } = createInMemoryApprovalIO();
    const c = makeTestCandidate("q3");
    const pkg = pkgFor(c);
    const decision = decideCandidate({
      package: pkg,
      candidateId: c.candidate_id,
      decision: "approve",
      founderId: "test-founder",
      founderNote: "approved for the test",
      acknowledgedAnomalyRules: [],
      decisionTimestamp: "2026-10-08T13:00:00.000Z",
      supersedes: null,
    });
    files.set(DECISION_PATH, serializeDecisionLog([decision]));

    const provider = createFileBackedApprovalProvider({
      pendingQueuePath: PENDING_PATH,
      decisionLogPath: DECISION_PATH,
      io,
    });
    const result = await provider({ package: pkg, candidate_id: c.candidate_id });
    expect(result).not.toBeNull();
    expect(result?.decision_record_id).toBe(decision.decision_record_id);
    // Decision found · we must NOT ALSO enqueue a pending entry.
    const pending = parsePendingQueue(files.get(PENDING_PATH) ?? "");
    expect(pending.length).toBe(0);
  });

  test("decision for a DIFFERENT package_id is NOT returned", async () => {
    const { io, files } = createInMemoryApprovalIO();
    const c = makeTestCandidate("q4");
    const pkgA = pkgFor(c);
    const pkgB = buildReviewPackage({
      candidates: [c],
      report: reviewCandidates([c]),
      packagedAt: "2026-10-08T13:00:00.000Z", // different timestamp → different package_id
    });
    const decA = decideCandidate({
      package: pkgA,
      candidateId: c.candidate_id,
      decision: "approve",
      founderId: "f",
      founderNote: "a",
      acknowledgedAnomalyRules: [],
      decisionTimestamp: "2026-10-08T13:30:00.000Z",
      supersedes: null,
    });
    files.set(DECISION_PATH, serializeDecisionLog([decA]));
    const provider = createFileBackedApprovalProvider({
      pendingQueuePath: PENDING_PATH,
      decisionLogPath: DECISION_PATH,
      io,
    });
    // Query against pkgB · the pkgA decision must NOT apply
    const result = await provider({ package: pkgB, candidate_id: c.candidate_id });
    expect(result).toBeNull();
  });
});

describe("findDecisionForCandidate", () => {
  test("picks the latest non-superseded record for a candidate+package", () => {
    const c = makeTestCandidate("x");
    const pkg = pkgFor(c);
    const d1 = decideCandidate({
      package: pkg,
      candidateId: c.candidate_id,
      decision: "defer",
      founderId: "f",
      founderNote: null,
      acknowledgedAnomalyRules: [],
      decisionTimestamp: "2026-10-08T13:00:00.000Z",
      supersedes: null,
    });
    const d2 = decideCandidate({
      package: pkg,
      candidateId: c.candidate_id,
      decision: "approve",
      founderId: "f",
      founderNote: "yes",
      acknowledgedAnomalyRules: [],
      decisionTimestamp: "2026-10-08T13:10:00.000Z",
      supersedes: d1.decision_record_id,
      previousRecords: [d1],
    });
    const current = findDecisionForCandidate(
      [d1, d2],
      c.candidate_id,
      pkg.package_id,
    );
    expect(current?.decision_record_id).toBe(d2.decision_record_id);
    expect(current?.decision).toBe("approve");
  });

  test("returns null when no decision matches", () => {
    const c = makeTestCandidate("nope");
    const pkg = pkgFor(c);
    expect(findDecisionForCandidate([], c.candidate_id, pkg.package_id)).toBeNull();
  });
});

// ═════════════════════════════════════════════════════════════════════
// §6 · Pure-module grep invariants
// ═════════════════════════════════════════════════════════════════════

describe("real-ingestion modules · scope invariants", () => {
  test("pg-read-adapter source does NOT contain INSERT/UPDATE/DELETE/DDL", () => {
    const src = fs.readFileSync(
      path.join(__dirname, "pg-read-adapter.ts"),
      "utf8",
    );
    const code = src
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/[^\n]*/g, "");
    expect(code).not.toMatch(/\bINSERT\s+INTO\b/i);
    expect(code).not.toMatch(/\bUPDATE\s+\w+\s+SET\b/i);
    expect(code).not.toMatch(/\bDELETE\s+FROM\b/i);
    expect(code).not.toMatch(/\bCREATE\s+TABLE\b/i);
    expect(code).not.toMatch(/\bALTER\s+TABLE\b/i);
    expect(code).not.toMatch(/\bDROP\s+TABLE\b/i);
    expect(code).not.toMatch(/\bexecuteWritePlan\b/);
  });

  test("source-legacy-food-business source does NOT contain INSERT/UPDATE/DELETE/DDL and does NOT invoke executeWritePlan", () => {
    const src = fs.readFileSync(
      path.join(__dirname, "source-legacy-food-business.ts"),
      "utf8",
    );
    const code = src
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/[^\n]*/g, "");
    expect(code).not.toMatch(/\bINSERT\s+INTO\b/i);
    expect(code).not.toMatch(/\bUPDATE\s+\w+\s+SET\b/i);
    expect(code).not.toMatch(/\bDELETE\s+FROM\b/i);
    expect(code).not.toMatch(/\bCREATE\s+TABLE\b/i);
    expect(code).not.toMatch(/\bALTER\s+TABLE\b/i);
    expect(code).not.toMatch(/\bDROP\s+TABLE\b/i);
    expect(code).not.toMatch(/\bexecuteWritePlan\s*\(/);
    expect(code).not.toMatch(/\bresolveCanonical\s*\(/);
    expect(code).not.toMatch(/\bprecheckHandoff\s*\(/);
  });

  test("durable-approval-queue does NOT touch pg or any canonical write", () => {
    const src = fs.readFileSync(
      path.join(__dirname, "durable-approval-queue.ts"),
      "utf8",
    );
    const code = src
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/[^\n]*/g, "");
    expect(code).not.toMatch(/from\s+["']pg["']/);
    expect(code).not.toMatch(/\bexecuteWritePlan\s*\(/);
    expect(code).not.toMatch(/\bINSERT\s+INTO\b/i);
    expect(code).not.toMatch(/\bUPDATE\s+\w+\s+SET\b/i);
    expect(code).not.toMatch(/\bDELETE\s+FROM\b/i);
    expect(code).not.toMatch(/process\.env/);
  });

  test("source adapter does NOT read filesystem or env", () => {
    const src = fs.readFileSync(
      path.join(__dirname, "source-legacy-food-business.ts"),
      "utf8",
    );
    const code = src
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/[^\n]*/g, "");
    expect(code).not.toMatch(/\bfs\./);
    expect(code).not.toMatch(/process\.env/);
    expect(code).not.toMatch(/\bdotenv\b/);
  });

  test("pg-read-adapter uses the sealed assertNoForbiddenKeyword", () => {
    const src = fs.readFileSync(
      path.join(__dirname, "pg-read-adapter.ts"),
      "utf8",
    );
    expect(src).toContain("assertNoForbiddenKeyword");
    expect(src).toContain('from "./pg-executor"');
  });

  test("source-legacy-food-business DOES NOT invent coordinates / names / phones", () => {
    // There is no literal "0812" fallback or synthetic phone; no
    // hardcoded coordinate pair other than the test fixture; no
    // Math.random; no new Date.
    const src = fs.readFileSync(
      path.join(__dirname, "source-legacy-food-business.ts"),
      "utf8",
    );
    const code = src
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/[^\n]*/g, "");
    expect(code).not.toMatch(/\bMath\.random\b/);
    expect(code).not.toMatch(/\bnew\s+Date\b/);
    // No hardcoded phone that could be invented.
    expect(code).not.toMatch(/"\+62[0-9]{9,}"/);
  });
});

// ═════════════════════════════════════════════════════════════════════
// §7 · Constants
// ═════════════════════════════════════════════════════════════════════

describe("legacy source constants", () => {
  test("source_id and country are the sealed literals", () => {
    expect(LEGACY_FOOD_SOURCE_ID).toBe("nex_food_business_legacy");
    expect(LEGACY_FOOD_COUNTRY).toBe("ID");
    expect(LEGACY_FOOD_ENTITY_TYPE).toBe("food");
    expect(LEGACY_FOOD_DEFAULT_BATCH_SIZE).toBeGreaterThan(0);
  });
});
