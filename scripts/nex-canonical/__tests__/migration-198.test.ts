// scripts/nex-canonical/__tests__/migration-198.test.ts
//
// Structural tests for migration 198 · NEX Family Links Phase 1
// primitives (nex.family_link + nex.account_age_attestation).
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
  "198_nex_family_link.sql",
);

function readCode(): string {
  // Strip line comments AND COMMENT ON clauses so CHECK literal
  // searches don't accidentally match doctrine prose embedded in
  // SQL string-literal comments.
  const sql = fs.readFileSync(MIG_PATH, "utf8");
  return sql
    .replace(/--[^\n]*/g, "")
    .replace(/COMMENT\s+ON\s+(?:TABLE|COLUMN)\s+[\s\S]*?;/gi, "");
}

describe("migration 198 · existence + target", () => {
  test("file exists", () => {
    expect(fs.existsSync(MIG_PATH)).toBe(true);
  });

  test("file is non-trivially sized (>2KB)", () => {
    const raw = fs.readFileSync(MIG_PATH, "utf8");
    expect(raw.length).toBeGreaterThan(2048);
  });

  test("creates nex.family_link table", () => {
    expect(readCode()).toMatch(
      /CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+nex\.family_link/i,
    );
  });

  test("creates nex.account_age_attestation table", () => {
    expect(readCode()).toMatch(
      /CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+nex\.account_age_attestation/i,
    );
  });
});

describe("migration 198 · family_link columns", () => {
  test("link_id uuid PK with default", () => {
    expect(readCode()).toMatch(
      /link_id\s+uuid\s+PRIMARY\s+KEY\s+DEFAULT\s+gen_random_uuid\(\)/i,
    );
  });

  test("guardian_account_id text NOT NULL", () => {
    expect(readCode()).toMatch(/guardian_account_id\s+text\s+NOT\s+NULL/i);
  });

  test("child_account_id text NOT NULL", () => {
    expect(readCode()).toMatch(/child_account_id\s+text\s+NOT\s+NULL/i);
  });

  test("role text NOT NULL with 4-value CHECK", () => {
    const code = readCode();
    expect(code).toMatch(/role\s+text\s+NOT\s+NULL/i);
    for (const r of [
      "guardian_primary",
      "guardian_secondary",
      "trusted_adult",
      "mentor",
    ]) {
      expect(code).toMatch(new RegExp(`'${r}'`));
    }
  });

  test("state text NOT NULL DEFAULT 'pending' with 4-value CHECK", () => {
    const code = readCode();
    expect(code).toMatch(/state\s+text\s+NOT\s+NULL\s+DEFAULT\s+'pending'/i);
    for (const s of ["pending", "active", "revoked", "expired"]) {
      expect(code).toMatch(new RegExp(`'${s}'`));
    }
  });

  test("initiated_by text NOT NULL with 3-value CHECK", () => {
    const code = readCode();
    expect(code).toMatch(/initiated_by\s+text\s+NOT\s+NULL/i);
    for (const i of ["guardian_invite", "child_invite", "system_setup"]) {
      expect(code).toMatch(new RegExp(`'${i}'`));
    }
  });

  test("initiated_at timestamptz NOT NULL DEFAULT now()", () => {
    expect(readCode()).toMatch(
      /initiated_at\s+timestamptz\s+NOT\s+NULL\s+DEFAULT\s+now\(\)/i,
    );
  });

  test("confirmed_at timestamptz NULL", () => {
    expect(readCode()).toMatch(/confirmed_at\s+timestamptz\s+NULL/i);
  });

  test("revoked_at / revoked_by / revoked_reason columns", () => {
    const code = readCode();
    expect(code).toMatch(/revoked_at\s+timestamptz\s+NULL/i);
    expect(code).toMatch(/revoked_by\s+text\s+NULL/i);
    expect(code).toMatch(
      /revoked_reason\s+text\s+NULL[\s\S]*BETWEEN\s+1\s+AND\s+200/i,
    );
  });

  test("expires_at timestamptz NULL", () => {
    expect(readCode()).toMatch(/expires_at\s+timestamptz\s+NULL/i);
  });

  test("can_see_emergency_alerts boolean NOT NULL DEFAULT TRUE", () => {
    expect(readCode()).toMatch(
      /can_see_emergency_alerts\s+boolean\s+NOT\s+NULL\s+DEFAULT\s+TRUE/i,
    );
  });

  test("can_see_safety_summaries boolean NOT NULL DEFAULT FALSE", () => {
    expect(readCode()).toMatch(
      /can_see_safety_summaries\s+boolean\s+NOT\s+NULL\s+DEFAULT\s+FALSE/i,
    );
  });

  test("can_see_location_when_shared boolean NOT NULL DEFAULT FALSE", () => {
    expect(readCode()).toMatch(
      /can_see_location_when_shared\s+boolean\s+NOT\s+NULL\s+DEFAULT\s+FALSE/i,
    );
  });

  test("simulated boolean NOT NULL DEFAULT TRUE", () => {
    const code = readCode();
    // Appears in BOTH tables · at least two occurrences.
    const matches = code.match(
      /simulated\s+boolean\s+NOT\s+NULL\s+DEFAULT\s+TRUE/gi,
    );
    expect(matches && matches.length).toBeGreaterThanOrEqual(2);
  });

  test("created_at timestamptz NOT NULL DEFAULT now()", () => {
    const code = readCode();
    // Appears in BOTH tables.
    const matches = code.match(
      /created_at\s+timestamptz\s+NOT\s+NULL\s+DEFAULT\s+now\(\)/gi,
    );
    expect(matches && matches.length).toBeGreaterThanOrEqual(2);
  });
});

describe("migration 198 · family_link constraints + indexes", () => {
  test("guardian_not_child CHECK is added idempotently", () => {
    const code = readCode();
    expect(code).toMatch(/family_link_guardian_not_child/);
    expect(code).toMatch(/guardian_account_id\s*<>\s*child_account_id/i);
    expect(code).toMatch(/pg_constraint/i);
  });

  test("UNIQUE partial index on child_account_id for primary guardian", () => {
    const code = readCode();
    expect(code).toMatch(
      /CREATE\s+UNIQUE\s+INDEX\s+IF\s+NOT\s+EXISTS\s+family_link_primary_guardian_uq/i,
    );
    expect(code).toMatch(
      /WHERE\s+role\s*=\s*'guardian_primary'\s+AND\s+state\s*=\s*'active'/i,
    );
  });

  test("UNIQUE partial index on (guardian_account_id, child_account_id) for active", () => {
    const code = readCode();
    expect(code).toMatch(
      /CREATE\s+UNIQUE\s+INDEX\s+IF\s+NOT\s+EXISTS\s+family_link_pair_active_uq/i,
    );
    expect(code).toMatch(/WHERE\s+state\s*=\s*'active'/i);
  });

  test("child + state lookup index", () => {
    expect(readCode()).toMatch(
      /family_link_child_state_idx[\s\S]*child_account_id\s*,\s*state/i,
    );
  });

  test("guardian + state lookup index", () => {
    expect(readCode()).toMatch(
      /family_link_guardian_state_idx[\s\S]*guardian_account_id\s*,\s*state/i,
    );
  });
});

describe("migration 198 · account_age_attestation columns", () => {
  test("attestation_id uuid PK with default", () => {
    expect(readCode()).toMatch(
      /attestation_id\s+uuid\s+PRIMARY\s+KEY\s+DEFAULT\s+gen_random_uuid\(\)/i,
    );
  });

  test("account_id text NOT NULL", () => {
    expect(readCode()).toMatch(/account_id\s+text\s+NOT\s+NULL/i);
  });

  test("declared_date_of_birth date NOT NULL with bounds CHECK", () => {
    const code = readCode();
    expect(code).toMatch(/declared_date_of_birth\s+date\s+NOT\s+NULL/i);
    expect(code).toMatch(/declared_date_of_birth\s*>\s*DATE\s*'1900-01-01'/i);
    expect(code).toMatch(/declared_date_of_birth\s*<=\s*CURRENT_DATE/i);
  });

  test("attested_by text NOT NULL with 3-value CHECK", () => {
    const code = readCode();
    expect(code).toMatch(/attested_by\s+text\s+NOT\s+NULL/i);
    for (const a of ["self", "guardian", "system_fallback"]) {
      expect(code).toMatch(new RegExp(`'${a}'`));
    }
  });

  test("attested_by_account_id text NULL", () => {
    expect(readCode()).toMatch(/attested_by_account_id\s+text\s+NULL/i);
  });

  test("attestation_method text NOT NULL DEFAULT 'declared' with 3-value CHECK", () => {
    const code = readCode();
    expect(code).toMatch(
      /attestation_method\s+text\s+NOT\s+NULL\s+DEFAULT\s+'declared'/i,
    );
    for (const m of [
      "declared",
      "guardian_declared",
      "document_verified_future_phase",
    ]) {
      expect(code).toMatch(new RegExp(`'${m}'`));
    }
  });

  test("attestation_notes text NULL with 1..500 bound", () => {
    expect(readCode()).toMatch(
      /attestation_notes\s+text\s+NULL[\s\S]*BETWEEN\s+1\s+AND\s+500/i,
    );
  });

  test("superseded_by uuid NULL + self-FK", () => {
    const code = readCode();
    expect(code).toMatch(/superseded_by\s+uuid\s+NULL/i);
    expect(code).toMatch(
      /REFERENCES\s+nex\.account_age_attestation\s*\(\s*attestation_id\s*\)/i,
    );
  });
});

describe("migration 198 · account_age_attestation indexes", () => {
  test("per-account time index DESC", () => {
    const code = readCode();
    expect(code).toMatch(/account_age_attestation_account_time_idx/i);
    expect(code).toMatch(/account_id\s*,\s*created_at\s+DESC/i);
  });

  test("UNIQUE partial index on account_id WHERE superseded_by IS NULL", () => {
    const code = readCode();
    expect(code).toMatch(
      /CREATE\s+UNIQUE\s+INDEX\s+IF\s+NOT\s+EXISTS\s+account_age_attestation_active_uq/i,
    );
    expect(code).toMatch(/WHERE\s+superseded_by\s+IS\s+NULL/i);
  });
});

describe("migration 198 · idempotence + doctrine + non-vendor guarantees", () => {
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
  });

  test("zero DML", () => {
    const code = readCode();
    expect(code).not.toMatch(/\bINSERT\s+INTO\b/i);
    expect(code).not.toMatch(/\bUPDATE\s+\w+\s+SET\b/i);
    expect(code).not.toMatch(/\bDELETE\s+FROM\b/i);
  });

  test("header documents the capability ceiling", () => {
    const raw = fs.readFileSync(MIG_PATH, "utf8");
    expect(raw).toMatch(/capability\s+ceiling/i);
  });

  test("header documents the simulated-TRUE pilot gate", () => {
    const raw = fs.readFileSync(MIG_PATH, "utf8");
    expect(raw).toMatch(/simulated=TRUE/i);
    expect(raw).toMatch(/PILOT/i);
  });

  test("schema is vendor-agnostic · no verifier identifier columns", () => {
    const code = readCode();
    // We deliberately refuse to bake vendor names into the schema. If
    // a future wave onboards a verifier, it must land its own column
    // in its own migration — not re-use this one.
    expect(code).not.toMatch(/yoti/i);
    expect(code).not.toMatch(/jumio/i);
    expect(code).not.toMatch(/veriff/i);
    expect(code).not.toMatch(/onfido/i);
    expect(code).not.toMatch(/stripe_identity/i);
    expect(code).not.toMatch(/verifier_id/i);
  });

  test("schema does NOT capture ID-document or biometric data", () => {
    const code = readCode();
    expect(code).not.toMatch(/id_document/i);
    expect(code).not.toMatch(/passport/i);
    expect(code).not.toMatch(/biometric/i);
    expect(code).not.toMatch(/face_hash/i);
    expect(code).not.toMatch(/selfie/i);
    expect(code).not.toMatch(/document_url/i);
  });
});
