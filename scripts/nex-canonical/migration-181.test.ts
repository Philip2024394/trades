// scripts/nex-canonical/migration-181.test.ts
//
// Structural tests for migration 181 (business_directory_v extension
// + business_directory_attribution_v sibling view). Pure · read-only
// inspection of the SQL file. No DB. No network.

import { describe, expect, test } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const MIG_181_PATH = path.join(
  __dirname,
  "..",
  "..",
  "deploy",
  "postgres",
  "init",
  "181_nex_business_directory_attribution.sql",
);

function readCode(): string {
  const sql = fs.readFileSync(MIG_181_PATH, "utf8");
  return sql.replace(/--[^\n]*/g, "");
}

// ═════════════════════════════════════════════════════════════════════
// §1 · File + idempotency
// ═════════════════════════════════════════════════════════════════════

describe("migration 181 · existence + idempotency", () => {
  test("file exists", () => {
    expect(fs.existsSync(MIG_181_PATH)).toBe(true);
  });

  test("declares TWO sealed views via CREATE OR REPLACE VIEW", () => {
    const code = readCode();
    const views = [...code.matchAll(/\bCREATE\s+OR\s+REPLACE\s+VIEW\s+(nex\.\w+)/gi)];
    const viewNames = views.map((m) => m[1]);
    expect(viewNames).toEqual([
      "nex.business_directory_v",
      "nex.business_directory_attribution_v",
    ]);
  });

  test("both views use CREATE OR REPLACE (idempotent)", () => {
    const code = readCode();
    const plainCreateView = /\bCREATE\s+VIEW\s+(?!OR\s+REPLACE)/i;
    expect(code).not.toMatch(plainCreateView);
  });
});

// ═════════════════════════════════════════════════════════════════════
// §2 · Main view (business_directory_v) · publishable predicate
// ═════════════════════════════════════════════════════════════════════

describe("migration 181 · business_directory_v · publishable predicate", () => {
  test("retains D-1 L1 lifecycle set from migration 175", () => {
    const code = readCode();
    expect(code).toMatch(
      /lifecycle_state\s+IN\s*\(\s*'VERIFIED'\s*,\s*'OWNER_CLAIMED'\s*,\s*'OWNER_VERIFIED'\s*\)/i,
    );
  });

  test("retains supersession guard from migration 175", () => {
    const code = readCode();
    expect(code).toMatch(/superseded_by_business_id\s+IS\s+NULL/i);
  });

  test("walks the one-hop derived_from_source_id chain via COALESCE", () => {
    const code = readCode();
    expect(code).toMatch(
      /COALESCE\s*\(\s*sr_direct\.derived_from_source_id\s*,\s*be\.source_id\s*\)/i,
    );
  });

  test("D-2 · at least one chain-resolved origin has can_display = TRUE", () => {
    const code = readCode();
    // Look for the shape of the EXISTS clause binding on sr_origin.can_display
    expect(code).toMatch(/\bEXISTS\s*\(/i);
    expect(code).toMatch(/sr_origin\.can_display\s*=\s*TRUE/i);
  });

  test("D-5 · fail-closed · NOT EXISTS attribution-required origin with missing/blank template", () => {
    const code = readCode();
    expect(code).toMatch(/\bNOT\s+EXISTS\s*\(/i);
    expect(code).toMatch(/sr_origin\.attribution_required\s*=\s*TRUE/i);
    expect(code).toMatch(
      /sr_origin\.attribution_template\s+IS\s+NULL/i,
    );
    expect(code).toMatch(
      /length\s*\(\s*trim\s*\(\s*sr_origin\.attribution_template\s*\)\s*\)\s*=\s*0/i,
    );
  });
});

// ═════════════════════════════════════════════════════════════════════
// §3 · Sibling view (business_directory_attribution_v)
// ═════════════════════════════════════════════════════════════════════

describe("migration 181 · business_directory_attribution_v · sibling view", () => {
  test("SELECTs the three sealed columns: canonical_business_id, source_id, text", () => {
    const code = readCode();
    // Isolate the sibling view by its name and inspect its SELECT list.
    expect(code).toMatch(
      /CREATE\s+OR\s+REPLACE\s+VIEW\s+nex\.business_directory_attribution_v\s+AS[\s\S]*?SELECT\s+DISTINCT[\s\S]*?bdv\.canonical_business_id/i,
    );
    expect(code).toMatch(/sr_origin\.source_id/i);
    expect(code).toMatch(/sr_origin\.attribution_template\s+AS\s+text/i);
  });

  test("DISTINCT dedups when multiple evidence rows cite the same origin", () => {
    const code = readCode();
    expect(code).toMatch(/\bSELECT\s+DISTINCT\b/i);
  });

  test("restricted to canonicals already admitted by business_directory_v (no leakage)", () => {
    const code = readCode();
    expect(code).toMatch(
      /FROM\s+nex\.business_directory_v\s+bdv/i,
    );
  });

  test("walks the one-hop chain via COALESCE on derived_from_source_id", () => {
    const code = readCode();
    // The sibling view performs the same COALESCE walk.
    const siblingBody = code.split("business_directory_attribution_v")[1] ?? "";
    expect(siblingBody).toMatch(
      /COALESCE\s*\(\s*sr_direct\.derived_from_source_id\s*,\s*be\.source_id\s*\)/i,
    );
  });

  test("includes only can_display=TRUE AND attribution_required=TRUE AND non-blank template", () => {
    const code = readCode();
    const siblingBody = code.split("business_directory_attribution_v")[1] ?? "";
    expect(siblingBody).toMatch(/sr_origin\.can_display\s*=\s*TRUE/i);
    expect(siblingBody).toMatch(/sr_origin\.attribution_required\s*=\s*TRUE/i);
    expect(siblingBody).toMatch(
      /sr_origin\.attribution_template\s+IS\s+NOT\s+NULL/i,
    );
    expect(siblingBody).toMatch(
      /length\s*\(\s*trim\s*\(\s*sr_origin\.attribution_template\s*\)\s*\)\s*>\s*0/i,
    );
  });
});

// ═════════════════════════════════════════════════════════════════════
// §4 · Column contract preserved (byte-stable with SELECT_COLUMNS)
// ═════════════════════════════════════════════════════════════════════

describe("migration 181 · business_directory_v column contract preserved", () => {
  test("exposes every column the sealed Directory service reads", () => {
    const code = readCode();
    const required = [
      "canonical_business_id",
      "entity_type",
      "country",
      "lifecycle_state",
      "name_canonical",
      "name_norm",
      "aliases",
      "phone_e164",
      "website_apex",
      "osm_id",
      "wikidata_qid",
      "city",
      "district",
      "street_line",
      "neighbourhood",
      "address",
      "coordinates",
      "category_ids",
      "services_products",
      "supersedes_business_id",
      "superseded_by_business_id",
      "last_verified_at",
    ];
    for (const col of required) {
      expect(code).toMatch(new RegExp(`\\bbc\\.${col}\\b`));
    }
  });
});

// ═════════════════════════════════════════════════════════════════════
// §5 · Safety · no DML, no GRANT/REVOKE, no new tables, no triggers
// ═════════════════════════════════════════════════════════════════════

describe("migration 181 · safety posture", () => {
  test("no row-level DML in any table", () => {
    const code = readCode();
    expect(code).not.toMatch(/\bINSERT\s+INTO\s+nex\./i);
    expect(code).not.toMatch(/\bUPDATE\s+nex\.\w+\s+SET\b/i);
    expect(code).not.toMatch(/\bDELETE\s+FROM\s+nex\./i);
    expect(code).not.toMatch(/\bTRUNCATE\b/i);
  });

  test("no DROP / ALTER on existing tables or views", () => {
    const code = readCode();
    expect(code).not.toMatch(/\bDROP\s+TABLE\b/i);
    expect(code).not.toMatch(/\bDROP\s+VIEW\b/i);
    expect(code).not.toMatch(/\bALTER\s+TABLE\b/i);
    expect(code).not.toMatch(/\bALTER\s+VIEW\b/i);
  });

  test("no GRANT or REVOKE statements", () => {
    const code = readCode();
    expect(code).not.toMatch(
      /\bGRANT\s+(?:ALL|SELECT|INSERT|UPDATE|DELETE|USAGE|EXECUTE|TRUNCATE|REFERENCES|TRIGGER)\b/i,
    );
    expect(code).not.toMatch(
      /\bREVOKE\s+(?:ALL|SELECT|INSERT|UPDATE|DELETE|USAGE|EXECUTE|TRUNCATE|REFERENCES|TRIGGER)\b/i,
    );
  });

  test("no CREATE TABLE / INDEX / FUNCTION / MATERIALIZED VIEW / TRIGGER", () => {
    const code = readCode();
    expect(code).not.toMatch(/\bCREATE\s+TABLE\b/i);
    expect(code).not.toMatch(/\bCREATE\s+INDEX\b/i);
    expect(code).not.toMatch(/\bCREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\b/i);
    expect(code).not.toMatch(/\bCREATE\s+(?:OR\s+REPLACE\s+)?MATERIALIZED\s+VIEW\b/i);
    expect(code).not.toMatch(/\bCREATE\s+SCHEMA\b/i);
    expect(code).not.toMatch(/\bCREATE\s+(?:OR\s+REPLACE\s+)?TRIGGER\b/i);
  });
});

// ═════════════════════════════════════════════════════════════════════
// §6 · No synthetic / fixture-id / name-based filtering
// ═════════════════════════════════════════════════════════════════════

describe("migration 181 · no synthetic recognition", () => {
  test("does NOT reference synthetic name_canonical or candidate_id fixture", () => {
    const code = readCode();
    expect(code).not.toMatch(/SYNTHETIC\s+NEX\s+FIRST/i);
    expect(code).not.toMatch(/cand-nex-first-live-write/i);
    expect(code).not.toMatch(/cand-nex-food-/i);
  });

  test("does NOT reference legacy ad-hoc source_id 'nex.food_business'", () => {
    const code = readCode();
    expect(code).not.toMatch(/'nex\.food_business'/);
  });

  test("does NOT contain any UUID literal", () => {
    const code = readCode();
    expect(code).not.toMatch(
      /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i,
    );
  });

  test("does NOT hard-code any OSM / ODbL / attribution-text literal in the view SQL", () => {
    const code = readCode();
    // The attribution text lives in source_registry.attribution_template.
    // The sealed view must NOT embed any phrasing that would amount
    // to a hard-coded attribution.
    expect(code).not.toMatch(/OpenStreetMap/);
    expect(code).not.toMatch(/\bODbL\b/);
    expect(code).not.toMatch(/openstreetmap\.org\/copyright/);
    expect(code).not.toMatch(/contributors/);
  });
});
