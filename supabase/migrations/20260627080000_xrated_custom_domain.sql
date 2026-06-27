-- Xrated Trades — Custom Domain add-on (£5/mo).
--
-- Lets a tradesperson point their own domain (joeplumberleeds.co.uk) at
-- their Xrated profile. We always attach BOTH apex + www and 301 www to
-- apex so the customer-facing setup is "type your domain, press connect".
--
-- All issuance + verification work is driven through Vercel's Domains API
-- (see src/lib/vercelDomains.ts). Vercel handles the Let's Encrypt cert
-- so we never touch a private key. A 6-hour cron pings the Domains API
-- for each `live` row to catch silent breakage (DNS changes at the
-- registrar, expired domain, propagation problems).
--
-- Lookup hot path: middleware.ts reads `host` on every non-system
-- request, so we add a partial UNIQUE index that only includes 'live'
-- rows. That keeps the index tiny (most listings have no custom domain)
-- and makes the route fast.
--
-- Tables introduced:
-- 1. New columns on hammerex_trade_off_listings (custom_domain_* set).
-- 2. hammerex_custom_domain_events — append-only audit table.

ALTER TABLE hammerex_trade_off_listings
  ADD COLUMN IF NOT EXISTS custom_domain text UNIQUE,
  ADD COLUMN IF NOT EXISTS custom_domain_apex text,
  ADD COLUMN IF NOT EXISTS custom_domain_status text
    DEFAULT 'pending'
    CHECK (custom_domain_status IN
      ('pending','dns_pending','verifying','live','ssl_failed',
       'dns_lost','expired','disconnected','blocked')),
  ADD COLUMN IF NOT EXISTS custom_domain_verification jsonb,
  ADD COLUMN IF NOT EXISTS custom_domain_vercel_id text,
  ADD COLUMN IF NOT EXISTS custom_domain_added_at timestamptz,
  ADD COLUMN IF NOT EXISTS custom_domain_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS custom_domain_ssl_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS custom_domain_last_check_at timestamptz,
  ADD COLUMN IF NOT EXISTS custom_domain_last_error text,
  ADD COLUMN IF NOT EXISTS custom_domain_failure_count int DEFAULT 0,
  ADD COLUMN IF NOT EXISTS custom_domain_addon_active boolean DEFAULT false;

-- Hot path lookup for the middleware host-router.
CREATE INDEX IF NOT EXISTS hammerex_listings_custom_domain_lookup
  ON hammerex_trade_off_listings (custom_domain)
  WHERE custom_domain_status = 'live';

-- Append-only audit table. Every state transition + every Vercel API
-- response that changes domain status writes a row here so admin can
-- debug "why is joeplumberleeds.co.uk stuck on dns_pending?".
CREATE TABLE IF NOT EXISTS hammerex_custom_domain_events (
  id bigserial PRIMARY KEY,
  listing_id uuid REFERENCES hammerex_trade_off_listings(id) ON DELETE CASCADE,
  domain text NOT NULL,
  event_type text NOT NULL,
  payload jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS hammerex_custom_domain_events_listing_idx
  ON hammerex_custom_domain_events (listing_id, created_at DESC);
