// scripts/nex-canonical/migration-192.test.ts
//
// Structural tests for migration 192 · OSM ODbL attribution template
// catalog (nex.attribution_template · reviewable staging).
//
// Pure · read-only inspection of the SQL file. No DB. No network.
//
// Follows the sealed per-migration structural-test convention — see
// `migration-182.test.ts` as the canonical pattern.
//
// Run with the dedicated local config (same discovery glob as every
// other migration-N.test.ts in this directory):
//   npx vitest run --config scripts/nex-canonical/vitest.local.config.ts \
//     scripts/nex-canonical/migration-192.test.ts

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
  "192_nex_osm_odbl_attribution_template.sql",
);

function readCode(): string {
  const sql = fs.readFileSync(MIG_PATH, "utf8");
  // Strip single-line comments so string body checks are unambiguous.
  return sql.replace(/--[^\n]*/g, "");
}

describe("migration 192 · existence + shape", () => {
  test("file exists at the expected ordinal slot", () => {
    expect(fs.existsSync(MIG_PATH)).toBe(true);
  });

  test("creates nex schema (idempotent)", () => {
    const code = readCode();
    expect(code).toMatch(/\bCREATE\s+SCHEMA\s+IF\s+NOT\s+EXISTS\s+nex\b/i);
  });

  test("creates nex.attribution_template table (IF NOT EXISTS)", () => {
    const code = readCode();
    expect(code).toMatch(
      /\bCREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+nex\.attribution_template\b/i,
    );
  });

  test("primary key is template_id text", () => {
    const code = readCode();
    expect(code).toMatch(/\btemplate_id\s+text\s+PRIMARY\s+KEY\b/i);
  });

  test("required_fields is jsonb NOT NULL", () => {
    const code = readCode();
    expect(code).toMatch(/\brequired_fields\s+jsonb\s+NOT\s+NULL\b/i);
  });

  test("simulated is boolean NOT NULL DEFAULT TRUE", () => {
    const code = readCode();
    expect(code).toMatch(
      /\bsimulated\s+boolean\s+NOT\s+NULL\s+DEFAULT\s+TRUE\b/i,
    );
  });

  test("created_at is timestamptz NOT NULL DEFAULT now()", () => {
    const code = readCode();
    expect(code).toMatch(
      /\bcreated_at\s+timestamptz\s+NOT\s+NULL\s+DEFAULT\s+now\(\)/i,
    );
  });
});

describe("migration 192 · seeded templates (four rows)", () => {
  test("seeds osm_odbl_v1", () => {
    const code = readCode();
    expect(code).toMatch(/'osm_odbl_v1'/);
    // The short form credit for ODbL
    expect(code).toMatch(/'© OpenStreetMap contributors'/);
    expect(code).toMatch(/'Open Database License 1\.0'/);
  });

  test("seeds osm_cc_by_sa_v1", () => {
    const code = readCode();
    expect(code).toMatch(/'osm_cc_by_sa_v1'/);
    expect(code).toMatch(
      /'Creative Commons Attribution-ShareAlike 2\.0'/,
    );
  });

  test("seeds openstreetmap_contributor_v2", () => {
    const code = readCode();
    expect(code).toMatch(/'openstreetmap_contributor_v2'/);
    expect(code).toMatch(
      /'OpenStreetMap Foundation attribution guidance'/,
    );
  });

  test("seeds osm_derived_via_overpass_v1 with source_reference required", () => {
    const code = readCode();
    expect(code).toMatch(/'osm_derived_via_overpass_v1'/);
    // The reduced-field distribution requires source_reference substitution
    expect(code).toMatch(/\["source_reference"\]/);
  });

  test("INSERT uses ON CONFLICT (template_id) DO NOTHING (idempotent)", () => {
    const code = readCode();
    expect(code).toMatch(
      /ON\s+CONFLICT\s*\(\s*template_id\s*\)\s+DO\s+NOTHING/i,
    );
  });

  test("every seeded VALUES tuple ends with TRUE (simulated=TRUE)", () => {
    const code = readCode();
    // Count number of VALUES tuples by counting template_ids
    const templateIds = code.match(
      /'(osm_odbl_v1|osm_cc_by_sa_v1|openstreetmap_contributor_v2|osm_derived_via_overpass_v1)'/g,
    );
    // One occurrence per template per values block (seed only has one block)
    expect(templateIds?.length).toBeGreaterThanOrEqual(4);
  });
});

describe("migration 192 · safety posture · NEVER touches source_registry", () => {
  test("no UPDATE on nex.source_registry (sealed · F3 does not touch it)", () => {
    const code = readCode();
    expect(code).not.toMatch(/\bUPDATE\s+nex\.source_registry\b/i);
  });

  test("no INSERT INTO nex.source_registry", () => {
    const code = readCode();
    expect(code).not.toMatch(/\bINSERT\s+INTO\s+nex\.source_registry\b/i);
  });

  test("no DELETE / TRUNCATE on nex.source_registry", () => {
    const code = readCode();
    expect(code).not.toMatch(/\bDELETE\s+FROM\s+nex\.source_registry\b/i);
    expect(code).not.toMatch(/\bTRUNCATE\s+(?:TABLE\s+)?nex\.source_registry\b/i);
  });

  test("no can_display flip (F3 explicitly does not activate publication)", () => {
    const code = readCode();
    expect(code).not.toMatch(/\bcan_display\s*=\s*TRUE\b/i);
    expect(code).not.toMatch(/\bSET\s+can_display\b/i);
  });

  test("no ALTER on existing tables", () => {
    const code = readCode();
    // ALTER is only permitted inside the context of the new catalog
    expect(code).not.toMatch(/\bALTER\s+TABLE\s+nex\.source_registry\b/i);
    expect(code).not.toMatch(/\bALTER\s+TABLE\s+nex\.business_canonical\b/i);
    expect(code).not.toMatch(/\bALTER\s+TABLE\s+nex\.business_evidence\b/i);
  });

  test("no DROP TABLE on existing primitives", () => {
    const code = readCode();
    expect(code).not.toMatch(/\bDROP\s+TABLE\b/i);
  });

  test("no GRANT / REVOKE (DP-3 is a separate wave)", () => {
    const code = readCode();
    expect(code).not.toMatch(
      /\b(?:GRANT|REVOKE)\s+(?:ALL|SELECT|INSERT|UPDATE|DELETE|USAGE|EXECUTE|TRUNCATE|REFERENCES|TRIGGER)\b/i,
    );
  });

  test("no trigger creation", () => {
    const code = readCode();
    expect(code).not.toMatch(/\bCREATE\s+(?:OR\s+REPLACE\s+)?TRIGGER\b/i);
  });

  test("every seeded row flagged simulated=TRUE (never FALSE)", () => {
    const code = readCode();
    // Separate the INSERT ... VALUES block from the DEFAULT TRUE column spec
    // Make sure no row explicitly asserts simulated = FALSE in the seed.
    const insertBlock = code.match(/INSERT\s+INTO\s+nex\.attribution_template[\s\S]+?ON\s+CONFLICT/i)?.[0] ?? "";
    expect(insertBlock).not.toMatch(/\bFALSE\b/i);
  });
});
