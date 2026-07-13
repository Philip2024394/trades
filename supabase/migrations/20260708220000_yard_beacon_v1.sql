-- The Yard v3 — Beacon (the "need this now" post kind).
--
-- Beacons are a fundamentally different post kind than the rest of
-- the Yard. Instead of "post → wait → maybe" they're "post → nearby
-- merchants + trades respond within a 30–60 min window → first
-- match wins". The post row itself is the header of a short-lived
-- shared thread; responses live in a dedicated table so we can index
-- + moderate them independently.
--
-- We deliberately DO NOT enforce a geography type or PostGIS radius
-- filter at the DB layer for v1. Location comes from browser
-- geolocation and we filter server-side using simple lat/lng box
-- math. When beacon volume warrants it, drop in PostGIS later —
-- the columns already match.

BEGIN;

-- ── 1. Extend kind enum to include 'beacon' ─────────────────────────
ALTER TABLE hammerex_trade_off_yard_posts
  DROP CONSTRAINT IF EXISTS hammerex_trade_off_yard_posts_kind_check;

ALTER TABLE hammerex_trade_off_yard_posts
  ADD CONSTRAINT hammerex_trade_off_yard_posts_kind_check
  CHECK (kind IN (
    'available', 'needed', 'chat', 'product',
    'job-seek', 'job-offer', 'collab-help',
    'tools-sell', 'tools-buy', 'tools-rent',
    'materials-surplus',
    'abroad-job',
    'promo',
    'beacon'
  ));


-- ── 2. Beacon-specific columns on yard_posts ────────────────────────
ALTER TABLE hammerex_trade_off_yard_posts
  ADD COLUMN IF NOT EXISTS beacon_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS beacon_lat double precision,
  ADD COLUMN IF NOT EXISTS beacon_lng double precision,
  ADD COLUMN IF NOT EXISTS beacon_radius_km int
    CHECK (beacon_radius_km IS NULL OR beacon_radius_km BETWEEN 1 AND 200),
  ADD COLUMN IF NOT EXISTS beacon_response_count int NOT NULL DEFAULT 0
    CHECK (beacon_response_count >= 0),
  -- Once a responder is "accepted" the beacon closes and the winner
  -- is stamped here. Others can still see the beacon in history but
  -- no new responses are accepted.
  ADD COLUMN IF NOT EXISTS beacon_winner_response_id uuid,
  ADD COLUMN IF NOT EXISTS beacon_closed_at timestamptz;

-- Hot-path index: fetch live, unexpired beacons ordered newest first.
CREATE INDEX IF NOT EXISTS yard_posts_beacon_live_idx
  ON hammerex_trade_off_yard_posts (created_at DESC)
  WHERE kind = 'beacon' AND status = 'live';


-- ── 3. Responses table ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS hammerex_yard_beacon_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  beacon_post_id uuid NOT NULL
    REFERENCES hammerex_trade_off_yard_posts(id) ON DELETE CASCADE,
  responder_listing_id uuid NOT NULL
    REFERENCES hammerex_trade_off_listings(id) ON DELETE CASCADE,
  -- The responder's offer — price in pence + short availability line.
  -- Neither is required (a merchant can say "I have this, message me
  -- for price"), but the UI nudges towards including both.
  price_pence int CHECK (price_pence IS NULL OR price_pence >= 0),
  availability_text text
    CHECK (availability_text IS NULL OR char_length(availability_text) <= 200),
  message text NOT NULL CHECK (char_length(message) BETWEEN 1 AND 800),
  is_accepted boolean NOT NULL DEFAULT false,
  moderation_status text NOT NULL DEFAULT 'live'
    CHECK (moderation_status IN ('live', 'hidden', 'spam')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (beacon_post_id, responder_listing_id)
);

CREATE INDEX IF NOT EXISTS yard_beacon_responses_post_idx
  ON hammerex_yard_beacon_responses (beacon_post_id, created_at ASC)
  WHERE moderation_status = 'live';

CREATE INDEX IF NOT EXISTS yard_beacon_responses_responder_idx
  ON hammerex_yard_beacon_responses (responder_listing_id, created_at DESC);


-- ── 4. Denormalised response_count trigger ──────────────────────────
CREATE OR REPLACE FUNCTION hammerex_yard_beacon_responses_recount()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  target uuid;
BEGIN
  target := COALESCE(NEW.beacon_post_id, OLD.beacon_post_id);
  UPDATE hammerex_trade_off_yard_posts
     SET beacon_response_count = (
       SELECT count(*)
         FROM hammerex_yard_beacon_responses
        WHERE beacon_post_id = target
          AND moderation_status = 'live'
     )
   WHERE id = target;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS yard_beacon_responses_recount_ins
  ON hammerex_yard_beacon_responses;
CREATE TRIGGER yard_beacon_responses_recount_ins
AFTER INSERT ON hammerex_yard_beacon_responses
FOR EACH ROW EXECUTE FUNCTION hammerex_yard_beacon_responses_recount();

DROP TRIGGER IF EXISTS yard_beacon_responses_recount_upd
  ON hammerex_yard_beacon_responses;
CREATE TRIGGER yard_beacon_responses_recount_upd
AFTER UPDATE OF moderation_status
  ON hammerex_yard_beacon_responses
FOR EACH ROW EXECUTE FUNCTION hammerex_yard_beacon_responses_recount();

DROP TRIGGER IF EXISTS yard_beacon_responses_recount_del
  ON hammerex_yard_beacon_responses;
CREATE TRIGGER yard_beacon_responses_recount_del
AFTER DELETE ON hammerex_yard_beacon_responses
FOR EACH ROW EXECUTE FUNCTION hammerex_yard_beacon_responses_recount();

COMMIT;
