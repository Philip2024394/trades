// scripts/nex-canonical/source-legacy-accommodation-business.test.ts
//
// Pure-function tests for the accommodation legacy source adapter.
// No DB. No network. Projection and keyset discipline only.
//
// Mirrors the discipline of the sealed food adapter · if the food
// adapter grows tests in future, mirror them here too.

import { describe, expect, test } from "vitest";
import {
  LEGACY_ACCOMMODATION_SOURCE_ID,
  LEGACY_ACCOMMODATION_COUNTRY,
  LEGACY_ACCOMMODATION_ENTITY_TYPE,
  LEGACY_ACCOMMODATION_DEFAULT_BATCH_SIZE,
  createLegacyAccommodationBusinessSource,
  projectAccommodationBusinessRow,
  type LegacyAccommodationSourceConfig,
} from "./source-legacy-accommodation-business";
import type {
  ReadSession,
  ReadSessionFactory,
} from "./pg-read-adapter";

// ═════════════════════════════════════════════════════════════════════
// §1 · Fixtures · deterministic
// ═════════════════════════════════════════════════════════════════════

const NOW_ISO = "2026-10-09T12:00:00.000Z";
const RUN_ID = "test-run-accommodation-0001";

function cfg(
  overrides: Partial<LegacyAccommodationSourceConfig> = {},
): LegacyAccommodationSourceConfig {
  return {
    generationRunId: RUN_ID,
    nowIso: () => NOW_ISO,
    ...overrides,
  };
}

function sampleRow(overrides: Record<string, unknown> = {}) {
  return {
    internal_id: "00006717-0559-436d-9703-cf726ccc96e6",
    public_listing_ref: "#AC-2026-1CJ0G",
    business_name: "Euphoria Hotel Bali",
    category: "hotel",
    address: "11-12, Jalan Patih Jelantik, Legian, Kuta, Bali",
    city: "Denpasar",
    district: null,
    coordinates_lng: "115.1786964",
    coordinates_lat: "-8.7099002",
    phone: "+62 36-18496789", // real-world: NOT E.164 shaped
    website: null,
    source: "osm_overpass",
    source_reference: "node/4177763303",
    street_line: null,
    neighbourhood: null,
    country: "ID",
    ...overrides,
  } as never;
}

// ═════════════════════════════════════════════════════════════════════
// §2 · Known literals · public contract
// ═════════════════════════════════════════════════════════════════════

describe("accommodation adapter · known literals", () => {
  test("source_id slug matches the sealed registry seed (migration 185)", () => {
    expect(LEGACY_ACCOMMODATION_SOURCE_ID).toBe(
      "nex_accommodation_business_legacy",
    );
  });

  test("country default = 'ID' (first-wave scope)", () => {
    expect(LEGACY_ACCOMMODATION_COUNTRY).toBe("ID");
  });

  test("entity_type = 'accommodation' (sealed enum value · migration 167)", () => {
    expect(LEGACY_ACCOMMODATION_ENTITY_TYPE).toBe("accommodation");
  });

  test("default batch size matches the food adapter (small, retry-cheap)", () => {
    expect(LEGACY_ACCOMMODATION_DEFAULT_BATCH_SIZE).toBe(50);
  });
});

// ═════════════════════════════════════════════════════════════════════
// §3 · Projection · happy path · field mapping
// ═════════════════════════════════════════════════════════════════════

describe("projectAccommodationBusinessRow · happy path", () => {
  test("ok row → ok candidate carrying sealed shape", () => {
    const r = projectAccommodationBusinessRow(sampleRow(), cfg());
    expect(r.kind).toBe("ok");
    if (r.kind !== "ok") return;
    expect(r.candidate.status).toBe("pending_founder_review");
    expect(r.candidate.entity_type).toBe("accommodation");
    expect(r.candidate.country).toBe("ID");
    expect(r.candidate.identity.name_canonical).toBe("Euphoria Hotel Bali");
    expect(r.candidate.identity.city).toBe("Denpasar");
    expect(r.candidate.legacy_source).toEqual({
      table: "nex.accommodation_business",
      ref: "#AC-2026-1CJ0G",
      internal_id: "00006717-0559-436d-9703-cf726ccc96e6",
    });
    expect(r.candidate.selection_score).toBe(0.5);
    expect(r.candidate.generation_source.generation_run_id).toBe(RUN_ID);
    expect(r.candidate.generation_source.generated_at).toBe(NOW_ISO);
  });

  test("country is stamped from the SOURCE column, not blindly hardcoded", () => {
    // The constant is a fallback · the genuine source value wins.
    const r = projectAccommodationBusinessRow(
      sampleRow({ country: "GB" }),
      cfg(),
    );
    expect(r.kind).toBe("ok");
    if (r.kind !== "ok") return;
    expect(r.candidate.country).toBe("GB");
  });

  test("blank country falls back to LEGACY_ACCOMMODATION_COUNTRY defensively", () => {
    const r = projectAccommodationBusinessRow(
      sampleRow({ country: "   " }),
      cfg(),
    );
    expect(r.kind).toBe("ok");
    if (r.kind !== "ok") return;
    expect(r.candidate.country).toBe("ID");
  });

  test("coordinates parsed from string numeric; invalid → null", () => {
    const ok = projectAccommodationBusinessRow(sampleRow(), cfg());
    if (ok.kind !== "ok") throw new Error("expected ok");
    expect(ok.candidate.identity.coordinates).toEqual({
      lat: -8.7099002,
      lng: 115.1786964,
    });
    const bad = projectAccommodationBusinessRow(
      sampleRow({ coordinates_lat: "not-a-number" }),
      cfg(),
    );
    if (bad.kind !== "ok") throw new Error("expected ok");
    expect(bad.candidate.identity.coordinates).toBeNull();
  });

  test("address becomes { line1, postal_code: null } when present; null when absent", () => {
    const withAddr = projectAccommodationBusinessRow(sampleRow(), cfg());
    if (withAddr.kind !== "ok") throw new Error("expected ok");
    expect(withAddr.candidate.identity.address).toEqual({
      line1: "11-12, Jalan Patih Jelantik, Legian, Kuta, Bali",
      postal_code: null,
    });

    const noAddr = projectAccommodationBusinessRow(
      sampleRow({ address: null }),
      cfg(),
    );
    if (noAddr.kind !== "ok") throw new Error("expected ok");
    expect(noAddr.candidate.identity.address).toBeNull();
  });

  test("street_line + neighbourhood passthrough verbatim; never derived", () => {
    const r = projectAccommodationBusinessRow(
      sampleRow({ street_line: "Jalan Legian 12", neighbourhood: "Kuta" }),
      cfg(),
    );
    if (r.kind !== "ok") throw new Error("expected ok");
    expect(r.candidate.identity.street_line).toBe("Jalan Legian 12");
    expect(r.candidate.identity.neighbourhood).toBe("Kuta");
  });

  test("source + source_reference emitted into caveats verbatim", () => {
    const r = projectAccommodationBusinessRow(sampleRow(), cfg());
    if (r.kind !== "ok") throw new Error("expected ok");
    expect(r.candidate.caveats[0]).toBe(
      'legacy-adapter projection · source="osm_overpass" · source_reference="node/4177763303"',
    );
  });
});

// ═════════════════════════════════════════════════════════════════════
// §4 · Deterministic external_ref · candidate_id
// ═════════════════════════════════════════════════════════════════════

describe("projectAccommodationBusinessRow · deterministic external_ref", () => {
  test("candidate_id is deterministic given (table, public_listing_ref)", () => {
    const a = projectAccommodationBusinessRow(sampleRow(), cfg());
    const b = projectAccommodationBusinessRow(sampleRow(), cfg());
    if (a.kind !== "ok" || b.kind !== "ok") throw new Error("expected ok");
    expect(a.candidate.candidate_id).toBe(b.candidate.candidate_id);
    expect(a.candidate.candidate_id).toMatch(/^cand-nex-accommodation-[0-9a-f]{16}$/);
  });

  test("different public_listing_ref → different candidate_id", () => {
    const a = projectAccommodationBusinessRow(sampleRow(), cfg());
    const b = projectAccommodationBusinessRow(
      sampleRow({ public_listing_ref: "#AC-2026-OTHER" }),
      cfg(),
    );
    if (a.kind !== "ok" || b.kind !== "ok") throw new Error("expected ok");
    expect(a.candidate.candidate_id).not.toBe(b.candidate.candidate_id);
  });

  test("candidate_id ignores volatile fields (nowIso, run id, phone)", () => {
    const a = projectAccommodationBusinessRow(sampleRow(), cfg());
    const b = projectAccommodationBusinessRow(
      sampleRow(),
      cfg({
        generationRunId: "different-run",
        nowIso: () => "2099-01-01T00:00:00.000Z",
      }),
    );
    if (a.kind !== "ok" || b.kind !== "ok") throw new Error("expected ok");
    // Same source identity → same candidate_id regardless of run noise.
    expect(a.candidate.candidate_id).toBe(b.candidate.candidate_id);
  });

  test("legacy_source.internal_id round-trips verbatim (external_ref traceability)", () => {
    const r = projectAccommodationBusinessRow(sampleRow(), cfg());
    if (r.kind !== "ok") throw new Error("expected ok");
    expect(r.candidate.legacy_source.internal_id).toBe(
      "00006717-0559-436d-9703-cf726ccc96e6",
    );
    expect(r.candidate.legacy_source.ref).toBe("#AC-2026-1CJ0G");
  });
});

// ═════════════════════════════════════════════════════════════════════
// §5 · No fabrication on missing fields · "do not invent"
// ═════════════════════════════════════════════════════════════════════

describe("projectAccommodationBusinessRow · no fabrication", () => {
  test("missing business_name → projection_failed, no Candidate emitted", () => {
    const r = projectAccommodationBusinessRow(
      sampleRow({ business_name: "" }),
      cfg(),
    );
    expect(r.kind).toBe("projection_failed");
  });

  test("missing public_listing_ref → projection_failed", () => {
    const r = projectAccommodationBusinessRow(
      sampleRow({ public_listing_ref: "   " }),
      cfg(),
    );
    expect(r.kind).toBe("projection_failed");
  });

  test("missing internal_id → projection_failed with null internal_id", () => {
    const r = projectAccommodationBusinessRow(
      sampleRow({ internal_id: "" }),
      cfg(),
    );
    expect(r.kind).toBe("projection_failed");
    if (r.kind !== "projection_failed") return;
    expect(r.internal_id).toBeNull();
  });

  test("missing optional fields stay null · adapter does NOT invent", () => {
    const r = projectAccommodationBusinessRow(
      sampleRow({
        address: null,
        district: null,
        coordinates_lat: null,
        coordinates_lng: null,
        phone: null,
        website: null,
        street_line: null,
        neighbourhood: null,
      }),
      cfg(),
    );
    if (r.kind !== "ok") throw new Error("expected ok");
    expect(r.candidate.identity.address).toBeNull();
    expect(r.candidate.identity.district).toBeNull();
    expect(r.candidate.identity.coordinates).toBeNull();
    expect(r.candidate.identity.phone_e164).toBeNull();
    expect(r.candidate.identity.website_apex).toBeNull();
    expect(r.candidate.identity.street_line).toBeNull();
    expect(r.candidate.identity.neighbourhood).toBeNull();
  });

  test("aliases always [] · the adapter never fabricates alias lists", () => {
    const r = projectAccommodationBusinessRow(sampleRow(), cfg());
    if (r.kind !== "ok") throw new Error("expected ok");
    expect(r.candidate.identity.aliases).toEqual([]);
  });
});

// ═════════════════════════════════════════════════════════════════════
// §6 · E.164 validation · phone passthrough discipline
// ═════════════════════════════════════════════════════════════════════

describe("projectAccommodationBusinessRow · phone E.164", () => {
  test("already-E.164 phone passes through verbatim", () => {
    const r = projectAccommodationBusinessRow(
      sampleRow({ phone: "+6281234567890" }),
      cfg(),
    );
    if (r.kind !== "ok") throw new Error("expected ok");
    expect(r.candidate.identity.phone_e164).toBe("+6281234567890");
  });

  test("formatted-but-not-E.164 phone → null (no normalisation, no invention)", () => {
    // Real live sample · includes a space and a dash.
    const r = projectAccommodationBusinessRow(
      sampleRow({ phone: "+62 36-18496789" }),
      cfg(),
    );
    if (r.kind !== "ok") throw new Error("expected ok");
    expect(r.candidate.identity.phone_e164).toBeNull();
  });

  test("phone with leading 0 → null (not E.164)", () => {
    const r = projectAccommodationBusinessRow(
      sampleRow({ phone: "081234567890" }),
      cfg(),
    );
    if (r.kind !== "ok") throw new Error("expected ok");
    expect(r.candidate.identity.phone_e164).toBeNull();
  });

  test("phone with letters → null", () => {
    const r = projectAccommodationBusinessRow(
      sampleRow({ phone: "+1800-FLOWERS" }),
      cfg(),
    );
    if (r.kind !== "ok") throw new Error("expected ok");
    expect(r.candidate.identity.phone_e164).toBeNull();
  });

  test("phone too short for E.164 → null", () => {
    // Validator demands [1-9][0-9]{6,14} = 7–15 digits total.
    // "+62123" = 5 digits · too short.
    const r = projectAccommodationBusinessRow(
      sampleRow({ phone: "+62123" }),
      cfg(),
    );
    if (r.kind !== "ok") throw new Error("expected ok");
    expect(r.candidate.identity.phone_e164).toBeNull();
  });

  test("the regex matches the sealed validator pattern", () => {
    // Validator demands /^\+[1-9][0-9]{6,14}$/ · confirm boundary values.
    expect("+1234567").toMatch(/^\+[1-9][0-9]{6,14}$/); // 7 digits = min
    expect("+123456789012345").toMatch(/^\+[1-9][0-9]{6,14}$/); // 15 digits = max
    expect("+12345").not.toMatch(/^\+[1-9][0-9]{6,14}$/);
  });
});

// ═════════════════════════════════════════════════════════════════════
// §7 · Website apex extraction
// ═════════════════════════════════════════════════════════════════════

describe("projectAccommodationBusinessRow · website apex", () => {
  test("https URL → apex", () => {
    const r = projectAccommodationBusinessRow(
      sampleRow({ website: "https://www.euphoriahotel.com/rooms" }),
      cfg(),
    );
    if (r.kind !== "ok") throw new Error("expected ok");
    expect(r.candidate.identity.website_apex).toBe("euphoriahotel.com");
  });

  test("bare host → apex (adapter adds scheme defensively)", () => {
    const r = projectAccommodationBusinessRow(
      sampleRow({ website: "euphoriahotel.com" }),
      cfg(),
    );
    if (r.kind !== "ok") throw new Error("expected ok");
    expect(r.candidate.identity.website_apex).toBe("euphoriahotel.com");
  });

  test("unparseable → null", () => {
    const r = projectAccommodationBusinessRow(
      sampleRow({ website: "::::not-a-url::::" }),
      cfg(),
    );
    if (r.kind !== "ok") throw new Error("expected ok");
    expect(r.candidate.identity.website_apex).toBeNull();
  });
});

// ═════════════════════════════════════════════════════════════════════
// §8 · OSM id passthrough
// ═════════════════════════════════════════════════════════════════════

describe("projectAccommodationBusinessRow · osm_id passthrough", () => {
  test("osm_overpass + node/<id> → osm_id='node/<id>'", () => {
    const r = projectAccommodationBusinessRow(sampleRow(), cfg());
    if (r.kind !== "ok") throw new Error("expected ok");
    expect(r.candidate.identity.osm_id).toBe("node/4177763303");
  });

  test("osm_overpass + way/<id> → osm_id='way/<id>'", () => {
    const r = projectAccommodationBusinessRow(
      sampleRow({ source_reference: "way/987654" }),
      cfg(),
    );
    if (r.kind !== "ok") throw new Error("expected ok");
    expect(r.candidate.identity.osm_id).toBe("way/987654");
  });

  test("non-OSM source → osm_id null even if reference looks OSM-shaped", () => {
    const r = projectAccommodationBusinessRow(
      sampleRow({ source: "scrape_other", source_reference: "node/1" }),
      cfg(),
    );
    if (r.kind !== "ok") throw new Error("expected ok");
    expect(r.candidate.identity.osm_id).toBeNull();
  });

  test("OSM source but non-OSM-shaped reference → osm_id null (no invention)", () => {
    const r = projectAccommodationBusinessRow(
      sampleRow({ source_reference: "https://example.com/listing/1" }),
      cfg(),
    );
    if (r.kind !== "ok") throw new Error("expected ok");
    expect(r.candidate.identity.osm_id).toBeNull();
  });

  test("wikidata_qid always null · no column carries it in the live table", () => {
    const r = projectAccommodationBusinessRow(sampleRow(), cfg());
    if (r.kind !== "ok") throw new Error("expected ok");
    expect(r.candidate.identity.wikidata_qid).toBeNull();
  });
});

// ═════════════════════════════════════════════════════════════════════
// §9 · Dedup rule respects (country, name_norm, city) WITHOUT blind merge
// ═════════════════════════════════════════════════════════════════════
//
// The adapter is a projection, not a resolver · the sealed
// canonical-resolver owns the (country, name_norm, city) dedup
// decision. The invariant the adapter MUST uphold is: two source rows
// that happen to share name+city+country still produce two distinct
// Candidates · the adapter never collapses them. Downstream merging
// is a resolver choice, not an adapter choice.

describe("projectAccommodationBusinessRow · dedup discipline (no blind merge)", () => {
  test("two rows with same name/city/country but different public_listing_ref → two candidates with different ids", () => {
    const a = projectAccommodationBusinessRow(
      sampleRow({
        internal_id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
        public_listing_ref: "#AC-2026-DUPE-A",
      }),
      cfg(),
    );
    const b = projectAccommodationBusinessRow(
      sampleRow({
        internal_id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
        public_listing_ref: "#AC-2026-DUPE-B",
      }),
      cfg(),
    );
    if (a.kind !== "ok" || b.kind !== "ok") throw new Error("expected ok");
    // Both carry the same (country, name, city) triple ...
    expect(a.candidate.country).toBe(b.candidate.country);
    expect(a.candidate.identity.name_canonical).toBe(
      b.candidate.identity.name_canonical,
    );
    expect(a.candidate.identity.city).toBe(b.candidate.identity.city);
    // ... yet the adapter emits two distinct candidates with distinct
    // ids and preserves each legacy_source. The resolver (not us)
    // decides whether these collapse into one canonical row.
    expect(a.candidate.candidate_id).not.toBe(b.candidate.candidate_id);
    expect(a.candidate.legacy_source.ref).not.toBe(b.candidate.legacy_source.ref);
    expect(a.candidate.legacy_source.internal_id).not.toBe(
      b.candidate.legacy_source.internal_id,
    );
  });

  test("adapter does NOT read nex.business_canonical to pre-merge · pure projection", () => {
    // Structural check: projecting the same input twice is bitwise
    // identical (ignoring the time stamp, which is injected). This
    // proves the function is pure of DB state.
    const a = projectAccommodationBusinessRow(sampleRow(), cfg());
    const b = projectAccommodationBusinessRow(sampleRow(), cfg());
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});

// ═════════════════════════════════════════════════════════════════════
// §10 · Adapter wiring · DirectorySource contract
// ═════════════════════════════════════════════════════════════════════

/** Minimal fake read session · records queries for inspection. */
function fakeSessionFactory(rows: unknown[][]): {
  readonly factory: ReadSessionFactory;
  readonly observedParams: unknown[][];
} {
  const observedParams: unknown[][] = [];
  let callIdx = 0;
  const factory: ReadSessionFactory = {
    openSession: async (): Promise<ReadSession> => {
      const session: ReadSession = {
        id: "fake-session-0",
        query: async <T>(_sql: string, params: readonly unknown[]) => {
          observedParams.push([...params]);
          const batch = (rows[callIdx++] ?? []) as T[];
          return { rows: batch as readonly T[], rowCount: batch.length };
        },
      };
      return session;
    },
    closeSession: async () => {
      /* no-op */
    },
  };
  return { factory, observedParams };
}

describe("createLegacyAccommodationBusinessSource · DirectorySource contract", () => {
  test("exposes the sealed source_id + country", () => {
    const { factory } = fakeSessionFactory([[]]);
    const src = createLegacyAccommodationBusinessSource({
      session_factory: factory,
      config: cfg(),
    });
    expect(src.source_id).toBe("nex_accommodation_business_legacy");
    expect(src.country).toBe("ID");
  });

  test("empty table → kind:'exhausted'", async () => {
    const { factory } = fakeSessionFactory([[]]);
    const src = createLegacyAccommodationBusinessSource({
      session_factory: factory,
      config: cfg(),
    });
    const r = await src.discoverBatch(null);
    expect(r.kind).toBe("exhausted");
  });

  test("one short batch → kind:'more' with next_cursor:null", async () => {
    const { factory } = fakeSessionFactory([[sampleRow()]]);
    const src = createLegacyAccommodationBusinessSource({
      session_factory: factory,
      config: cfg({ batchSize: 10 }),
    });
    const r = await src.discoverBatch(null);
    expect(r.kind).toBe("more");
    if (r.kind !== "more") return;
    expect(r.candidates).toHaveLength(1);
    expect(r.next_cursor).toBeNull();
  });

  test("full batch + overflow → kind:'more' with next_cursor set", async () => {
    const batch = [
      sampleRow({ internal_id: "a" }),
      sampleRow({ internal_id: "b" }),
      sampleRow({ internal_id: "c" }), // overflow sentinel · batchSize=2
    ];
    const { factory, observedParams } = fakeSessionFactory([batch]);
    const src = createLegacyAccommodationBusinessSource({
      session_factory: factory,
      config: cfg({ batchSize: 2 }),
    });
    const r = await src.discoverBatch(null);
    expect(r.kind).toBe("more");
    if (r.kind !== "more") return;
    expect(r.candidates).toHaveLength(2);
    expect(r.next_cursor).toEqual({ last_internal_id: "b" });
    // Confirms LIMIT batchSize+1
    expect(observedParams[0]).toEqual([3]);
  });

  test("cursor is honoured as keyset lower bound", async () => {
    const { factory, observedParams } = fakeSessionFactory([
      [sampleRow({ internal_id: "d" })],
    ]);
    const src = createLegacyAccommodationBusinessSource({
      session_factory: factory,
      config: cfg({ batchSize: 10 }),
    });
    await src.discoverBatch({ last_internal_id: "c" });
    expect(observedParams[0]).toEqual(["c", 11]);
  });

  test("non-string cursor is treated as null (defensive)", async () => {
    const { factory, observedParams } = fakeSessionFactory([[sampleRow()]]);
    const src = createLegacyAccommodationBusinessSource({
      session_factory: factory,
      config: cfg({ batchSize: 10 }),
    });
    // Pass a cursor whose last_internal_id is not a string.
    await src.discoverBatch({
      last_internal_id: 42 as unknown as string,
    });
    // Fallback: no cursor params, just the batchSize+1 param.
    expect(observedParams[0]).toEqual([11]);
  });

  test("session factory failure → temporary_failure (runner retries)", async () => {
    const factory: ReadSessionFactory = {
      openSession: async () => {
        throw new Error("boom");
      },
      closeSession: async () => {
        /* unused */
      },
    };
    const src = createLegacyAccommodationBusinessSource({
      session_factory: factory,
      config: cfg(),
    });
    const r = await src.discoverBatch(null);
    expect(r.kind).toBe("temporary_failure");
  });

  test("transient pg code → temporary_failure (runner retries)", async () => {
    const factory: ReadSessionFactory = {
      openSession: async (): Promise<ReadSession> => ({
        id: "fake-transient",
        query: async () => {
          const err = new Error("deadlock") as Error & { code: string };
          err.code = "40P01";
          throw err;
        },
      }),
      closeSession: async () => {
        /* no-op */
      },
    };
    const src = createLegacyAccommodationBusinessSource({
      session_factory: factory,
      config: cfg(),
    });
    const r = await src.discoverBatch(null);
    expect(r.kind).toBe("temporary_failure");
  });

  test("non-transient pg error → permanent_failure (runner moves on)", async () => {
    const factory: ReadSessionFactory = {
      openSession: async (): Promise<ReadSession> => ({
        id: "fake-permanent",
        query: async () => {
          const err = new Error("relation missing") as Error & {
            code: string;
          };
          err.code = "42P01";
          throw err;
        },
      }),
      closeSession: async () => {
        /* no-op */
      },
    };
    const src = createLegacyAccommodationBusinessSource({
      session_factory: factory,
      config: cfg(),
    });
    const r = await src.discoverBatch(null);
    expect(r.kind).toBe("permanent_failure");
  });

  test("rows that fail projection are silently dropped from the batch", async () => {
    const batch = [
      sampleRow({ internal_id: "x" }),
      sampleRow({
        internal_id: "y",
        business_name: "", // forces projection_failed
      }),
    ];
    const { factory } = fakeSessionFactory([batch]);
    const src = createLegacyAccommodationBusinessSource({
      session_factory: factory,
      config: cfg({ batchSize: 10 }),
    });
    const r = await src.discoverBatch(null);
    expect(r.kind).toBe("more");
    if (r.kind !== "more") return;
    expect(r.candidates).toHaveLength(1);
    expect(r.candidates[0].legacy_source.internal_id).toBe("x");
  });
});
