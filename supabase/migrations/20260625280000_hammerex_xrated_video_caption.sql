-- Xrated Trades — short caption shown next to the intro video tile.
-- Used to label what the clip demonstrates (e.g. "Level 5 skim example",
-- "Full kitchen tile-over", "Before/after extension"). Kept short and
-- the editor will enforce <= 60 characters.
alter table public.hammerex_trade_off_listings
  add column if not exists video_caption text;
