-- Studio Asset Library — curated photo pool.
--
-- Every hero, gallery, banner, team-cards, background section can auto-
-- populate its image slot from this pool based on multi-dimensional
-- metadata (industry × style × orientation × mood × purpose).
--
-- Why a table instead of a JSON manifest? Growing library, admin
-- curation UI, per-region CDN swap, merchant "did we license this?"
-- queries later.
--
-- The `assets/getRandomAsset` helper falls back to a hardcoded seed
-- set baked into the code when the table is empty (bootstrap phase),
-- so shipping this migration doesn't require immediate data seeding.
--
-- RLS off — matches the studio_* convention. Server routes only.

create table if not exists public.studio_asset_library (
  id uuid primary key default gen_random_uuid(),

  -- URL to the actual image (ImageKit / Cloudflare Images / etc.)
  url text not null,
  alt text not null default '',

  -- Metadata dimensions. All optional (null = matches any query).
  industry text,       -- e.g. 'electrician', 'landscaper', null = any
  style text,          -- e.g. 'premium', 'industrial', 'minimal'
  orientation text,    -- 'landscape' | 'portrait' | 'square'
  mood text,           -- 'bright' | 'dark' | 'warm' | 'cool' | 'neutral'
  purpose text not null, -- 'hero' | 'gallery' | 'background' | 'team' | 'service' | 'banner'

  -- Free-form tags for AI/search
  tags text[] not null default '{}'::text[],

  -- Licensing + attribution
  license text,        -- e.g. 'creative-commons', 'imagekit-royalty-free'
  attribution text,

  -- Ranking + freshness
  weight integer not null default 100, -- higher = more likely to be picked
  active boolean not null default true,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Index for the most common query: purpose + industry
create index if not exists studio_asset_library_purpose_industry_idx
  on public.studio_asset_library (purpose, industry)
  where active = true;

-- Index for style-first queries
create index if not exists studio_asset_library_purpose_style_idx
  on public.studio_asset_library (purpose, style)
  where active = true;

-- Index for orientation queries (heroes are landscape, portraits for team, etc.)
create index if not exists studio_asset_library_orientation_idx
  on public.studio_asset_library (orientation)
  where active = true;

-- Tag search
create index if not exists studio_asset_library_tags_idx
  on public.studio_asset_library using gin (tags)
  where active = true;
