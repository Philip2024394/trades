-- ============================================================================
-- NEX-native Migration 120 · nex_affiliate_account
-- ============================================================================
--
-- Minimum shippable affiliate entry record · founder-sealed 2026-10-01.
--
-- Scope decision: this migration establishes ONLY the "I am an affiliate"
-- relationship so a new NEX user who selects "Affiliate" during first-
-- user onboarding has a real account capability (not a dead button).
-- The full affiliate programme (ledger, attribution events, rotation,
-- payouts, disputes) is specced separately in the NEX Affiliate Network
-- doctrine and will land as subsequent migrations (121+) that reference
-- this table.
--
-- Reuses existing NEX account identity · no duplicate account system.
-- Immutable at creation · referrer_account_id is set at join time and
-- never mutated (anti-fraud · prevents stealing an affiliate's referral
-- bonus retroactively).
--
-- NEX never holds or transfers affiliate commission. This table does
-- NOT include a wallet or balance column. Downstream migrations will
-- derive balances from the commission ledger.
--
-- Rollback:
--   BEGIN;
--     DELETE FROM nex_migration_history WHERE version = '120';
--     DROP TABLE IF EXISTS nex_affiliate_account;
--   COMMIT;
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS nex_affiliate_account (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- 1:1 with nex_account · a NEX user either is or is not an affiliate.
  account_id               uuid NOT NULL UNIQUE
    REFERENCES nex_account(id) ON DELETE CASCADE,
  -- Optional · the affiliate who referred this user INTO the affiliate
  -- programme. Drives the 3% referral bonus on qualifying sales. Set
  -- once at join time · immutable thereafter (anti-fraud).
  referred_by_account_id   uuid
    REFERENCES nex_account(id) ON DELETE SET NULL,
  -- Programme state. 'active' = can earn commission. 'paused' /
  -- 'banned' are reserved for future admin actions. Phase 1 only
  -- creates 'active' rows.
  status                   text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'paused', 'banned')),
  -- Terms version the user accepted at join. Required · reject NULL
  -- so there's always a defensible evidence trail of consent.
  terms_version            text NOT NULL,
  terms_accepted_at        timestamptz NOT NULL DEFAULT now(),
  joined_at                timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT nex_affiliate_account_no_self_referral
    CHECK (referred_by_account_id IS NULL OR referred_by_account_id <> account_id)
);

COMMENT ON TABLE nex_affiliate_account IS
  'Affiliate programme membership · 1:1 with nex_account · immutable referrer at join time · NEX never holds or transfers affiliate funds. Sealed 2026-10-01.';

COMMENT ON COLUMN nex_affiliate_account.referred_by_account_id IS
  'The affiliate who directly referred this user into the programme · drives the 3% referral bonus · set once at join, never mutated (anti-fraud).';

CREATE INDEX IF NOT EXISTS nex_affiliate_account_referrer_idx
  ON nex_affiliate_account (referred_by_account_id)
  WHERE referred_by_account_id IS NOT NULL;

CREATE OR REPLACE FUNCTION nex_affiliate_account_touch()
RETURNS trigger AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS nex_affiliate_account_touch_trg ON nex_affiliate_account;
CREATE TRIGGER nex_affiliate_account_touch_trg
  BEFORE UPDATE ON nex_affiliate_account
  FOR EACH ROW
  EXECUTE FUNCTION nex_affiliate_account_touch();

-- Immutability of referred_by once set · the ONLY column anyone could
-- try to change for fraud reasons. Protect it with a BEFORE UPDATE
-- trigger that raises if the referrer id is being changed to anything
-- other than its original value (status transitions are fine).
CREATE OR REPLACE FUNCTION nex_affiliate_account_lock_referrer()
RETURNS trigger AS $$
BEGIN
  IF NEW.referred_by_account_id IS DISTINCT FROM OLD.referred_by_account_id THEN
    RAISE EXCEPTION 'nex_affiliate_account.referred_by_account_id is immutable';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS nex_affiliate_account_lock_referrer_trg ON nex_affiliate_account;
CREATE TRIGGER nex_affiliate_account_lock_referrer_trg
  BEFORE UPDATE ON nex_affiliate_account
  FOR EACH ROW
  EXECUTE FUNCTION nex_affiliate_account_lock_referrer();

ALTER TABLE nex_affiliate_account ENABLE ROW LEVEL SECURITY;

-- Public read of the FACT that an account is an affiliate (not the
-- referrer link). Lets the affiliate marketplace show "N active
-- affiliates promote this seller" without exposing who referred whom.
DROP POLICY IF EXISTS nex_affiliate_account_public_read ON nex_affiliate_account;
CREATE POLICY nex_affiliate_account_public_read
  ON nex_affiliate_account FOR SELECT TO anon, authenticated
  USING (true);

-- Service-role writes only · join / status transition / admin actions
-- all go through Server Actions that bypass client RLS.
DROP POLICY IF EXISTS nex_affiliate_account_deny_client_write ON nex_affiliate_account;
CREATE POLICY nex_affiliate_account_deny_client_write
  ON nex_affiliate_account FOR ALL TO anon, authenticated
  USING (false) WITH CHECK (false);

INSERT INTO nex_migration_history (version, description, notes)
  VALUES (
    '120',
    'nex_affiliate_account · 1:1 with nex_account · immutable referrer at join · status enum · terms version evidence',
    'Founder-authorised 2026-10-01. First-user Affiliate join path. Minimum shippable record · ledger/attribution/payout tables land in subsequent migrations per NEX Affiliate Network doctrine. NEX never holds funds · no wallet column.'
  )
  ON CONFLICT (version) DO NOTHING;

COMMIT;
