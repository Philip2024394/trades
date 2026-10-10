-- 204_nex_id_verification_submission.sql
--
-- NEX Family Safety · Child Account Creation · ID verification submission
-- (CC-1 · estimated 2026-10-10 · simulated=TRUE on every write).
--
-- SAFE ON POPULATED DB · idempotent · additive · session-identity gated.
--
-- ═══════════════════════════════════════════════════════════════════
-- WHAT THIS MIGRATION DOES
-- ═══════════════════════════════════════════════════════════════════
--
--   1. nex.id_verification_submission
--      One row per ID document a parent uploads for a prospective child
--      account. The document bytes NEVER appear in this table ·
--      `document_storage_ref` is an opaque pointer that only a sealed
--      admin reader service may resolve. SHA256 of the bytes is stored
--      so operators can integrity-check without opening the file.
--
--   2. nex.id_document_blob
--      Companion table that holds the actual bytea payload. Separated
--      from the metadata table so that routine admin reads of the
--      submission ledger NEVER accidentally join against the bytes.
--      ON DELETE CASCADE from id_verification_submission so cancelling
--      a submission destroys the bytes with it.
--
-- Doctrine (sealed with this migration):
--   · The frontend NEVER queries id_document_blob · the only reader is
--     an admin service reserved for verifier-adapter polling.
--   · idempotency_key is UNIQUE · the same document uploaded twice
--     from the same session resolves to the pre-existing row.
--   · simulated=TRUE on every row in the current wave (Phase 1) · the
--     service layer refuses to write FALSE.
--   · verifier_response_summary_redacted is capped at 500 chars and
--     MUST NOT contain personal data (service-layer regex strips
--     common patterns · doctrine, not DB-enforced).
--   · document_type is restricted to Indonesian primary IDs + passport
--     + "other" (operator escape hatch · never dark-launch new types).
--
-- ═══════════════════════════════════════════════════════════════════
-- IDEMPOTENCE
-- ═══════════════════════════════════════════════════════════════════
--
-- CREATE TABLE IF NOT EXISTS · CREATE INDEX IF NOT EXISTS · zero DML.
-- Safe to re-run.
--
-- ═══════════════════════════════════════════════════════════════════
-- ROLLBACK
-- ═══════════════════════════════════════════════════════════════════
--
--   DROP TABLE IF EXISTS nex.id_document_blob;
--   DROP TABLE IF EXISTS nex.id_verification_submission;
--
-- ═══════════════════════════════════════════════════════════════════
-- DEPLOYMENT PREREQUISITES
-- ═══════════════════════════════════════════════════════════════════
--
-- · pgcrypto · gen_random_uuid().
-- · nex schema present.
-- · Migration 203 (child_account_creation_request) is applied in the
--   SAME wave but AFTER this file · 203 references this table.
--
-- ═══════════════════════════════════════════════════════════════════
-- NOT APPLIED
-- ═══════════════════════════════════════════════════════════════════
--
-- Must only be applied via
-- `scripts/nex-canonical/_apply-migration-204.mjs` with the
-- session-identity gate (current_database() = 'nex_dev').
-- ═══════════════════════════════════════════════════════════════════

-- ──────────────────────────────────────────────────────────────────
-- 1 · nex.id_verification_submission
-- ──────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS nex.id_verification_submission (
  submission_id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),

  submitter_account_id               text        NOT NULL,

  document_type                      text        NOT NULL
    CHECK (document_type IN (
      'indonesian_kk',
      'indonesian_birth_certificate',
      'indonesian_akta',
      'passport',
      'other'
    )),

  -- Opaque pointer to secure storage · never a public URL ·
  -- resolved only by the sealed admin reader service.
  document_storage_ref               text        NOT NULL,

  -- SHA256 of the bytes (hex, 64 chars) · integrity check · never
  -- used for retrieval.
  document_bytes_sha256              text        NOT NULL
    CHECK (length(document_bytes_sha256) = 64),

  -- Idempotency key enforced UNIQUE below.
  idempotency_key                    text        NOT NULL,

  verifier_adapter                   text        NOT NULL DEFAULT 'stub_pending_vendor',

  verification_outcome               text        NOT NULL DEFAULT 'pending'
    CHECK (verification_outcome IN (
      'pending',
      'verified',
      'rejected',
      'unknown'
    )),

  verifier_response_summary_redacted text        NULL
    CHECK (
      verifier_response_summary_redacted IS NULL
      OR length(verifier_response_summary_redacted) BETWEEN 1 AND 500
    ),

  simulated                          boolean     NOT NULL DEFAULT TRUE,

  submitted_at                       timestamptz NOT NULL DEFAULT now(),
  verified_at                        timestamptz NULL,
  rejected_at                        timestamptz NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS id_verification_submission_idem_uq
  ON nex.id_verification_submission (idempotency_key);

CREATE INDEX IF NOT EXISTS id_verification_submission_outcome_time_idx
  ON nex.id_verification_submission (verification_outcome, submitted_at DESC);

CREATE INDEX IF NOT EXISTS id_verification_submission_submitter_idx
  ON nex.id_verification_submission (submitter_account_id, submitted_at DESC);

-- ──────────────────────────────────────────────────────────────────
-- 2 · nex.id_document_blob · bytes · strict row-level access
-- ──────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS nex.id_document_blob (
  submission_id   uuid        PRIMARY KEY
    REFERENCES nex.id_verification_submission (submission_id)
    ON DELETE CASCADE,
  document_bytes  bytea       NOT NULL,
  mime_type       text        NOT NULL
    CHECK (mime_type IN (
      'image/jpeg',
      'image/png',
      'image/webp',
      'application/pdf'
    )),
  stored_at       timestamptz NOT NULL DEFAULT now()
);

-- ──────────────────────────────────────────────────────────────────
-- END · 204_nex_id_verification_submission.sql
-- ──────────────────────────────────────────────────────────────────
