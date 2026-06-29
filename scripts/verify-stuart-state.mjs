// Full state check for Stuart Kingsley's demo profile — what's wired
// up, what's connected, what's missing.

import { readFileSync } from "node:fs";

const envText = readFileSync("C:\\Users\\Victus\\hammer\\.env.tools.local", "utf-8");
const token = envText.match(/^SUPABASE_ACCESS_TOKEN=(.+)$/m)[1].trim();
const ref = "msdonkkechxzgagyguoe";
const SLUG = "demo-stuart-kingsley-building-merchant-hull";

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

const listing = (await q(`
  SELECT id, slug, display_name, primary_trade, city, country, status,
         tier, trial_expires_at, paid_expires_at, edit_token,
         addons_enabled, whatsapp, email, bio IS NOT NULL AS has_bio,
         jsonb_array_length(COALESCE(team_members, '[]'::jsonb)) AS team_n,
         array_length(photos, 1) AS photo_n,
         years_in_trade
  FROM hammerex_trade_off_listings WHERE slug = '${SLUG}'
`))[0];

const productsAgg = (await q(`
  SELECT
    COUNT(*) FILTER (WHERE status='live') AS live,
    COUNT(*) FILTER (WHERE status='archived') AS archived,
    COUNT(*) FILTER (WHERE status='live' AND kind='product') AS live_products,
    COUNT(*) FILTER (WHERE status='live' AND kind='service') AS live_services
  FROM hammerex_xrated_products WHERE listing_id = '${listing.id}'
`))[0];

const picks = (await q(`
  SELECT sort_order, status, banner_image_url IS NOT NULL AS has_banner,
         expires_at IS NOT NULL AS has_expiry
  FROM hammerex_xrated_trade_center_picks
  WHERE listing_id = '${listing.id}' ORDER BY sort_order
`));

const reviews = (await q(`
  SELECT COUNT(*) AS n, ROUND(AVG(overall_rating)::numeric, 2) AS avg
  FROM hammerex_xrated_reviews WHERE listing_id = '${listing.id}'
`))[0];

const faqRows = (await q(`
  SELECT jsonb_array_length(COALESCE(faq_items, '[]'::jsonb)) AS n
  FROM hammerex_trade_off_listings WHERE id = '${listing.id}'
`))[0];

const downloads = (await q(`
  SELECT COUNT(*) AS n FROM hammerex_xrated_downloads WHERE listing_id = '${listing.id}'
`))[0];

const operatingHours = (await q(`
  SELECT operating_hours IS NOT NULL AS has_hours
  FROM hammerex_trade_off_listings WHERE id = '${listing.id}'
`))[0];

console.log("=".repeat(60));
console.log("STUART KINGSLEY — DEMO STATE CHECK");
console.log("=".repeat(60));
console.log(`\n--- CORE LISTING ---`);
console.log(`Slug:          ${listing.slug}`);
console.log(`Listing ID:    ${listing.id}`);
console.log(`Trade:         ${listing.primary_trade}`);
console.log(`City/Country:  ${listing.city} / ${listing.country}`);
console.log(`Status:        ${listing.status}`);
console.log(`Tier:          ${listing.tier}`);
console.log(`Trial exp:     ${listing.trial_expires_at ?? "—"}`);
console.log(`Paid exp:      ${listing.paid_expires_at ?? "—"}`);
console.log(`WhatsApp:      ${listing.whatsapp}`);
console.log(`Email:         ${listing.email}`);
console.log(`Has bio:       ${listing.has_bio}`);
console.log(`Years:         ${listing.years_in_trade ?? "—"}`);
console.log(`Photos:        ${listing.photo_n ?? 0}`);
console.log(`Has hours:     ${operatingHours.has_hours}`);

console.log(`\n--- DASHBOARD ACCESS ---`);
console.log(`Edit token:    ${listing.edit_token ? "set" : "MISSING"}`);
if (listing.edit_token) {
  console.log(`Dashboard URL: http://localhost:3008/trade-off/edit/${listing.slug}?token=${listing.edit_token}`);
  console.log(`Public URL:    http://localhost:3008/${listing.slug}`);
}

console.log(`\n--- ADD-ONS ENABLED ---`);
console.log(JSON.stringify(listing.addons_enabled ?? {}, null, 2));

console.log(`\n--- DATA FEEDS ---`);
console.log(`Team members:    ${listing.team_n}`);
console.log(`Live products:   ${productsAgg.live_products}  (services: ${productsAgg.live_services})`);
console.log(`Archived prods:  ${productsAgg.archived}`);
console.log(`Reviews:         ${reviews.n} (avg ${reviews.avg ?? "—"})`);
console.log(`FAQ entries:     ${faqRows.n}`);
console.log(`Downloads:       ${downloads.n}`);

console.log(`\n--- TRADE CENTER PICKS ---`);
console.log(`Picks count:     ${picks.length}`);
picks.forEach((p) =>
  console.log(`  sort=${p.sort_order}  status=${p.status.padEnd(13)}  banner=${p.has_banner ? "yes" : "no "}  expires=${p.has_expiry ? "yes" : "no"}`)
);
