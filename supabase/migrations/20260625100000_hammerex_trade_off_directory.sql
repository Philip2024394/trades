-- Hammerex Trade Off — public directory of tradespeople.
-- Free-to-list, photo-led, WhatsApp-handoff. No reviews in v1.
-- Hammerex Standard badge is set by the API when a listing's contact
-- matches a past hammerex_quote_requests row that includes a flagship
-- tool-station product.

create extension if not exists "pgcrypto";

create table if not exists public.hammerex_trade_off_listings (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  display_name text not null,
  trading_name text,
  primary_trade text not null,
  secondary_trades text[] not null default '{}',
  city text not null,
  country text not null default 'United Kingdom',
  postcode_prefix text,
  lat numeric,
  lng numeric,
  service_postcodes text[] not null default '{}',
  whatsapp text not null,
  phone text,
  email text not null,
  website text,
  instagram text,
  bio text not null,
  years_in_trade integer,
  start_year integer,
  avatar_url text,
  photos text[] not null default '{}',
  status text not null default 'draft' check (status in ('draft','live','hidden')),
  report_count integer not null default 0,
  hammerex_standard_verified boolean not null default false,
  hammerex_standard_products text[] not null default '{}',
  hammerex_standard_blurb text,
  edit_token uuid not null default gen_random_uuid(),
  joined_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists hammerex_trade_off_listings_primary_trade_idx
  on public.hammerex_trade_off_listings (primary_trade);
create index if not exists hammerex_trade_off_listings_city_idx
  on public.hammerex_trade_off_listings (lower(city));
create index if not exists hammerex_trade_off_listings_trade_city_idx
  on public.hammerex_trade_off_listings (primary_trade, lower(city));
create index if not exists hammerex_trade_off_listings_status_idx
  on public.hammerex_trade_off_listings (status);
create index if not exists hammerex_trade_off_listings_email_idx
  on public.hammerex_trade_off_listings (lower(email));
create index if not exists hammerex_trade_off_listings_whatsapp_idx
  on public.hammerex_trade_off_listings (whatsapp);
create index if not exists hammerex_trade_off_listings_standard_idx
  on public.hammerex_trade_off_listings (hammerex_standard_verified);

create or replace function public.hammerex_trade_off_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists hammerex_trade_off_listings_touch on public.hammerex_trade_off_listings;
create trigger hammerex_trade_off_listings_touch
  before update on public.hammerex_trade_off_listings
  for each row execute function public.hammerex_trade_off_touch_updated_at();

create table if not exists public.hammerex_trade_off_reports (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.hammerex_trade_off_listings(id) on delete cascade,
  reason text,
  reporter_ip text,
  created_at timestamptz not null default now()
);

create index if not exists hammerex_trade_off_reports_listing_idx
  on public.hammerex_trade_off_reports (listing_id);

-- After a report lands, bump the listing's report_count and auto-hide
-- once 3+ reports are in. Manual review can flip status back to 'live'.
create or replace function public.hammerex_trade_off_after_report()
returns trigger
language plpgsql
as $$
declare
  current_count integer;
begin
  select count(*) into current_count
    from public.hammerex_trade_off_reports
   where listing_id = new.listing_id;

  update public.hammerex_trade_off_listings
     set report_count = current_count,
         status = case when current_count >= 3 then 'hidden' else status end
   where id = new.listing_id;

  return new;
end;
$$;

drop trigger if exists hammerex_trade_off_reports_bump on public.hammerex_trade_off_reports;
create trigger hammerex_trade_off_reports_bump
  after insert on public.hammerex_trade_off_reports
  for each row execute function public.hammerex_trade_off_after_report();

alter table public.hammerex_trade_off_listings enable row level security;
alter table public.hammerex_trade_off_reports  enable row level security;

drop policy if exists hammerex_trade_off_listings_public_read on public.hammerex_trade_off_listings;
create policy hammerex_trade_off_listings_public_read
  on public.hammerex_trade_off_listings
  for select
  to anon, authenticated
  using (status = 'live');

drop policy if exists hammerex_trade_off_reports_public_insert on public.hammerex_trade_off_reports;
create policy hammerex_trade_off_reports_public_insert
  on public.hammerex_trade_off_reports
  for insert
  to anon, authenticated
  with check (true);
