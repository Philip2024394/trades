-- Xrated Trades — phone + password authentication for tradespeople.
-- Adds:
--   password_hash                 bcrypt hash (null = legacy user, must
--                                 use /trade-off/set-password + their
--                                 existing edit_token to set one).
--   password_recovery_token       8-char one-time code minted by the
--                                 forgot-password flow.
--   password_recovery_expires_at  expiry for the recovery token.
--
-- We keep the existing edit_token primitive untouched — it remains the
-- write-auth token for the 99 API routes and also serves as the magic
-- link / recovery anchor used during set-password.
alter table public.hammerex_trade_off_listings
  add column if not exists password_hash text,
  add column if not exists password_recovery_token text,
  add column if not exists password_recovery_expires_at timestamptz;

create index if not exists hammerex_trade_off_listings_whatsapp_idx
  on public.hammerex_trade_off_listings (whatsapp);
