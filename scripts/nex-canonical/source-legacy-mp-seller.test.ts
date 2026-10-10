// scripts/nex-canonical/source-legacy-mp-seller.test.ts
//
// Pure-function tests for `source-legacy-mp-seller.ts`. No DB. No
// network. Exercises the projection, the keyset cursor, and the
// adapter error branches via an in-memory ReadSessionFactory stub.
// Mirrors the deliberate discipline of the food-business adapter
// tests (sealed shape · deterministic IDs · no fabrication).

import { describe, expect, test } from "vitest";
import {
  LEGACY_MP_SELLER_DEFAULT_BATCH_SIZE,
  LEGACY_MP_SELLER_ENTITY_TYPE,
  LEGACY_MP_SELLER_SOURCE_COUNTRY,
  LEGACY_MP_SELLER_SOURCE_ID,
  createLegacyMpSellerSource,
  parseCountryFromJurisdiction,
  parseDistrictFromJurisdiction,
  projectMpSellerRow,
  type LegacyMpSellerSourceConfig,
} from "./source-legacy-mp-seller";
import type { ReadSession, ReadSessionFactory } from "./pg-read-adapter";
import { validateCandidate } from "./candidate-validator";

const FIXED_ISO = "2026-10-09T12:00:00.000Z";

function fixedConfig(
  override: Partial<LegacyMpSellerSourceConfig> = {},
): LegacyMpSellerSourceConfig {
  return {
    batchSize: override.batchSize,
    generationRunId:
      override.generationRunId ?? "test-run-mp-seller-20261009",
    nowIso: override.nowIso ?? (() => FIXED_ISO),
  };
}

function row(
  overrides: Partial<Parameters<typeof projectMpSellerRow>[0]> = {},
): Parameters<typeof projectMpSellerRow>[0] {
  return {
    seller_id: "00000000-0000-0000-0000-000000000001",
    slug: "toko-nex-demo",
    display_name: "Toko NEX Demo",
    city: "Yogyakarta",
    jurisdiction: "ID/DIY/Yogyakarta",
    bio: null,
    contact_ref: null,
    discovered_from: "walker:market:yogyakarta-city",
    source: null,
    source_reference: null,
    ...overrides,
  };
}

// ═════════════════════════════════════════════════════════════════════
// §1 · Sealed literals
// ═════════════════════════════════════════════════════════════════════

describe("mp-seller · sealed literals", () => {
  test("source_id uses the sealed slug used by migration 187", () => {
    expect(LEGACY_MP_SELLER_SOURCE_ID).toBe("nex_mp_seller_legacy");
  });

  test("entity_type is the sealed migration-167 enum value", () => {
    expect(LEGACY_MP_SELLER_ENTITY_TYPE).toBe("marketplace_seller");
  });

  test("source-level country advertised is 'ID' (first-wave Indonesia)", () => {
    expect(LEGACY_MP_SELLER_SOURCE_COUNTRY).toBe("ID");
  });

  test("default batch size is a small positive integer", () => {
    expect(LEGACY_MP_SELLER_DEFAULT_BATCH_SIZE).toBeGreaterThan(0);
    expect(LEGACY_MP_SELLER_DEFAULT_BATCH_SIZE).toBeLessThanOrEqual(500);
  });
});

// ═════════════════════════════════════════════════════════════════════
// §2 · Jurisdiction parsers
// ═════════════════════════════════════════════════════════════════════

describe("mp-seller · parseCountryFromJurisdiction", () => {
  test("extracts ISO2 prefix from the canonical shape", () => {
    expect(parseCountryFromJurisdiction("ID/DIY/Yogyakarta")).toBe("ID");
    expect(parseCountryFromJurisdiction("ID/Jakarta/Jakarta")).toBe("ID");
    expect(parseCountryFromJurisdiction("MY/Selangor/Shah Alam")).toBe("MY");
  });

  test("rejects malformed input · nothing is fabricated", () => {
    expect(parseCountryFromJurisdiction(null)).toBeNull();
    expect(parseCountryFromJurisdiction(undefined)).toBeNull();
    expect(parseCountryFromJurisdiction("")).toBeNull();
    expect(parseCountryFromJurisdiction("   ")).toBeNull();
    expect(parseCountryFromJurisdiction("no-slash-here")).toBeNull();
    expect(parseCountryFromJurisdiction("/no-prefix/")).toBeNull();
    expect(parseCountryFromJurisdiction("id/lower/case")).toBeNull();
    expect(parseCountryFromJurisdiction("IDN/Jakarta/Jakarta")).toBeNull();
    expect(parseCountryFromJurisdiction("1D/Jakarta/Jakarta")).toBeNull();
  });
});

describe("mp-seller · parseDistrictFromJurisdiction", () => {
  test("returns middle segment when distinct from city", () => {
    expect(
      parseDistrictFromJurisdiction("ID/DIY/Yogyakarta", "Yogyakarta"),
    ).toBe("DIY");
  });

  test("suppresses middle segment when it duplicates the city", () => {
    expect(
      parseDistrictFromJurisdiction("ID/Jakarta/Jakarta", "Jakarta"),
    ).toBeNull();
    expect(
      parseDistrictFromJurisdiction("ID/Bandung/Bandung", "bandung"),
    ).toBeNull();
  });

  test("returns null on malformed or short input", () => {
    expect(parseDistrictFromJurisdiction(null, "x")).toBeNull();
    expect(parseDistrictFromJurisdiction("", "x")).toBeNull();
    expect(parseDistrictFromJurisdiction("ID/x", "x")).toBeNull();
    expect(parseDistrictFromJurisdiction("ID//Yogyakarta", "Yogyakarta")).toBeNull();
  });
});

// ═════════════════════════════════════════════════════════════════════
// §3 · Projection · happy path produces a sealed-valid Candidate
// ═════════════════════════════════════════════════════════════════════

describe("mp-seller · projectMpSellerRow · happy path", () => {
  test("produces a Candidate accepted by the sealed validator", () => {
    const result = projectMpSellerRow(row(), fixedConfig());
    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") return;
    // validateCandidate throws on any shape violation.
    expect(() => validateCandidate(result.candidate)).not.toThrow();
  });

  test("stamps sealed entity_type = marketplace_seller", () => {
    const result = projectMpSellerRow(row(), fixedConfig());
    if (result.kind !== "ok") throw new Error("expected ok");
    expect(result.candidate.entity_type).toBe("marketplace_seller");
  });

  test("country is derived from the jurisdiction ISO2 prefix", () => {
    const result = projectMpSellerRow(
      row({ jurisdiction: "MY/Selangor/Shah Alam", city: "Shah Alam" }),
      fixedConfig(),
    );
    if (result.kind !== "ok") throw new Error("expected ok");
    expect(result.candidate.country).toBe("MY");
  });

  test("legacy_source carries table + slug ref + seller_id", () => {
    const r = row({
      slug: "wbell-phone-yogyakarta",
      seller_id: "2ec3ce98-4629-4dcb-88ac-6b5c827bb70c",
    });
    const result = projectMpSellerRow(r, fixedConfig());
    if (result.kind !== "ok") throw new Error("expected ok");
    expect(result.candidate.legacy_source).toEqual({
      table: "nex.mp_seller",
      ref: "wbell-phone-yogyakarta",
      internal_id: "2ec3ce98-4629-4dcb-88ac-6b5c827bb70c",
    });
  });

  test("coordinates stay null · marketplace sellers are account-keyed", () => {
    const result = projectMpSellerRow(row(), fixedConfig());
    if (result.kind !== "ok") throw new Error("expected ok");
    expect(result.candidate.identity.coordinates).toBeNull();
  });

  test("phone and website stay null · mp_seller has no such columns", () => {
    const result = projectMpSellerRow(
      row({ contact_ref: "contact_123" }),
      fixedConfig(),
    );
    if (result.kind !== "ok") throw new Error("expected ok");
    // contact_ref is NOT a phone and MUST NOT appear in phone_e164.
    expect(result.candidate.identity.phone_e164).toBeNull();
    expect(result.candidate.identity.website_apex).toBeNull();
  });

  test("slug is surfaced as an alias (account-identity carrier)", () => {
    const result = projectMpSellerRow(
      row({ slug: "data-fc-phone-yogyakarta" }),
      fixedConfig(),
    );
    if (result.kind !== "ok") throw new Error("expected ok");
    expect(result.candidate.identity.aliases).toEqual([
      "data-fc-phone-yogyakarta",
    ]);
  });

  test("district is suppressed when it duplicates city", () => {
    const result = projectMpSellerRow(
      row({ city: "Jakarta", jurisdiction: "ID/Jakarta/Jakarta" }),
      fixedConfig(),
    );
    if (result.kind !== "ok") throw new Error("expected ok");
    expect(result.candidate.identity.district).toBeNull();
  });

  test("district is preserved when distinct from city", () => {
    const result = projectMpSellerRow(
      row({ city: "Yogyakarta", jurisdiction: "ID/DIY/Yogyakarta" }),
      fixedConfig(),
    );
    if (result.kind !== "ok") throw new Error("expected ok");
    expect(result.candidate.identity.district).toBe("DIY");
  });

  test("address, street_line, neighbourhood are null (not fabricated)", () => {
    const result = projectMpSellerRow(
      row({ bio: "Jl. Example 123, somewhere", discovered_from: "x" }),
      fixedConfig(),
    );
    if (result.kind !== "ok") throw new Error("expected ok");
    expect(result.candidate.identity.address).toBeNull();
    expect(result.candidate.identity.street_line).toBeNull();
    expect(result.candidate.identity.neighbourhood).toBeNull();
  });
});

// ═════════════════════════════════════════════════════════════════════
// §4 · candidate_id · deterministic external_ref rule
// ═════════════════════════════════════════════════════════════════════

describe("mp-seller · candidate_id determinism", () => {
  test("same input (slug) → identical candidate_id across runs", () => {
    const a = projectMpSellerRow(row(), fixedConfig());
    const b = projectMpSellerRow(row(), fixedConfig());
    if (a.kind !== "ok" || b.kind !== "ok") throw new Error("expected ok");
    expect(a.candidate.candidate_id).toBe(b.candidate.candidate_id);
  });

  test("candidate_id ignores seller_id · it is slug-keyed", () => {
    // Different uuid, same slug · same candidate_id (slug is the
    // sealed deterministic key; seller_id is the internal_id).
    const a = projectMpSellerRow(
      row({ seller_id: "aaaaaaaa-0000-0000-0000-000000000001" }),
      fixedConfig(),
    );
    const b = projectMpSellerRow(
      row({ seller_id: "bbbbbbbb-0000-0000-0000-000000000002" }),
      fixedConfig(),
    );
    if (a.kind !== "ok" || b.kind !== "ok") throw new Error("expected ok");
    expect(a.candidate.candidate_id).toBe(b.candidate.candidate_id);
  });

  test("different slug → different candidate_id (account-identity dedup)", () => {
    // ADR-0022 identity-is-canonical: for marketplace sellers the
    // account handle (slug) is the per-row identity carrier. Two
    // distinct slugs MUST yield two distinct candidate_ids even when
    // the display_name + city collide (two sellers trading under the
    // same name in the same city are two separate sellers).
    const a = projectMpSellerRow(
      row({ slug: "toko-nex-demo-a" }),
      fixedConfig(),
    );
    const b = projectMpSellerRow(
      row({ slug: "toko-nex-demo-b" }),
      fixedConfig(),
    );
    if (a.kind !== "ok" || b.kind !== "ok") throw new Error("expected ok");
    expect(a.candidate.candidate_id).not.toBe(b.candidate.candidate_id);
  });

  test("candidate_id carries the per-source prefix for easy grep", () => {
    const result = projectMpSellerRow(row(), fixedConfig());
    if (result.kind !== "ok") throw new Error("expected ok");
    expect(result.candidate.candidate_id.startsWith("cand-nex-mp-seller-")).toBe(
      true,
    );
  });
});

// ═════════════════════════════════════════════════════════════════════
// §5 · Projection · failure branches reject rather than fabricate
// ═════════════════════════════════════════════════════════════════════

describe("mp-seller · projection failures", () => {
  test("blank seller_id → projection_failed", () => {
    const r = projectMpSellerRow(
      row({ seller_id: "" }),
      fixedConfig(),
    );
    expect(r.kind).toBe("projection_failed");
  });

  test("blank slug → projection_failed", () => {
    const r = projectMpSellerRow(row({ slug: "   " }), fixedConfig());
    expect(r.kind).toBe("projection_failed");
    if (r.kind === "projection_failed") {
      expect(r.reason).toMatch(/slug/);
    }
  });

  test("blank display_name → projection_failed", () => {
    const r = projectMpSellerRow(row({ display_name: "" }), fixedConfig());
    expect(r.kind).toBe("projection_failed");
    if (r.kind === "projection_failed") {
      expect(r.reason).toMatch(/display_name/);
    }
  });

  test("unparseable jurisdiction → projection_failed · no fabricated country", () => {
    const r = projectMpSellerRow(
      row({ jurisdiction: "bogus" }),
      fixedConfig(),
    );
    expect(r.kind).toBe("projection_failed");
    if (r.kind === "projection_failed") {
      expect(r.reason).toMatch(/jurisdiction/);
    }
  });

  test("empty jurisdiction → projection_failed", () => {
    const r = projectMpSellerRow(
      row({ jurisdiction: "" }),
      fixedConfig(),
    );
    expect(r.kind).toBe("projection_failed");
  });
});

// ═════════════════════════════════════════════════════════════════════
// §6 · Adapter · keyset pagination over an in-memory session
// ═════════════════════════════════════════════════════════════════════

interface StubRow {
  readonly seller_id: string;
  readonly slug: string;
  readonly display_name: string;
  readonly city: string | null;
  readonly jurisdiction: string;
  readonly bio: string | null;
  readonly contact_ref: string | null;
  readonly discovered_from: string | null;
  readonly source: string | null;
  readonly source_reference: string | null;
}

function buildStubRows(n: number): readonly StubRow[] {
  const rows: StubRow[] = [];
  for (let i = 0; i < n; i++) {
    const suffix = String(i).padStart(12, "0");
    rows.push({
      seller_id: `00000000-0000-0000-0000-${suffix}`,
      slug: `seller-${i}`,
      display_name: `Seller ${i}`,
      city: "Yogyakarta",
      jurisdiction: "ID/DIY/Yogyakarta",
      bio: null,
      contact_ref: null,
      discovered_from: null,
      source: null,
      source_reference: null,
    });
  }
  return rows;
}

function stubFactory(all: readonly StubRow[]): {
  factory: ReadSessionFactory;
  closedCount: () => number;
} {
  let closed = 0;
  const factory: ReadSessionFactory = {
    openSession: async (): Promise<ReadSession> => ({
      id: "stub",
      query: async <T,>(
        sql: string,
        params: readonly unknown[],
      ): Promise<{ readonly rows: readonly T[]; readonly rowCount: number }> => {
        // Parse the LIMIT and WHERE clause out of the SQL to simulate
        // keyset pagination deterministically.
        const limit = Number(params[params.length - 1]);
        const after =
          params.length === 2 ? String(params[0]) : null;
        const slice = all
          .filter((r) => (after === null ? true : r.seller_id > after))
          .slice(0, limit);
        void sql;
        return {
          rows: slice as unknown as readonly T[],
          rowCount: slice.length,
        };
      },
    }),
    closeSession: async () => {
      closed++;
    },
  };
  return { factory, closedCount: () => closed };
}

describe("mp-seller · createLegacyMpSellerSource · keyset pagination", () => {
  test("declares the sealed source_id + source country", () => {
    const { factory } = stubFactory([]);
    const src = createLegacyMpSellerSource({
      session_factory: factory,
      config: fixedConfig({ batchSize: 10 }),
    });
    expect(src.source_id).toBe("nex_mp_seller_legacy");
    expect(src.country).toBe("ID");
  });

  test("first call with cursor=null returns a 'more' batch when more rows exist", async () => {
    const all = buildStubRows(5);
    const { factory, closedCount } = stubFactory(all);
    const src = createLegacyMpSellerSource({
      session_factory: factory,
      config: fixedConfig({ batchSize: 2 }),
    });
    const first = await src.discoverBatch(null);
    expect(first.kind).toBe("more");
    if (first.kind !== "more") return;
    expect(first.candidates).toHaveLength(2);
    expect(first.next_cursor).not.toBeNull();
    expect(closedCount()).toBe(1);
  });

  test("'exhausted' is returned when the batch is empty", async () => {
    const { factory } = stubFactory([]);
    const src = createLegacyMpSellerSource({
      session_factory: factory,
      config: fixedConfig({ batchSize: 2 }),
    });
    const result = await src.discoverBatch(null);
    expect(result.kind).toBe("exhausted");
  });

  test("cursor advances strictly · last call returns null next_cursor", async () => {
    const all = buildStubRows(3);
    const { factory } = stubFactory(all);
    const src = createLegacyMpSellerSource({
      session_factory: factory,
      config: fixedConfig({ batchSize: 2 }),
    });
    const first = await src.discoverBatch(null);
    if (first.kind !== "more") throw new Error("expected more");
    const second = await src.discoverBatch(first.next_cursor);
    expect(second.kind).toBe("more");
    if (second.kind !== "more") return;
    expect(second.candidates).toHaveLength(1);
    expect(second.next_cursor).toBeNull();
  });

  test("open-session failure maps to temporary_failure", async () => {
    const factory: ReadSessionFactory = {
      openSession: async () => {
        throw new Error("boom");
      },
      closeSession: async () => {},
    };
    const src = createLegacyMpSellerSource({
      session_factory: factory,
      config: fixedConfig({ batchSize: 2 }),
    });
    const result = await src.discoverBatch(null);
    expect(result.kind).toBe("temporary_failure");
  });

  test("non-code query error maps to permanent_failure", async () => {
    const factory: ReadSessionFactory = {
      openSession: async () => ({
        id: "stub",
        query: async () => {
          throw new Error("some non-transient pg error");
        },
      }),
      closeSession: async () => {},
    };
    const src = createLegacyMpSellerSource({
      session_factory: factory,
      config: fixedConfig({ batchSize: 2 }),
    });
    const result = await src.discoverBatch(null);
    expect(result.kind).toBe("permanent_failure");
  });

  test("transient pg code maps to temporary_failure", async () => {
    const transient = Object.assign(new Error("connection"), {
      code: "08006",
    });
    const factory: ReadSessionFactory = {
      openSession: async () => ({
        id: "stub",
        query: async () => {
          throw transient;
        },
      }),
      closeSession: async () => {},
    };
    const src = createLegacyMpSellerSource({
      session_factory: factory,
      config: fixedConfig({ batchSize: 2 }),
    });
    const result = await src.discoverBatch(null);
    expect(result.kind).toBe("temporary_failure");
  });
});
