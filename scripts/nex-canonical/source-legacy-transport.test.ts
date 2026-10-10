// scripts/nex-canonical/source-legacy-transport.test.ts
//
// Pure projection tests for the sealed transport legacy source adapter.
// No DB. No network. All inputs are hand-built RawTransportRow fixtures.

import { describe, expect, test } from "vitest";
import {
  LEGACY_TRANSPORT_SOURCE_ID,
  LEGACY_TRANSPORT_COUNTRY,
  PROVIDER_KINDS_NATURAL_PERSON,
  PROVIDER_KINDS_LEGAL_ENTITY,
  PROVIDER_KINDS_QUARANTINED,
  routeProviderKindToEntityType,
  projectTransportRow,
  type LegacyTransportSourceConfig,
} from "./source-legacy-transport";

// Shared config factory · nowIso is frozen so determinism is testable.
function cfg(): LegacyTransportSourceConfig {
  return {
    generationRunId: "test-run-id",
    nowIso: () => "2026-10-09T00:00:00.000Z",
  };
}

// Minimal valid row builder · callers override just the fields they
// care about.
type RawTransportRow = Parameters<typeof projectTransportRow>[0];
function row(partial: Partial<RawTransportRow> = {}): RawTransportRow {
  return {
    provider_id: "00000000-0000-0000-0000-000000000001",
    provider_kind: "transport_business",
    business_name: "Jas Taxi",
    contact_person_name: null,
    canonical_phone_e164: null,
    website: null,
    home_jurisdiction: "ID/DIY/Yogyakarta",
    city: "Kasihan",
    province: null,
    discovery_stage: "discovered",
    ...partial,
  };
}

// ═════════════════════════════════════════════════════════════════════
// §1 · Static invariants · identifiers and provider-kind sets
// ═════════════════════════════════════════════════════════════════════

describe("source-legacy-transport · literals", () => {
  test("source_id slug is sealed", () => {
    expect(LEGACY_TRANSPORT_SOURCE_ID).toBe("nex_transport_acquisition_legacy");
  });

  test("fallback country is ID (sealed first-wave scope)", () => {
    expect(LEGACY_TRANSPORT_COUNTRY).toBe("ID");
  });

  test("natural-person provider_kind set matches migration 091 driver model", () => {
    expect([...PROVIDER_KINDS_NATURAL_PERSON].sort()).toEqual(
      ["driver_operator", "individual_driver"].sort(),
    );
  });

  test("legal-entity provider_kind set matches the operator cohort", () => {
    expect([...PROVIDER_KINDS_LEGAL_ENTITY].sort()).toEqual(
      [
        "courier_operator",
        "fleet_operator",
        "logistics_operator",
        "transport_business",
      ].sort(),
    );
  });

  test("quarantined provider_kind set contains 'unknown'", () => {
    expect([...PROVIDER_KINDS_QUARANTINED]).toEqual(["unknown"]);
  });

  test("the three provider-kind sets are disjoint", () => {
    const all = [
      ...PROVIDER_KINDS_NATURAL_PERSON,
      ...PROVIDER_KINDS_LEGAL_ENTITY,
      ...PROVIDER_KINDS_QUARANTINED,
    ];
    const asSet = new Set(all);
    expect(asSet.size).toBe(all.length);
  });
});

// ═════════════════════════════════════════════════════════════════════
// §2 · routeProviderKindToEntityType · the sealed routing rule
// ═════════════════════════════════════════════════════════════════════

describe("routeProviderKindToEntityType · entity_type routing", () => {
  test("individual_driver → transport_driver", () => {
    expect(routeProviderKindToEntityType("individual_driver")).toBe(
      "transport_driver",
    );
  });

  test("driver_operator → transport_driver", () => {
    expect(routeProviderKindToEntityType("driver_operator")).toBe(
      "transport_driver",
    );
  });

  test("fleet_operator → transport_operator", () => {
    expect(routeProviderKindToEntityType("fleet_operator")).toBe(
      "transport_operator",
    );
  });

  test("transport_business → transport_operator", () => {
    expect(routeProviderKindToEntityType("transport_business")).toBe(
      "transport_operator",
    );
  });

  test("courier_operator → transport_operator", () => {
    expect(routeProviderKindToEntityType("courier_operator")).toBe(
      "transport_operator",
    );
  });

  test("logistics_operator → transport_operator", () => {
    expect(routeProviderKindToEntityType("logistics_operator")).toBe(
      "transport_operator",
    );
  });

  test("unknown → null (quarantined · Rule 5l)", () => {
    expect(routeProviderKindToEntityType("unknown")).toBeNull();
  });

  test("gibberish → null (unrecognised)", () => {
    expect(routeProviderKindToEntityType("not_a_real_kind")).toBeNull();
    expect(routeProviderKindToEntityType("")).toBeNull();
  });
});

// ═════════════════════════════════════════════════════════════════════
// §3 · projectTransportRow · entity_type routing end-to-end
// ═════════════════════════════════════════════════════════════════════

describe("projectTransportRow · entity_type routing", () => {
  test("transport_business row projects as transport_operator", () => {
    const r = projectTransportRow(row({ provider_kind: "transport_business" }), cfg());
    expect(r.kind).toBe("ok");
    if (r.kind === "ok") {
      expect(r.candidate.entity_type).toBe("transport_operator");
    }
  });

  test("individual_driver row projects as transport_driver", () => {
    const r = projectTransportRow(
      row({
        provider_kind: "individual_driver",
        business_name: "Pak Budi Transport Service",
      }),
      cfg(),
    );
    expect(r.kind).toBe("ok");
    if (r.kind === "ok") {
      expect(r.candidate.entity_type).toBe("transport_driver");
    }
  });

  test("unknown provider_kind is quarantined · projection_failed", () => {
    const r = projectTransportRow(row({ provider_kind: "unknown" }), cfg());
    expect(r.kind).toBe("projection_failed");
    if (r.kind === "projection_failed") {
      expect(r.reason).toMatch(/quarantined|unrecognised/);
    }
  });
});

// ═════════════════════════════════════════════════════════════════════
// §4 · PII guard · migration 091 legal boundary
// ═════════════════════════════════════════════════════════════════════

describe("projectTransportRow · PII guard (migration 091)", () => {
  test("transport_driver row with ONLY contact_person_name is refused", () => {
    const r = projectTransportRow(
      row({
        provider_kind: "individual_driver",
        business_name: null,
        contact_person_name: "Budi Santoso",
      }),
      cfg(),
    );
    expect(r.kind).toBe("projection_failed");
    if (r.kind === "projection_failed") {
      expect(r.reason).toMatch(/business_name/);
      expect(r.reason).toMatch(/PII/);
      expect(r.reason).toMatch(/091/);
    }
  });

  test("transport_operator row with ONLY contact_person_name is also refused", () => {
    // Legal-entity rows must still carry a trading name · a bare
    // natural-person signal is never promoted to name_canonical.
    const r = projectTransportRow(
      row({
        provider_kind: "transport_business",
        business_name: "   ", // whitespace is treated as absent
        contact_person_name: "Siti Nuraini",
      }),
      cfg(),
    );
    expect(r.kind).toBe("projection_failed");
  });

  test("the projected name_canonical is the business_name verbatim (trimmed)", () => {
    const r = projectTransportRow(
      row({
        business_name: "  Jas Taxi  ",
        contact_person_name: "Pak Budi",
      }),
      cfg(),
    );
    expect(r.kind).toBe("ok");
    if (r.kind === "ok") {
      expect(r.candidate.identity.name_canonical).toBe("Jas Taxi");
      // contact_person_name must NOT leak into aliases or any identity
      // field · the row is not expected to be a natural-person
      // promotion.
      expect(r.candidate.identity.aliases).toEqual([]);
      const serialised = JSON.stringify(r.candidate);
      expect(serialised).not.toContain("Pak Budi");
    }
  });
});

// ═════════════════════════════════════════════════════════════════════
// §5 · Deterministic external_ref / candidate_id
// ═════════════════════════════════════════════════════════════════════

describe("projectTransportRow · deterministic external_ref", () => {
  test("same provider_id produces the same candidate_id across runs", () => {
    const a = projectTransportRow(row(), cfg());
    const b = projectTransportRow(row(), cfg());
    expect(a.kind).toBe("ok");
    expect(b.kind).toBe("ok");
    if (a.kind === "ok" && b.kind === "ok") {
      expect(a.candidate.candidate_id).toBe(b.candidate.candidate_id);
    }
  });

  test("different provider_id produces different candidate_id", () => {
    const a = projectTransportRow(row({ provider_id: "aaaaaaaa-0000-0000-0000-000000000001" }), cfg());
    const b = projectTransportRow(row({ provider_id: "bbbbbbbb-0000-0000-0000-000000000002" }), cfg());
    expect(a.kind).toBe("ok");
    expect(b.kind).toBe("ok");
    if (a.kind === "ok" && b.kind === "ok") {
      expect(a.candidate.candidate_id).not.toBe(b.candidate.candidate_id);
    }
  });

  test("candidate_id carries the sealed adapter prefix", () => {
    const a = projectTransportRow(row(), cfg());
    expect(a.kind).toBe("ok");
    if (a.kind === "ok") {
      expect(a.candidate.candidate_id.startsWith("cand-nex-transport-")).toBe(true);
    }
  });

  test("legacy_source.table + legacy_source.ref form the external_ref pair", () => {
    const a = projectTransportRow(
      row({ provider_id: "deadbeef-0000-0000-0000-000000000003" }),
      cfg(),
    );
    expect(a.kind).toBe("ok");
    if (a.kind === "ok") {
      expect(a.candidate.legacy_source.table).toBe(
        "nex.transport_acquisition_record",
      );
      expect(a.candidate.legacy_source.ref).toBe(
        "deadbeef-0000-0000-0000-000000000003",
      );
      expect(a.candidate.legacy_source.internal_id).toBe(
        "deadbeef-0000-0000-0000-000000000003",
      );
    }
  });
});

// ═════════════════════════════════════════════════════════════════════
// §6 · Phone normalisation (defensive validation)
// ═════════════════════════════════════════════════════════════════════

describe("projectTransportRow · phone_e164", () => {
  test("E.164 phone passes through verbatim", () => {
    const r = projectTransportRow(
      row({ canonical_phone_e164: "+62818277637" }),
      cfg(),
    );
    expect(r.kind).toBe("ok");
    if (r.kind === "ok") {
      expect(r.candidate.identity.phone_e164).toBe("+62818277637");
    }
  });

  test("non-E.164 phone becomes null (we do not invent / normalise)", () => {
    const r = projectTransportRow(
      row({ canonical_phone_e164: "0818-277-637" }),
      cfg(),
    );
    expect(r.kind).toBe("ok");
    if (r.kind === "ok") {
      expect(r.candidate.identity.phone_e164).toBeNull();
    }
  });

  test("null phone stays null", () => {
    const r = projectTransportRow(row({ canonical_phone_e164: null }), cfg());
    expect(r.kind).toBe("ok");
    if (r.kind === "ok") {
      expect(r.candidate.identity.phone_e164).toBeNull();
    }
  });
});

// ═════════════════════════════════════════════════════════════════════
// §7 · Website apex extraction
// ═════════════════════════════════════════════════════════════════════

describe("projectTransportRow · website_apex", () => {
  test("https URL extracts apex (lowercase, no www)", () => {
    const r = projectTransportRow(
      row({ website: "https://www.Example.COM/path" }),
      cfg(),
    );
    expect(r.kind).toBe("ok");
    if (r.kind === "ok") {
      expect(r.candidate.identity.website_apex).toBe("example.com");
    }
  });

  test("bare host without protocol still extracts apex", () => {
    const r = projectTransportRow(row({ website: "wiratransports.com" }), cfg());
    expect(r.kind).toBe("ok");
    if (r.kind === "ok") {
      expect(r.candidate.identity.website_apex).toBe("wiratransports.com");
    }
  });

  test("blank website becomes null", () => {
    const r = projectTransportRow(row({ website: "   " }), cfg());
    expect(r.kind).toBe("ok");
    if (r.kind === "ok") {
      expect(r.candidate.identity.website_apex).toBeNull();
    }
  });

  test("null website stays null", () => {
    const r = projectTransportRow(row({ website: null }), cfg());
    expect(r.kind).toBe("ok");
    if (r.kind === "ok") {
      expect(r.candidate.identity.website_apex).toBeNull();
    }
  });
});

// ═════════════════════════════════════════════════════════════════════
// §8 · Country derivation from home_jurisdiction
// ═════════════════════════════════════════════════════════════════════

describe("projectTransportRow · country", () => {
  test("ID/DIY/Yogyakarta → country=ID", () => {
    const r = projectTransportRow(
      row({ home_jurisdiction: "ID/DIY/Yogyakarta" }),
      cfg(),
    );
    expect(r.kind).toBe("ok");
    if (r.kind === "ok") expect(r.candidate.country).toBe("ID");
  });

  test("null home_jurisdiction falls back to LEGACY_TRANSPORT_COUNTRY", () => {
    const r = projectTransportRow(row({ home_jurisdiction: null }), cfg());
    expect(r.kind).toBe("ok");
    if (r.kind === "ok") expect(r.candidate.country).toBe("ID");
  });

  test("malformed first-segment falls back to LEGACY_TRANSPORT_COUNTRY", () => {
    const r = projectTransportRow(
      row({ home_jurisdiction: "indonesia/diy" }),
      cfg(),
    );
    expect(r.kind).toBe("ok");
    if (r.kind === "ok") expect(r.candidate.country).toBe("ID");
  });
});

// ═════════════════════════════════════════════════════════════════════
// §9 · Shape · passes to validator layer safely
// ═════════════════════════════════════════════════════════════════════

describe("projectTransportRow · candidate shape", () => {
  test("status is pending_founder_review", () => {
    const r = projectTransportRow(row(), cfg());
    expect(r.kind).toBe("ok");
    if (r.kind === "ok") {
      expect(r.candidate.status).toBe("pending_founder_review");
    }
  });

  test("identity.coordinates is null (table has no coordinates)", () => {
    const r = projectTransportRow(row(), cfg());
    expect(r.kind).toBe("ok");
    if (r.kind === "ok") {
      expect(r.candidate.identity.coordinates).toBeNull();
    }
  });

  test("identity.address is null (table has no address column)", () => {
    const r = projectTransportRow(row(), cfg());
    expect(r.kind).toBe("ok");
    if (r.kind === "ok") {
      expect(r.candidate.identity.address).toBeNull();
    }
  });

  test("risk_categories contains R1 and selection_score is in [0,1]", () => {
    const r = projectTransportRow(row(), cfg());
    expect(r.kind).toBe("ok");
    if (r.kind === "ok") {
      expect(r.candidate.risk_categories).toContain("R1");
      expect(r.candidate.selection_score).toBeGreaterThanOrEqual(0);
      expect(r.candidate.selection_score).toBeLessThanOrEqual(1);
    }
  });

  test("provider_id missing → projection_failed", () => {
    const r = projectTransportRow(
      row({ provider_id: "" as unknown as string }),
      cfg(),
    );
    expect(r.kind).toBe("projection_failed");
  });

  test("provider_kind missing → projection_failed", () => {
    const r = projectTransportRow(
      row({ provider_kind: "" as unknown as string }),
      cfg(),
    );
    expect(r.kind).toBe("projection_failed");
  });
});
