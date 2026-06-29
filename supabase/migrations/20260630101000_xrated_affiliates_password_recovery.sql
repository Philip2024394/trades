-- Xrated Trades — Affiliate Programme Phase 2.
-- Adds password-recovery columns to hammerex_affiliates so we can
-- automate the "I forgot my password" flow, mirroring the tradesperson
-- pattern in hammerex_trade_off_listings.
--
--   password_recovery_token        8-char one-time code minted by
--                                  /api/affiliates/forgot-password
--   password_recovery_expires_at   24h expiry on the code
--   password_recovery_requested_at queue surface — set when affiliate
--                                  hits forgot-password
--   password_recovery_sent_at      queue-snooping guard — code is only
--                                  redeemable AFTER admin sends it
--                                  (or, when email is on file, the
--                                  Resend send is what stamps this)
--
-- Same guard model as the tradesperson side: a code that the admin
-- minted but hasn't delivered shouldn't unlock the account if a queue
-- viewer copies it out of the admin page.
alter table public.hammerex_affiliates
  add column if not exists password_recovery_token text,
  add column if not exists password_recovery_expires_at timestamptz,
  add column if not exists password_recovery_requested_at timestamptz,
  add column if not exists password_recovery_sent_at timestamptz;

create index if not exists hammerex_affiliates_password_recovery_pending_idx
  on public.hammerex_affiliates (password_recovery_requested_at)
  where password_recovery_requested_at is not null
    and password_recovery_sent_at is null;
