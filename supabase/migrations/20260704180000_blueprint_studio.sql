-- Blueprint Studio · foundation.
--
-- Three tables:
--   1. studio_blueprint_installs — history of which blueprint each brand
--      has installed. Non-destructive (soft-delete via uninstalled_at)
--      so we can reason about churn + power the peer-popularity signal.
--   2. studio_brand_outcomes — the wizard answers. One row per brand,
--      overwritten on re-wizard. Feeds the recommender + score reranker.
--   3. studio_brand_credentials — verified UK trade certifications
--      (Gas Safe, NICEIC, MCS, FMB, etc.). One row per (brand, scheme,
--      number). Verified daily by cron; expired badges silently hide.
--
-- Also extends studio_layouts with blueprint_id for provenance analytics.
--
-- RLS is intentionally not enabled — matches the rest of the studio schema.
-- All writes route through supabaseAdmin from server routes.

-- ─── studio_blueprint_installs ───────────────────────────

create table if not exists public.studio_blueprint_installs (
  id             uuid primary key default gen_random_uuid(),
  brand_id       uuid not null references public.studio_brands(id) on delete cascade,
  blueprint_id   text not null,
  installed_at   timestamptz not null default now(),
  uninstalled_at timestamptz,
  design_variant text not null default 'default',
  outcome_weights jsonb not null default '{}'::jsonb
);

create index if not exists studio_blueprint_installs_brand_idx
  on public.studio_blueprint_installs (brand_id);
create index if not exists studio_blueprint_installs_blueprint_idx
  on public.studio_blueprint_installs (blueprint_id) where uninstalled_at is null;

-- ─── studio_brand_outcomes ───────────────────────────────

create table if not exists public.studio_brand_outcomes (
  brand_id           uuid primary key references public.studio_brands(id) on delete cascade,
  primary_outcome    text not null,
  secondary_outcomes text[] not null default array[]::text[],
  coverage_postcode  text,
  coverage_radius_mi integer,
  answered_wizard_at timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create or replace function public.studio_brand_outcomes_touch()
returns trigger as $$
begin
  new.updated_at := now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists studio_brand_outcomes_touch on public.studio_brand_outcomes;
create trigger studio_brand_outcomes_touch
  before update on public.studio_brand_outcomes
  for each row execute function public.studio_brand_outcomes_touch();

-- ─── studio_brand_credentials ────────────────────────────
--
-- One row per (brand, scheme, number). Credentials are verified daily
-- by a cron job that hits each scheme's public register. The site
-- renderer checks `status` at request time — expired credentials render
-- as hidden badges, never broken/stale ones.

create table if not exists public.studio_brand_credentials (
  id             uuid primary key default gen_random_uuid(),
  brand_id       uuid not null references public.studio_brands(id) on delete cascade,
  scheme         text not null,
  number         text not null,
  status         text not null default 'unverified',
  verified_at    timestamptz,
  expires_at     timestamptz,
  last_check_at  timestamptz,
  raw_response   jsonb,
  display_label  text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (brand_id, scheme, number)
);

create index if not exists studio_brand_credentials_brand_idx
  on public.studio_brand_credentials (brand_id);
create index if not exists studio_brand_credentials_scheme_idx
  on public.studio_brand_credentials (scheme);
create index if not exists studio_brand_credentials_status_idx
  on public.studio_brand_credentials (status);

create or replace function public.studio_brand_credentials_touch()
returns trigger as $$
begin
  new.updated_at := now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists studio_brand_credentials_touch on public.studio_brand_credentials;
create trigger studio_brand_credentials_touch
  before update on public.studio_brand_credentials
  for each row execute function public.studio_brand_credentials_touch();

-- ─── studio_layouts.blueprint_id for provenance ──────────

alter table public.studio_layouts
  add column if not exists blueprint_id text;

create index if not exists studio_layouts_blueprint_idx
  on public.studio_layouts (blueprint_id) where blueprint_id is not null;
