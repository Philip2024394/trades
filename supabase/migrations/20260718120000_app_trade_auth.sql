-- Trade Center auth — trade profiles + OTP scratch table.
--
-- `app_trade_profiles.id` == Supabase `auth.users.id`. Every Trade
-- Center row that references a trade uses that same UUID.
-- Extended profile (display_name, trade_discipline, home_postcode)
-- lives here so we don't overload the auth.users row.
--
-- `app_trade_otp_codes` is a short-lived hash of the OTP we sent.
-- Entries expire in 5 minutes; the verify route deletes on success.

BEGIN;

-- ---------------------------------------------------------------------
-- Trade profiles
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS app_trade_profiles (
  id                uuid PRIMARY KEY,           -- = auth.users.id
  phone_e164        text UNIQUE,
  email             text UNIQUE,
  display_name      text NOT NULL,
  trade_discipline  text,                       -- 'plasterer', 'electrician', etc.
  home_postcode     text,
  home_city         text,
  identity_complete boolean NOT NULL DEFAULT false,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS app_trade_profiles_phone_idx
  ON app_trade_profiles (phone_e164) WHERE phone_e164 IS NOT NULL;
CREATE INDEX IF NOT EXISTS app_trade_profiles_email_idx
  ON app_trade_profiles (email) WHERE email IS NOT NULL;

-- ---------------------------------------------------------------------
-- OTP codes — short-lived, hashed
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS app_trade_otp_codes (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel       text NOT NULL CHECK (channel IN ('whatsapp','sms','email')),
  destination   text NOT NULL,                  -- phone in E.164 or email
  code_hash     text NOT NULL,                  -- sha256(code + destination + secret)
  attempts      integer NOT NULL DEFAULT 0,
  expires_at    timestamptz NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS app_trade_otp_codes_dest_idx
  ON app_trade_otp_codes (destination, channel);
CREATE INDEX IF NOT EXISTS app_trade_otp_codes_expiry_idx
  ON app_trade_otp_codes (expires_at);

-- ---------------------------------------------------------------------
-- Trigger — touch updated_at on profile update
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION app_trade_profiles_touch() RETURNS trigger AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS app_trade_profiles_touch ON app_trade_profiles;
CREATE TRIGGER app_trade_profiles_touch
  BEFORE UPDATE ON app_trade_profiles
  FOR EACH ROW EXECUTE FUNCTION app_trade_profiles_touch();

-- ---------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------
ALTER TABLE app_trade_profiles  ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_trade_otp_codes ENABLE ROW LEVEL SECURITY;

-- Profile: owner read/write. Public read of display_name only would
-- come via a merchant-facing view; not exposed here.
DROP POLICY IF EXISTS app_trade_profiles_owner ON app_trade_profiles;
CREATE POLICY app_trade_profiles_owner
  ON app_trade_profiles
  FOR ALL
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- OTP codes: never client-accessible. Service role only. RLS enabled
-- with no policy = deny-all for anon/authenticated.

COMMIT;
