// scripts/nex-canonical/__tests__/migration-202.test.ts
//
// Structural tests for migration 202 (NEX Family Safety · subscription
// + entitlement data layer · Phase 1 · test-mode only).
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
  "202_nex_family_safety_subscription.sql",
);

function readCode(): string {
  const sql = fs.readFileSync(MIG_PATH, "utf8");
  // Strip SQL comments so grep-style tests don't match doc prose.
  return sql.replace(/--[^\n]*/g, "");
}

describe("migration 202 · existence + target", () => {
  test("file exists", () => {
    expect(fs.existsSync(MIG_PATH)).toBe(true);
  });

  test("file is non-trivially sized (>2KB)", () => {
    const raw = fs.readFileSync(MIG_PATH, "utf8");
    expect(raw.length).toBeGreaterThan(2048);
  });

  test("creates nex.family_safety_entitlement table", () => {
    expect(readCode()).toMatch(
      /CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+nex\.family_safety_entitlement/i,
    );
  });

  test("creates nex.family_safety_payment_attempt table", () => {
    expect(readCode()).toMatch(
      /CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+nex\.family_safety_payment_attempt/i,
    );
  });
});

describe("migration 202 · family_safety_entitlement columns + CHECKs", () => {
  test("entitlement_id uuid PK with default", () => {
    expect(readCode()).toMatch(
      /entitlement_id\s+uuid\s+PRIMARY\s+KEY\s+DEFAULT\s+gen_random_uuid\(\)/i,
    );
  });

  test("owner_account_id text NOT NULL", () => {
    expect(readCode()).toMatch(/owner_account_id\s+text\s+NOT\s+NULL/i);
  });

  test("plan_id CHECK includes all 3 sealed plan ids", () => {
    const code = readCode();
    for (const p of [
      "family_safety_pilot_free",
      "family_safety_tbd_1",
      "family_safety_tbd_2",
    ]) {
      expect(code).toMatch(new RegExp(`'${p}'`));
    }
  });

  test("state CHECK includes all 6 sealed states", () => {
    const code = readCode();
    for (const s of [
      "pending",
      "active",
      "suspended",
      "cancelled",
      "expired",
      "failed",
    ]) {
      expect(code).toMatch(new RegExp(`'${s}'`));
    }
  });

  test("state defaults to 'pending'", () => {
    expect(readCode()).toMatch(/state\s+text\s+NOT\s+NULL\s+DEFAULT\s+'pending'/i);
  });

  test("activated_at nullable timestamptz", () => {
    expect(readCode()).toMatch(/activated_at\s+timestamptz\s+NULL/i);
  });

  test("expires_at nullable timestamptz", () => {
    expect(readCode()).toMatch(/expires_at\s+timestamptz\s+NULL/i);
  });

  test("cancelled_at nullable timestamptz", () => {
    expect(readCode()).toMatch(/cancelled_at\s+timestamptz\s+NULL/i);
  });

  test("payment_provider CHECK includes all 4 sealed providers", () => {
    const code = readCode();
    for (const p of ["test_mode", "stripe_tbd", "xendit_tbd", "manual_grant"]) {
      expect(code).toMatch(new RegExp(`'${p}'`));
    }
  });

  test("payment_provider defaults to 'test_mode'", () => {
    expect(readCode()).toMatch(
      /payment_provider\s+text\s+NOT\s+NULL\s+DEFAULT\s+'test_mode'/i,
    );
  });

  test("test_mode boolean NOT NULL DEFAULT TRUE", () => {
    expect(readCode()).toMatch(/test_mode\s+boolean\s+NOT\s+NULL\s+DEFAULT\s+TRUE/i);
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

describe("migration 202 · family_safety_payment_attempt columns + CHECKs", () => {
  test("attempt_id uuid PK with default", () => {
    expect(readCode()).toMatch(
      /attempt_id\s+uuid\s+PRIMARY\s+KEY\s+DEFAULT\s+gen_random_uuid\(\)/i,
    );
  });

  test("idempotency_key text NOT NULL", () => {
    expect(readCode()).toMatch(/idempotency_key\s+text\s+NOT\s+NULL/i);
  });

  test("outcome CHECK includes all 5 sealed outcomes", () => {
    const code = readCode();
    for (const o of [
      "initiated",
      "succeeded",
      "failed",
      "cancelled",
      "duplicate_ignored",
    ]) {
      expect(code).toMatch(new RegExp(`'${o}'`));
    }
  });

  test("provider defaults to 'test_mode'", () => {
    expect(readCode()).toMatch(
      /provider\s+text\s+NOT\s+NULL\s+DEFAULT\s+'test_mode'/i,
    );
  });

  test("entitlement_id REFERENCES entitlement with ON DELETE SET NULL", () => {
    expect(readCode()).toMatch(
      /entitlement_id[\s\S]*?REFERENCES\s+nex\.family_safety_entitlement\s*\(\s*entitlement_id\s*\)[\s\S]*?ON\s+DELETE\s+SET\s+NULL/i,
    );
  });

  test("test_mode boolean NOT NULL DEFAULT TRUE on attempt", () => {
    const code = readCode();
    // test_mode appears on both tables → both must default TRUE
    const matches = code.match(/test_mode\s+boolean\s+NOT\s+NULL\s+DEFAULT\s+TRUE/gi) ?? [];
    expect(matches.length).toBeGreaterThanOrEqual(2);
  });

  test("simulated boolean NOT NULL DEFAULT TRUE on attempt", () => {
    const code = readCode();
    const matches = code.match(/simulated\s+boolean\s+NOT\s+NULL\s+DEFAULT\s+TRUE/gi) ?? [];
    expect(matches.length).toBeGreaterThanOrEqual(2);
  });

  test("attempted_at timestamptz NOT NULL DEFAULT now()", () => {
    expect(readCode()).toMatch(/attempted_at\s+timestamptz\s+NOT\s+NULL\s+DEFAULT\s+now\(\)/i);
  });
});

describe("migration 202 · indexes", () => {
  test("family_safety_entitlement_owner_state_idx exists", () => {
    expect(readCode()).toMatch(/family_safety_entitlement_owner_state_idx/i);
  });

  test("family_safety_entitlement_owner_plan_active_uq is partial on state='active'", () => {
    const code = readCode();
    expect(code).toMatch(/family_safety_entitlement_owner_plan_active_uq/i);
    expect(code).toMatch(/WHERE\s+state\s*=\s*'active'/i);
  });

  test("family_safety_payment_attempt_idem_uq is UNIQUE on idempotency_key", () => {
    const code = readCode();
    expect(code).toMatch(
      /CREATE\s+UNIQUE\s+INDEX\s+IF\s+NOT\s+EXISTS\s+family_safety_payment_attempt_idem_uq/i,
    );
    expect(code).toMatch(/\(\s*idempotency_key\s*\)/i);
  });

  test("family_safety_payment_attempt_owner_time_idx (owner_account_id, attempted_at DESC)", () => {
    const code = readCode();
    expect(code).toMatch(/family_safety_payment_attempt_owner_time_idx/i);
    expect(code).toMatch(/attempted_at\s+DESC/i);
  });
});

describe("migration 202 · idempotence + doctrine", () => {
  test("every CREATE INDEX uses IF NOT EXISTS", () => {
    const code = readCode();
    const creates = code.match(/\bCREATE\s+(?:UNIQUE\s+)?INDEX\s+(?:IF\s+NOT\s+EXISTS\s+)?/gi) ?? [];
    const guarded = code.match(/\bCREATE\s+(?:UNIQUE\s+)?INDEX\s+IF\s+NOT\s+EXISTS\b/gi) ?? [];
    expect(guarded.length).toBe(creates.length);
    expect(creates.length).toBeGreaterThan(0);
  });

  test("every CREATE TABLE uses IF NOT EXISTS", () => {
    const code = readCode();
    const creates = code.match(/\bCREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?/gi) ?? [];
    const guarded = code.match(/\bCREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\b/gi) ?? [];
    expect(guarded.length).toBe(creates.length);
    expect(creates.length).toBe(2);
  });

  test("zero DML in migration", () => {
    const code = readCode();
    expect(code).not.toMatch(/\bINSERT\s+INTO\b/i);
    expect(code).not.toMatch(/\bUPDATE\s+\w+\s+SET\b/i);
    expect(code).not.toMatch(/\bDELETE\s+FROM\b/i);
  });

  test("header documents Phase 1 test-mode doctrine", () => {
    const raw = fs.readFileSync(MIG_PATH, "utf8");
    expect(raw).toMatch(/test[-_\s]mode/i);
    expect(raw).toMatch(/simulated\s*=\s*TRUE/i);
  });

  test("header documents no live payment network calls", () => {
    const raw = fs.readFileSync(MIG_PATH, "utf8");
    expect(raw).toMatch(/no live payment/i);
  });

  test("header documents PLACEHOLDER pricing policy", () => {
    const raw = fs.readFileSync(MIG_PATH, "utf8");
    expect(raw).toMatch(/PLACEHOLDER/);
    expect(raw).toMatch(/founder has not approved commercial model/i);
  });

  test("header documents sealed adapter interface for later providers", () => {
    const raw = fs.readFileSync(MIG_PATH, "utf8");
    expect(raw).toMatch(/adapter/i);
    expect(raw).toMatch(/without touching/i);
  });

  test("header documents the free pilot plan is available", () => {
    const raw = fs.readFileSync(MIG_PATH, "utf8");
    expect(raw).toMatch(/family_safety_pilot_free/);
    expect(raw).toMatch(/FREE/);
  });
});
