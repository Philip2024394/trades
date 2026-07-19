-- Reveal credits for the SiteBook WhatsApp reveal pricing model
-- (2026-07-18). Every unique (post, trade) conversation counts as
-- one "reveal" — the moment the homeowner reaches out via WhatsApp
-- for the first time on a topic. Subsequent messages on the SAME
-- thread are FREE (no per-message charge). Composition + recording
-- inside SiteBook is FREE for everyone (no cost to us, high value).
--
-- Pricing model (see docs/pricing/sitebook-reveals.md for detail):
--   Free tier:            3 reveals / calendar month
--   Pro (£4.99/mo):      30 reveals / calendar month
--   Pack purchases:       5/10/20/50/100 lifetime credits — never expire
--
-- Consumption order:
--   1. Deduct from monthly free/Pro quota first (soft, resets monthly)
--   2. Fall back to purchased pack credits (permanent balance)
--   3. If both zero → return quota-exceeded error
--
-- Monthly reset happens lazily on first check-in of a new period,
-- keyed off reveal_period_start (whichever calendar month it's in).

ALTER TABLE public.hammerex_homeowners
  ADD COLUMN IF NOT EXISTS reveal_period_start          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS reveal_credits_used_period   INTEGER     NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reveal_credits_purchased     INTEGER     NOT NULL DEFAULT 0;

-- Index on period_start speeds up the lazy monthly-reset check on
-- every wa-messages call. Cheap and useful.
CREATE INDEX IF NOT EXISTS idx_hammerex_homeowners_reveal_period
  ON public.hammerex_homeowners (reveal_period_start);

-- =====================================================================
-- hammerex_homeowner_reveal_purchases — pack purchase audit log
-- =====================================================================
-- Every pack purchase (once Stripe checkout ships) writes a row here
-- and increments the homeowner's reveal_credits_purchased balance.
-- Immutable ledger — refunds are recorded as a new row with negative
-- credits_added, so the running total is always
-- SUM(credits_added).
CREATE TABLE IF NOT EXISTS public.hammerex_homeowner_reveal_purchases (
  id                    UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  homeowner_id          UUID          NOT NULL REFERENCES public.hammerex_homeowners(id) ON DELETE CASCADE,

  pack_size             INTEGER       NOT NULL,                     -- 5, 10, 20, 50, 100
  credits_added         INTEGER       NOT NULL,                     -- +ve on purchase, -ve on refund
  amount_gbp_pence      INTEGER       NOT NULL,                     -- retail price in pence (VAT-incl)
  currency              TEXT          NOT NULL DEFAULT 'GBP',

  stripe_session_id     TEXT,
  stripe_payment_intent TEXT,
  paddle_transaction_id TEXT,                                        -- if we switch to MoR
  status                TEXT          NOT NULL DEFAULT 'pending',   -- 'pending' | 'paid' | 'refunded' | 'failed'

  note                  TEXT,
  created_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  paid_at               TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_reveal_purchases_homeowner
  ON public.hammerex_homeowner_reveal_purchases (homeowner_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_reveal_purchases_status
  ON public.hammerex_homeowner_reveal_purchases (status);

ALTER TABLE public.hammerex_homeowner_reveal_purchases ENABLE ROW LEVEL SECURITY;
