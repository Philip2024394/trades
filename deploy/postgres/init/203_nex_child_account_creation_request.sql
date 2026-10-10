-- 203_nex_child_account_creation_request.sql
--
-- NEX Family Safety · Child Account Creation · parent-initiated workflow
-- (CC-1 · estimated 2026-10-10 · simulated=TRUE on every write).
--
-- SAFE ON POPULATED DB · idempotent · additive · session-identity gated.
--
-- ═══════════════════════════════════════════════════════════════════
-- WHAT THIS MIGRATION DOES
-- ═══════════════════════════════════════════════════════════════════
--
--   1. nex.child_account_creation_request
--      One row per parent-initiated attempt to create a minor account.
--      State machine (sealed with this migration):
--
--        draft
--          ↓
--        id_pending_verification
--          ↓
--        id_verified  →  awaiting_legal_clearance  (flag OFF path)
--          ↓                        ↓
--        account_created           account_created  (flag ON path)
--
--      Plus terminal states: id_rejected · cancelled · expired.
--
--      References nex.id_verification_submission(submission_id) via
--      id_submission_id · ON DELETE SET NULL so cancelling the ID
--      submission does not destroy the request audit trail.
--
-- Doctrine (sealed with this migration):
--   · Phase 1 · the LIVE child-account materialisation path is GATED
--     behind the feature flag NEX_FAMILY_SAFETY_CHILD_CREATE_LIVE_MODE.
--     When flag is OFF (the default), the service transitions a
--     verified request to `awaiting_legal_clearance` INSTEAD of
--     invoking the sealed account-creation primitive. The UI surfaces
--     an honest "awaiting Indonesian legal clearance" state in this
--     mode. This matches founder decision A (2026-10-10).
--   · simulated=TRUE on every row in the current wave. The service
--     layer refuses to write FALSE.
--   · Partial unique index enforces at-most-one ACTIVE request per
--     (parent, lower(name), declared DOB) tuple. "Active" means any
--     state the UI considers open (draft, id_pending_verification,
--     id_verified, awaiting_legal_clearance). This prevents a parent
--     from accidentally spawning parallel requests for the same child.
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
--   DROP TABLE IF EXISTS nex.child_account_creation_request;
--
-- ═══════════════════════════════════════════════════════════════════
-- DEPLOYMENT PREREQUISITES
-- ═══════════════════════════════════════════════════════════════════
--
-- · pgcrypto · gen_random_uuid().
-- · nex schema present.
-- · Migration 204 (id_verification_submission) MUST be applied FIRST ·
--   this file references it in the id_submission_id foreign key.
--
-- ═══════════════════════════════════════════════════════════════════
-- NOT APPLIED
-- ═══════════════════════════════════════════════════════════════════
--
-- Must only be applied via
-- `scripts/nex-canonical/_apply-migration-203.mjs` with the
-- session-identity gate (current_database() = 'nex_dev').
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS nex.child_account_creation_request (
  request_id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),

  parent_account_id          text        NOT NULL,

  child_display_name         text        NOT NULL
    CHECK (length(trim(child_display_name)) BETWEEN 1 AND 60),

  child_declared_date_of_birth date      NOT NULL
    CHECK (
      child_declared_date_of_birth > '1900-01-01'
      AND child_declared_date_of_birth <= CURRENT_DATE
    ),

  id_submission_id           uuid        NULL
    REFERENCES nex.id_verification_submission (submission_id)
    ON DELETE SET NULL,

  state                      text        NOT NULL DEFAULT 'draft'
    CHECK (state IN (
      'draft',
      'id_pending_verification',
      'id_verified',
      'id_rejected',
      'awaiting_legal_clearance',
      'account_created',
      'cancelled',
      'expired'
    )),

  created_child_account_id   text        NULL,

  rejection_reason           text        NULL,
  rejection_reason_code      text        NULL
    CHECK (
      rejection_reason_code IS NULL
      OR rejection_reason_code IN (
        'id_unreadable',
        'id_not_matching',
        'not_a_minor',
        'parent_not_authorised',
        'awaiting_legal_clearance',
        'operator_manual_rejection',
        'other'
      )
    ),

  simulated                  boolean     NOT NULL DEFAULT TRUE,

  created_at                 timestamptz NOT NULL DEFAULT now(),
  verified_at                timestamptz NULL,
  approved_at                timestamptz NULL,
  rejected_at                timestamptz NULL,
  cancelled_at               timestamptz NULL,

  expires_at                 timestamptz NOT NULL DEFAULT now() + interval '30 days'
);

CREATE INDEX IF NOT EXISTS child_creation_request_parent_state_idx
  ON nex.child_account_creation_request (parent_account_id, state, created_at DESC);

CREATE INDEX IF NOT EXISTS child_creation_request_state_expires_idx
  ON nex.child_account_creation_request (state, expires_at);

-- At most one ACTIVE request per (parent, child display name, DOB).
CREATE UNIQUE INDEX IF NOT EXISTS child_creation_request_active_uq
  ON nex.child_account_creation_request (
    parent_account_id,
    lower(child_display_name),
    child_declared_date_of_birth
  )
  WHERE state IN ('draft','id_pending_verification','id_verified','awaiting_legal_clearance');

-- ──────────────────────────────────────────────────────────────────
-- END · 203_nex_child_account_creation_request.sql
-- ──────────────────────────────────────────────────────────────────
