-- 200_nex_family_link_pressure_and_cooldown.sql
--
-- NEX Family Links · Setup + Invitation wave · pressure signal + 72h
-- cooldown primitives (FS-2 · 2026-10-10 estimated).
--
-- SAFE ON POPULATED DB · idempotent · additive · session-identity gated.
--
-- ═══════════════════════════════════════════════════════════════════
-- WHAT THIS MIGRATION DOES
-- ═══════════════════════════════════════════════════════════════════
--
-- Introduces TWO new tables beside the sealed nex.family_link primitive
-- (migration 198):
--
--   1. nex.family_link_pressure_report
--        · HQ-only safety queue for the bidirectional pressure signal
--          (decision D2 · 2A).
--        · The reported counterparty is NEVER notified.
--        · One open report per (link, reporter) at a time.
--
--   2. nex.family_link_revocation_cooldown
--        · 72-hour cooldown window for revoking an active primary
--          guardian (decision D1 · 1A).
--        · Reserved founder-override columns; the UI never exposes the
--          override path in this wave.
--        · One pending cooldown per link at a time.
--
-- Phase 1 scope stays DELIBERATELY NARROW:
--   · schema + services only · no cron sweep job wired here · the
--     cooldown-finalisation contract is documented at
--     docs/doctrine/nex-family-links-setup-journey-2026-10-10.md.
--   · simulated=TRUE by default on every row · the service layer
--     rejects writes with simulated=false (same gate as 198).
--   · retention follows the purpose-limited policy adopted via D5 ·
--     see docs/doctrine/nex-family-links-retention-policy-draft-2026-10-10.md ·
--     pressure_report rows → 2 years, revocation_cooldown rows → 180
--     days post-finalisation. The policy is documented here but the
--     sweep itself is NOT in this migration.
--
-- Doctrine (sealed with this migration):
--   · ON DELETE CASCADE to nex.family_link · when a link row is purged
--     by a future retention sweep, dependent pressure reports and
--     cooldowns go with it (no dangling rows).
--   · Soft text references for account ids · identical pattern to 198.
--   · Vendor-agnostic · no verifier / notifier identifier columns.
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
--   DROP TABLE IF EXISTS nex.family_link_revocation_cooldown;
--   DROP TABLE IF EXISTS nex.family_link_pressure_report;
--
-- ═══════════════════════════════════════════════════════════════════
-- NOT APPLIED
-- ═══════════════════════════════════════════════════════════════════
--
-- Must only be applied via
-- `scripts/nex-canonical/_apply-migration-200.mjs` with the
-- session-identity gate (current_database() = 'nex_dev').

-- ─────────────────────────────────────────────────────────────────────
-- 1. nex.family_link_pressure_report
-- ─────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS nex.family_link_pressure_report (
  report_id                     uuid         PRIMARY KEY DEFAULT gen_random_uuid(),

  link_id                       uuid         NOT NULL
    REFERENCES nex.family_link(link_id) ON DELETE CASCADE,

  -- Soft reference to Supabase nex_account.id · the account that filed
  -- the signal. Either side of the link may file (D2 · 2A).
  reporter_account_id           text         NOT NULL,

  reason_code                   text         NOT NULL
    CHECK (reason_code IN ('coerced','threatened','unknown_inviter','not_my_family','other')),

  reason_notes                  text         NULL
    CHECK (reason_notes IS NULL OR length(reason_notes) BETWEEN 1 AND 500),

  -- The counterparty the signal is reported against. Visibility to
  -- this id is HQ-only. The service layer MUST NOT notify this
  -- account that a report was filed (D2 · 2A).
  reported_against_account_id   text         NOT NULL,

  state                         text         NOT NULL DEFAULT 'open'
    CHECK (state IN ('open','under_review','resolved_safe','resolved_unsafe','withdrawn')),

  resolution_notes              text         NULL
    CHECK (resolution_notes IS NULL OR length(resolution_notes) BETWEEN 1 AND 2000),

  simulated                     boolean      NOT NULL DEFAULT TRUE,

  reported_at                   timestamptz  NOT NULL DEFAULT now(),
  resolved_at                   timestamptz  NULL
);

-- Hot path · HQ reviews chronologically within a case.
CREATE INDEX IF NOT EXISTS family_link_pressure_report_link_time_idx
  ON nex.family_link_pressure_report (link_id, reported_at DESC);

-- Hot path · HQ reviews the open-cases queue.
CREATE INDEX IF NOT EXISTS family_link_pressure_report_state_time_idx
  ON nex.family_link_pressure_report (state, reported_at DESC);

-- One open report per reporter per link · a second file-attempt
-- while the first is still open is coalesced to the existing row.
CREATE UNIQUE INDEX IF NOT EXISTS family_link_pressure_report_reporter_open_uq
  ON nex.family_link_pressure_report (link_id, reporter_account_id)
  WHERE state = 'open';

COMMENT ON TABLE nex.family_link_pressure_report IS
  'NEX Family Links · HQ-only pressure-signal queue (decision D2 · 2A). The reported counterparty is NEVER notified. Both guardian and child may file. Retention 2 years (safeguarding audit · D5).';

COMMENT ON COLUMN nex.family_link_pressure_report.simulated IS
  'Phase 1 PILOT flag · live-mode activation requires separate founder sign-off.';

-- ─────────────────────────────────────────────────────────────────────
-- 2. nex.family_link_revocation_cooldown
-- ─────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS nex.family_link_revocation_cooldown (
  cooldown_id                   uuid         PRIMARY KEY DEFAULT gen_random_uuid(),

  link_id                       uuid         NOT NULL
    REFERENCES nex.family_link(link_id) ON DELETE CASCADE,

  -- Soft reference · the account that initiated the revocation.
  initiated_by_account_id       text         NOT NULL,

  initiated_at                  timestamptz  NOT NULL DEFAULT now(),

  -- Default effective window is initiated_at + 72h (decision D1 · 1A).
  -- The service layer sets this value explicitly on INSERT; the column
  -- has no DEFAULT because it depends on the service-computed moment.
  effective_at                  timestamptz  NOT NULL,

  -- Bypass path · if the OTHER party on the link confirms the
  -- revocation inside the window, the revocation applies immediately.
  bypass_confirmed_by_other_party boolean    NOT NULL DEFAULT FALSE,
  bypass_confirmed_at           timestamptz  NULL,

  -- Reserved founder-override escalation (decision D1 · 1A). The UI in
  -- this wave does NOT expose the override path · the columns exist so
  -- that the HQ Tier-C two-person authorisation flow (future wave) can
  -- stamp this row without a schema change.
  founder_override              boolean      NOT NULL DEFAULT FALSE,
  founder_override_authorised_by text        NULL,

  state                         text         NOT NULL DEFAULT 'pending'
    CHECK (state IN ('pending','applied','cancelled')),

  cancelled_at                  timestamptz  NULL,
  cancelled_by_account_id       text         NULL,

  simulated                     boolean      NOT NULL DEFAULT TRUE,

  applied_at                    timestamptz  NULL
);

-- One pending cooldown per link · prevents duplicate cooldown rows
-- while a revocation is already in flight.
CREATE UNIQUE INDEX IF NOT EXISTS family_link_revocation_cooldown_link_pending_uq
  ON nex.family_link_revocation_cooldown (link_id)
  WHERE state = 'pending';

-- Hot path · a nightly sweep job (future wave) scans pending rows
-- whose effective_at has elapsed and finalises them.
CREATE INDEX IF NOT EXISTS family_link_revocation_cooldown_effective_time_idx
  ON nex.family_link_revocation_cooldown (state, effective_at)
  WHERE state = 'pending';

COMMENT ON TABLE nex.family_link_revocation_cooldown IS
  'NEX Family Links · 72-hour cooldown window for revoking an active primary guardian (decision D1 · 1A). Reserved founder-override columns are present but UI never exposes the override path in this wave.';

COMMENT ON COLUMN nex.family_link_revocation_cooldown.founder_override IS
  'Reserved escalation · HQ Tier-C two-person authorisation per emergency-help operator doctrine. UI never exposes this path in this wave.';

COMMENT ON COLUMN nex.family_link_revocation_cooldown.simulated IS
  'Phase 1 PILOT flag · live-mode activation requires separate founder sign-off.';

-- ═══════════════════════════════════════════════════════════════════
-- End of migration 200.
-- Downstream:
--   · src/lib/nex-native/family-links/cooldown-service.ts
--   · src/lib/nex-native/family-links/pressure-signal-service.ts
--   · src/lib/nex-native/family-links/invite-service.ts
--   · src/lib/nex-native/family-links/_server-actions.ts
-- ═══════════════════════════════════════════════════════════════════
