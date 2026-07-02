-- Studio experiments — per-section A/B tests.
--
-- A running experiment binds two config variants (A + B) to a single
-- section instance on a page. Visitors are hashed → bucketed → the
-- matched variant's config JSON is spread over the section's live
-- config at render time.
--
-- Rollout: promoting a winner writes the chosen variant into the live
-- draft layout (server-side) and marks the experiment `stopped`.

create table if not exists public.studio_experiments (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.studio_brands(id) on delete cascade,
  page_id text not null,
  instance_id text not null,
  name text not null default 'Untitled A/B test',
  variant_a_config jsonb not null default '{}'::jsonb,
  variant_b_config jsonb not null default '{}'::jsonb,
  split_a integer not null default 50 check (split_a >= 0 and split_a <= 100),
  status text not null default 'running' check (status in ('running', 'stopped', 'rolled_out')),
  winner text check (winner in ('A', 'B')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  ended_at timestamptz
);

-- One running experiment per (brand, page, instance) at a time —
-- prevents accidentally stacking tests on the same section.
create unique index if not exists studio_experiments_one_running_idx
  on public.studio_experiments (brand_id, page_id, instance_id)
  where status = 'running';

create index if not exists studio_experiments_brand_page_idx
  on public.studio_experiments (brand_id, page_id, status);

drop trigger if exists studio_experiments_touch on public.studio_experiments;
create trigger studio_experiments_touch
before update on public.studio_experiments
for each row execute function public.studio_touch_updated_at();
