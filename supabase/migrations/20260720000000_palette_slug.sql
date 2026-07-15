-- Adds palette_slug column to hammerex_trade_off_listings so merchants
-- can pick their canteen color pack independently of the layout template.
--
-- Palette catalogue lives in src/lib/paletteTokens.ts. Defaults to
-- 'chalk' (offwhite/cream) — matches the existing look for every
-- listing that hasn't chosen otherwise. Merchants can toggle to any
-- palette (e.g. 'iron' for dark theme) at any time via the picker.

alter table hammerex_trade_off_listings
  add column if not exists palette_slug text default 'chalk';

comment on column hammerex_trade_off_listings.palette_slug is
  'Merchant color pack slug (chalk / iron / oak / moss / slate / mortar / hi-vis / brick). Catalogue: src/lib/paletteTokens.ts.';
