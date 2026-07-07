-- OS Event Bus — Foundation Sprint.
--
-- Apps publish events to os_event_log. Handlers registered at
-- module-load time in code (os_event_handlers is the in-memory
-- registry, no table needed for that). Delivery is a fanout write to
-- os_event_deliveries — one row per (event × subscriber) — which the
-- outbox worker drains asynchronously with retry + dead-letter.
--
-- Guarantees:
--   • At-least-once delivery per subscriber
--   • Idempotency keys prevent duplicate publish (unique on
--     (publisher_app, event_type, dedup_key) when supplied)
--   • Exponential-backoff retries via next_attempt_at
--   • Dead-letter after max_attempts — human review in admin
--
-- Runtime shape:
--   1. App calls publish() → INSERT into os_event_log + fanout INSERTs
--      into os_event_deliveries for every registered handler slug.
--   2. In-process handlers run inline (best-effort, deliver-then-mark).
--   3. A cron (/api/cron/os-event-drain) sweeps any pending / failed
--      deliveries every minute — retries until max_attempts, then
--      dead-letters.

BEGIN;

-- ---------------------------------------------------------------------
-- 1. Event log — every event published, forever (immutable, additive).
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS os_event_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL,                     -- e.g. 'render.completed'
  event_version integer NOT NULL DEFAULT 1,
  publisher_app text NOT NULL,                  -- 'ai-visualiser' | ...
  dedup_key text,                               -- optional idempotency key
  -- routing context — every published event carries these when known
  actor_party_id uuid,
  actor_business_id uuid,
  property_id uuid,
  project_id uuid,
  subject_type text,
  subject_id text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS os_event_log_dedup_uk
  ON os_event_log (publisher_app, event_type, dedup_key)
  WHERE dedup_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS os_event_log_type_occurred_idx
  ON os_event_log (event_type, occurred_at DESC);
CREATE INDEX IF NOT EXISTS os_event_log_publisher_idx
  ON os_event_log (publisher_app, occurred_at DESC);
CREATE INDEX IF NOT EXISTS os_event_log_business_idx
  ON os_event_log (actor_business_id, occurred_at DESC)
  WHERE actor_business_id IS NOT NULL;

-- ---------------------------------------------------------------------
-- 2. Deliveries — one row per (event × subscriber). Retry-able.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS os_event_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES os_event_log(id) ON DELETE CASCADE,
  subscriber_slug text NOT NULL,                -- unique per (app_slug + handler_name)
  event_type text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending','running','delivered','failed','dead_lettered'
  )),
  attempt_count integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 6,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  last_error text,
  last_attempted_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS os_event_deliveries_event_sub_uk
  ON os_event_deliveries (event_id, subscriber_slug);
CREATE INDEX IF NOT EXISTS os_event_deliveries_pending_idx
  ON os_event_deliveries (next_attempt_at)
  WHERE status IN ('pending', 'failed');
CREATE INDEX IF NOT EXISTS os_event_deliveries_subscriber_idx
  ON os_event_deliveries (subscriber_slug, status, created_at DESC);

-- ---------------------------------------------------------------------
-- 3. Dead-letter — deliveries that exceeded max_attempts. Admin
--    surface reads from here + os_event_log.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS os_event_dead_letter (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_id uuid NOT NULL UNIQUE REFERENCES os_event_deliveries(id) ON DELETE CASCADE,
  event_id uuid NOT NULL REFERENCES os_event_log(id) ON DELETE CASCADE,
  subscriber_slug text NOT NULL,
  event_type text NOT NULL,
  final_error text,
  attempt_count integer NOT NULL,
  dead_lettered_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  reviewed_by text
);

CREATE INDEX IF NOT EXISTS os_event_dead_letter_unreviewed_idx
  ON os_event_dead_letter (dead_lettered_at DESC) WHERE reviewed_at IS NULL;

-- ---------------------------------------------------------------------
-- Touch trigger
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION os_event_touch_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS os_event_deliveries_touch ON os_event_deliveries;
CREATE TRIGGER os_event_deliveries_touch
  BEFORE UPDATE ON os_event_deliveries
  FOR EACH ROW
  EXECUTE FUNCTION os_event_touch_updated_at();

-- ---------------------------------------------------------------------
-- RLS — service-role only. All access goes through server routes.
-- ---------------------------------------------------------------------
ALTER TABLE os_event_log         ENABLE ROW LEVEL SECURITY;
ALTER TABLE os_event_deliveries  ENABLE ROW LEVEL SECURITY;
ALTER TABLE os_event_dead_letter ENABLE ROW LEVEL SECURITY;

COMMIT;
