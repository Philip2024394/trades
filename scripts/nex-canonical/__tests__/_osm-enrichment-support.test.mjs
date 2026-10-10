// scripts/nex-canonical/__tests__/_osm-enrichment-support.test.mjs
//
// Vitest for the pure helpers in _osm-enrichment-support.ts.
// Lives at the sweep-discovered path (scripts/**/*.test.mjs).
// Imports the TS module via tsx/cjs so no build step is required.

import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
require("tsx/cjs");

const {
  parseOsmRef,
  buildBatchOverpassQuery,
  MAX_REFS_PER_QUERY,
  extractEnrichmentFields,
  buildUpdateSql,
  buildEvidenceInsertSql,
  canonicaliseWebsitePure,
  normaliseToE164,
} = require("../_osm-enrichment-support.ts");

describe("parseOsmRef", () => {
  it("accepts node/way/relation with digit id", () => {
    expect(parseOsmRef("node/9797682461")).toEqual({ kind: "node", id: 9797682461 });
    expect(parseOsmRef("way/1234")).toEqual({ kind: "way", id: 1234 });
    expect(parseOsmRef("relation/5678")).toEqual({ kind: "relation", id: 5678 });
  });
  it("rejects malformed inputs", () => {
    expect(parseOsmRef(null)).toBeNull();
    expect(parseOsmRef("")).toBeNull();
    expect(parseOsmRef("node/abc")).toBeNull();
    expect(parseOsmRef("point/123")).toBeNull();
    expect(parseOsmRef("node/0")).toBeNull();
    expect(parseOsmRef("osm/node/123")).toBeNull();
    expect(parseOsmRef("node/-5")).toBeNull();
  });
});

describe("buildBatchOverpassQuery", () => {
  it("builds a single-kind query", () => {
    const q = buildBatchOverpassQuery([
      { kind: "node", id: 1 },
      { kind: "node", id: 2 },
    ]);
    expect(q).toBe("[out:json][timeout:60];(node(id:1,2););out tags;");
  });
  it("groups by kind", () => {
    const q = buildBatchOverpassQuery([
      { kind: "node", id: 1 },
      { kind: "way", id: 2 },
      { kind: "relation", id: 3 },
      { kind: "node", id: 4 },
    ]);
    expect(q).toBe(
      "[out:json][timeout:60];(node(id:1,4);way(id:2);relation(id:3););out tags;",
    );
  });
  it("handles exactly 50 refs", () => {
    const refs = Array.from({ length: 50 }, (_, i) => ({ kind: "node", id: i + 1 }));
    const q = buildBatchOverpassQuery(refs);
    expect(q.startsWith("[out:json][timeout:60];(node(id:1,2,")).toBe(true);
    expect(q.endsWith(");out tags;")).toBe(true);
  });
  it("handles exactly 100 refs (cap)", () => {
    const refs = Array.from({ length: MAX_REFS_PER_QUERY }, (_, i) => ({
      kind: "node",
      id: i + 1,
    }));
    const q = buildBatchOverpassQuery(refs);
    expect(q).toContain("node(id:1,");
    expect(q).toContain(`,${MAX_REFS_PER_QUERY}`);
  });
  it("rejects empty refs", () => {
    expect(() => buildBatchOverpassQuery([])).toThrow(/non-empty/);
  });
  it("rejects more than the cap", () => {
    const refs = Array.from({ length: MAX_REFS_PER_QUERY + 1 }, (_, i) => ({
      kind: "node",
      id: i + 1,
    }));
    expect(() => buildBatchOverpassQuery(refs)).toThrow(/cap/);
  });
});

describe("canonicaliseWebsitePure", () => {
  it("strips protocol / www / trailing slash", () => {
    expect(canonicaliseWebsitePure("https://www.Example.com/")).toBe("example.com");
  });
  it("rejects garbage", () => {
    expect(canonicaliseWebsitePure(null)).toBeNull();
    expect(canonicaliseWebsitePure("")).toBeNull();
    expect(canonicaliseWebsitePure("no-dot")).toBeNull();
    expect(canonicaliseWebsitePure("has space.com")).toBeNull();
  });
});

describe("normaliseToE164", () => {
  it("accepts well-formed numbers", () => {
    expect(normaliseToE164("+6281234567890")).toBe("+6281234567890");
    expect(normaliseToE164("+62 812-3456-7890")).toBe("+6281234567890");
    expect(normaliseToE164("+62 (812) 3456 7890")).toBe("+6281234567890");
  });
  it("rejects ambiguous / malformed", () => {
    expect(normaliseToE164(null)).toBeNull();
    expect(normaliseToE164("")).toBeNull();
    expect(normaliseToE164("081234567890")).toBeNull();
    expect(normaliseToE164("+62 812; +62 813")).toBeNull();
    expect(normaliseToE164("+62 812, +62 813")).toBeNull();
    expect(normaliseToE164("+0 12345678")).toBeNull();
    expect(normaliseToE164("+62 abc")).toBeNull();
  });
});

describe("extractEnrichmentFields", () => {
  const emptyExisting = {
    phone_e164: null,
    website_apex: null,
    address: null,
    services_products: null,
  };

  it("existing-non-null stays", () => {
    const r = extractEnrichmentFields(
      {
        website: "https://new.example.com",
        phone: "+6281234567890",
        "addr:street": "Jalan Baru",
      },
      {
        phone_e164: "+6281111111111",
        website_apex: "existing.example.com",
        address: { street: "Jalan Lama" },
        services_products: { cuisine: "indonesian" },
      },
    );
    expect(r.updates.phone_e164).toBeUndefined();
    expect(r.updates.website_apex).toBeUndefined();
    expect(r.updates.address).toBeUndefined();
    expect(r.updates.services_products).toBeUndefined();
    expect(r.evidence_fields_new).toEqual([]);
  });

  it("existing-null fills", () => {
    const r = extractEnrichmentFields(
      {
        website: "https://example.com",
        phone: "+6281234567890",
        "addr:street": "Jalan Baru",
        "addr:housenumber": "42",
        cuisine: "indonesian",
        opening_hours: "Mo-Su 09:00-22:00",
      },
      emptyExisting,
    );
    expect(r.updates.phone_e164).toBe("+6281234567890");
    expect(r.updates.website_apex).toBe("example.com");
    expect(r.updates.address).toEqual({ street: "Jalan Baru", housenumber: "42" });
    expect(r.updates.services_products).toBeDefined();
    expect(r.updates.services_products.cuisine).toBe("indonesian");
    expect(r.updates.services_products.opening_hours).toBe("Mo-Su 09:00-22:00");
    expect(r.updates.services_products.osm_tags_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(r.evidence_fields_new).toContain("phone_e164");
    expect(r.evidence_fields_new).toContain("website_apex");
    expect(r.evidence_fields_new).toContain("address");
    expect(r.evidence_fields_new).toContain("services_products");
  });

  it("all-null OSM produces no updates", () => {
    const r = extractEnrichmentFields({ name: "Only name" }, emptyExisting);
    expect(r.updates).toEqual({});
    expect(r.evidence_fields_new).toEqual([]);
  });

  it("services_products merges without overwriting existing keys", () => {
    const r = extractEnrichmentFields(
      { cuisine: "new", opening_hours: "Mo-Fr 09:00-17:00", wikidata: "Q42" },
      {
        phone_e164: null,
        website_apex: null,
        address: null,
        services_products: { cuisine: "existing" },
      },
    );
    expect(r.updates.services_products).toBeDefined();
    const sp = r.updates.services_products;
    expect(sp.cuisine).toBe("existing");
    expect(sp.opening_hours).toBe("Mo-Fr 09:00-17:00");
    expect(sp.wikidata).toBe("Q42");
  });

  it("skips unnormalisable phones (never fabricates)", () => {
    const r = extractEnrichmentFields({ phone: "081234567890" }, emptyExisting);
    expect(r.updates.phone_e164).toBeUndefined();
    expect(r.evidence_fields_new).not.toContain("phone_e164");
  });
});

describe("buildUpdateSql", () => {
  it("returns null when no fields changed", () => {
    expect(buildUpdateSql({}, "00000000-0000-0000-0000-000000000000")).toBeNull();
  });

  it("parameterises with placeholders and appends verified_at when ≥1 field", () => {
    const built = buildUpdateSql(
      { phone_e164: "+6281234567890", website_apex: "example.com" },
      "00000000-0000-0000-0000-000000000001",
    );
    expect(built).not.toBeNull();
    expect(built.sql).toContain("phone_e164 = $1");
    expect(built.sql).toContain("website_apex = $2");
    expect(built.sql).toContain("updated_at = now()");
    expect(built.sql).toContain("last_verified_at = now()");
    expect(built.sql).toContain("WHERE canonical_business_id = $3");
    expect(built.params).toEqual([
      "+6281234567890",
      "example.com",
      "00000000-0000-0000-0000-000000000001",
    ]);
  });

  it("serialises jsonb payloads", () => {
    const built = buildUpdateSql(
      { address: { street: "x" }, services_products: { cuisine: "y" } },
      "00000000-0000-0000-0000-000000000002",
    );
    expect(built.sql).toContain("address = $1::jsonb");
    expect(built.sql).toContain("services_products = $2::jsonb");
    expect(built.params[0]).toBe('{"street":"x"}');
    expect(built.params[1]).toBe('{"cuisine":"y"}');
  });
});

describe("buildEvidenceInsertSql", () => {
  it("builds a deterministic parameterised INSERT with the sealed source family", () => {
    const built = buildEvidenceInsertSql({
      canonical_business_id: "00000000-0000-0000-0000-000000000001",
      osm_ref: "node/123",
      fields_new: ["phone_e164"],
      run_id: "run-abc",
      founder_id: "philip",
      observation_generated_at: "2026-10-09T00:00:00.000Z",
    });
    expect(built.sql).toContain("INSERT INTO nex.business_evidence");
    expect(built.sql).toContain("'evidence-v1'");
    expect(built.sql).toContain("'nex.food_business'");
    expect(built.sql).toContain("'MATCH'");
    expect(built.sql).toContain("'canonical-osm-enrichment-v1'");
    expect(built.sql).toContain("'nex_food_business_legacy'");
    expect(built.params).toHaveLength(9);
    expect(built.params[0]).toBe("00000000-0000-0000-0000-000000000001");
    expect(String(built.params[1]).startsWith("cand-osm-enrich-")).toBe(true);
    for (const idx of [2, 3, 4]) {
      expect(/^[a-f0-9]{64}$/.test(String(built.params[idx]))).toBe(true);
    }
    expect(built.params[5]).toBe("node/123");
    expect(built.params[6]).toBe("run-abc");
    expect(built.params[7]).toBe("2026-10-09T00:00:00.000Z");
    expect(built.params[8]).toBe("philip");
  });

  it("is deterministic across calls (same inputs → same hashes)", () => {
    const a = buildEvidenceInsertSql({
      canonical_business_id: "00000000-0000-0000-0000-000000000001",
      osm_ref: "node/123",
      fields_new: ["phone_e164"],
      run_id: "run-abc",
      founder_id: "philip",
      observation_generated_at: "2026-10-09T00:00:00.000Z",
    });
    const b = buildEvidenceInsertSql({
      canonical_business_id: "00000000-0000-0000-0000-000000000001",
      osm_ref: "node/123",
      fields_new: ["phone_e164"],
      run_id: "run-abc",
      founder_id: "philip",
      observation_generated_at: "2026-10-09T00:00:00.000Z",
    });
    expect(a.params).toEqual(b.params);
  });
});
