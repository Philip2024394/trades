-- "Welcome Knife" voucher table. Every tradie who completes Xrated Trades
-- signup (status='live') gets exactly one unique voucher code redeemable
-- inside any Hammerex order for a free Folding Safety Cutting Knife.
--
-- Redemption is admin-handled — Hammerex doesn't run automatic cart
-- adjustments. The buyer types the code into the checkout form, the
-- /api/quote-requests endpoint appends a structured note to the quote
-- request, and the admin manually flips the voucher to 'redeemed' from
-- /admin/xrated/vouchers when they fulfil the order. This avoids vouchers
-- being marked used on quote requests that never get paid.
--
-- Public can't read this table directly; service-role only.

create table if not exists public.hammerex_xrated_vouchers (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.hammerex_trade_off_listings(id) on delete cascade,
  code text not null unique,
  product_slug text not null default 'folding-safety-cutting-knife',
  status text not null default 'unused' check (status in ('unused','redeemed','expired','revoked')),
  issued_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '12 months'),
  redeemed_at timestamptz,
  redeemed_order_ref text,
  admin_note text
);

create index if not exists hammerex_xrated_vouchers_listing_idx
  on public.hammerex_xrated_vouchers (listing_id);
create index if not exists hammerex_xrated_vouchers_code_idx
  on public.hammerex_xrated_vouchers (code);
create index if not exists hammerex_xrated_vouchers_status_idx
  on public.hammerex_xrated_vouchers (status);

alter table public.hammerex_xrated_vouchers enable row level security;
-- service-role only — public can't read voucher records directly
