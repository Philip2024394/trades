-- OS — Homeowner invites external trade to xratedtrade.com.
--
-- Sarah has a plumber, a carpenter, an electrician she trusts and wants
-- to keep them in her Circle. This table stores her invitations to
-- those trades to join the platform. When the trade completes /join,
-- we mark the invite accepted and link the newly-created listing back.
--
-- One-time token gates the invited-signup flow — the trade lands on
-- /join/start?invite=TOKEN with prefilled fields.

BEGIN;

CREATE TABLE IF NOT EXISTS os_homeowner_trade_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  inviter_party_id uuid NOT NULL REFERENCES os_parties(id) ON DELETE CASCADE,

  invited_display_name text NOT NULL,
  invited_email text NOT NULL,
  invited_email_hash text NOT NULL,          -- salted sha256 for dedup
  invited_trade text NOT NULL,                -- primary_trade slug
  note text,                                  -- optional message shown in email

  token uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,

  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','accepted','declined','expired','revoked')),

  sent_at timestamptz,
  accepted_at timestamptz,
  declined_at timestamptz,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 days'),

  resulting_business_listing_id uuid,         -- the listing they created
  resulting_business_id uuid REFERENCES os_business_listings(id) ON DELETE SET NULL,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS os_homeowner_trade_invites_inviter_idx
  ON os_homeowner_trade_invites (inviter_party_id, created_at DESC);
CREATE INDEX IF NOT EXISTS os_homeowner_trade_invites_status_idx
  ON os_homeowner_trade_invites (status);
CREATE INDEX IF NOT EXISTS os_homeowner_trade_invites_email_hash_idx
  ON os_homeowner_trade_invites (invited_email_hash);

CREATE OR REPLACE FUNCTION os_homeowner_trade_invites_touch()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS os_homeowner_trade_invites_touch_trg ON os_homeowner_trade_invites;
CREATE TRIGGER os_homeowner_trade_invites_touch_trg
  BEFORE UPDATE ON os_homeowner_trade_invites
  FOR EACH ROW EXECUTE FUNCTION os_homeowner_trade_invites_touch();

COMMIT;
