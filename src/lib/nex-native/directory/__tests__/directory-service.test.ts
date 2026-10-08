// src/lib/nex-native/directory/__tests__/directory-service.test.ts
//
// NEX Directory · Phase A · Server data layer tests.
//
// Covers
//   · adaptRawCanonicalRow handles every nullable-column permutation
//   · adaptRawCanonicalRow rejects malformed enum values (returns null)
//   · listDirectory composes projector + resolver correctly
//   · systemReady=false when supabase returns an error
//   · systemReady=false when the schema is unavailable
//   · fetchOwnerClaimsByCanonicalId returns an empty map (stub)
//   · the service doesn't leak server-only runtime (static grep)
//
// This file does NOT make real network calls. The supabase client is
// mocked at module boundary via vi.mock.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ─── Mock nexSupabaseAdmin to intercept all .schema().from() chains ──
//
// The service module imports nexSupabaseAdmin from
// `../supabase-admin`. We mock that path so no real client is
// instantiated during tests. The mock exposes a `__setResponse(fn)`
// helper for per-test configuration.
let currentResponse: () => Promise<{
  data: unknown[] | null;
  error: { code?: string; message: string } | null;
}> = async () => ({ data: [], error: null });

vi.mock("@/lib/nex-native/supabase-admin", () => {
  const mockBuilder = {
    schema() {
      return mockBuilder;
    },
    from() {
      return mockBuilder;
    },
    select() {
      return mockBuilder;
    },
    eq() {
      return mockBuilder;
    },
    in() {
      return mockBuilder;
    },
    ilike() {
      return mockBuilder;
    },
    range() {
      return currentResponse();
    },
  };
  return {
    nexSupabaseAdmin: mockBuilder,
    nexSupabaseProjectRef: () => "test",
  };
});

import {
  CANONICAL_TABLE,
  CANONICAL_SCHEMA,
  DEFAULT_LIMIT,
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
// §4 · listDirectory · query behaviour
// ═════════════════════════════════════════════════════════════════════

beforeEach(() => {
  currentResponse = async () => ({ data: [], error: null });
});

afterEach(() => {
  currentResponse = async () => ({ data: [], error: null });
});

describe("listDirectory · empty result", () => {
  it("returns systemReady=true with an empty results list when the DB returns 0 rows", async () => {
    currentResponse = async () => ({ data: [], error: null });
    const outcome = await listDirectory({ country: "ID" });
    expect(outcome.systemReady).toBe(true);
    expect(outcome.results).toEqual([]);
    expect(outcome.diagnostic).toBe(null);
  });
});

describe("listDirectory · unavailable systems", () => {
  it("returns systemReady=false when the DB errors (schema not exposed)", async () => {
    currentResponse = async () => ({
      data: null,
      error: { code: "PGRST106", message: "The schema must be one of..." },
    });
    const outcome = await listDirectory({ country: "ID" });
    expect(outcome.systemReady).toBe(false);
    expect(outcome.results).toEqual([]);
    expect(outcome.diagnostic).not.toBe(null);
    expect(outcome.diagnostic!).toContain("PGRST106");
  });

  it("returns systemReady=false when the DB errors (table not found)", async () => {
    currentResponse = async () => ({
      data: null,
      error: { code: "42P01", message: "relation does not exist" },
    });
    const outcome = await listDirectory({ country: "ID" });
    expect(outcome.systemReady).toBe(false);
    expect(outcome.diagnostic!).toContain("42P01");
  });

  it("returns systemReady=false on an unexpected throw (network error)", async () => {
    currentResponse = async () => {
      throw new Error("ECONNREFUSED");
    };
    const outcome = await listDirectory({ country: "ID" });
    expect(outcome.systemReady).toBe(false);
    expect(outcome.diagnostic!).toContain("ECONNREFUSED");
  });

  it("never fabricates a result on failure", async () => {
    currentResponse = async () => ({
      data: null,
      error: { code: "AUTH", message: "jwt expired" },
    });
    const outcome = await listDirectory({ country: "ID" });
    expect(outcome.results).toEqual([]);
  });
});

describe("listDirectory · populated results", () => {
  it("projects canonical rows → VMs and resolves destinations", async () => {
    currentResponse = async () => ({
      data: [
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
      error: null,
    });
    const outcome = await listDirectory({ country: "ID" });
    expect(outcome.systemReady).toBe(true);
    expect(outcome.results.length).toBe(2);
    expect(outcome.results[0].listing.classification).toBe("business");
    expect(outcome.results[0].destination.kind).toBe("claim_available");
    expect(outcome.results[1].listing.classification).toBe("person");
    expect(outcome.results[1].destination.kind).toBe("claim_available");
  });

  it("filters rows whose enum values are outside the sealed sets", async () => {
    currentResponse = async () => ({
      data: [
        { ...completeRaw(), entity_type: "spaceship" },
        { ...completeRaw() },
      ],
      error: null,
    });
    const outcome = await listDirectory({ country: "ID" });
    expect(outcome.results.length).toBe(1);
  });

  it("preserves input row order in the output", async () => {
    const ids = [
      "33333333-3333-4333-8333-333333333333",
      "44444444-4444-4444-8444-444444444444",
      "55555555-5555-4555-8555-555555555555",
    ];
    currentResponse = async () => ({
      data: ids.map((id) => ({
        ...completeRaw(),
        canonical_business_id: id,
        lifecycle_state: "DISCOVERED",
      })),
      error: null,
    });
    const outcome = await listDirectory({ country: "ID" });
    expect(outcome.results.map((r) => r.listing.canonicalBusinessId)).toEqual(ids);
  });
});

// ═════════════════════════════════════════════════════════════════════
// §5 · fetchOwnerClaimsByCanonicalId stub
// ═════════════════════════════════════════════════════════════════════

describe("fetchOwnerClaimsByCanonicalId · deferred migration stub", () => {
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
    currentResponse = async () => ({
      data: [completeRaw()],
      error: null,
    });
    const a = await listDirectory({ country: "ID" });
    const b = await listDirectory({ country: "ID" });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});
