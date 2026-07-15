-- App template rows for the 9 new canteens shipped 2026-07-15.
--
-- Keeps the template library 1:1 with the canteens Philip sees in the
-- picker. Layout tokens (hero_layout + feed_layout) mirror template-1
-- since layout is currently a fixed design — only the palette varies.
-- When a template diverges structurally (e.g. own hero composition),
-- swap the layout slugs and teach the canteen shell to dispatch.
--
-- Templates 3-11 map to:
--   3  Mortar/Poppy    → Plasterers                (uk-plasterers)
--   4  Oak             → Furniture Makers          (uk-furniture-makers)
--   5  Timber          → Wood Carvers              (uk-wood-carvers)
--   6  Oak             → Wood Restorers            (uk-wood-restorers)
--   7  Timber          → Wood Stainers             (uk-wood-stainers)
--   8  Oak             → Tree House Builders       (uk-tree-house-builders)
--   9  Aqua            → Water Feature Specialists (uk-water-feature-specialists)
--   10 Mortar/Poppy    → Guttering + Downpipes     (uk-guttering-downpipes)
--   11 Copper          → Copper Flashing           (uk-copper-flashing-specialists)

insert into public.hammerex_app_templates (
  slug, name, theme_name, theme_bg_color, theme_accent_color, theme_ink_color,
  hero_layout, feed_layout, preview_image_url, description, min_tier, is_default, sort_order
) values
  (
    'template-3', 'Poppy', 'Poppy',
    '#FEF2F2', '#DC2626', '#450A0A',
    'hero-wow-split-cream', 'tabbed-live-feed',
    'https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%206,%202026,%2002_18_53%20AM.png',
    'Bold red-accent template on a warm ivory surface. Reference design: Lucas Hensley (plasterer, Bristol). Best fit for trades that want to stand out — plasterers, signwriters, emergency callouts.',
    'app_paid', false, 3
  ),
  (
    'template-4', 'Oak', 'Oak',
    '#F5EDDF', '#8B5A2B', '#3D2914',
    'hero-wow-split-cream', 'tabbed-live-feed',
    'https://ik.imagekit.io/9mrgsv2rp/6b868b252c0a43aa5d826da447c349a7.jpg',
    'Warm-wood oak template — medium-brown accent on cream. Reference design: Harriet Blake (furniture maker, Cotswolds). Best fit for cabinet makers, furniture commissioners, carpenters, joiners.',
    'app_paid', false, 4
  ),
  (
    'template-5', 'Timber', 'Timber',
    '#1F1410', '#B8722E', '#F5F0EB',
    'hero-wow-split-cream', 'tabbed-live-feed',
    'https://ik.imagekit.io/9mrgsv2rp/93bf4c7289b643b54c98fec085a28aa2.jpg',
    'Dark warm timber template — bronze accent on deep espresso surface. Reference design: Callum Ford (wood carver, Cornwall). Best fit for bespoke joiners, wood carvers, luxury craftwork.',
    'app_paid', false, 5
  ),
  (
    'template-6', 'Oak', 'Oak',
    '#F5EDDF', '#8B5A2B', '#3D2914',
    'hero-wow-split-cream', 'tabbed-live-feed',
    'https://ik.imagekit.io/9mrgsv2rp/fdfb32014411b6719f4d60a09b4f5292.jpg',
    'Warm-wood oak template. Reference design: Miles Warrington (wood restorer, Bath). Best fit for heritage timber restoration, antique furniture repair, reclaimed beam salvage.',
    'app_paid', false, 6
  ),
  (
    'template-7', 'Timber', 'Timber',
    '#1F1410', '#B8722E', '#F5F0EB',
    'hero-wow-split-cream', 'tabbed-live-feed',
    'https://ik.imagekit.io/9mrgsv2rp/f6906127ca6b272c347366e0ec1049f9.jpg',
    'Dark warm timber template. Reference design: Ryan Hollis (wood stainer, Manchester). Best fit for finishers, French polishers, spray-booth trades.',
    'app_paid', false, 7
  ),
  (
    'template-8', 'Oak', 'Oak',
    '#F5EDDF', '#8B5A2B', '#3D2914',
    'hero-wow-split-cream', 'tabbed-live-feed',
    'https://ik.imagekit.io/9mrgsv2rp/2a103a44bcbcea865e53a0eb865667c7.jpg',
    'Warm-wood oak template. Reference design: Rowan Ashcroft (tree house builder, Devon). Best fit for bespoke outdoor build trades — tree houses, garden cabins, treehouse-hotel operators.',
    'app_paid', false, 8
  ),
  (
    'template-9', 'Aqua', 'Aqua',
    '#ECFEFF', '#0891B2', '#164E63',
    'hero-wow-split-cream', 'tabbed-live-feed',
    'https://ik.imagekit.io/9mrgsv2rp/9b08d4bb58890f657a357d12d48e5f6a.jpg',
    'Fresh water-leisure aqua template — teal accent on pale ice-blue. Reference design: Tobias Marlow (water feature specialist, Bath). Best fit for pool builders, water feature installers, spa fitters.',
    'app_paid', false, 9
  ),
  (
    'template-10', 'Poppy', 'Poppy',
    '#FEF2F2', '#DC2626', '#450A0A',
    'hero-wow-split-cream', 'tabbed-live-feed',
    'https://ik.imagekit.io/9mrgsv2rp/85cbf19d75ffa14ffde727e9821f4616.jpg',
    'Bold red-accent template. Reference design: Dylan Reid (guttering specialist, Sheffield). Best fit for rainwater-goods, fascia + soffit, urgent-repair rainwater trades.',
    'app_paid', false, 10
  ),
  (
    'template-11', 'Copper', 'Copper',
    '#F5EFE6', '#B87333', '#3D2914',
    'hero-wow-split-cream', 'tabbed-live-feed',
    'https://ik.imagekit.io/9mrgsv2rp/b3785840d16b30030c7caea90d062172.jpg',
    'Artisan copper template — patina-brown accent on warm ivory. Reference design: Wilf Adair (copper flashing specialist, York). Best fit for coppersmiths, lead workers, heritage-metal roofers.',
    'app_paid', false, 11
  )
on conflict (slug) do nothing;
