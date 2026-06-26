-- Xrated Trades — customer-side jobs feed.
-- Customers post their projects; tradies browse and WhatsApp directly.
-- Light moderation: pending → live via admin glance. is_example tags
-- show as "EXAMPLE" pills so seeded posts never trap a tradie.

create table if not exists public.hammerex_xrated_jobs (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  customer_name text not null,
  customer_whatsapp text not null,
  trade_slug text not null,
  city text not null,
  postcode_prefix text,
  description text not null,
  budget_hint text,
  photos text[] not null default '{}',
  status text not null default 'pending'
    check (status in ('pending','live','completed','rejected','expired')),
  is_example boolean not null default false,
  report_count integer not null default 0,
  expires_at timestamptz not null default (now() + interval '30 days'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists hammerex_xrated_jobs_status_idx
  on public.hammerex_xrated_jobs (status, created_at desc);
create index if not exists hammerex_xrated_jobs_trade_city_idx
  on public.hammerex_xrated_jobs (trade_slug, lower(city));
create index if not exists hammerex_xrated_jobs_created_at_idx
  on public.hammerex_xrated_jobs (created_at desc);
create index if not exists hammerex_xrated_jobs_example_idx
  on public.hammerex_xrated_jobs (is_example);

drop trigger if exists hammerex_xrated_jobs_touch on public.hammerex_xrated_jobs;
create trigger hammerex_xrated_jobs_touch
  before update on public.hammerex_xrated_jobs
  for each row execute function public.hammerex_trade_off_touch_updated_at();

alter table public.hammerex_xrated_jobs enable row level security;

drop policy if exists hammerex_xrated_jobs_public_read on public.hammerex_xrated_jobs;
create policy hammerex_xrated_jobs_public_read
  on public.hammerex_xrated_jobs
  for select
  to anon, authenticated
  using (status = 'live');

create table if not exists public.hammerex_xrated_job_reports (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.hammerex_xrated_jobs(id) on delete cascade,
  reason text,
  reporter_ip text,
  created_at timestamptz not null default now()
);

create index if not exists hammerex_xrated_job_reports_job_idx
  on public.hammerex_xrated_job_reports (job_id);

create or replace function public.hammerex_xrated_jobs_after_report()
returns trigger
language plpgsql
as $$
declare
  cnt integer;
begin
  select count(*) into cnt
    from public.hammerex_xrated_job_reports
   where job_id = new.job_id;

  update public.hammerex_xrated_jobs
     set report_count = cnt,
         status = case when cnt >= 3 and status = 'live' then 'rejected' else status end
   where id = new.job_id;

  return new;
end;
$$;

drop trigger if exists hammerex_xrated_job_reports_bump
  on public.hammerex_xrated_job_reports;
create trigger hammerex_xrated_job_reports_bump
  after insert on public.hammerex_xrated_job_reports
  for each row execute function public.hammerex_xrated_jobs_after_report();

alter table public.hammerex_xrated_job_reports enable row level security;

drop policy if exists hammerex_xrated_job_reports_public_insert
  on public.hammerex_xrated_job_reports;
create policy hammerex_xrated_job_reports_public_insert
  on public.hammerex_xrated_job_reports
  for insert
  to anon, authenticated
  with check (true);
