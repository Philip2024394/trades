// scripts/nex-canonical/migration-179.test.ts
//
// Structural tests for migration 179 (seed `nex_food_business_legacy`
// into nex.source_registry). Pure · read-only inspection of the SQL
// file. No DB. No network.

import { describe, expect, test } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { LEGACY_FOOD_SOURCE_ID } from "./source-legacy-food-business";

const MIG_179_PATH = path.join(
  __dirname,
  "..",
  "..",
  "deploy",
  "postgres",
  "init",
  "179_nex_source_registry_legacy_food_business.sql",
);

/** The migration body with SQL `--` comments stripped so grep is on
 *  live code only. Matches the discipline in migration-170.test.ts. */
function readCode(): string {
  const sql = fs.readFileSync(MIG_179_PATH, "utf8");
  return sql.replace(/--[^\n]*/g, "");
}

// ═════════════════════════════════════════════════════════════════════
// §1 · File exists · targets the sealed source-registry table
// ═════════════════════════════════════════════════════════════════════

describe("migration 179 · existence + target", () => {
  test("file exists", () => {
    expect(fs.existsSync(MIG_179_PATH)).toBe(true);
  });

  test("targets nex.source_registry", () => {
    const code = readCode();
    expect(code).toMatch(/INSERT\s+INTO\s+nex\.source_registry\b/i);
  });

  test("writes exactly ONE INSERT statement · no other DML", () => {
    const code = readCode();
    const inserts = [...code.matchAll(/\bINSERT\s+INTO\b/gi)];
    expect(inserts).toHaveLength(1);
  });
});

// ═════════════════════════════════════════════════════════════════════
// §2 · Idempotency contract
// ═════════════════════════════════════════════════════════════════════

describe("migration 179 · idempotency", () => {
  test("uses ON CONFLICT (source_id) DO NOTHING", () => {
    const code = readCode();
    expect(code).toMatch(
      /ON\s+CONFLICT\s*\(\s*source_id\s*\)\s*DO\s+NOTHING/i,
    );
  });

  test("DO NOTHING (not DO UPDATE) · never overwrites a pre-existing row", () => {
    const code = readCode();
    expect(code).not.toMatch(/ON\s+CONFLICT[^;]*DO\s+UPDATE/i);
  });
});

// ═════════════════════════════════════════════════════════════════════
// §3 · Row shape · matches the sealed registry contract
// ═════════════════════════════════════════════════════════════════════

describe("migration 179 · row shape", () => {
  test("source_id is the sealed LEGACY_FOOD_SOURCE_ID from the adapter", () => {
    const code = readCode();
    // The adapter is the source of truth for the slug · migration must
    // use the exact same literal.
    expect(LEGACY_FOOD_SOURCE_ID).toBe("nex_food_business_legacy");
    expect(code).toMatch(/'nex_food_business_legacy'/);
  });

  test("source_type is 'directory_import' · a sealed enum value", () => {
    const code = readCode();
    expect(code).toMatch(/'directory_import'/);
  });

  test("can_derive is explicitly TRUE (operator decision pinned)", () => {
    const code = readCode();
    // The INSERT lists can_derive in its column list AND the VALUES
    // tuple carries TRUE for that column.
    expect(code).toMatch(/\bcan_derive\b[\s\S]*\bTRUE\b/i);
  });

  test("does NOT set can_display / can_redistribute · defaults stay FALSE", () => {
    const code = readCode();
    // Belt-and-braces: assert the INSERT column list omits these two
    // (so their migration-166 FALSE defaults apply).
    const colListMatch = code.match(
      /INSERT\s+INTO\s+nex\.source_registry\s*\(([^)]*)\)/i,
    );
    expect(colListMatch).not.toBeNull();
    const cols = (colListMatch?.[1] ?? "").toLowerCase();
    expect(cols).not.toMatch(/\bcan_display\b/);
    expect(cols).not.toMatch(/\bcan_redistribute\b/);
  });
});

// ═════════════════════════════════════════════════════════════════════
// §4 · No destructive SQL · zero blast radius beyond the one seed row
// ═════════════════════════════════════════════════════════════════════

describe("migration 179 · safety posture", () => {
  test("no DROP / TRUNCATE / DELETE / UPDATE on existing tables", () => {
    const code = readCode();
    expect(code).not.toMatch(/\bDROP\s+TABLE\b/i);
    expect(code).not.toMatch(/\bDROP\s+SCHEMA\b/i);
    expect(code).not.toMatch(/\bTRUNCATE\b/i);
    expect(code).not.toMatch(/\bDELETE\s+FROM\b/i);
    // `ON CONFLICT DO UPDATE` is the only well-formed way UPDATE could
    // appear in a seed migration; we already assert that pattern is
    // absent in §2. A free-standing `UPDATE … SET` must not appear.
    expect(code).not.toMatch(/\bUPDATE\s+nex\.\w+\s+SET\b/i);
  });

  test("no ALTER on existing tables", () => {
    const code = readCode();
    expect(code).not.toMatch(/\bALTER\s+TABLE\b/i);
    expect(code).not.toMatch(/\bALTER\s+SCHEMA\b/i);
  });

  test("no GRANT / REVOKE", () => {
    const code = readCode();
    expect(code).not.toMatch(/\bGRANT\b/i);
    expect(code).not.toMatch(/\bREVOKE\b/i);
  });

  test("no CREATE TABLE / INDEX / FUNCTION / VIEW · pure seed-row insert", () => {
    const code = readCode();
    expect(code).not.toMatch(/\bCREATE\s+TABLE\b/i);
    expect(code).not.toMatch(/\bCREATE\s+INDEX\b/i);
    expect(code).not.toMatch(/\bCREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\b/i);
    expect(code).not.toMatch(/\bCREATE\s+(?:OR\s+REPLACE\s+)?VIEW\b/i);
    expect(code).not.toMatch(/\bCREATE\s+(?:OR\s+REPLACE\s+)?MATERIALIZED\s+VIEW\b/i);
    expect(code).not.toMatch(/\bCREATE\s+SCHEMA\b/i);
  });

  test("does not touch the ad-hoc 'nex.food_business' source_id row from the synthetic first-write", () => {
    const code = readCode();
    // That row is referenced by the sealed synthetic proof's evidence
    // FK; this migration must not touch it. Its source_id literal
    // includes a dot ("nex.food_business") which is deliberately NOT
    // present in the SQL body of migration 179.
    expect(code).not.toMatch(/'nex\.food_business'/);
  });
});
