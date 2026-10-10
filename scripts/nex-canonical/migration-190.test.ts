// scripts/nex-canonical/migration-190.test.ts
//
// Structural tests for migration 190 (business_claim_draft).
// Pure · read-only inspection of the SQL file. No DB. No network.
//
// Shape mirrors scripts/nex-canonical/migration-168.test.ts.

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
  "190_nex_business_claim_draft.sql",
);

function readCode(): string {
  const sql = fs.readFileSync(MIG_PATH, "utf8");
  // Strip SQL line comments so we don't accidentally match words that
  // only appear in the header prose.
  return sql.replace(/--[^\n]*/g, "");
}

describe("migration 190 · existence + target", () => {
  test("file exists", () => {
    expect(fs.existsSync(MIG_PATH)).toBe(true);
  });

  test("creates nex.business_claim_draft", () => {
    const code = readCode();
    expect(code).toMatch(
      /\bCREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+nex\.business_claim_draft\b/i,
    );
  });
});

describe("migration 190 · columns", () => {
  test("has draft_id uuid PRIMARY KEY DEFAULT gen_random_uuid()", () => {
    const code = readCode();
    expect(code).toMatch(
      /\bdraft_id\s+uuid\s+PRIMARY\s+KEY\s+DEFAULT\s+gen_random_uuid\(\)/i,
    );
  });

  test("has canonical_business_id uuid NOT NULL", () => {
    const code = readCode();
    expect(code).toMatch(/\bcanonical_business_id\s+uuid\s+NOT\s+NULL\b/i);
  });

  test("has draft_fingerprint text NOT NULL", () => {
    const code = readCode();
    expect(code).toMatch(/\bdraft_fingerprint\s+text\s+NOT\s+NULL\b/i);
  });

  test("has draft_json jsonb NOT NULL", () => {
    const code = readCode();
    expect(code).toMatch(/\bdraft_json\s+jsonb\s+NOT\s+NULL\b/i);
  });

  test("has contact_channel text NULL", () => {
    const code = readCode();
    expect(code).toMatch(/\bcontact_channel\s+text\s+NULL\b/i);
  });

  test("has contact_destination text NULL", () => {
    const code = readCode();
    expect(code).toMatch(/\bcontact_destination\s+text\s+NULL\b/i);
  });

  test("has status text NOT NULL DEFAULT 'draft'", () => {
    const code = readCode();
    expect(code).toMatch(
      /\bstatus\s+text\s+NOT\s+NULL\s+DEFAULT\s+'draft'/i,
    );
  });

  test("has last_touched_at timestamptz NOT NULL DEFAULT now()", () => {
    const code = readCode();
    expect(code).toMatch(
      /\blast_touched_at\s+timestamptz\s+NOT\s+NULL\s+DEFAULT\s+now\(\)/i,
    );
  });

  test("has expires_at timestamptz NOT NULL with 30-day default", () => {
    const code = readCode();
    expect(code).toMatch(
      /\bexpires_at\s+timestamptz\s+NOT\s+NULL\s+DEFAULT[\s\S]{1,80}interval\s+'30\s+days'/i,
    );
  });

  test("has created_at timestamptz NOT NULL DEFAULT now()", () => {
    const code = readCode();
    expect(code).toMatch(
      /\bcreated_at\s+timestamptz\s+NOT\s+NULL\s+DEFAULT\s+now\(\)/i,
    );
  });
});

describe("migration 190 · CHECK constraints", () => {
  test("CHECK ck_bcd_fingerprint_len enforces 8..128", () => {
    const code = readCode();
    expect(code).toMatch(/\bck_bcd_fingerprint_len\b/);
    expect(code).toMatch(
      /length\s*\(\s*draft_fingerprint\s*\)\s+BETWEEN\s+8\s+AND\s+128/i,
    );
  });

  test("CHECK ck_bcd_contact_channel covers the 4 sealed channels", () => {
    const code = readCode();
    expect(code).toMatch(/\bck_bcd_contact_channel\b/);
    for (const channel of ["whatsapp", "email", "sms", "phone"]) {
      expect(code).toMatch(new RegExp(`'${channel}'`));
    }
  });

  test("CHECK ck_bcd_contact_destination_nonblank forces non-blank when set", () => {
    const code = readCode();
    expect(code).toMatch(/\bck_bcd_contact_destination_nonblank\b/);
    expect(code).toMatch(
      /length\s*\(\s*trim\s*\(\s*contact_destination\s*\)\s*\)\s*>\s*0/i,
    );
  });

  test("CHECK ck_bcd_contact_destination_len caps at 160", () => {
    const code = readCode();
    expect(code).toMatch(/\bck_bcd_contact_destination_len\b/);
    expect(code).toMatch(
      /length\s*\(\s*contact_destination\s*\)\s*<=\s*160/i,
    );
  });

  test("CHECK ck_bcd_status covers all 7 lifecycle states", () => {
    const code = readCode();
    expect(code).toMatch(/\bck_bcd_status\b/);
    for (const state of [
      "draft",
      "contact_pending",
      "code_requested",
      "verified",
      "abandoned",
      "rejected",
      "blocked",
    ]) {
      expect(code).toMatch(new RegExp(`'${state}'`));
    }
  });

  test("CHECK ck_bcd_expires_after_created", () => {
    const code = readCode();
    expect(code).toMatch(/\bck_bcd_expires_after_created\b/);
    expect(code).toMatch(/expires_at\s*>\s*created_at/i);
  });
});

describe("migration 190 · uniqueness + FKs", () => {
  test("UNIQUE (canonical_business_id, draft_fingerprint)", () => {
    const code = readCode();
    expect(code).toMatch(/\buq_bcd_canonical_fingerprint\b/);
    expect(code).toMatch(
      /UNIQUE\s*\(\s*canonical_business_id\s*,\s*draft_fingerprint\s*\)/i,
    );
  });

  test("FK to business_canonical with ON DELETE CASCADE", () => {
    const code = readCode();
    expect(code).toMatch(/\bfk_bcd_canonical_business\b/);
    expect(code).toMatch(
      /FOREIGN\s+KEY\s*\(\s*canonical_business_id\s*\)[\s\S]{1,200}REFERENCES\s+nex\.business_canonical/i,
    );
    expect(code).toMatch(/ON\s+DELETE\s+CASCADE/i);
  });
});

describe("migration 190 · indexes", () => {
  test("retention sweep index on (status, expires_at)", () => {
    const code = readCode();
    expect(code).toMatch(/\bidx_bcd_status_expires\b/);
    expect(code).toMatch(
      /ON\s+nex\.business_claim_draft\s*\(\s*status\s*,\s*expires_at\s*\)/i,
    );
  });

  test("per-listing admin index on (canonical_business_id, status)", () => {
    const code = readCode();
    expect(code).toMatch(/\bidx_bcd_canonical_status\b/);
    expect(code).toMatch(
      /ON\s+nex\.business_claim_draft\s*\(\s*canonical_business_id\s*,\s*status\s*\)/i,
    );
  });
});

describe("migration 190 · safety posture", () => {
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

  test("no ALTER of other tables (zero-risk additive)", () => {
    const code = readCode();
    expect(code).not.toMatch(/\bALTER\s+TABLE\s+nex\.business_canonical\b/i);
    expect(code).not.toMatch(/\bALTER\s+TABLE\s+nex\.business_claim\b/i);
  });
});
