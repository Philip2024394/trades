-- Referral Engine · consolidated attribution + reward store.
-- Phase 3.2 of the engine-first roadmap.
--
-- Consolidates:
--   * mref (merchant-to-merchant, ?mref=<slug>, washer reward)
--   * affiliate program (existing hammerex_affiliates_* tables)
--   * refer-a-friend (homeowner-to-homeowner, future)
--   * driver referral (future)
--
-- program_slug distinguishes them. Attribution recorded at signup,
-- reward fulfilled by cron or on activation event.

CREATE TABLE IF NOT EXISTS public.hammerex_referrals (
  id                     UUID           PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Which programme this belongs to
  program_slug           TEXT           NOT NULL,             -- 'mref' | 'affiliate' | 'refer_a_friend' | 'driver_referral'

  -- REFERRER — who brought them in
  referrer_kind          TEXT           NOT NULL,             -- 'merchant' | 'homeowner' | 'affiliate_partner' | 'trade'
  referrer_id            TEXT           NOT NULL,
  referrer_slug          TEXT,                                -- e.g. merchant slug (mref)

  -- REFERRED — the new signup
  referred_kind          TEXT           NOT NULL,             -- 'merchant' | 'homeowner' | 'trade'
  referred_id            TEXT           NOT NULL,
  referred_display       TEXT,

  -- ATTRIBUTION source
  attribution_source     TEXT,                                -- 'url_param' | 'cookie' | 'code' | 'admin_manual'
  attribution_url        TEXT,                                -- landing url that carried the ref
  attribution_channel    TEXT,                                -- 'direct' | 'social' | 'email' | 'seo' etc.

  -- CONVERSION lifecycle
  attributed_at          TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  activated_at           TIMESTAMPTZ,                         -- when the referred user hit activation criteria
  paid_subscription_at   TIMESTAMPTZ,                         -- for programmes that reward on paid tier

  -- REWARD
  reward_kind            TEXT,                                -- 'washers' | 'cash_gbp_pence' | 'discount_pct' | 'feature_unlock'
  reward_amount          INTEGER,                             -- in pence for cash, count for washers, pct for discount
  reward_status          TEXT           NOT NULL DEFAULT 'pending',
                                        -- 'pending' | 'earned' | 'paid' | 'reversed' | 'ineligible'
  reward_earned_at       TIMESTAMPTZ,
  reward_paid_at         TIMESTAMPTZ,

  -- FRAUD detection hooks
  fraud_flag             TEXT,                                -- null when clean
  fraud_reason           TEXT,

  metadata               JSONB,
  created_at             TIMESTAMPTZ    NOT NULL DEFAULT NOW(),

  -- Prevent double-attribution: one referred user per programme
  UNIQUE (program_slug, referred_kind, referred_id)
);

CREATE INDEX IF NOT EXISTS idx_referrals_referrer
  ON public.hammerex_referrals (program_slug, referrer_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_referrals_pending_rewards
  ON public.hammerex_referrals (reward_status, created_at DESC)
  WHERE reward_status IN ('pending', 'earned');

CREATE INDEX IF NOT EXISTS idx_referrals_recent
  ON public.hammerex_referrals (created_at DESC);

ALTER TABLE public.hammerex_referrals ENABLE ROW LEVEL SECURITY;
-- Service-role only.
