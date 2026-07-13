-- Content Manifests — M3 B8 Phase 3.
--
-- Persists Creative Director output.
--   • studio_content_manifests    — one row per generated manifest
--   • studio_content_blocks       — one row per addressable block
--                                    (indexed for targeted regeneration)
--   • studio_content_regenerations — audit log of regeneration events
--
-- Every block references its source manifest + its provenance so the
-- explainer can answer "Why is this block on the page?" for any
-- block on any manifest.

set search_path = public;

-- ─── studio_content_manifests ─────────────────────────────────
create table if not exists studio_content_manifests (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  merchant_id uuid not null,
  output_medium text not null check (output_medium in (
    'website','quote-document','email-campaign','google-business-post',
    'facebook-ad','brochure','landing-page','sms-follow-up',
    'ai-assistant-response','customer-portal-message'
  )),
  strategy_snapshot jsonb not null,
  brand_voice text not null check (brand_voice in (
    'premium','friendly','traditional','luxury','commercial',
    'emergency','casual','expert'
  )),
  pages jsonb not null default '[]'::jsonb,
  site_wide_blocks jsonb not null default '[]'::jsonb,
  warnings text[],
  is_published boolean not null default false,
  published_at timestamptz,
  generated_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index if not exists idx_studio_content_manifests_merchant on studio_content_manifests(merchant_id);
create index if not exists idx_studio_content_manifests_published on studio_content_manifests(merchant_id, is_published) where is_published;

-- ─── studio_content_blocks ────────────────────────────────────
-- Denormalised for targeted regeneration + querying by kind.
create table if not exists studio_content_blocks (
  id uuid primary key default gen_random_uuid(),
  manifest_id uuid not null references studio_content_manifests(id) on delete cascade,
  block_slug text not null,
  page_slug text,
  section_slug text,
  kind text not null,
  data jsonb not null,
  provenance jsonb not null,
  regeneration jsonb not null,
  generated_by text not null,          -- composer slug
  generator_backend text not null,     -- template / llm / hybrid
  purpose text not null,
  audience text,
  primary_goal text not null,
  confidence_band text not null,
  edited boolean not null default false,
  edited_at timestamptz,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (manifest_id, block_slug)
);
create index if not exists idx_studio_content_blocks_manifest on studio_content_blocks(manifest_id);
create index if not exists idx_studio_content_blocks_kind on studio_content_blocks(kind);
create index if not exists idx_studio_content_blocks_generated_by on studio_content_blocks(generated_by);

-- ─── studio_content_regenerations ─────────────────────────────
-- Audit trail: who regenerated what, when, and with which overrides.
create table if not exists studio_content_regenerations (
  id uuid primary key default gen_random_uuid(),
  manifest_id uuid not null references studio_content_manifests(id) on delete cascade,
  merchant_id uuid not null,
  scope text not null check (scope in ('block','section','page','manifest')),
  target_block_slugs text[],
  target_section_slug text,
  target_page_slug text,
  overrides jsonb,
  strategy_snapshot jsonb,
  triggered_by text not null,          -- 'merchant' / 'auto-invalidation' / 'admin'
  triggered_reason text,               -- free text
  created_at timestamptz not null default now()
);
create index if not exists idx_studio_content_regen_manifest on studio_content_regenerations(manifest_id);
create index if not exists idx_studio_content_regen_merchant on studio_content_regenerations(merchant_id);

-- ─── RLS ──────────────────────────────────────────────────────
alter table studio_content_manifests enable row level security;
alter table studio_content_blocks enable row level security;
alter table studio_content_regenerations enable row level security;

drop policy if exists "manifest_merchant_owner" on studio_content_manifests;
create policy "manifest_merchant_owner"
  on studio_content_manifests
  for all
  using (merchant_id = auth.uid())
  with check (merchant_id = auth.uid());

drop policy if exists "blocks_via_manifest_owner" on studio_content_blocks;
create policy "blocks_via_manifest_owner"
  on studio_content_blocks
  for all
  using (manifest_id in (select id from studio_content_manifests where merchant_id = auth.uid()))
  with check (manifest_id in (select id from studio_content_manifests where merchant_id = auth.uid()));

drop policy if exists "regenerations_merchant_owner" on studio_content_regenerations;
create policy "regenerations_merchant_owner"
  on studio_content_regenerations
  for all
  using (merchant_id = auth.uid())
  with check (merchant_id = auth.uid());
