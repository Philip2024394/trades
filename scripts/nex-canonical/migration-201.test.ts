// scripts/nex-canonical/migration-201.test.ts
//
// Structural tests for migration 201
// (nex.family_safety_dashboard_access_log · FS-3 · 2026-10-10).
// Pure · read-only inspection of the SQL file. No DB. No network.
//
// Shape mirrors scripts/nex-canonical/migration-190.test.ts.

import { describe, expect, test } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const MIG_PATH = path.join(
  __dirname,
  "..",
  "..",
  "deploy",
  "postgres",
  "init",
  "201_nex_family_safety_dashboard_access_log.sql",
);

function readCode(): string {
  const sql = fs.readFileSync(MIG_PATH, "utf8");
  // Strip SQL line comments so we don't accidentally match words that
  // only appear in the header prose.
  return sql.replace(/--[^\n]*/g, "");
}

describe("migration 201 · existence + target", () => {
  test("file exists", () => {
    expect(fs.existsSync(MIG_PATH)).toBe(true);
  });

  test("creates nex.family_safety_dashboard_access_log", () => {
    const code = readCode();
    expect(code).toMatch(
      /\bCREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+nex\.family_safety_dashboard_access_log\b/i,
    );
  });
});

describe("migration 201 · columns", () => {
  test("access_id uuid PRIMARY KEY DEFAULT gen_random_uuid()", () => {
    const code = readCode();
    expect(code).toMatch(
      /\baccess_id\s+uuid\s+PRIMARY\s+KEY\s+DEFAULT\s+gen_random_uuid\(\)/i,
    );
  });

  test("viewer_account_id text NOT NULL", () => {
    const code = readCode();
    expect(code).toMatch(/\bviewer_account_id\s+text\s+NOT\s+NULL\b/i);
  });

  test("viewed_child_account_id text NULL (nullable for aggregate reads)", () => {
    const code = readCode();
    expect(code).toMatch(/\bviewed_child_account_id\s+text\s+NULL\b/i);
  });

  test("surface_name text NOT NULL", () => {
    const code = readCode();
    expect(code).toMatch(/\bsurface_name\s+text\s+NOT\s+NULL\b/i);
  });

  test("outcome text NOT NULL", () => {
    const code = readCode();
    expect(code).toMatch(/\boutcome\s+text\s+NOT\s+NULL\b/i);
  });

  test("simulated boolean NOT NULL DEFAULT TRUE", () => {
    const code = readCode();
    expect(code).toMatch(
      /\bsimulated\s+boolean\s+NOT\s+NULL\s+DEFAULT\s+TRUE\b/i,
    );
  });

  test("accessed_at timestamptz NOT NULL DEFAULT now()", () => {
    const code = readCode();
    expect(code).toMatch(
      /\baccessed_at\s+timestamptz\s+NOT\s+NULL\s+DEFAULT\s+now\(\)/i,
    );
  });
});

describe("migration 201 · CHECK constraints", () => {
  test("surface_name CHECK covers all 6 sealed surface tokens", () => {
    const code = readCode();
    for (const token of [
      "dashboard_root",
      "child_dashboard",
      "child_contacts",
      "child_safechat",
      "safechat_status",
      "privacy_page",
    ]) {
      expect(code).toMatch(new RegExp(`'${token}'`));
    }
  });

  test("outcome CHECK covers all 5 sealed outcome tokens", () => {
    const code = readCode();
    for (const token of [
      "granted",
      "denied_not_guardian",
      "denied_revoked",
      "denied_flag_off",
      "denied_other",
    ]) {
      expect(code).toMatch(new RegExp(`'${token}'`));
    }
  });
});

describe("migration 201 · indexes", () => {
  test("viewer+time index for self-audit queries", () => {
    const code = readCode();
    expect(code).toMatch(
      /\bfamily_safety_dashboard_access_log_viewer_time_idx\b/,
    );
    expect(code).toMatch(
      /ON\s+nex\.family_safety_dashboard_access_log\s*\(\s*viewer_account_id\s*,\s*accessed_at\s+DESC\s*\)/i,
    );
  });

  test("outcome+time index for HQ denial-pattern scans", () => {
    const code = readCode();
    expect(code).toMatch(
      /\bfamily_safety_dashboard_access_log_outcome_time_idx\b/,
    );
    expect(code).toMatch(
      /ON\s+nex\.family_safety_dashboard_access_log\s*\(\s*outcome\s*,\s*accessed_at\s+DESC\s*\)/i,
    );
  });
});

describe("migration 201 · safety posture", () => {
  test("no row-level DML on any table", () => {
    const code = readCode();
    expect(code).not.toMatch(/\bINSERT\s+INTO\s+nex\./i);
    expect(code).not.toMatch(/\bUPDATE\s+nex\.\w+\s+SET\b/i);
    expect(code).not.toMatch(/\bDELETE\s+FROM\s+nex\./i);
    expect(code).not.toMatch(/\bTRUNCATE\b/i);
  });

  test("no DROP of any object", () => {
    const code = readCode();
    expect(code).not.toMatch(/\bDROP\s+TABLE\b/i);
    expect(code).not.toMatch(/\bDROP\s+VIEW\b/i);
    expect(code).not.toMatch(/\bDROP\s+COLUMN\b/i);
    expect(code).not.toMatch(/\bDROP\s+CONSTRAINT\b/i);
  });

  test("no GRANT/REVOKE", () => {
    const code = readCode();
    expect(code).not.toMatch(
      /\b(?:GRANT|REVOKE)\s+(?:ALL|SELECT|INSERT|UPDATE|DELETE|USAGE|EXECUTE|TRUNCATE|REFERENCES|TRIGGER)\b/i,
    );
  });

  test("no triggers", () => {
    const code = readCode();
    expect(code).not.toMatch(/\bCREATE\s+(?:OR\s+REPLACE\s+)?TRIGGER\b/i);
  });

  test("no ALTER of sealed Family Links tables (zero-risk additive)", () => {
    const code = readCode();
    expect(code).not.toMatch(/\bALTER\s+TABLE\s+nex\.family_link\b/i);
    expect(code).not.toMatch(
      /\bALTER\s+TABLE\s+nex\.family_link_pressure_report\b/i,
    );
    expect(code).not.toMatch(
      /\bALTER\s+TABLE\s+nex\.family_link_revocation_cooldown\b/i,
    );
  });

  test("no raw-message or child-content column references (privacy guarantee)", () => {
    const code = readCode();
    expect(code).not.toMatch(/\bmessage_body\b/i);
    expect(code).not.toMatch(/\bmessage_content\b/i);
    expect(code).not.toMatch(/\brule_matches\b/i);
    expect(code).not.toMatch(/\bsignals\b/i);
    expect(code).not.toMatch(/\bciphertext\b/i);
    expect(code).not.toMatch(/\bplaintext\b/i);
  });
});
