// scripts/nex-canonical/migration-172.test.ts
//
// Structural tests for migration 172 (business_freshness_band fn + view).
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
  "172_nex_business_freshness_band.sql",
);

function readCode(): string {
  const sql = fs.readFileSync(MIG_PATH, "utf8");
  return sql.replace(/--[^\n]*/g, "");
}

describe("migration 172 · existence + targets", () => {
  test("file exists", () => {
    expect(fs.existsSync(MIG_PATH)).toBe(true);
  });

  test("creates nex.business_freshness_band(timestamptz)", () => {
    const code = readCode();
    expect(code).toMatch(
      /\bCREATE\s+OR\s+REPLACE\s+FUNCTION\s+nex\.business_freshness_band\s*\(\s*last_verified_at\s+timestamptz\s*\)/i,
    );
  });

  test("creates nex.business_freshness_v view", () => {
    const code = readCode();
    expect(code).toMatch(
      /\bCREATE\s+OR\s+REPLACE\s+VIEW\s+nex\.business_freshness_v\b/i,
    );
  });
});

describe("migration 172 · function shape", () => {
  test("returns text", () => {
    const code = readCode();
    expect(code).toMatch(/\bRETURNS\s+text\b/i);
  });

  test("STABLE (not IMMUTABLE because it reads now())", () => {
    const code = readCode();
    expect(code).toMatch(/\bSTABLE\b/);
    // Specifically not IMMUTABLE — guard the sealed decision.
    const fnBody = code.slice(
      code.search(/CREATE\s+OR\s+REPLACE\s+FUNCTION/i),
      code.search(/\$\$\s*;/),
    );
    expect(fnBody).not.toMatch(/\bIMMUTABLE\b/i);
  });

  test("PARALLEL SAFE", () => {
    const code = readCode();
    expect(code).toMatch(/\bPARALLEL\s+SAFE\b/i);
  });

  test("LANGUAGE sql", () => {
    const code = readCode();
    expect(code).toMatch(/\bLANGUAGE\s+sql\b/i);
  });

  test("5 sealed bands: UNVERIFIED, FRESH, AGING, STALE, EXPIRED", () => {
    const code = readCode();
    for (const band of ["UNVERIFIED", "FRESH", "AGING", "STALE", "EXPIRED"]) {
      expect(code).toMatch(new RegExp(`'${band}'`));
    }
  });

  test("sealed thresholds: 12 months (FRESH), 18 months (AGING), 24 months (STALE)", () => {
    const code = readCode();
    expect(code).toMatch(/interval\s+'12\s+months'/i);
    expect(code).toMatch(/interval\s+'18\s+months'/i);
    expect(code).toMatch(/interval\s+'24\s+months'/i);
  });
});

describe("migration 172 · view shape", () => {
  test("view reads from nex.business_canonical", () => {
    const code = readCode();
    expect(code).toMatch(/\bFROM\s+nex\.business_canonical\b/i);
  });

  test("view projects canonical_business_id, entity_type, country, last_verified_at", () => {
    const code = readCode();
    expect(code).toMatch(/\bcanonical_business_id\b/);
    expect(code).toMatch(/\bentity_type\b/);
    expect(code).toMatch(/\bcountry\b/);
    expect(code).toMatch(/\blast_verified_at\b/);
  });

  test("view projects freshness_days (int) + freshness_status (text from fn)", () => {
    const code = readCode();
    expect(code).toMatch(/\bfreshness_days\b/i);
    expect(code).toMatch(/\bfreshness_status\b/i);
    expect(code).toMatch(/\bnex\.business_freshness_band\s*\(/i);
  });

  test("freshness_days computes EPOCH / 86400", () => {
    const code = readCode();
    expect(code).toMatch(/EXTRACT\s*\(\s*EPOCH[\s\S]{1,80}\/\s*86400/i);
  });
});

describe("migration 172 · safety posture", () => {
  test("no DML / ALTER / CREATE TABLE", () => {
    const code = readCode();
    expect(code).not.toMatch(/\bINSERT\s+INTO\s+nex\./i);
    expect(code).not.toMatch(/\bUPDATE\s+nex\.\w+\s+SET\b/i);
    expect(code).not.toMatch(/\bDELETE\s+FROM\s+nex\./i);
    expect(code).not.toMatch(/\bALTER\s+TABLE\b/i);
    expect(code).not.toMatch(/\bCREATE\s+TABLE\b/i);
    expect(code).not.toMatch(/\bTRUNCATE\b/i);
  });

  test("no DROP / GRANT / REVOKE / triggers", () => {
    const code = readCode();
    expect(code).not.toMatch(/\bDROP\s+TABLE\b/i);
    expect(code).not.toMatch(/\bDROP\s+VIEW\b/i);
    expect(code).not.toMatch(/\bDROP\s+FUNCTION\b/i);
    expect(code).not.toMatch(
      /\b(?:GRANT|REVOKE)\s+(?:ALL|SELECT|INSERT|UPDATE|DELETE|USAGE|EXECUTE|TRUNCATE|REFERENCES|TRIGGER)\b/i,
    );
    expect(code).not.toMatch(/\bCREATE\s+(?:OR\s+REPLACE\s+)?TRIGGER\b/i);
  });

  test("CREATE OR REPLACE patterns (idempotent)", () => {
    const code = readCode();
    expect(code).toMatch(/CREATE\s+OR\s+REPLACE\s+FUNCTION/i);
    expect(code).toMatch(/CREATE\s+OR\s+REPLACE\s+VIEW/i);
  });
});
