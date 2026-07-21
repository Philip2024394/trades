-- Curated badge overlays — industrial-styled promo badges the
-- merchant drops onto their canvas composition (e.g. "NEW ARRIVAL",
-- "JUST LANDED", "HOT OFF THE TRUCK"). Transparent PNGs served
-- from /public/badges/ so no Supabase Storage traffic needed.
--
-- Rendered by the Overlays drawer at /site/editor. Category `promo`
-- groups them alongside other promotional overlays. owner_merchant_slug
-- NULL = visible to every merchant.

INSERT INTO public.hammerex_site_editor_overlays (
  owner_merchant_slug, label, category, url, aspect_ratio, active
) VALUES
  (NULL, 'Hot Off The Truck',   'promo', '/badges/badge-01.png', 2.312, TRUE),
  (NULL, 'New This Week',       'promo', '/badges/badge-02.png', 2.646, TRUE),
  (NULL, 'Recently Added',      'promo', '/badges/badge-03.png', 2.053, TRUE),
  (NULL, 'Latest Release',      'promo', '/badges/badge-04.png', 2.149, TRUE),
  (NULL, 'New Product',         'promo', '/badges/badge-05.png', 2.108, TRUE),
  (NULL, 'Just Landed',         'promo', '/badges/badge-06.png', 1.717, TRUE),
  (NULL, 'New Arrival · Plate', 'promo', '/badges/badge-07.png', 2.068, TRUE),
  (NULL, 'New Arrival · Drill', 'promo', '/badges/badge-08.png', 1.951, TRUE),
  (NULL, 'Just Landed · Flight','promo', '/badges/badge-09.png', 2.290, TRUE);
