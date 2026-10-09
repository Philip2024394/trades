// scripts/nex-canonical/migration-177.test.ts
//
// Structural tests for migration 177 (walker_attribution source_id FK unification).
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
  "177_nex_walker_attribution_unify.sql",
);

function readCode(): string {
  const sql = fs.readFileSync(MIG_PATH, "utf8");
  return sql.replace(/--[^\n]*/g, "");
}

const WALKER_TABLES = [
  { table: "nex.food_business",                 fk: "fk_fb_source_id", idx: "idx_fb_source_id" },
  { table: "nex.accommodation_business",        fk: "fk_ab_source_id", idx: "idx_ab_source_id" },
  { table: "nex.mp_seller",                     fk: "fk_mp_source_id", idx: "idx_mp_source_id" },
  { table: "nex.transport_acquisition_record",  fk: "fk_ta_source_id", idx: "idx_ta_source_id" },
];

describe("migration 177 · existence + targets", () => {
  test("file exists", () => {
    expect(fs.existsSync(MIG_PATH)).toBe(true);
  });

  for (const { table } of WALKER_TABLES) {
    test(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS source_id`, () => {
      const code = readCode();
      const re = new RegExp(
        `ALTER\\s+TABLE\\s+${table.replace(".", "\\.")}\\s+ADD\\s+COLUMN\\s+IF\\s+NOT\\s+EXISTS\\s+source_id\\s+text\\s+NULL`,
        "i",
      );
      expect(code).toMatch(re);
    });
  }
});

describe("migration 177 · FKs", () => {
  for (const { fk, table } of WALKER_TABLES) {
    test(`${fk} references source_registry with ON DELETE SET NULL`, () => {
      const code = readCode();
      expect(code).toMatch(new RegExp(`\\b${fk}\\b`));
      expect(code).toMatch(
        /FOREIGN\s+KEY\s*\(\s*source_id\s*\)[\s\S]{1,200}REFERENCES\s+nex\.source_registry\s*\(\s*source_id\s*\)/i,
      );
      expect(code).toMatch(/ON\s+DELETE\s+SET\s+NULL/i);
    });

    test(`${fk} add is idempotent (pg_constraint DO-block)`, () => {
      const code = readCode();
      expect(code).toMatch(new RegExp(`conname\\s*=\\s*'${fk}'`));
      expect(code).toMatch(
        new RegExp(`conrelid\\s*=\\s*'${table.replace(".", "\\.")}'::regclass`),
      );
    });
  }
});

describe("migration 177 · indexes", () => {
  for (const { idx } of WALKER_TABLES) {
    test(`partial index ${idx} on source_id`, () => {
      const code = readCode();
      expect(code).toMatch(new RegExp(`\\b${idx}\\b`));
    });
  }

  test("every source_id index is partial on IS NOT NULL", () => {
    const code = readCode();
    const matches = code.match(/CREATE\s+INDEX\s+IF\s+NOT\s+EXISTS\s+idx_\w+_source_id[\s\S]*?;/gi);
    expect(matches).not.toBeNull();
    for (const m of matches ?? []) {
      expect(m).toMatch(/WHERE\s+source_id\s+IS\s+NOT\s+NULL/i);
    }
  });
});

describe("migration 177 · coexistence with legacy source column", () => {
  test("does NOT alter the legacy free-text `source` column on any table", () => {
    const code = readCode();
    expect(code).not.toMatch(/\bALTER\s+COLUMN\s+source\b/i);
    expect(code).not.toMatch(/\bDROP\s+COLUMN\s+source\b/i);
    expect(code).not.toMatch(/\bRENAME\s+COLUMN\s+source\b/i);
  });
});

describe("migration 177 · safety posture", () => {
  test("no DML (no backfill in this migration)", () => {
    const code = readCode();
    expect(code).not.toMatch(/\bINSERT\s+INTO\s+nex\./i);
    expect(code).not.toMatch(/\bUPDATE\s+nex\.\w+\s+SET\b/i);
    expect(code).not.toMatch(/\bDELETE\s+FROM\s+nex\./i);
    expect(code).not.toMatch(/\bTRUNCATE\b/i);
  });

  test("no DROP / GRANT / REVOKE / triggers / new tables / new functions", () => {
    const code = readCode();
    expect(code).not.toMatch(/\bDROP\s+TABLE\b/i);
    expect(code).not.toMatch(/\bDROP\s+COLUMN\b/i);
    expect(code).not.toMatch(
      /\b(?:GRANT|REVOKE)\s+(?:ALL|SELECT|INSERT|UPDATE|DELETE|USAGE|EXECUTE|TRUNCATE|REFERENCES|TRIGGER)\b/i,
    );
    expect(code).not.toMatch(/\bCREATE\s+(?:OR\s+REPLACE\s+)?TRIGGER\b/i);
    expect(code).not.toMatch(/\bCREATE\s+TABLE\b/i);
    expect(code).not.toMatch(/\bCREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\b/i);
  });
});
