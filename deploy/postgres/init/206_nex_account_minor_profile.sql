-- 206_nex_account_minor_profile.sql
--
-- NEX Family Safety · Account Minor Profile (CC-1 · estimated 2026-10-10).
--
-- SAFE ON POPULATED DB · idempotent · additive · session-identity gated.
--
-- ═══════════════════════════════════════════════════════════════════
-- WHAT THIS MIGRATION DOES
-- ═══════════════════════════════════════════════════════════════════
--
--   nex.account_minor_profile
--     Marks an account as a minor and surfaces the lightweight read
--     flags that CC-3's SafeChat enforcer and age-transition workflow
--     consume. One row per account_id.
--
-- Doctrine (sealed with this migration):
--   · is_minor defaults TRUE · an account registered through this
--     table is always a minor at insertion time.
--   · safechat_always_on defaults TRUE · founder decision D
--     (SafeChat is ALWAYS ON for minor accounts; the parent cannot
--     disable it). This flag is exposed read-only to the parent
--     dashboard; writes come only from the age-transition workflow
--     (CC-3) when the minor turns 16 and the row is flipped to
--     is_minor=FALSE.
--   · parent_custody_id references nex.parent_custody_link ·
--     ON DELETE SET NULL so revoking the custody link does not
--     destroy the minor-profile audit.
--   · auto_transfer_at / transferred_at mirror the parent_custody_link
--     columns · redundant on purpose so the reader (CC-3) can resolve
--     minor status without a join.
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
--   DROP TABLE IF EXISTS nex.account_minor_profile;
--
-- ═══════════════════════════════════════════════════════════════════
-- DEPLOYMENT PREREQUISITES
-- ═══════════════════════════════════════════════════════════════════
--
-- · nex schema present.
-- · Migration 205 (parent_custody_link) applied first · this file
--   references it in the parent_custody_id FK.
--
-- ═══════════════════════════════════════════════════════════════════
-- NOT APPLIED
-- ═══════════════════════════════════════════════════════════════════
--
-- Must only be applied via
-- `scripts/nex-canonical/_apply-migration-206.mjs` with the
-- session-identity gate (current_database() = 'nex_dev').
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS nex.account_minor_profile (
  account_id          text        PRIMARY KEY,

  is_minor            boolean     NOT NULL DEFAULT TRUE,

  parent_custody_id   uuid        NULL
    REFERENCES nex.parent_custody_link (custody_id)
    ON DELETE SET NULL,

  auto_transfer_at    timestamptz NULL,
  transferred_at      timestamptz NULL,

  -- Founder decision D · SafeChat is ALWAYS ON for minor accounts.
  -- The parent cannot disable it. CC-3's enforcer reads this flag.
  safechat_always_on  boolean     NOT NULL DEFAULT TRUE,

  simulated           boolean     NOT NULL DEFAULT TRUE,

  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS account_minor_profile_minor_transfer_idx
  ON nex.account_minor_profile (is_minor, auto_transfer_at);

-- ──────────────────────────────────────────────────────────────────
-- END · 206_nex_account_minor_profile.sql
-- ──────────────────────────────────────────────────────────────────
