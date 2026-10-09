// scripts/nex-canonical/migration-169.test.ts
//
// Structural tests for migration 169 (legacy canonical backfill FK).
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
  "169_nex_legacy_canonical_backfill.sql",
);

function readCode(): string {
  const sql = fs.readFileSync(MIG_PATH, "utf8");
  return sql.replace(/--[^\n]*/g, "");
}

const LEGACY_TABLES = [
  { table: "nex.food_business",           fk: "fk_fb_canonical_business", idx: "idx_fb_canonical_business" },
  { table: "nex.accommodation_business",  fk: "fk_ab_canonical_business", idx: "idx_ab_canonical_business" },
  { table: "nex.service_business",        fk: "fk_sb_canonical_business", idx: "idx_sb_canonical_business" },
  { table: "nex.mp_seller",               fk: "fk_mp_canonical_business", idx: "idx_mp_canonical_business" },
];

describe("migration 169 · existence + targets", () => {
  test("file exists", () => {
    expect(fs.existsSync(MIG_PATH)).toBe(true);
  });

  for (const { table } of LEGACY_TABLES) {
    test(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS canonical_business_id`, () => {
      const code = readCode();
      const re = new RegExp(
        `ALTER\\s+TABLE\\s+${table.replace(".", "\\.")}\\s+ADD\\s+COLUMN\\s+IF\\s+NOT\\s+EXISTS\\s+canonical_business_id\\s+uuid\\s+NULL`,
        "i",
      );
      expect(code).toMatch(re);
    });
  }
});

describe("migration 169 · FK constraints", () => {
  for (const { fk, table } of LEGACY_TABLES) {
    test(`${fk} references business_canonical with ON DELETE SET NULL`, () => {
      const code = readCode();
      expect(code).toMatch(new RegExp(`\\b${fk}\\b`));
      expect(code).toMatch(
        /FOREIGN\s+KEY\s*\(\s*canonical_business_id\s*\)[\s\S]{1,200}REFERENCES\s+nex\.business_canonical\s*\(\s*canonical_business_id\s*\)/i,
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

describe("migration 169 · indexes", () => {
  for (const { idx } of LEGACY_TABLES) {
    test(`partial index ${idx} on canonical_business_id`, () => {
      const code = readCode();
      expect(code).toMatch(new RegExp(`\\b${idx}\\b`));
    });
  }

  test("every canonical_business_id index is partial on IS NOT NULL", () => {
    const code = readCode();
    const matches = code.match(/CREATE\s+INDEX\s+IF\s+NOT\s+EXISTS\s+idx_\w+_canonical_business[\s\S]*?;/gi);
    expect(matches).not.toBeNull();
    for (const m of matches ?? []) {
      expect(m).toMatch(/WHERE\s+canonical_business_id\s+IS\s+NOT\s+NULL/i);
    }
  });
});

describe("migration 169 · safety posture", () => {
  test("no row-level DML (no backfill in this migration)", () => {
    const code = readCode();
    expect(code).not.toMatch(/\bINSERT\s+INTO\s+nex\./i);
    expect(code).not.toMatch(/\bUPDATE\s+nex\.\w+\s+SET\b/i);
    expect(code).not.toMatch(/\bDELETE\s+FROM\s+nex\./i);
    expect(code).not.toMatch(/\bTRUNCATE\b/i);
  });

  test("no DROP of any object", () => {
    const code = readCode();
    expect(code).not.toMatch(/\bDROP\s+TABLE\b/i);
    expect(code).not.toMatch(/\bDROP\s+COLUMN\b/i);
  });

  test("no GRANT/REVOKE", () => {
    const code = readCode();
    expect(code).not.toMatch(
      /\b(?:GRANT|REVOKE)\s+(?:ALL|SELECT|INSERT|UPDATE|DELETE|USAGE|EXECUTE|TRUNCATE|REFERENCES|TRIGGER)\b/i,
    );
  });

  test("no new tables / triggers / functions", () => {
    const code = readCode();
    expect(code).not.toMatch(/\bCREATE\s+TABLE\b/i);
    expect(code).not.toMatch(/\bCREATE\s+(?:OR\s+REPLACE\s+)?TRIGGER\b/i);
    expect(code).not.toMatch(/\bCREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\b/i);
  });
});
