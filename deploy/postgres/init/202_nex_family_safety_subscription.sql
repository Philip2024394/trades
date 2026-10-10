-- 202_nex_family_safety_subscription.sql
--
-- NEX Family Safety · subscription + entitlement data layer · Phase 1
-- (sealed 2026-10-10 · test-mode only · simulated=TRUE at every write).
--
-- SAFE ON POPULATED DB · idempotent · additive · session-identity gated.
--
-- ═══════════════════════════════════════════════════════════════════
-- WHAT THIS MIGRATION DOES
-- ═══════════════════════════════════════════════════════════════════
--
--   1. nex.family_safety_entitlement · one row per subscription
--      attempt-outcome · state machine
--      pending → active → suspended|cancelled|expired · plus failed.
--      test_mode defaults TRUE · simulated defaults TRUE · the service
--      layer rejects test_mode=FALSE writes in Phase 1.
--
--   2. nex.family_safety_payment_attempt · append-only ledger of
--      payment attempts · idempotency_key uniqueness enforced so a
--      duplicate provider callback with the same key resolves to
--      duplicate_ignored without granting a second entitlement.
--
-- Doctrine (sealed with this migration):
--   · Phase 1 is TEST-MODE ONLY · no live payment network calls · no
--     real currency figures invented · pricing displayed in UI is
--     labelled "PLACEHOLDER · founder has not approved commercial model"
--     until a founder decision lands.
--   · One FREE plan `family_safety_pilot_free` exists so the full
--     journey can be exercised without any pricing commitment.
--   · Entitlement is the SINGLE gate for feature access via
--     `hasActiveEntitlement(accountId, planId)` in the service layer.
--   · Payment adapter is sealed · the test adapter is the only
--     adapter wired in Phase 1 · real providers add themselves via
--     a new adapter module without touching the entitlement service.
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
--   DROP TABLE IF EXISTS nex.family_safety_payment_attempt;
--   DROP TABLE IF EXISTS nex.family_safety_entitlement;
--
-- ═══════════════════════════════════════════════════════════════════
-- DEPLOYMENT PREREQUISITES
-- ═══════════════════════════════════════════════════════════════════
--
-- · pgcrypto · gen_random_uuid().
-- · nex schema present (every earlier migration).
--
-- ═══════════════════════════════════════════════════════════════════
-- NOT APPLIED
-- ═══════════════════════════════════════════════════════════════════
--
-- Must only be applied via
-- `scripts/nex-canonical/_apply-migration-202.mjs` with the
-- session-identity gate (current_database() = 'nex_dev').
-- ═══════════════════════════════════════════════════════════════════

-- ──────────────────────────────────────────────────────────────────
-- 1 · nex.family_safety_entitlement
-- ──────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS nex.family_safety_entitlement (
  entitlement_id        uuid        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- The subscriber account id (usually the primary guardian). Opaque
  -- text to decouple from nex_account.id FK coupling (consistent with
  -- Phase 1 SafeChat log tables).
  owner_account_id      text        NOT NULL,

  -- Plan identifier · hard-check to the sealed catalog. If a founder
  -- decides a new plan, add a new tbd slot in a later migration.
  plan_id               text        NOT NULL
    CHECK (plan_id IN (
      'family_safety_pilot_free',
      'family_safety_tbd_1',
      'family_safety_tbd_2'
    )),

  -- State machine.
  state                 text        NOT NULL DEFAULT 'pending'
    CHECK (state IN (
      'pending',
      'active',
      'suspended',
      'cancelled',
      'expired',
      'failed'
    )),

  activated_at          timestamptz NULL,
  expires_at            timestamptz NULL,
  cancelled_at          timestamptz NULL,

  -- Payment provider · test_mode is the only wired adapter in Phase 1.
  -- stripe_tbd / xendit_tbd are provisional slots so a later wave can
  -- add a real adapter without a schema migration. manual_grant covers
  -- founder-authorised manual provisioning (support flow).
  payment_provider      text        NOT NULL DEFAULT 'test_mode'
    CHECK (payment_provider IN (
      'test_mode',
      'stripe_tbd',
      'xendit_tbd',
      'manual_grant'
    )),

  -- Provider-side reference · opaque. Null in test_mode when there is
  -- no provider ref to record.
  payment_provider_ref  text        NULL,

  -- Phase 1 ALWAYS TRUE · service layer rejects FALSE writes.
  test_mode             boolean     NOT NULL DEFAULT TRUE,

  -- Phase 1 ALWAYS TRUE · labels every row as a simulation.
  simulated             boolean     NOT NULL DEFAULT TRUE,

  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS family_safety_entitlement_owner_state_idx
  ON nex.family_safety_entitlement (owner_account_id, state, created_at DESC);

-- Only one active entitlement per owner per plan at a time.
CREATE UNIQUE INDEX IF NOT EXISTS family_safety_entitlement_owner_plan_active_uq
  ON nex.family_safety_entitlement (owner_account_id, plan_id)
  WHERE state = 'active';

-- ──────────────────────────────────────────────────────────────────
-- 2 · nex.family_safety_payment_attempt
-- ──────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS nex.family_safety_payment_attempt (
  attempt_id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),

  owner_account_id          text        NOT NULL,
  plan_id                   text        NOT NULL,

  -- Idempotency key · provider callbacks may fire more than once; we
  -- require every attempt to pass a key and we enforce uniqueness so
  -- the second callback cannot grant a second entitlement.
  idempotency_key           text        NOT NULL,

  outcome                   text        NOT NULL
    CHECK (outcome IN (
      'initiated',
      'succeeded',
      'failed',
      'cancelled',
      'duplicate_ignored'
    )),

  provider                  text        NOT NULL DEFAULT 'test_mode',

  -- Opaque short string summarising the provider response · never a
  -- raw PAN / card detail / full webhook body. Capped at 500 chars
  -- in the service layer. Null when there is no response to record.
  provider_response_summary text        NULL,

  -- Soft FK to the entitlement row (if any) · ON DELETE SET NULL so
  -- deleting an entitlement does not break the attempt audit.
  entitlement_id            uuid        NULL
    REFERENCES nex.family_safety_entitlement (entitlement_id)
    ON DELETE SET NULL,

  -- Phase 1 ALWAYS TRUE.
  test_mode                 boolean     NOT NULL DEFAULT TRUE,
  simulated                 boolean     NOT NULL DEFAULT TRUE,

  attempted_at              timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS family_safety_payment_attempt_idem_uq
  ON nex.family_safety_payment_attempt (idempotency_key);

CREATE INDEX IF NOT EXISTS family_safety_payment_attempt_owner_time_idx
  ON nex.family_safety_payment_attempt (owner_account_id, attempted_at DESC);

-- ──────────────────────────────────────────────────────────────────
-- END · 202_nex_family_safety_subscription.sql
-- ──────────────────────────────────────────────────────────────────
