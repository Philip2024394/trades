-- Trade Center — cross-persona notification store + Web Push subscriptions.
--
-- Serves BOTH:
--   • trades  — recipient_kind = 'trade', recipient_id = auth.uid()
--   • merchants — recipient_kind = 'merchant', recipient_id = hammerex_trade_off_listings.id
--
-- One event on the OS event bus can produce many notification rows
-- (one per recipient in the fan-out). The bell polls unread; a push
-- subscription fans out to the device the moment a row is written.

BEGIN;

-- ---------------------------------------------------------------------
-- Notifications
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS app_notifications (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_kind text NOT NULL CHECK (recipient_kind IN ('trade','merchant')),
  recipient_id   uuid NOT NULL,
  kind           text NOT NULL,        -- e.g. 'notebook.quote_request.sent'
  title          text NOT NULL,
  body           text NOT NULL,
  action_url     text,                  -- deep link the click handler opens
  subject_type   text,                  -- e.g. 'notebook_quote_request'
  subject_id     uuid,
  payload        jsonb NOT NULL DEFAULT '{}'::jsonb,
  read_at        timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS app_notifications_recipient_idx
  ON app_notifications (recipient_kind, recipient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS app_notifications_unread_idx
  ON app_notifications (recipient_kind, recipient_id) WHERE read_at IS NULL;

ALTER TABLE app_notifications ENABLE ROW LEVEL SECURITY;

-- Trades: read their own via auth.uid()
DROP POLICY IF EXISTS app_notifications_trade_read ON app_notifications;
CREATE POLICY app_notifications_trade_read
  ON app_notifications
  FOR SELECT
  USING (recipient_kind = 'trade' AND recipient_id = auth.uid());

DROP POLICY IF EXISTS app_notifications_trade_update ON app_notifications;
CREATE POLICY app_notifications_trade_update
  ON app_notifications
  FOR UPDATE
  USING (recipient_kind = 'trade' AND recipient_id = auth.uid())
  WITH CHECK (recipient_kind = 'trade' AND recipient_id = auth.uid());

-- Merchant read/update goes via service-role server helpers (cookie-based
-- session, not Supabase auth) — no client-facing merchant policy here.

-- ---------------------------------------------------------------------
-- Push subscriptions
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS app_push_subscriptions (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_kind    text NOT NULL CHECK (recipient_kind IN ('trade','merchant')),
  recipient_id      uuid NOT NULL,
  endpoint          text NOT NULL,       -- browser-generated push endpoint URL
  p256dh            text NOT NULL,       -- ECDH public key
  auth              text NOT NULL,       -- shared auth secret
  user_agent        text,
  enabled           boolean NOT NULL DEFAULT true,
  failure_count     integer NOT NULL DEFAULT 0,
  last_delivered_at timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (endpoint)
);

CREATE INDEX IF NOT EXISTS app_push_subscriptions_recipient_idx
  ON app_push_subscriptions (recipient_kind, recipient_id) WHERE enabled;

ALTER TABLE app_push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS app_push_subscriptions_trade ON app_push_subscriptions;
CREATE POLICY app_push_subscriptions_trade
  ON app_push_subscriptions
  FOR ALL
  USING (recipient_kind = 'trade' AND recipient_id = auth.uid())
  WITH CHECK (recipient_kind = 'trade' AND recipient_id = auth.uid());

COMMIT;
