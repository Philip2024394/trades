-- Trade Notebook — richer delivery address on quote requests.
--
-- Previously a quote request stored just a single `delivery_address`
-- string. Trades need structured detail so merchants can route
-- properly: receiver name, delivery notes (site directions), and
-- lat/lng when the trade uses their device GPS.

BEGIN;

ALTER TABLE app_notebook_quote_requests
  ADD COLUMN IF NOT EXISTS delivery_receiver_name text,
  ADD COLUMN IF NOT EXISTS delivery_notes         text,
  ADD COLUMN IF NOT EXISTS delivery_postcode      text,
  ADD COLUMN IF NOT EXISTS delivery_lat           numeric(9,6),
  ADD COLUMN IF NOT EXISTS delivery_lng           numeric(9,6);

COMMIT;
