-- 207_nex_parent_custody_audit_log.sql
--
-- NEX Family Safety · Parent Custody Audit Log (CC-1 · estimated 2026-10-10).
--
-- SAFE ON POPULATED DB · idempotent · additive · session-identity gated.
--
-- ═══════════════════════════════════════════════════════════════════
-- WHAT THIS MIGRATION DOES
-- ═══════════════════════════════════════════════════════════════════
--
--   nex.parent_custody_audit_log
--     Append-only ledger of every parent action against a child
--     account under custody. Every custodial side-effect in the
--     service layer MUST produce one row here.
--
--     Actions (sealed with this migration):
--       · custody_created
--       · password_reset_requested
--       · password_reset_completed
--       · child_viewed_in_dashboard
--       · safechat_summary_viewed
--       · age_transfer_notified
--       · age_transfer_completed
--       · custody_revoked
--
-- Doctrine (sealed with this migration):
--   · APPEND-ONLY · the service layer never offers an update or delete
--     path. A revoke operation produces a new 'custody_revoked' row.
--   · action_details_redacted MUST NOT contain plaintext credentials
--     or private content · service layer enforces (doctrine, not
--     DB-enforced).
--   · ON DELETE CASCADE from parent_custody_link so removing the
--     link in a future wipe also removes its audit trail. The
--     separate "disaster evidence" bundle would be exported from
--     here before any wipe.
--   · simulated=TRUE in Phase 1.
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
--   DROP TABLE IF EXISTS nex.parent_custody_audit_log;
--
-- ═══════════════════════════════════════════════════════════════════
-- DEPLOYMENT PREREQUISITES
-- ═══════════════════════════════════════════════════════════════════
--
-- · pgcrypto · gen_random_uuid().
-- · nex schema present.
-- · Migration 205 (parent_custody_link) applied first · this file
--   references it in the custody_id FK.
--
-- ═══════════════════════════════════════════════════════════════════
-- NOT APPLIED
-- ═══════════════════════════════════════════════════════════════════
--
-- Must only be applied via
-- `scripts/nex-canonical/_apply-migration-207.mjs` with the
-- session-identity gate (current_database() = 'nex_dev').
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS nex.parent_custody_audit_log (
  audit_id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),

  custody_id              uuid        NOT NULL
    REFERENCES nex.parent_custody_link (custody_id)
    ON DELETE CASCADE,

  parent_account_id       text        NOT NULL,
  child_account_id        text        NOT NULL,

  action                  text        NOT NULL
    CHECK (action IN (
      'custody_created',
      'password_reset_requested',
      'password_reset_completed',
      'child_viewed_in_dashboard',
      'safechat_summary_viewed',
      'age_transfer_notified',
      'age_transfer_completed',
      'custody_revoked'
    )),

  action_details_redacted text        NULL,

  simulated               boolean     NOT NULL DEFAULT TRUE,

  performed_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS parent_custody_audit_log_custody_time_idx
  ON nex.parent_custody_audit_log (custody_id, performed_at DESC);

CREATE INDEX IF NOT EXISTS parent_custody_audit_log_action_time_idx
  ON nex.parent_custody_audit_log (action, performed_at DESC);

-- ──────────────────────────────────────────────────────────────────
-- END · 207_nex_parent_custody_audit_log.sql
-- ──────────────────────────────────────────────────────────────────
