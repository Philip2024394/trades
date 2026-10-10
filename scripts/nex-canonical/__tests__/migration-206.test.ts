// scripts/nex-canonical/__tests__/migration-206.test.ts
//
// Structural tests for migration 206 (NEX Family Safety · Account Minor Profile).

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
  "206_nex_account_minor_profile.sql",
);

function readCode(): string {
  const sql = fs.readFileSync(MIG_PATH, "utf8");
  return sql.replace(/--[^\n]*/g, "");
}

describe("migration 206 · existence + target", () => {
  test("file exists", () => {
    expect(fs.existsSync(MIG_PATH)).toBe(true);
  });

  test("file is non-trivially sized", () => {
    expect(fs.readFileSync(MIG_PATH, "utf8").length).toBeGreaterThan(2048);
  });

  test("creates nex.account_minor_profile table", () => {
    expect(readCode()).toMatch(
      /CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+nex\.account_minor_profile/i,
    );
  });
});

describe("migration 206 · columns + CHECKs", () => {
  test("account_id text PRIMARY KEY", () => {
    expect(readCode()).toMatch(/account_id\s+text\s+PRIMARY\s+KEY/i);
  });

  test("is_minor boolean NOT NULL DEFAULT TRUE", () => {
    expect(readCode()).toMatch(/is_minor\s+boolean\s+NOT\s+NULL\s+DEFAULT\s+TRUE/i);
  });

  test("parent_custody_id REFERENCES parent_custody_link ON DELETE SET NULL", () => {
    expect(readCode()).toMatch(
      /parent_custody_id[\s\S]*?REFERENCES\s+nex\.parent_custody_link[\s\S]*?ON\s+DELETE\s+SET\s+NULL/i,
    );
  });

  test("auto_transfer_at + transferred_at nullable timestamptz", () => {
    const code = readCode();
    expect(code).toMatch(/auto_transfer_at\s+timestamptz\s+NULL/i);
    expect(code).toMatch(/transferred_at\s+timestamptz\s+NULL/i);
  });

  test("safechat_always_on boolean NOT NULL DEFAULT TRUE", () => {
    expect(readCode()).toMatch(
      /safechat_always_on\s+boolean\s+NOT\s+NULL\s+DEFAULT\s+TRUE/i,
    );
  });

  test("simulated boolean NOT NULL DEFAULT TRUE", () => {
    expect(readCode()).toMatch(/simulated\s+boolean\s+NOT\s+NULL\s+DEFAULT\s+TRUE/i);
  });

  test("created_at + updated_at NOT NULL DEFAULT now()", () => {
    const code = readCode();
    expect(code).toMatch(/created_at\s+timestamptz\s+NOT\s+NULL\s+DEFAULT\s+now\(\)/i);
    expect(code).toMatch(/updated_at\s+timestamptz\s+NOT\s+NULL\s+DEFAULT\s+now\(\)/i);
  });
});

describe("migration 206 · indexes", () => {
  test("account_minor_profile_minor_transfer_idx exists", () => {
    expect(readCode()).toMatch(/account_minor_profile_minor_transfer_idx/i);
  });
});

describe("migration 206 · idempotence + doctrine", () => {
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

  test("header documents SafeChat ALWAYS ON for minors (decision D)", () => {
    const raw = fs.readFileSync(MIG_PATH, "utf8");
    expect(raw).toMatch(/SafeChat/);
    expect(raw).toMatch(/ALWAYS ON/i);
    expect(raw).toMatch(/parent cannot disable/i);
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
