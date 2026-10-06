// src/lib/nex-native/__tests__/vault-phase-a-schema.test.ts
//
// Vault Phase A · Commit A.1 · schema regression suite.
//
// This commit is SCHEMA ONLY. No routes, services, or runtime behaviour
// land here · they belong to A.2–A.7. These tests therefore operate on
// the migration SQL text itself, asserting the invariants the live DB
// will later enforce. The real "does Postgres accept these migrations"
// check is a separate SQL verification pass against the live Supabase
// project (see commit report).
//
// What this file protects against:
//
//   · Someone later weakening the hard invariant on nex_vault_file
//     (migration_state = 'encrypted' ⇔ legacy_bytes_path IS NULL).
//
//   · Someone adding a fifth migration_state value without founder
//     authorisation.
//
//   · Someone silently removing a Phase 1.0 event_type from the
//     extended CHECK list (which would quietly break existing audit
//     writes).
//
//   · Someone forgetting owner-scoped RLS on any of the five new tables.
//
//   · Someone minting a 6-digit PIN mode or an unapproved algorithm.
//
// Deterministic · no DB, no network, no service bootstrap.
//
// Sealed by founder authorisation 2026-10-06.

import { describe, test, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const REPO = path.resolve(__dirname, "../../../..");
const MIGRATION_141 = path.join(
  REPO,
  "nex-supabase/migrations/141_nex_vault_phase_a_schema.sql",
);
const MIGRATION_142 = path.join(
  REPO,
  "nex-supabase/migrations/142_nex_vault_envelope_tables.sql",
);

function read(p: string): string {
  return fs.readFileSync(p, "utf8");
}

/** Strip `-- ...` SQL line comments so grep assertions don't match
 *  parentheses inside comment prose like "(unchanged)" or illustrative
 *  snippets inside post-apply verification blocks. Comments remain
 *  present in the migration file for human readers; the stripped
 *  version is only used by the regex assertions below. */
function stripSqlComments(sql: string): string {
  return sql
    .split(/\r?\n/)
    .map((line) => {
      const idx = line.indexOf("--");
      return idx === -1 ? line : line.slice(0, idx);
    })
    .join("\n");
}

// ---------------------------------------------------------------------------
// Migration 141 · Phase A column additions to existing tables
// ---------------------------------------------------------------------------
describe("migration 141 · Phase A schema additions", () => {
  const sql = read(MIGRATION_141);

  test("file exists and is non-trivial", () => {
    expect(sql.length).toBeGreaterThan(2000);
  });

  test("is wrapped in BEGIN / COMMIT", () => {
    expect(sql).toMatch(/\bBEGIN;\s/);
    expect(sql).toMatch(/\bCOMMIT;\s*$/m);
  });

  test("inserts into nex_migration_history with version '141'", () => {
    expect(sql).toMatch(/INSERT INTO nex_migration_history[\s\S]*VALUES\s*\(\s*'141'/);
  });

  // ─── nex_webauthn_credential + prf_supported ─────────────────────────
  describe("nex_webauthn_credential · prf_supported", () => {
    test("ALTER adds prf_supported with safe default", () => {
      expect(sql).toMatch(
        /ALTER TABLE nex_webauthn_credential[\s\S]*ADD COLUMN IF NOT EXISTS prf_supported boolean NOT NULL DEFAULT false/,
      );
    });

    test("default is FALSE · never TRUE · existing creds stay non-PRF", () => {
      const m = sql.match(/prf_supported boolean NOT NULL DEFAULT\s+(\w+)/);
      expect(m).not.toBeNull();
      expect(m![1]).toBe("false");
    });
  });

  // ─── nex_account_device_key + revoked_at ─────────────────────────────
  describe("nex_account_device_key · revoked_at", () => {
    test("ALTER adds nullable revoked_at", () => {
      expect(sql).toMatch(
        /ALTER TABLE nex_account_device_key[\s\S]*ADD COLUMN IF NOT EXISTS revoked_at timestamptz NULL/,
      );
    });

    test("partial index skips revoked rows for the active-device fast path", () => {
      expect(sql).toMatch(
        /CREATE INDEX IF NOT EXISTS nex_account_device_key_active_idx[\s\S]*WHERE revoked_at IS NULL/,
      );
    });
  });

  // ─── nex_vault_file · Phase A columns ────────────────────────────────
  describe("nex_vault_file · seven Phase A columns", () => {
    const expectedColumns = [
      "wrapped_content_key bytea NULL",
      "content_nonce bytea NULL",
      "encryption_algorithm text NULL",
      "rotation_generation integer NOT NULL DEFAULT 1",
      "legacy_bytes_path text NULL",
      "migration_state text NOT NULL DEFAULT 'encrypted'",
      "migrated_at timestamptz NULL",
    ];

    for (const col of expectedColumns) {
      test(`adds column: ${col}`, () => {
        expect(sql).toContain(col);
      });
    }
  });

  // ─── The four-state machine ──────────────────────────────────────────
  describe("nex_vault_file · migration_state four-state machine", () => {
    test("CHECK allowlist is exactly {legacy, migrating, encrypted, failed}", () => {
      const m = sql.match(
        /ADD CONSTRAINT nex_vault_file_migration_state_values[\s\S]*?CHECK\s*\(\s*migration_state IN\s*\(([^)]*)\)/,
      );
      expect(m).not.toBeNull();
      const values = m![1]!
        .split(",")
        .map((s) => s.trim().replace(/'/g, ""))
        .filter(Boolean)
        .sort();
      expect(values).toEqual(["encrypted", "failed", "legacy", "migrating"]);
    });

    test("hard invariant permits exactly four tuples", () => {
      const m = sql.match(
        /ADD CONSTRAINT nex_vault_file_migration_invariant CHECK\s*\(([\s\S]*?)\n\s*\);/,
      );
      expect(m).not.toBeNull();
      const body = m![1]!;
      // Each state appears exactly once as a top-level branch of the OR.
      for (const state of ["encrypted", "migrating", "legacy", "failed"]) {
        const occurrences = body.match(
          new RegExp(`migration_state = '${state}'`, "g"),
        );
        expect(occurrences, `state ${state} branch count`).not.toBeNull();
        expect(occurrences!.length, `state ${state} branch count`).toBe(1);
      }
    });

    test("hard invariant · 'encrypted' branch requires legacy_bytes_path IS NULL", () => {
      const m = sql.match(
        /\(migration_state = 'encrypted'\s+AND[\s\S]*?legacy_bytes_path IS NULL[\s\S]*?\)/,
      );
      expect(m).not.toBeNull();
    });

    test("hard invariant · 'encrypted' branch requires all four non-null fields", () => {
      const m = sql.match(
        /\(migration_state = 'encrypted'([\s\S]*?)\)/,
      );
      expect(m).not.toBeNull();
      const branch = m![1]!;
      expect(branch).toContain("legacy_bytes_path IS NULL");
      expect(branch).toContain("wrapped_content_key IS NOT NULL");
      expect(branch).toContain("encryption_algorithm IS NOT NULL");
      expect(branch).toContain("content_nonce IS NOT NULL");
      expect(branch).toContain("migrated_at IS NOT NULL");
    });

    test("hard invariant · 'migrating' branch requires BOTH copies present", () => {
      const m = sql.match(
        /\(migration_state = 'migrating'([\s\S]*?)\)/,
      );
      expect(m).not.toBeNull();
      const branch = m![1]!;
      expect(branch).toContain("legacy_bytes_path IS NOT NULL");
      expect(branch).toContain("wrapped_content_key IS NOT NULL");
      expect(branch).toContain("encryption_algorithm IS NOT NULL");
      expect(branch).toContain("content_nonce IS NOT NULL");
    });

    test("hard invariant · 'legacy' branch keeps crypto columns NULL", () => {
      const m = sql.match(/\(migration_state = 'legacy'([\s\S]*?)\)/);
      expect(m).not.toBeNull();
      const branch = m![1]!;
      expect(branch).toContain("legacy_bytes_path IS NOT NULL");
      expect(branch).toContain("wrapped_content_key IS NULL");
      expect(branch).toContain("encryption_algorithm IS NULL");
      expect(branch).toContain("content_nonce IS NULL");
    });

    test("hard invariant · 'failed' branch preserves legacy bytes · retry-safe", () => {
      const m = sql.match(/\(migration_state = 'failed'([\s\S]*?)\)/);
      expect(m).not.toBeNull();
      const branch = m![1]!;
      expect(branch).toContain("legacy_bytes_path IS NOT NULL");
      expect(branch).toContain("wrapped_content_key IS NULL");
      expect(branch).toContain("encryption_algorithm IS NULL");
      expect(branch).toContain("content_nonce IS NULL");
    });

    test("backfill flips wrapped_content_key-less rows to 'legacy' BEFORE invariant is added", () => {
      const updateIdx = sql.search(
        /UPDATE nex_vault_file[\s\S]*?SET migration_state\s*=\s*'legacy'/,
      );
      const invariantIdx = sql.search(
        /ADD CONSTRAINT nex_vault_file_migration_invariant/,
      );
      expect(updateIdx).toBeGreaterThan(-1);
      expect(invariantIdx).toBeGreaterThan(-1);
      expect(updateIdx).toBeLessThan(invariantIdx);
    });

    test("backfill sets legacy_bytes_path = bucket_path", () => {
      expect(sql).toMatch(
        /UPDATE nex_vault_file[\s\S]*?SET[\s\S]*?legacy_bytes_path\s*=\s*bucket_path/,
      );
    });

    test("backfill scope is only rows without wrapped_content_key", () => {
      expect(sql).toMatch(
        /UPDATE nex_vault_file[\s\S]*?WHERE wrapped_content_key IS NULL/,
      );
    });

    test("encryption_algorithm allowlist is exactly {aes-256-gcm/v1}", () => {
      const m = sql.match(
        /ADD CONSTRAINT nex_vault_file_encryption_algorithm_values[\s\S]*?CHECK\s*\(([\s\S]*?)\)/,
      );
      expect(m).not.toBeNull();
      const body = m![1]!;
      expect(body).toContain("'aes-256-gcm/v1'");
      expect(body).toContain("IS NULL");
      // No other algorithms sneaking in:
      const otherAlgos = body.match(/'[^']+'/g) ?? [];
      expect(otherAlgos).toEqual(["'aes-256-gcm/v1'"]);
    });

    test("rotation_generation starts at 1 with range CHECK", () => {
      expect(sql).toMatch(
        /ADD CONSTRAINT nex_vault_file_rotation_generation_range\s+CHECK \(rotation_generation >= 1\)/,
      );
    });

    test("migration-queue index excludes 'encrypted' rows", () => {
      expect(sql).toMatch(
        /CREATE INDEX IF NOT EXISTS nex_vault_file_migration_state_idx[\s\S]*WHERE migration_state <> 'encrypted'/,
      );
    });
  });

  // ─── nex_session · step-up timestamps ───────────────────────────────
  describe("nex_session · three step-up freshness columns", () => {
    const expected = [
      "last_password_verified_at timestamptz NULL",
      "last_webauthn_verified_at timestamptz NULL",
      "last_vault_unlock_at      timestamptz NULL",
    ];
    for (const col of expected) {
      test(`adds column: ${col.replace(/\s+/g, " ")}`, () => {
        expect(sql.replace(/\s+/g, " ")).toContain(col.replace(/\s+/g, " "));
      });
    }
  });

  // ─── nex_sign_in_event event_type ───────────────────────────────────
  describe("nex_sign_in_event · event_type CHECK extension", () => {
    const phase1Values = [
      "password",
      "webauthn",
      "magic_link",
      "remote_sign_out",
      "password_change",
      "failure",
    ] as const;

    const phaseAAdditions = [
      "vault_unlock",
      "vault_unlock_failed",
      "device_authorized",
      "device_revoked",
      "vault_rotated",
      "recovery_configured",
      "step_up_required_blocked",
      "password_reset_completed",
      "legacy_file_migrated",
      "legacy_file_migration_failed",
    ] as const;

    test("drops the old constraint before adding the new one", () => {
      const dropIdx = sql.search(
        /DROP CONSTRAINT IF EXISTS nex_sign_in_event_type_values/,
      );
      const addIdx = sql.search(
        /ADD CONSTRAINT nex_sign_in_event_type_values/,
      );
      expect(dropIdx).toBeGreaterThan(-1);
      expect(addIdx).toBeGreaterThan(-1);
      expect(dropIdx).toBeLessThan(addIdx);
    });

    const stripped = stripSqlComments(sql);

    test("new CHECK keeps ALL Phase 1.0 values (no silent breakage)", () => {
      const m = stripped.match(
        /ADD CONSTRAINT nex_sign_in_event_type_values[\s\S]*?CHECK \(event_type IN \(([^)]*)\)/,
      );
      expect(m).not.toBeNull();
      const body = m![1]!;
      for (const v of phase1Values) {
        expect(body, `missing Phase 1.0 value: ${v}`).toContain(`'${v}'`);
      }
    });

    test("new CHECK admits every Phase A audit event", () => {
      const m = stripped.match(
        /ADD CONSTRAINT nex_sign_in_event_type_values[\s\S]*?CHECK \(event_type IN \(([^)]*)\)/,
      );
      expect(m).not.toBeNull();
      const body = m![1]!;
      for (const v of phaseAAdditions) {
        expect(body, `missing Phase A value: ${v}`).toContain(`'${v}'`);
      }
    });

    test("the two value sets are exactly complementary · no extras", () => {
      const m = stripped.match(
        /ADD CONSTRAINT nex_sign_in_event_type_values[\s\S]*?CHECK \(event_type IN \(([^)]*)\)/,
      );
      expect(m).not.toBeNull();
      const body = m![1]!;
      const found = (body.match(/'[a-z_]+'/g) ?? []).map((s) =>
        s.slice(1, -1),
      );
      const unique = [...new Set(found)].sort();
      const expectedAll = [...phase1Values, ...phaseAAdditions].sort();
      expect(unique).toEqual(expectedAll);
    });
  });
});

// ---------------------------------------------------------------------------
// Migration 142 · Phase A new tables
// ---------------------------------------------------------------------------
describe("migration 142 · Phase A new tables", () => {
  const sql = read(MIGRATION_142);

  test("file exists and is non-trivial", () => {
    expect(sql.length).toBeGreaterThan(2000);
  });

  test("is wrapped in BEGIN / COMMIT", () => {
    expect(sql).toMatch(/\bBEGIN;\s/);
    expect(sql).toMatch(/\bCOMMIT;\s*$/m);
  });

  test("records version '142' in nex_migration_history", () => {
    expect(sql).toMatch(/INSERT INTO nex_migration_history[\s\S]*VALUES\s*\(\s*'142'/);
  });

  // ─── all five tables exist ──────────────────────────────────────────
  const newTables = [
    "nex_vault_setup",
    "nex_vault_key_envelope",
    "nex_vault_pin_attempt",
    "nex_vault_recovery_attempt",
    "nex_vault_file_migration_attempt",
  ] as const;

  for (const t of newTables) {
    test(`creates ${t}`, () => {
      expect(sql).toMatch(
        new RegExp(`CREATE TABLE IF NOT EXISTS ${t}\\s*\\(`),
      );
    });

    test(`${t} · enables ROW LEVEL SECURITY`, () => {
      expect(sql).toMatch(
        new RegExp(`ALTER TABLE ${t} ENABLE ROW LEVEL SECURITY`),
      );
    });

    test(`${t} · has exactly one owner-scoped SELECT policy`, () => {
      const matches =
        sql.match(
          new RegExp(
            `CREATE POLICY \\w+_owner_read\\s+ON ${t}\\s+FOR SELECT`,
            "g",
          ),
        ) ?? [];
      expect(matches.length).toBe(1);
    });

    test(`${t} · owner-scope resolves through supabase_user_id`, () => {
      // The SELECT policy must gate via "account_id IN (SELECT id FROM
      // nex_account WHERE supabase_user_id = auth.uid())" or equivalent.
      const re = new RegExp(
        `CREATE POLICY \\w+_owner_read\\s+ON ${t}[\\s\\S]*?account_id IN \\(SELECT id FROM nex_account WHERE supabase_user_id = auth\\.uid\\(\\)\\)`,
      );
      expect(sql).toMatch(re);
    });

    test(`${t} · has NO INSERT/UPDATE/DELETE policy (service-role writes only)`, () => {
      const writeOps =
        sql.match(
          new RegExp(
            `CREATE POLICY \\w+\\s+ON ${t}\\s+FOR (INSERT|UPDATE|DELETE)`,
            "g",
          ),
        ) ?? [];
      expect(writeOps).toEqual([]);
    });
  }

  // ─── nex_vault_setup specifics ──────────────────────────────────────
  describe("nex_vault_setup · founder-locked constraints", () => {
    test("pin_mode CHECK is exactly {'pin','passphrase'} — no 6-digit mode", () => {
      const m = sql.match(
        /CONSTRAINT nex_vault_setup_pin_mode_values[\s\S]*?CHECK \(pin_mode IN \(([^)]*)\)/,
      );
      expect(m).not.toBeNull();
      const values = (m![1]!.match(/'[^']+'/g) ?? [])
        .map((s) => s.slice(1, -1))
        .sort();
      expect(values).toEqual(["passphrase", "pin"]);
    });

    test("prf_salt is exactly 16 bytes (design §L.5)", () => {
      expect(sql).toMatch(
        /CONSTRAINT nex_vault_setup_prf_salt_length\s+CHECK \(octet_length\(prf_salt\) = 16\)/,
      );
    });

    test("recovery is all-or-nothing · configured_at ⇔ salt ⇔ argon_params", () => {
      expect(sql).toMatch(
        /CONSTRAINT nex_vault_setup_recovery_shape[\s\S]*recovery_configured_at IS NULL[\s\S]*recovery_salt IS NULL[\s\S]*recovery_argon_params IS NULL/,
      );
    });

    test("vmk_generation starts at 1 with range CHECK", () => {
      expect(sql).toMatch(
        /CONSTRAINT nex_vault_setup_vmk_generation_range\s+CHECK \(vmk_generation >= 1\)/,
      );
    });

    test("pin_salt length is 16-64 bytes", () => {
      expect(sql).toMatch(
        /CONSTRAINT nex_vault_setup_pin_salt_length\s+CHECK \(octet_length\(pin_salt\) BETWEEN 16 AND 64\)/,
      );
    });
  });

  // ─── nex_vault_key_envelope specifics ───────────────────────────────
  describe("nex_vault_key_envelope · four unlock paths", () => {
    test("kind CHECK is exactly {pin, webauthn, device, recovery}", () => {
      const m = sql.match(
        /CONSTRAINT nex_vault_key_envelope_kind_values[\s\S]*?CHECK \(kind IN \(([^)]*)\)/,
      );
      expect(m).not.toBeNull();
      const values = (m![1]!.match(/'[^']+'/g) ?? [])
        .map((s) => s.slice(1, -1))
        .sort();
      expect(values).toEqual(["device", "pin", "recovery", "webauthn"]);
    });

    test("algorithm is pinned to 'aes-256-gcm/v1' only", () => {
      expect(sql).toMatch(
        /CONSTRAINT nex_vault_key_envelope_algorithm_values\s+CHECK \(algorithm = 'aes-256-gcm\/v1'\)/,
      );
    });

    test("kind-shape CHECK enforces field presence per kind", () => {
      const m = sql.match(
        /CONSTRAINT nex_vault_key_envelope_target_shape CHECK\s*\(([\s\S]*?)\n\s*\)/,
      );
      expect(m).not.toBeNull();
      const body = m![1]!;
      // Four branches, one per kind:
      expect(body).toMatch(/kind = 'pin'\s+AND target_device_id IS NOT NULL\s+AND credential_id IS NULL/);
      expect(body).toMatch(/kind = 'webauthn'\s+AND target_device_id IS NULL\s+AND credential_id IS NOT NULL/);
      expect(body).toMatch(/kind = 'device'\s+AND target_device_id IS NOT NULL\s+AND credential_id IS NULL/);
      expect(body).toMatch(/kind = 'recovery'\s+AND target_device_id IS NULL\s+AND credential_id IS NULL/);
    });

    test("partial unique index · pin · one active per (account, device)", () => {
      expect(sql).toMatch(
        /CREATE UNIQUE INDEX IF NOT EXISTS nex_vault_key_envelope_pin_active[\s\S]*account_id, target_device_id[\s\S]*WHERE kind = 'pin' AND consumed_at IS NULL/,
      );
    });

    test("partial unique index · webauthn · one active per (account, credential)", () => {
      expect(sql).toMatch(
        /CREATE UNIQUE INDEX IF NOT EXISTS nex_vault_key_envelope_webauthn_active[\s\S]*account_id, credential_id[\s\S]*WHERE kind = 'webauthn' AND consumed_at IS NULL/,
      );
    });

    test("partial unique index · device · one active per (account, target_device)", () => {
      expect(sql).toMatch(
        /CREATE UNIQUE INDEX IF NOT EXISTS nex_vault_key_envelope_device_active[\s\S]*account_id, target_device_id[\s\S]*WHERE kind = 'device' AND consumed_at IS NULL/,
      );
    });

    test("partial unique index · recovery · one active per account", () => {
      expect(sql).toMatch(
        /CREATE UNIQUE INDEX IF NOT EXISTS nex_vault_key_envelope_recovery_active[\s\S]*\(\s*account_id\s*\)[\s\S]*WHERE kind = 'recovery' AND consumed_at IS NULL/,
      );
    });
  });

  // ─── nex_vault_pin_attempt + recovery_attempt ───────────────────────
  describe("rate-limit substrate tables", () => {
    test("nex_vault_pin_attempt rate index · (account, device, time DESC)", () => {
      expect(sql).toMatch(
        /CREATE INDEX IF NOT EXISTS nex_vault_pin_attempt_rate_idx[\s\S]*\(account_id, device_id, attempted_at DESC\)/,
      );
    });

    test("nex_vault_recovery_attempt rate index · (account, time DESC)", () => {
      expect(sql).toMatch(
        /CREATE INDEX IF NOT EXISTS nex_vault_recovery_attempt_rate_idx[\s\S]*\(account_id, attempted_at DESC\)/,
      );
    });

    test("neither table has an UPDATE / DELETE policy (append-only)", () => {
      for (const t of ["nex_vault_pin_attempt", "nex_vault_recovery_attempt"]) {
        const writes =
          sql.match(
            new RegExp(
              `CREATE POLICY \\w+\\s+ON ${t}\\s+FOR (INSERT|UPDATE|DELETE)`,
              "g",
            ),
          ) ?? [];
        expect(writes).toEqual([]);
      }
    });
  });

  // ─── nex_vault_file_migration_attempt ───────────────────────────────
  describe("nex_vault_file_migration_attempt · five-status walk", () => {
    test("status CHECK is exactly {started, uploaded, verified, finalized, failed}", () => {
      const m = sql.match(
        /CONSTRAINT nex_vault_file_migration_attempt_status_values[\s\S]*?CHECK \(status IN \(([^)]*)\)/,
      );
      expect(m).not.toBeNull();
      const values = (m![1]!.match(/'[^']+'/g) ?? [])
        .map((s) => s.slice(1, -1))
        .sort();
      expect(values).toEqual([
        "failed",
        "finalized",
        "started",
        "uploaded",
        "verified",
      ]);
    });

    test("partial unique index enforces one active (non-terminal) attempt per file", () => {
      expect(sql).toMatch(
        /CREATE UNIQUE INDEX IF NOT EXISTS nex_vault_file_migration_attempt_active[\s\S]*\(file_id\)[\s\S]*WHERE status NOT IN \('finalized', 'failed'\)/,
      );
    });

    test("retry_count has a non-negative CHECK", () => {
      expect(sql).toMatch(
        /CONSTRAINT nex_vault_file_migration_attempt_retry_count_range\s+CHECK \(retry_count >= 0\)/,
      );
    });

    test("last_error is bounded in length (operator-visible, not an unbounded log)", () => {
      expect(sql).toMatch(
        /CONSTRAINT nex_vault_file_migration_attempt_last_error_length[\s\S]*char_length\(last_error\) <= 1024/,
      );
    });

    test("has updated_at touch trigger", () => {
      expect(sql).toMatch(
        /CREATE TRIGGER nex_vault_file_migration_attempt_touch[\s\S]*BEFORE UPDATE ON nex_vault_file_migration_attempt/,
      );
    });
  });

  // ─── global shape · every FK cascades on account delete ─────────────
  describe("destruction cascades through account_id FKs", () => {
    for (const t of newTables) {
      test(`${t} · account_id FK is ON DELETE CASCADE`, () => {
        const re = new RegExp(
          `${t}[\\s\\S]*?account_id\\s+uuid[\\s\\S]*?REFERENCES nex_account\\(id\\) ON DELETE CASCADE`,
        );
        expect(sql).toMatch(re);
      });
    }
  });
});

// ---------------------------------------------------------------------------
// Cross-migration · ordering + ledger
// ---------------------------------------------------------------------------
describe("A.1 commit · both migrations", () => {
  test("141 is applied before 142 (version lexical order)", () => {
    expect(fs.existsSync(MIGRATION_141)).toBe(true);
    expect(fs.existsSync(MIGRATION_142)).toBe(true);
    expect(path.basename(MIGRATION_141)).toMatch(/^141_/);
    expect(path.basename(MIGRATION_142)).toMatch(/^142_/);
  });

  test("neither migration touches migration 140 (Phase A.1 sealed)", () => {
    for (const p of [MIGRATION_141, MIGRATION_142]) {
      const sql = read(p);
      // Must not DROP / ALTER anything that migration 140 established.
      expect(sql).not.toMatch(/DROP\s+FUNCTION\s+nex_purge_delivered_encrypted_messages/);
      expect(sql).not.toMatch(/DROP\s+INDEX\s+nex_vault_file_source_message_unique/);
      expect(sql).not.toMatch(/DROP\s+COLUMN[\s\S]*source_message_id/);
      expect(sql).not.toMatch(/DROP\s+COLUMN[\s\S]*source_conversation_id/);
    }
  });

  test("neither migration deletes or modifies pre-existing vault data in-place beyond backfill", () => {
    const sql141 = stripSqlComments(read(MIGRATION_141));
    // The only UPDATE allowed is the backfill of migration_state to 'legacy'.
    // Illustrative UPDATEs in the rollback / verification comment blocks
    // are not counted because the comments were stripped above.
    const updates = sql141.match(/\bUPDATE\s+nex_vault_file\b/g) ?? [];
    expect(updates.length).toBe(1);
    // No DELETE from nex_vault_file anywhere.
    expect(sql141).not.toMatch(/\bDELETE\s+FROM\s+nex_vault_file\b/);
    // No DROP COLUMN on existing non-Phase-A column.
    expect(sql141).not.toMatch(/DROP\s+COLUMN[\s\S]*bucket_path/);
    expect(sql141).not.toMatch(/DROP\s+COLUMN[\s\S]*display_name/);
  });

  test("migration 142 does not alter any existing table (new tables only)", () => {
    const sql142 = stripSqlComments(read(MIGRATION_142));
    // The only ALTER TABLE statements are on tables created in this migration.
    const alters = sql142.match(/ALTER TABLE\s+(\w+)/g) ?? [];
    const alteredTables = alters.map((s) => s.replace(/ALTER TABLE\s+/, ""));
    const allowed = new Set([
      "nex_vault_setup",
      "nex_vault_key_envelope",
      "nex_vault_pin_attempt",
      "nex_vault_recovery_attempt",
      "nex_vault_file_migration_attempt",
    ]);
    for (const t of alteredTables) {
      expect(allowed.has(t), `migration 142 altered non-new table: ${t}`).toBe(
        true,
      );
    }
  });
});
