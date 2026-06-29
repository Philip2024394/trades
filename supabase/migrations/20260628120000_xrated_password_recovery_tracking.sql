-- Xrated Trades — admin password-recovery queue tracking.
-- Adds two timestamps:
--   password_recovery_requested_at   set by /api/trade-off/forgot-password
--                                    whenever a tradesperson hits the
--                                    "forgot password" flow. Surfaces the
--                                    row in the admin queue.
--   password_recovery_sent_at        set by /api/admin/password-recovery/sent
--                                    when the admin opens the WhatsApp
--                                    composer to deliver the link. Used as
--                                    the queue-snooping guard — the
--                                    recovery_code can only be redeemed
--                                    AFTER this timestamp is set.
--
-- Partial index keeps the pending queue cheap to list.
alter table public.hammerex_trade_off_listings
  add column if not exists password_recovery_requested_at timestamptz,
  add column if not exists password_recovery_sent_at timestamptz;

create index if not exists idx_password_recovery_pending
  on public.hammerex_trade_off_listings (password_recovery_requested_at)
  where password_recovery_requested_at is not null
    and password_recovery_sent_at is null;
