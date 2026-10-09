// scripts/nex-canonical/migration-171.test.ts
//
// Structural tests for migration 171 (business_evidence backfill scaffolding).
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
  "171_nex_business_evidence_backfill.sql",
);

function readCode(): string {
  const sql = fs.readFileSync(MIG_PATH, "utf8");
  return sql.replace(/--[^\n]*/g, "");
}

describe("migration 171 · existence + target", () => {
  test("file exists", () => {
    expect(fs.existsSync(MIG_PATH)).toBe(true);
  });

  test("targets nex.business_evidence (INSERT)", () => {
    const code = readCode();
    expect(code).toMatch(
      /\bINSERT\s+INTO\s+nex\.business_evidence\b/i,
    );
  });

  test("reads from nex.food_business (SELECT FROM)", () => {
    const code = readCode();
    expect(code).toMatch(/\bFROM\s+nex\.food_business\b/i);
  });
});

describe("migration 171 · idempotency + scope", () => {
  test("WHERE canonical_business_id IS NOT NULL (safe no-op on unbackfilled rows)", () => {
    const code = readCode();
    expect(code).toMatch(/canonical_business_id\s+IS\s+NOT\s+NULL/i);
  });

  test("WHERE NOT EXISTS guard against duplicate scaffold evidence", () => {
    const code = readCode();
    expect(code).toMatch(/NOT\s+EXISTS\s*\(/i);
    expect(code).toMatch(/observation_generator\s*=\s*'migration-171-scaffold'/i);
  });

  test("stamps observation_generator = 'migration-171-scaffold'", () => {
    const code = readCode();
    expect(code).toMatch(/'migration-171-scaffold'/);
  });

  test("cites source_id = 'nex_food_business_legacy' (migration 179 seed)", () => {
    const code = readCode();
    expect(code).toMatch(/'nex_food_business_legacy'/);
  });

  test("resolver_verdict_kind = 'NO_MATCH' (initial attestation)", () => {
    const code = readCode();
    expect(code).toMatch(/'NO_MATCH'/);
  });

  test("schema_version pinned to 'evidence-v1' (matches migration 170 CHECK)", () => {
    const code = readCode();
    expect(code).toMatch(/'evidence-v1'/);
  });
});

describe("migration 171 · hash integrity", () => {
  test("candidate_integrity_hash uses sha256 digest", () => {
    const code = readCode();
    expect(code).toMatch(/digest\s*\([\s\S]*?,\s*'sha256'\s*\)/i);
  });

  test("decision_record_id is sha256-hashed deterministically", () => {
    const code = readCode();
    expect(code).toMatch(/'migration-171-decision:'/);
  });

  test("review_package_id is sha256-hashed deterministically", () => {
    const code = readCode();
    expect(code).toMatch(/'migration-171-package:'/);
  });
});

describe("migration 171 · safety posture", () => {
  test("no UPDATE/DELETE/TRUNCATE", () => {
    const code = readCode();
    expect(code).not.toMatch(/\bUPDATE\s+nex\.\w+\s+SET\b/i);
    expect(code).not.toMatch(/\bDELETE\s+FROM\s+nex\./i);
    expect(code).not.toMatch(/\bTRUNCATE\b/i);
  });

  test("no DROP / ALTER / CREATE TABLE in a DML-only migration", () => {
    const code = readCode();
    expect(code).not.toMatch(/\bDROP\s+TABLE\b/i);
    expect(code).not.toMatch(/\bALTER\s+TABLE\b/i);
    expect(code).not.toMatch(/\bCREATE\s+TABLE\b/i);
    expect(code).not.toMatch(/\bCREATE\s+INDEX\b/i);
  });

  test("only INSERTs into business_evidence (no other nex. table writes)", () => {
    const code = readCode();
    const inserts = code.match(/INSERT\s+INTO\s+nex\.\w+/gi) ?? [];
    expect(inserts.length).toBeGreaterThan(0);
    for (const insert of inserts) {
      expect(insert).toMatch(/business_evidence/i);
    }
  });

  test("no GRANT/REVOKE", () => {
    const code = readCode();
    expect(code).not.toMatch(
      /\b(?:GRANT|REVOKE)\s+(?:ALL|SELECT|INSERT|UPDATE|DELETE|USAGE|EXECUTE|TRUNCATE|REFERENCES|TRIGGER)\b/i,
    );
  });

  test("no triggers", () => {
    const code = readCode();
    expect(code).not.toMatch(/\bCREATE\s+(?:OR\s+REPLACE\s+)?TRIGGER\b/i);
  });
});
