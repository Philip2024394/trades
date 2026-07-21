-- Admin suspension columns · homeowners + merchants/trades.
-- Phase 2.1 · 2.2 of the engine-first roadmap.
--
-- Orthogonal to existing status columns — a merchant can be status='live'
-- (their subscription is valid) but suspended_at set (admin has blocked
-- them for a policy violation). Both must be null for user to be fully
-- active.
--
-- Non-destructive: suspending doesn't delete anything (Rule 3). Unsuspend
-- clears the columns. Audit log captures who + when + why.

ALTER TABLE public.hammerex_homeowners
  ADD COLUMN IF NOT EXISTS suspended_at     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS suspended_reason TEXT;

ALTER TABLE public.hammerex_trade_off_listings
  ADD COLUMN IF NOT EXISTS suspended_at     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS suspended_reason TEXT;

-- Hot-path index: "show me every currently-suspended user"
CREATE INDEX IF NOT EXISTS idx_homeowners_suspended
  ON public.hammerex_homeowners (suspended_at DESC)
  WHERE suspended_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_listings_suspended
  ON public.hammerex_trade_off_listings (suspended_at DESC)
  WHERE suspended_at IS NOT NULL;
