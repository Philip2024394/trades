-- Per-trade toggle for inbound phone calls. When false, the public
-- profile drops the Call Now block from the contact page and the
-- Business Card modal hides the tap-to-call link. WhatsApp + email
-- remain. Defaults true so existing listings preserve current behavior.
alter table public.hammerex_trade_off_listings
  add column if not exists phone_calls_enabled boolean not null default true;
