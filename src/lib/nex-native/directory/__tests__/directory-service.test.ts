// src/lib/nex-native/directory/__tests__/directory-service.test.ts
//
// NEX Directory · Phase A · Server data layer tests.
//
// Covers
//   · adaptRawCanonicalRow handles every nullable-column permutation
//   · adaptRawCanonicalRow rejects malformed enum values (returns null)
//   · listDirectory composes projector + resolver correctly
//   · systemReady=false when NEX_POSTGRES_URL is unset (withClient null)
//   · systemReady=false when the pg driver throws
//   · credential-shaped substrings are redacted from diagnostics
//   · fetchOwnerClaimsByCanonicalId returns an empty map (stub)
//   · buildCanonicalSql produces correctly parameterised SELECTs
//   · directory-service.ts uses the NEX_POSTGRES_URL read path (static)
//
// This file does NOT make real network calls. The `@/lib/nex/db`
// withClient helper is mocked at module boundary via vi.mock.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// ─── Mock @/lib/nex/db to intercept withClient ────────────────────────
//
// The service module imports `withClient` from `@/lib/nex/db`. We
// mock that path so no real pool / pg driver is instantiated during
// tests. The mock supports three behaviours set per-test via
// `currentBehavior`:
//
//   { kind: "ok" }     · the callback runs against a stub client
//                         whose .query returns `result`
//   { kind: "throws" } · the stub client's .query throws
//   { kind: "null" }   · withClient itself returns null (as it does
//                         when NEX_POSTGRES_URL is unset)
//
// The stub records the last SQL + params it saw so tests can assert
// on the query shape delivered to the driver.

type MockQueryResult = {
  rows: readonly unknown[];
  rowCount: number | null;
};

type MockBehavior =
  | { kind: "ok"; result: MockQueryResult }
  | { kind: "throws"; error: Error }
  | { kind: "null" };

let currentBehavior: MockBehavior = {
  kind: "ok",
  result: { rows: [], rowCount: 0 },
};

let lastQuery: { sql: string; params: readonly unknown[] } | null = null;

vi.mock("@/lib/nex/db", () => ({
  withClient: async <T>(
    fn: (c: {
      query: (sql: string, params?: unknown[]) => Promise<MockQueryResult>;
    }) => Promise<T>,
  ): Promise<T | null> => {
    if (currentBehavior.kind === "null") return null;
    const client = {
      query: async (sql: string, params?: unknown[]) => {
        lastQuery = { sql, params: params ?? [] };
        if (currentBehavior.kind === "throws") throw currentBehavior.error;
        return currentBehavior.result;
      },
    };
    return fn(client);
  },
}));

import {
  CANONICAL_TABLE,
  CANONICAL_SCHEMA,
  DEFAULT_LIMIT,
  SELECT_COLUMNS,
  SURFACED_LIFECYCLE_STATES,
  _internal,
  adaptRawCanonicalRow,
  fetchOwnerClaimsByCanonicalId,
  listDirectory,
} from "../directory-service";

// ═════════════════════════════════════════════════════════════════════
// §1 · Constants
// ═════════════════════════════════════════════════════════════════════

describe("directory-service · sealed constants", () => {
  it("CANONICAL_TABLE is 'business_canonical'", () => {
    expect(CANONICAL_TABLE).toBe("business_canonical");
  });

  it("CANONICAL_SCHEMA is 'nex'", () => {
    expect(CANONICAL_SCHEMA).toBe("nex");
  });

  it("DEFAULT_LIMIT is a positive integer", () => {
    expect(DEFAULT_LIMIT).toBeGreaterThan(0);
    expect(Number.isInteger(DEFAULT_LIMIT)).toBe(true);
  });

  it("SURFACED_LIFECYCLE_STATES excludes SUPERSEDED", () => {
    expect(SURFACED_LIFECYCLE_STATES).not.toContain("SUPERSEDED");
  });

  it("SURFACED_LIFECYCLE_STATES includes all 6 user-facing states", () => {
    const expected = [
      "DISCOVERED",
      "ENRICHED",
      "VERIFIED",
      "OWNER_CLAIMED",
      "OWNER_VERIFIED",
      "DORMANT",
    ];
    expect([...SURFACED_LIFECYCLE_STATES].sort()).toEqual([...expected].sort());
  });

  it("SELECT_COLUMNS lists the sealed read columns and omits coordinates", () => {
    expect(SELECT_COLUMNS).toContain("canonical_business_id");
    expect(SELECT_COLUMNS).toContain("entity_type");
    expect(SELECT_COLUMNS).toContain("country");
    expect(SELECT_COLUMNS).toContain("lifecycle_state");
    expect(SELECT_COLUMNS).toContain("name_canonical");
    expect(SELECT_COLUMNS).toContain("name_norm");
    expect(SELECT_COLUMNS).toContain("last_verified_at");
    expect(SELECT_COLUMNS).not.toContain("coordinates");
  });
});

// ═════════════════════════════════════════════════════════════════════
// §2 · adaptRawCanonicalRow · nullable handling
// ═════════════════════════════════════════════════════════════════════

function completeRaw() {
  return {
    canonical_business_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    entity_type: "food" as string,
    country: "ID",
    lifecycle_state: "VERIFIED" as string,
    name_canonical: "Warung Siti",
    name_norm: "warung siti",
    aliases: ["Nasi Siti"],
    phone_e164: "+628123456789",
    website_apex: "warungibusiti.id",
    osm_id: "node/1",
    wikidata_qid: "Q1",
    city: "Yogyakarta",
    district: "Umbulharjo",
    category_ids: ["restaurant"],
    services_products: { menu: [] },
    supersedes_business_id: null,
    superseded_by_business_id: null,
    last_verified_at: "2026-10-07T00:00:00Z",
  };
}

describe("adaptRawCanonicalRow · complete row", () => {
  it("preserves identity + enum values", () => {
    const row = adaptRawCanonicalRow(completeRaw());
    expect(row).not.toBe(null);
    expect(row!.canonical_business_id).toBe(
      "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    );
    expect(row!.entity_type).toBe("food");
    expect(row!.lifecycle_state).toBe("VERIFIED");
  });

  it("coordinates is null (service does not SELECT geography · documented gap)", () => {
    const row = adaptRawCanonicalRow(completeRaw());
    expect(row!.coordinates).toBe(null);
  });

  it("services_products passes through as unknown payload", () => {
    const raw = completeRaw();
    const row = adaptRawCanonicalRow(raw);
    expect(row!.services_products).toBe(raw.services_products);
  });
});

describe("adaptRawCanonicalRow · nullable handling", () => {
  it("null aliases → empty readonly array (never fabricated)", () => {
    const raw = { ...completeRaw(), aliases: null };
    const row = adaptRawCanonicalRow(raw);
    expect(row!.aliases).toEqual([]);
  });

  it("null category_ids → empty readonly array", () => {
    const raw = { ...completeRaw(), category_ids: null };
    const row = adaptRawCanonicalRow(raw);
    expect(row!.category_ids).toEqual([]);
  });

  it("null services_products → null in VM", () => {
    const raw = { ...completeRaw(), services_products: null };
    const row = adaptRawCanonicalRow(raw);
    expect(row!.services_products).toBe(null);
  });

  it("all nullable columns stay nullable", () => {
    const raw = {
      ...completeRaw(),
      phone_e164: null,
      website_apex: null,
      osm_id: null,
      wikidata_qid: null,
      city: null,
      district: null,
      supersedes_business_id: null,
      superseded_by_business_id: null,
      last_verified_at: null,
    };
    const row = adaptRawCanonicalRow(raw);
    expect(row!.phone_e164).toBe(null);
    expect(row!.website_apex).toBe(null);
    expect(row!.osm_id).toBe(null);
    expect(row!.wikidata_qid).toBe(null);
    expect(row!.city).toBe(null);
    expect(row!.district).toBe(null);
    expect(row!.supersedes_business_id).toBe(null);
    expect(row!.superseded_by_business_id).toBe(null);
    expect(row!.last_verified_at).toBe(null);
  });
});

// ═════════════════════════════════════════════════════════════════════
// §3 · adaptRawCanonicalRow · enum validation
// ═════════════════════════════════════════════════════════════════════

describe("adaptRawCanonicalRow · defensive enum rejection", () => {
  it("rejects a row with an unknown entity_type (returns null)", () => {
    const raw = { ...completeRaw(), entity_type: "spaceship" };
    expect(adaptRawCanonicalRow(raw)).toBe(null);
  });

  it("rejects a row with an unknown lifecycle_state (returns null)", () => {
    const raw = { ...completeRaw(), lifecycle_state: "QUARANTINED" };
    expect(adaptRawCanonicalRow(raw)).toBe(null);
  });

  it("accepts all 9 sealed entity_types", () => {
    const sealed = [
      "food",
      "accommodation",
      "service",
      "professional",
      "vehicle_rental",
      "marketplace_seller",
      "transport_driver",
      "transport_operator",
      "place",
    ];
    for (const et of sealed) {
      const raw = { ...completeRaw(), entity_type: et };
      const row = adaptRawCanonicalRow(raw);
      expect(row).not.toBe(null);
      expect(row!.entity_type).toBe(et);
    }
  });

  it("accepts all 7 sealed lifecycle_states", () => {
    const sealed = [
      "DISCOVERED",
      "ENRICHED",
      "VERIFIED",
      "OWNER_CLAIMED",
      "OWNER_VERIFIED",
      "DORMANT",
      "SUPERSEDED",
    ];
    for (const s of sealed) {
      const raw = { ...completeRaw(), lifecycle_state: s };
      const row = adaptRawCanonicalRow(raw);
      expect(row).not.toBe(null);
      expect(row!.lifecycle_state).toBe(s);
    }
  });
});

// ═════════════════════════════════════════════════════════════════════
// §4 · listDirectory · behaviour
// ═════════════════════════════════════════════════════════════════════

beforeEach(() => {
  currentBehavior = { kind: "ok", result: { rows: [], rowCount: 0 } };
  lastQuery = null;
});

afterEach(() => {
  currentBehavior = { kind: "ok", result: { rows: [], rowCount: 0 } };
  lastQuery = null;
});

describe("listDirectory · empty result", () => {
  it("returns systemReady=true with an empty results list when the DB returns 0 rows", async () => {
    currentBehavior = { kind: "ok", result: { rows: [], rowCount: 0 } };
    const outcome = await listDirectory({ country: "ID" });
    expect(outcome.systemReady).toBe(true);
    expect(outcome.results).toEqual([]);
    expect(outcome.diagnostic).toBe(null);
  });
});

describe("listDirectory · NEX_POSTGRES_URL unset", () => {
  it("returns systemReady=false with an honest diagnostic when withClient returns null", async () => {
    currentBehavior = { kind: "null" };
    const outcome = await listDirectory({ country: "ID" });
    expect(outcome.systemReady).toBe(false);
    expect(outcome.results).toEqual([]);
    expect(outcome.diagnostic).not.toBe(null);
    expect(outcome.diagnostic!).toContain("NEX_POSTGRES_URL");
  });

  it("does not invoke the pg client when withClient returns null", async () => {
    currentBehavior = { kind: "null" };
    await listDirectory({ country: "ID" });
    expect(lastQuery).toBe(null);
  });
});

describe("listDirectory · unavailable systems", () => {
  it("returns systemReady=false when the pg client throws (relation does not exist)", async () => {
    currentBehavior = {
      kind: "throws",
      error: new Error('relation "nex.business_canonical" does not exist'),
    };
    const outcome = await listDirectory({ country: "ID" });
    expect(outcome.systemReady).toBe(false);
    expect(outcome.results).toEqual([]);
    expect(outcome.diagnostic).not.toBe(null);
    expect(outcome.diagnostic!).toContain("relation");
  });

  it("returns systemReady=false when the schema does not exist", async () => {
    currentBehavior = {
      kind: "throws",
      error: new Error('schema "nex" does not exist'),
    };
    const outcome = await listDirectory({ country: "ID" });
    expect(outcome.systemReady).toBe(false);
    expect(outcome.diagnostic!).toContain("schema");
  });

  it("returns systemReady=false on connect refused", async () => {
    currentBehavior = {
      kind: "throws",
      error: new Error("ECONNREFUSED 127.0.0.1:5433"),
    };
    const outcome = await listDirectory({ country: "ID" });
    expect(outcome.systemReady).toBe(false);
    expect(outcome.diagnostic!).toContain("ECONNREFUSED");
  });

  it("returns systemReady=false on authentication failure", async () => {
    currentBehavior = {
      kind: "throws",
      error: new Error('password authentication failed for user "nex"'),
    };
    const outcome = await listDirectory({ country: "ID" });
    expect(outcome.systemReady).toBe(false);
    expect(outcome.diagnostic!).toContain("authentication");
  });

  it("never fabricates a result on failure", async () => {
    currentBehavior = {
      kind: "throws",
      error: new Error("any pg error"),
    };
    const outcome = await listDirectory({ country: "ID" });
    expect(outcome.results).toEqual([]);
  });

  it("redacts credential-shaped substrings from the diagnostic", async () => {
    currentBehavior = {
      kind: "throws",
      error: new Error(
        "connection failed: postgres://nex:secretpass@db.example.com:5432/nex",
      ),
    };
    const outcome = await listDirectory({ country: "ID" });
    expect(outcome.diagnostic!).toContain("[redacted]");
    expect(outcome.diagnostic!).not.toContain("secretpass");
  });
});

describe("listDirectory · populated results", () => {
  it("projects canonical rows → VMs and resolves destinations", async () => {
    currentBehavior = {
      kind: "ok",
      result: {
        rows: [
          {
            ...completeRaw(),
            canonical_business_id: "11111111-1111-4111-8111-111111111111",
            lifecycle_state: "DISCOVERED",
          },
          {
            ...completeRaw(),
            canonical_business_id: "22222222-2222-4222-8222-222222222222",
            entity_type: "professional",
            lifecycle_state: "DISCOVERED",
          },
        ],
        rowCount: 2,
      },
    };
    const outcome = await listDirectory({ country: "ID" });
    expect(outcome.systemReady).toBe(true);
    expect(outcome.results.length).toBe(2);
    expect(outcome.results[0].listing.classification).toBe("business");
    expect(outcome.results[0].destination.kind).toBe("claim_available");
    expect(outcome.results[1].listing.classification).toBe("person");
    expect(outcome.results[1].destination.kind).toBe("claim_available");
  });

  it("filters rows whose enum values are outside the sealed sets", async () => {
    currentBehavior = {
      kind: "ok",
      result: {
        rows: [
          { ...completeRaw(), entity_type: "spaceship" },
          { ...completeRaw() },
        ],
        rowCount: 2,
      },
    };
    const outcome = await listDirectory({ country: "ID" });
    expect(outcome.results.length).toBe(1);
  });

  it("preserves input row order in the output", async () => {
    const ids = [
      "33333333-3333-4333-8333-333333333333",
      "44444444-4444-4444-8444-444444444444",
      "55555555-5555-4555-8555-555555555555",
    ];
    currentBehavior = {
      kind: "ok",
      result: {
        rows: ids.map((id) => ({
          ...completeRaw(),
          canonical_business_id: id,
          lifecycle_state: "DISCOVERED",
        })),
        rowCount: 3,
      },
    };
    const outcome = await listDirectory({ country: "ID" });
    expect(outcome.results.map((r) => r.listing.canonicalBusinessId)).toEqual(
      ids,
    );
  });
});

// ═════════════════════════════════════════════════════════════════════
// §4b · listDirectory · query shape delivered to pg driver
// ═════════════════════════════════════════════════════════════════════

describe("listDirectory · query shape delivered to pg driver", () => {
  it("sends the schema-qualified table name (nex.business_canonical)", async () => {
    await listDirectory({ country: "ID" });
    expect(lastQuery).not.toBe(null);
    expect(lastQuery!.sql).toContain("FROM nex.business_canonical");
  });

  it("binds country, lifecycle array, limit, offset as parameters (no interpolation)", async () => {
    await listDirectory({ country: "ID", limit: 50, offset: 100 });
    expect(lastQuery!.params[0]).toBe("ID");
    expect(lastQuery!.params[1]).toEqual([...SURFACED_LIFECYCLE_STATES]);
    expect(lastQuery!.params[lastQuery!.params.length - 2]).toBe(50);
    expect(lastQuery!.params[lastQuery!.params.length - 1]).toBe(100);
    expect(lastQuery!.sql).not.toContain("'ID'");
    expect(lastQuery!.sql).toMatch(/\bLIMIT\s+\$\d+\s+OFFSET\s+\$\d+/);
    const placeholders = lastQuery!.sql.match(/\$\d+/g) ?? [];
    expect(placeholders.length).toBeGreaterThanOrEqual(4);
  });

  it("adds entity_type ANY($N::text[]) when classification narrows the entity set", async () => {
    await listDirectory({ country: "ID", classification: "business" });
    expect(lastQuery!.sql).toContain("entity_type = ANY($3::text[])");
    expect(Array.isArray(lastQuery!.params[2])).toBe(true);
  });

  it("adds name_norm ILIKE $N with %q% bounding when q is non-empty", async () => {
    await listDirectory({ country: "ID", q: "warung" });
    expect(lastQuery!.sql).toContain("name_norm ILIKE");
    expect(lastQuery!.params).toContain("%warung%");
  });

  it("omits optional clauses when the corresponding input is unset", async () => {
    await listDirectory({ country: "ID" });
    expect(lastQuery!.sql).not.toContain("entity_type = ANY");
    expect(lastQuery!.sql).not.toContain("ILIKE");
  });
});

// ═════════════════════════════════════════════════════════════════════
// §5 · fetchOwnerClaimsByCanonicalId stub
// ═════════════════════════════════════════════════════════════════════

describe("fetchOwnerClaimsByCanonicalId · deferred cross-DB stub", () => {
  it("returns an empty map for any input (no fabrication)", async () => {
    const map = await fetchOwnerClaimsByCanonicalId([
      "11111111-1111-4111-8111-111111111111",
      "22222222-2222-4222-8222-222222222222",
    ]);
    expect(map.size).toBe(0);
  });

  it("returns an empty map for an empty input", async () => {
    const map = await fetchOwnerClaimsByCanonicalId([]);
    expect(map.size).toBe(0);
  });
});

// ═════════════════════════════════════════════════════════════════════
// §6 · Internal pure helpers
// ═════════════════════════════════════════════════════════════════════

describe("_internal · sealed-set guards", () => {
  it("isSealedEntityType accepts the 9 sealed values and rejects the rest", () => {
    const sealed = [
      "food",
      "accommodation",
      "service",
      "professional",
      "vehicle_rental",
      "marketplace_seller",
      "transport_driver",
      "transport_operator",
      "place",
    ];
    for (const v of sealed) {
      expect(_internal.isSealedEntityType(v)).toBe(true);
    }
    for (const bad of ["spaceship", "", "FOOD", "PLACE"]) {
      expect(_internal.isSealedEntityType(bad)).toBe(false);
    }
  });

  it("isSealedLifecycleState accepts the 7 sealed values and rejects the rest", () => {
    const sealed = [
      "DISCOVERED",
      "ENRICHED",
      "VERIFIED",
      "OWNER_CLAIMED",
      "OWNER_VERIFIED",
      "DORMANT",
      "SUPERSEDED",
    ];
    for (const v of sealed) {
      expect(_internal.isSealedLifecycleState(v)).toBe(true);
    }
    for (const bad of ["QUARANTINED", "pending", "discovered"]) {
      expect(_internal.isSealedLifecycleState(bad)).toBe(false);
    }
  });
});

// ═════════════════════════════════════════════════════════════════════
// §7 · Deterministic composition
// ═════════════════════════════════════════════════════════════════════

describe("listDirectory · determinism", () => {
  it("same mocked DB response yields byte-stable results across invocations", async () => {
    currentBehavior = {
      kind: "ok",
      result: { rows: [completeRaw()], rowCount: 1 },
    };
    const a = await listDirectory({ country: "ID" });
    const b = await listDirectory({ country: "ID" });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});

// ═════════════════════════════════════════════════════════════════════
// §8 · _internal.buildCanonicalSql · pure parameterised builder
// ═════════════════════════════════════════════════════════════════════

describe("_internal.buildCanonicalSql · pure builder", () => {
  it("minimum inputs produce 4 params + schema-qualified SELECT", () => {
    const { sql, params } = _internal.buildCanonicalSql({
      country: "ID",
      q: null,
      entityTypes: null,
      limit: 24,
      offset: 0,
    });
    expect(params.length).toBe(4);
    expect(params[0]).toBe("ID");
    expect(params[1]).toEqual([...SURFACED_LIFECYCLE_STATES]);
    expect(params[2]).toBe(24);
    expect(params[3]).toBe(0);
    expect(sql).toContain("FROM nex.business_canonical");
    expect(sql).toContain("country = $1");
    expect(sql).toContain("lifecycle_state = ANY($2::text[])");
    expect(sql).toContain("LIMIT $3 OFFSET $4");
    expect(sql).not.toContain("entity_type = ANY");
    expect(sql).not.toContain("ILIKE");
  });

  it("entityTypes supplied adds entity_type = ANY($3::text[]) and shifts limit/offset", () => {
    const { sql, params } = _internal.buildCanonicalSql({
      country: "ID",
      q: null,
      entityTypes: ["food", "accommodation"],
      limit: 24,
      offset: 0,
    });
    expect(params.length).toBe(5);
    expect(params[2]).toEqual(["food", "accommodation"]);
    expect(sql).toContain("entity_type = ANY($3::text[])");
    expect(sql).toContain("LIMIT $4 OFFSET $5");
  });

  it("empty entityTypes array is treated as no filter", () => {
    const { sql, params } = _internal.buildCanonicalSql({
      country: "ID",
      q: null,
      entityTypes: [],
      limit: 24,
      offset: 0,
    });
    expect(params.length).toBe(4);
    expect(sql).not.toContain("entity_type = ANY");
  });

  it("q supplied adds name_norm ILIKE $N with %q% bounding", () => {
    const { sql, params } = _internal.buildCanonicalSql({
      country: "ID",
      q: "warung",
      entityTypes: null,
      limit: 24,
      offset: 0,
    });
    expect(params.length).toBe(5);
    expect(params[2]).toBe("%warung%");
    expect(sql).toContain("name_norm ILIKE $3");
    expect(sql).toContain("LIMIT $4 OFFSET $5");
  });

  it("both entityTypes and q produce 6 params in strict left-to-right order", () => {
    const { sql, params } = _internal.buildCanonicalSql({
      country: "ID",
      q: "siti",
      entityTypes: ["food"],
      limit: 10,
      offset: 20,
    });
    expect(params.length).toBe(6);
    expect(params[0]).toBe("ID");
    expect(params[1]).toEqual([...SURFACED_LIFECYCLE_STATES]);
    expect(params[2]).toEqual(["food"]);
    expect(params[3]).toBe("%siti%");
    expect(params[4]).toBe(10);
    expect(params[5]).toBe(20);
    expect(sql).toContain("entity_type = ANY($3::text[])");
    expect(sql).toContain("name_norm ILIKE $4");
    expect(sql).toContain("LIMIT $5 OFFSET $6");
  });

  it("SELECT_COLUMNS appear verbatim in the SQL", () => {
    const { sql } = _internal.buildCanonicalSql({
      country: "ID",
      q: null,
      entityTypes: null,
      limit: 24,
      offset: 0,
    });
    expect(sql).toContain("canonical_business_id");
    expect(sql).toContain("entity_type");
    expect(sql).toContain("name_canonical");
    expect(sql).toContain("last_verified_at");
  });

  it("user search text is never string-interpolated into SQL (injection guard)", () => {
    const { sql, params } = _internal.buildCanonicalSql({
      country: "ID",
      q: "'; DROP TABLE users; --",
      entityTypes: null,
      limit: 24,
      offset: 0,
    });
    expect(sql).not.toContain("DROP TABLE");
    expect(sql).not.toContain("'; DROP");
    // The payload is bound as a param, bracketed by % (ILIKE pattern).
    expect(params).toContain("%'; DROP TABLE users; --%");
  });

  it("country value is never string-interpolated into SQL (injection guard)", () => {
    const { sql, params } = _internal.buildCanonicalSql({
      country: "' OR 1=1 --",
      q: null,
      entityTypes: null,
      limit: 24,
      offset: 0,
    });
    expect(sql).not.toContain("OR 1=1");
    expect(params[0]).toBe("' OR 1=1 --");
  });

  it("limit / offset are bound as parameters, never interpolated", () => {
    const { sql, params } = _internal.buildCanonicalSql({
      country: "ID",
      q: null,
      entityTypes: null,
      limit: 999,
      offset: 7777,
    });
    expect(sql).not.toContain("999");
    expect(sql).not.toContain("7777");
    expect(params).toContain(999);
    expect(params).toContain(7777);
  });

  it("is pure / deterministic across invocations", () => {
    const a = _internal.buildCanonicalSql({
      country: "ID",
      q: "warung",
      entityTypes: ["food"],
      limit: 10,
      offset: 0,
    });
    const b = _internal.buildCanonicalSql({
      country: "ID",
      q: "warung",
      entityTypes: ["food"],
      limit: 10,
      offset: 0,
    });
    expect(a.sql).toBe(b.sql);
    expect(a.params).toEqual(b.params);
  });
});

// ═════════════════════════════════════════════════════════════════════
// §9 · _internal.sanitiseError · credential redaction
// ═════════════════════════════════════════════════════════════════════

describe("_internal.sanitiseError · credential redaction", () => {
  it("redacts a postgres URL with embedded credentials", () => {
    const out = _internal.sanitiseError(
      "boom: postgres://nex:topsecret@db.example.com:5432/nex failed",
    );
    expect(out).toContain("[redacted]");
    expect(out).not.toContain("topsecret");
  });

  it("redacts password= fragments (quoted and bare)", () => {
    const out1 = _internal.sanitiseError('conn: password="hunter2" rejected');
    expect(out1).not.toContain("hunter2");
    const out2 = _internal.sanitiseError("conn: password=hunter2 rejected");
    expect(out2).not.toContain("hunter2");
  });

  it("passes through innocuous text unchanged", () => {
    const msg = "relation does not exist";
    expect(_internal.sanitiseError(msg)).toBe(msg);
  });
});

// ═════════════════════════════════════════════════════════════════════
// §10 · Architectural read-path lock (static grep against directory-service.ts)
// ═════════════════════════════════════════════════════════════════════

describe("directory-service.ts · architectural read path (static grep)", () => {
  const SERVICE_PATH = resolve(__dirname, "..", "directory-service.ts");

  function stripComments(src: string): string {
    // Strip line comments FIRST (so a `/*` appearing inside a `//` line
    // does not get mistaken for the start of a block comment), then
    // strip block comments.
    const noLine = src
      .split("\n")
      .map((l) => l.replace(/\/\/.*$/, ""))
      .join("\n");
    return noLine.replace(/\/\*[\s\S]*?\*\//g, "");
  }

  function sourceOutsideComments(): string {
    return stripComments(readFileSync(SERVICE_PATH, "utf8"));
  }

  it("imports withClient from @/lib/nex/db", () => {
    const src = sourceOutsideComments();
    expect(src).toMatch(
      /import\s*\{\s*withClient[^}]*\}\s*from\s*["']@\/lib\/nex\/db["']/,
    );
  });

  it("does not import nexSupabaseAdmin (code, not comments)", () => {
    const src = sourceOutsideComments();
    expect(src).not.toContain("nexSupabaseAdmin");
  });

  it("does not call .schema('nex') or .schema(\"nex\")", () => {
    const src = sourceOutsideComments();
    expect(src).not.toMatch(/\.schema\s*\(\s*['"]nex['"]\s*\)/);
  });

  it("does not import the pg package directly", () => {
    const src = sourceOutsideComments();
    expect(src).not.toMatch(/from\s*["']pg["']/);
  });

  it("does not import from scripts/", () => {
    const src = sourceOutsideComments();
    expect(src).not.toMatch(/from\s*["'][^"']*scripts\//);
  });

  it("references nex.business_canonical as a schema-qualified table", () => {
    const src = sourceOutsideComments();
    expect(src).toContain("nex.business_canonical");
  });

  it("contains no literal connection string, host, or port", () => {
    const src = sourceOutsideComments();
    expect(src).not.toMatch(/postgres(?:ql)?:\/\//);
    expect(src).not.toMatch(/\blocalhost\b/);
    expect(src).not.toMatch(/\b127\.0\.0\.1\b/);
    expect(src).not.toMatch(/:\s*5432\b/);
    expect(src).not.toMatch(/:\s*5433\b/);
  });

  it("does not read process.env.NEX_POSTGRES_URL directly (must route through withClient / shared config)", () => {
    const src = sourceOutsideComments();
    expect(src).not.toContain("process.env.NEX_POSTGRES_URL");
  });
});
