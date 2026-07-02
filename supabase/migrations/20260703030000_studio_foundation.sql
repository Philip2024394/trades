-- Studio foundation — schema powering the merchant Operating Studio.
--
-- Five tables that carry every future Studio module:
--   studio_brands            — one merchant can own many brands
--   studio_brand_tokens      — colours, fonts, radii, spacing, etc. per brand
--   studio_layouts           — page layouts, draft + published + versioned
--   studio_saved_components  — reusable heroes / cards / CTAs per brand/merchant
--   studio_layout_events     — telemetry feeding Live Component Intelligence,
--                              AI Design Score, Smart Layout Recommendations
--
-- All tables are prefixed `studio_` so they never collide with existing
-- xrated_* / hammerex_* / kita2u_* namespaces. Merchant identity is the
-- existing hammerex_trade_off_listings row — no separate merchant table.
--
-- RLS is intentionally not enabled here to match the rest of the trades
-- schema (all writes go through supabaseAdmin from server routes).

-- ─── 1. studio_brands ─────────────────────────────────────────────
create table if not exists public.studio_brands (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.hammerex_trade_off_listings(id) on delete cascade,
  name text not null,
  slug text not null,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (merchant_id, slug)
);

create index if not exists studio_brands_merchant_id_idx
  on public.studio_brands (merchant_id);

-- Only one default brand per merchant. Enforced at the write layer;
-- a partial unique index makes the invariant safe at the DB layer too.
create unique index if not exists studio_brands_one_default_per_merchant_idx
  on public.studio_brands (merchant_id)
  where is_default = true;

-- ─── 2. studio_brand_tokens ───────────────────────────────────────
-- key/value store keyed by (brand, kind, key). Kind enumerates the
-- global design-system pillars — extending the list is a code change
-- (the renderer needs to know how to consume a new kind) not a schema
-- change, so we keep it TEXT + CHECK rather than an enum.
create table if not exists public.studio_brand_tokens (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.studio_brands(id) on delete cascade,
  kind text not null,
  key text not null,
  value_json jsonb not null,
  updated_at timestamptz not null default now(),
  unique (brand_id, kind, key),
  check (kind in ('color', 'font', 'radius', 'spacing', 'shadow', 'logo', 'icon', 'button'))
);

create index if not exists studio_brand_tokens_brand_id_idx
  on public.studio_brand_tokens (brand_id);

-- ─── 3. studio_layouts ────────────────────────────────────────────
-- One row per (merchant, brand, page, breakpoint, status). Draft and
-- published are separate rows so publish is atomic and rollback is
-- trivial (bump version, promote parent).
--
-- layout_json shape:
--   { sections: [ { key: string, config: JSONValue }, ... ],
--     order:   [ [key, key], [key], ... ]  // rows of column keys
--   }
--
-- breakpoint = 'default' means the layout applies to all viewports;
-- per-breakpoint overrides land in Module 12 (Responsive editing).
create table if not exists public.studio_layouts (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.hammerex_trade_off_listings(id) on delete cascade,
  brand_id uuid not null references public.studio_brands(id) on delete cascade,
  page_id text not null,
  breakpoint text not null default 'default',
  layout_json jsonb not null,
  status text not null default 'draft',
  version integer not null default 1,
  parent_layout_id uuid references public.studio_layouts(id) on delete set null,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (status in ('draft', 'published', 'archived')),
  check (breakpoint in ('default', 'mobile', 'tablet', 'desktop'))
);

-- Fast lookup for the editor: "give me the merchant's current draft
-- (or published) layout for this page + breakpoint".
create index if not exists studio_layouts_lookup_idx
  on public.studio_layouts (merchant_id, brand_id, page_id, breakpoint, status);

create index if not exists studio_layouts_parent_idx
  on public.studio_layouts (parent_layout_id);

-- Only one live draft per (merchant, brand, page, breakpoint). Publish
-- promotes it and creates a new draft copy.
create unique index if not exists studio_layouts_one_draft_idx
  on public.studio_layouts (merchant_id, brand_id, page_id, breakpoint)
  where status = 'draft';

-- ─── 4. studio_saved_components ───────────────────────────────────
-- The Merchant Library. Reusable elements the merchant has saved from
-- their own edits. Scope 'personal' = only that user; 'company' = every
-- user of the merchant sees it.
create table if not exists public.studio_saved_components (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.hammerex_trade_off_listings(id) on delete cascade,
  brand_id uuid references public.studio_brands(id) on delete cascade,
  kind text not null,
  name text not null,
  config_json jsonb not null,
  scope text not null default 'personal',
  source_layout_id uuid references public.studio_layouts(id) on delete set null,
  thumbnail_url text,
  usage_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (scope in ('personal', 'company'))
);

create index if not exists studio_saved_components_merchant_kind_idx
  on public.studio_saved_components (merchant_id, kind);

-- ─── 5. studio_layout_events ──────────────────────────────────────
-- Telemetry stream. Feeds:
--   • Live Component Intelligence — "Hero 4 used by 18,200 merchants"
--   • Smart Layout Recommendations — Netflix-style co-occurrence
--   • AI Design Score — page-level trend, delta after AI patches
--
-- Non-blocking writes; missing rows never break editing. Merchant + brand
-- are nullable so we can log truly anonymous surface hits (a public
-- customer viewing a merchant's published page counts as a `view` event).
create table if not exists public.studio_layout_events (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid references public.hammerex_trade_off_listings(id) on delete cascade,
  brand_id uuid references public.studio_brands(id) on delete set null,
  page_id text,
  section_key text,
  layout_variant text,
  event text not null,
  payload_json jsonb,
  created_at timestamptz not null default now(),
  check (event in ('pick', 'edit', 'move', 'remove', 'publish', 'revert', 'view', 'convert', 'score'))
);

create index if not exists studio_layout_events_variant_event_idx
  on public.studio_layout_events (layout_variant, event, created_at desc);

create index if not exists studio_layout_events_merchant_idx
  on public.studio_layout_events (merchant_id, created_at desc);

-- ─── Auto-updated_at triggers ─────────────────────────────────────
create or replace function public.studio_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists studio_brands_touch on public.studio_brands;
create trigger studio_brands_touch
before update on public.studio_brands
for each row execute function public.studio_touch_updated_at();

drop trigger if exists studio_brand_tokens_touch on public.studio_brand_tokens;
create trigger studio_brand_tokens_touch
before update on public.studio_brand_tokens
for each row execute function public.studio_touch_updated_at();

drop trigger if exists studio_layouts_touch on public.studio_layouts;
create trigger studio_layouts_touch
before update on public.studio_layouts
for each row execute function public.studio_touch_updated_at();

drop trigger if exists studio_saved_components_touch on public.studio_saved_components;
create trigger studio_saved_components_touch
before update on public.studio_saved_components
for each row execute function public.studio_touch_updated_at();

-- ─── Backfill: default brand per existing merchant ────────────────
-- Every merchant that already exists gets one auto-created default
-- brand named "Main brand", so the editor never has to handle a
-- brand-less merchant. New merchants trigger the same behaviour via
-- application logic (Module 0.4 studio bootstrap route).
insert into public.studio_brands (merchant_id, name, slug, is_default)
select id, 'Main brand', 'main', true
from public.hammerex_trade_off_listings
where not exists (
  select 1 from public.studio_brands b where b.merchant_id = hammerex_trade_off_listings.id
);
