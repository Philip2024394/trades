-- Merchant dashboard backend — 5 tables the current /trade-off/edit/*
-- dashboard needs to become a real launchpad instead of a form.
-- Enables: single summary endpoint, persisted onboarding checklist,
-- daily metrics rollup, per-feature usage counters, notification
-- prefs per channel.

-- ─── 1. Daily metrics rollup ─────────────────────────────────
-- One row per merchant per day capturing everything the "growth
-- this week" launchpad card needs. Populated by a nightly cron;
-- read by /api/merchant/dashboard/summary in a single query.
CREATE TABLE IF NOT EXISTS public.hammerex_merchant_daily_metrics (
  merchant_slug        TEXT NOT NULL,
  day                  DATE NOT NULL,
  profile_views        INTEGER NOT NULL DEFAULT 0,
  whatsapp_clicks      INTEGER NOT NULL DEFAULT 0,
  canteen_posts        INTEGER NOT NULL DEFAULT 0,
  yard_posts           INTEGER NOT NULL DEFAULT 0,
  reactions_received   INTEGER NOT NULL DEFAULT 0,
  new_reviews          INTEGER NOT NULL DEFAULT 0,
  referrals_generated  INTEGER NOT NULL DEFAULT 0,
  washers_spent        INTEGER NOT NULL DEFAULT 0,
  washers_earned       INTEGER NOT NULL DEFAULT 0,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (merchant_slug, day)
);

CREATE INDEX IF NOT EXISTS idx_merchant_daily_metrics_recent
  ON public.hammerex_merchant_daily_metrics (merchant_slug, day DESC);

-- ─── 2. Onboarding checklist (persisted) ─────────────────────
-- Backs the FirstRunChecklist.tsx component (currently orphaned).
-- Each step is a row so we track WHEN a merchant completed it +
-- can add new steps without a schema change.
CREATE TABLE IF NOT EXISTS public.hammerex_merchant_onboarding_steps (
  merchant_slug  TEXT NOT NULL,
  step_slug      TEXT NOT NULL,      -- e.g. "upload_logo", "post_first",
                                      -- "connect_whatsapp", "verify_email"
  completed_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  skipped        BOOLEAN NOT NULL DEFAULT FALSE,
  PRIMARY KEY (merchant_slug, step_slug)
);

CREATE INDEX IF NOT EXISTS idx_merchant_onboarding_steps_merchant
  ON public.hammerex_merchant_onboarding_steps (merchant_slug);

-- ─── 3. Feature usage counter (per feature per month) ────────
-- Every gated feature (crown banners downloaded, cutouts made,
-- ai visualiser leads, scheduled posts pending) writes here so
-- the dashboard can show "18/50 used this month" cleanly.
-- Same PK pattern as bgremoval_usage — atomic upsert.
CREATE TABLE IF NOT EXISTS public.hammerex_merchant_feature_usage (
  merchant_slug  TEXT NOT NULL,
  feature_slug   TEXT NOT NULL,      -- e.g. "crown_banner_download",
                                      -- "bg_removal", "scheduled_post",
                                      -- "ai_visualiser_lead"
  month_yyyymm   TEXT NOT NULL,
  used_count     INTEGER NOT NULL DEFAULT 0,
  last_used_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (merchant_slug, feature_slug, month_yyyymm)
);

CREATE INDEX IF NOT EXISTS idx_merchant_feature_usage_month
  ON public.hammerex_merchant_feature_usage (merchant_slug, month_yyyymm);

-- Atomic increment RPC — same pattern as increment_bgremoval_usage.
CREATE OR REPLACE FUNCTION public.increment_merchant_feature_usage(
  p_merchant_slug TEXT,
  p_feature_slug  TEXT,
  p_month_yyyymm  TEXT
) RETURNS INTEGER LANGUAGE plpgsql AS $$
DECLARE new_count INTEGER;
BEGIN
  INSERT INTO public.hammerex_merchant_feature_usage
    (merchant_slug, feature_slug, month_yyyymm, used_count, last_used_at)
  VALUES
    (p_merchant_slug, p_feature_slug, p_month_yyyymm, 1, NOW())
  ON CONFLICT (merchant_slug, feature_slug, month_yyyymm)
  DO UPDATE SET
    used_count = hammerex_merchant_feature_usage.used_count + 1,
    last_used_at = NOW()
  RETURNING used_count INTO new_count;
  RETURN new_count;
END;
$$;

-- ─── 4. Notification preferences (per channel per category) ──
-- Currently only `phone_calls_enabled` bool exists on the listing.
-- Merchants need finer control: email vs whatsapp vs push, per
-- category (new_lead, new_review, yard_digest, washer_top_up_hint).
CREATE TABLE IF NOT EXISTS public.hammerex_merchant_notification_prefs (
  merchant_slug TEXT NOT NULL,
  category      TEXT NOT NULL,
  channel       TEXT NOT NULL,      -- 'email' | 'whatsapp' | 'push' | 'sms'
  enabled       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (merchant_slug, category, channel),
  CONSTRAINT hammerex_merchant_notif_channel_check CHECK (
    channel IN ('email', 'whatsapp', 'push', 'sms')
  )
);

-- ─── 5. Merchant activity log (light) ────────────────────────
-- Enables the "what did I do today" strip on the launchpad and
-- powers the future audit trail for admin support. Not every action
-- lands here — only the ones a merchant would want to see.
CREATE TABLE IF NOT EXISTS public.hammerex_merchant_activity_log (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_slug  TEXT NOT NULL,
  event_type     TEXT NOT NULL,      -- 'post_scheduled', 'cutout_made',
                                      -- 'crown_downloaded', 'review_received',
                                      -- 'referral_reward_earned'
  event_payload  JSONB,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_merchant_activity_log_recent
  ON public.hammerex_merchant_activity_log (merchant_slug, created_at DESC);

-- RLS on all 5 tables — service-role writes; merchant reads own
-- via authenticated API endpoints (never direct DB).
ALTER TABLE public.hammerex_merchant_daily_metrics       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hammerex_merchant_onboarding_steps    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hammerex_merchant_feature_usage       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hammerex_merchant_notification_prefs  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hammerex_merchant_activity_log        ENABLE ROW LEVEL SECURITY;
