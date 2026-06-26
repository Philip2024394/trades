-- Xrated Trades admin — per-listing page-view analytics + payment audit log.

create table if not exists public.hammerex_xrated_views (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid references public.hammerex_trade_off_listings(id) on delete cascade,
  page text not null,
  session_id text,
  ip_hash text,
  country text,
  city text,
  referrer text,
  user_agent text,
  viewed_at timestamptz not null default now(),
  ended_at timestamptz,
  duration_seconds integer
);

create index if not exists hammerex_xrated_views_listing_idx
  on public.hammerex_xrated_views (listing_id, viewed_at desc);
create index if not exists hammerex_xrated_views_page_idx
  on public.hammerex_xrated_views (page, viewed_at desc);
create index if not exists hammerex_xrated_views_session_idx
  on public.hammerex_xrated_views (session_id);
create index if not exists hammerex_xrated_views_viewed_at_idx
  on public.hammerex_xrated_views (viewed_at desc);

alter table public.hammerex_xrated_views enable row level security;

-- Anon can INSERT views (the beacon endpoint runs unauthenticated).
-- SELECT is service-role only (admin reads via service-role client).
drop policy if exists hammerex_xrated_views_public_insert on public.hammerex_xrated_views;
create policy hammerex_xrated_views_public_insert
  on public.hammerex_xrated_views
  for insert
  to anon, authenticated
  with check (true);

drop policy if exists hammerex_xrated_views_public_update on public.hammerex_xrated_views;
create policy hammerex_xrated_views_public_update
  on public.hammerex_xrated_views
  for update
  to anon, authenticated
  using (ended_at is null)
  with check (true);

create table if not exists public.hammerex_xrated_payments (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.hammerex_trade_off_listings(id) on delete cascade,
  plan text not null check (plan in ('monthly','annual')),
  amount_gbp numeric(10,2) not null,
  paid_at timestamptz not null default now(),
  paid_via text not null default 'whatsapp_manual',
  admin_note text,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists hammerex_xrated_payments_listing_idx
  on public.hammerex_xrated_payments (listing_id, paid_at desc);
create index if not exists hammerex_xrated_payments_expires_idx
  on public.hammerex_xrated_payments (expires_at);

alter table public.hammerex_xrated_payments enable row level security;
-- No public policies — service-role only.

alter table public.hammerex_trade_off_listings
  add column if not exists paid_expires_at timestamptz,
  add column if not exists last_payment_plan text
    check (last_payment_plan is null or last_payment_plan in ('monthly','annual'));
