-- Xrated Trades — Quote Pipeline add-on (£5/mo).
--
-- Minimal CRM table for tradies who track quote outcomes (sent → chasing
-- → accepted / lost). All handoffs continue via WhatsApp so we keep this
-- table free of message bodies and attachments — just the lead-tracking
-- ledger row. Type: HammerexXratedQuote in src/lib/supabase.ts:738-754.
--
-- Routes that read/write:
--   POST  /api/trade-off/quotes               (route.ts)
--   GET   /api/trade-off/quotes
--   PATCH /api/trade-off/quotes/:id           ([id]/route.ts)
--   DELETE /api/trade-off/quotes/:id
--
-- listing_id is a plain uuid column (no FK constraint) so this migration
-- is safe even on schemas where hammerex_trade_off_listings is not yet
-- present (Hammerex side may own that table). The consuming code
-- authorises via the listing's edit_token.

CREATE TABLE IF NOT EXISTS public.hammerex_xrated_quotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL,
  customer_name text NOT NULL,
  customer_phone text,
  customer_email text,
  service_name text,
  quote_amount_pence integer,
  status text NOT NULL DEFAULT 'sent'
    CHECK (status IN ('sent','chasing','accepted','lost')),
  follow_up_at date,
  notes text,
  lost_reason text,
  won_at timestamptz,
  lost_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS hammerex_xrated_quotes_listing_idx
  ON public.hammerex_xrated_quotes (listing_id, status, updated_at DESC);
