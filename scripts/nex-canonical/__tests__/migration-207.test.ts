// scripts/nex-canonical/__tests__/migration-207.test.ts
//
// Structural tests for migration 207 (NEX Family Safety · Parent Custody
// Audit Log · append-only).

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
  "207_nex_parent_custody_audit_log.sql",
);

function readCode(): string {
  const sql = fs.readFileSync(MIG_PATH, "utf8");
  return sql.replace(/--[^\n]*/g, "");
}

describe("migration 207 · existence + target", () => {
  test("file exists", () => {
    expect(fs.existsSync(MIG_PATH)).toBe(true);
  });

  test("file is non-trivially sized", () => {
    expect(fs.readFileSync(MIG_PATH, "utf8").length).toBeGreaterThan(2048);
  });

  test("creates nex.parent_custody_audit_log table", () => {
    expect(readCode()).toMatch(
      /CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+nex\.parent_custody_audit_log/i,
    );
  });
});

describe("migration 207 · columns + CHECKs", () => {
  test("audit_id uuid PK with default", () => {
    expect(readCode()).toMatch(
      /audit_id\s+uuid\s+PRIMARY\s+KEY\s+DEFAULT\s+gen_random_uuid\(\)/i,
    );
  });

  test("custody_id REFERENCES parent_custody_link ON DELETE CASCADE", () => {
    expect(readCode()).toMatch(
      /custody_id[\s\S]*?REFERENCES\s+nex\.parent_custody_link[\s\S]*?ON\s+DELETE\s+CASCADE/i,
    );
  });

  test("parent_account_id + child_account_id text NOT NULL", () => {
    const code = readCode();
    expect(code).toMatch(/parent_account_id\s+text\s+NOT\s+NULL/i);
    expect(code).toMatch(/child_account_id\s+text\s+NOT\s+NULL/i);
  });

  test("action CHECK includes all 8 sealed actions", () => {
    const code = readCode();
    for (const a of [
      "custody_created",
      "password_reset_requested",
      "password_reset_completed",
      "child_viewed_in_dashboard",
      "safechat_summary_viewed",
      "age_transfer_notified",
      "age_transfer_completed",
      "custody_revoked",
    ]) {
      expect(code).toMatch(new RegExp(`'${a}'`));
    }
  });

  test("action_details_redacted nullable text", () => {
    expect(readCode()).toMatch(/action_details_redacted\s+text\s+NULL/i);
  });

  test("simulated boolean NOT NULL DEFAULT TRUE", () => {
    expect(readCode()).toMatch(/simulated\s+boolean\s+NOT\s+NULL\s+DEFAULT\s+TRUE/i);
  });

  test("performed_at timestamptz NOT NULL DEFAULT now()", () => {
    expect(readCode()).toMatch(
      /performed_at\s+timestamptz\s+NOT\s+NULL\s+DEFAULT\s+now\(\)/i,
    );
  });
});

describe("migration 207 · indexes", () => {
  test("parent_custody_audit_log_custody_time_idx exists", () => {
    const code = readCode();
    expect(code).toMatch(/parent_custody_audit_log_custody_time_idx/i);
    expect(code).toMatch(/performed_at\s+DESC/i);
  });

  test("parent_custody_audit_log_action_time_idx exists", () => {
    expect(readCode()).toMatch(/parent_custody_audit_log_action_time_idx/i);
  });
});

describe("migration 207 · idempotence + doctrine", () => {
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

  test("header documents append-only doctrine", () => {
    const raw = fs.readFileSync(MIG_PATH, "utf8");
    expect(raw).toMatch(/APPEND-ONLY/i);
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
