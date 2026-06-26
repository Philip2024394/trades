-- Xrated Trades — custom app-page hero banner.
-- Annual paid members can upload their own hero banner image; everyone
-- else falls back to the per-trade default rendered from a static map.
alter table public.hammerex_trade_off_listings
  add column if not exists custom_app_hero_url text;
