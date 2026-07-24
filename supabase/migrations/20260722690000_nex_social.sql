-- Nex Social — Phase 4 Action Layer.
--
-- Six tables per spec:
--   nex_social_accounts    — connected FB / IG / TikTok / LinkedIn / GBP
--   nex_social_posts       — draft → awaiting → approved → scheduled → published
--   nex_social_schedules   — one-off + recurring campaign schedules
--   nex_social_campaigns   — grouped posts (e.g. "Kitchen transformation")
--   nex_social_analytics   — engagement per published post per platform
--   nex_social_audit_log   — append-only audit
--
-- Every merchant sees only their own rows (RLS). Service role manages
-- OAuth tokens; token values never leak via anon key.

-- ─── Merchant profile — timezone (never use server time) ─────────

ALTER TABLE public.hammerex_trade_off_listings
  ADD COLUMN IF NOT EXISTS timezone TEXT NOT NULL DEFAULT 'Europe/London',
  ADD COLUMN IF NOT EXISTS auto_publish_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS auto_publish_agreed_at TIMESTAMPTZ;

COMMENT ON COLUMN public.hammerex_trade_off_listings.timezone IS
  'IANA timezone (e.g. Europe/London, Asia/Jakarta). Every schedule converts through this.';
COMMENT ON COLUMN public.hammerex_trade_off_listings.auto_publish_enabled IS
  'Merchant explicit opt-in to Nex publishing approved posts without another click. Default FALSE.';

-- ─── nex_social_accounts ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.hammerex_nex_social_accounts (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_slug       TEXT NOT NULL,
  platform            TEXT NOT NULL CHECK (platform IN ('facebook','instagram','tiktok','linkedin','google_business','whatsapp_business')),
  display_name        TEXT,                                      -- @merchant on the platform
  platform_account_id TEXT,                                      -- FB page id, IG user id, etc
  scopes              TEXT[] NOT NULL DEFAULT '{}',
  status              TEXT NOT NULL DEFAULT 'connected'
    CHECK (status IN ('connected','revoked','expired','error','pending')),
  connected_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_success_at     TIMESTAMPTZ,
  last_error          TEXT,
  token_expires_at    TIMESTAMPTZ,
  -- Tokens live only in the encrypted column; service role reads them.
  access_token_enc    TEXT,                                      -- base64 encrypted (out-of-scope: KMS integration)
  refresh_token_enc   TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (merchant_slug, platform)
);

CREATE INDEX IF NOT EXISTS idx_nex_social_accounts_merchant
  ON public.hammerex_nex_social_accounts (merchant_slug, platform);

ALTER TABLE public.hammerex_nex_social_accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS nex_social_accounts_owner_read ON public.hammerex_nex_social_accounts;
CREATE POLICY nex_social_accounts_owner_read
  ON public.hammerex_nex_social_accounts
  FOR SELECT TO authenticated
  USING (merchant_slug = (auth.jwt() ->> 'merchant_slug'));

-- ─── nex_social_campaigns ────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.hammerex_nex_social_campaigns (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_slug     TEXT NOT NULL,
  name              TEXT NOT NULL,                               -- 'Kitchen transformation Q1'
  theme             TEXT,                                        -- keyword tag for reporting
  trade_focus       TEXT,                                        -- 'joinery', 'kitchens'
  goal              TEXT,                                        -- 'leads' | 'awareness'
  target_audience   TEXT,
  status            TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused','ended')),
  starts_at         TIMESTAMPTZ,
  ends_at           TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_nex_campaigns_merchant
  ON public.hammerex_nex_social_campaigns (merchant_slug, created_at DESC);

ALTER TABLE public.hammerex_nex_social_campaigns ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS nex_campaigns_owner_read ON public.hammerex_nex_social_campaigns;
CREATE POLICY nex_campaigns_owner_read
  ON public.hammerex_nex_social_campaigns
  FOR SELECT TO authenticated
  USING (merchant_slug = (auth.jwt() ->> 'merchant_slug'));

-- ─── nex_social_posts ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.hammerex_nex_social_posts (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_slug       TEXT NOT NULL,
  campaign_id         UUID REFERENCES public.hammerex_nex_social_campaigns(id) ON DELETE SET NULL,
  platform            TEXT NOT NULL CHECK (platform IN ('facebook','instagram','tiktok','linkedin','google_business','whatsapp_business')),
  status              TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','awaiting_approval','approved','scheduled','publishing','published','failed','rejected')),
  headline            TEXT,
  caption             TEXT NOT NULL,
  hashtags            TEXT[] NOT NULL DEFAULT '{}',
  call_to_action      TEXT,
  image_urls          JSONB NOT NULL DEFAULT '[]'::jsonb,        -- [{ url, alt, source }]
  project_ref         TEXT,                                       -- optional external project id
  brand_snapshot_id   UUID REFERENCES public.hammerex_brand_snapshots(id) ON DELETE SET NULL,
  -- Approval + publish
  created_by          TEXT NOT NULL,                              -- 'nex' | 'merchant' | 'staff'
  approved_by         TEXT,
  approved_at         TIMESTAMPTZ,
  rejected_reason     TEXT,
  scheduled_for       TIMESTAMPTZ,                                -- UTC; UI converts to merchant TZ
  scheduled_tz        TEXT,                                       -- the tz the merchant picked ('Europe/London')
  published_at        TIMESTAMPTZ,
  platform_post_id    TEXT,                                       -- id returned by platform API
  platform_post_url   TEXT,
  publish_error       TEXT,
  publish_attempts    INTEGER NOT NULL DEFAULT 0,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_nex_posts_merchant_status
  ON public.hammerex_nex_social_posts (merchant_slug, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_nex_posts_scheduled
  ON public.hammerex_nex_social_posts (scheduled_for)
  WHERE status = 'scheduled';
CREATE INDEX IF NOT EXISTS idx_nex_posts_platform
  ON public.hammerex_nex_social_posts (platform, status);

ALTER TABLE public.hammerex_nex_social_posts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS nex_posts_owner_read ON public.hammerex_nex_social_posts;
CREATE POLICY nex_posts_owner_read
  ON public.hammerex_nex_social_posts
  FOR SELECT TO authenticated
  USING (merchant_slug = (auth.jwt() ->> 'merchant_slug'));

-- ─── nex_social_schedules ───────────────────────────────────────
-- Recurring campaigns ("every Friday 5pm"). Generates posts based on
-- pattern. One-off scheduled posts live directly on posts.scheduled_for.

CREATE TABLE IF NOT EXISTS public.hammerex_nex_social_schedules (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_slug     TEXT NOT NULL,
  campaign_id       UUID REFERENCES public.hammerex_nex_social_campaigns(id) ON DELETE CASCADE,
  platform          TEXT NOT NULL,
  pattern           TEXT NOT NULL,                               -- 'weekly:friday@17:00' | 'daily@09:00'
  timezone          TEXT NOT NULL,                               -- IANA
  status            TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused','ended')),
  next_run_at       TIMESTAMPTZ,                                 -- UTC
  last_run_at       TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_nex_schedules_next_run
  ON public.hammerex_nex_social_schedules (next_run_at)
  WHERE status = 'active';

ALTER TABLE public.hammerex_nex_social_schedules ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS nex_schedules_owner_read ON public.hammerex_nex_social_schedules;
CREATE POLICY nex_schedules_owner_read
  ON public.hammerex_nex_social_schedules
  FOR SELECT TO authenticated
  USING (merchant_slug = (auth.jwt() ->> 'merchant_slug'));

-- ─── nex_social_analytics ───────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.hammerex_nex_social_analytics (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id           UUID NOT NULL REFERENCES public.hammerex_nex_social_posts(id) ON DELETE CASCADE,
  platform          TEXT NOT NULL,
  measured_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  impressions       INTEGER NOT NULL DEFAULT 0,
  reach             INTEGER NOT NULL DEFAULT 0,
  engagements       INTEGER NOT NULL DEFAULT 0,   -- likes + comments + shares
  clicks            INTEGER NOT NULL DEFAULT 0,
  leads_generated   INTEGER NOT NULL DEFAULT 0,
  raw_json          JSONB                                        -- full platform payload
);

CREATE INDEX IF NOT EXISTS idx_nex_analytics_post
  ON public.hammerex_nex_social_analytics (post_id, measured_at DESC);

ALTER TABLE public.hammerex_nex_social_analytics ENABLE ROW LEVEL SECURITY;

-- ─── nex_social_audit_log — append-only ─────────────────────────

CREATE TABLE IF NOT EXISTS public.hammerex_nex_social_audit_log (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_slug  TEXT NOT NULL,
  actor          TEXT NOT NULL,                                  -- 'merchant:phil' | 'nex' | 'cron'
  action         TEXT NOT NULL,
  post_id        UUID REFERENCES public.hammerex_nex_social_posts(id) ON DELETE SET NULL,
  account_id     UUID REFERENCES public.hammerex_nex_social_accounts(id) ON DELETE SET NULL,
  details_json   JSONB,
  at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_nex_social_audit_recent
  ON public.hammerex_nex_social_audit_log (at DESC);
CREATE INDEX IF NOT EXISTS idx_nex_social_audit_merchant
  ON public.hammerex_nex_social_audit_log (merchant_slug, at DESC);

CREATE OR REPLACE FUNCTION public.fn_nex_social_audit_append_only()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN RAISE EXCEPTION 'hammerex_nex_social_audit_log is append-only.'; END IF;
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'hammerex_nex_social_audit_log is append-only.'; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_nex_social_audit_append_only ON public.hammerex_nex_social_audit_log;
CREATE TRIGGER trg_nex_social_audit_append_only
  BEFORE UPDATE OR DELETE ON public.hammerex_nex_social_audit_log
  FOR EACH ROW EXECUTE FUNCTION public.fn_nex_social_audit_append_only();

ALTER TABLE public.hammerex_nex_social_audit_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS nex_social_audit_owner_read ON public.hammerex_nex_social_audit_log;
CREATE POLICY nex_social_audit_owner_read
  ON public.hammerex_nex_social_audit_log
  FOR SELECT TO authenticated
  USING (merchant_slug = (auth.jwt() ->> 'merchant_slug'));

-- ─── Comments ────────────────────────────────────────────────────
COMMENT ON TABLE public.hammerex_nex_social_accounts IS
  'One row per (merchant, platform). access_token_enc holds encrypted access token — service role only.';
COMMENT ON TABLE public.hammerex_nex_social_posts IS
  'The state machine: draft → awaiting_approval → approved → scheduled → publishing → published/failed. Never auto-publishes unless merchant.auto_publish_enabled=true.';
COMMENT ON TABLE public.hammerex_nex_social_audit_log IS
  'Append-only. Every state transition + publish + connect action lands here.';
