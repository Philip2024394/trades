// scripts/nex-canonical/directory-ingestion-runner.test.ts
//
// Tests for the thin production runner. No real pg · no credentials ·
// uses vi.mock("pg") for the session factory and in-memory IO for
// files + clock + print.

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import type { CheckpointEvent } from "./directory-log";

type MockEvent =
  | { kind: "construct"; cfg: Record<string, unknown> }
  | { kind: "connect" }
  | { kind: "query"; sql: string; params: readonly unknown[] }
  | { kind: "end" };

const pgMock = vi.hoisted(() => ({
  events: [] as MockEvent[],
  responses: new Map<string | RegExp, { rows: unknown[]; error?: Error }>(),
  connectShouldThrow: null as null | Error,
}));

vi.mock("pg", () => {
  class Client {
    constructor(cfg: Record<string, unknown>) {
      pgMock.events.push({ kind: "construct", cfg });
    }
    async connect() {
      pgMock.events.push({ kind: "connect" });
      if (pgMock.connectShouldThrow) throw pgMock.connectShouldThrow;
    }
    async query<T>(sql: string, params: readonly unknown[] = []) {
      pgMock.events.push({ kind: "query", sql, params });
      for (const [k, v] of pgMock.responses.entries()) {
        const match = typeof k === "string" ? sql === k : k.test(sql);
        if (match) {
          if (v.error) throw v.error;
          return { rows: v.rows as T[], rowCount: v.rows.length };
        }
      }
      return { rows: [] as T[], rowCount: 0 };
    }
    async end() {
      pgMock.events.push({ kind: "end" });
    }
  }
  return { Client };
});

import {
  DownstreamNotPermittedError,
  REQUIRED_INGESTION_ENV_VARS,
  buildDiscoveryOnlyDownstreamStubs,
  preflight,
  runRealDirectoryIngestionID,
  verifyFingerprintOnce,
  type IngestionIO,
  type RealIngestionConfig,
} from "./directory-ingestion-runner";
import type { ReadSessionFactory } from "./pg-read-adapter";

beforeEach(() => {
  pgMock.events.length = 0;
  pgMock.responses.clear();
  pgMock.connectShouldThrow = null;
});

afterEach(() => {
  pgMock.events.length = 0;
  pgMock.responses.clear();
});

// ═════════════════════════════════════════════════════════════════════
// §1 · preflight · env var presence (names only)
// ═════════════════════════════════════════════════════════════════════

const COMPLETE_ENV: NodeJS.ProcessEnv = {
  NEX_CANONICAL_PG_HOST: "fake",
  NEX_CANONICAL_PG_DATABASE: "nex_business",
  NEX_CANONICAL_PG_USER: "nex_rw",
  NEX_CANONICAL_PG_PASSWORD: "SECRET-ought-never-to-echo",
  NEX_CANONICAL_PG_EXPECTED_DATABASE: "nex_business",
  NEX_CANONICAL_PG_EXPECTED_USER: "nex_rw",
  NEX_CANONICAL_PG_EXPECTED_SERVER_VERSION_PREFIX: "15.",
  NEX_CANONICAL_PG_EXPECTED_SCHEMAS: "nex,public",
};

describe("preflight", () => {
  test("happy path · all 8 required vars present", () => {
    const r = preflight(COMPLETE_ENV);
    expect(r.ok).toBe(true);
    expect(r.missing).toEqual([]);
    expect(r.present.length).toBe(REQUIRED_INGESTION_ENV_VARS.length);
  });

  test.each(REQUIRED_INGESTION_ENV_VARS)(
    "missing %s is reported by name",
    (missing) => {
      const env = { ...COMPLETE_ENV };
      delete env[missing];
      const r = preflight(env);
      expect(r.ok).toBe(false);
      expect(r.missing).toContain(missing);
      // Value of other vars must NOT appear in the returned data.
      const serial = JSON.stringify(r);
      expect(serial).not.toContain(COMPLETE_ENV.NEX_CANONICAL_PG_PASSWORD);
    },
  );

  test("empty string treated as missing · never echoes the empty value", () => {
    const env = { ...COMPLETE_ENV, NEX_CANONICAL_PG_HOST: "" };
    const r = preflight(env);
    expect(r.missing).toContain("NEX_CANONICAL_PG_HOST");
  });

  test("REQUIRED_INGESTION_ENV_VARS has 8 entries · 4 credentials + 4 fingerprint", () => {
    expect(REQUIRED_INGESTION_ENV_VARS.length).toBe(8);
  });
});

// ═════════════════════════════════════════════════════════════════════
// §2 · buildDiscoveryOnlyDownstreamStubs · all paths throw
// ═════════════════════════════════════════════════════════════════════

describe("buildDiscoveryOnlyDownstreamStubs", () => {
  test("resolverPoolProvider throws DownstreamNotPermittedError", async () => {
    const stubs = buildDiscoveryOnlyDownstreamStubs();
    await expect(
      stubs.resolverPoolProvider({ country: "ID", entity_type: "food" }),
    ).rejects.toThrow(DownstreamNotPermittedError);
  });

  test("sourceRegistryRowProvider throws", async () => {
    const stubs = buildDiscoveryOnlyDownstreamStubs();
    await expect(stubs.sourceRegistryRowProvider("x")).rejects.toThrow(
      DownstreamNotPermittedError,
    );
  });

  test("currentCanonicalRowProvider throws", async () => {
    const stubs = buildDiscoveryOnlyDownstreamStubs();
    await expect(stubs.currentCanonicalRowProvider("x")).rejects.toThrow(
      DownstreamNotPermittedError,
    );
  });

  test("osmCollisionProvider throws", async () => {
    const stubs = buildDiscoveryOnlyDownstreamStubs();
    await expect(
      stubs.osmCollisionProvider({ country: "ID", osm_id: "node/1" }),
    ).rejects.toThrow(DownstreamNotPermittedError);
  });

  test("writeSessionFactory.openSession / closeSession both throw", async () => {
    const stubs = buildDiscoveryOnlyDownstreamStubs();
    await expect(stubs.writeSessionFactory.openSession()).rejects.toThrow(
      DownstreamNotPermittedError,
    );
    await expect(
      stubs.writeSessionFactory.closeSession({ id: "x", query: async () => ({ rows: [], rowCount: 0 }) }),
    ).rejects.toThrow(DownstreamNotPermittedError);
  });

  test("readbackSessionFactory also throws", async () => {
    const stubs = buildDiscoveryOnlyDownstreamStubs();
    await expect(stubs.readbackSessionFactory.openSession()).rejects.toThrow(
      DownstreamNotPermittedError,
    );
  });
});

// ═════════════════════════════════════════════════════════════════════
// §3 · verifyFingerprintOnce
// ═════════════════════════════════════════════════════════════════════

function makeFingerprintFactory(observed: {
  db?: string;
  usr?: string;
  srv?: string;
  schemas?: readonly string[];
}): ReadSessionFactory {
  return {
    openSession: async () => ({
      id: "mock-fp",
      query: async <T>(sql: string) => {
        if (/current_database/.test(sql))
          return { rows: [{ db: observed.db ?? "nex_business" }] as unknown as readonly T[], rowCount: 1 };
        if (/current_user AS usr/.test(sql))
          return { rows: [{ usr: observed.usr ?? "nex_rw" }] as unknown as readonly T[], rowCount: 1 };
        if (/current_setting\('server_version'\)/.test(sql))
          return { rows: [{ srv_version: observed.srv ?? "15.4" }] as unknown as readonly T[], rowCount: 1 };
        if (/information_schema\.schemata/.test(sql))
          return {
            rows: (observed.schemas ?? ["nex", "public"]).map((s) => ({
              schema_name: s,
            })) as unknown as readonly T[],
            rowCount: 2,
          };
        return { rows: [] as readonly T[], rowCount: 0 };
      },
    }),
    closeSession: async () => {},
  };
}

describe("verifyFingerprintOnce", () => {
  const expected = {
    database: "nex_business",
    user: "nex_rw",
    serverVersionPrefix: "15.",
    schemas: ["nex", "public"] as readonly string[],
  };

  test("ok when observed matches expected", async () => {
    const r = await verifyFingerprintOnce(makeFingerprintFactory({}), expected);
    expect(r.ok).toBe(true);
  });

  test("not ok when database differs", async () => {
    const r = await verifyFingerprintOnce(
      makeFingerprintFactory({ db: "WRONG" }),
      expected,
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain("fingerprint mismatch");
  });

  test("not ok when user differs", async () => {
    const r = await verifyFingerprintOnce(
      makeFingerprintFactory({ usr: "wrong_user" }),
      expected,
    );
    expect(r.ok).toBe(false);
  });

  test("not ok when server version prefix differs", async () => {
    const r = await verifyFingerprintOnce(
      makeFingerprintFactory({ srv: "14.9" }),
      expected,
    );
    expect(r.ok).toBe(false);
  });

  test("not ok when a required schema is missing", async () => {
    const r = await verifyFingerprintOnce(
      makeFingerprintFactory({ schemas: ["public"] }),
      expected,
    );
    expect(r.ok).toBe(false);
  });

  test("session open failure surfaces as not ok", async () => {
    const brokenFactory: ReadSessionFactory = {
      openSession: async () => {
        throw new Error("mock open failure");
      },
      closeSession: async () => {},
    };
    const r = await verifyFingerprintOnce(brokenFactory, expected);
    expect(r.ok).toBe(false);
  });
});

// ═════════════════════════════════════════════════════════════════════
// §4 · runRealDirectoryIngestionID · gating + mocked session
// ═════════════════════════════════════════════════════════════════════

function createInMemoryIO(env: NodeJS.ProcessEnv): {
  io: IngestionIO;
  files: Map<string, string>;
  printed: string[];
} {
  const files = new Map<string, string>();
  const printed: string[] = [];
  return {
    files,
    printed,
    io: {
      env,
      nowIso: () => "2026-10-08T12:00:00.000Z",
      sleep: async () => {},
      readTextOrEmpty: async (p) => files.get(p) ?? "",
      appendLine: async (p, line) => {
        const prev = files.get(p) ?? "";
        files.set(p, prev + line + "\n");
      },
      print: (m) => {
        printed.push(m);
      },
    },
  };
}

function baseConfig(overrides: Partial<RealIngestionConfig> = {}): RealIngestionConfig {
  const base: RealIngestionConfig = {
    country: "ID",
    pendingQueuePath: "/mem/pending.jsonl",
    decisionLogPath: "/mem/decisions.jsonl",
    checkpointLogPath: "/mem/checkpoint.jsonl",
    generationRunId: "nex-ingest-test",
    batchSize: 10,
    maxBatchesPerSource: 5,
    maxCandidatesPerSource: 100,
  };
  return { ...base, ...overrides };
}

describe("runRealDirectoryIngestionID · preflight gate", () => {
  test("stops when required env is missing · reports missing names only", async () => {
    const env = { ...COMPLETE_ENV };
    delete env.NEX_CANONICAL_PG_HOST;
    const { io, printed } = createInMemoryIO(env);
    const r = await runRealDirectoryIngestionID({ config: baseConfig(), io });
    expect(r.stage).toBe("stopped");
    expect(r.stop_reason).toBe("preflight_env_missing");
    expect(r.preflight.missing).toContain("NEX_CANONICAL_PG_HOST");
    // No PG connection opened.
    const constructs = pgMock.events.filter((e) => e.kind === "construct");
    expect(constructs.length).toBe(0);
    // No printed value contains the password.
    const serialPrinted = printed.join(" | ");
    expect(serialPrinted).not.toContain(COMPLETE_ENV.NEX_CANONICAL_PG_PASSWORD);
  });
});

describe("runRealDirectoryIngestionID · fingerprint gate", () => {
  test("stops before any discovery when fingerprint mismatches", async () => {
    const { io } = createInMemoryIO(COMPLETE_ENV);
    // Mock PG: fingerprint reports WRONG database.
    pgMock.responses.set(/current_database/, { rows: [{ db: "WRONG_DB" }] });
    pgMock.responses.set(/current_user AS usr/, { rows: [{ usr: "nex_rw" }] });
    pgMock.responses.set(/current_setting\('server_version'\)/, {
      rows: [{ srv_version: "15.4" }],
    });
    pgMock.responses.set(/information_schema\.schemata/, {
      rows: [{ schema_name: "nex" }, { schema_name: "public" }],
    });
    const r = await runRealDirectoryIngestionID({ config: baseConfig(), io });
    expect(r.stage).toBe("stopped");
    expect(r.stop_reason).toBe("preflight_fingerprint_mismatch");
    expect(r.fingerprint_ok).toBe(false);
    expect(r.fingerprint_detail).toContain("fingerprint mismatch");
    // No source SELECT ran · the mock events include fingerprint SELECTs
    // and session-config SETs but no FROM nex.food_business query.
    const foodQueries = pgMock.events.filter(
      (e) =>
        e.kind === "query" && /FROM nex\.food_business/.test(e.sql),
    );
    expect(foodQueries.length).toBe(0);
  });
});

describe("runRealDirectoryIngestionID · full discovery with mocked PG", () => {
  function installPassingFingerprint(): void {
    pgMock.responses.set(/current_database\(\)/, {
      rows: [{ db: "nex_business" }],
    });
    pgMock.responses.set(/current_user AS usr/, {
      rows: [{ usr: "nex_rw" }],
    });
    pgMock.responses.set(/current_setting\('server_version'\)/, {
      rows: [{ srv_version: "15.4" }],
    });
    pgMock.responses.set(/information_schema\.schemata/, {
      rows: [{ schema_name: "nex" }, { schema_name: "public" }],
    });
  }

  test("happy path · one batch of real-shape rows · all enqueued as pending", async () => {
    installPassingFingerprint();
    const foodRows = [
      {
        internal_id: "11111111-1111-1111-1111-111111111111",
        public_listing_ref: "#FL-2024-R1",
        business_name: "Warung Alpha",
        category: "warung",
        address: null,
        city: "Yogyakarta",
        district: "Umbulharjo",
        coordinates_lng: 110.37,
        coordinates_lat: -7.8,
        phone: "+6281234567890",
        website: "warungalpha.id",
        source: "yogyakarta_open_data_2024",
        source_reference: "permit-1",
      },
      {
        internal_id: "22222222-2222-2222-2222-222222222222",
        public_listing_ref: "#FL-2024-R2",
        business_name: "Warung Beta",
        category: "warung",
        address: null,
        city: "Yogyakarta",
        district: null,
        coordinates_lng: null,
        coordinates_lat: null,
        phone: null,
        website: null,
        source: "yogyakarta_open_data_2024",
        source_reference: "permit-2",
      },
    ];
    pgMock.responses.set(/FROM nex\.food_business/, { rows: foodRows });

    const { io, files } = createInMemoryIO(COMPLETE_ENV);
    const r = await runRealDirectoryIngestionID({ config: baseConfig(), io });
    expect(r.stage).toBe("complete");
    expect(r.stop_reason).toBe("runner_completed");
    expect(r.fingerprint_ok).toBe(true);
    expect(r.source_id).toBe("nex_food_business_legacy");
    expect(r.country).toBe("ID");
    expect(r.discovered_count).toBe(2);
    expect(r.enqueued_count).toBe(2);
    expect(r.already_pending_count).toBe(0);
    expect(r.downstream_violation).toBeNull();

    // The pending queue file now carries 2 entries.
    const pending = (files.get("/mem/pending.jsonl") ?? "")
      .split("\n")
      .filter((l) => l.length > 0);
    expect(pending.length).toBe(2);

    // The checkpoint log has candidate_quarantined events with
    // outcome=approval_deferred for both candidates.
    const ck = (files.get("/mem/checkpoint.jsonl") ?? "")
      .split("\n")
      .filter((l) => l.length > 0)
      .map((l) => JSON.parse(l) as CheckpointEvent);
    const quarantined = ck.filter(
      (e) => e.kind === "candidate_quarantined",
    );
    expect(quarantined.length).toBe(2);
    for (const q of quarantined) {
      if (q.kind === "candidate_quarantined") {
        expect(q.outcome).toBe("approval_deferred");
      }
    }
    // No candidate_written events emitted.
    const written = ck.filter((e) => e.kind === "candidate_written");
    expect(written.length).toBe(0);
  });

  test("resume · already-pending candidates are not duplicated", async () => {
    installPassingFingerprint();
    const row = {
      internal_id: "33333333-3333-3333-3333-333333333333",
      public_listing_ref: "#FL-2024-R3",
      business_name: "Warung Gamma",
      category: null,
      address: null,
      city: "Yogyakarta",
      district: null,
      coordinates_lng: 110,
      coordinates_lat: -7.8,
      phone: null,
      website: null,
      source: null,
      source_reference: null,
    };
    pgMock.responses.set(/FROM nex\.food_business/, { rows: [row] });
    const { io, files } = createInMemoryIO(COMPLETE_ENV);

    // First run · 1 enqueue
    await runRealDirectoryIngestionID({ config: baseConfig(), io });
    expect(
      (files.get("/mem/pending.jsonl") ?? "").split("\n").filter((l) => l.length > 0).length,
    ).toBe(1);

    // Second run · must NOT duplicate the pending entry
    pgMock.events.length = 0;
    pgMock.responses.clear();
    installPassingFingerprint();
    pgMock.responses.set(/FROM nex\.food_business/, { rows: [row] });
    const r2 = await runRealDirectoryIngestionID({ config: baseConfig(), io });
    const after = (files.get("/mem/pending.jsonl") ?? "")
      .split("\n")
      .filter((l) => l.length > 0);
    expect(after.length).toBe(1); // dedup held
    expect(r2.enqueued_count).toBe(0);
    expect(r2.already_pending_count).toBe(1);
  });

  test("empty table · exhausted immediately · no candidates discovered · no downstream violation", async () => {
    installPassingFingerprint();
    pgMock.responses.set(/FROM nex\.food_business/, { rows: [] });
    const { io } = createInMemoryIO(COMPLETE_ENV);
    const r = await runRealDirectoryIngestionID({ config: baseConfig(), io });
    expect(r.stage).toBe("complete");
    expect(r.discovered_count).toBe(0);
    expect(r.enqueued_count).toBe(0);
    expect(r.downstream_violation).toBeNull();
  });
});

// ═════════════════════════════════════════════════════════════════════
// §5 · Pure-module grep invariants
// ═════════════════════════════════════════════════════════════════════

describe("directory-ingestion-runner source · scope invariants", () => {
  const srcPath = path.join(__dirname, "directory-ingestion-runner.ts");
  const src = fs.readFileSync(srcPath, "utf8");
  const code = src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/[^\n]*/g, "");

  test("CODE does NOT contain INSERT/UPDATE/DELETE/CREATE/ALTER/DROP SQL", () => {
    expect(code).not.toMatch(/\bINSERT\s+INTO\b/i);
    expect(code).not.toMatch(/\bUPDATE\s+\w+\s+SET\b/i);
    expect(code).not.toMatch(/\bDELETE\s+FROM\b/i);
    expect(code).not.toMatch(/\bCREATE\s+TABLE\b/i);
    expect(code).not.toMatch(/\bALTER\s+TABLE\b/i);
    expect(code).not.toMatch(/\bDROP\s+TABLE\b/i);
  });

  test("CODE does NOT call executeWritePlan / precheckHandoff / decideCandidate / resolveCanonical directly", () => {
    expect(code).not.toMatch(/\bexecuteWritePlan\s*\(/);
    expect(code).not.toMatch(/\bprecheckHandoff\s*\(/);
    expect(code).not.toMatch(/\bdecideCandidate\s*\(/);
    expect(code).not.toMatch(/\bresolveCanonical\s*\(/);
  });

  test("CODE does NOT read env filesystem or dotenv", () => {
    expect(code).not.toMatch(/\bdotenv\b/);
    expect(code).not.toMatch(/\.pgpass/);
    expect(code).not.toMatch(/\bfs\.readFile/);
  });

  test("CODE does NOT print env values · only names/non-secrets", () => {
    // No template that embeds env[*] into a print string.
    expect(code).not.toMatch(/args\.io\.print\s*\(\s*`[^`]*\$\{[^`]*env\./);
    // No console.log of secrets.
    expect(code).not.toMatch(/console\.log\s*\(.*password/i);
  });

  test("CODE restricts country to the 'ID' literal", () => {
    expect(code).toMatch(/country:\s*"ID"/);
  });

  test("CODE's local imports are the sealed consumer surface", () => {
    const localImports = [
      ...code.matchAll(/from\s+["']\.\/([^"']+)["']/g),
    ].map((m) => m[1]);
    const allowed = new Set([
      "pg-fingerprint",
      "pg-read-adapter",
      "source-legacy-food-business",
      "durable-approval-queue",
      "directory-log",
      "directory-runner",
    ]);
    for (const imp of localImports) {
      expect(allowed.has(imp)).toBe(true);
    }
  });

  test("CODE uses the throw-on-call downstream stubs", () => {
    expect(code).toMatch(/\bDownstreamNotPermittedError\b/);
    expect(code).toMatch(/buildDiscoveryOnlyDownstreamStubs/);
  });
});
