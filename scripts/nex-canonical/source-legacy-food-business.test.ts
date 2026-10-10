// scripts/nex-canonical/source-legacy-food-business.test.ts
//
// Pure unit tests for the sealed nex.food_business adapter. No DB, no
// network, no pg Client. Exercises the exported pure projection
// function `projectFoodBusinessRow` only.
//
// -------------------------------------------------------------------
// CURRENT FIELD-COVERAGE DOCUMENTATION (per adapter at commit of this
// test file · verified against deploy/postgres/init/054_nex_food_business_schema.sql)
// -------------------------------------------------------------------
//
// SOURCE COLUMN                     → CANDIDATE SLOT
//   internal_id (uuid PK)           → legacy_source.internal_id
//   public_listing_ref (text UNIQUE)→ legacy_source.ref
//                                   + candidate_id = cand-nex-food-<sha256_16>(
//                                       "nex.food_business|" + public_listing_ref)
//   business_name (text NOT NULL)   → identity.name_canonical (trimmed)
//   category (text)                 → NOT projected (no slot in sealed Candidate)
//   address (text)                  → identity.address.line1 (trimmed) · address
//                                     object is null when source is blank/null
//   city (text NOT NULL)            → identity.city (trimmed; null when blank)
//   district (text)                 → identity.district (trimmed; null when blank)
//   coordinates_lng (numeric)       → identity.coordinates.lng · parsed defensively
//                                     from string|number; null outside [-180,180]
//   coordinates_lat (numeric)       → identity.coordinates.lat · parsed defensively
//                                     from string|number; null outside [-90,90]
//   phone (text)                    → identity.phone_e164 · pass-through only when
//                                     already /^\+[1-9][0-9]{6,14}$/; else null
//                                     (NO normalisation · do-not-invent)
//   website (text)                  → identity.website_apex · URL.host with
//                                     leading www. stripped, lowercased; null on
//                                     parse failure
//   source (text NOT NULL)          → caveats[0] (echoed verbatim)
//   source_reference (text)         → caveats[0] (echoed verbatim)
//   street_line (text)              → identity.street_line (trimmed; null when
//                                     blank) · verbatim pass-through
//   neighbourhood (text)            → identity.neighbourhood (trimmed; null when
//                                     blank) · verbatim pass-through
//   country (text NOT NULL)         → candidate.country · trimmed source value;
//                                     falls back to LEGACY_FOOD_COUNTRY ("ID")
//                                     only when source is blank/null (defensive)
//
// Fields NOT currently projected (by design of sealed Candidate shape):
//   whatsapp_number    · explicitly excluded per 054 doctrine ("NOT identity")
//   public_social_links· no slot in sealed Candidate
//   opening_information· no slot in sealed Candidate
//   rating             · no slot in sealed Candidate
//   review_count       · no slot in sealed Candidate
//   hero_image_url etc.· no slot in sealed Candidate
//   source_ingested_at · surfaced via caveat text instead
//
// Noted but intentionally NOT changed in this wave (idempotency guard):
//   · identity.osm_id COULD be derived from source_reference when
//     source='osm_overpass' (shape 'node/12345'). Not performed in the
//     current adapter · changing this would alter already-ingested rows.
//     Tests here verify the current contract (osm_id stays null).
//   · identity.wikidata_qid stays null · no source column exists in
//     nex.food_business to populate it.
//
// Static invariants verified by this test file:
//   1 · Every mapped field uses the exact source column (no fabrication)
//   2 · candidate_id is deterministic across repeated runs
//   3 · country stamping prefers source value, falls back to "ID"
//   4 · E.164 phone validation is strict /^\+[1-9][0-9]{6,14}$/
//   5 · website canonicalisation strips protocol/www/trailing-slash
//   6 · rows with blank name_canonical are REJECTED (projection_failed)
//   7 · entity_type is always "food" · never anything else
//   8 · generation_source carries the injected run id + nowIso()
//
// Shape note: `RawFoodRow` is intentionally non-exported in the adapter.
// Tests pass a structurally-equivalent object via a locally-mirrored
// type · if the adapter later tightens the shape, these tests should
// update in lockstep (no mock trickery, no `any`).

import { describe, expect, test } from "vitest";
import {
  LEGACY_FOOD_COUNTRY,
  LEGACY_FOOD_ENTITY_TYPE,
  LEGACY_FOOD_SOURCE_ID,
  projectFoodBusinessRow,
  type LegacyFoodSourceConfig,
} from "./source-legacy-food-business";

// ─────────────────────────────────────────────────────────────────────
// Local mirror of the non-exported RawFoodRow shape · must stay in
// lockstep with source-legacy-food-business.ts §2.
// ─────────────────────────────────────────────────────────────────────

interface TestRawFoodRow {
  readonly internal_id: string;
  readonly public_listing_ref: string;
  readonly business_name: string;
  readonly category: string | null;
  readonly address: string | null;
  readonly city: string | null;
  readonly district: string | null;
  readonly coordinates_lng: string | number | null;
  readonly coordinates_lat: string | number | null;
  readonly phone: string | null;
  readonly website: string | null;
  readonly source: string | null;
  readonly source_reference: string | null;
  readonly street_line: string | null;
  readonly neighbourhood: string | null;
  readonly country: string | null;
}

type ProjectRow = Parameters<typeof projectFoodBusinessRow>[0];

function asRow(row: TestRawFoodRow): ProjectRow {
  return row as unknown as ProjectRow;
}

function makeConfig(
  overrides: Partial<LegacyFoodSourceConfig> = {},
): LegacyFoodSourceConfig {
  return {
    generationRunId: "test-run-fixed-2026-10-09",
    nowIso: () => "2026-10-09T00:00:00.000Z",
    ...overrides,
  };
}

function makeMinimalRow(
  overrides: Partial<TestRawFoodRow> = {},
): TestRawFoodRow {
  return {
    internal_id: "11111111-2222-3333-4444-555555555555",
    public_listing_ref: "#FL-2026-ABCDE",
    business_name: "Warung Bu Siti",
    category: "restaurant",
    address: "Jl. Malioboro 10",
    city: "Yogyakarta",
    district: "Gondomanan",
    coordinates_lng: 110.3671,
    coordinates_lat: -7.8014,
    phone: "+6281234567890",
    website: "https://www.warungsiti.id/",
    source: "yogyakarta_open_data_2024",
    source_reference: "permit-9001",
    street_line: "Jl. Malioboro 10",
    neighbourhood: "Ngupasan",
    country: "ID",
    ...overrides,
  };
}

// ═════════════════════════════════════════════════════════════════════
// §1 · Exported constants
// ═════════════════════════════════════════════════════════════════════

describe("source-legacy-food-business · sealed constants", () => {
  test("LEGACY_FOOD_SOURCE_ID is the exact sealed value", () => {
    expect(LEGACY_FOOD_SOURCE_ID).toBe("nex_food_business_legacy");
  });
  test("LEGACY_FOOD_COUNTRY defaults to ID (defensive fallback)", () => {
    expect(LEGACY_FOOD_COUNTRY).toBe("ID");
  });
  test("LEGACY_FOOD_ENTITY_TYPE is sealed as 'food'", () => {
    expect(LEGACY_FOOD_ENTITY_TYPE).toBe("food");
  });
});

// ═════════════════════════════════════════════════════════════════════
// §2 · Happy path · every mapped field uses the exact source column
// ═════════════════════════════════════════════════════════════════════

describe("projectFoodBusinessRow · no-fabrication field mapping", () => {
  test("maps every column to its sealed Candidate slot verbatim", () => {
    const row = makeMinimalRow();
    const result = projectFoodBusinessRow(asRow(row), makeConfig());
    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") return;
    const c = result.candidate;

    // Identity slots mirror the source columns exactly
    expect(c.identity.name_canonical).toBe(row.business_name);
    expect(c.identity.city).toBe(row.city);
    expect(c.identity.district).toBe(row.district);
    expect(c.identity.street_line).toBe(row.street_line);
    expect(c.identity.neighbourhood).toBe(row.neighbourhood);
    expect(c.identity.coordinates).toEqual({
      lat: row.coordinates_lat,
      lng: row.coordinates_lng,
    });

    // Legacy-source block preserves identifiers verbatim
    expect(c.legacy_source).toEqual({
      table: "nex.food_business",
      ref: row.public_listing_ref,
      internal_id: row.internal_id,
    });

    // Country prefers the source column (not the fallback constant)
    expect(c.country).toBe(row.country);

    // Entity type is sealed as "food"
    expect(c.entity_type).toBe("food");

    // Status is the sealed single-value union
    expect(c.status).toBe("pending_founder_review");

    // Generation source carries the injected test config exactly
    expect(c.generation_source).toEqual({
      generator: "scripts/nex-canonical/generate-candidates.ts",
      generated_at: "2026-10-09T00:00:00.000Z",
      generation_run_id: "test-run-fixed-2026-10-09",
    });

    // No fabricated identity signals · osm_id / wikidata_qid stay null
    // because nex.food_business has no column for either (per 054).
    expect(c.identity.osm_id).toBeNull();
    expect(c.identity.wikidata_qid).toBeNull();

    // No aliases are invented · business_name is the single name source
    expect(c.identity.aliases).toEqual([]);

    // Address object preserves line1 verbatim, postal_code stays null
    // (no postal-code column exists in nex.food_business per 054).
    expect(c.identity.address).toEqual({
      line1: row.address,
      postal_code: null,
    });
  });

  test("caveats echo source + source_reference verbatim · no editorial", () => {
    const row = makeMinimalRow({
      source: "yogyakarta_open_data_2024",
      source_reference: "permit-9001",
    });
    const result = projectFoodBusinessRow(asRow(row), makeConfig());
    if (result.kind !== "ok") throw new Error("expected ok");
    expect(result.candidate.caveats).toHaveLength(1);
    expect(result.candidate.caveats[0]).toContain(
      'source="yogyakarta_open_data_2024"',
    );
    expect(result.candidate.caveats[0]).toContain(
      'source_reference="permit-9001"',
    );
  });

  test("caveats render missing source/source_reference as 'unknown'/'n/a'", () => {
    const row = makeMinimalRow({ source: null, source_reference: null });
    const result = projectFoodBusinessRow(asRow(row), makeConfig());
    if (result.kind !== "ok") throw new Error("expected ok");
    expect(result.candidate.caveats[0]).toContain('source="unknown"');
    expect(result.candidate.caveats[0]).toContain('source_reference="n/a"');
  });
});

// ═════════════════════════════════════════════════════════════════════
// §3 · candidate_id determinism
// ═════════════════════════════════════════════════════════════════════

describe("projectFoodBusinessRow · candidate_id determinism", () => {
  test("same public_listing_ref → identical candidate_id across runs", () => {
    const row = makeMinimalRow({ public_listing_ref: "#FL-2026-DETERM" });
    const a = projectFoodBusinessRow(asRow(row), makeConfig());
    const b = projectFoodBusinessRow(asRow(row), makeConfig());
    if (a.kind !== "ok" || b.kind !== "ok") throw new Error("expected ok");
    expect(a.candidate.candidate_id).toBe(b.candidate.candidate_id);
    // Deterministic shape · 16-hex-char sha256 prefix
    expect(a.candidate.candidate_id).toMatch(
      /^cand-nex-food-[0-9a-f]{16}$/,
    );
  });

  test("different public_listing_ref → different candidate_id", () => {
    const a = projectFoodBusinessRow(
      asRow(makeMinimalRow({ public_listing_ref: "#FL-2026-AAAAA" })),
      makeConfig(),
    );
    const b = projectFoodBusinessRow(
      asRow(makeMinimalRow({ public_listing_ref: "#FL-2026-BBBBB" })),
      makeConfig(),
    );
    if (a.kind !== "ok" || b.kind !== "ok") throw new Error("expected ok");
    expect(a.candidate.candidate_id).not.toBe(b.candidate.candidate_id);
  });

  test("candidate_id is independent of other row fields · identity only", () => {
    // Change nothing but non-identity fields · id must stay stable.
    const base = makeMinimalRow({ public_listing_ref: "#FL-2026-STABLE" });
    const a = projectFoodBusinessRow(asRow(base), makeConfig());
    const b = projectFoodBusinessRow(
      asRow({
        ...base,
        business_name: "Totally Different Name",
        phone: null,
        website: null,
      }),
      makeConfig(),
    );
    if (a.kind !== "ok" || b.kind !== "ok") throw new Error("expected ok");
    expect(a.candidate.candidate_id).toBe(b.candidate.candidate_id);
  });
});

// ═════════════════════════════════════════════════════════════════════
// §4 · Country stamping
// ═════════════════════════════════════════════════════════════════════

describe("projectFoodBusinessRow · country stamping", () => {
  test("source country 'ID' is preserved verbatim", () => {
    const result = projectFoodBusinessRow(
      asRow(makeMinimalRow({ country: "ID" })),
      makeConfig(),
    );
    if (result.kind !== "ok") throw new Error("expected ok");
    expect(result.candidate.country).toBe("ID");
  });

  test("source country trimmed before use", () => {
    const result = projectFoodBusinessRow(
      asRow(makeMinimalRow({ country: "  ID  " })),
      makeConfig(),
    );
    if (result.kind !== "ok") throw new Error("expected ok");
    expect(result.candidate.country).toBe("ID");
  });

  test("non-ID source country is preserved · adapter does not force ID", () => {
    const result = projectFoodBusinessRow(
      asRow(makeMinimalRow({ country: "MY" })),
      makeConfig(),
    );
    if (result.kind !== "ok") throw new Error("expected ok");
    // Behaviour note: today nex.food_business is Indonesia-scoped by
    // its own CHECK/default; the adapter still honours whatever the
    // source carries. Defensive fallback only triggers on blank/null.
    expect(result.candidate.country).toBe("MY");
  });

  test("blank source country falls back to LEGACY_FOOD_COUNTRY", () => {
    const result = projectFoodBusinessRow(
      asRow(makeMinimalRow({ country: "   " })),
      makeConfig(),
    );
    if (result.kind !== "ok") throw new Error("expected ok");
    expect(result.candidate.country).toBe(LEGACY_FOOD_COUNTRY);
  });

  test("null source country falls back to LEGACY_FOOD_COUNTRY", () => {
    const result = projectFoodBusinessRow(
      asRow(makeMinimalRow({ country: null })),
      makeConfig(),
    );
    if (result.kind !== "ok") throw new Error("expected ok");
    expect(result.candidate.country).toBe(LEGACY_FOOD_COUNTRY);
  });
});

// ═════════════════════════════════════════════════════════════════════
// §5 · E.164 phone validation · strict pass-through, no normalisation
// ═════════════════════════════════════════════════════════════════════

describe("projectFoodBusinessRow · phone_e164 validation", () => {
  test("accepts canonical +62 Indonesia E.164", () => {
    const result = projectFoodBusinessRow(
      asRow(makeMinimalRow({ phone: "+6281234567890" })),
      makeConfig(),
    );
    if (result.kind !== "ok") throw new Error("expected ok");
    expect(result.candidate.identity.phone_e164).toBe("+6281234567890");
  });

  test("accepts minimum-length E.164 (+ + 7 digits)", () => {
    const result = projectFoodBusinessRow(
      asRow(makeMinimalRow({ phone: "+1234567" })),
      makeConfig(),
    );
    if (result.kind !== "ok") throw new Error("expected ok");
    expect(result.candidate.identity.phone_e164).toBe("+1234567");
  });

  test("accepts maximum-length E.164 (+ + 15 digits)", () => {
    const result = projectFoodBusinessRow(
      asRow(makeMinimalRow({ phone: "+123456789012345" })),
      makeConfig(),
    );
    if (result.kind !== "ok") throw new Error("expected ok");
    expect(result.candidate.identity.phone_e164).toBe("+123456789012345");
  });

  test("rejects bare-digit (no +) · do-not-invent · phone_e164 stays null", () => {
    const result = projectFoodBusinessRow(
      asRow(makeMinimalRow({ phone: "6281234567890" })),
      makeConfig(),
    );
    if (result.kind !== "ok") throw new Error("expected ok");
    expect(result.candidate.identity.phone_e164).toBeNull();
  });

  test("rejects leading-zero country code (+0...)", () => {
    const result = projectFoodBusinessRow(
      asRow(makeMinimalRow({ phone: "+0812345678" })),
      makeConfig(),
    );
    if (result.kind !== "ok") throw new Error("expected ok");
    expect(result.candidate.identity.phone_e164).toBeNull();
  });

  test("rejects shorter-than-minimum (+ + 6 digits)", () => {
    const result = projectFoodBusinessRow(
      asRow(makeMinimalRow({ phone: "+123456" })),
      makeConfig(),
    );
    if (result.kind !== "ok") throw new Error("expected ok");
    expect(result.candidate.identity.phone_e164).toBeNull();
  });

  test("rejects longer-than-maximum (+ + 16 digits)", () => {
    const result = projectFoodBusinessRow(
      asRow(makeMinimalRow({ phone: "+1234567890123456" })),
      makeConfig(),
    );
    if (result.kind !== "ok") throw new Error("expected ok");
    expect(result.candidate.identity.phone_e164).toBeNull();
  });

  test("rejects embedded whitespace / punctuation (no normalisation)", () => {
    const result = projectFoodBusinessRow(
      asRow(makeMinimalRow({ phone: "+62 812 3456 7890" })),
      makeConfig(),
    );
    if (result.kind !== "ok") throw new Error("expected ok");
    // The adapter deliberately refuses to strip spaces · do-not-invent
    expect(result.candidate.identity.phone_e164).toBeNull();
  });

  test("null phone → phone_e164 is null", () => {
    const result = projectFoodBusinessRow(
      asRow(makeMinimalRow({ phone: null })),
      makeConfig(),
    );
    if (result.kind !== "ok") throw new Error("expected ok");
    expect(result.candidate.identity.phone_e164).toBeNull();
  });

  test("every accepted phone matches /^\\+[1-9][0-9]{6,14}$/", () => {
    // Regression guard: whatever the adapter accepts MUST match the
    // sealed candidate-validator regex.
    const acceptable = [
      "+6281234567890",
      "+1234567",
      "+123456789012345",
      "+447911123456",
    ];
    const E164 = /^\+[1-9][0-9]{6,14}$/;
    for (const phone of acceptable) {
      const result = projectFoodBusinessRow(
        asRow(makeMinimalRow({ phone })),
        makeConfig(),
      );
      if (result.kind !== "ok") throw new Error("expected ok");
      const projected = result.candidate.identity.phone_e164;
      expect(projected).not.toBeNull();
      expect(E164.test(projected!)).toBe(true);
    }
  });
});

// ═════════════════════════════════════════════════════════════════════
// §6 · Website canonicalisation
// ═════════════════════════════════════════════════════════════════════

describe("projectFoodBusinessRow · website_apex canonicalisation", () => {
  test("strips https:// protocol", () => {
    const result = projectFoodBusinessRow(
      asRow(makeMinimalRow({ website: "https://example.com" })),
      makeConfig(),
    );
    if (result.kind !== "ok") throw new Error("expected ok");
    expect(result.candidate.identity.website_apex).toBe("example.com");
  });

  test("strips http:// protocol", () => {
    const result = projectFoodBusinessRow(
      asRow(makeMinimalRow({ website: "http://example.com" })),
      makeConfig(),
    );
    if (result.kind !== "ok") throw new Error("expected ok");
    expect(result.candidate.identity.website_apex).toBe("example.com");
  });

  test("strips leading www.", () => {
    const result = projectFoodBusinessRow(
      asRow(makeMinimalRow({ website: "https://www.example.com" })),
      makeConfig(),
    );
    if (result.kind !== "ok") throw new Error("expected ok");
    expect(result.candidate.identity.website_apex).toBe("example.com");
  });

  test("strips trailing slash via URL parser", () => {
    const result = projectFoodBusinessRow(
      asRow(makeMinimalRow({ website: "https://www.example.com/" })),
      makeConfig(),
    );
    if (result.kind !== "ok") throw new Error("expected ok");
    expect(result.candidate.identity.website_apex).toBe("example.com");
  });

  test("accepts protocol-less input and infers https://", () => {
    const result = projectFoodBusinessRow(
      asRow(makeMinimalRow({ website: "www.example.com" })),
      makeConfig(),
    );
    if (result.kind !== "ok") throw new Error("expected ok");
    expect(result.candidate.identity.website_apex).toBe("example.com");
  });

  test("lowercases host", () => {
    const result = projectFoodBusinessRow(
      asRow(makeMinimalRow({ website: "https://WWW.Example.COM" })),
      makeConfig(),
    );
    if (result.kind !== "ok") throw new Error("expected ok");
    expect(result.candidate.identity.website_apex).toBe("example.com");
  });

  test("preserves subdomains other than www", () => {
    const result = projectFoodBusinessRow(
      asRow(makeMinimalRow({ website: "https://shop.example.com" })),
      makeConfig(),
    );
    if (result.kind !== "ok") throw new Error("expected ok");
    expect(result.candidate.identity.website_apex).toBe("shop.example.com");
  });

  test("drops query/fragment · apex is host only", () => {
    const result = projectFoodBusinessRow(
      asRow(makeMinimalRow({ website: "https://example.com/menu?x=1#top" })),
      makeConfig(),
    );
    if (result.kind !== "ok") throw new Error("expected ok");
    expect(result.candidate.identity.website_apex).toBe("example.com");
  });

  test("unparseable website → website_apex is null (no fabrication)", () => {
    const result = projectFoodBusinessRow(
      asRow(makeMinimalRow({ website: "not a url at all" })),
      makeConfig(),
    );
    if (result.kind !== "ok") throw new Error("expected ok");
    expect(result.candidate.identity.website_apex).toBeNull();
  });

  test("null website → website_apex is null", () => {
    const result = projectFoodBusinessRow(
      asRow(makeMinimalRow({ website: null })),
      makeConfig(),
    );
    if (result.kind !== "ok") throw new Error("expected ok");
    expect(result.candidate.identity.website_apex).toBeNull();
  });
});

// ═════════════════════════════════════════════════════════════════════
// §7 · Fabrication guards · reject rows with missing identity signals
// ═════════════════════════════════════════════════════════════════════

describe("projectFoodBusinessRow · fabrication guards", () => {
  test("rejects row with blank business_name", () => {
    const result = projectFoodBusinessRow(
      asRow(makeMinimalRow({ business_name: "" })),
      makeConfig(),
    );
    expect(result.kind).toBe("projection_failed");
    if (result.kind !== "projection_failed") return;
    expect(result.reason).toContain("business_name");
  });

  test("rejects row with whitespace-only business_name", () => {
    const result = projectFoodBusinessRow(
      asRow(makeMinimalRow({ business_name: "   \t  " })),
      makeConfig(),
    );
    expect(result.kind).toBe("projection_failed");
  });

  test("rejects row with blank public_listing_ref", () => {
    const result = projectFoodBusinessRow(
      asRow(makeMinimalRow({ public_listing_ref: "" })),
      makeConfig(),
    );
    expect(result.kind).toBe("projection_failed");
    if (result.kind !== "projection_failed") return;
    expect(result.reason).toContain("public_listing_ref");
  });

  test("rejects row with missing internal_id", () => {
    // internal_id is the PK · must be present
    const result = projectFoodBusinessRow(
      asRow(makeMinimalRow({ internal_id: "" })),
      makeConfig(),
    );
    expect(result.kind).toBe("projection_failed");
    if (result.kind !== "projection_failed") return;
    expect(result.reason).toContain("internal_id");
  });

  test("name_canonical is TRIMMED but otherwise verbatim · no editorial", () => {
    const result = projectFoodBusinessRow(
      asRow(makeMinimalRow({ business_name: "  Warung Bu Siti  " })),
      makeConfig(),
    );
    if (result.kind !== "ok") throw new Error("expected ok");
    expect(result.candidate.identity.name_canonical).toBe("Warung Bu Siti");
  });

  test("name_canonical is NEVER an empty string on an ok projection", () => {
    const result = projectFoodBusinessRow(
      asRow(makeMinimalRow()),
      makeConfig(),
    );
    if (result.kind !== "ok") throw new Error("expected ok");
    expect(result.candidate.identity.name_canonical.length).toBeGreaterThan(0);
  });
});

// ═════════════════════════════════════════════════════════════════════
// §8 · Coordinate parsing · defensive, no fabrication
// ═════════════════════════════════════════════════════════════════════

describe("projectFoodBusinessRow · coordinate parsing", () => {
  test("parses numeric lat/lng pass-through", () => {
    const result = projectFoodBusinessRow(
      asRow(makeMinimalRow({ coordinates_lat: -7.8, coordinates_lng: 110.4 })),
      makeConfig(),
    );
    if (result.kind !== "ok") throw new Error("expected ok");
    expect(result.candidate.identity.coordinates).toEqual({
      lat: -7.8,
      lng: 110.4,
    });
  });

  test("parses pg-string lat/lng (numeric columns return strings)", () => {
    const result = projectFoodBusinessRow(
      asRow(
        makeMinimalRow({
          coordinates_lat: "-7.801400",
          coordinates_lng: "110.367100",
        }),
      ),
      makeConfig(),
    );
    if (result.kind !== "ok") throw new Error("expected ok");
    expect(result.candidate.identity.coordinates).toEqual({
      lat: -7.8014,
      lng: 110.3671,
    });
  });

  test("one coordinate null → whole coordinates object is null", () => {
    const result = projectFoodBusinessRow(
      asRow(makeMinimalRow({ coordinates_lat: null })),
      makeConfig(),
    );
    if (result.kind !== "ok") throw new Error("expected ok");
    expect(result.candidate.identity.coordinates).toBeNull();
  });

  test("out-of-range lat (>90) → coordinates null", () => {
    const result = projectFoodBusinessRow(
      asRow(makeMinimalRow({ coordinates_lat: 95, coordinates_lng: 110 })),
      makeConfig(),
    );
    if (result.kind !== "ok") throw new Error("expected ok");
    expect(result.candidate.identity.coordinates).toBeNull();
  });

  test("out-of-range lng (>180) → coordinates null", () => {
    const result = projectFoodBusinessRow(
      asRow(makeMinimalRow({ coordinates_lat: 0, coordinates_lng: 999 })),
      makeConfig(),
    );
    if (result.kind !== "ok") throw new Error("expected ok");
    expect(result.candidate.identity.coordinates).toBeNull();
  });

  test("non-numeric string coordinate → coordinates null", () => {
    const result = projectFoodBusinessRow(
      asRow(makeMinimalRow({ coordinates_lat: "not-a-number" })),
      makeConfig(),
    );
    if (result.kind !== "ok") throw new Error("expected ok");
    expect(result.candidate.identity.coordinates).toBeNull();
  });
});

// ═════════════════════════════════════════════════════════════════════
// §9 · Address JSONB shape · sealed { line1, postal_code } | null
// ═════════════════════════════════════════════════════════════════════

describe("projectFoodBusinessRow · address jsonb shape", () => {
  test("address string → { line1: trimmed, postal_code: null }", () => {
    const result = projectFoodBusinessRow(
      asRow(makeMinimalRow({ address: "  Jl. Malioboro 10  " })),
      makeConfig(),
    );
    if (result.kind !== "ok") throw new Error("expected ok");
    expect(result.candidate.identity.address).toEqual({
      line1: "Jl. Malioboro 10",
      postal_code: null,
    });
  });

  test("null address → whole address object is null (honest absence)", () => {
    const result = projectFoodBusinessRow(
      asRow(makeMinimalRow({ address: null })),
      makeConfig(),
    );
    if (result.kind !== "ok") throw new Error("expected ok");
    expect(result.candidate.identity.address).toBeNull();
  });

  test("whitespace-only address → whole address object is null", () => {
    const result = projectFoodBusinessRow(
      asRow(makeMinimalRow({ address: "   " })),
      makeConfig(),
    );
    if (result.kind !== "ok") throw new Error("expected ok");
    expect(result.candidate.identity.address).toBeNull();
  });

  test("postal_code is ALWAYS null · no postal column in nex.food_business", () => {
    // Regression guard: if someone later adds a fabricated postal
    // extractor, this test will fail · the sealed 054 schema has no
    // postal-code column, so projecting one would be fabrication.
    const result = projectFoodBusinessRow(
      asRow(makeMinimalRow({ address: "Jl. Malioboro 10, 55271" })),
      makeConfig(),
    );
    if (result.kind !== "ok") throw new Error("expected ok");
    expect(result.candidate.identity.address?.postal_code).toBeNull();
  });
});

// ═════════════════════════════════════════════════════════════════════
// §10 · Idempotency guard · repeated projection produces identical output
// ═════════════════════════════════════════════════════════════════════

describe("projectFoodBusinessRow · idempotency", () => {
  test("same (row, config) → structurally identical candidate", () => {
    const row = makeMinimalRow();
    const cfg = makeConfig();
    const a = projectFoodBusinessRow(asRow(row), cfg);
    const b = projectFoodBusinessRow(asRow(row), cfg);
    if (a.kind !== "ok" || b.kind !== "ok") throw new Error("expected ok");
    // Deep-equality is the strongest idempotency contract we can test
    // in isolation of the writer path.
    expect(a.candidate).toEqual(b.candidate);
  });
});
