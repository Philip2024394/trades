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
  | {
      kind: "ok_split";
      canonical: MockQueryResult;
      evidence: MockQueryResult;
    }
  | { kind: "throws"; error: Error }
  | { kind: "null" };

let currentBehavior: MockBehavior = {
  kind: "ok",
  result: { rows: [], rowCount: 0 },
};

let lastQuery: { sql: string; params: readonly unknown[] } | null = null;
let queryLog: Array<{ sql: string; params: readonly unknown[] }> = [];

vi.mock("@/lib/nex/db", () => ({
  withClient: async <T>(
    fn: (c: {
      query: (sql: string, params?: unknown[]) => Promise<MockQueryResult>;
    }) => Promise<T>,
  ): Promise<T | null> => {
    if (currentBehavior.kind === "null") return null;
    const client = {
      query: async (sql: string, params?: unknown[]) => {
        const entry = { sql, params: params ?? [] };
        lastQuery = entry;
        queryLog.push(entry);
        if (currentBehavior.kind === "throws") throw currentBehavior.error;
        if (currentBehavior.kind === "ok_split") {
          if (sql.includes("FROM nex.business_evidence")) {
            return currentBehavior.evidence;
          }
          return currentBehavior.canonical;
        }
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
  DIRECTORY_PUBLICATION_VIEW,
  SELECT_COLUMNS,
  _internal,
  adaptRawCanonicalRow,
  fetchOwnerClaimsByCanonicalId,
  getCanonicalBusinessById,
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

  it("DIRECTORY_PUBLICATION_VIEW is 'business_directory_v' (the sealed publication gate · migration 175)", () => {
    // DP-1 + DP-2 · lifecycle filtering + source-permission filtering
    // live inside the view, not in TypeScript. The service only names
    // the view · it never carries a parallel TypeScript predicate.
    expect(DIRECTORY_PUBLICATION_VIEW).toBe("business_directory_v");
  });

  it("SELECT_COLUMNS lists the sealed read columns and projects coordinates via ST_Y / ST_X", () => {
    expect(SELECT_COLUMNS).toContain("canonical_business_id");
    expect(SELECT_COLUMNS).toContain("entity_type");
    expect(SELECT_COLUMNS).toContain("country");
    expect(SELECT_COLUMNS).toContain("lifecycle_state");
    expect(SELECT_COLUMNS).toContain("name_canonical");
    expect(SELECT_COLUMNS).toContain("name_norm");
    expect(SELECT_COLUMNS).toContain("last_verified_at");
    // Coordinates are projected via PostGIS accessors · ST_Y is latitude
    // (geometry Y axis), ST_X is longitude (geometry X axis). The raw
    // `coordinates` column name must NOT appear outside those accessors.
    expect(SELECT_COLUMNS).toContain(
      "ST_Y(coordinates::geometry) AS coordinates_lat",
    );
    expect(SELECT_COLUMNS).toContain(
      "ST_X(coordinates::geometry) AS coordinates_lng",
    );
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
    // ST_Y / ST_X values come back from pg as string or number
    // depending on driver type-parser config. Tests exercise both.
    coordinates_lat: -7.797068,
    coordinates_lng: 110.370529,
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

  it("coordinates is populated via ST_Y / ST_X when both halves are present", () => {
    const row = adaptRawCanonicalRow(completeRaw());
    expect(row!.coordinates).toEqual({ lat: -7.797068, lng: 110.370529 });
  });

  it("coordinates handles pg's string numeric return (driver returns numeric as string)", () => {
    const raw = {
      ...completeRaw(),
      coordinates_lat: "-7.797068",
      coordinates_lng: "110.370529",
    };
    const row = adaptRawCanonicalRow(raw);
    expect(row!.coordinates).toEqual({ lat: -7.797068, lng: 110.370529 });
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
// §2b · adaptRawCanonicalRow · coordinate pair handling
// ═════════════════════════════════════════════════════════════════════

describe("adaptRawCanonicalRow · coordinate parsing", () => {
  it("yields null when both halves are null (no PostGIS point)", () => {
    const raw = {
      ...completeRaw(),
      coordinates_lat: null,
      coordinates_lng: null,
    };
    const row = adaptRawCanonicalRow(raw);
    expect(row!.coordinates).toBe(null);
  });

  it("yields null when only lat is null (never a partial coordinate)", () => {
    const raw = { ...completeRaw(), coordinates_lat: null };
    const row = adaptRawCanonicalRow(raw);
    expect(row!.coordinates).toBe(null);
  });

  it("yields null when only lng is null (never a partial coordinate)", () => {
    const raw = { ...completeRaw(), coordinates_lng: null };
    const row = adaptRawCanonicalRow(raw);
    expect(row!.coordinates).toBe(null);
  });

  it("yields null when lat is out of WGS84 range (-90..90)", () => {
    const raw = { ...completeRaw(), coordinates_lat: 95 };
    const row = adaptRawCanonicalRow(raw);
    expect(row!.coordinates).toBe(null);
  });

  it("yields null when lng is out of WGS84 range (-180..180)", () => {
    const raw = { ...completeRaw(), coordinates_lng: 200 };
    const row = adaptRawCanonicalRow(raw);
    expect(row!.coordinates).toBe(null);
  });

  it("yields null when either half is a non-numeric string", () => {
    const raw1 = { ...completeRaw(), coordinates_lat: "not-a-number" };
    expect(adaptRawCanonicalRow(raw1)!.coordinates).toBe(null);
    const raw2 = { ...completeRaw(), coordinates_lng: "NaN" };
    expect(adaptRawCanonicalRow(raw2)!.coordinates).toBe(null);
  });

  it("accepts WGS84 boundary values (±90 lat, ±180 lng)", () => {
    const north = adaptRawCanonicalRow({
      ...completeRaw(),
      coordinates_lat: 90,
      coordinates_lng: 180,
    });
    expect(north!.coordinates).toEqual({ lat: 90, lng: 180 });
    const south = adaptRawCanonicalRow({
      ...completeRaw(),
      coordinates_lat: -90,
      coordinates_lng: -180,
    });
    expect(south!.coordinates).toEqual({ lat: -90, lng: -180 });
  });
});

describe("_internal.parseCoord · pure parser", () => {
  it("returns null for null / undefined / empty", () => {
    expect(_internal.parseCoord(null, -90, 90)).toBe(null);
    expect(_internal.parseCoord(undefined as unknown as null, -90, 90)).toBe(null);
  });

  it("parses numeric and string forms identically", () => {
    expect(_internal.parseCoord(-7.797068, -90, 90)).toBe(-7.797068);
    expect(_internal.parseCoord("-7.797068", -90, 90)).toBe(-7.797068);
  });

  it("rejects out-of-range values honestly (no clamp)", () => {
    expect(_internal.parseCoord(91, -90, 90)).toBe(null);
    expect(_internal.parseCoord(-91, -90, 90)).toBe(null);
    expect(_internal.parseCoord(181, -180, 180)).toBe(null);
    expect(_internal.parseCoord(-181, -180, 180)).toBe(null);
  });

  it("rejects NaN, Infinity, malformed strings", () => {
    expect(_internal.parseCoord(Number.NaN, -90, 90)).toBe(null);
    expect(_internal.parseCoord(Number.POSITIVE_INFINITY, -90, 90)).toBe(null);
    expect(_internal.parseCoord("hello", -90, 90)).toBe(null);
    expect(_internal.parseCoord("", -90, 90)).toBe(null);
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
  queryLog = [];
});

afterEach(() => {
  currentBehavior = { kind: "ok", result: { rows: [], rowCount: 0 } };
  lastQuery = null;
  queryLog = [];
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
  it("sends the schema-qualified publication view (nex.business_directory_v)", async () => {
    await listDirectory({ country: "ID" });
    expect(lastQuery).not.toBe(null);
    expect(lastQuery!.sql).toContain("FROM nex.business_directory_v");
  });

  it("does NOT read directly from nex.business_canonical for visitor rendering", async () => {
    // The whole point of DP-1 + DP-2 · if this ever becomes false,
    // the publication gate has been bypassed somewhere upstream.
    await listDirectory({ country: "ID" });
    expect(lastQuery!.sql).not.toContain("FROM nex.business_canonical");
  });

  it("does NOT carry a parallel TypeScript lifecycle filter (view enforces it)", async () => {
    await listDirectory({ country: "ID" });
    expect(lastQuery!.sql).not.toContain("lifecycle_state = ANY");
    expect(lastQuery!.sql).not.toMatch(/\blifecycle_state\s+IN\s*\(/i);
  });

  it("binds country, (optional filters), limit, offset as parameters · no interpolation", async () => {
    await listDirectory({ country: "ID", limit: 50, offset: 100 });
    expect(lastQuery!.params[0]).toBe("ID");
    // After DP-2 · params[1..n-2] carry only visitor-chosen filters
    // (entity_type / q) which are both unset here. Only country,
    // limit, offset remain.
    expect(lastQuery!.params.length).toBe(3);
    expect(lastQuery!.params[1]).toBe(50);
    expect(lastQuery!.params[2]).toBe(100);
    expect(lastQuery!.sql).not.toContain("'ID'");
    expect(lastQuery!.sql).toMatch(/\bLIMIT\s+\$\d+\s+OFFSET\s+\$\d+/);
  });

  it("adds entity_type ANY($N::text[]) when classification narrows the entity set", async () => {
    await listDirectory({ country: "ID", classification: "business" });
    expect(lastQuery!.sql).toContain("entity_type = ANY($2::text[])");
    expect(Array.isArray(lastQuery!.params[1])).toBe(true);
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
  it("minimum inputs produce 3 params + SELECT FROM the publication view", () => {
    const { sql, params } = _internal.buildCanonicalSql({
      country: "ID",
      q: null,
      entityTypes: null,
      limit: 24,
      offset: 0,
    });
    expect(params.length).toBe(3);
    expect(params[0]).toBe("ID");
    expect(params[1]).toBe(24);
    expect(params[2]).toBe(0);
    expect(sql).toContain("FROM nex.business_directory_v");
    expect(sql).not.toContain("FROM nex.business_canonical");
    expect(sql).toContain("country = $1");
    expect(sql).not.toContain("lifecycle_state = ANY");
    expect(sql).toContain("LIMIT $2 OFFSET $3");
    expect(sql).not.toContain("entity_type = ANY");
    expect(sql).not.toContain("ILIKE");
  });

  it("entityTypes supplied adds entity_type = ANY($2::text[]) and shifts limit/offset", () => {
    const { sql, params } = _internal.buildCanonicalSql({
      country: "ID",
      q: null,
      entityTypes: ["food", "accommodation"],
      limit: 24,
      offset: 0,
    });
    expect(params.length).toBe(4);
    expect(params[1]).toEqual(["food", "accommodation"]);
    expect(sql).toContain("entity_type = ANY($2::text[])");
    expect(sql).toContain("LIMIT $3 OFFSET $4");
  });

  it("empty entityTypes array is treated as no filter", () => {
    const { sql, params } = _internal.buildCanonicalSql({
      country: "ID",
      q: null,
      entityTypes: [],
      limit: 24,
      offset: 0,
    });
    expect(params.length).toBe(3);
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
    expect(params.length).toBe(4);
    expect(params[1]).toBe("%warung%");
    expect(sql).toContain("name_norm ILIKE $2");
    expect(sql).toContain("LIMIT $3 OFFSET $4");
  });

  it("both entityTypes and q produce 5 params in strict left-to-right order", () => {
    const { sql, params } = _internal.buildCanonicalSql({
      country: "ID",
      q: "siti",
      entityTypes: ["food"],
      limit: 10,
      offset: 20,
    });
    expect(params.length).toBe(5);
    expect(params[0]).toBe("ID");
    expect(params[1]).toEqual(["food"]);
    expect(params[2]).toBe("%siti%");
    expect(params[3]).toBe(10);
    expect(params[4]).toBe(20);
    expect(sql).toContain("entity_type = ANY($2::text[])");
    expect(sql).toContain("name_norm ILIKE $3");
    expect(sql).toContain("LIMIT $4 OFFSET $5");
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
// §9b · _internal.isUuidShape · fast 404 guard
// ═════════════════════════════════════════════════════════════════════

describe("_internal.isUuidShape · pure UUID shape guard", () => {
  it("accepts canonical lowercase UUID", () => {
    expect(
      _internal.isUuidShape("452568d4-3dab-4064-a0fa-2b9297f2ae3b"),
    ).toBe(true);
  });

  it("accepts uppercase hex", () => {
    expect(
      _internal.isUuidShape("452568D4-3DAB-4064-A0FA-2B9297F2AE3B"),
    ).toBe(true);
  });

  it("rejects empty string, short strings, and garbage", () => {
    expect(_internal.isUuidShape("")).toBe(false);
    expect(_internal.isUuidShape("not-a-uuid")).toBe(false);
    expect(_internal.isUuidShape("452568d4-3dab-4064-a0fa")).toBe(false);
    expect(_internal.isUuidShape("452568d4-3dab-4064-a0fa-2b9297f2ae3bXX")).toBe(
      false,
    );
  });

  it("rejects injection-shaped payloads (defensive)", () => {
    expect(_internal.isUuidShape("'; DROP TABLE users; --")).toBe(false);
    expect(_internal.isUuidShape("../../../etc/passwd")).toBe(false);
    expect(_internal.isUuidShape("1 OR 1=1")).toBe(false);
  });
});

// ═════════════════════════════════════════════════════════════════════
// §9c · getCanonicalBusinessById · single-row detail read
// ═════════════════════════════════════════════════════════════════════

const SAMPLE_UUID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

describe("getCanonicalBusinessById · malformed id", () => {
  it("returns result=null, systemReady=true, without opening a DB session", async () => {
    currentBehavior = {
      kind: "throws",
      error: new Error("mock should not be called for malformed id"),
    };
    const outcome = await getCanonicalBusinessById("not-a-uuid");
    expect(outcome.systemReady).toBe(true);
    expect(outcome.result).toBe(null);
    expect(outcome.diagnostic).toBe(null);
    expect(lastQuery).toBe(null); // no DB call made
  });

  it("returns result=null for empty id", async () => {
    currentBehavior = {
      kind: "throws",
      error: new Error("should not be called"),
    };
    const outcome = await getCanonicalBusinessById("");
    expect(outcome.result).toBe(null);
    expect(lastQuery).toBe(null);
  });
});

describe("getCanonicalBusinessById · row missing", () => {
  it("returns result=null, systemReady=true when the canonical row is not found", async () => {
    currentBehavior = {
      kind: "ok_split",
      canonical: { rows: [], rowCount: 0 },
      evidence: { rows: [], rowCount: 0 },
    };
    const outcome = await getCanonicalBusinessById(SAMPLE_UUID);
    expect(outcome.systemReady).toBe(true);
    expect(outcome.result).toBe(null);
    expect(outcome.diagnostic).toBe(null);
  });

  it("only queries canonical table when row is missing (does not probe evidence)", async () => {
    currentBehavior = {
      kind: "ok_split",
      canonical: { rows: [], rowCount: 0 },
      evidence: { rows: [], rowCount: 0 },
    };
    await getCanonicalBusinessById(SAMPLE_UUID);
    expect(queryLog.length).toBe(1);
    expect(queryLog[0].sql).toContain("FROM nex.business_directory_v");
  });
});

describe("getCanonicalBusinessById · row present", () => {
  it("returns listing + destination + hasEvidence=true when both rows exist", async () => {
    currentBehavior = {
      kind: "ok_split",
      canonical: {
        rows: [{ ...completeRaw(), canonical_business_id: SAMPLE_UUID }],
        rowCount: 1,
      },
      evidence: { rows: [{ present: 1 }], rowCount: 1 },
    };
    const outcome = await getCanonicalBusinessById(SAMPLE_UUID);
    expect(outcome.systemReady).toBe(true);
    expect(outcome.result).not.toBe(null);
    expect(outcome.result!.listing.canonicalBusinessId).toBe(SAMPLE_UUID);
    expect(outcome.result!.hasEvidence).toBe(true);
    expect(outcome.result!.destination).toBeDefined();
  });

  it("returns hasEvidence=false when evidence row is absent", async () => {
    currentBehavior = {
      kind: "ok_split",
      canonical: {
        rows: [{ ...completeRaw(), canonical_business_id: SAMPLE_UUID }],
        rowCount: 1,
      },
      evidence: { rows: [], rowCount: 0 },
    };
    const outcome = await getCanonicalBusinessById(SAMPLE_UUID);
    expect(outcome.result).not.toBe(null);
    expect(outcome.result!.hasEvidence).toBe(false);
  });

  it("queries canonical first, then evidence (strict order)", async () => {
    currentBehavior = {
      kind: "ok_split",
      canonical: {
        rows: [{ ...completeRaw(), canonical_business_id: SAMPLE_UUID }],
        rowCount: 1,
      },
      evidence: { rows: [], rowCount: 0 },
    };
    await getCanonicalBusinessById(SAMPLE_UUID);
    expect(queryLog.length).toBe(2);
    expect(queryLog[0].sql).toContain("FROM nex.business_directory_v");
    expect(queryLog[0].sql).toContain("WHERE canonical_business_id = $1");
    expect(queryLog[0].params[0]).toBe(SAMPLE_UUID);
    expect(queryLog[1].sql).toContain("FROM nex.business_evidence");
    expect(queryLog[1].sql).toContain("WHERE canonical_business_id = $1");
    expect(queryLog[1].params[0]).toBe(SAMPLE_UUID);
  });

  it("reuses the sealed SELECT_COLUMNS for the canonical query", async () => {
    currentBehavior = {
      kind: "ok_split",
      canonical: {
        rows: [{ ...completeRaw(), canonical_business_id: SAMPLE_UUID }],
        rowCount: 1,
      },
      evidence: { rows: [], rowCount: 0 },
    };
    await getCanonicalBusinessById(SAMPLE_UUID);
    expect(queryLog[0].sql).toContain(SELECT_COLUMNS);
  });

  it("drops rows with unsealed enum values (defensive)", async () => {
    currentBehavior = {
      kind: "ok_split",
      canonical: {
        rows: [
          {
            ...completeRaw(),
            canonical_business_id: SAMPLE_UUID,
            entity_type: "spaceship",
          },
        ],
        rowCount: 1,
      },
      evidence: { rows: [{ present: 1 }], rowCount: 1 },
    };
    const outcome = await getCanonicalBusinessById(SAMPLE_UUID);
    expect(outcome.result).toBe(null);
  });
});

describe("getCanonicalBusinessById · unavailable DB", () => {
  it("returns systemReady=false when withClient returns null (URL unset)", async () => {
    currentBehavior = { kind: "null" };
    const outcome = await getCanonicalBusinessById(SAMPLE_UUID);
    expect(outcome.systemReady).toBe(false);
    expect(outcome.result).toBe(null);
    expect(outcome.diagnostic!).toContain("NEX_POSTGRES_URL");
  });

  it("returns systemReady=false when the pg client throws", async () => {
    currentBehavior = {
      kind: "throws",
      error: new Error('relation "nex.business_canonical" does not exist'),
    };
    const outcome = await getCanonicalBusinessById(SAMPLE_UUID);
    expect(outcome.systemReady).toBe(false);
    expect(outcome.result).toBe(null);
    expect(outcome.diagnostic!).toContain("relation");
  });

  it("redacts credentials in the diagnostic", async () => {
    currentBehavior = {
      kind: "throws",
      error: new Error(
        "boom · postgres://u:secretpass@db.example.com:5432/x",
      ),
    };
    const outcome = await getCanonicalBusinessById(SAMPLE_UUID);
    expect(outcome.diagnostic!).toContain("[redacted]");
    expect(outcome.diagnostic!).not.toContain("secretpass");
  });

  it("never fabricates a result on failure", async () => {
    currentBehavior = {
      kind: "throws",
      error: new Error("any failure"),
    };
    const outcome = await getCanonicalBusinessById(SAMPLE_UUID);
    expect(outcome.result).toBe(null);
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

  it("references nex.business_directory_v as the schema-qualified publication view used by visitor reads", () => {
    const src = sourceOutsideComments();
    expect(src).toContain("business_directory_v");
    // The sealed service composes its FROM via `nex.${DIRECTORY_PUBLICATION_VIEW}`,
    // so the resulting runtime SQL still contains `nex.business_directory_v`.
    // Static grep accepts either the composed form or a literal match.
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
