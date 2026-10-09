// scripts/nex-canonical/migration-182.test.ts
//
// Structural tests for migration 182 (attribution templates on sealed sources).
// Pure · read-only inspection of the SQL file. No DB. No network.

import { describe, expect, test } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const MIG_PATH = path.join(
  __dirname,
  "..",
  "..",
  "deploy",
  "postgres",
  "init",
  "182_nex_source_registry_attribution_templates.sql",
);

function readCode(): string {
  const sql = fs.readFileSync(MIG_PATH, "utf8");
  return sql.replace(/--[^\n]*/g, "");
}

describe("migration 182 · existence + targets", () => {
  test("file exists", () => {
    expect(fs.existsSync(MIG_PATH)).toBe(true);
  });

  test("targets nex.source_registry (UPDATE)", () => {
    const code = readCode();
    expect(code).toMatch(/\bUPDATE\s+nex\.source_registry\b/i);
  });
});

describe("migration 182 · sealed attribution decisions", () => {
  test("osm_overpass receives ODbL attribution_template", () => {
    const code = readCode();
    expect(code).toMatch(
      /SET\s+attribution_template\s*=\s*'© OpenStreetMap contributors \(ODbL\)'/i,
    );
    expect(code).toMatch(/WHERE\s+source_id\s*=\s*'osm_overpass'/i);
  });

  test("wikidata flips attribution_required to FALSE (CC0 1.0)", () => {
    const code = readCode();
    expect(code).toMatch(
      /SET\s+attribution_required\s*=\s*FALSE[\s\S]{1,200}WHERE\s+source_id\s*=\s*'wikidata'/i,
    );
  });

  test("owner_upload flips attribution_required to FALSE", () => {
    const code = readCode();
    expect(code).toMatch(
      /SET\s+attribution_required\s*=\s*FALSE[\s\S]{1,200}WHERE\s+source_id\s*=\s*'owner_upload'/i,
    );
  });

  test("nex_food_business_legacy flips attribution_required to FALSE", () => {
    const code = readCode();
    expect(code).toMatch(
      /SET\s+attribution_required\s*=\s*FALSE[\s\S]{1,200}WHERE\s+source_id\s*=\s*'nex_food_business_legacy'/i,
    );
  });

  test("wikimedia_commons intentionally has NO template update (per-file licence)", () => {
    const code = readCode();
    expect(code).not.toMatch(
      /SET[\s\S]{1,200}WHERE\s+source_id\s*=\s*'wikimedia_commons'/i,
    );
  });

  test("business_website intentionally has NO template update (per-site attribution)", () => {
    const code = readCode();
    expect(code).not.toMatch(
      /SET[\s\S]{1,200}WHERE\s+source_id\s*=\s*'business_website'/i,
    );
  });
});

describe("migration 182 · idempotency guards", () => {
  test("every UPDATE guards on NULL template or TRUE required (so re-run is safe)", () => {
    const code = readCode();
    const updates = code.match(/UPDATE\s+nex\.source_registry[\s\S]+?;/gi) ?? [];
    expect(updates.length).toBeGreaterThan(0);
    for (const u of updates) {
      expect(u).toMatch(
        /(attribution_template\s+IS\s+NULL|attribution_required\s*=\s*TRUE)/i,
      );
    }
  });
});

describe("migration 182 · safety posture", () => {
  test("no can_display flip (A-3 Phase 2 is separate)", () => {
    const code = readCode();
    expect(code).not.toMatch(/\bcan_display\s*=\s*TRUE\b/i);
    expect(code).not.toMatch(/SET\s+can_display\b/i);
  });

  test("no new tables / ALTER / DROP / GRANT / REVOKE / triggers", () => {
    const code = readCode();
    expect(code).not.toMatch(/\bCREATE\s+TABLE\b/i);
    expect(code).not.toMatch(/\bALTER\s+TABLE\b/i);
    expect(code).not.toMatch(/\bDROP\s+TABLE\b/i);
    expect(code).not.toMatch(/\bDROP\s+COLUMN\b/i);
    expect(code).not.toMatch(
      /\b(?:GRANT|REVOKE)\s+(?:ALL|SELECT|INSERT|UPDATE|DELETE|USAGE|EXECUTE|TRUNCATE|REFERENCES|TRIGGER)\b/i,
    );
    expect(code).not.toMatch(/\bCREATE\s+(?:OR\s+REPLACE\s+)?TRIGGER\b/i);
  });

  test("no INSERT / DELETE / TRUNCATE (UPDATE-only migration)", () => {
    const code = readCode();
    expect(code).not.toMatch(/\bINSERT\s+INTO\s+nex\./i);
    expect(code).not.toMatch(/\bDELETE\s+FROM\s+nex\./i);
    expect(code).not.toMatch(/\bTRUNCATE\b/i);
  });
});
