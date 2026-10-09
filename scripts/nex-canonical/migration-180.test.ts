// scripts/nex-canonical/migration-180.test.ts
//
// Structural tests for migration 180 (source_registry · derived_from
// column + attribution-template-present CHECK). Pure · read-only
// inspection of the SQL file. No DB. No network.

import { describe, expect, test } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const MIG_180_PATH = path.join(
  __dirname,
  "..",
  "..",
  "deploy",
  "postgres",
  "init",
  "180_nex_source_registry_derived_from.sql",
);

/** The migration body with SQL `--` comments stripped. */
function readCode(): string {
  const sql = fs.readFileSync(MIG_180_PATH, "utf8");
  return sql.replace(/--[^\n]*/g, "");
}

// ═════════════════════════════════════════════════════════════════════
// §1 · File + target
// ═════════════════════════════════════════════════════════════════════

describe("migration 180 · existence + target", () => {
  test("file exists", () => {
    expect(fs.existsSync(MIG_180_PATH)).toBe(true);
  });

  test("targets nex.source_registry", () => {
    const code = readCode();
    expect(code).toMatch(/\bALTER\s+TABLE\s+nex\.source_registry\b/i);
  });
});

// ═════════════════════════════════════════════════════════════════════
// §2 · derived_from_source_id column
// ═════════════════════════════════════════════════════════════════════

describe("migration 180 · derived_from_source_id column", () => {
  test("adds derived_from_source_id as text NULL via ADD COLUMN IF NOT EXISTS", () => {
    const code = readCode();
    expect(code).toMatch(
      /\bADD\s+COLUMN\s+IF\s+NOT\s+EXISTS\s+derived_from_source_id\s+text\s+NULL\b/i,
    );
  });

  test("adds self-FK fk_sr_derived_from referencing source_registry(source_id)", () => {
    const code = readCode();
    expect(code).toMatch(/\bfk_sr_derived_from\b/);
    expect(code).toMatch(
      /\bFOREIGN\s+KEY\s*\(\s*derived_from_source_id\s*\)[\s\S]{1,120}REFERENCES\s+nex\.source_registry\s*\(\s*source_id\s*\)/i,
    );
  });

  test("FK add is idempotent (DO-block checks pg_constraint)", () => {
    const code = readCode();
    expect(code).toMatch(/\bpg_constraint\b/);
    expect(code).toMatch(/\bconname\s*=\s*'fk_sr_derived_from'/);
  });
});

// ═════════════════════════════════════════════════════════════════════
// §3 · ck_sr_attribution_template_present (D-A9)
// ═════════════════════════════════════════════════════════════════════

describe("migration 180 · attribution-template-present CHECK (D-A9)", () => {
  test("adds the sealed CHECK constraint ck_sr_attribution_template_present", () => {
    const code = readCode();
    expect(code).toMatch(/\bck_sr_attribution_template_present\b/);
  });

  test("CHECK uses the sealed disjunction: can_display=FALSE OR NOT attribution_required OR non-blank template", () => {
    const code = readCode();
    // Look for all three sealed clauses in the CHECK body.
    expect(code).toMatch(/can_display\s*=\s*FALSE/i);
    expect(code).toMatch(/attribution_required\s*=\s*FALSE/i);
    expect(code).toMatch(
      /length\s*\(\s*trim\s*\(\s*coalesce\s*\(\s*attribution_template\s*,\s*''\s*\)\s*\)\s*\)\s*>\s*0/i,
    );
  });

  test("CHECK add is idempotent (DO-block checks pg_constraint)", () => {
    const code = readCode();
    expect(code).toMatch(
      /\bconname\s*=\s*'ck_sr_attribution_template_present'/,
    );
  });
});

// ═════════════════════════════════════════════════════════════════════
// §4 · Safety · no DML, no DROP, no GRANT/REVOKE, no new tables
// ═════════════════════════════════════════════════════════════════════

describe("migration 180 · safety posture", () => {
  test("no row-level DML on any table (no INSERT / UPDATE / DELETE / TRUNCATE)", () => {
    const code = readCode();
    expect(code).not.toMatch(/\bINSERT\s+INTO\s+nex\./i);
    expect(code).not.toMatch(/\bUPDATE\s+nex\.\w+\s+SET\b/i);
    expect(code).not.toMatch(/\bDELETE\s+FROM\s+nex\./i);
    expect(code).not.toMatch(/\bTRUNCATE\b/i);
  });

  test("no DROP of any object · additive migration", () => {
    const code = readCode();
    expect(code).not.toMatch(/\bDROP\s+TABLE\b/i);
    expect(code).not.toMatch(/\bDROP\s+SCHEMA\b/i);
    expect(code).not.toMatch(/\bDROP\s+VIEW\b/i);
    expect(code).not.toMatch(/\bDROP\s+COLUMN\b/i);
    expect(code).not.toMatch(/\bDROP\s+CONSTRAINT\b/i);
  });

  test("no GRANT or REVOKE statements (DP-3 lockdown is a separate wave)", () => {
    const code = readCode();
    expect(code).not.toMatch(
      /\bGRANT\s+(?:ALL|SELECT|INSERT|UPDATE|DELETE|USAGE|EXECUTE|TRUNCATE|REFERENCES|TRIGGER)\b/i,
    );
    expect(code).not.toMatch(
      /\bREVOKE\s+(?:ALL|SELECT|INSERT|UPDATE|DELETE|USAGE|EXECUTE|TRUNCATE|REFERENCES|TRIGGER)\b/i,
    );
  });

  test("no new tables / indexes / functions / materialized views", () => {
    const code = readCode();
    expect(code).not.toMatch(/\bCREATE\s+TABLE\b/i);
    expect(code).not.toMatch(/\bCREATE\s+INDEX\b/i);
    expect(code).not.toMatch(/\bCREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\b/i);
    expect(code).not.toMatch(/\bCREATE\s+(?:OR\s+REPLACE\s+)?MATERIALIZED\s+VIEW\b/i);
    expect(code).not.toMatch(/\bCREATE\s+SCHEMA\b/i);
  });

  test("no can_display or attribution_template value writes", () => {
    const code = readCode();
    // D-A11: this migration does not write any attribution_template
    // or flip any can_display. Those writes live in A-3.
    expect(code).not.toMatch(/\bcan_display\s*=\s*TRUE\s*;/i);
    expect(code).not.toMatch(/\battribution_template\s*=\s*'[^']/i);
    expect(code).not.toMatch(/\bderived_from_source_id\s*=\s*'[^']/i);
  });

  test("no triggers (one-hop invariant enforced by admin-path validation, not DB triggers)", () => {
    const code = readCode();
    expect(code).not.toMatch(/\bCREATE\s+(?:OR\s+REPLACE\s+)?TRIGGER\b/i);
  });
});
