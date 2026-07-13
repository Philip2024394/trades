-- The Construction Notebook — unified activity events table.
--
-- Powers two feeds off one table:
--   • Public feed  (is_public = true)   → landing "the platform is
--                                          alive" widget for logged-
--                                          out visitors
--   • Personal feed (recipient_listing_id = <trade>) → landing "what
--                                          needs your attention" widget
--                                          for logged-in trades
--
-- Sources fill this table via existing insert paths — comments create
-- comment_reply events, project submit creates lead_matched events,
-- contact tracker creates contact_received events. Each source
-- pre-fills summary_text + action_url so the widget is a single query.
--
-- Rows auto-expire after 30 days.

BEGIN;

CREATE TABLE IF NOT EXISTS os_activity_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Categorisation ─ every event has both a kind (business meaning)
  -- and a subject (what it points at).
  kind text NOT NULL CHECK (kind IN (
    'comment_reply',        -- someone replied to a post you own
    'contact_received',     -- someone clicked the WhatsApp button on your post
    'lead_matched',         -- a homeowner project matched your trade + area
    'trade_joined',         -- a new tradesperson joined the platform
    'tier_upgraded',        -- a trade upgraded to a paid tier
    'thread_hot',           -- a Yard thread is getting comment traction
    'project_posted',       -- a homeowner posted a new project brief
    'system_tip'            -- golden-path recommendation to the recipient
  )),
  subject_type text CHECK (subject_type IN (
    'post', 'comment', 'project', 'listing', 'thread', null
  )),
  subject_id uuid,

  -- Fanout targeting ─ a row can be public, personal, or both.
  is_public boolean NOT NULL DEFAULT false,
  recipient_listing_id uuid
    REFERENCES hammerex_trade_off_listings(id) ON DELETE CASCADE,

  -- Source (who / what triggered this event) — nullable for system events.
  source_listing_id uuid
    REFERENCES hammerex_trade_off_listings(id) ON DELETE SET NULL,
  -- Denormalised source metadata so the widget doesn't need a JOIN
  -- and so public events stay anonymisable ("A joiner in Manchester")
  -- without leaking identity when the source hasn't consented.
  source_display_name text,
  source_trade text,
  source_city text,

  -- The widget renders these two strings directly.
  summary_text text NOT NULL CHECK (char_length(summary_text) BETWEEN 1 AND 240),
  action_url text,

  -- Per-recipient read state — irrelevant for public events, only used
  -- for personal ones.
  is_read boolean NOT NULL DEFAULT false,
  read_at timestamptz,

  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + INTERVAL '30 days')
);

-- Public feed — newest event first. The API filters on
-- expires_at > now() at query time; partial-index predicates can't
-- reference now() (must be IMMUTABLE) so we index over the boolean
-- only and let the planner do the range scan.
CREATE INDEX IF NOT EXISTS os_activity_events_public_recent_idx
  ON os_activity_events (created_at DESC)
  WHERE is_public = true;

-- Personal feed — per-recipient, unread-first.
CREATE INDEX IF NOT EXISTS os_activity_events_personal_recipient_idx
  ON os_activity_events (recipient_listing_id, is_read, created_at DESC)
  WHERE recipient_listing_id IS NOT NULL;

-- Retention cleanup — one function, wire to whatever cron surface is
-- most convenient. Runs a hard delete because these events are
-- ephemeral by design.
CREATE OR REPLACE FUNCTION os_cleanup_expired_activity()
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  deleted_count integer;
BEGIN
  DELETE FROM os_activity_events WHERE expires_at < now();
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

COMMIT;
