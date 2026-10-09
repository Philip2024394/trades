-- NEX Managed Email Marketing · Stage 3 · Member Marketing Package
-- Founder-authorised programme (three-lane operating doctrine 2026-09-21 · ADR-0003a Accepted).
--
-- ROLE
--   Durable commercial layer permitting a MEMBER to purchase managed
--   email-marketing capacity. Member purchases campaign EXECUTION
--   capability · NEVER ownership of NEX contacts (ADR-0003a Clause 1/5).
--
-- ACCOUNTING SEMANTICS
--   Reservation-based · three-part invariant:
--     purchased_capacity  = paid-for total credit
--     reserved_capacity   = held for enqueued sends (not yet delivered)
--     consumed_capacity   = actually delivered
--     remaining_capacity  = purchased - reserved - consumed
--
--   CHECK ensures reserved + consumed ≤ purchased at all times.
--
--   Lifecycle of one unit:
--     [reserve at enqueue] → [consume on delivered]
--                          OR [release on permanent-failure / cancellation]
--
--   Distinguishes:
--     'reserved'  · unit held pending delivery
--     'consumed'  · unit spent · terminal
--     'released'  · unit refunded · returned to remaining
--
-- IDEMPOTENCY (Stage 3 hard-lock)
--   nex.marketing_package_attribution.idempotency_key is UNIQUE.
--   Retries with the same key return 'already_attributed' · no double-charge.
--   Key derived from Wave 2 D2 · (package_id, campaign_id, contact_id, queue_id, attempt_id).
--
-- CONCURRENCY
--   Two workers reserving simultaneously: both attempt conditional UPDATE:
--     UPDATE marketing_package
--        SET reserved_capacity = reserved_capacity + 1
--      WHERE package_id = $1
--        AND status = 'active'
--        AND reserved_capacity + consumed_capacity + 1 <= purchased_capacity
--    RETURNING reserved_capacity;
--   Postgres row-level lock ensures only ONE wins the last unit.
--
-- LANE + MEMBER ISOLATION
--   package.member_id is enforced in every SELECT/UPDATE by the repository.
--   AUTO lane and FOUNDER lane NEVER touch this table (verified in tests).

BEGIN;

-- ─── Package · one row per purchased managed-marketing package ─────
CREATE TABLE IF NOT EXISTS nex.marketing_package (
  package_id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id              UUID NOT NULL,

  -- Product identity
  package_type           TEXT NOT NULL,                    -- e.g. 'starter-500-managed-sends' · 'monthly-2000-managed-sends'
  display_name           TEXT,

  -- Capacity accounting (three-part invariant)
  purchased_capacity     INTEGER NOT NULL CHECK (purchased_capacity >= 0),
  reserved_capacity      INTEGER NOT NULL DEFAULT 0 CHECK (reserved_capacity >= 0),
  consumed_capacity      INTEGER NOT NULL DEFAULT 0 CHECK (consumed_capacity >= 0),

  -- Lifecycle status (6-state canonical vocabulary)
  status                 TEXT NOT NULL DEFAULT 'available'
                         CHECK (status IN ('available','active','exhausted','expired','paused','cancelled')),

  -- Purchase provenance
  currency               TEXT,
  purchase_reference     TEXT,                             -- opaque external ref · NEVER credentials
  purchase_amount_minor  INTEGER,                          -- minor units (cents/pence) · nullable if free/gift
  purchased_at           TIMESTAMPTZ,
  activated_at           TIMESTAMPTZ,
  expires_at             TIMESTAMPTZ,

  -- Optional package-level targeting constraints
  targeting              JSONB NOT NULL DEFAULT '{}'::jsonb,   -- e.g. {"country":"US","category":"scaffolding"}

  metadata               JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Three-part invariant enforced by DB
  CHECK (reserved_capacity + consumed_capacity <= purchased_capacity)
);

CREATE INDEX IF NOT EXISTS ix_package_member
  ON nex.marketing_package (member_id, status);

CREATE INDEX IF NOT EXISTS ix_package_status
  ON nex.marketing_package (status)
  WHERE status IN ('active','available');

-- ─── Attribution ledger · immutable record of each consumption event ─
-- The UNIQUE idempotency_key is the concurrency + retry safety anchor.
CREATE TABLE IF NOT EXISTS nex.marketing_package_attribution (
  attribution_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  idempotency_key      TEXT NOT NULL UNIQUE,                -- Wave 2 D2 key · (package · campaign · contact · queue · attempt)
  package_id           UUID NOT NULL REFERENCES nex.marketing_package(package_id) ON DELETE RESTRICT,
  member_id            UUID NOT NULL,                       -- redundant · enforced-at-insert for isolation checks
  campaign_id          UUID NOT NULL,
  contact_id           UUID NOT NULL,
  queue_id             UUID,                                -- link to nex.marketing_send_queue if applicable
  state                TEXT NOT NULL
                       CHECK (state IN ('reserved','consumed','released')),
  units                INTEGER NOT NULL DEFAULT 1 CHECK (units > 0),
  reserved_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  consumed_at          TIMESTAMPTZ,
  released_at          TIMESTAMPTZ,
  release_reason       TEXT,
  detail               JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS ix_attribution_package
  ON nex.marketing_package_attribution (package_id, state);

CREATE INDEX IF NOT EXISTS ix_attribution_campaign
  ON nex.marketing_package_attribution (campaign_id);

CREATE INDEX IF NOT EXISTS ix_attribution_member
  ON nex.marketing_package_attribution (member_id, state);

-- ─── Audit trail · every material state transition ──────────────────
CREATE TABLE IF NOT EXISTS nex.marketing_package_audit (
  audit_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id     UUID NOT NULL REFERENCES nex.marketing_package(package_id) ON DELETE CASCADE,
  event_type     TEXT NOT NULL
                 CHECK (event_type IN (
                   'created','activated','paused','resumed','exhausted','expired','cancelled',
                   'capacity_reserved','capacity_consumed','capacity_released',
                   'status_changed','duplicate_purchase_attempt','isolation_violation_attempt'
                 )),
  from_state     JSONB,
  to_state       JSONB,
  actor          TEXT NOT NULL,                            -- 'member:<uuid>' · 'system:executor' · 'founder' · 'worker:<id>'
  detail         JSONB NOT NULL DEFAULT '{}'::jsonb,
  at_iso         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_package_audit_by_package
  ON nex.marketing_package_audit (package_id, at_iso DESC);

COMMIT;
