// scripts/nex-canonical/__tests__/migration-193.test.ts
//
// Structural tests for migration 193 (nex.emergency_* schema).
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
  "193_nex_emergency_schema.sql",
);

function readCode(): string {
  const sql = fs.readFileSync(MIG_PATH, "utf8");
  // Strip SQL line comments so prose-only matches don't produce false
  // positives.
  return sql.replace(/--[^\n]*/g, "");
}

describe("migration 193 · existence + target", () => {
  test("file exists", () => {
    expect(fs.existsSync(MIG_PATH)).toBe(true);
  });

  test("creates nex.emergency_incident", () => {
    expect(readCode()).toMatch(
      /\bCREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+nex\.emergency_incident\b/i,
    );
  });

  test("creates nex.incident_recipient", () => {
    expect(readCode()).toMatch(
      /\bCREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+nex\.incident_recipient\b/i,
    );
  });

  test("creates nex.emergency_responder_optin", () => {
    expect(readCode()).toMatch(
      /\bCREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+nex\.emergency_responder_optin\b/i,
    );
  });

  test("creates nex.trusted_contact", () => {
    expect(readCode()).toMatch(
      /\bCREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+nex\.trusted_contact\b/i,
    );
  });

  test("creates nex.emergency_rate_limit", () => {
    expect(readCode()).toMatch(
      /\bCREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+nex\.emergency_rate_limit\b/i,
    );
  });
});

describe("migration 193 · emergency_incident columns", () => {
  test("has incident_id uuid PRIMARY KEY DEFAULT gen_random_uuid()", () => {
    expect(readCode()).toMatch(
      /\bincident_id\s+uuid\s+PRIMARY\s+KEY\s+DEFAULT\s+gen_random_uuid\(\)/i,
    );
  });

  test("has requester_account_id text NOT NULL", () => {
    expect(readCode()).toMatch(/\brequester_account_id\s+text\s+NOT\s+NULL\b/i);
  });

  test("has state text NOT NULL DEFAULT 'draft'", () => {
    expect(readCode()).toMatch(/\bstate\s+text\s+NOT\s+NULL\s+DEFAULT\s+'draft'/i);
  });

  test("has category text NOT NULL", () => {
    expect(readCode()).toMatch(/\bcategory\s+text\s+NOT\s+NULL\b/i);
  });

  test("has location_lat double precision NULL", () => {
    expect(readCode()).toMatch(/\blocation_lat\s+double\s+precision\s+NULL\b/i);
  });

  test("has location_lng double precision NULL", () => {
    expect(readCode()).toMatch(/\blocation_lng\s+double\s+precision\s+NULL\b/i);
  });

  test("has simulated boolean NOT NULL DEFAULT TRUE", () => {
    const code = readCode();
    expect(code).toMatch(/\bsimulated\s+boolean\s+NOT\s+NULL\s+DEFAULT\s+TRUE\b/i);
  });

  test("has expires_at default now()+interval '30 minutes'", () => {
    expect(readCode()).toMatch(/expires_at[\s\S]*?interval\s+'30\s+minutes'/i);
  });

  test("enforces sealed 6-state CHECK on state", () => {
    const code = readCode();
    expect(code).toMatch(/'draft'/);
    expect(code).toMatch(/'active'/);
    expect(code).toMatch(/'responders_assigned'/);
    expect(code).toMatch(/'resolved'/);
    expect(code).toMatch(/'cancelled'/);
    expect(code).toMatch(/'expired'/);
  });

  test("enforces sealed 4-value CHECK on category", () => {
    const code = readCode();
    expect(code).toMatch(/'general_assistance'/);
    expect(code).toMatch(/'medical_concern'/);
    expect(code).toMatch(/'safety_concern'/);
    expect(code).toMatch(/'other'/);
  });

  test("enforces latitude bounds [-90, 90]", () => {
    expect(readCode()).toMatch(/location_lat[\s\S]*?-90[\s\S]*?90/);
  });

  test("enforces longitude bounds [-180, 180]", () => {
    expect(readCode()).toMatch(/location_lng[\s\S]*?-180[\s\S]*?180/);
  });
});

describe("migration 193 · emergency_incident indexes", () => {
  test("creates idx_ei_requester_state_created", () => {
    expect(readCode()).toMatch(
      /CREATE\s+INDEX\s+IF\s+NOT\s+EXISTS\s+idx_ei_requester_state_created\b/i,
    );
  });

  test("creates idx_ei_state_expires sweep index", () => {
    expect(readCode()).toMatch(
      /CREATE\s+INDEX\s+IF\s+NOT\s+EXISTS\s+idx_ei_state_expires\b/i,
    );
  });
});

describe("migration 193 · incident_recipient", () => {
  test("has FK to emergency_incident ON DELETE CASCADE", () => {
    expect(readCode()).toMatch(
      /REFERENCES\s+nex\.emergency_incident[\s\S]*?ON\s+DELETE\s+CASCADE/i,
    );
  });

  test("enforces sealed 3-layer CHECK", () => {
    const code = readCode();
    expect(code).toMatch(/'trusted_contact'/);
    expect(code).toMatch(/'nearby_opted_in'/);
    expect(code).toMatch(/'wider_community'/);
  });

  test("enforces sealed 4-status CHECK on response_status", () => {
    const code = readCode();
    expect(code).toMatch(/'pending'/);
    expect(code).toMatch(/'accepted'/);
    expect(code).toMatch(/'declined'/);
    expect(code).toMatch(/'withdrawn'/);
  });

  test("has UNIQUE (incident_id, recipient_account_id)", () => {
    expect(readCode()).toMatch(
      /UNIQUE\s*\(\s*incident_id\s*,\s*recipient_account_id\s*\)/i,
    );
  });

  test("creates idx_ir_recipient_status_notified", () => {
    expect(readCode()).toMatch(
      /CREATE\s+INDEX\s+IF\s+NOT\s+EXISTS\s+idx_ir_recipient_status_notified\b/i,
    );
  });

  test("has eta_minutes integer NULL", () => {
    expect(readCode()).toMatch(/\beta_minutes\s+integer\s+NULL\b/i);
  });
});

describe("migration 193 · emergency_responder_optin", () => {
  test("has account_id text PRIMARY KEY", () => {
    expect(readCode()).toMatch(/\baccount_id\s+text\s+PRIMARY\s+KEY\b/i);
  });

  test("has acknowledged_safety_guidance_at timestamptz NOT NULL", () => {
    expect(readCode()).toMatch(
      /\backnowledged_safety_guidance_at\s+timestamptz\s+NOT\s+NULL\b/i,
    );
  });

  test("has radius_km integer NOT NULL DEFAULT 5 CHECK [1,25]", () => {
    const code = readCode();
    expect(code).toMatch(/\bradius_km\s+integer\s+NOT\s+NULL\s+DEFAULT\s+5\b/i);
    expect(code).toMatch(/radius_km\s+BETWEEN\s+1\s+AND\s+25/i);
  });

  test("has simulated boolean NOT NULL DEFAULT TRUE on optin table", () => {
    // Second simulated occurrence must appear in the file.
    const matches = readCode().match(/\bsimulated\s+boolean\s+NOT\s+NULL\s+DEFAULT\s+TRUE\b/gi);
    expect(matches).not.toBeNull();
    expect(matches!.length).toBeGreaterThanOrEqual(2);
  });

  test("creates idx_ero_simulated_opted_in", () => {
    expect(readCode()).toMatch(
      /CREATE\s+INDEX\s+IF\s+NOT\s+EXISTS\s+idx_ero_simulated_opted_in\b/i,
    );
  });
});

describe("migration 193 · trusted_contact", () => {
  test("has PRIMARY KEY (owner_account_id, contact_account_id)", () => {
    expect(readCode()).toMatch(
      /PRIMARY\s+KEY\s*\(\s*owner_account_id\s*,\s*contact_account_id\s*\)/i,
    );
  });

  test("CHECK prevents self-contact", () => {
    expect(readCode()).toMatch(
      /owner_account_id\s*<>\s*contact_account_id/,
    );
  });

  test("contact_label length is bounded [1,60]", () => {
    expect(readCode()).toMatch(/contact_label[\s\S]*?BETWEEN\s+1\s+AND\s+60/i);
  });
});

describe("migration 193 · emergency_rate_limit", () => {
  test("has PRIMARY KEY (account_id, window_start)", () => {
    expect(readCode()).toMatch(
      /PRIMARY\s+KEY\s*\(\s*account_id\s*,\s*window_start\s*\)/i,
    );
  });

  test("has count integer NOT NULL DEFAULT 1", () => {
    expect(readCode()).toMatch(/\bcount\s+integer\s+NOT\s+NULL\s+DEFAULT\s+1\b/i);
  });
});

describe("migration 193 · idempotence + doctrine", () => {
  test("every CREATE TABLE uses IF NOT EXISTS", () => {
    const code = readCode();
    const creates = code.match(/\bCREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?/gi) ?? [];
    const guarded = code.match(/\bCREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\b/gi) ?? [];
    expect(guarded.length).toBe(creates.length);
  });

  test("every CREATE INDEX uses IF NOT EXISTS", () => {
    const code = readCode();
    const createIdx = code.match(/\bCREATE\s+INDEX\s+(?:IF\s+NOT\s+EXISTS\s+)?/gi) ?? [];
    const guarded = code.match(/\bCREATE\s+INDEX\s+IF\s+NOT\s+EXISTS\b/gi) ?? [];
    expect(guarded.length).toBe(createIdx.length);
  });

  test("zero DML statements (no INSERT / UPDATE / DELETE)", () => {
    const code = readCode();
    expect(code).not.toMatch(/\bINSERT\s+INTO\b/i);
    expect(code).not.toMatch(/\bUPDATE\s+\w+\s+SET\b/i);
    expect(code).not.toMatch(/\bDELETE\s+FROM\b/i);
  });
});
