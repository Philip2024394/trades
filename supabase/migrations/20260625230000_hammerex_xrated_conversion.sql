-- Xrated Trades — conversion mechanics (WhatsApp-click counter, upgrade nudge state).
--
-- Adds three columns to hammerex_trade_off_listings:
--   * whatsapp_click_count       — running tally of /api/trade-off/track-whatsapp-click hits.
--   * last_whatsapp_click_at     — timestamp of the most recent click; informs cooldowns.
--   * upgrade_nudge_dismissed_at — last time the trial tradie dismissed the "leads" nudge
--                                  modal; re-arms after 7 days.
--
-- All best-effort tracking — never blocks the customer's WhatsApp jump-out.

alter table public.hammerex_trade_off_listings
  add column if not exists whatsapp_click_count integer not null default 0,
  add column if not exists last_whatsapp_click_at timestamptz,
  add column if not exists upgrade_nudge_dismissed_at timestamptz;
