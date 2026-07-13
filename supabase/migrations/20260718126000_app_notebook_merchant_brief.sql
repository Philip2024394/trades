-- Trade Notebook — freeform merchant brief on quote requests.
--
-- Trades can add a plain-language note describing extra items they
-- don't know the exact catalog name for. Merchants know their catalog
-- and match the closest product from the description.

BEGIN;

ALTER TABLE app_notebook_quote_requests
  ADD COLUMN IF NOT EXISTS merchant_brief text;

COMMIT;
