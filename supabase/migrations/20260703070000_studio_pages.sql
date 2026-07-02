-- Studio pages — first-class page objects per brand.
--
-- Until now, "pages" were implicit — a page_id string in studio_layouts.
-- That meant merchants couldn't create / rename / delete pages, and the
-- editor had a hard-coded list of "known" pages.
--
-- This migration adds studio_pages so page metadata (name, description,
-- sort order, home flag) lives in one queryable place and can grow with
-- the merchant.
--
-- Backfill: every existing studio_brands row gets a default "home" page,
-- plus rows for any distinct page_id already present in studio_layouts
-- for that brand.

create table if not exists public.studio_pages (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.studio_brands(id) on delete cascade,
  slug text not null,
  name text not null,
  description text,
  sort_order integer not null default 100,
  is_home boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists studio_pages_brand_slug_idx
  on public.studio_pages (brand_id, slug);

-- Only one home page per brand — the merchant lands on this by default
-- when they open the editor.
create unique index if not exists studio_pages_one_home_idx
  on public.studio_pages (brand_id)
  where is_home = true;

create index if not exists studio_pages_sort_idx
  on public.studio_pages (brand_id, sort_order);

drop trigger if exists studio_pages_touch on public.studio_pages;
create trigger studio_pages_touch
before update on public.studio_pages
for each row execute function public.studio_touch_updated_at();

-- ─── Backfill ─────────────────────────────────────────────────────
-- 1. Ensure every brand has a "home" page.
insert into public.studio_pages (brand_id, slug, name, description, sort_order, is_home)
select b.id, 'home', 'Home', 'Your main profile page.', 0, true
from public.studio_brands b
where not exists (
  select 1 from public.studio_pages p
  where p.brand_id = b.id and p.slug = 'home'
);

-- 2. Every distinct page_id in studio_layouts that isn't yet in studio_pages
--    for that brand — carry it over so merchants don't lose access.
insert into public.studio_pages (brand_id, slug, name, sort_order)
select distinct l.brand_id, l.page_id, initcap(replace(l.page_id, '-', ' ')), 100
from public.studio_layouts l
where l.page_id is not null
  and not exists (
    select 1 from public.studio_pages p
    where p.brand_id = l.brand_id and p.slug = l.page_id
  );
