-- 205_nex_parent_custody_link.sql
--
-- NEX Family Safety · Parent Custody Link (CC-1 · estimated 2026-10-10).
--
-- SAFE ON POPULATED DB · idempotent · additive · session-identity gated.
--
-- ═══════════════════════════════════════════════════════════════════
-- WHAT THIS MIGRATION DOES
-- ═══════════════════════════════════════════════════════════════════
--
--   nex.parent_custody_link
--     Captures the custodial relationship a parent holds over a minor
--     account that NEX itself created. Distinct from family_link
--     (which models verified guardian ↔ child relationships without
--     a creation lineage).
--
--     Link types (sealed with this migration):
--       · created_minor        · minor account was created inside this
--                                flow with the parent as custodian
--       · transferred_at_16    · reserved for the age-transition flow
--                                (CC-3 owns the workflow · this field
--                                exposes the slot)
--       · manual_grant         · operator escape hatch
--
--     References nex.child_account_creation_request(request_id) via
--     creation_request_id · ON DELETE SET NULL · the custody link
--     survives the creation request record.
--
-- Doctrine (sealed with this migration):
--   · One ACTIVE custody per child · partial unique index enforces
--     at-most-one row with revoked_at IS NULL AND transferred_at IS NULL
--     for a given child_account_id.
--   · Parent cannot be their own custodian · CHECK on
--     (parent_account_id <> child_account_id).
--   · auto_transfer_at is the pre-computed 16th-birthday timestamp
--     (CC-3's age-transition workflow consumes it).
--   · simulated=TRUE in Phase 1 · service layer refuses FALSE writes.
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
--   DROP TABLE IF EXISTS nex.parent_custody_link;
--
-- ═══════════════════════════════════════════════════════════════════
-- DEPLOYMENT PREREQUISITES
-- ═══════════════════════════════════════════════════════════════════
--
-- · pgcrypto · gen_random_uuid().
-- · nex schema present.
-- · Migration 203 (child_account_creation_request) applied first ·
--   this file references it in the creation_request_id FK.
--
-- ═══════════════════════════════════════════════════════════════════
-- NOT APPLIED
-- ═══════════════════════════════════════════════════════════════════
--
-- Must only be applied via
-- `scripts/nex-canonical/_apply-migration-205.mjs` with the
-- session-identity gate (current_database() = 'nex_dev').
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS nex.parent_custody_link (
  custody_id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),

  parent_account_id   text        NOT NULL,
  child_account_id    text        NOT NULL,

  link_type           text        NOT NULL
    CHECK (link_type IN (
      'created_minor',
      'transferred_at_16',
      'manual_grant'
    )),

  creation_request_id uuid        NULL
    REFERENCES nex.child_account_creation_request (request_id)
    ON DELETE SET NULL,

  auto_transfer_at    timestamptz NULL,
  transferred_at      timestamptz NULL,
  revoked_at          timestamptz NULL,
  revoked_reason      text        NULL,

  simulated           boolean     NOT NULL DEFAULT TRUE,

  created_at          timestamptz NOT NULL DEFAULT now(),

  CHECK (parent_account_id <> child_account_id)
);

-- At most one ACTIVE custody per child.
CREATE UNIQUE INDEX IF NOT EXISTS parent_custody_link_active_uq
  ON nex.parent_custody_link (child_account_id)
  WHERE revoked_at IS NULL AND transferred_at IS NULL;

CREATE INDEX IF NOT EXISTS parent_custody_link_parent_idx
  ON nex.parent_custody_link (parent_account_id, created_at DESC);

CREATE INDEX IF NOT EXISTS parent_custody_link_transfer_due_idx
  ON nex.parent_custody_link (auto_transfer_at)
  WHERE auto_transfer_at IS NOT NULL
    AND transferred_at IS NULL
    AND revoked_at IS NULL;

-- ──────────────────────────────────────────────────────────────────
-- END · 205_nex_parent_custody_link.sql
-- ──────────────────────────────────────────────────────────────────
