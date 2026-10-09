// scripts/nex-canonical/migration-183.test.ts
//
// Structural tests for migration 183 (DP-3 GRANT/REVOKE lockdown).
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
  "183_nex_directory_dp3_grant_revoke.sql",
);

function readCode(): string {
  const sql = fs.readFileSync(MIG_PATH, "utf8");
  return sql.replace(/--[^\n]*/g, "");
}

describe("migration 183 · existence + target role", () => {
  test("file exists", () => {
    expect(fs.existsSync(MIG_PATH)).toBe(true);
  });

  test("targets sealed role nex_directory_reader", () => {
    const code = readCode();
    expect(code).toMatch(/\bnex_directory_reader\b/);
  });

  test("role existence check guard present (idempotent on roleless DBs)", () => {
    const code = readCode();
    expect(code).toMatch(
      /SELECT\s+1\s+FROM\s+pg_roles\s+WHERE\s+rolname\s*=\s*'nex_directory_reader'/i,
    );
  });
});

const REVOKED_TABLES = [
  "nex.business_canonical",
  "nex.business_evidence",
  "nex.business_fact_conflict",
  "nex.business_canonical_lifecycle_log",
  "nex.business_media",
  "nex.business_claim",
];

const GRANTED_VIEWS = [
  "nex.business_directory_v",
  "nex.business_directory_attribution_v",
  "nex.business_freshness_v",
];

describe("migration 183 · REVOKEs on sealed base tables", () => {
  for (const table of REVOKED_TABLES) {
    test(`REVOKEs SELECT on ${table}`, () => {
      const code = readCode();
      const re = new RegExp(
        `REVOKE\\s+SELECT\\s+ON\\s+TABLE\\s+${table.replace(".", "\\.")}\\s+FROM\\s+nex_directory_reader`,
        "i",
      );
      expect(code).toMatch(re);
    });
  }
});

describe("migration 183 · GRANTs on sealed publication views", () => {
  for (const view of GRANTED_VIEWS) {
    test(`GRANTs SELECT on ${view}`, () => {
      const code = readCode();
      const re = new RegExp(
        `GRANT\\s+SELECT\\s+ON\\s+TABLE\\s+${view.replace(".", "\\.")}\\s+TO\\s+nex_directory_reader`,
        "i",
      );
      expect(code).toMatch(re);
    });
  }
});

describe("migration 183 · safety posture", () => {
  test("no DML / ALTER / DROP / CREATE TABLE / triggers", () => {
    const code = readCode();
    expect(code).not.toMatch(/\bINSERT\s+INTO\s+nex\./i);
    expect(code).not.toMatch(/\bUPDATE\s+nex\.\w+\s+SET\b/i);
    expect(code).not.toMatch(/\bDELETE\s+FROM\s+nex\./i);
    expect(code).not.toMatch(/\bTRUNCATE\b/i);
    expect(code).not.toMatch(/\bALTER\s+TABLE\b/i);
    expect(code).not.toMatch(/\bDROP\s+TABLE\b/i);
    expect(code).not.toMatch(/\bCREATE\s+TABLE\b/i);
    expect(code).not.toMatch(/\bCREATE\s+(?:OR\s+REPLACE\s+)?TRIGGER\b/i);
  });

  test("does NOT create the role (role creation is operator infra, not schema)", () => {
    const code = readCode();
    expect(code).not.toMatch(/\bCREATE\s+ROLE\b/i);
    expect(code).not.toMatch(/\bCREATE\s+USER\b/i);
  });

  test("does NOT touch roles other than nex_directory_reader (scoped to DP-3)", () => {
    const code = readCode();
    // Allow the sealed documentation mention of other roles in COMMENTs
    // (comments were stripped by readCode); the code body must only
    // reference nex_directory_reader.
    const grantRevokes = code.match(/(?:GRANT|REVOKE)[\s\S]+?(?=;|\n\n|$)/gi) ?? [];
    expect(grantRevokes.length).toBeGreaterThan(0);
    for (const stmt of grantRevokes) {
      expect(stmt).toMatch(/\bnex_directory_reader\b/);
      expect(stmt).not.toMatch(/\bnex_intelligence_reader\b/);
      expect(stmt).not.toMatch(/\bnex_business_owner\b/);
      expect(stmt).not.toMatch(/\bnex_marketing_reader\b/);
    }
  });
});
