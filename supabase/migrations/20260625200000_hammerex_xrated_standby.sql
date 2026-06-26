-- Xrated Trades — "Trades On Standby" feed.
-- Adds two columns to the listing row so a tradesperson can advertise
-- "ready now / start tomorrow / start next week ..." plus a headline
-- starting price for the new landing-page section.
--
-- availability: nullable text. Editor enforces the allowed values
--   (now | tomorrow | this_week | next_week | two_weeks | later) so the
--   set can grow without a CHECK migration.
-- headline_rate: nullable jsonb.
--   Shape: { amount: number, unit: text, currency: text }
--   Separate from priced_services so the tradie can pick a headline
--   rate without having to populate the full priced-services array.

alter table public.hammerex_trade_off_listings
  add column if not exists availability text,
  add column if not exists headline_rate jsonb;
