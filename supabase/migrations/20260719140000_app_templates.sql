-- Mobile app template catalogue + per-merchant applied template.
--
-- The canteen mobile view (CanteenHeroWow + CanteenTabbedSection with
-- the About tab, Profile button, and cream #FBF6EC background) is now
-- one entry in a catalogue: "template-1 · Offwhite". Merchants on paid
-- tiers pick a template; the applied slug lives on the listing.
--
-- For MVP the visual layout swap isn't code-driven yet — every canteen
-- renders Template 1 regardless of the applied slug. This migration
-- lays the data foundation so:
--   1. The catalogue is queryable (picker UIs can list options)
--   2. Merchants can select and save a choice today
--   3. When Template 2/3/... ship, existing selections carry over
--   4. Rendering can start dispatching on the applied slug later

create table if not exists public.hammerex_app_templates (
  id                  uuid        primary key default gen_random_uuid(),
  slug                text        not null unique,
  name                text        not null,
  theme_name          text        not null,
  theme_bg_color      text        not null,
  theme_accent_color  text        not null,
  theme_ink_color     text        not null,
  /** Layout tokens — read by the canteen shell to decide which
   *  hero + feed components to render. Free-form strings so we can
   *  add layouts without a migration for each. */
  hero_layout         text        not null,
  feed_layout         text        not null,
  preview_image_url   text,
  description         text,
  /** Which paid tier unlocks this template. 'app_paid' = Canteen tier
   *  (£7.99/mo) or higher. */
  min_tier            text        not null default 'app_paid',
  is_default          boolean     not null default false,
  sort_order          int         not null default 0,
  active              boolean     not null default true,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists idx_hammerex_app_templates_active_sort
  on public.hammerex_app_templates(active, sort_order);

comment on table public.hammerex_app_templates is
  'Catalogue of mobile app templates a paid merchant can apply to their canteen. Template 1 (Offwhite) is the original Mike Watson design.';

-- Applied-template pointer on each merchant listing.
alter table public.hammerex_trade_off_listings
  add column if not exists mobile_app_template_slug text default 'template-1';

comment on column public.hammerex_trade_off_listings.mobile_app_template_slug is
  'Which entry in hammerex_app_templates this merchant currently applies to their canteen mobile view. Defaults to template-1 so existing merchants keep the current visual.';

-- Seed Template 1 — Mike Watson's Original / Offwhite.
insert into public.hammerex_app_templates (
  slug, name, theme_name, theme_bg_color, theme_accent_color, theme_ink_color,
  hero_layout, feed_layout, description, min_tier, is_default, sort_order
)
values (
  'template-1',
  'Original',
  'Offwhite',
  '#FBF6EC',
  '#B8860B',
  '#1B1A17',
  'hero-wow-split-cream',
  'tabbed-live-feed',
  'The original Thenetworkers mobile app design — cream (offwhite) surface, warm gold accents, split-hero with floating KPI cards, tabbed live feed with Profile / Card / About actions, and verified WhatsApp contact throughout. As seen on Mike Watson''s canteen.',
  'app_paid',
  true,
  1
) on conflict (slug) do nothing;

-- RLS: publicly readable (any visitor can see which template a
-- merchant uses; there's no sensitive info here). Only service role
-- writes, same as other catalogue tables.
alter table public.hammerex_app_templates enable row level security;

drop policy if exists app_templates_public_read on public.hammerex_app_templates;
create policy app_templates_public_read
  on public.hammerex_app_templates
  for select
  to public
  using (active = true);

create or replace function public.hammerex_app_templates_touch_updated_at()
returns trigger as $$
begin
  new.updated_at := now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_hammerex_app_templates_touch on public.hammerex_app_templates;
create trigger trg_hammerex_app_templates_touch
before update on public.hammerex_app_templates
for each row execute function public.hammerex_app_templates_touch_updated_at();
