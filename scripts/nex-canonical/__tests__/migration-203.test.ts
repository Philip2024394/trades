// scripts/nex-canonical/__tests__/migration-203.test.ts
//
// Structural tests for migration 203 (NEX Family Safety · Child Account
// Creation Request · Phase 1 · simulated=TRUE).

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
  "203_nex_child_account_creation_request.sql",
);

function readCode(): string {
  const sql = fs.readFileSync(MIG_PATH, "utf8");
  return sql.replace(/--[^\n]*/g, "");
}

describe("migration 203 · existence + target", () => {
  test("file exists", () => {
    expect(fs.existsSync(MIG_PATH)).toBe(true);
  });

  test("file is non-trivially sized (>2KB)", () => {
    const raw = fs.readFileSync(MIG_PATH, "utf8");
    expect(raw.length).toBeGreaterThan(2048);
  });

  test("creates nex.child_account_creation_request table", () => {
    expect(readCode()).toMatch(
      /CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+nex\.child_account_creation_request/i,
    );
  });
});

describe("migration 203 · columns + CHECKs", () => {
  test("request_id uuid PK with default", () => {
    expect(readCode()).toMatch(
      /request_id\s+uuid\s+PRIMARY\s+KEY\s+DEFAULT\s+gen_random_uuid\(\)/i,
    );
  });

  test("parent_account_id text NOT NULL", () => {
    expect(readCode()).toMatch(/parent_account_id\s+text\s+NOT\s+NULL/i);
  });

  test("child_display_name CHECK length BETWEEN 1 AND 60", () => {
    const code = readCode();
    expect(code).toMatch(/child_display_name\s+text\s+NOT\s+NULL/i);
    expect(code).toMatch(/length\(trim\(child_display_name\)\)\s+BETWEEN\s+1\s+AND\s+60/i);
  });

  test("child_declared_date_of_birth CHECK > 1900 and <= CURRENT_DATE", () => {
    const code = readCode();
    expect(code).toMatch(/child_declared_date_of_birth\s+date\s+NOT\s+NULL/i);
    expect(code).toMatch(/child_declared_date_of_birth\s*>\s*'1900-01-01'/i);
    expect(code).toMatch(/child_declared_date_of_birth\s*<=\s*CURRENT_DATE/i);
  });

  test("id_submission_id REFERENCES id_verification_submission ON DELETE SET NULL", () => {
    expect(readCode()).toMatch(
      /id_submission_id[\s\S]*?REFERENCES\s+nex\.id_verification_submission[\s\S]*?ON\s+DELETE\s+SET\s+NULL/i,
    );
  });

  test("state CHECK includes all 8 sealed states", () => {
    const code = readCode();
    for (const s of [
      "draft",
      "id_pending_verification",
      "id_verified",
      "id_rejected",
      "awaiting_legal_clearance",
      "account_created",
      "cancelled",
      "expired",
    ]) {
      expect(code).toMatch(new RegExp(`'${s}'`));
    }
  });

  test("state defaults to 'draft'", () => {
    expect(readCode()).toMatch(/state\s+text\s+NOT\s+NULL\s+DEFAULT\s+'draft'/i);
  });

  test("rejection_reason_code CHECK includes all 7 sealed codes", () => {
    const code = readCode();
    for (const r of [
      "id_unreadable",
      "id_not_matching",
      "not_a_minor",
      "parent_not_authorised",
      "awaiting_legal_clearance",
      "operator_manual_rejection",
      "other",
    ]) {
      expect(code).toMatch(new RegExp(`'${r}'`));
    }
  });

  test("simulated boolean NOT NULL DEFAULT TRUE", () => {
    expect(readCode()).toMatch(/simulated\s+boolean\s+NOT\s+NULL\s+DEFAULT\s+TRUE/i);
  });

  test("created_at + expires_at NOT NULL DEFAULT with 30-day expiry", () => {
    const code = readCode();
    expect(code).toMatch(/created_at\s+timestamptz\s+NOT\s+NULL\s+DEFAULT\s+now\(\)/i);
    expect(code).toMatch(/expires_at\s+timestamptz\s+NOT\s+NULL\s+DEFAULT\s+now\(\)\s*\+\s*interval\s+'30 days'/i);
  });

  test("verified_at + approved_at + rejected_at + cancelled_at nullable", () => {
    const code = readCode();
    expect(code).toMatch(/verified_at\s+timestamptz\s+NULL/i);
    expect(code).toMatch(/approved_at\s+timestamptz\s+NULL/i);
    expect(code).toMatch(/rejected_at\s+timestamptz\s+NULL/i);
    expect(code).toMatch(/cancelled_at\s+timestamptz\s+NULL/i);
  });
});

describe("migration 203 · indexes", () => {
  test("child_creation_request_parent_state_idx exists", () => {
    expect(readCode()).toMatch(/child_creation_request_parent_state_idx/i);
  });

  test("child_creation_request_state_expires_idx exists", () => {
    expect(readCode()).toMatch(/child_creation_request_state_expires_idx/i);
  });

  test("child_creation_request_active_uq is partial UNIQUE", () => {
    const code = readCode();
    expect(code).toMatch(
      /CREATE\s+UNIQUE\s+INDEX\s+IF\s+NOT\s+EXISTS\s+child_creation_request_active_uq/i,
    );
    expect(code).toMatch(/lower\(child_display_name\)/i);
    expect(code).toMatch(
      /WHERE\s+state\s+IN\s*\(\s*'draft'\s*,\s*'id_pending_verification'\s*,\s*'id_verified'\s*,\s*'awaiting_legal_clearance'\s*\)/i,
    );
  });
});

describe("migration 203 · idempotence + doctrine", () => {
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
    expect(creates.length).toBe(1);
  });

  test("zero DML in migration", () => {
    const code = readCode();
    expect(code).not.toMatch(/\bINSERT\s+INTO\b/i);
    expect(code).not.toMatch(/\bUPDATE\s+\w+\s+SET\b/i);
    expect(code).not.toMatch(/\bDELETE\s+FROM\b/i);
  });

  test("header documents legal-clearance gating + flag", () => {
    const raw = fs.readFileSync(MIG_PATH, "utf8");
    expect(raw).toMatch(/NEX_FAMILY_SAFETY_CHILD_CREATE_LIVE_MODE/);
    expect(raw).toMatch(/legal clearance/i);
  });

  test("header documents simulated=TRUE doctrine", () => {
    const raw = fs.readFileSync(MIG_PATH, "utf8");
    expect(raw).toMatch(/simulated=TRUE/i);
  });

  test("header documents session-identity gate", () => {
    const raw = fs.readFileSync(MIG_PATH, "utf8");
    expect(raw).toMatch(/current_database\(\)\s*=\s*'nex_dev'/);
  });
});
