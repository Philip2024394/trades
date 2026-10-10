// scripts/nex-canonical/__tests__/migration-200.test.ts
//
// Structural tests for migration 200 · NEX Family Links FS-2 primitives
// (pressure_report + revocation_cooldown). Pure · read-only inspection
// of the SQL file. No DB. No network.

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
  "200_nex_family_link_pressure_and_cooldown.sql",
);

function readCode(): string {
  const sql = fs.readFileSync(MIG_PATH, "utf8");
  return sql
    .replace(/--[^\n]*/g, "")
    .replace(/COMMENT\s+ON\s+(?:TABLE|COLUMN)\s+[\s\S]*?;/gi, "");
}

describe("migration 200 · existence + target", () => {
  test("file exists", () => {
    expect(fs.existsSync(MIG_PATH)).toBe(true);
  });

  test("file is non-trivially sized (>2KB)", () => {
    const raw = fs.readFileSync(MIG_PATH, "utf8");
    expect(raw.length).toBeGreaterThan(2048);
  });

  test("creates nex.family_link_pressure_report table", () => {
    expect(readCode()).toMatch(
      /CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+nex\.family_link_pressure_report/i,
    );
  });

  test("creates nex.family_link_revocation_cooldown table", () => {
    expect(readCode()).toMatch(
      /CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+nex\.family_link_revocation_cooldown/i,
    );
  });
});

describe("migration 200 · pressure_report columns", () => {
  test("report_id uuid PK with default", () => {
    expect(readCode()).toMatch(
      /report_id\s+uuid\s+PRIMARY\s+KEY\s+DEFAULT\s+gen_random_uuid\(\)/i,
    );
  });

  test("link_id uuid NOT NULL REFERENCES nex.family_link ON DELETE CASCADE", () => {
    const code = readCode();
    expect(code).toMatch(/link_id\s+uuid\s+NOT\s+NULL/i);
    expect(code).toMatch(
      /REFERENCES\s+nex\.family_link\s*\(\s*link_id\s*\)\s+ON\s+DELETE\s+CASCADE/i,
    );
  });

  test("reporter_account_id text NOT NULL", () => {
    expect(readCode()).toMatch(/reporter_account_id\s+text\s+NOT\s+NULL/i);
  });

  test("reason_code CHECK contains all 5 sealed values", () => {
    const code = readCode();
    for (const r of [
      "coerced",
      "threatened",
      "unknown_inviter",
      "not_my_family",
      "other",
    ]) {
      expect(code).toMatch(new RegExp(`'${r}'`));
    }
  });

  test("reason_notes text NULL with 1..500 bound", () => {
    expect(readCode()).toMatch(
      /reason_notes\s+text\s+NULL[\s\S]*BETWEEN\s+1\s+AND\s+500/i,
    );
  });

  test("reported_against_account_id text NOT NULL", () => {
    expect(readCode()).toMatch(
      /reported_against_account_id\s+text\s+NOT\s+NULL/i,
    );
  });

  test("state CHECK contains all 5 sealed values", () => {
    const code = readCode();
    for (const s of [
      "open",
      "under_review",
      "resolved_safe",
      "resolved_unsafe",
      "withdrawn",
    ]) {
      expect(code).toMatch(new RegExp(`'${s}'`));
    }
  });

  test("state default is 'open'", () => {
    expect(readCode()).toMatch(/state\s+text\s+NOT\s+NULL\s+DEFAULT\s+'open'/i);
  });

  test("simulated boolean NOT NULL DEFAULT TRUE present in both tables", () => {
    const code = readCode();
    const matches = code.match(
      /simulated\s+boolean\s+NOT\s+NULL\s+DEFAULT\s+TRUE/gi,
    );
    expect(matches && matches.length).toBeGreaterThanOrEqual(2);
  });

  test("reported_at NOT NULL DEFAULT now()", () => {
    expect(readCode()).toMatch(
      /reported_at\s+timestamptz\s+NOT\s+NULL\s+DEFAULT\s+now\(\)/i,
    );
  });
});

describe("migration 200 · pressure_report indexes", () => {
  test("link + time DESC lookup index", () => {
    const code = readCode();
    expect(code).toMatch(/family_link_pressure_report_link_time_idx/);
    expect(code).toMatch(/link_id\s*,\s*reported_at\s+DESC/i);
  });

  test("state + time DESC HQ queue index", () => {
    const code = readCode();
    expect(code).toMatch(/family_link_pressure_report_state_time_idx/);
    expect(code).toMatch(/state\s*,\s*reported_at\s+DESC/i);
  });

  test("UNIQUE partial index on (link_id, reporter) WHERE state='open'", () => {
    const code = readCode();
    expect(code).toMatch(
      /CREATE\s+UNIQUE\s+INDEX\s+IF\s+NOT\s+EXISTS\s+family_link_pressure_report_reporter_open_uq/i,
    );
    expect(code).toMatch(/WHERE\s+state\s*=\s*'open'/i);
  });
});

describe("migration 200 · revocation_cooldown columns", () => {
  test("cooldown_id uuid PK with default", () => {
    expect(readCode()).toMatch(
      /cooldown_id\s+uuid\s+PRIMARY\s+KEY\s+DEFAULT\s+gen_random_uuid\(\)/i,
    );
  });

  test("link_id uuid NOT NULL REFERENCES nex.family_link ON DELETE CASCADE", () => {
    const code = readCode();
    // Both tables FK to family_link · we expect >=2 CASCADE references.
    const casc = code.match(
      /REFERENCES\s+nex\.family_link\s*\(\s*link_id\s*\)\s+ON\s+DELETE\s+CASCADE/gi,
    );
    expect(casc && casc.length).toBeGreaterThanOrEqual(2);
  });

  test("initiated_by_account_id text NOT NULL", () => {
    expect(readCode()).toMatch(/initiated_by_account_id\s+text\s+NOT\s+NULL/i);
  });

  test("effective_at timestamptz NOT NULL (no default · service-set)", () => {
    expect(readCode()).toMatch(/effective_at\s+timestamptz\s+NOT\s+NULL/i);
  });

  test("bypass + founder-override reserved columns present", () => {
    const code = readCode();
    expect(code).toMatch(
      /bypass_confirmed_by_other_party\s+boolean\s+NOT\s+NULL\s+DEFAULT\s+FALSE/i,
    );
    expect(code).toMatch(/bypass_confirmed_at\s+timestamptz\s+NULL/i);
    expect(code).toMatch(/founder_override\s+boolean\s+NOT\s+NULL\s+DEFAULT\s+FALSE/i);
    expect(code).toMatch(/founder_override_authorised_by\s+text\s+NULL/i);
  });

  test("state CHECK contains all 3 sealed values with default 'pending'", () => {
    const code = readCode();
    expect(code).toMatch(/state\s+text\s+NOT\s+NULL\s+DEFAULT\s+'pending'/i);
    for (const s of ["pending", "applied", "cancelled"]) {
      expect(code).toMatch(new RegExp(`'${s}'`));
    }
  });
});

describe("migration 200 · revocation_cooldown indexes", () => {
  test("UNIQUE partial index on link_id WHERE state='pending'", () => {
    const code = readCode();
    expect(code).toMatch(
      /CREATE\s+UNIQUE\s+INDEX\s+IF\s+NOT\s+EXISTS\s+family_link_revocation_cooldown_link_pending_uq/i,
    );
    expect(code).toMatch(/WHERE\s+state\s*=\s*'pending'/i);
  });

  test("effective-time sweep index on pending rows", () => {
    const code = readCode();
    expect(code).toMatch(
      /family_link_revocation_cooldown_effective_time_idx/,
    );
    expect(code).toMatch(/state\s*,\s*effective_at/i);
  });
});

describe("migration 200 · idempotence + doctrine + non-vendor guarantees", () => {
  test("every CREATE INDEX uses IF NOT EXISTS", () => {
    const code = readCode();
    const creates =
      code.match(/\bCREATE\s+(?:UNIQUE\s+)?INDEX\s+(?:IF\s+NOT\s+EXISTS\s+)?/gi) ?? [];
    const guarded =
      code.match(/\bCREATE\s+(?:UNIQUE\s+)?INDEX\s+IF\s+NOT\s+EXISTS\b/gi) ?? [];
    expect(guarded.length).toBe(creates.length);
    expect(creates.length).toBeGreaterThan(0);
  });

  test("every CREATE TABLE uses IF NOT EXISTS", () => {
    const code = readCode();
    const creates = code.match(/\bCREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?/gi) ?? [];
    const guarded = code.match(/\bCREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\b/gi) ?? [];
    expect(guarded.length).toBe(creates.length);
  });

  test("zero DML", () => {
    const code = readCode();
    expect(code).not.toMatch(/\bINSERT\s+INTO\b/i);
    expect(code).not.toMatch(/\bUPDATE\s+\w+\s+SET\b/i);
    expect(code).not.toMatch(/\bDELETE\s+FROM\b/i);
  });

  test("header documents HQ-only + no counterparty notification", () => {
    const raw = fs.readFileSync(MIG_PATH, "utf8");
    expect(raw).toMatch(/HQ-only/i);
    expect(raw).toMatch(/NEVER\s+notified/i);
  });

  test("header documents the simulated-TRUE pilot gate", () => {
    const raw = fs.readFileSync(MIG_PATH, "utf8");
    expect(raw).toMatch(/simulated=TRUE/i);
    expect(raw).toMatch(/PILOT/i);
  });

  test("schema is vendor-agnostic · no verifier / notifier identifier columns", () => {
    const code = readCode();
    expect(code).not.toMatch(/yoti/i);
    expect(code).not.toMatch(/jumio/i);
    expect(code).not.toMatch(/veriff/i);
    expect(code).not.toMatch(/onfido/i);
    expect(code).not.toMatch(/stripe_identity/i);
    expect(code).not.toMatch(/verifier_id/i);
    expect(code).not.toMatch(/twilio/i);
    expect(code).not.toMatch(/sendgrid/i);
  });

  test("schema does NOT capture ID-document or biometric data", () => {
    const code = readCode();
    expect(code).not.toMatch(/id_document/i);
    expect(code).not.toMatch(/passport/i);
    expect(code).not.toMatch(/biometric/i);
    expect(code).not.toMatch(/face_hash/i);
    expect(code).not.toMatch(/selfie/i);
  });
});
