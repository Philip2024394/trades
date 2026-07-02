// One-shot audit of Stuart's Building Merchant template state — what's
// filled, what's empty, what's rich, what's stub.

import { readFileSync } from "node:fs";
const envText = readFileSync("C:\\Users\\Victus\\hammer\\.env.tools.local", "utf-8");
const token = envText.match(/^SUPABASE_ACCESS_TOKEN=(.+)$/m)[1].trim();
const ref = "msdonkkechxzgagyguoe";

async function q(sql) {
  const r = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query: sql })
  });
  const txt = await r.text();
  if (!r.ok) throw new Error(`Supabase ${r.status}: ${txt}`);
  return JSON.parse(txt);
}

const slug = "demo-stuart-kingsley-building-merchant-hull";

const listing = (
  await q(`
    SELECT
      id, slug, display_name, primary_trade, city, tier, status,
      trading_name, whatsapp, phone, email, website, instagram, facebook,
      hero_text_line1, hero_text_line2, hero_text_tagline,
      theme_color, font_family, avatar_url, custom_app_hero_url,
      bio IS NOT NULL AND length(bio) > 20 AS has_bio,
      length(bio) AS bio_len,
      years_in_trade, is_insured, insurance_cover_gbp, dbs_checked,
      addons_enabled,
      jsonb_array_length(shop_categories) AS shop_cat_n,
      jsonb_array_length(priced_services) AS priced_service_n,
      array_length(services_offered, 1) AS services_offered_n,
      jsonb_array_length(team_members) AS team_n,
      jsonb_array_length(recommendations) AS recs_n,
      jsonb_array_length(faq_items) AS faq_n,
      array_length(photos, 1) AS photo_n,
      array_length(qualifications, 1) AS quals_n,
      array_length(trade_memberships, 1) AS memberships_n,
      video_url, video_caption,
      wholesale_origin_lat, wholesale_origin_lng, wholesale_origin_postcode,
      wholesale_currency, wholesale_prices_ex_vat,
      retail_shipping_mode,
      payment_provider, payment_provider_data,
      custom_domain, custom_domain_status,
      key_cutting IS NOT NULL AND key_cutting <> '{}'::jsonb AS has_key_cutting,
      plant_hire IS NOT NULL AND plant_hire <> '{}'::jsonb AS has_plant_hire,
      rating_avg, rating_count,
      whatsapp_click_count
    FROM hammerex_trade_off_listings
    WHERE slug = '${slug}';
  `)
)[0];

const products = (
  await q(`
    SELECT
      COUNT(*) FILTER (WHERE status = 'live') AS live_products,
      COUNT(*) FILTER (WHERE status = 'live' AND kind = 'product') AS live_stock,
      COUNT(*) FILTER (WHERE status = 'live' AND kind = 'service') AS live_service,
      COUNT(*) FILTER (WHERE status = 'live' AND cover_url IS NOT NULL) AS has_cover,
      COUNT(*) FILTER (WHERE status = 'live' AND slug IS NOT NULL) AS has_slug,
      COUNT(*) FILTER (WHERE status = 'live' AND featured_at IS NOT NULL) AS featured,
      COUNT(*) FILTER (WHERE status = 'live' AND jsonb_array_length(COALESCE(bulk_tiers, '[]'::jsonb)) > 0) AS with_bulk_tiers,
      COUNT(*) FILTER (WHERE status = 'live' AND merchant_category IS NOT NULL) AS categorised
    FROM hammerex_xrated_products
    WHERE listing_id = '${listing.id}';
  `)
)[0];

const zones = (
  await q(`
    SELECT
      COUNT(*) AS zone_rows,
      SUM(jsonb_array_length(banded_pricing)) AS total_bands
    FROM hammerex_xrated_wholesale_zones
    WHERE listing_id = '${listing.id}';
  `)
)[0];

const others = (
  await q(`
    SELECT
      (SELECT COUNT(*) FROM hammerex_xrated_downloads WHERE listing_id='${listing.id}' AND status='live') AS downloads,
      (SELECT COUNT(*) FROM hammerex_xrated_projects WHERE listing_id='${listing.id}' AND status='live') AS job_diary,
      (SELECT COUNT(*) FROM hammerex_trade_off_projects WHERE listing_id='${listing.id}') AS past_projects,
      (SELECT COUNT(*) FROM hammerex_xrated_trade_center_picks WHERE listing_id='${listing.id}') AS tc_picks,
      (SELECT COUNT(*) FROM hammerex_xrated_faq_items WHERE listing_id='${listing.id}' AND status='live') AS faq_items,
      (SELECT COUNT(*) FROM hammerex_xrated_merchant_picks WHERE tradie_listing_id='${listing.id}' AND status='live') AS materials_picks,
      (SELECT COUNT(*) FROM hammerex_xrated_shipping_zones WHERE listing_id='${listing.id}') AS shop_shipping_zones,
      (SELECT COUNT(*) FROM hammerex_xrated_newsletter_subscribers WHERE listing_id='${listing.id}' AND status='active') AS newsletter_subs;
  `)
)[0];

// Plant hire config summary
const ph = (
  await q(`
    SELECT
      plant_hire->'sections_enabled' AS sections,
      jsonb_array_length(COALESCE(plant_hire->'plant_brands','[]'::jsonb)) AS brands,
      jsonb_array_length(COALESCE(plant_hire->'delivery_zones','[]'::jsonb)) AS delivery_zones,
      jsonb_array_length(COALESCE(plant_hire->'waiver_options','[]'::jsonb)) AS waivers,
      jsonb_array_length(COALESCE(plant_hire->'bulk_tiers','[]'::jsonb)) AS bulk_tiers,
      jsonb_array_length(COALESCE(plant_hire->'faq','[]'::jsonb)) AS faq_n,
      (SELECT COUNT(*) FROM jsonb_object_keys(plant_hire->'categories')) AS categories_n
    FROM hammerex_trade_off_listings
    WHERE slug = '${slug}';
  `)
)[0];

console.log(JSON.stringify({ listing, products, zones, others, ph }, null, 2));
