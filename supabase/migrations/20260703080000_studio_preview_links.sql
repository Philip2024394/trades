-- Studio preview links — shareable read-only URLs for reviewers.
--
-- Merchants generate a token that resolves to a specific brand/page +
-- source (current draft, current live, or a specific historical version).
-- Reviewers open /studio/share/<token> — no auth required, but the
-- token itself is high-entropy and can be revoked.
--
-- source_kind:
--   'draft'   — always resolves to whatever the current draft is at
--                view time. Useful for "look at what I'm about to ship".
--   'live'    — resolves to the current live (highest-version published).
--                Useful for "review the site as it is now".
--   'version' — pinned to a specific published version id. Never
--                changes. Useful for "look at what was live last week".

create table if not exists public.studio_preview_links (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.studio_brands(id) on delete cascade,
  page_id text not null,
  token text not null unique,
  source_kind text not null check (source_kind in ('draft', 'live', 'version')),
  source_version_id uuid references public.studio_layouts(id) on delete cascade,
  note text,
  created_at timestamptz not null default now(),
  expires_at timestamptz,
  revoked_at timestamptz,
  view_count integer not null default 0,
  last_viewed_at timestamptz,
  -- pinned version requires source_version_id, non-pinned rejects it
  check ((source_kind = 'version') = (source_version_id is not null))
);

create index if not exists studio_preview_links_brand_idx
  on public.studio_preview_links (brand_id, created_at desc);

create index if not exists studio_preview_links_expiry_idx
  on public.studio_preview_links (expires_at)
  where revoked_at is null;
