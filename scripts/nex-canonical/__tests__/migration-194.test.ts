// scripts/nex-canonical/__tests__/migration-194.test.ts
//
// Structural tests for migration 194 (nex.emergency_location_update).
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
  "194_nex_emergency_location_history.sql",
);

function readCode(): string {
  const sql = fs.readFileSync(MIG_PATH, "utf8");
  // Strip SQL line comments so prose-only matches don't produce false
  // positives on prose like "ON DELETE CASCADE" in comments.
  return sql.replace(/--[^\n]*/g, "");
}

describe("migration 194 · existence + target", () => {
  test("file exists", () => {
    expect(fs.existsSync(MIG_PATH)).toBe(true);
  });

  test("creates nex.emergency_location_update", () => {
    expect(readCode()).toMatch(
      /\bCREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+nex\.emergency_location_update\b/i,
    );
  });

  test("file is non-trivially sized (>1KB)", () => {
    const raw = fs.readFileSync(MIG_PATH, "utf8");
    expect(raw.length).toBeGreaterThan(1024);
  });
});

describe("migration 194 · emergency_location_update columns", () => {
  test("has update_id uuid PRIMARY KEY DEFAULT gen_random_uuid()", () => {
    expect(readCode()).toMatch(
      /\bupdate_id\s+uuid\s+PRIMARY\s+KEY\s+DEFAULT\s+gen_random_uuid\(\)/i,
    );
  });

  test("has incident_id uuid NOT NULL", () => {
    expect(readCode()).toMatch(/\bincident_id\s+uuid\s+NOT\s+NULL\b/i);
  });

  test("has FK to emergency_incident ON DELETE CASCADE", () => {
    expect(readCode()).toMatch(
      /REFERENCES\s+nex\.emergency_incident\s*\(\s*incident_id\s*\)\s*ON\s+DELETE\s+CASCADE/i,
    );
  });

  test("has lat double precision NOT NULL", () => {
    expect(readCode()).toMatch(/\blat\s+double\s+precision\s+NOT\s+NULL\b/i);
  });

  test("has lng double precision NOT NULL", () => {
    expect(readCode()).toMatch(/\blng\s+double\s+precision\s+NOT\s+NULL\b/i);
  });

  test("has accuracy_meters integer NULL", () => {
    expect(readCode()).toMatch(/\baccuracy_meters\s+integer\s+NULL\b/i);
  });

  test("has heading_degrees double precision NULL", () => {
    expect(readCode()).toMatch(/\bheading_degrees\s+double\s+precision\s+NULL\b/i);
  });

  test("has speed_mps double precision NULL", () => {
    expect(readCode()).toMatch(/\bspeed_mps\s+double\s+precision\s+NULL\b/i);
  });

  test("has source text NOT NULL DEFAULT 'browser_watch_position'", () => {
    expect(readCode()).toMatch(
      /\bsource\s+text\s+NOT\s+NULL\s+DEFAULT\s+'browser_watch_position'/i,
    );
  });

  test("has simulated boolean NOT NULL DEFAULT TRUE", () => {
    expect(readCode()).toMatch(
      /\bsimulated\s+boolean\s+NOT\s+NULL\s+DEFAULT\s+TRUE\b/i,
    );
  });

  test("has captured_at timestamptz NOT NULL", () => {
    expect(readCode()).toMatch(/\bcaptured_at\s+timestamptz\s+NOT\s+NULL\b/i);
  });

  test("has received_at timestamptz NOT NULL DEFAULT now()", () => {
    expect(readCode()).toMatch(
      /\breceived_at\s+timestamptz\s+NOT\s+NULL\s+DEFAULT\s+now\(\)/i,
    );
  });
});

describe("migration 194 · CHECK constraints", () => {
  test("enforces latitude bounds [-90, 90]", () => {
    expect(readCode()).toMatch(/lat\s+BETWEEN\s+-90\s+AND\s+90/i);
  });

  test("enforces longitude bounds [-180, 180]", () => {
    expect(readCode()).toMatch(/lng\s+BETWEEN\s+-180\s+AND\s+180/i);
  });

  test("enforces non-negative accuracy_meters", () => {
    expect(readCode()).toMatch(/accuracy_meters[\s\S]*?>=\s*0/i);
  });

  test("enforces heading_degrees in [0, 360]", () => {
    expect(readCode()).toMatch(/heading_degrees[\s\S]*?BETWEEN\s+0\s+AND\s+360/i);
  });

  test("enforces non-negative speed_mps", () => {
    expect(readCode()).toMatch(/speed_mps[\s\S]*?>=\s*0/i);
  });

  test("enforces sealed 3-value source CHECK", () => {
    const code = readCode();
    expect(code).toMatch(/'browser_watch_position'/);
    expect(code).toMatch(/'manual_pin'/);
    expect(code).toMatch(/'service_worker_sync'/);
  });
});

describe("migration 194 · indexes", () => {
  test("creates emergency_location_update_incident_time_idx", () => {
    expect(readCode()).toMatch(
      /CREATE\s+INDEX\s+IF\s+NOT\s+EXISTS\s+emergency_location_update_incident_time_idx\b/i,
    );
  });

  test("hot-path index covers (incident_id, captured_at DESC)", () => {
    expect(readCode()).toMatch(
      /emergency_location_update_incident_time_idx[\s\S]*?\(\s*incident_id\s*,\s*captured_at\s+DESC\s*\)/i,
    );
  });
});

describe("migration 194 · idempotence + doctrine", () => {
  test("every CREATE TABLE uses IF NOT EXISTS", () => {
    const code = readCode();
    const creates = code.match(/\bCREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?/gi) ?? [];
    const guarded = code.match(/\bCREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\b/gi) ?? [];
    expect(guarded.length).toBe(creates.length);
    expect(creates.length).toBeGreaterThan(0);
  });

  test("every CREATE INDEX uses IF NOT EXISTS", () => {
    const code = readCode();
    const createIdx = code.match(/\bCREATE\s+INDEX\s+(?:IF\s+NOT\s+EXISTS\s+)?/gi) ?? [];
    const guarded = code.match(/\bCREATE\s+INDEX\s+IF\s+NOT\s+EXISTS\b/gi) ?? [];
    expect(guarded.length).toBe(createIdx.length);
    expect(createIdx.length).toBeGreaterThan(0);
  });

  test("zero DML statements (no INSERT / UPDATE / DELETE)", () => {
    const code = readCode();
    expect(code).not.toMatch(/\bINSERT\s+INTO\b/i);
    expect(code).not.toMatch(/\bUPDATE\s+\w+\s+SET\b/i);
    expect(code).not.toMatch(/\bDELETE\s+FROM\b/i);
  });

  test("single CREATE TABLE statement (one new primitive)", () => {
    const code = readCode();
    const creates = code.match(/\bCREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\b/gi) ?? [];
    expect(creates.length).toBe(1);
  });
});
