-- Xrated Trades — Affiliate Programme Phase 2.
-- Marketing-pack catalogue + per-affiliate download log.
--
-- `hammerex_affiliate_marketing_assets` stores admin-uploaded creative
-- (banners, stories, logos, QR templates, short videos, PDFs). Each row
-- points at a file in the public `product-images` bucket under the
-- `marketing-pack/<kind>/` prefix. We keep dimensions/duration optional
-- because some kinds (PDF) don't have a sensible single number.
--
-- `hammerex_affiliate_marketing_downloads` is the per-affiliate download
-- log. Every hit to /api/affiliates/marketing-download writes a row so
-- we can show "X downloads, Y unique affiliates" in admin and also
-- spot dead assets that nobody ever grabs. We deliberately keep IP
-- around as plain text — same surface as hammerex_affiliate_clicks.
create table if not exists public.hammerex_affiliate_marketing_assets (
  id uuid primary key default gen_random_uuid(),
  kind text not null
    check (kind in ('image', 'video', 'pdf', 'logo', 'qr',
                    'banner', 'story', 'social_post')),
  title text not null,
  description text,
  file_url text not null,
  thumbnail_url text,
  file_size_bytes integer,
  width_px integer,
  height_px integer,
  duration_seconds integer,
  featured boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists hammerex_affiliate_marketing_assets_kind_idx
  on public.hammerex_affiliate_marketing_assets (kind, created_at desc);
create index if not exists hammerex_affiliate_marketing_assets_featured_idx
  on public.hammerex_affiliate_marketing_assets (featured, created_at desc)
  where featured = true;

create table if not exists public.hammerex_affiliate_marketing_downloads (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references public.hammerex_affiliate_marketing_assets(id) on delete cascade,
  affiliate_id integer not null,
  downloaded_at timestamptz not null default now(),
  ip text
);
create index if not exists hammerex_affiliate_marketing_downloads_asset_idx
  on public.hammerex_affiliate_marketing_downloads (asset_id, downloaded_at desc);
create index if not exists hammerex_affiliate_marketing_downloads_affiliate_idx
  on public.hammerex_affiliate_marketing_downloads (affiliate_id, downloaded_at desc);
