-- 201_nex_family_safety_dashboard_access_log.sql
--
-- NEX Family Safety · Phase 1 · parent dashboard access audit log
-- (FS-3 · 2026-10-10 estimated).
--
-- SAFE ON POPULATED DB · idempotent · additive · session-identity gated.
--
-- ═══════════════════════════════════════════════════════════════════
-- WHAT THIS MIGRATION DOES
-- ═══════════════════════════════════════════════════════════════════
--
-- Introduces ONE new append-only audit table beside the sealed
-- Family Links primitives (migrations 198 + 200):
--
--   1. nex.family_safety_dashboard_access_log
--        · one row per guardian-dashboard query attempt
--        · outcome is one of 5 sealed buckets · the row is always
--          written even when access is denied
--        · simulated=TRUE by default · same gate as 198/200
--        · ZERO query content · ZERO child message content · the row
--          records only who viewed what SURFACE and the outcome
--
-- Phase 1 scope stays DELIBERATELY NARROW:
--   · schema + reader API only · the sweep / retention cron is NOT
--     wired here · it is documented at
--     docs/doctrine/nex-family-safety-dashboard-privacy-2026-10-10.md
--   · simulated=TRUE on every row · the service layer rejects writes
--     with simulated=false (identical gate pattern to 198/200)
--
-- Doctrine (sealed with this migration):
--   · APPEND-ONLY · the service layer never UPDATEs or DELETEs these
--     rows · a retention sweep (future wave) may purge rows older
--     than N months but that is not implemented here.
--   · Soft text references for account ids · identical pattern to
--     198/200.
--   · Vendor-agnostic · no verifier / notifier identifier columns.
--   · Privacy invariant · this table NEVER stores the content of what
--     the viewer saw. It stores only (viewer, child, surface, outcome,
--     timestamp). Downstream readers that want to know "did this
--     guardian see X message content" cannot answer from this log ·
--     by design.
--
-- ═══════════════════════════════════════════════════════════════════
-- IDEMPOTENCE
-- ═══════════════════════════════════════════════════════════════════
--
-- CREATE TABLE IF NOT EXISTS. All CREATE INDEX statements use IF NOT
-- EXISTS. Zero DML. Safe to re-run.
--
-- ═══════════════════════════════════════════════════════════════════
-- ROLLBACK
-- ═══════════════════════════════════════════════════════════════════
--
--   DROP TABLE IF EXISTS nex.family_safety_dashboard_access_log;
--
-- ═══════════════════════════════════════════════════════════════════
-- DEPLOYMENT PREREQUISITES
-- ═══════════════════════════════════════════════════════════════════
--
-- · nex schema present (000_schema.sql).
-- · pgcrypto · gen_random_uuid().
-- · Zero FK dependency on sealed account model · viewer_account_id
--   and viewed_child_account_id are soft text references to the
--   Supabase nex_account.id (same pattern as every other cross-DB
--   reference in nex.*).
--
-- ═══════════════════════════════════════════════════════════════════
-- NOT APPLIED
-- ═══════════════════════════════════════════════════════════════════
--
-- Must only be applied via
-- `scripts/nex-canonical/_apply-migration-201.mjs` with the
-- session-identity gate (current_database() = 'nex_dev').

-- ─────────────────────────────────────────────────────────────────────
-- 1. nex.family_safety_dashboard_access_log
-- ─────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS nex.family_safety_dashboard_access_log (
  access_id                     uuid         PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Soft reference to Supabase nex_account.id · the account that
  -- initiated the dashboard query. ALWAYS set · the service layer
  -- refuses to log an attempt with no viewer identity.
  viewer_account_id             text         NOT NULL,

  -- Soft reference to Supabase nex_account.id · the child whose
  -- dashboard the viewer attempted to see. NULL permitted for
  -- aggregate reads (dashboard root list of all linked children).
  viewed_child_account_id       text         NULL,

  -- 6 sealed surface tokens. Any new dashboard surface MUST add a
  -- token here and bump this CHECK via a new migration · never widen
  -- in place.
  surface_name                  text         NOT NULL
    CHECK (surface_name IN (
      'dashboard_root',
      'child_dashboard',
      'child_contacts',
      'child_safechat',
      'safechat_status',
      'privacy_page'
    )),

  -- 5 sealed outcome tokens. 'granted' is the only outcome where the
  -- viewer saw real data for a specific child. The other 4 outcomes
  -- are denial paths · they are logged so the audit log answers the
  -- "did a guardian ATTEMPT access" question too.
  outcome                       text         NOT NULL
    CHECK (outcome IN (
      'granted',
      'denied_not_guardian',
      'denied_revoked',
      'denied_flag_off',
      'denied_other'
    )),

  -- Phase 1 PILOT flag · every row simulated=TRUE by default. The
  -- service layer refuses to write simulated=false. Flipping a row
  -- to false later requires founder sign-off and a dedicated
  -- live-mode migration.
  simulated                     boolean      NOT NULL DEFAULT TRUE,

  accessed_at                   timestamptz  NOT NULL DEFAULT now()
);

-- Hot path · a guardian audits their own recent attempts.
CREATE INDEX IF NOT EXISTS family_safety_dashboard_access_log_viewer_time_idx
  ON nex.family_safety_dashboard_access_log (viewer_account_id, accessed_at DESC);

-- Hot path · HQ scans recent denials for abuse patterns.
CREATE INDEX IF NOT EXISTS family_safety_dashboard_access_log_outcome_time_idx
  ON nex.family_safety_dashboard_access_log (outcome, accessed_at DESC);

COMMENT ON TABLE nex.family_safety_dashboard_access_log IS
  'NEX Family Safety · Phase 1 primitive · append-only audit log of guardian-dashboard access attempts. Records (viewer, child, surface, outcome, timestamp) only · NEVER stores query content, message bodies, or any child personal data. Simulated by default · live activation requires separate founder sign-off.';

COMMENT ON COLUMN nex.family_safety_dashboard_access_log.outcome IS
  'granted = viewer saw data for a specific child · the four denied_* buckets record attempts rejected server-side (not merely hidden client-side).';

COMMENT ON COLUMN nex.family_safety_dashboard_access_log.simulated IS
  'Phase 1 PILOT flag · live-mode activation requires separate founder sign-off and a dedicated live-mode migration.';

-- ═══════════════════════════════════════════════════════════════════
-- End of migration 201.
-- Downstream:
--   · src/lib/nex-native/family-safety/dashboard-service.ts
--   · src/lib/nex-native/family-safety/contact-visibility-service.ts
--   · src/lib/nex-native/family-safety/safechat-status-reader.ts
-- ═══════════════════════════════════════════════════════════════════
