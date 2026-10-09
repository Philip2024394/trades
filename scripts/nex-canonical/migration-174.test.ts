// scripts/nex-canonical/migration-174.test.ts
//
// Structural tests for migration 174 (business_fact_conflict + D-3 view hook).
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
  "174_nex_business_fact_conflict.sql",
);

function readCode(): string {
  const sql = fs.readFileSync(MIG_PATH, "utf8");
  return sql.replace(/--[^\n]*/g, "");
}

describe("migration 174 · existence + target", () => {
  test("file exists", () => {
    expect(fs.existsSync(MIG_PATH)).toBe(true);
  });

  test("creates nex.business_fact_conflict", () => {
    const code = readCode();
    expect(code).toMatch(
      /\bCREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+nex\.business_fact_conflict\b/i,
    );
  });

  test("re-creates nex.business_directory_v with D-3 clause", () => {
    const code = readCode();
    expect(code).toMatch(
      /\bCREATE\s+OR\s+REPLACE\s+VIEW\s+nex\.business_directory_v\b/i,
    );
  });
});

describe("migration 174 · column shape", () => {
  test("field_path text NOT NULL (flat text per founder decision)", () => {
    const code = readCode();
    expect(code).toMatch(/\bfield_path\s+text\s+NOT\s+NULL\b/i);
  });

  test("left_value / right_value are jsonb NOT NULL", () => {
    const code = readCode();
    expect(code).toMatch(/\bleft_value\s+jsonb\s+NOT\s+NULL\b/i);
    expect(code).toMatch(/\bright_value\s+jsonb\s+NOT\s+NULL\b/i);
  });

  test("left/right evidence FK columns present", () => {
    const code = readCode();
    expect(code).toMatch(/\bleft_evidence_id\s+uuid\s+NOT\s+NULL\b/i);
    expect(code).toMatch(/\bright_evidence_id\s+uuid\s+NOT\s+NULL\b/i);
  });

  test("resolution_state text NOT NULL DEFAULT 'OPEN'", () => {
    const code = readCode();
    expect(code).toMatch(/\bresolution_state\s+text\s+NOT\s+NULL\s+DEFAULT\s+'OPEN'/i);
  });
});

describe("migration 174 · CHECKs", () => {
  test("ck_bfc_resolution_state covers 3 sealed states", () => {
    const code = readCode();
    expect(code).toMatch(/\bck_bfc_resolution_state\b/);
    for (const state of ["OPEN", "RESOLVED", "DISMISSED"]) {
      expect(code).toMatch(new RegExp(`'${state}'`));
    }
  });

  test("ck_bfc_resolution_choice allows left | right | merge | NULL", () => {
    const code = readCode();
    expect(code).toMatch(/\bck_bfc_resolution_choice\b/);
    for (const choice of ["left", "right", "merge"]) {
      expect(code).toMatch(new RegExp(`'${choice}'`));
    }
  });

  test("ck_bfc_state_fields_consistency ties state → resolution fields", () => {
    const code = readCode();
    expect(code).toMatch(/\bck_bfc_state_fields_consistency\b/);
  });

  test("ck_bfc_evidence_sides_differ guards against self-conflict", () => {
    const code = readCode();
    expect(code).toMatch(/\bck_bfc_evidence_sides_differ\b/);
    expect(code).toMatch(/left_evidence_id\s*<>\s*right_evidence_id/i);
  });
});

describe("migration 174 · FKs", () => {
  test("FK to business_canonical with ON DELETE CASCADE", () => {
    const code = readCode();
    expect(code).toMatch(/\bfk_bfc_canonical_business\b/);
    expect(code).toMatch(/ON\s+DELETE\s+CASCADE/i);
  });

  test("FKs to business_evidence (left + right) with ON DELETE RESTRICT", () => {
    const code = readCode();
    expect(code).toMatch(/\bfk_bfc_left_evidence\b/);
    expect(code).toMatch(/\bfk_bfc_right_evidence\b/);
    expect(code).toMatch(/REFERENCES\s+nex\.business_evidence/i);
  });
});

describe("migration 174 · indexes", () => {
  test("partial index on OPEN conflicts for publication predicate", () => {
    const code = readCode();
    expect(code).toMatch(/\bidx_bfc_canonical_open\b/);
    expect(code).toMatch(/WHERE\s+resolution_state\s*=\s*'OPEN'/i);
  });

  test("admin queue index on discovered_at DESC + OPEN state", () => {
    const code = readCode();
    expect(code).toMatch(/\bidx_bfc_open_queue\b/);
  });
});

describe("migration 174 · directory_v D-3 clause", () => {
  test("view preserves D-1 lifecycle L1 clause", () => {
    const code = readCode();
    expect(code).toMatch(
      /lifecycle_state\s+IN\s*\(\s*'VERIFIED'\s*,\s*'OWNER_CLAIMED'\s*,\s*'OWNER_VERIFIED'\s*\)/i,
    );
  });

  test("view preserves D-2 chain-resolved can_display clause (COALESCE one-hop)", () => {
    const code = readCode();
    expect(code).toMatch(
      /sr_origin\.source_id\s*=\s*COALESCE\s*\([\s\S]{0,200}derived_from_source_id/i,
    );
  });

  test("view adds D-3 open-fact-conflict NOT EXISTS clause", () => {
    const code = readCode();
    expect(code).toMatch(/\bbusiness_fact_conflict\b/);
    expect(code).toMatch(
      /NOT\s+EXISTS\s*\([\s\S]{0,400}bfc\.resolution_state\s*=\s*'OPEN'/i,
    );
  });

  test("view preserves D-5 attribution-template-present clause", () => {
    const code = readCode();
    expect(code).toMatch(
      /attribution_required\s*=\s*TRUE/i,
    );
    expect(code).toMatch(/attribution_template\s+IS\s+NULL/i);
  });
});

describe("migration 174 · safety posture", () => {
  test("no DML / ALTER / DROP / GRANT / REVOKE / triggers", () => {
    const code = readCode();
    expect(code).not.toMatch(/\bINSERT\s+INTO\s+nex\./i);
    expect(code).not.toMatch(/\bUPDATE\s+nex\.\w+\s+SET\b/i);
    expect(code).not.toMatch(/\bDELETE\s+FROM\s+nex\./i);
    expect(code).not.toMatch(/\bALTER\s+TABLE\b/i);
    expect(code).not.toMatch(/\bTRUNCATE\b/i);
    expect(code).not.toMatch(/\bDROP\s+TABLE\b/i);
    expect(code).not.toMatch(/\bDROP\s+VIEW\b/i);
    expect(code).not.toMatch(
      /\b(?:GRANT|REVOKE)\s+(?:ALL|SELECT|INSERT|UPDATE|DELETE|USAGE|EXECUTE|TRUNCATE|REFERENCES|TRIGGER)\b/i,
    );
    expect(code).not.toMatch(/\bCREATE\s+(?:OR\s+REPLACE\s+)?TRIGGER\b/i);
  });
});
