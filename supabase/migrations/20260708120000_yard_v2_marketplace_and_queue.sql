-- The Yard v2 — marketplace kinds + targeted notifications + queue/pacing.
--
-- Phase 2: extend kind constraint to support the marketplace expansion
-- (tools-sell, tools-buy, materials-surplus, abroad-job, promo, etc.)
--
-- Phase 3: targeted post inbox + queue pacing so single users can't
-- flood the feed. First post in 24h goes live immediately, subsequent
-- posts are queued with a 2h stagger between them. Marketplace kinds
-- are exempt from queueing (they're commercial listings, not feed).

BEGIN;

-- ── Phase 2 · Extend kind check to marketplace kinds ─────────────────
ALTER TABLE hammerex_trade_off_yard_posts
  DROP CONSTRAINT IF EXISTS hammerex_trade_off_yard_posts_kind_check;

ALTER TABLE hammerex_trade_off_yard_posts
  ADD CONSTRAINT hammerex_trade_off_yard_posts_kind_check
  CHECK (kind IN (
    -- Legacy kinds
    'available', 'needed', 'chat', 'product',
    -- v2 job board
    'job-seek', 'job-offer', 'collab-help',
    -- v2 marketplace
    'tools-sell', 'tools-buy', 'tools-rent',
    'materials-surplus',
    -- v2 international
    'abroad-job',
    -- v2 targeted promo (goes to inbox, not feed)
    'promo'
  ));

-- ── Phase 3 · Targeted audience columns ──────────────────────────────
ALTER TABLE hammerex_trade_off_yard_posts
  ADD COLUMN IF NOT EXISTS target_audience_slug text,
  ADD COLUMN IF NOT EXISTS audience_reach text NOT NULL DEFAULT 'feed'
    CHECK (audience_reach IN ('feed', 'targeted'));

-- ── Phase 3 · Queue/pacing columns ───────────────────────────────────
ALTER TABLE hammerex_trade_off_yard_posts
  ADD COLUMN IF NOT EXISTS scheduled_release_at timestamptz;

-- New value for status: 'queued'.
-- The existing status check probably permits only 'live'/'expired'/'hidden' —
-- widen it to include 'queued'.
ALTER TABLE hammerex_trade_off_yard_posts
  DROP CONSTRAINT IF EXISTS hammerex_trade_off_yard_posts_status_check;
ALTER TABLE hammerex_trade_off_yard_posts
  ADD CONSTRAINT hammerex_trade_off_yard_posts_status_check
  CHECK (status IN ('live', 'expired', 'hidden', 'queued'));

CREATE INDEX IF NOT EXISTS yard_posts_queued_release_idx
  ON hammerex_trade_off_yard_posts (scheduled_release_at)
  WHERE status = 'queued';

CREATE INDEX IF NOT EXISTS yard_posts_listing_recent_idx
  ON hammerex_trade_off_yard_posts (listing_id, created_at DESC)
  WHERE status IN ('live', 'queued');


-- ── Phase 3 · Targeted notifications inbox ───────────────────────────
CREATE TABLE IF NOT EXISTS hammerex_yard_targeted_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  recipient_listing_id uuid NOT NULL
    REFERENCES hammerex_trade_off_listings(id) ON DELETE CASCADE,
  source_post_id uuid NOT NULL
    REFERENCES hammerex_trade_off_yard_posts(id) ON DELETE CASCADE,

  is_read boolean NOT NULL DEFAULT false,
  read_at timestamptz,

  delivered_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + INTERVAL '5 days'),
  created_at timestamptz NOT NULL DEFAULT now(),

  UNIQUE (recipient_listing_id, source_post_id)
);

CREATE INDEX IF NOT EXISTS yard_targeted_notif_recipient_idx
  ON hammerex_yard_targeted_notifications (recipient_listing_id, is_read, delivered_at DESC);

CREATE INDEX IF NOT EXISTS yard_targeted_notif_expires_idx
  ON hammerex_yard_targeted_notifications (expires_at)
  WHERE is_read = false;


-- ── Retention: nightly hard-delete of expired notifications ──────────
-- We could soft-delete but the whole point is 5-day auto-cleanup so
-- inboxes stay lean and vendor promotions don't linger indefinitely.
CREATE OR REPLACE FUNCTION yard_cleanup_expired_notifications()
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  deleted_count integer;
BEGIN
  DELETE FROM hammerex_yard_targeted_notifications
   WHERE expires_at < now();
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

COMMIT;
