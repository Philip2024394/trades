// scripts/nex-canonical/source-legacy-service-business.test.ts
//
// Deterministic unit tests for the sealed service_business adapter.
// Pure · no DB · no network. Uses an in-memory fake ReadSession to
// prove projection semantics, country-inference strategy, keyset
// pagination, deterministic external_ref, no-fabrication guards,
// and transient-error classification.

import { describe, expect, test } from "vitest";
import type { ReadSession, ReadSessionFactory } from "./pg-read-adapter";
import type { DiscoverBatchResult } from "./directory-source";
import {
  LEGACY_SERVICE_COUNTRY,
  LEGACY_SERVICE_ENTITY_TYPE,
  LEGACY_SERVICE_SOURCE_ID,
  createLegacyServiceBusinessSource,
  projectServiceBusinessRow,
} from "./source-legacy-service-business";

// ═════════════════════════════════════════════════════════════════════
// §0 · Fixtures + fakes
// ═════════════════════════════════════════════════════════════════════

const FIXED_NOW = "2026-10-09T00:00:00.000Z";
const RUN_ID = "run-service-adapter-test";

function makeConfig() {
  return {
    batchSize: 2,
    generationRunId: RUN_ID,
    nowIso: () => FIXED_NOW,
  };
}

function makeRow(partial: Partial<Record<string, unknown>> = {}) {
  return {
    internal_id: "11111111-1111-1111-1111-111111111111",
    public_listing_ref: "#SB-2026-ABCDE",
    business_name: "Pharmacy Satu",
    category_slug: "pharmacies",
    address: "Jl. Example 1",
    city: "Jakarta",
    district: null,
    coordinates_lng: "106.8456",
    coordinates_lat: "-6.2088",
    phone: "+6281234567890",
    website: "https://example.co.id",
    source: "osm_overpass",
    source_reference: "node/999",
    ...partial,
  } as unknown as Parameters<typeof projectServiceBusinessRow>[0];
}

/** In-memory ReadSession · records SQL/params and returns pre-staged
 *  row batches, in order, as the adapter calls query(). */
function makeFakeFactory(
  batches: ReadonlyArray<readonly Record<string, unknown>[]>,
) {
  const calls: Array<{ sql: string; params: readonly unknown[] }> = [];
  let openSessions = 0;
  let closeSessions = 0;
  let batchIdx = 0;
  const session: ReadSession = {
    id: "fake-session",
    query: async (sql, params) => {
      calls.push({ sql, params });
      const rows = batches[batchIdx] ?? [];
      batchIdx++;
      return {
        rows: rows as unknown as readonly Record<string, unknown>[],
        rowCount: rows.length,
      };
    },
  };
  const factory: ReadSessionFactory = {
    openSession: async () => {
      openSessions++;
      return session;
    },
    closeSession: async () => {
      closeSessions++;
    },
  };
  return {
    factory,
    calls,
    counters: () => ({ openSessions, closeSessions }),
  };
}

// ═════════════════════════════════════════════════════════════════════
// §1 · Sealed literals · drift-detector against the registry migration
// ═════════════════════════════════════════════════════════════════════

describe("sealed literals", () => {
  test("source_id matches migration 186 seed", () => {
    expect(LEGACY_SERVICE_SOURCE_ID).toBe("nex_service_business_legacy");
  });

  test("country is the sealed Indonesia-first spine convention", () => {
    expect(LEGACY_SERVICE_COUNTRY).toBe("ID");
  });

  test("entity_type is the sealed 'service' bucket (migration 167 enum)", () => {
    expect(LEGACY_SERVICE_ENTITY_TYPE).toBe("service");
  });
});

// ═════════════════════════════════════════════════════════════════════
// §2 · Country-inference strategy · hardcoded 'ID'
// ═════════════════════════════════════════════════════════════════════

describe("country-inference strategy", () => {
  test("every projected candidate carries country='ID' regardless of city value", () => {
    const config = makeConfig();
    const cities = ["Jakarta", "Denpasar", "Yogyakarta", "Mataram", null, ""];
    for (const city of cities) {
      const r = projectServiceBusinessRow(makeRow({ city }), config);
      expect(r.kind).toBe("ok");
      if (r.kind === "ok") {
        expect(r.candidate.country).toBe("ID");
      }
    }
  });

  test("adapter.country is the sealed 'ID' constant", () => {
    const { factory } = makeFakeFactory([]);
    const adapter = createLegacyServiceBusinessSource({
      session_factory: factory,
      config: makeConfig(),
    });
    expect(adapter.country).toBe("ID");
    expect(adapter.source_id).toBe(LEGACY_SERVICE_SOURCE_ID);
  });

  test("row-level 'country' field is NEVER read (schema has no such column)", () => {
    // The adapter must not accidentally start reading a non-existent
    // `country` column. Projection must ignore any `country` smuggled
    // onto the raw row object · defence against future schema drift
    // on the mock side masking a real-schema bug.
    const r = projectServiceBusinessRow(
      makeRow({ country: "FR" } as unknown as Record<string, unknown>),
      makeConfig(),
    );
    expect(r.kind).toBe("ok");
    if (r.kind === "ok") {
      expect(r.candidate.country).toBe("ID");
    }
  });
});

// ═════════════════════════════════════════════════════════════════════
// §3 · Deterministic external_ref · same input → same candidate_id
// ═════════════════════════════════════════════════════════════════════

describe("deterministic external_ref / candidate_id", () => {
  test("candidate_id is a stable sha256-prefix of (table, public_listing_ref)", () => {
    const config = makeConfig();
    const a = projectServiceBusinessRow(
      makeRow({ public_listing_ref: "#SB-2026-ABCDE" }),
      config,
    );
    const b = projectServiceBusinessRow(
      makeRow({
        public_listing_ref: "#SB-2026-ABCDE",
        business_name: "Different Name",
      }),
      config,
    );
    expect(a.kind).toBe("ok");
    expect(b.kind).toBe("ok");
    if (a.kind === "ok" && b.kind === "ok") {
      expect(a.candidate.candidate_id).toBe(b.candidate.candidate_id);
      expect(a.candidate.candidate_id).toMatch(/^cand-nex-service-[0-9a-f]{16}$/);
    }
  });

  test("different public_listing_ref → different candidate_id", () => {
    const config = makeConfig();
    const a = projectServiceBusinessRow(
      makeRow({ public_listing_ref: "#SB-2026-AAAAA" }),
      config,
    );
    const b = projectServiceBusinessRow(
      makeRow({ public_listing_ref: "#SB-2026-BBBBB" }),
      config,
    );
    if (a.kind === "ok" && b.kind === "ok") {
      expect(a.candidate.candidate_id).not.toBe(b.candidate.candidate_id);
    } else {
      throw new Error("expected both projections to succeed");
    }
  });

  test("legacy_source preserves the exact source identifiers verbatim", () => {
    const config = makeConfig();
    const r = projectServiceBusinessRow(
      makeRow({
        public_listing_ref: "#SB-2026-ZZZZZ",
        internal_id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
      }),
      config,
    );
    if (r.kind === "ok") {
      expect(r.candidate.legacy_source).toEqual({
        table: "nex.service_business",
        ref: "#SB-2026-ZZZZZ",
        internal_id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
      });
    } else {
      throw new Error("expected ok projection");
    }
  });
});

// ═════════════════════════════════════════════════════════════════════
// §4 · No fabrication · missing signals stay missing or get rejected
// ═════════════════════════════════════════════════════════════════════

describe("no fabrication", () => {
  test("rejects row with missing internal_id", () => {
    const r = projectServiceBusinessRow(
      makeRow({ internal_id: "" }),
      makeConfig(),
    );
    expect(r.kind).toBe("projection_failed");
    if (r.kind === "projection_failed") {
      expect(r.reason).toMatch(/internal_id/);
    }
  });

  test("rejects row with missing public_listing_ref", () => {
    const r = projectServiceBusinessRow(
      makeRow({ public_listing_ref: "   " }),
      makeConfig(),
    );
    expect(r.kind).toBe("projection_failed");
    if (r.kind === "projection_failed") {
      expect(r.reason).toMatch(/public_listing_ref/);
    }
  });

  test("rejects row with blank business_name", () => {
    const r = projectServiceBusinessRow(
      makeRow({ business_name: "   " }),
      makeConfig(),
    );
    expect(r.kind).toBe("projection_failed");
    if (r.kind === "projection_failed") {
      expect(r.reason).toMatch(/business_name/);
    }
  });

  test("non-E.164 phone becomes null (never normalised, never fabricated)", () => {
    const r = projectServiceBusinessRow(
      makeRow({ phone: "0812-345-6789" }), // locally-formatted · not E.164
      makeConfig(),
    );
    if (r.kind === "ok") {
      expect(r.candidate.identity.phone_e164).toBeNull();
    } else {
      throw new Error("expected ok projection");
    }
  });

  test("E.164 phone is preserved verbatim", () => {
    const r = projectServiceBusinessRow(
      makeRow({ phone: "+6281234567890" }),
      makeConfig(),
    );
    if (r.kind === "ok") {
      expect(r.candidate.identity.phone_e164).toBe("+6281234567890");
    }
  });

  test("unparseable website becomes null (never guessed)", () => {
    const r = projectServiceBusinessRow(
      makeRow({ website: "::not a url::" }),
      makeConfig(),
    );
    if (r.kind === "ok") {
      expect(r.candidate.identity.website_apex).toBeNull();
    }
  });

  test("website apex strips protocol + leading www", () => {
    const r = projectServiceBusinessRow(
      makeRow({ website: "https://www.Example.co.ID/foo" }),
      makeConfig(),
    );
    if (r.kind === "ok") {
      expect(r.candidate.identity.website_apex).toBe("example.co.id");
    }
  });

  test("out-of-range coordinates are rejected to null", () => {
    const r = projectServiceBusinessRow(
      makeRow({ coordinates_lat: "999", coordinates_lng: "999" }),
      makeConfig(),
    );
    if (r.kind === "ok") {
      expect(r.candidate.identity.coordinates).toBeNull();
    }
  });

  test("one-sided coordinates are rejected to null (no half-coord)", () => {
    const r = projectServiceBusinessRow(
      makeRow({ coordinates_lat: "-6.2", coordinates_lng: null }),
      makeConfig(),
    );
    if (r.kind === "ok") {
      expect(r.candidate.identity.coordinates).toBeNull();
    }
  });

  test("absent address → address object is null (not {line1:null,…})", () => {
    const r = projectServiceBusinessRow(
      makeRow({ address: null }),
      makeConfig(),
    );
    if (r.kind === "ok") {
      expect(r.candidate.identity.address).toBeNull();
    }
  });

  test("present address becomes { line1, postal_code:null } verbatim trimmed", () => {
    const r = projectServiceBusinessRow(
      makeRow({ address: "  Jl. Sudirman 10  " }),
      makeConfig(),
    );
    if (r.kind === "ok") {
      expect(r.candidate.identity.address).toEqual({
        line1: "Jl. Sudirman 10",
        postal_code: null,
      });
    }
  });

  test("street_line and neighbourhood are always null (schema has no such columns)", () => {
    const r = projectServiceBusinessRow(makeRow(), makeConfig());
    if (r.kind === "ok") {
      expect(r.candidate.identity.street_line).toBeNull();
      expect(r.candidate.identity.neighbourhood).toBeNull();
    }
  });
});

// ═════════════════════════════════════════════════════════════════════
// §5 · Keyset pagination · adapter.discoverBatch end-to-end against a fake
// ═════════════════════════════════════════════════════════════════════

describe("keyset pagination", () => {
  test("first call issues ORDER BY internal_id ASC LIMIT batchSize+1 · no WHERE", async () => {
    const { factory, calls } = makeFakeFactory([[]]);
    const adapter = createLegacyServiceBusinessSource({
      session_factory: factory,
      config: makeConfig(),
    });
    const r = await adapter.discoverBatch(null);
    expect(r.kind).toBe("exhausted");
    expect(calls).toHaveLength(1);
    expect(calls[0].sql).toMatch(/FROM nex\.service_business/);
    expect(calls[0].sql).not.toMatch(/WHERE/);
    expect(calls[0].sql).toMatch(/ORDER BY internal_id ASC LIMIT \$1/);
    expect(calls[0].params).toEqual([3]); // batchSize=2 + 1
  });

  test("cursor-driven call issues WHERE internal_id > $1 ORDER BY internal_id ASC LIMIT $2", async () => {
    const { factory, calls } = makeFakeFactory([[]]);
    const adapter = createLegacyServiceBusinessSource({
      session_factory: factory,
      config: makeConfig(),
    });
    await adapter.discoverBatch({ last_internal_id: "cursor-uuid" });
    expect(calls[0].sql).toMatch(
      /WHERE internal_id > \$1 ORDER BY internal_id ASC LIMIT \$2/,
    );
    expect(calls[0].params).toEqual(["cursor-uuid", 3]);
  });

  test("returns `more` with next_cursor when batchSize+1 rows come back", async () => {
    const rows = [
      {
        internal_id: "u-1",
        public_listing_ref: "#SB-2026-00001",
        business_name: "A",
        category_slug: "pharmacies",
        address: null,
        city: "Jakarta",
        district: null,
        coordinates_lng: null,
        coordinates_lat: null,
        phone: null,
        website: null,
        source: "osm_overpass",
        source_reference: "node/1",
      },
      {
        internal_id: "u-2",
        public_listing_ref: "#SB-2026-00002",
        business_name: "B",
        category_slug: "gyms",
        address: null,
        city: "Denpasar",
        district: null,
        coordinates_lng: null,
        coordinates_lat: null,
        phone: null,
        website: null,
        source: "osm_overpass",
        source_reference: "node/2",
      },
      {
        internal_id: "u-3",
        public_listing_ref: "#SB-2026-00003",
        business_name: "C",
        category_slug: "salons",
        address: null,
        city: "Bandung",
        district: null,
        coordinates_lng: null,
        coordinates_lat: null,
        phone: null,
        website: null,
        source: "osm_overpass",
        source_reference: "node/3",
      },
    ];
    const { factory } = makeFakeFactory([rows]);
    const adapter = createLegacyServiceBusinessSource({
      session_factory: factory,
      config: makeConfig(),
    });
    const r: DiscoverBatchResult = await adapter.discoverBatch(null);
    expect(r.kind).toBe("more");
    if (r.kind === "more") {
      expect(r.candidates).toHaveLength(2); // batchSize=2
      expect(r.candidates[0].country).toBe("ID");
      expect(r.candidates[0].entity_type).toBe("service");
      expect(r.next_cursor).toEqual({ last_internal_id: "u-2" });
    }
  });

  test("returns `more` with next_cursor=null when exactly batchSize rows", async () => {
    const rows = [
      {
        internal_id: "u-1",
        public_listing_ref: "#SB-2026-00001",
        business_name: "A",
        category_slug: "pharmacies",
        address: null,
        city: "Jakarta",
        district: null,
        coordinates_lng: null,
        coordinates_lat: null,
        phone: null,
        website: null,
        source: "osm_overpass",
        source_reference: "node/1",
      },
      {
        internal_id: "u-2",
        public_listing_ref: "#SB-2026-00002",
        business_name: "B",
        category_slug: "gyms",
        address: null,
        city: "Denpasar",
        district: null,
        coordinates_lng: null,
        coordinates_lat: null,
        phone: null,
        website: null,
        source: "osm_overpass",
        source_reference: "node/2",
      },
    ];
    const { factory } = makeFakeFactory([rows]);
    const adapter = createLegacyServiceBusinessSource({
      session_factory: factory,
      config: makeConfig(),
    });
    const r = await adapter.discoverBatch(null);
    expect(r.kind).toBe("more");
    if (r.kind === "more") {
      expect(r.candidates).toHaveLength(2);
      expect(r.next_cursor).toBeNull();
    }
  });

  test("adapter opens AND closes its ReadSession each call (best-effort)", async () => {
    const { factory, counters } = makeFakeFactory([[]]);
    const adapter = createLegacyServiceBusinessSource({
      session_factory: factory,
      config: makeConfig(),
    });
    await adapter.discoverBatch(null);
    const c = counters();
    expect(c.openSessions).toBe(1);
    expect(c.closeSessions).toBe(1);
  });
});

// ═════════════════════════════════════════════════════════════════════
// §6 · Error classification
// ═════════════════════════════════════════════════════════════════════

describe("error classification", () => {
  test("non-transient error becomes permanent_failure", async () => {
    const factory: ReadSessionFactory = {
      openSession: async () => ({
        id: "x",
        query: async () => {
          const e = new Error("constraint violation");
          (e as Error & { code: string }).code = "23505";
          throw e;
        },
      }),
      closeSession: async () => {},
    };
    const adapter = createLegacyServiceBusinessSource({
      session_factory: factory,
      config: makeConfig(),
    });
    const r = await adapter.discoverBatch(null);
    expect(r.kind).toBe("permanent_failure");
  });

  test("transient pg code becomes temporary_failure", async () => {
    const factory: ReadSessionFactory = {
      openSession: async () => ({
        id: "x",
        query: async () => {
          const e = new Error("deadlock detected");
          (e as Error & { code: string }).code = "40P01";
          throw e;
        },
      }),
      closeSession: async () => {},
    };
    const adapter = createLegacyServiceBusinessSource({
      session_factory: factory,
      config: makeConfig(),
    });
    const r = await adapter.discoverBatch(null);
    expect(r.kind).toBe("temporary_failure");
    if (r.kind === "temporary_failure") {
      expect(r.reason).toMatch(/40P01/);
    }
  });

  test("openSession rejection becomes temporary_failure", async () => {
    const factory: ReadSessionFactory = {
      openSession: async () => {
        throw new Error("ECONNREFUSED");
      },
      closeSession: async () => {},
    };
    const adapter = createLegacyServiceBusinessSource({
      session_factory: factory,
      config: makeConfig(),
    });
    const r = await adapter.discoverBatch(null);
    expect(r.kind).toBe("temporary_failure");
  });
});

// ═════════════════════════════════════════════════════════════════════
// §7 · Generation metadata stamps the configured run_id
// ═════════════════════════════════════════════════════════════════════

describe("generation metadata", () => {
  test("every candidate records generator / generated_at / generation_run_id", () => {
    const r = projectServiceBusinessRow(makeRow(), makeConfig());
    if (r.kind === "ok") {
      expect(r.candidate.generation_source).toEqual({
        generator: "scripts/nex-canonical/generate-candidates.ts",
        generated_at: FIXED_NOW,
        generation_run_id: RUN_ID,
      });
    } else {
      throw new Error("expected ok projection");
    }
  });

  test("caveats include the honest source + source_reference + category_slug", () => {
    const r = projectServiceBusinessRow(
      makeRow({
        source: "osm_overpass",
        source_reference: "node/42",
        category_slug: "dentists",
      }),
      makeConfig(),
    );
    if (r.kind === "ok") {
      expect(r.candidate.caveats[0]).toMatch(/source="osm_overpass"/);
      expect(r.candidate.caveats[0]).toMatch(/source_reference="node\/42"/);
      expect(r.candidate.caveats[0]).toMatch(/category_slug="dentists"/);
    }
  });

  test("every candidate carries status='pending_founder_review' · never auto-approved", () => {
    const r = projectServiceBusinessRow(makeRow(), makeConfig());
    if (r.kind === "ok") {
      expect(r.candidate.status).toBe("pending_founder_review");
    }
  });
});
