-- Merchant assets — free print collateral system.
--
-- Site posters · Google-review posters · Business-card packs.
-- Each merchant generates 1 asset per WhatsApp number, refreshed
-- every 30 days. QR scans + download opt-ins get logged for the
-- merchant's own analytics (Pro tier) and the platform admin.
--
-- Monetisation:
--   1. Remove "Powered by The Networkers" footer — £2.99 one-off
--   2. Instant refresh (skip 30-day cooldown)                     — £1.99
--   3. Pro tier gates the scan analytics chart
--   4. Every scan/download that happens is a new lead opportunity
--
-- Additionally: fixes the custom_domain trial leak — the add-on
-- was documented "free 30d then charge" but had no enforcement.
-- New column stores the trial end so nightly cron can act.

-- ─── Merchant asset (site poster / review poster / business card) ─
CREATE TABLE IF NOT EXISTS public.hammerex_merchant_assets (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_slug            TEXT NOT NULL,
  -- 'site_poster' | 'google_review' | 'business_card'
  kind                     TEXT NOT NULL,
  -- Which of the ~6 template layouts (v1_bold / v2_photo / etc)
  template_slug            TEXT NOT NULL,
  -- Merchant-authored headline shown on the poster
  headline                 TEXT,
  -- Rolling refresh counter — 1 = first ever, incremented every
  -- time the merchant refreshes (max 1 per 30 days on Free tier
  -- unless they've paid instant_refresh_paid_at).
  refresh_number           INTEGER NOT NULL DEFAULT 1,
  -- When they generated this version — used to enforce the 30-day
  -- cooldown for the next free refresh.
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- When they can next refresh for free (created_at + 30 days).
  next_free_refresh_at     TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 days'),
  -- £2.99 unlock — hides the "Powered by The Networkers" footer.
  -- Per-asset (not per-merchant) so upgrading one asset doesn't
  -- retroactively unlock the rest.
  footer_removed_paid_at   TIMESTAMPTZ,
  -- £1.99 unlock — skips the 30-day cooldown once. Cleared once
  -- consumed on the next refresh.
  instant_refresh_paid_at  TIMESTAMPTZ,
  -- Tally counters (kept in sync by insert triggers on the two
  -- child tables below — avoids per-page-view COUNT() queries).
  scan_count               INTEGER NOT NULL DEFAULT 0,
  download_count           INTEGER NOT NULL DEFAULT 0,
  share_count              INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_merchant_assets_slug_kind
  ON public.hammerex_merchant_assets (merchant_slug, kind, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_merchant_assets_refresh
  ON public.hammerex_merchant_assets (merchant_slug, next_free_refresh_at);

-- ─── Every QR scan — one row per scan ────────────────────────
CREATE TABLE IF NOT EXISTS public.hammerex_merchant_asset_scans (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id       UUID NOT NULL REFERENCES public.hammerex_merchant_assets(id) ON DELETE CASCADE,
  merchant_slug  TEXT NOT NULL,   -- denormalised for cheap admin queries
  scanned_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  user_agent     TEXT,
  referer        TEXT,
  -- IP hashed (SHA-256) — never store raw IP for GDPR
  ip_hash        TEXT,
  -- Coarse geo from CF-IPCountry header — used for "scanned from
  -- Manchester today" heatmap on the merchant analytics view
  country_code   TEXT,
  city           TEXT
);

CREATE INDEX IF NOT EXISTS idx_asset_scans_asset_recent
  ON public.hammerex_merchant_asset_scans (asset_id, scanned_at DESC);

CREATE INDEX IF NOT EXISTS idx_asset_scans_merchant_recent
  ON public.hammerex_merchant_asset_scans (merchant_slug, scanned_at DESC);

-- ─── Every download opt-in — one row per download ────────────
-- Merchant enters a WhatsApp number to unlock the PDF download.
-- Also serves as the sign-up magnet — new WhatsApp numbers seen
-- here that don't have a listing get funneled into the join flow.
CREATE TABLE IF NOT EXISTS public.hammerex_merchant_asset_downloads (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id          UUID NOT NULL REFERENCES public.hammerex_merchant_assets(id) ON DELETE CASCADE,
  merchant_slug     TEXT NOT NULL,   -- denormalised
  downloaded_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  downloaded_by_wa  TEXT,           -- WhatsApp number (raw digits, +CC)
  downloaded_by_email TEXT,
  ip_hash           TEXT,
  user_agent        TEXT,
  -- 'pdf' | 'png' | 'svg' — merchants may re-download at different
  -- print sizes (A3, A2, A5 pocket)
  format            TEXT NOT NULL DEFAULT 'pdf',
  -- Filled by the funnel: 'converted' if the WA number ended up
  -- creating a merchant listing within 30 days of downloading
  became_merchant_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_asset_downloads_asset
  ON public.hammerex_merchant_asset_downloads (asset_id, downloaded_at DESC);

CREATE INDEX IF NOT EXISTS idx_asset_downloads_wa
  ON public.hammerex_merchant_asset_downloads (downloaded_by_wa)
  WHERE downloaded_by_wa IS NOT NULL;

-- Counter-sync triggers (keep hammerex_merchant_assets.scan_count
-- + download_count fresh so the merchant dashboard reads one row).
CREATE OR REPLACE FUNCTION public.fn_increment_asset_scan()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.hammerex_merchant_assets
     SET scan_count = scan_count + 1
   WHERE id = NEW.asset_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_asset_scan_increment ON public.hammerex_merchant_asset_scans;
CREATE TRIGGER trg_asset_scan_increment
  AFTER INSERT ON public.hammerex_merchant_asset_scans
  FOR EACH ROW EXECUTE FUNCTION public.fn_increment_asset_scan();

CREATE OR REPLACE FUNCTION public.fn_increment_asset_download()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.hammerex_merchant_assets
     SET download_count = download_count + 1
   WHERE id = NEW.asset_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_asset_download_increment ON public.hammerex_merchant_asset_downloads;
CREATE TRIGGER trg_asset_download_increment
  AFTER INSERT ON public.hammerex_merchant_asset_downloads
  FOR EACH ROW EXECUTE FUNCTION public.fn_increment_asset_download();

ALTER TABLE public.hammerex_merchant_assets            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hammerex_merchant_asset_scans       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hammerex_merchant_asset_downloads   ENABLE ROW LEVEL SECURITY;

-- ─── custom_domain trial leak fix ────────────────────────────
-- The add-on advertised "free first 30 days, then charge" but had
-- no enforcement — merchants were silently getting £5/mo free
-- forever. Track the trial end so the nightly cron can act.
ALTER TABLE public.hammerex_trade_off_listings
  ADD COLUMN IF NOT EXISTS custom_domain_trial_ends_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS custom_domain_billing_state TEXT NOT NULL DEFAULT 'none';
-- billing_state:
--   'none'    — no custom domain requested
--   'trial'   — active trial (trial_ends_at in the future)
--   'active'  — paid via Stripe subscription
--   'lapsed'  — trial ended, no payment, add-on disabled by cron

-- ─── Featured-slot auction — weekly Trade Center slot bids ───
-- Non-Business tiers can bid for a 7-day featured placement in the
-- Trade Center. Highest bid wins the coming week (auction closes
-- Sunday midnight, winner charged Monday, slot runs Mon-Sun).
CREATE TABLE IF NOT EXISTS public.hammerex_featured_slot_bids (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_slug      TEXT NOT NULL,
  week_starting      DATE NOT NULL,   -- Monday of the target week
  bid_amount_pence   INTEGER NOT NULL,
  stripe_session_id  TEXT,             -- present once merchant pays
  paid_at            TIMESTAMPTZ,
  status             TEXT NOT NULL DEFAULT 'pending',
  -- 'pending' | 'winner' | 'outbid' | 'expired'
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (merchant_slug, week_starting)
);

CREATE INDEX IF NOT EXISTS idx_slot_bids_week
  ON public.hammerex_featured_slot_bids (week_starting, bid_amount_pence DESC);

ALTER TABLE public.hammerex_featured_slot_bids ENABLE ROW LEVEL SECURITY;
