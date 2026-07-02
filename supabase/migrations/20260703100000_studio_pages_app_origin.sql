-- Platform Runtime — studio_pages attribution + soft-hide.
--
-- Two additive columns so the Runtime can:
--   1. Attribute a page to the App that created it (origin_app_slug)
--   2. Soft-hide pages on uninstall without dropping the row (hidden_at)
--
-- Merchant-created pages leave both null and are unaffected by App
-- lifecycles. Only pages with origin_app_slug set participate in the
-- install/uninstall cycle.

alter table public.studio_pages
  add column if not exists origin_app_slug text;

alter table public.studio_pages
  add column if not exists hidden_at timestamptz;

-- Fast lookup for "which pages did this App create for this brand?".
create index if not exists studio_pages_origin_app_idx
  on public.studio_pages (brand_id, origin_app_slug)
  where origin_app_slug is not null;

-- Fast filter for the visible-pages list (Studio's page manager +
-- storefront nav both read this shape).
create index if not exists studio_pages_visible_idx
  on public.studio_pages (brand_id, sort_order)
  where hidden_at is null;
