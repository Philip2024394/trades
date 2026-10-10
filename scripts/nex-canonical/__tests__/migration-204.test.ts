// scripts/nex-canonical/__tests__/migration-204.test.ts
//
// Structural tests for migration 204 (NEX Family Safety · Child Account
// Creation · ID verification submission · Phase 1 · simulated=TRUE).
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
  "204_nex_id_verification_submission.sql",
);

function readCode(): string {
  const sql = fs.readFileSync(MIG_PATH, "utf8");
  // Strip SQL comments so grep-style tests don't match doc prose.
  return sql.replace(/--[^\n]*/g, "");
}

describe("migration 204 · existence + target", () => {
  test("file exists", () => {
    expect(fs.existsSync(MIG_PATH)).toBe(true);
  });

  test("file is non-trivially sized (>2KB)", () => {
    const raw = fs.readFileSync(MIG_PATH, "utf8");
    expect(raw.length).toBeGreaterThan(2048);
  });

  test("creates nex.id_verification_submission table", () => {
    expect(readCode()).toMatch(
      /CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+nex\.id_verification_submission/i,
    );
  });

  test("creates nex.id_document_blob table", () => {
    expect(readCode()).toMatch(
      /CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+nex\.id_document_blob/i,
    );
  });
});

describe("migration 204 · id_verification_submission columns + CHECKs", () => {
  test("submission_id uuid PK with default", () => {
    expect(readCode()).toMatch(
      /submission_id\s+uuid\s+PRIMARY\s+KEY\s+DEFAULT\s+gen_random_uuid\(\)/i,
    );
  });

  test("submitter_account_id text NOT NULL", () => {
    expect(readCode()).toMatch(/submitter_account_id\s+text\s+NOT\s+NULL/i);
  });

  test("document_type CHECK includes all 5 sealed types", () => {
    const code = readCode();
    for (const t of [
      "indonesian_kk",
      "indonesian_birth_certificate",
      "indonesian_akta",
      "passport",
      "other",
    ]) {
      expect(code).toMatch(new RegExp(`'${t}'`));
    }
  });

  test("document_storage_ref text NOT NULL", () => {
    expect(readCode()).toMatch(/document_storage_ref\s+text\s+NOT\s+NULL/i);
  });

  test("document_bytes_sha256 enforces length = 64", () => {
    const code = readCode();
    expect(code).toMatch(/document_bytes_sha256\s+text\s+NOT\s+NULL/i);
    expect(code).toMatch(/length\(document_bytes_sha256\)\s*=\s*64/i);
  });

  test("idempotency_key text NOT NULL", () => {
    expect(readCode()).toMatch(/idempotency_key\s+text\s+NOT\s+NULL/i);
  });

  test("verifier_adapter defaults to stub_pending_vendor", () => {
    expect(readCode()).toMatch(
      /verifier_adapter\s+text\s+NOT\s+NULL\s+DEFAULT\s+'stub_pending_vendor'/i,
    );
  });

  test("verification_outcome CHECK includes all 4 sealed outcomes", () => {
    const code = readCode();
    for (const o of ["pending", "verified", "rejected", "unknown"]) {
      expect(code).toMatch(new RegExp(`'${o}'`));
    }
  });

  test("verification_outcome defaults to 'pending'", () => {
    expect(readCode()).toMatch(
      /verification_outcome\s+text\s+NOT\s+NULL\s+DEFAULT\s+'pending'/i,
    );
  });

  test("verifier_response_summary_redacted length 1..500", () => {
    const code = readCode();
    expect(code).toMatch(/verifier_response_summary_redacted/i);
    expect(code).toMatch(/BETWEEN\s+1\s+AND\s+500/i);
  });

  test("simulated boolean NOT NULL DEFAULT TRUE", () => {
    expect(readCode()).toMatch(/simulated\s+boolean\s+NOT\s+NULL\s+DEFAULT\s+TRUE/i);
  });

  test("submitted_at timestamptz NOT NULL DEFAULT now()", () => {
    expect(readCode()).toMatch(
      /submitted_at\s+timestamptz\s+NOT\s+NULL\s+DEFAULT\s+now\(\)/i,
    );
  });

  test("verified_at + rejected_at nullable timestamptz", () => {
    const code = readCode();
    expect(code).toMatch(/verified_at\s+timestamptz\s+NULL/i);
    expect(code).toMatch(/rejected_at\s+timestamptz\s+NULL/i);
  });
});

describe("migration 204 · id_document_blob columns + CHECKs", () => {
  test("submission_id PK references id_verification_submission ON DELETE CASCADE", () => {
    const code = readCode();
    expect(code).toMatch(
      /submission_id[\s\S]*?PRIMARY\s+KEY[\s\S]*?REFERENCES\s+nex\.id_verification_submission[\s\S]*?ON\s+DELETE\s+CASCADE/i,
    );
  });

  test("document_bytes bytea NOT NULL", () => {
    expect(readCode()).toMatch(/document_bytes\s+bytea\s+NOT\s+NULL/i);
  });

  test("mime_type CHECK includes 4 sealed types", () => {
    const code = readCode();
    for (const m of ["image/jpeg", "image/png", "image/webp", "application/pdf"]) {
      expect(code).toMatch(new RegExp(`'${m}'`));
    }
  });

  test("stored_at timestamptz NOT NULL DEFAULT now()", () => {
    expect(readCode()).toMatch(
      /stored_at\s+timestamptz\s+NOT\s+NULL\s+DEFAULT\s+now\(\)/i,
    );
  });
});

describe("migration 204 · indexes", () => {
  test("id_verification_submission_idem_uq is UNIQUE on idempotency_key", () => {
    const code = readCode();
    expect(code).toMatch(
      /CREATE\s+UNIQUE\s+INDEX\s+IF\s+NOT\s+EXISTS\s+id_verification_submission_idem_uq/i,
    );
    expect(code).toMatch(/\(\s*idempotency_key\s*\)/i);
  });

  test("id_verification_submission_outcome_time_idx exists", () => {
    expect(readCode()).toMatch(/id_verification_submission_outcome_time_idx/i);
  });

  test("id_verification_submission_submitter_idx exists", () => {
    expect(readCode()).toMatch(/id_verification_submission_submitter_idx/i);
  });
});

describe("migration 204 · idempotence + doctrine", () => {
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
    expect(creates.length).toBe(2);
  });

  test("zero DML in migration", () => {
    const code = readCode();
    expect(code).not.toMatch(/\bINSERT\s+INTO\b/i);
    expect(code).not.toMatch(/\bUPDATE\s+\w+\s+SET\b/i);
    expect(code).not.toMatch(/\bDELETE\s+FROM\b/i);
  });

  test("header documents simulated=TRUE doctrine", () => {
    const raw = fs.readFileSync(MIG_PATH, "utf8");
    expect(raw).toMatch(/simulated=TRUE/i);
  });

  test("header documents frontend never queries id_document_blob", () => {
    const raw = fs.readFileSync(MIG_PATH, "utf8");
    expect(raw).toMatch(/frontend NEVER queries/i);
  });

  test("header documents session-identity gate", () => {
    const raw = fs.readFileSync(MIG_PATH, "utf8");
    expect(raw).toMatch(/current_database\(\)\s*=\s*'nex_dev'/);
  });
});
