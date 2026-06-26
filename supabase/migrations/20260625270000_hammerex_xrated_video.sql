-- Xrated Trades — single intro video per trade profile.
--
-- video_url       — YouTube watch / youtu.be / Shorts URL (only YouTube
--                   for now to dodge hosting bills + native player UX).
-- video_cover_url — optional custom poster shown on the small video tile
--                   in the About section. Falls back to a portfolio photo
--                   when null. Lightbox autoplays the YouTube iframe.
alter table public.hammerex_trade_off_listings
  add column if not exists video_url text,
  add column if not exists video_cover_url text;
