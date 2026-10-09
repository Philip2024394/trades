-- NEX Managed Email Marketing · Stage 5 · AUTO Lane Wiring
-- Founder-authorised programme (three-lane operating doctrine · ADR-0003a Accepted).
--
-- ROLE
--   AUTO lane consumes NEX operating budget (NOT member packages).
--   Same shared executor as MEMBER/FOUNDER lanes.
--   Same durability/idempotency discipline as Stage 3.
--
-- HARD-LOCK
--   AUTO must NEVER call nex.marketing_package.* (member package).
--   AUTO must NEVER touch member_id-scoped attribution.
--   The two accounting substrates are structurally separate:
--     nex.marketing_package                    · MEMBER lane only
--     nex.marketing_operating_budget           · AUTO lane only
--   Founder lane uses neither (founder-controlled sending).

BEGIN;

-- ─── Operating budget (named accounting buckets for AUTO) ──────────
CREATE TABLE IF NOT EXISTS nex.marketing_operating_budget (
  budget_id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                   TEXT NOT NULL UNIQUE,           -- e.g. 'auto-marketing-2026-09'
  display_name           TEXT,
  purpose                TEXT,                           -- e.g. 'NEX crawler-discovered outreach for USA scaffolding vertical'

  -- Capacity ceilings (multi-window · optional · null = unlimited-observability)
  hourly_capacity        INTEGER,
  daily_capacity         INTEGER,
  monthly_capacity       INTEGER,

  -- Three-part invariant (matches Stage 3 discipline)
  purchased_capacity     INTEGER NOT NULL DEFAULT 0 CHECK (purchased_capacity >= 0),
  reserved_capacity      INTEGER NOT NULL DEFAULT 0 CHECK (reserved_capacity >= 0),
  consumed_capacity      INTEGER NOT NULL DEFAULT 0 CHECK (consumed_capacity >= 0),

  status                 TEXT NOT NULL DEFAULT 'active'
                         CHECK (status IN ('active','paused','exhausted','archived')),
  paused_reason          TEXT,

  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now(),

  CHECK (reserved_capacity + consumed_capacity <= purchased_capacity)
);

CREATE INDEX IF NOT EXISTS ix_operating_budget_active
  ON nex.marketing_operating_budget (status)
  WHERE status = 'active';

-- ─── Attribution ledger (immutable · idempotency-keyed) ─────────────
CREATE TABLE IF NOT EXISTS nex.marketing_operating_budget_attribution (
  attribution_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  idempotency_key      TEXT NOT NULL UNIQUE,
  budget_id            UUID NOT NULL REFERENCES nex.marketing_operating_budget(budget_id) ON DELETE RESTRICT,
  campaign_id          UUID NOT NULL,
  contact_id           UUID NOT NULL,
  queue_id             UUID,
  state                TEXT NOT NULL CHECK (state IN ('reserved','consumed','released')),
  units                INTEGER NOT NULL DEFAULT 1 CHECK (units > 0),
  reserved_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  consumed_at          TIMESTAMPTZ,
  released_at          TIMESTAMPTZ,
  release_reason       TEXT,
  detail               JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS ix_ob_attribution_budget
  ON nex.marketing_operating_budget_attribution (budget_id, state);

CREATE INDEX IF NOT EXISTS ix_ob_attribution_campaign
  ON nex.marketing_operating_budget_attribution (campaign_id);

-- ─── Audit trail ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS nex.marketing_operating_budget_audit (
  audit_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  budget_id      UUID NOT NULL REFERENCES nex.marketing_operating_budget(budget_id) ON DELETE CASCADE,
  event_type     TEXT NOT NULL,
  from_state     JSONB,
  to_state       JSONB,
  actor          TEXT NOT NULL,
  detail         JSONB NOT NULL DEFAULT '{}'::jsonb,
  at_iso         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_ob_audit_budget
  ON nex.marketing_operating_budget_audit (budget_id, at_iso DESC);

COMMIT;
