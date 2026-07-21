-- The Site — image commerce plan (2026-07-22).
--
-- Two tables backing the single-image + monthly-unlimited money-in
-- path for The Site (ex-/store, folded into /trade-off/search).
--
-- Product shape (Philip 2026-07-22):
--   Single:  £5.99 one-off per image (Stripe payment mode)
--   Sub:     £14.99 / mo unlimited (Stripe subscription mode)
--   Bundled: free inside Merchant Pro (£14.99) + Works (£39.99) tiers
--
-- Access rule (see src/lib/siteAccess.ts):
--   Clean download OK iff purchase row exists OR active sub OR merchant
--   sits on a bundling tier. Otherwise → watermarked preview only.

-- =====================================================================
-- hammerex_site_purchases — single-image purchase ledger
-- =====================================================================
-- One row per successful £5.99 checkout. Immutable — refunds append a
-- new row with amount_pence set to a negative delta (running spend =
-- SUM(amount_pence) per (buyer_email, image_id)). Grants perpetual
-- clean-download rights on the referenced image_id.
CREATE TABLE IF NOT EXISTS public.hammerex_site_purchases (
  id                     UUID          PRIMARY KEY DEFAULT gen_random_uuid(),

  -- image_id = the slug from hammerex_feed_tile_library. Not a FK
  -- because we may later archive images without invalidating past
  -- purchases (buyer keeps their licence even if the image is retired).
  image_id               TEXT          NOT NULL,

  buyer_email            TEXT          NOT NULL,
  -- Optional — set when the checkout was initiated by a logged-in
  -- merchant (network_merchant_slug). Lets the UI show
  -- "purchased" state without an email lookup.
  buyer_merchant_slug    TEXT,

  amount_pence           INTEGER       NOT NULL DEFAULT 599,
  currency               TEXT          NOT NULL DEFAULT 'gbp',

  stripe_session_id      TEXT          NOT NULL,
  stripe_payment_intent  TEXT,
  status                 TEXT          NOT NULL DEFAULT 'paid',        -- 'paid' | 'refunded'

  purchased_at           TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

  -- One row per Stripe session. Guards against webhook double-fire.
  CONSTRAINT hammerex_site_purchases_stripe_session_unique
    UNIQUE (stripe_session_id)
);

CREATE INDEX IF NOT EXISTS idx_hammerex_site_purchases_buyer_email
  ON public.hammerex_site_purchases (buyer_email);
CREATE INDEX IF NOT EXISTS idx_hammerex_site_purchases_buyer_merchant
  ON public.hammerex_site_purchases (buyer_merchant_slug)
  WHERE buyer_merchant_slug IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_hammerex_site_purchases_image
  ON public.hammerex_site_purchases (image_id);

ALTER TABLE public.hammerex_site_purchases ENABLE ROW LEVEL SECURITY;

-- =====================================================================
-- hammerex_site_subscriptions — £14.99/mo unlimited access
-- =====================================================================
-- One active row per merchant. Stripe is the source of truth; this
-- table is a projection kept in sync by the webhook. Access checks read
-- (status IN ('active','trialing') AND current_period_end > NOW()).
CREATE TABLE IF NOT EXISTS public.hammerex_site_subscriptions (
  id                     UUID          PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identity: prefer merchant_slug (logged-in trade), fall back to
  -- buyer_email (anonymous / homeowner sub). Exactly one non-null.
  merchant_slug          TEXT,
  buyer_email            TEXT,

  stripe_customer_id     TEXT          NOT NULL,
  stripe_subscription_id TEXT          NOT NULL,
  status                 TEXT          NOT NULL,                        -- 'active' | 'trialing' | 'past_due' | 'canceled' | 'unpaid'

  current_period_start   TIMESTAMPTZ   NOT NULL,
  current_period_end     TIMESTAMPTZ   NOT NULL,
  cancel_at_period_end   BOOLEAN       NOT NULL DEFAULT FALSE,

  created_at             TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

  CONSTRAINT hammerex_site_subs_stripe_sub_unique UNIQUE (stripe_subscription_id),
  CONSTRAINT hammerex_site_subs_identity_check CHECK (
    merchant_slug IS NOT NULL OR buyer_email IS NOT NULL
  )
);

CREATE INDEX IF NOT EXISTS idx_hammerex_site_subs_merchant
  ON public.hammerex_site_subscriptions (merchant_slug)
  WHERE merchant_slug IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_hammerex_site_subs_email
  ON public.hammerex_site_subscriptions (buyer_email)
  WHERE buyer_email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_hammerex_site_subs_status
  ON public.hammerex_site_subscriptions (status, current_period_end);

ALTER TABLE public.hammerex_site_subscriptions ENABLE ROW LEVEL SECURITY;
