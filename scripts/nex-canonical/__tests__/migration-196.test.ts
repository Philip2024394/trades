// scripts/nex-canonical/__tests__/migration-196.test.ts
//
// Structural tests for migration 196 (multi-channel trusted-contact
// extension: email + phone + surrogate PK).
// Pure · read-only inspection of the SQL file. No DB. No network.

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
  "196_nex_emergency_trusted_contact_channels.sql",
);

function readCode(): string {
  const sql = fs.readFileSync(MIG_PATH, "utf8");
  return sql.replace(/--[^\n]*/g, "");
}

describe("migration 196 · existence + target", () => {
  test("file exists", () => {
    expect(fs.existsSync(MIG_PATH)).toBe(true);
  });

  test("file is non-trivially sized (>1KB)", () => {
    const raw = fs.readFileSync(MIG_PATH, "utf8");
    expect(raw.length).toBeGreaterThan(1024);
  });

  test("targets nex.trusted_contact (ALTER TABLE)", () => {
    expect(readCode()).toMatch(/\bALTER\s+TABLE\s+nex\.trusted_contact\b/i);
  });

  test("creates NO new tables (ALTER-only migration)", () => {
    expect(readCode()).not.toMatch(/\bCREATE\s+TABLE\b/i);
  });
});

describe("migration 196 · relax contact_account_id NOT NULL", () => {
  test("drops the NOT NULL on contact_account_id", () => {
    expect(readCode()).toMatch(
      /ALTER\s+COLUMN\s+contact_account_id\s+DROP\s+NOT\s+NULL/i,
    );
  });
});

describe("migration 196 · new channel columns", () => {
  test("adds contact_email text NULL (IF NOT EXISTS)", () => {
    expect(readCode()).toMatch(
      /ADD\s+COLUMN\s+IF\s+NOT\s+EXISTS\s+contact_email\s+text\s+NULL/i,
    );
  });

  test("adds contact_phone text NULL (IF NOT EXISTS)", () => {
    expect(readCode()).toMatch(
      /ADD\s+COLUMN\s+IF\s+NOT\s+EXISTS\s+contact_phone\s+text\s+NULL/i,
    );
  });

  test("adds trusted_contact_id uuid (IF NOT EXISTS)", () => {
    expect(readCode()).toMatch(
      /ADD\s+COLUMN\s+IF\s+NOT\s+EXISTS\s+trusted_contact_id\s+uuid/i,
    );
  });

  test("trusted_contact_id defaults to gen_random_uuid()", () => {
    expect(readCode()).toMatch(/trusted_contact_id[\s\S]*?gen_random_uuid\(\)/i);
  });
});

describe("migration 196 · PK repack", () => {
  test("drops the old composite PK (pk_tc_owner_contact)", () => {
    expect(readCode()).toMatch(
      /DROP\s+CONSTRAINT\s+IF\s+EXISTS\s+pk_tc_owner_contact/i,
    );
  });

  test("also guards the Postgres-default PK name", () => {
    expect(readCode()).toMatch(
      /DROP\s+CONSTRAINT\s+IF\s+EXISTS\s+trusted_contact_pkey/i,
    );
  });

  test("adds the surrogate PK on trusted_contact_id", () => {
    expect(readCode()).toMatch(
      /ADD\s+CONSTRAINT\s+trusted_contact_pkey\s+PRIMARY\s+KEY\s*\(\s*trusted_contact_id\s*\)/i,
    );
  });
});

describe("migration 196 · partial unique indexes", () => {
  test("owner+account partial unique", () => {
    const code = readCode();
    expect(code).toMatch(/CREATE\s+UNIQUE\s+INDEX\s+IF\s+NOT\s+EXISTS\s+trusted_contact_owner_account_uq/i);
    expect(code).toMatch(/WHERE\s+contact_account_id\s+IS\s+NOT\s+NULL/i);
  });

  test("owner+email partial unique on lower(contact_email)", () => {
    const code = readCode();
    expect(code).toMatch(/trusted_contact_owner_email_uq/i);
    expect(code).toMatch(/lower\(contact_email\)/i);
    expect(code).toMatch(/WHERE\s+contact_email\s+IS\s+NOT\s+NULL/i);
  });

  test("owner+phone partial unique", () => {
    const code = readCode();
    expect(code).toMatch(/trusted_contact_owner_phone_uq/i);
    expect(code).toMatch(/WHERE\s+contact_phone\s+IS\s+NOT\s+NULL/i);
  });
});

describe("migration 196 · CHECKs", () => {
  test("email shape CHECK requires @", () => {
    expect(readCode()).toMatch(/position\('@'\s+in\s+contact_email\)\s*>\s*1/i);
  });

  test("phone length CHECK is 5..20", () => {
    expect(readCode()).toMatch(/length\(contact_phone\)\s+BETWEEN\s+5\s+AND\s+20/i);
  });

  test("at-least-one-identifier CHECK present", () => {
    const code = readCode();
    expect(code).toMatch(/trusted_contact_at_least_one_identifier/i);
    expect(code).toMatch(/contact_account_id\s+IS\s+NOT\s+NULL/i);
    expect(code).toMatch(/contact_email\s+IS\s+NOT\s+NULL/i);
    expect(code).toMatch(/contact_phone\s+IS\s+NOT\s+NULL/i);
  });
});

describe("migration 196 · idempotence + doctrine", () => {
  test("transaction wrapper · BEGIN + COMMIT present", () => {
    const code = readCode();
    expect(code).toMatch(/\bBEGIN\s*;/i);
    expect(code).toMatch(/\bCOMMIT\s*;/i);
  });

  test("zero DML (no INSERT / UPDATE / DELETE)", () => {
    const code = readCode();
    expect(code).not.toMatch(/\bINSERT\s+INTO\b/i);
    expect(code).not.toMatch(/\bUPDATE\s+\w+\s+SET\b/i);
    expect(code).not.toMatch(/\bDELETE\s+FROM\b/i);
  });

  test("every DROP CONSTRAINT uses IF EXISTS", () => {
    const code = readCode();
    const drops = code.match(/\bDROP\s+CONSTRAINT\s+(?:IF\s+EXISTS\s+)?/gi) ?? [];
    const guarded = code.match(/\bDROP\s+CONSTRAINT\s+IF\s+EXISTS\b/gi) ?? [];
    expect(guarded.length).toBe(drops.length);
    expect(drops.length).toBeGreaterThan(0);
  });

  test("every ADD COLUMN uses IF NOT EXISTS", () => {
    const code = readCode();
    const adds = code.match(/\bADD\s+COLUMN\s+(?:IF\s+NOT\s+EXISTS\s+)?/gi) ?? [];
    const guarded = code.match(/\bADD\s+COLUMN\s+IF\s+NOT\s+EXISTS\b/gi) ?? [];
    expect(guarded.length).toBe(adds.length);
    expect(adds.length).toBeGreaterThan(0);
  });

  test("every CREATE INDEX uses IF NOT EXISTS", () => {
    const code = readCode();
    const creates = code.match(/\bCREATE\s+(?:UNIQUE\s+)?INDEX\s+(?:IF\s+NOT\s+EXISTS\s+)?/gi) ?? [];
    const guarded = code.match(/\bCREATE\s+(?:UNIQUE\s+)?INDEX\s+IF\s+NOT\s+EXISTS\b/gi) ?? [];
    expect(guarded.length).toBe(creates.length);
    expect(creates.length).toBeGreaterThan(0);
  });

  test("header documents the attacker-removes-phone threat model", () => {
    const raw = fs.readFileSync(MIG_PATH, "utf8");
    expect(raw).toMatch(/attacker-removes-phone/i);
  });

  test("header names the three identifier channels", () => {
    const raw = fs.readFileSync(MIG_PATH, "utf8");
    expect(raw).toMatch(/account/i);
    expect(raw).toMatch(/email/i);
    expect(raw).toMatch(/phone/i);
  });
});
