-- Trade Notebook — per-item history metadata.
--
-- Every time a notebook item lands in a submitted quote request we
-- stamp its last_quoted_at + last_quoted_price_gbp + last_quoted_merchant
-- so the card can render a "Last quoted £22 · Manchester Tools · 8 days
-- ago" chip on repeat visits.

BEGIN;

ALTER TABLE app_notebook_items
  ADD COLUMN IF NOT EXISTS last_quoted_at             timestamptz,
  ADD COLUMN IF NOT EXISTS last_quoted_price_gbp      numeric(10,2),
  ADD COLUMN IF NOT EXISTS last_quoted_merchant_slug  text,
  ADD COLUMN IF NOT EXISTS last_quoted_merchant_name  text;

COMMIT;
