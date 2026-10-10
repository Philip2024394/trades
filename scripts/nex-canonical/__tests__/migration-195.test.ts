// scripts/nex-canonical/__tests__/migration-195.test.ts
//
// Structural tests for migration 195 (pending_confirmation +
// revoked_within_window states on nex.emergency_incident).
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
  "195_nex_emergency_pending_confirmation_states.sql",
);

function readCode(): string {
  const sql = fs.readFileSync(MIG_PATH, "utf8");
  // Strip SQL line comments so prose-only matches don't produce false
  // positives against the lifecycle narrative in the header.
  return sql.replace(/--[^\n]*/g, "");
}

describe("migration 195 · existence + target", () => {
  test("file exists", () => {
    expect(fs.existsSync(MIG_PATH)).toBe(true);
  });

  test("file is non-trivially sized (>1KB)", () => {
    const raw = fs.readFileSync(MIG_PATH, "utf8");
    expect(raw.length).toBeGreaterThan(1024);
  });

  test("targets nex.emergency_incident (ALTER TABLE)", () => {
    expect(readCode()).toMatch(/\bALTER\s+TABLE\s+nex\.emergency_incident\b/i);
  });

  test("creates NO new tables (ALTER-only migration)", () => {
    const code = readCode();
    expect(code).not.toMatch(/\bCREATE\s+TABLE\b/i);
  });
});

describe("migration 195 · state CHECK widening", () => {
  test("drops the old state CHECK constraint by sealed name", () => {
    expect(readCode()).toMatch(
      /DROP\s+CONSTRAINT\s+IF\s+EXISTS\s+emergency_incident_state_check/i,
    );
  });

  test("also drops the alternate 193-era name (ck_ei_state)", () => {
    expect(readCode()).toMatch(/DROP\s+CONSTRAINT\s+IF\s+EXISTS\s+ck_ei_state/i);
  });

  test("adds a new state CHECK constraint", () => {
    expect(readCode()).toMatch(
      /ADD\s+CONSTRAINT\s+emergency_incident_state_check\s+CHECK\s*\(\s*state\s+IN/i,
    );
  });

  test("new CHECK includes 'pending_confirmation'", () => {
    expect(readCode()).toMatch(/'pending_confirmation'/);
  });

  test("new CHECK includes 'revoked_within_window'", () => {
    expect(readCode()).toMatch(/'revoked_within_window'/);
  });

  test("new CHECK preserves all 6 prior states", () => {
    const code = readCode();
    for (const s of [
      "draft",
      "active",
      "responders_assigned",
      "resolved",
      "cancelled",
      "expired",
    ]) {
      expect(code).toMatch(new RegExp(`'${s}'`));
    }
  });
});

describe("migration 195 · new timestamp columns", () => {
  test("adds pending_confirmed_at timestamptz NULL (IF NOT EXISTS)", () => {
    expect(readCode()).toMatch(
      /ADD\s+COLUMN\s+IF\s+NOT\s+EXISTS\s+pending_confirmed_at\s+timestamptz\s+NULL/i,
    );
  });

  test("adds revoked_within_window_at timestamptz NULL (IF NOT EXISTS)", () => {
    expect(readCode()).toMatch(
      /ADD\s+COLUMN\s+IF\s+NOT\s+EXISTS\s+revoked_within_window_at\s+timestamptz\s+NULL/i,
    );
  });
});

describe("migration 195 · idempotence + doctrine", () => {
  test("transaction wrapper · BEGIN + COMMIT present", () => {
    const code = readCode();
    expect(code).toMatch(/\bBEGIN\s*;/i);
    expect(code).toMatch(/\bCOMMIT\s*;/i);
  });

  test("zero DML statements (no INSERT / UPDATE / DELETE)", () => {
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

  test("header documents the attacker-removes-phone threat model", () => {
    const raw = fs.readFileSync(MIG_PATH, "utf8");
    expect(raw).toMatch(/attacker/i);
    expect(raw).toMatch(/revocation/i);
  });
});
