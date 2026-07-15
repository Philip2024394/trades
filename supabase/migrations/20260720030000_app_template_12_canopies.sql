-- App template 12 — Oak-frame canopy specialists.
-- Reference: Aidan Frost (Cheshire, uk-canopy-specialists).

insert into public.hammerex_app_templates (
  slug, name, theme_name, theme_bg_color, theme_accent_color, theme_ink_color,
  hero_layout, feed_layout, preview_image_url, description, min_tier, is_default, sort_order
) values (
  'template-12',
  'Oak',
  'Oak',
  '#F5EDDF',
  '#8B5A2B',
  '#3D2914',
  'hero-wow-split-cream',
  'tabbed-live-feed',
  'https://ik.imagekit.io/9mrgsv2rp/15b7014afd1bcaeff30d0013a0fe95d8.jpg',
  'Warm-wood oak template. Reference design: Aidan Frost (canopy specialist, Cheshire). Best fit for bespoke oak-frame trades — porch canopies, veranda canopies, car canopies, timber-frame extensions.',
  'app_paid',
  false,
  12
) on conflict (slug) do nothing;
