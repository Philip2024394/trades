-- Xrated Trades — Lead Alerts add-on (£4/mo).
--
-- PWA web-push notifications. When a customer taps WhatsApp on a
-- tradesperson's profile, every device the tradesperson has subscribed
-- (iPhone + office iPad + Android phone — unlimited per listing) wakes
-- up with a push the second the click lands.
--
-- Also the notification infrastructure layer for Materials Network
-- commission pings, review pings, etc. — `muted_events text[]` lets a
-- builder mute commission pings while keeping WhatsApp lead pings.
--
-- Namespace: hammerex_xrated_push_*.
--
-- Tables introduced here:
-- 1. hammerex_xrated_push_subscriptions — one row per (listing, device).
--
-- The push_log table already exists from 20260627050000 Materials
-- Network — DO NOT recreate it; we just SELECT/INSERT against it.

-- ─── 1. push_subscriptions ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS hammerex_xrated_push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL
    REFERENCES hammerex_trade_off_listings(id) ON DELETE CASCADE,
  endpoint text NOT NULL,
  -- SHA-256 of the endpoint URL — used for the public-facing UNIQUE key
  -- and any "test this device" / "disable this device" call so we
  -- never echo the raw endpoint URL back to the client.
  endpoint_hash text GENERATED ALWAYS AS (encode(sha256(endpoint::bytea),'hex')) STORED,
  p256dh_key text NOT NULL,
  auth_key text NOT NULL,
  user_agent text,
  platform text NOT NULL DEFAULT 'unknown'
    CHECK (platform IN ('ios','android','desktop','unknown')),
  device_label text,
  -- Web Vibration API pattern (alternating vibrate/pause ms). Default
  -- is "Standard": short-short-long. Subtle / Loud / Very loud presets
  -- are wired in the dashboard picker.
  vibration_pattern int[] NOT NULL DEFAULT '{200,100,200,100,400}',
  -- Mute per event type. Empty array = receive all events. Known
  -- values today: 'whatsapp_click', 'commission', 'review', 'test'.
  muted_events text[] NOT NULL DEFAULT '{}'::text[],
  -- Optional do-not-disturb window — hours in local 0-23. Both NULL =
  -- no quiet hours. Both set = window straddles midnight when
  -- start > end (e.g. 22 → 7 = 10pm to 7am).
  quiet_hours_start smallint
    CHECK (quiet_hours_start IS NULL OR quiet_hours_start BETWEEN 0 AND 23),
  quiet_hours_end smallint
    CHECK (quiet_hours_end IS NULL OR quiet_hours_end BETWEEN 0 AND 23),
  enabled boolean NOT NULL DEFAULT true,
  last_used_at timestamptz,
  last_success_at timestamptz,
  failure_count int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (listing_id, endpoint_hash)
);

CREATE INDEX IF NOT EXISTS idx_push_sub_listing_enabled
  ON hammerex_xrated_push_subscriptions (listing_id) WHERE enabled;

CREATE INDEX IF NOT EXISTS idx_push_sub_failure
  ON hammerex_xrated_push_subscriptions (failure_count) WHERE failure_count > 0;

-- ─── 2. push_log columns we rely on ─────────────────────────────────
-- The log table exists from Materials Network. We need two extra
-- columns for delivery tracking + per-device attribution. ALTER, do
-- NOT recreate.
ALTER TABLE hammerex_xrated_push_log
  ADD COLUMN IF NOT EXISTS subscription_id uuid
    REFERENCES hammerex_xrated_push_subscriptions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS delivery_status text
    NOT NULL DEFAULT 'queued'
    CHECK (delivery_status IN ('queued','sent','failed','throttled','muted','quiet_hours')),
  ADD COLUMN IF NOT EXISTS delivery_error text;

CREATE INDEX IF NOT EXISTS idx_push_log_subscription
  ON hammerex_xrated_push_log (subscription_id, created_at DESC)
  WHERE subscription_id IS NOT NULL;
