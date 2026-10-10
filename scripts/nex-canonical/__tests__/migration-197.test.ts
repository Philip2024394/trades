// scripts/nex-canonical/__tests__/migration-197.test.ts
//
// Structural tests for migration 197 (dedicated multi-channel fan-out
// audit log · nex.emergency_fanout_log).
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
  "197_nex_emergency_fanout_audit.sql",
);

function readCode(): string {
  const sql = fs.readFileSync(MIG_PATH, "utf8");
  return sql.replace(/--[^\n]*/g, "");
}

describe("migration 197 · existence + target", () => {
  test("file exists", () => {
    expect(fs.existsSync(MIG_PATH)).toBe(true);
  });

  test("file is non-trivially sized (>1KB)", () => {
    const raw = fs.readFileSync(MIG_PATH, "utf8");
    expect(raw.length).toBeGreaterThan(1024);
  });

  test("creates nex.emergency_fanout_log table", () => {
    expect(readCode()).toMatch(
      /CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+nex\.emergency_fanout_log/i,
    );
  });
});

describe("migration 197 · columns", () => {
  test("log_id uuid PK with default", () => {
    const code = readCode();
    expect(code).toMatch(/log_id\s+uuid\s+PRIMARY\s+KEY\s+DEFAULT\s+gen_random_uuid\(\)/i);
  });

  test("incident_id uuid NOT NULL + FK to emergency_incident ON DELETE CASCADE", () => {
    const code = readCode();
    expect(code).toMatch(/incident_id\s+uuid\s+NOT\s+NULL/i);
    expect(code).toMatch(/REFERENCES\s+nex\.emergency_incident\s*\(\s*incident_id\s*\)\s+ON\s+DELETE\s+CASCADE/i);
  });

  test("transition text NOT NULL", () => {
    expect(readCode()).toMatch(/transition\s+text\s+NOT\s+NULL/i);
  });

  test("channel text NOT NULL", () => {
    expect(readCode()).toMatch(/channel\s+text\s+NOT\s+NULL/i);
  });

  test("recipient_identifier text NOT NULL", () => {
    expect(readCode()).toMatch(/recipient_identifier\s+text\s+NOT\s+NULL/i);
  });

  test("outcome text NOT NULL", () => {
    expect(readCode()).toMatch(/outcome\s+text\s+NOT\s+NULL/i);
  });

  test("reason text NULL (nullable)", () => {
    expect(readCode()).toMatch(/reason\s+text\s+NULL/i);
  });

  test("idempotency_key text NOT NULL", () => {
    expect(readCode()).toMatch(/idempotency_key\s+text\s+NOT\s+NULL/i);
  });

  test("simulated boolean NOT NULL DEFAULT TRUE", () => {
    expect(readCode()).toMatch(/simulated\s+boolean\s+NOT\s+NULL\s+DEFAULT\s+TRUE/i);
  });

  test("attempted_at timestamptz NOT NULL DEFAULT now()", () => {
    expect(readCode()).toMatch(/attempted_at\s+timestamptz\s+NOT\s+NULL\s+DEFAULT\s+now\(\)/i);
  });
});

describe("migration 197 · CHECKs", () => {
  test("transition CHECK includes all 5 sealed values", () => {
    const code = readCode();
    for (const t of ["pending_confirmation", "active", "revoked_within_window", "cancelled", "resolved"]) {
      expect(code).toMatch(new RegExp(`'${t}'`));
    }
  });

  test("channel CHECK includes all 4 sealed values", () => {
    const code = readCode();
    for (const c of ["email", "sms", "whatsapp", "in_app"]) {
      expect(code).toMatch(new RegExp(`'${c}'`));
    }
  });

  test("outcome CHECK includes all 5 sealed values", () => {
    const code = readCode();
    for (const o of ["ok", "skipped", "honest_blocked", "rate_limited", "provider_error"]) {
      expect(code).toMatch(new RegExp(`'${o}'`));
    }
  });
});

describe("migration 197 · indexes", () => {
  test("UNIQUE index on idempotency_key", () => {
    expect(readCode()).toMatch(
      /CREATE\s+UNIQUE\s+INDEX\s+IF\s+NOT\s+EXISTS\s+emergency_fanout_log_idem_uq/i,
    );
  });

  test("hot-path index on (incident_id, attempted_at DESC)", () => {
    const code = readCode();
    expect(code).toMatch(/emergency_fanout_log_incident_time_idx/i);
    expect(code).toMatch(/incident_id\s*,\s*attempted_at\s+DESC/i);
  });

  test("secondary index on (outcome, attempted_at DESC)", () => {
    const code = readCode();
    expect(code).toMatch(/emergency_fanout_log_outcome_time_idx/i);
    expect(code).toMatch(/outcome\s*,\s*attempted_at\s+DESC/i);
  });
});

describe("migration 197 · idempotence + doctrine", () => {
  test("every CREATE INDEX uses IF NOT EXISTS", () => {
    const code = readCode();
    const creates = code.match(/\bCREATE\s+(?:UNIQUE\s+)?INDEX\s+(?:IF\s+NOT\s+EXISTS\s+)?/gi) ?? [];
    const guarded = code.match(/\bCREATE\s+(?:UNIQUE\s+)?INDEX\s+IF\s+NOT\s+EXISTS\b/gi) ?? [];
    expect(guarded.length).toBe(creates.length);
    expect(creates.length).toBeGreaterThan(0);
  });

  test("CREATE TABLE uses IF NOT EXISTS", () => {
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

  test("header documents idempotency doctrine", () => {
    const raw = fs.readFileSync(MIG_PATH, "utf8");
    expect(raw).toMatch(/idempoten/i);
  });

  test("header documents SMS honest-blocked doctrine", () => {
    const raw = fs.readFileSync(MIG_PATH, "utf8");
    expect(raw).toMatch(/honest.?blocked/i);
  });

  test("header documents the opaque-recipient doctrine (never raw PII)", () => {
    const raw = fs.readFileSync(MIG_PATH, "utf8");
    expect(raw).toMatch(/opaque|SHA|hash/i);
    expect(raw).toMatch(/PII|plaintext/i);
  });
});
