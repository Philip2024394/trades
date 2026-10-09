// scripts/nex-canonical/migration-176.test.ts
//
// Structural tests for migration 176 (universal business_claim).
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
  "176_nex_business_claim.sql",
);

function readCode(): string {
  const sql = fs.readFileSync(MIG_PATH, "utf8");
  return sql.replace(/--[^\n]*/g, "");
}

describe("migration 176 · existence + target", () => {
  test("file exists", () => {
    expect(fs.existsSync(MIG_PATH)).toBe(true);
  });

  test("creates nex.business_claim", () => {
    const code = readCode();
    expect(code).toMatch(
      /\bCREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+nex\.business_claim\b/i,
    );
  });
});

describe("migration 176 · column shape", () => {
  test("canonical_business_id uuid NOT NULL", () => {
    const code = readCode();
    expect(code).toMatch(/\bcanonical_business_id\s+uuid\s+NOT\s+NULL\b/i);
  });

  test("code_hash text NOT NULL (plaintext never at rest)", () => {
    const code = readCode();
    expect(code).toMatch(/\bcode_hash\s+text\s+NOT\s+NULL\b/i);
  });

  test("claim_channel + destination required", () => {
    const code = readCode();
    expect(code).toMatch(/\bclaim_channel\s+text\s+NOT\s+NULL\b/i);
    expect(code).toMatch(/\bdestination\s+text\s+NOT\s+NULL\b/i);
  });

  test("state text NOT NULL DEFAULT 'PENDING'", () => {
    const code = readCode();
    expect(code).toMatch(/\bstate\s+text\s+NOT\s+NULL\s+DEFAULT\s+'PENDING'/i);
  });

  test("terminal metadata columns present", () => {
    const code = readCode();
    expect(code).toMatch(/\bverified_at\s+timestamptz\s+NULL\b/i);
    expect(code).toMatch(/\bclaimed_by_account_id\s+text\s+NULL\b/i);
    expect(code).toMatch(/\bexpired_at\s+timestamptz\s+NULL\b/i);
    expect(code).toMatch(/\brevoked_at\s+timestamptz\s+NULL\b/i);
  });
});

describe("migration 176 · CHECKs", () => {
  test("ck_bcl_state covers 4 sealed states", () => {
    const code = readCode();
    expect(code).toMatch(/\bck_bcl_state\b/);
    for (const state of ["PENDING", "VERIFIED", "EXPIRED", "REVOKED"]) {
      expect(code).toMatch(new RegExp(`'${state}'`));
    }
  });

  test("ck_bcl_channel covers 4 sealed channels", () => {
    const code = readCode();
    expect(code).toMatch(/\bck_bcl_channel\b/);
    for (const ch of ["whatsapp", "email", "sms", "phone"]) {
      expect(code).toMatch(new RegExp(`'${ch}'`));
    }
  });

  test("expires_at > requested_at", () => {
    const code = readCode();
    expect(code).toMatch(/\bck_bcl_expires_after_requested\b/);
    expect(code).toMatch(/expires_at\s*>\s*requested_at/i);
  });

  test("state_fields_consistency ties state → terminal fields", () => {
    const code = readCode();
    expect(code).toMatch(/\bck_bcl_state_fields_consistency\b/);
  });

  test("non-blank CHECKs on destination / requested_by / code_hash", () => {
    const code = readCode();
    expect(code).toMatch(/\bck_bcl_destination_nonblank\b/);
    expect(code).toMatch(/\bck_bcl_requested_by_nonblank\b/);
    expect(code).toMatch(/\bck_bcl_code_hash_nonblank\b/);
  });

  test("attempt_count >= 0", () => {
    const code = readCode();
    expect(code).toMatch(/\bck_bcl_attempt_count_nonneg\b/);
    expect(code).toMatch(/attempt_count\s*>=\s*0/i);
  });
});

describe("migration 176 · FK + cross-DB owner link", () => {
  test("FK to business_canonical with ON DELETE CASCADE", () => {
    const code = readCode();
    expect(code).toMatch(/\bfk_bcl_canonical_business\b/);
    expect(code).toMatch(/ON\s+DELETE\s+CASCADE/i);
  });

  test("claimed_by_account_id is intentionally text (not FK) because Supabase is cross-DB", () => {
    const code = readCode();
    expect(code).toMatch(/\bclaimed_by_account_id\s+text\s+NULL\b/i);
    // Guard: no FK on claimed_by_account_id (would be cross-DB).
    expect(code).not.toMatch(
      /FOREIGN\s+KEY\s*\(\s*claimed_by_account_id\s*\)/i,
    );
  });
});

describe("migration 176 · indexes", () => {
  test("partial index on PENDING claims by canonical", () => {
    const code = readCode();
    expect(code).toMatch(/\bidx_bcl_canonical_pending\b/);
    expect(code).toMatch(/WHERE\s+state\s*=\s*'PENDING'/i);
  });

  test("partial index on PENDING expiring soon", () => {
    const code = readCode();
    expect(code).toMatch(/\bidx_bcl_pending_expires\b/);
  });

  test("partial index on verified claims by claimed_by_account_id", () => {
    const code = readCode();
    expect(code).toMatch(/\bidx_bcl_claimed_by_account\b/);
    expect(code).toMatch(/state\s*=\s*'VERIFIED'/i);
  });
});

describe("migration 176 · safety posture", () => {
  test("no DML / ALTER on existing tables", () => {
    const code = readCode();
    expect(code).not.toMatch(/\bINSERT\s+INTO\s+nex\./i);
    expect(code).not.toMatch(/\bUPDATE\s+nex\.\w+\s+SET\b/i);
    expect(code).not.toMatch(/\bDELETE\s+FROM\s+nex\./i);
    expect(code).not.toMatch(/\bALTER\s+TABLE\s+nex\.food_claim_code\b/i);
    expect(code).not.toMatch(/\bTRUNCATE\b/i);
  });

  test("does NOT drop or ALTER nex.food_claim_code (coexistence)", () => {
    const code = readCode();
    expect(code).not.toMatch(/\bDROP\s+TABLE[\s\S]{0,80}nex\.food_claim_code/i);
  });

  test("no GRANT/REVOKE / triggers", () => {
    const code = readCode();
    expect(code).not.toMatch(
      /\b(?:GRANT|REVOKE)\s+(?:ALL|SELECT|INSERT|UPDATE|DELETE|USAGE|EXECUTE|TRUNCATE|REFERENCES|TRIGGER)\b/i,
    );
    expect(code).not.toMatch(/\bCREATE\s+(?:OR\s+REPLACE\s+)?TRIGGER\b/i);
  });
});
