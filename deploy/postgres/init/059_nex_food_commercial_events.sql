-- 059_nex_food_commercial_events.sql
--
-- NEX Food · Phase 8.1 · commercial event schema + NEX_VALUE_SCORE view +
-- HQ rule config + next-action state.
--
-- Motivation (Philip 2026-08-21 · orchestration engine redirection)
--   HQ must not be a passive dashboard. It must automatically identify
--   businesses ready for conversion based on measurable value delivered.
--   This migration lands the foundation:
--     1  Every customer/business commercial event is captured (view · enquiry ·
--        qualified · booking · price_request · membership_offer · payment)
--     2  NEX_VALUE_SCORE is a computed view · not a stored column · always fresh
--     3  Configurable HQ rules (thresholds live in DB · not hard-coded)
--     4  Free-allowance tracking per business
--     5  Next-action state per business + audit trail of every decision
--
-- Indonesia-first defaults (LOCKED)
--   market='ID' · locale='id-ID' · currency='IDR' · default_language='id'
--   All business-facing messaging composed in Bahasa Indonesia by default.
--
-- What ships in this migration
--   1  nex.food_commercial_event · append-only event log
--   2  nex.food_business_value  · MATERIALIZED VIEW aggregating events per business
--   3  nex.food_hq_rule · configurable conversion rules
--   4  nex.food_business_next_action · latest computed next-action per business
--   5  nex.food_next_action_audit · history of every next-action computation
--   6  Seed 3 starter HQ rules (free allowance · qualified enquiry threshold ·
--      membership offer trigger)
--
-- Reversible
--   BEGIN;
--   DROP TABLE IF EXISTS nex.food_next_action_audit CASCADE;
--   DROP TABLE IF EXISTS nex.food_business_next_action CASCADE;
--   DROP TABLE IF EXISTS nex.food_hq_rule CASCADE;
--   DROP MATERIALIZED VIEW IF EXISTS nex.food_business_value CASCADE;
--   DROP TABLE IF EXISTS nex.food_commercial_event CASCADE;
--   DROP TYPE IF EXISTS nex.nex_food_next_action;
--   DROP TYPE IF EXISTS nex.nex_food_event_type;
--   COMMIT;

CREATE SCHEMA IF NOT EXISTS nex;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ── Enums ───────────────────────────────────────────────────────────────────

DO $body$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'nex_food_event_type' AND n.nspname = 'nex'
  ) THEN
    CREATE TYPE nex.nex_food_event_type AS ENUM (
      'profile_view',           -- customer opened the business profile
      'search_appearance',      -- business appeared in a customer search result
      'enquiry',                -- customer sent a message / clicked contact
      'qualified_enquiry',      -- enquiry that met a qualification bar (e.g. specific ask)
      'booking_request',        -- customer requested a booking / order
      'price_request',          -- customer asked about pricing
      'membership_offer_shown', -- HQ presented membership offer to business
      'membership_accepted',    -- business accepted membership offer
      'payment',                -- business made a payment (subscription or pay-per-result)
      'churn_signal'            -- signal of impending churn (inactive, complaints, etc.)
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'nex_food_next_action' AND n.nspname = 'nex'
  ) THEN
    CREATE TYPE nex.nex_food_next_action AS ENUM (
      'INVITE_BUSINESS',        -- discovered/listed · never contacted
      'FOLLOW_UP',              -- contacted but no response · outside cooldown
      'WAIT',                   -- inside cooldown or otherwise not yet actionable
      'CLAIM_PENDING',          -- claim code sent · awaiting owner verify
      'ONBOARD',                -- freshly claimed · needs dashboard walkthrough
      'SHOW_VALUE',             -- claimed · receiving enquiries · membership not yet offered
      'OFFER_MEMBERSHIP',       -- free allowance exhausted or value threshold hit
      'OFFER_PAY_PER_RESULT',   -- membership declined · alternative monetisation
      'NO_ACTION'               -- paying / suppressed / churned / already-handled
    );
  END IF;
END $body$;

-- ── Commercial event log (append-only) ─────────────────────────────────────

CREATE TABLE IF NOT EXISTS nex.food_commercial_event (
  event_id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_ref     text NOT NULL,                   -- public_listing_ref
  event_type       nex_food_event_type NOT NULL,
  event_value_idr  numeric(14,2),                   -- monetary value if applicable
  customer_context jsonb,                           -- { intent, brief, budget_signal, ... }
  source_surface   text,                            -- 'nexapp_directory' | 'nex_chat' | 'external_link'
  actor_ref        text,                            -- NEX customer public ref if known
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_nex_food_event_business_created
  ON nex.food_commercial_event (business_ref, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_nex_food_event_type_created
  ON nex.food_commercial_event (event_type, created_at DESC);

COMMENT ON TABLE nex.food_commercial_event IS
  'Append-only commercial event log · every customer interaction with a business flows through here. Aggregated in nex.food_business_value materialized view. Feeds the NEX_VALUE_SCORE + next-action rules. Never mutated.';

-- ── NEX_VALUE_SCORE (materialized view · refresh on demand) ────────────────

CREATE MATERIALIZED VIEW IF NOT EXISTS nex.food_business_value AS
SELECT
  b.public_listing_ref AS business_ref,
  b.business_name,
  b.claim_status,
  b.owner_status,
  COALESCE(SUM(CASE WHEN e.event_type = 'profile_view' THEN 1 ELSE 0 END), 0)::int AS profile_views,
  COALESCE(SUM(CASE WHEN e.event_type = 'search_appearance' THEN 1 ELSE 0 END), 0)::int AS search_appearances,
  COALESCE(SUM(CASE WHEN e.event_type = 'enquiry' THEN 1 ELSE 0 END), 0)::int AS enquiries,
  COALESCE(SUM(CASE WHEN e.event_type = 'qualified_enquiry' THEN 1 ELSE 0 END), 0)::int AS qualified_enquiries,
  COALESCE(SUM(CASE WHEN e.event_type = 'booking_request' THEN 1 ELSE 0 END), 0)::int AS booking_requests,
  COALESCE(SUM(CASE WHEN e.event_type = 'price_request' THEN 1 ELSE 0 END), 0)::int AS price_requests,
  COALESCE(SUM(CASE WHEN e.event_type = 'payment' THEN e.event_value_idr ELSE 0 END), 0)::numeric(14,2) AS revenue_idr,
  MAX(e.created_at) FILTER (WHERE e.event_type IN ('enquiry','qualified_enquiry','booking_request','price_request')) AS last_customer_activity_at,
  -- NEX_VALUE_SCORE composite (weighted · Indonesia-first tuning)
  (
    COALESCE(SUM(CASE WHEN e.event_type = 'profile_view' THEN 1 ELSE 0 END), 0) * 1 +
    COALESCE(SUM(CASE WHEN e.event_type = 'search_appearance' THEN 1 ELSE 0 END), 0) * 1 +
    COALESCE(SUM(CASE WHEN e.event_type = 'enquiry' THEN 1 ELSE 0 END), 0) * 10 +
    COALESCE(SUM(CASE WHEN e.event_type = 'qualified_enquiry' THEN 1 ELSE 0 END), 0) * 25 +
    COALESCE(SUM(CASE WHEN e.event_type = 'booking_request' THEN 1 ELSE 0 END), 0) * 50 +
    COALESCE(SUM(CASE WHEN e.event_type = 'price_request' THEN 1 ELSE 0 END), 0) * 15
  )::int AS nex_value_score
FROM nex.food_business b
LEFT JOIN nex.food_commercial_event e ON e.business_ref = b.public_listing_ref
GROUP BY b.public_listing_ref, b.business_name, b.claim_status, b.owner_status;

CREATE UNIQUE INDEX IF NOT EXISTS idx_food_business_value_ref
  ON nex.food_business_value (business_ref);

COMMENT ON MATERIALIZED VIEW nex.food_business_value IS
  'Aggregated commercial signals per business. NEX_VALUE_SCORE is a weighted composite (Indonesia-first tuning). Refresh via REFRESH MATERIALIZED VIEW CONCURRENTLY nex.food_business_value. Feeds the next-action engine.';

-- ── HQ rule config (thresholds live here · not hard-coded) ─────────────────

CREATE TABLE IF NOT EXISTS nex.food_hq_rule (
  rule_key         text PRIMARY KEY,               -- 'free_allowance_qualified_enquiries' etc.
  rule_value_int   integer,                         -- for integer thresholds
  rule_value_text  text,                            -- for enum/string values
  description      text NOT NULL,                   -- human-readable purpose
  updated_at       timestamptz NOT NULL DEFAULT now(),
  updated_by       text
);

-- Seed 3 starter rules (Indonesia-first defaults · tuneable by admin)
INSERT INTO nex.food_hq_rule (rule_key, rule_value_int, description, updated_by) VALUES
  ('free_allowance_qualified_enquiries', 5,
   'Free qualified enquiries a business gets before OFFER_MEMBERSHIP is triggered', 'seed'),
  ('offer_membership_min_value_score', 100,
   'Minimum NEX_VALUE_SCORE before OFFER_MEMBERSHIP is triggered', 'seed'),
  ('churn_signal_days_inactive', 60,
   'Days without customer activity before churn_signal is auto-created for a paying business', 'seed')
ON CONFLICT (rule_key) DO NOTHING;

COMMENT ON TABLE nex.food_hq_rule IS
  'Configurable HQ conversion rules · thresholds live in DB, not hard-coded. Admin can tune without deploys. Never bypass source_import < nex_curated < admin_verified < owner_verified trust hierarchy.';

-- ── Next-action state (latest computed action per business) ────────────────

CREATE TABLE IF NOT EXISTS nex.food_business_next_action (
  business_ref     text PRIMARY KEY,
  next_action      nex_food_next_action NOT NULL,
  reason           text NOT NULL,                   -- human-readable why
  computed_at      timestamptz NOT NULL DEFAULT now(),
  input_snapshot   jsonb NOT NULL                   -- exact state that produced this action
);

CREATE INDEX IF NOT EXISTS idx_food_next_action_action
  ON nex.food_business_next_action (next_action);

CREATE INDEX IF NOT EXISTS idx_food_next_action_computed_at
  ON nex.food_business_next_action (computed_at DESC);

-- ── Next-action audit trail (every recomputation logged) ───────────────────

CREATE TABLE IF NOT EXISTS nex.food_next_action_audit (
  audit_id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_ref     text NOT NULL,
  from_action      nex_food_next_action,           -- NULL on first computation
  to_action        nex_food_next_action NOT NULL,
  reason           text NOT NULL,
  input_snapshot   jsonb NOT NULL,
  computed_at      timestamptz NOT NULL DEFAULT now(),
  computed_by      text                             -- 'engine:v1' | 'admin:override:philip'
);

CREATE INDEX IF NOT EXISTS idx_food_next_action_audit_business
  ON nex.food_next_action_audit (business_ref, computed_at DESC);

COMMENT ON TABLE nex.food_next_action_audit IS
  'Every next-action recomputation writes exactly one row here. Permanent audit trail · never mutated · never deleted. Admin can trace WHY the engine recommended each action at each point in time.';
