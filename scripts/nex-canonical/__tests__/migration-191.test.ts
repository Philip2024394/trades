// scripts/nex-canonical/__tests__/migration-191.test.ts
//
// Structural tests for migration 191 (nex.cross_db_reconcile_log).
//
// Pure · read-only inspection of the SQL file. No DB. No network.
//
// Shape mirrors scripts/nex-canonical/migration-168.test.ts.
//
// Run with:
//   npx vitest run scripts/nex-canonical/__tests__/migration-191.test.ts

import { describe, expect, test } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const MIG_PATH = path.join(
  __dirname,
  "..",
  "..",
  "..",
  "deploy",
  "postgres",
  "init",
  "191_nex_cross_db_reconcile_log.sql",
);

function readCode(): string {
  const sql = fs.readFileSync(MIG_PATH, "utf8");
  // Strip SQL line comments so we don't accidentally match words that
  // only appear in the header prose.
  return sql.replace(/--[^\n]*/g, "");
}

describe("migration 191 · existence + target", () => {
  test("file exists", () => {
    expect(fs.existsSync(MIG_PATH)).toBe(true);
  });

  test("creates nex.cross_db_reconcile_log with IF NOT EXISTS", () => {
    const code = readCode();
    expect(code).toMatch(
      /\bCREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+nex\.cross_db_reconcile_log\b/i,
    );
  });
});

describe("migration 191 · columns + types", () => {
  test("log_id uuid PRIMARY KEY default gen_random_uuid()", () => {
    const code = readCode();
    expect(code).toMatch(
      /\blog_id\s+uuid\s+PRIMARY\s+KEY\s+DEFAULT\s+gen_random_uuid\(\)/i,
    );
  });

  test("event_type text NOT NULL", () => {
    const code = readCode();
    expect(code).toMatch(/\bevent_type\s+text\s+NOT\s+NULL\b/i);
  });

  test("claim_id uuid NULL", () => {
    const code = readCode();
    expect(code).toMatch(/\bclaim_id\s+uuid\s+NULL\b/i);
  });

  test("canonical_business_id uuid NULL", () => {
    const code = readCode();
    expect(code).toMatch(/\bcanonical_business_id\s+uuid\s+NULL\b/i);
  });

  test("supabase_account_id text NULL", () => {
    const code = readCode();
    expect(code).toMatch(/\bsupabase_account_id\s+text\s+NULL\b/i);
  });

  test("affected_rows integer NULL", () => {
    const code = readCode();
    expect(code).toMatch(/\baffected_rows\s+integer\s+NULL\b/i);
  });

  test("error_code text NULL", () => {
    const code = readCode();
    expect(code).toMatch(/\berror_code\s+text\s+NULL\b/i);
  });

  test("error_detail text NULL", () => {
    const code = readCode();
    expect(code).toMatch(/\berror_detail\s+text\s+NULL\b/i);
  });

  test("idempotency_key text NOT NULL", () => {
    const code = readCode();
    expect(code).toMatch(/\bidempotency_key\s+text\s+NOT\s+NULL\b/i);
  });

  test("simulated boolean NOT NULL DEFAULT TRUE", () => {
    const code = readCode();
    expect(code).toMatch(/\bsimulated\s+boolean\s+NOT\s+NULL\s+DEFAULT\s+TRUE\b/i);
  });

  test("attempt_number integer NOT NULL DEFAULT 1", () => {
    const code = readCode();
    expect(code).toMatch(/\battempt_number\s+integer\s+NOT\s+NULL\s+DEFAULT\s+1\b/i);
  });

  test("created_at timestamptz NOT NULL DEFAULT now()", () => {
    const code = readCode();
    expect(code).toMatch(
      /\bcreated_at\s+timestamptz\s+NOT\s+NULL\s+DEFAULT\s+now\(\)/i,
    );
  });
});

describe("migration 191 · CHECK constraints", () => {
  test("ck_cdrl_event_type covers all 9 sealed event types", () => {
    const code = readCode();
    expect(code).toMatch(/\bck_cdrl_event_type\b/);
    for (const evt of [
      "link_attempted",
      "link_succeeded",
      "link_updated_existing",
      "link_created_stub",
      "link_ambiguous",
      "link_failed",
      "retry_scheduled",
      "orphan_detected",
      "sweep_run",
    ]) {
      expect(code).toMatch(new RegExp(`'${evt}'`));
    }
  });

  test("ck_cdrl_idempotency_key_len bounds length 1..64", () => {
    const code = readCode();
    expect(code).toMatch(/\bck_cdrl_idempotency_key_len\b/);
    expect(code).toMatch(/length\s*\(\s*idempotency_key\s*\)\s+BETWEEN\s+1\s+AND\s+64/i);
  });

  test("ck_cdrl_attempt_number bounds attempts 1..10", () => {
    const code = readCode();
    expect(code).toMatch(/\bck_cdrl_attempt_number\b/);
    expect(code).toMatch(/attempt_number\s*>=\s*1/i);
    expect(code).toMatch(/attempt_number\s*<=\s*10/i);
  });

  test("ck_cdrl_affected_rows allows NULL or non-negative", () => {
    const code = readCode();
    expect(code).toMatch(/\bck_cdrl_affected_rows\b/);
    expect(code).toMatch(/affected_rows\s+IS\s+NULL\s+OR\s+affected_rows\s*>=\s*0/i);
  });

  test("ck_cdrl_error_detail_len caps error_detail at 2000 chars", () => {
    const code = readCode();
    expect(code).toMatch(/\bck_cdrl_error_detail_len\b/);
    expect(code).toMatch(/length\s*\(\s*error_detail\s*\)\s*<=\s*2000/i);
  });

  test("ck_cdrl_error_code_len bounds error_code 1..64 chars", () => {
    const code = readCode();
    expect(code).toMatch(/\bck_cdrl_error_code_len\b/);
    expect(code).toMatch(/length\s*\(\s*error_code\s*\)\s+BETWEEN\s+1\s+AND\s+64/i);
  });
});

describe("migration 191 · FKs", () => {
  test("FK to business_claim with ON DELETE SET NULL", () => {
    const code = readCode();
    expect(code).toMatch(/\bfk_cdrl_claim\b/);
    expect(code).toMatch(
      /FOREIGN\s+KEY\s*\(\s*claim_id\s*\)[\s\S]{1,200}REFERENCES\s+nex\.business_claim\s*\(\s*claim_id\s*\)[\s\S]{1,200}ON\s+DELETE\s+SET\s+NULL/i,
    );
  });

  test("FK to business_canonical with ON DELETE SET NULL", () => {
    const code = readCode();
    expect(code).toMatch(/\bfk_cdrl_canonical_business\b/);
    expect(code).toMatch(
      /FOREIGN\s+KEY\s*\(\s*canonical_business_id\s*\)[\s\S]{1,200}REFERENCES\s+nex\.business_canonical\s*\(\s*canonical_business_id\s*\)[\s\S]{1,200}ON\s+DELETE\s+SET\s+NULL/i,
    );
  });
});

describe("migration 191 · indexes", () => {
  test("UNIQUE on (idempotency_key, attempt_number)", () => {
    const code = readCode();
    expect(code).toMatch(/\bcross_db_reconcile_log_idem_uq\b/);
    expect(code).toMatch(
      /CREATE\s+UNIQUE\s+INDEX\s+IF\s+NOT\s+EXISTS\s+cross_db_reconcile_log_idem_uq[\s\S]{1,200}\(\s*idempotency_key\s*,\s*attempt_number\s*\)/i,
    );
  });

  test("claim-centric index on (claim_id, created_at DESC)", () => {
    const code = readCode();
    expect(code).toMatch(/\bcross_db_reconcile_log_claim_idx\b/);
    expect(code).toMatch(/claim_id\s*,\s*created_at\s+DESC/i);
  });

  test("recent-events index on (created_at DESC)", () => {
    const code = readCode();
    expect(code).toMatch(/\bcross_db_reconcile_log_recent_idx\b/);
    expect(code).toMatch(
      /CREATE\s+INDEX\s+IF\s+NOT\s+EXISTS\s+cross_db_reconcile_log_recent_idx[\s\S]{1,200}\(\s*created_at\s+DESC\s*\)/i,
    );
  });
});

describe("migration 191 · safety posture", () => {
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

  test("no ALTER of pre-existing tables", () => {
    const code = readCode();
    expect(code).not.toMatch(/\bALTER\s+TABLE\s+nex\.business_claim\b/i);
    expect(code).not.toMatch(/\bALTER\s+TABLE\s+nex\.business_canonical\b/i);
  });
});
