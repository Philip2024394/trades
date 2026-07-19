-- Shadow-profile scraper system (2026-07-18).
--
-- Backs the /admin/growth/shadow-profiles dashboard + the 3 crons:
--   /api/cron/shadow-profile-scrape  (nightly)
--   /api/cron/shadow-profile-send    (every 15 min)
--   /api/cron/shadow-profile-suppress (daily + realtime webhook)
--
-- Model: scraper pulls public UK trade businesses (Companies House SIC
-- codes 43xxx), pre-generates unpublished shadow profiles with a
-- reserved slug, and drips a 6-touch email sequence over 21 days.
-- Merchant clicks a claim link → verifies WhatsApp → shadow profile
-- flips to live in hammerex_trade_off_listings.
--
-- Legal posture: PECR B2B soft opt-in + UK GDPR public-data lawful
-- basis. Shadow profiles are noindex/unpublished until claimed —
-- avoids "you published stuff about me without asking" complaints.
-- Every email carries an unsubscribe link routed to the suppression
-- table below.

-- =====================================================================
-- hammerex_shadow_merchants — the pre-scraped profile queue
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.hammerex_shadow_merchants (
  id                       UUID          PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identity + source
  source                   TEXT          NOT NULL,                    -- 'companies_house' | 'google_places' | 'yell' | 'cylex' | 'manual'
  source_ref               TEXT,                                       -- e.g. Companies House registration number, Google Place ID
  scraped_at               TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

  -- Business data (scraped)
  business_name            TEXT          NOT NULL,
  trade_type               TEXT,                                       -- normalised slug e.g. 'plumber' 'roofer' 'electrician'
  trade_type_raw           TEXT,                                       -- source's raw string
  city                     TEXT,
  postcode                 TEXT,
  address_line             TEXT,
  phone                    TEXT,
  email                    TEXT,                                       -- corporate email — info@ hello@ contact@
  website                  TEXT,
  companies_house_number   TEXT,                                       -- if scraped from CH
  gbp_place_id             TEXT,                                       -- if enriched via Google Places
  gbp_star_rating          NUMERIC(2,1),
  gbp_review_count         INTEGER,
  years_established        INTEGER,

  -- Reserved slug — becomes their live URL on claim
  reserved_slug            TEXT          NOT NULL UNIQUE,

  -- Lifecycle
  status                   TEXT          NOT NULL DEFAULT 'scraped',   -- 'scraped' | 'queued' | 'sending' | 'claimed' | 'suppressed' | 'released'
  claim_token              TEXT          UNIQUE,                       -- opaque token for /claim/[token] landing
  claimed_at               TIMESTAMPTZ,
  claimed_listing_id       UUID,                                       -- FK-ish to hammerex_trade_off_listings.id on claim
  released_at              TIMESTAMPTZ,                                -- if slug returned to pool

  -- Drip sequence state
  next_step_index          INTEGER       NOT NULL DEFAULT 0,           -- 0..5 across the 6-step sequence
  next_step_due_at         TIMESTAMPTZ,                                -- when the next email is eligible to send
  last_step_sent_at        TIMESTAMPTZ,

  -- Bookkeeping
  created_at               TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_shadow_merchants_status         ON public.hammerex_shadow_merchants (status);
CREATE INDEX IF NOT EXISTS idx_shadow_merchants_next_due       ON public.hammerex_shadow_merchants (next_step_due_at) WHERE status IN ('queued','sending');
CREATE INDEX IF NOT EXISTS idx_shadow_merchants_source_ref     ON public.hammerex_shadow_merchants (source, source_ref);
CREATE INDEX IF NOT EXISTS idx_shadow_merchants_email          ON public.hammerex_shadow_merchants (email);
CREATE INDEX IF NOT EXISTS idx_shadow_merchants_trade_city     ON public.hammerex_shadow_merchants (trade_type, city);
CREATE INDEX IF NOT EXISTS idx_shadow_merchants_claim_token    ON public.hammerex_shadow_merchants (claim_token) WHERE claim_token IS NOT NULL;

-- =====================================================================
-- hammerex_shadow_email_events — per-email deliverability + engagement log
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.hammerex_shadow_email_events (
  id                       UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  shadow_merchant_id       UUID          NOT NULL REFERENCES public.hammerex_shadow_merchants(id) ON DELETE CASCADE,
  step_index               INTEGER       NOT NULL,                    -- which step of the sequence (0..5)
  event_type               TEXT          NOT NULL,                    -- 'queued' | 'sent' | 'delivered' | 'open' | 'click' | 'reply' | 'bounce' | 'complaint' | 'unsubscribe'
  message_id               TEXT,                                       -- Postmark MessageID
  metadata                 JSONB,                                      -- webhook payload preserved
  created_at               TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_shadow_email_events_merchant   ON public.hammerex_shadow_email_events (shadow_merchant_id);
CREATE INDEX IF NOT EXISTS idx_shadow_email_events_type       ON public.hammerex_shadow_email_events (event_type);
CREATE INDEX IF NOT EXISTS idx_shadow_email_events_message_id ON public.hammerex_shadow_email_events (message_id) WHERE message_id IS NOT NULL;

-- =====================================================================
-- hammerex_shadow_suppression — never-email list
-- =====================================================================
-- Populated by: (a) explicit unsubscribe from an email link,
--               (b) Postmark bounce/complaint webhook,
--               (c) admin manual add.
-- Every send checks against this table first — insertion is authoritative.
CREATE TABLE IF NOT EXISTS public.hammerex_shadow_suppression (
  id                       UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  email                    TEXT          NOT NULL,
  reason                   TEXT          NOT NULL,                    -- 'unsubscribe' | 'bounce' | 'complaint' | 'admin'
  source_event_id          UUID          REFERENCES public.hammerex_shadow_email_events(id) ON DELETE SET NULL,
  suppressed_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  notes                    TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_shadow_suppression_email ON public.hammerex_shadow_suppression (LOWER(email));

-- =====================================================================
-- Row-level security — all three tables are ADMIN-ONLY (no merchant/user access)
-- =====================================================================
ALTER TABLE public.hammerex_shadow_merchants   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hammerex_shadow_email_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hammerex_shadow_suppression ENABLE ROW LEVEL SECURITY;

-- No public policies — service role only.
-- (supabaseAdmin bypasses RLS; anon key sees nothing.)

-- =====================================================================
-- Auto-update updated_at on shadow_merchants
-- =====================================================================
CREATE OR REPLACE FUNCTION public.hammerex_shadow_merchants_touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_shadow_merchants_updated_at ON public.hammerex_shadow_merchants;
CREATE TRIGGER trg_shadow_merchants_updated_at
  BEFORE UPDATE ON public.hammerex_shadow_merchants
  FOR EACH ROW
  EXECUTE FUNCTION public.hammerex_shadow_merchants_touch_updated_at();
