-- Seed the "Hammerex Direct" merchant canteen + pilot product batch.
--
-- Purpose (Philip 2026-07-16): pilot the Hammerex → Networkers
-- migration on one product with full fidelity. If the leather tool
-- belt PDP renders identically to hammerexdirect.com, we scale to the
-- rest of the catalogue via the review-queue script.
--
-- Products inserted:
--   1. HX-LB2-001 — Hammerex 2" Heavy-Duty Leather Tool Belt (anchor)
--   2. HX-LNYRD-001 — Tool Lanyard 1.5m (Deal Breaker add-on)
--   3. HX-GCLIP-001 — Heavy Duty Glove Clip (Deal Breaker add-on)
--   4. HX-SGLV-001 — Scaffolders Gloves (Deal Breaker add-on)
--   5. HX-TBAG-001 — Heavy Duty Tool Bag (Deal Breaker add-on)
--
-- All 5 rows carry: ref, price_gbp + price_idr (dual currency), full
-- description, specs, category, commerce (brand, warranty, country).
-- The anchor product also carries an addon_bundle JSONB referencing
-- the 4 add-ons at their deal prices.
--
-- IDR → GBP conversion at time of migration: Rp 20,000 ≈ £1.00
-- (indicative rate; canonical price is IDR per
-- project_hammerex_pricing_fx.md).
--
-- Idempotent via ON CONFLICT (slug / id) DO NOTHING so the migration
-- can be re-applied without duplication.

begin;

-- Fixed UUIDs so the addon_bundle JSONB can reference the add-ons
-- by ID before they're inserted. Also makes the migration re-runnable
-- and lets follow-up admin queries find the exact rows.
do $$
declare
  v_canteen_id       uuid := '11111111-1111-1111-1111-000000000001';
  v_product_belt     uuid := '11111111-1111-1111-1111-000000000010';
  v_product_lanyard  uuid := '11111111-1111-1111-1111-000000000011';
  v_product_glove    uuid := '11111111-1111-1111-1111-000000000012';
  v_product_sgloves  uuid := '11111111-1111-1111-1111-000000000013';
  v_product_toolbag  uuid := '11111111-1111-1111-1111-000000000014';
begin

-- ── 1. Canteen ────────────────────────────────────────────────────
insert into public.hammerex_canteens (
  id, slug, name, tagline, trade_slug, trade_label, host_slug,
  host_display_name, header_bg_url, is_founding_100
) values (
  v_canteen_id,
  'hammerex-direct',
  'Hammerex Direct',
  'British-made tool belts, bags, and site kit. Direct from the brand — 6 years running, formerly UK-distributed for 12.',
  'building-merchant',
  'Building Merchant',
  'hammerex-direct',
  'Hammerex Direct',
  'https://ik.imagekit.io/pinky/Untitleddfsfsdfsdfsdf.png',
  true
)
on conflict (slug) do nothing;

-- ── 2. Admin member (host) with WhatsApp for buyer contact ────────
insert into public.hammerex_canteen_members (
  canteen_id, member_slug, display_name, trade_label, city,
  role, whatsapp, bio_short,
  verified_companies_house
) values (
  v_canteen_id,
  'hammerex-direct',
  'Hammerex Direct',
  'Building Merchant',
  'United Kingdom',
  'admin',
  '+447000000000',
  'Direct-from-brand tool belts and site kit. Every product tested by working trades before it ships.',
  true
)
on conflict do nothing;

-- ── 3a. Deal Breaker add-ons — inserted FIRST so the belt can
--       reference them in its addon_bundle JSONB. ─────────────────

-- Tool Lanyard 1.5m
insert into public.hammerex_canteen_products (
  id, canteen_id, host_slug, name, ref, blurb, description,
  image_url, price_gbp, price_idr, currency,
  category_slug, specs,
  show_in_canteen_products, show_in_trending, show_in_trade_center,
  commerce
) values (
  v_product_lanyard,
  v_canteen_id,
  'hammerex-direct',
  'Hammerex Tool Lanyard 1.5m',
  'HX-LNYRD-001',
  'Heavy-duty coiled tool lanyard with sprung carabiners at both ends. Rated for hand-tools up to 1kg.',
  'Coiled elastic lanyard extends to 1.5m and retracts back to 30cm to keep it out of the way. Sprung metal carabiners at both ends — one to your belt loop, one to the tool. Rated for tools up to 1kg.',
  'https://ik.imagekit.io/pinky/lanyard.png',
  8,
  160000,
  'GBP',
  'hand-tools',
  ARRAY['1.5m fully extended','Coils back to 30cm','Sprung metal carabiners','1kg working load']::text[],
  true, true, true,
  jsonb_build_object(
    'brand', 'Hammerex',
    'condition', 'new',
    'countryOfOrigin', 'United Kingdom',
    'warranty', jsonb_build_object('months', 12),
    'shipping', jsonb_build_object('freeLocalShipping', false, 'localShippingGbp', 4)
  )
)
on conflict (id) do nothing;

-- Heavy Duty Glove Clip
insert into public.hammerex_canteen_products (
  id, canteen_id, host_slug, name, ref, blurb, description,
  image_url, price_gbp, price_idr, currency,
  category_slug, specs,
  show_in_canteen_products, show_in_trending, show_in_trade_center,
  commerce
) values (
  v_product_glove,
  v_canteen_id,
  'hammerex-direct',
  'Hammerex Heavy Duty Glove Clip',
  'HX-GCLIP-001',
  'Steel-sprung belt clip that holds a pair of work gloves. Stops the "where did I put my gloves" waste.',
  'Zinc-plated steel spring clip that snaps onto any belt up to 2.5" wide. Holds a pair of folded work gloves so they''re always to hand. No fumbling in pockets, no lost gloves on site.',
  'https://ik.imagekit.io/pinky/gloveclip.png',
  6,
  120000,
  'GBP',
  'hand-tools',
  ARRAY['Zinc-plated steel','Fits belts up to 2.5" wide','Sprung jaw for one-hand load']::text[],
  true, true, true,
  jsonb_build_object(
    'brand', 'Hammerex',
    'condition', 'new',
    'countryOfOrigin', 'United Kingdom',
    'warranty', jsonb_build_object('months', 12)
  )
)
on conflict (id) do nothing;

-- Scaffolders Gloves
insert into public.hammerex_canteen_products (
  id, canteen_id, host_slug, name, ref, blurb, description,
  image_url, price_gbp, price_idr, currency,
  category_slug, specs,
  show_in_canteen_products, show_in_trending, show_in_trade_center,
  commerce
) values (
  v_product_sgloves,
  v_canteen_id,
  'hammerex-direct',
  'Hammerex Scaffolders Gloves',
  'HX-SGLV-001',
  'Heavy leather palm, cut-resistant liner, reinforced knuckles. Built for scaffolders and steel-fixers.',
  'Grain-leather palm resists abrasion from steel tube and clamps. Cut-resistant liner meets EN388 Level 5. Reinforced knuckle panel absorbs impact when you slip while lifting a lift-plank. Thumb saddle stitched with kevlar for repeated grip cycles.',
  'https://ik.imagekit.io/pinky/sgloves.png',
  12,
  240000,
  'GBP',
  'safety-ppe',
  ARRAY['Grain-leather palm','EN388 Level 5 cut','Kevlar-stitched thumb saddle','Reinforced knuckle panel']::text[],
  true, true, true,
  jsonb_build_object(
    'brand', 'Hammerex',
    'condition', 'new',
    'countryOfOrigin', 'United Kingdom',
    'warranty', jsonb_build_object('months', 12)
  )
)
on conflict (id) do nothing;

-- Heavy Duty Tool Bag
insert into public.hammerex_canteen_products (
  id, canteen_id, host_slug, name, ref, blurb, description,
  image_url, price_gbp, price_idr, currency,
  category_slug, specs,
  show_in_canteen_products, show_in_trending, show_in_trade_center,
  commerce
) values (
  v_product_toolbag,
  v_canteen_id,
  'hammerex-direct',
  'Hammerex Heavy Duty Tool Bag',
  'HX-TBAG-001',
  '18" reinforced tool bag with steel-frame mouth, 12 external pockets, and a padded shoulder strap.',
  'Twin-handled canvas tool bag with steel-frame mouth so it stays open while you dig through it. 12 external pockets for hand-tools, 4 internal partitions for power-tool cases. Padded shoulder strap adjusts to sling across the back on a climb. Rated for 20kg loaded.',
  'https://ik.imagekit.io/pinky/toolbag.png',
  30,
  600000,
  'GBP',
  'hand-tools',
  ARRAY['18" long','Steel-frame mouth stays open','12 external pockets','Padded shoulder strap','20kg working load']::text[],
  true, true, true,
  jsonb_build_object(
    'brand', 'Hammerex',
    'condition', 'new',
    'countryOfOrigin', 'United Kingdom',
    'warranty', jsonb_build_object('months', 12),
    'shipping', jsonb_build_object('freeLocalShipping', false, 'localShippingGbp', 7)
  )
)
on conflict (id) do nothing;

-- ── 3b. Anchor product — Heavy Duty Leather Tool Belt ─────────────
--
-- Deal Breaker bundle references the 4 add-ons at their discounted
-- deal prices (per the original Hammerex seed data):
--   Tool Lanyard   RRP £8   → Deal £5
--   Glove Clip     RRP £6   → Deal £4
--   Scaff Gloves   RRP £12  → Deal £8
--   Tool Bag       RRP £30  → Deal £22
insert into public.hammerex_canteen_products (
  id, canteen_id, host_slug, name, ref, blurb, description,
  image_url, price_gbp, price_idr, currency,
  category_slug, specs, featured,
  show_in_canteen_products, show_in_trending, show_in_trade_center,
  commerce, addon_bundle
) values (
  v_product_belt,
  v_canteen_id,
  'hammerex-direct',
  'Hammerex 2" Heavy-Duty Leather Tool Belt',
  'HX-LB2-001',
  'Premium 2" heavy-duty leather work belt with twin pin steel buckle. Built to carry pouches, tapes, and cordless holsters all day without stretching.',
  E'Hammerex 2-inch leather work belt, cut from vegetable-tanned full-grain hide and folded on itself so the working edge is double-thickness. Twin pin steel buckle stays put under load — no more single-pin slippage when a heavy pouch pulls on one side.\n\nSized to fit waist 30" through 46" with 10 roller holes so it dials in exactly right. Thread colour is black by default; upgrade to yellow, red, or brown for £2.50 extra (choose at checkout).\n\nMade in the United Kingdom. Backed by a one-year workshop warranty on stitching and buckle — if the pin ever bends or the leather delaminates in year one, we replace it.',
  'https://ik.imagekit.io/pinky/Untitleddfsfsdfsdfsdf.png',
  9,
  179800,
  'GBP',
  'safety-ppe',
  ARRAY[
    '2" wide (50mm)',
    'Full-grain vegetable-tanned leather',
    'Double-thickness folded edge',
    'Twin pin heavy-duty steel buckle',
    '10 roller holes — fits 30" to 46" waist',
    'Optional thread colour upgrade at checkout',
    'Made in the United Kingdom'
  ]::text[],
  true,
  true, true, true,
  jsonb_build_object(
    'brand', 'Hammerex',
    'model', 'HX-LB2',
    'condition', 'new',
    'countryOfOrigin', 'United Kingdom',
    'warranty', jsonb_build_object('months', 12),
    'shipping', jsonb_build_object(
      'freeLocalShipping', false,
      'localShippingGbp', 5,
      'shipsInternationally', true
    )
  ),
  jsonb_build_array(
    jsonb_build_object(
      'productId',    v_product_lanyard::text,
      'dealPriceGbp', 5,
      'dealPriceIdr', 100000,
      'label',        'Tool Lanyard 1.5m'
    ),
    jsonb_build_object(
      'productId',    v_product_glove::text,
      'dealPriceGbp', 4,
      'dealPriceIdr', 80000,
      'label',        'Heavy Duty Glove Clip'
    ),
    jsonb_build_object(
      'productId',    v_product_sgloves::text,
      'dealPriceGbp', 8,
      'dealPriceIdr', 160000,
      'label',        'Scaffolders Gloves'
    ),
    jsonb_build_object(
      'productId',    v_product_toolbag::text,
      'dealPriceGbp', 22,
      'dealPriceIdr', 440000,
      'label',        'Heavy Duty Tool Bag'
    )
  )
)
on conflict (id) do nothing;

end $$;

commit;
