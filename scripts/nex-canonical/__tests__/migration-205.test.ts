// scripts/nex-canonical/__tests__/migration-205.test.ts
//
// Structural tests for migration 205 (NEX Family Safety · Parent Custody Link).

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
  "205_nex_parent_custody_link.sql",
);

function readCode(): string {
  const sql = fs.readFileSync(MIG_PATH, "utf8");
  return sql.replace(/--[^\n]*/g, "");
}

describe("migration 205 · existence + target", () => {
  test("file exists", () => {
    expect(fs.existsSync(MIG_PATH)).toBe(true);
  });

  test("file is non-trivially sized", () => {
    expect(fs.readFileSync(MIG_PATH, "utf8").length).toBeGreaterThan(2048);
  });

  test("creates nex.parent_custody_link table", () => {
    expect(readCode()).toMatch(
      /CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+nex\.parent_custody_link/i,
    );
  });
});

describe("migration 205 · columns + CHECKs", () => {
  test("custody_id uuid PK with default", () => {
    expect(readCode()).toMatch(
      /custody_id\s+uuid\s+PRIMARY\s+KEY\s+DEFAULT\s+gen_random_uuid\(\)/i,
    );
  });

  test("parent_account_id text NOT NULL", () => {
    expect(readCode()).toMatch(/parent_account_id\s+text\s+NOT\s+NULL/i);
  });

  test("child_account_id text NOT NULL", () => {
    expect(readCode()).toMatch(/child_account_id\s+text\s+NOT\s+NULL/i);
  });

  test("link_type CHECK includes all 3 sealed types", () => {
    const code = readCode();
    for (const t of ["created_minor", "transferred_at_16", "manual_grant"]) {
      expect(code).toMatch(new RegExp(`'${t}'`));
    }
  });

  test("creation_request_id REFERENCES child_account_creation_request ON DELETE SET NULL", () => {
    expect(readCode()).toMatch(
      /creation_request_id[\s\S]*?REFERENCES\s+nex\.child_account_creation_request[\s\S]*?ON\s+DELETE\s+SET\s+NULL/i,
    );
  });

  test("auto_transfer_at + transferred_at + revoked_at nullable timestamptz", () => {
    const code = readCode();
    expect(code).toMatch(/auto_transfer_at\s+timestamptz\s+NULL/i);
    expect(code).toMatch(/transferred_at\s+timestamptz\s+NULL/i);
    expect(code).toMatch(/revoked_at\s+timestamptz\s+NULL/i);
  });

  test("CHECK (parent_account_id <> child_account_id)", () => {
    expect(readCode()).toMatch(
      /CHECK\s*\(\s*parent_account_id\s*<>\s*child_account_id\s*\)/i,
    );
  });

  test("simulated boolean NOT NULL DEFAULT TRUE", () => {
    expect(readCode()).toMatch(/simulated\s+boolean\s+NOT\s+NULL\s+DEFAULT\s+TRUE/i);
  });

  test("created_at NOT NULL DEFAULT now()", () => {
    expect(readCode()).toMatch(/created_at\s+timestamptz\s+NOT\s+NULL\s+DEFAULT\s+now\(\)/i);
  });
});

describe("migration 205 · indexes", () => {
  test("parent_custody_link_active_uq is partial UNIQUE on child_account_id", () => {
    const code = readCode();
    expect(code).toMatch(
      /CREATE\s+UNIQUE\s+INDEX\s+IF\s+NOT\s+EXISTS\s+parent_custody_link_active_uq/i,
    );
    expect(code).toMatch(/\(\s*child_account_id\s*\)/i);
    expect(code).toMatch(
      /WHERE\s+revoked_at\s+IS\s+NULL\s+AND\s+transferred_at\s+IS\s+NULL/i,
    );
  });

  test("parent_custody_link_parent_idx exists", () => {
    expect(readCode()).toMatch(/parent_custody_link_parent_idx/i);
  });

  test("parent_custody_link_transfer_due_idx exists + partial", () => {
    const code = readCode();
    expect(code).toMatch(/parent_custody_link_transfer_due_idx/i);
    expect(code).toMatch(/auto_transfer_at\s+IS\s+NOT\s+NULL/i);
  });
});

describe("migration 205 · idempotence + doctrine", () => {
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

  test("header documents simulated=TRUE", () => {
    const raw = fs.readFileSync(MIG_PATH, "utf8");
    expect(raw).toMatch(/simulated=TRUE/i);
  });

  test("header documents session-identity gate", () => {
    const raw = fs.readFileSync(MIG_PATH, "utf8");
    expect(raw).toMatch(/current_database\(\)\s*=\s*'nex_dev'/);
  });
});
