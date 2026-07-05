-- Business Growth Intelligence — per-merchant instance persistence.
-- Amendment 7 · ADR-016.
--
-- studio_business_profile — per-brand instance of a business profile
-- template + local overrides. One active row per brand.
--
-- studio_growth_strategy — per-brand active + historical growth
-- strategies. Multiple rows; only one active at any time.

create table if not exists studio_business_profile (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references studio_brands(id) on delete cascade,
  template_slug text not null,        -- businessProfileRegistry slug
  overrides jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (brand_id, active) deferrable initially deferred
);

create index if not exists idx_studio_business_profile_brand
  on studio_business_profile (brand_id);

create table if not exists studio_growth_strategy (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references studio_brands(id) on delete cascade,
  template_slug text not null,        -- growthStrategyRegistry slug
  overrides jsonb not null default '{}'::jsonb,
  active_from timestamptz not null default now(),
  active_to timestamptz,              -- null = still active
  quarter_label text,                 -- "Q3 2026", "Winter 2026"
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_studio_growth_strategy_brand_active
  on studio_growth_strategy (brand_id, active_to)
  where active_to is null;

create index if not exists idx_studio_growth_strategy_brand
  on studio_growth_strategy (brand_id);

-- RLS: brand-scoped access enforced at API boundary.
alter table studio_business_profile enable row level security;
alter table studio_growth_strategy enable row level security;
