-- Trade Off v2 — social-media handles + verified work gallery (projects).

alter table public.hammerex_trade_off_listings
  add column if not exists facebook text,
  add column if not exists tiktok text,
  add column if not exists youtube text;

create table if not exists public.hammerex_trade_off_projects (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.hammerex_trade_off_listings(id) on delete cascade,
  title text not null,
  description text,
  before_url text,
  during_url text,
  after_url text,
  location_city text,
  completed_at date,
  verified boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists hammerex_trade_off_projects_listing_idx
  on public.hammerex_trade_off_projects (listing_id, sort_order);
create index if not exists hammerex_trade_off_projects_verified_idx
  on public.hammerex_trade_off_projects (verified);

drop trigger if exists hammerex_trade_off_projects_touch
  on public.hammerex_trade_off_projects;
create trigger hammerex_trade_off_projects_touch
  before update on public.hammerex_trade_off_projects
  for each row execute function public.hammerex_trade_off_touch_updated_at();

alter table public.hammerex_trade_off_projects enable row level security;

drop policy if exists hammerex_trade_off_projects_public_read
  on public.hammerex_trade_off_projects;
create policy hammerex_trade_off_projects_public_read
  on public.hammerex_trade_off_projects
  for select
  to anon, authenticated
  using (
    exists (
      select 1
        from public.hammerex_trade_off_listings l
       where l.id = listing_id
         and l.status = 'live'
    )
  );
