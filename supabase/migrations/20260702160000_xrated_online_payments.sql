-- Online Payments add-on — phase 1 foundation.
--
-- Model: marketplace / connected-account pattern. Funds NEVER touch
-- xratedtrade.com. Each merchant connects their OWN payment account
-- (Stripe Connect, PayPal Partner, Square OAuth) OR pastes a hosted
-- payment-link template (covers 100% of UK providers — Worldpay, SumUp,
-- Klarna, Mollie, Revolut Business, Tide, etc. without native APIs).
--
-- Phase 1 ships:
--   - payment_provider + payment_provider_data + payment_link_template
--     columns on the listing
--   - hammerex_xrated_orders ledger so merchants see paid orders
--   - Payment-Link mode WORKING end-to-end (no API keys required)
--
-- Phases 2-5 layer native OAuth on top for Stripe, PayPal, Square (and
-- direct integrations for GoCardless / Klarna later) — those just
-- populate payment_provider_data on the same row, no schema change.

ALTER TABLE hammerex_trade_off_listings
  ADD COLUMN IF NOT EXISTS payment_provider text;

ALTER TABLE hammerex_trade_off_listings
  DROP CONSTRAINT IF EXISTS chk_payment_provider;
ALTER TABLE hammerex_trade_off_listings
  ADD CONSTRAINT chk_payment_provider
  CHECK (payment_provider IS NULL OR payment_provider IN
    ('stripe', 'paypal', 'square', 'payment_link'));

ALTER TABLE hammerex_trade_off_listings
  ADD COLUMN IF NOT EXISTS payment_provider_data jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Payment Link mode — the merchant pastes a hosted-pay URL template.
-- We append {{amount}} and {{ref}} placeholders at checkout time.
-- Example template: https://pay.sumup.com/b2c/MERCHANT_CODE?amount={{amount}}&description={{ref}}
ALTER TABLE hammerex_trade_off_listings
  ADD COLUMN IF NOT EXISTS payment_link_template text;

ALTER TABLE hammerex_trade_off_listings
  ADD COLUMN IF NOT EXISTS payment_link_provider_name text;

-- Orders ledger. Populated when a customer initiates checkout; updated
-- to 'paid' on webhook (native providers) or on success_url return
-- (Payment Link mode — assumed-paid because we never see the actual
-- payment confirmation in link-mode).
CREATE TABLE IF NOT EXISTS hammerex_xrated_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES hammerex_trade_off_listings(id) ON DELETE CASCADE,
  order_ref text NOT NULL,
  amount_pence integer NOT NULL CHECK (amount_pence >= 0),
  currency text NOT NULL DEFAULT 'GBP',
  provider text NOT NULL CHECK (provider IN ('stripe', 'paypal', 'square', 'payment_link')),
  provider_session_id text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'failed', 'refunded', 'cancelled')),
  customer_email text,
  customer_name text,
  customer_whatsapp text,
  cart_items jsonb NOT NULL DEFAULT '[]'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  paid_at timestamptz,
  cancelled_at timestamptz
);

CREATE INDEX IF NOT EXISTS hammerex_xrated_orders_listing_idx
  ON hammerex_xrated_orders(listing_id, created_at DESC);

CREATE INDEX IF NOT EXISTS hammerex_xrated_orders_status_idx
  ON hammerex_xrated_orders(status, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS hammerex_xrated_orders_ref_idx
  ON hammerex_xrated_orders(listing_id, order_ref);

COMMENT ON COLUMN hammerex_trade_off_listings.payment_provider IS
  'Which payment provider the merchant has connected. NULL = no online payments. Values: stripe | paypal | square | payment_link';
COMMENT ON COLUMN hammerex_trade_off_listings.payment_provider_data IS
  'Provider-specific blob. Stripe: { stripe_account_id, status, connected_at }. PayPal: { paypal_merchant_id, partner_id }. Square: { square_merchant_id, location_id, expires_at }.';
COMMENT ON COLUMN hammerex_trade_off_listings.payment_link_template IS
  'Hosted payment-link URL template for Payment Link mode. Supports {{amount}} (pence as integer or pounds with decimal — caller decides) and {{ref}} placeholders. Empty = Payment Link mode not configured.';
