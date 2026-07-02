-- Studio media library — one row per uploaded asset.
--
-- Files themselves live in the existing `product-images` Storage
-- bucket under `studio/{merchant_id}/{uuid}.{ext}` — reusing the
-- infrastructure the plant-hire / product editors already trust.
-- This table only stores the metadata we need to list, filter, and
-- reference assets across the merchant's brand.
--
-- Brand is nullable so early uploads (before the brand system was
-- exposed) don't orphan on brand deletion. Set-null on cascade means
-- the file record survives even if the brand row disappears.

create table if not exists public.studio_media (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.hammerex_trade_off_listings(id) on delete cascade,
  brand_id uuid references public.studio_brands(id) on delete set null,
  url text not null,
  filename text not null,
  size_bytes integer not null default 0,
  mime_type text,
  width integer,
  height integer,
  created_at timestamptz not null default now(),
  unique (merchant_id, url)
);

create index if not exists studio_media_merchant_created_idx
  on public.studio_media (merchant_id, created_at desc);

create index if not exists studio_media_brand_idx
  on public.studio_media (brand_id);
