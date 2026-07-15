-- Template 02 — Iron / Electrician (Craig McDermott).
--
-- Second entry in the app template library. Same base layout as
-- Template 01 (hero-wow-split-cream + tabbed-live-feed) but dark chrome
-- + amber accent — the safety-critical technical vibe used by
-- electricians, Gas Safe engineers, alarm installers, etc. Reference
-- canteen: /trade-off/yard/canteens/uk-rated-electricians.
--
-- Layout is currently shared across all templates (palette-only swap).
-- When Template 02 diverges structurally (e.g. different hero
-- composition), update hero_layout / feed_layout to distinct slugs and
-- teach the canteen shell to dispatch on them.

insert into public.hammerex_app_templates (
  slug, name, theme_name, theme_bg_color, theme_accent_color, theme_ink_color,
  hero_layout, feed_layout, preview_image_url, description, min_tier, is_default, sort_order
)
values (
  'template-2',
  'Iron',
  'Iron',
  '#0F0F0F',
  '#FFB300',
  '#F5F5F5',
  'hero-wow-split-cream',
  'tabbed-live-feed',
  'https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%2015,%202026,%2003_19_54%20AM.png',
  'Dark technical template — matte-black surface with hi-vis amber accents. Reference design: Craig McDermott (rated electrician, Leeds). Best fit for safety-critical trades: electricians, Gas Safe engineers, alarm/CCTV installers, EV charger fitters.',
  'app_paid',
  false,
  2
) on conflict (slug) do nothing;
