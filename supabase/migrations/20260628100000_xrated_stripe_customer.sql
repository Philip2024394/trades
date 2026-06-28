-- Xrated Trades — Stripe customer + subscription tracking.
--
-- The Stripe webhook (src/app/api/stripe/webhook/route.ts) stamps
-- `stripe_customer_id` and `stripe_subscription_id` onto the listing
-- row on `checkout.session.completed`. The customer ID is the key the
-- `/api/stripe/portal` endpoint uses to mint a Billing Portal session
-- so the tradesperson can self-manage their subscription (update card,
-- cancel, swap plan) without going through admin / WhatsApp.
--
-- Both columns are nullable — pre-Stripe rows and free-tier listings
-- never get one. Lookups join through the listing's edit_token check
-- in the portal route, so we don't need an index for performance, but
-- a partial unique index on stripe_customer_id keeps one-listing-per-
-- customer enforced (a tradie can't accidentally end up with two
-- listings sharing the same Stripe customer).

ALTER TABLE public.hammerex_trade_off_listings
  ADD COLUMN IF NOT EXISTS stripe_customer_id text,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id text;

CREATE UNIQUE INDEX IF NOT EXISTS hammerex_trade_off_listings_stripe_customer_uniq
  ON public.hammerex_trade_off_listings (stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;
