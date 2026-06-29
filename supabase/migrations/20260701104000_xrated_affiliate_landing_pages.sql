-- Xrated Trades — Affiliate Programme Phase 3 (5/7).
-- White-label landing pages.
--
-- Each affiliate can publish one or more custom landing pages at
-- /affiliates/by/<affiliate_id>/<slug>. The public route loads the row,
-- renders title/tagline/hero/markdown + a CTA pointing at
-- /trade-off/signup?ref=<affiliate_id>, and stamps the affiliate_ref
-- cookie on first hit so the attribution survives even when the visitor
-- comes back later in a new tab.
--
-- We deliberately do NOT allow affiliates to choose any slug they want
-- at the platform root — they're always namespaced under
-- `/affiliates/by/<affiliate_id>/` so they cannot impersonate
-- xratedtrade.com. The page itself renders a "Promoted by Affiliate
-- #NNNNN" footer to make the affiliation explicit.

create table if not exists public.hammerex_affiliate_landing_pages (
  id uuid primary key default gen_random_uuid(),
  affiliate_id integer not null,
  slug text not null,
  title text not null,
  tagline text,
  cta_text text not null default 'Join xratedtrade.com',
  hero_image_url text,
  body_markdown text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (affiliate_id, slug)
);
create index if not exists hammerex_affiliate_landing_pages_affiliate_idx
  on public.hammerex_affiliate_landing_pages (affiliate_id);
