// scripts/nex-canonical/migration-168.test.ts
//
// Structural tests for migration 168 (business_canonical lifecycle log).
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
  "168_nex_business_canonical_lifecycle.sql",
);

function readCode(): string {
  const sql = fs.readFileSync(MIG_PATH, "utf8");
  return sql.replace(/--[^\n]*/g, "");
}

describe("migration 168 · existence + target", () => {
  test("file exists", () => {
    expect(fs.existsSync(MIG_PATH)).toBe(true);
  });

  test("creates nex.business_canonical_lifecycle_log", () => {
    const code = readCode();
    expect(code).toMatch(
      /\bCREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+nex\.business_canonical_lifecycle_log\b/i,
    );
  });
});

describe("migration 168 · lifecycle columns + CHECKs", () => {
  test("has canonical_business_id uuid NOT NULL", () => {
    const code = readCode();
    expect(code).toMatch(
      /\bcanonical_business_id\s+uuid\s+NOT\s+NULL\b/i,
    );
  });

  test("has from_state text NULL (birth row has NULL)", () => {
    const code = readCode();
    expect(code).toMatch(/\bfrom_state\s+text\s+NULL\b/i);
  });

  test("has to_state text NOT NULL", () => {
    const code = readCode();
    expect(code).toMatch(/\bto_state\s+text\s+NOT\s+NULL\b/i);
  });

  test("CHECK ck_bcll_to_state covers all 7 lifecycle states", () => {
    const code = readCode();
    expect(code).toMatch(/\bck_bcll_to_state\b/);
    for (const state of [
      "DISCOVERED", "ENRICHED", "VERIFIED",
      "OWNER_CLAIMED", "OWNER_VERIFIED", "DORMANT", "SUPERSEDED",
    ]) {
      expect(code).toMatch(new RegExp(`'${state}'`));
    }
  });

  test("CHECK ck_bcll_transition_reason covers all 9 reasons", () => {
    const code = readCode();
    expect(code).toMatch(/\bck_bcll_transition_reason\b/);
    for (const reason of [
      "birth", "enrichment", "multi_source_verify",
      "admin_verify", "owner_claim", "owner_verify",
      "dormancy", "reactivation", "supersede",
    ]) {
      expect(code).toMatch(new RegExp(`'${reason}'`));
    }
  });

  test("CHECK ck_bcll_birth_consistency ties from_state=NULL to transition_reason=birth", () => {
    const code = readCode();
    expect(code).toMatch(/\bck_bcll_birth_consistency\b/);
    expect(code).toMatch(/from_state\s+IS\s+NULL/i);
    expect(code).toMatch(/transition_reason\s*=\s*'birth'/i);
  });

  test("CHECK ck_bcll_supersede_consistency requires superseded_by on SUPERSEDED rows", () => {
    const code = readCode();
    expect(code).toMatch(/\bck_bcll_supersede_consistency\b/);
    expect(code).toMatch(/to_state\s*=\s*'SUPERSEDED'/i);
  });

  test("transitioned_by non-blank CHECK", () => {
    const code = readCode();
    expect(code).toMatch(/\bck_bcll_transitioned_by_nonblank\b/);
    expect(code).toMatch(/length\s*\(\s*trim\s*\(\s*transitioned_by\s*\)\s*\)\s*>\s*0/i);
  });

  test("decision_record_id when present matches 64-char lowercase hex", () => {
    const code = readCode();
    expect(code).toMatch(/\bck_bcll_decision_record_fmt\b/);
    expect(code).toMatch(/'\^\[a-f0-9\]\{64\}\$'/);
  });
});

describe("migration 168 · FKs", () => {
  test("FK to business_canonical with ON DELETE RESTRICT", () => {
    const code = readCode();
    expect(code).toMatch(/\bfk_bcll_canonical_business\b/);
    expect(code).toMatch(
      /FOREIGN\s+KEY\s*\(\s*canonical_business_id\s*\)[\s\S]{1,200}REFERENCES\s+nex\.business_canonical/i,
    );
    expect(code).toMatch(/ON\s+DELETE\s+RESTRICT/i);
  });

  test("FK to business_evidence (attesting_evidence_id)", () => {
    const code = readCode();
    expect(code).toMatch(/\bfk_bcll_attesting_evidence\b/);
    expect(code).toMatch(
      /FOREIGN\s+KEY\s*\(\s*attesting_evidence_id\s*\)[\s\S]{1,200}REFERENCES\s+nex\.business_evidence/i,
    );
  });

  test("self-FK superseded_by", () => {
    const code = readCode();
    expect(code).toMatch(/\bfk_bcll_superseded_by\b/);
  });
});

describe("migration 168 · indexes", () => {
  test("primary audit index on (canonical_business_id, transitioned_at DESC)", () => {
    const code = readCode();
    expect(code).toMatch(/\bidx_bcll_canonical_business\b/);
    expect(code).toMatch(/transitioned_at\s+DESC/i);
  });

  test("partial index on decision_record_id", () => {
    const code = readCode();
    expect(code).toMatch(/\bidx_bcll_decision_record\b/);
    expect(code).toMatch(/WHERE\s+decision_record_id\s+IS\s+NOT\s+NULL/i);
  });
});

describe("migration 168 · safety posture", () => {
  test("no row-level DML on any table", () => {
    const code = readCode();
    expect(code).not.toMatch(/\bINSERT\s+INTO\s+nex\./i);
    expect(code).not.toMatch(/\bUPDATE\s+nex\.\w+\s+SET\b/i);
    expect(code).not.toMatch(/\bDELETE\s+FROM\s+nex\./i);
    expect(code).not.toMatch(/\bTRUNCATE\b/i);
  });

  test("no DROP of any object", () => {
    const code = readCode();
    expect(code).not.toMatch(/\bDROP\s+TABLE\b/i);
    expect(code).not.toMatch(/\bDROP\s+VIEW\b/i);
    expect(code).not.toMatch(/\bDROP\s+COLUMN\b/i);
    expect(code).not.toMatch(/\bDROP\s+CONSTRAINT\b/i);
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
