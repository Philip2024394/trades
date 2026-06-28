-- Xrated Trades — slug-change redirect table.
--
-- Every tradesperson can rename their vanity slug from the edit form
-- (TradeOffForm). Printed business cards, QR codes and WhatsApp shares
-- bake the OLD slug into a permanent URL, so when the slug changes the
-- shared link starts 404'ing. This migration installs a redirect table
-- that /trade/[slug]/page.tsx consults on a miss and 301-redirects to
-- the current slug.
--
-- Invariants enforced by the API at write time
-- (src/app/api/trade-off/update/route.ts):
--   1. UNIQUE(old_slug) — a given old slug always resolves to exactly
--      one current slug (the freshest known target). Re-renaming the
--      same old slug UPSERTs the new_slug.
--   2. Chain collapse — when a tradesperson renames A → B → C, every
--      row with new_slug = B is rewritten to new_slug = C so the chain
--      A → B → C collapses to A → C. This guarantees a single hop.
--   3. The currently-active slug for a listing must never appear as an
--      old_slug (otherwise the page → redirect → page loop is infinite).
--
-- Read path: /trade/[slug] looks up `old_slug = <requested slug>` and
-- 301-redirects to /trade/<new_slug> when a row is found. Permanent
-- (301) so search engines drop the dead URL.

CREATE TABLE IF NOT EXISTS hammerex_trade_off_slug_redirects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  old_slug text NOT NULL UNIQUE,
  new_slug text NOT NULL,
  listing_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_slug_redirects_old
  ON hammerex_trade_off_slug_redirects(old_slug);
