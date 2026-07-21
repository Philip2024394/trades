-- Merchant timezone — used to render scheduled-post times in the
-- merchant's local clock. Defaults to Europe/London (matches the
-- UK-first launch). Value is an IANA tz identifier (e.g.
-- "Europe/London", "America/New_York") — validated client-side
-- against the browser's Intl.DateTimeFormat resolvedOptions().
ALTER TABLE public.hammerex_trade_off_listings
  ADD COLUMN IF NOT EXISTS timezone TEXT NOT NULL DEFAULT 'Europe/London';
