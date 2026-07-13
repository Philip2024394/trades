-- Trade Center — trade recovery channels.
--
-- Every trade can pin one primary sign-in channel plus up to two
-- backup channels. If they lose their WhatsApp SIM they sign in with
-- their backup email (or vice versa) and the recovery route
-- re-associates the new channel to the same auth.users.id.

BEGIN;

CREATE TABLE IF NOT EXISTS app_trade_recovery_channels (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trade_id      uuid NOT NULL,                    -- = auth.users.id
  channel       text NOT NULL CHECK (channel IN ('whatsapp','sms','email')),
  destination   text NOT NULL,                    -- E.164 phone or lowercased email
  verified_at   timestamptz,
  is_primary    boolean NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (trade_id, channel, destination)
);

CREATE INDEX IF NOT EXISTS app_trade_recovery_trade_idx
  ON app_trade_recovery_channels (trade_id);
CREATE INDEX IF NOT EXISTS app_trade_recovery_destination_idx
  ON app_trade_recovery_channels (channel, destination) WHERE verified_at IS NOT NULL;

ALTER TABLE app_trade_recovery_channels ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS app_trade_recovery_owner ON app_trade_recovery_channels;
CREATE POLICY app_trade_recovery_owner
  ON app_trade_recovery_channels
  FOR ALL
  USING (trade_id = auth.uid())
  WITH CHECK (trade_id = auth.uid());

COMMIT;
