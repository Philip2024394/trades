// Seed showcase data for demo-* profiles so their surfaces render
// with real content instead of empty states. Every row is tied to an
// existing demo listing — nothing invents personas, only the DATA is
// created. Real (non-demo) trades' surfaces stay untouched.
//
// What this creates:
//   • 12 live material prices across 4 demo merchants
//   • 8 live yard product/tools-sell posts across 5 demo trades
//   • 10 public activity events (beacon_fired, thread_hot, trade_joined)
//     referencing demo actions

import { readFileSync } from "node:fs";

const envText = readFileSync(
  "C:\\Users\\Victus\\hammer\\.env.tools.local",
  "utf-8"
);
const token = envText.match(/^SUPABASE_ACCESS_TOKEN=(.+)$/m)[1].trim();
const ref = "msdonkkechxzgagyguoe";

async function q(sql) {
  const r = await fetch(
    `https://api.supabase.com/v1/projects/${ref}/database/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ query: sql })
    }
  );
  const text = await r.text();
  if (!r.ok) {
    console.error(`SQL failed: ${r.status}`);
    console.error(text);
    throw new Error("SQL execution failed");
  }
  return JSON.parse(text);
}

// Get IDs for the top demo merchants + trades
const listings = await q(`
  SELECT id, slug, display_name, primary_trade, city
  FROM hammerex_trade_off_listings
  WHERE slug IN (
    'demo-richard-holt-builders-supplies-leeds',
    'demo-stuart-kingsley-building-merchant-hull',
    'demo-manchester-plasterboard',
    'demo-mike-watson-drywall-manchester',
    'demo-tom-bridges-scaffolding-leeds',
    'demo-jamie-mclean-electrician-edinburgh',
    'demo-marcus-okafor-drywaller-manchester',
    'demo-billy-ahmed-scaffolder-birmingham'
  )
`);

const bySlug = Object.fromEntries(listings.map((l) => [l.slug, l]));
function req(slug) {
  if (!bySlug[slug]) {
    console.warn(`Warning: demo listing ${slug} not found — skipping rows using it`);
    return null;
  }
  return bySlug[slug];
}

// ── Material prices ─────────────────────────────────────────────────
const priceSeeds = [
  {
    slug: "demo-richard-holt-builders-supplies-leeds",
    items: [
      { label: "OSB3 board 18mm 8x4", slug: "osb3-18mm-8x4", unit: "sheet", pence: 3200, postcode: "LS1", region: "Leeds" },
      { label: "Plasterboard 12.5mm 8x4", slug: "plasterboard-12-5mm", unit: "sheet", pence: 950, postcode: "LS1", region: "Leeds" },
      { label: "50kg bag ballast", slug: "ballast-50kg-bag", unit: "bag", pence: 350, postcode: "LS1", region: "Leeds" },
      { label: "6-inch angle iron 2m", slug: "angle-iron-6-inch-2m", unit: "length", pence: 1200, postcode: "LS1", region: "Leeds" }
    ]
  },
  {
    slug: "demo-manchester-plasterboard",
    items: [
      { label: "Plasterboard 12.5mm 8x4", slug: "plasterboard-12-5mm", unit: "sheet", pence: 890, postcode: "M3", region: "Manchester" },
      { label: "Plasterboard 15mm 8x4 fire-rated", slug: "plasterboard-15mm-fire", unit: "sheet", pence: 1450, postcode: "M3", region: "Manchester" },
      { label: "Skim finish 25kg", slug: "skim-finish-25kg", unit: "bag", pence: 1050, postcode: "M3", region: "Manchester" },
      { label: "Metal C-stud 70mm x 3m", slug: "c-stud-70mm-3m", unit: "length", pence: 480, postcode: "M3", region: "Manchester" }
    ]
  },
  {
    slug: "demo-stuart-kingsley-building-merchant-hull",
    items: [
      { label: "Cement 25kg bag", slug: "cement-25kg", unit: "bag", pence: 620, postcode: "HU1", region: "Hull" },
      { label: "Common bricks (per 500)", slug: "common-bricks-500", unit: "pack", pence: 22500, qty: 500, postcode: "HU1", region: "Hull" },
      { label: "Sharp sand tonne bag", slug: "sharp-sand-tonne", unit: "tonne bag", pence: 6200, postcode: "HU1", region: "Hull" }
    ]
  },
  {
    slug: "demo-mike-watson-drywall-manchester",
    items: [
      { label: "Drywall screw 25mm (1000 pack)", slug: "drywall-screw-25mm-1000", unit: "box", qty: 1000, pence: 850, postcode: "M3", region: "Manchester" }
    ]
  }
];

let priceInsertCount = 0;
for (const seed of priceSeeds) {
  const listing = req(seed.slug);
  if (!listing) continue;
  for (const item of seed.items) {
    const qty = item.qty ?? 1;
    await q(`
      INSERT INTO hammerex_material_prices (
        merchant_listing_id, item_slug, item_label, unit_label,
        price_pence, currency, qty_included,
        postcode_prefix, region, is_live, expires_at
      ) VALUES (
        '${listing.id}',
        '${item.slug}',
        '${item.label.replace(/'/g, "''")}',
        '${item.unit.replace(/'/g, "''")}',
        ${item.pence},
        'GBP',
        ${qty},
        '${item.postcode}',
        '${item.region}',
        true,
        now() + interval '14 days'
      )
      ON CONFLICT (merchant_listing_id, item_slug)
      DO UPDATE SET
        price_pence = EXCLUDED.price_pence,
        item_label = EXCLUDED.item_label,
        unit_label = EXCLUDED.unit_label,
        is_live = true,
        expires_at = EXCLUDED.expires_at
    `);
    priceInsertCount++;
  }
}
console.log(`Prices seeded: ${priceInsertCount}`);


// ── Yard product/tools-sell posts ──────────────────────────────────
const postSeeds = [
  {
    slug: "demo-richard-holt-builders-supplies-leeds",
    posts: [
      { kind: "product", title: "Bulk OSB3 pallet — 50 sheets 18mm", body: "Trade discount available. Collection Leeds, delivery within LS postcodes.", pence: 145000, currency: "GBP", condition: "new", stock: 3 },
      { kind: "tools-sell", title: "Concrete mixer 90L belt-drive", body: "Ex-hire, serviced Feb 2026. Full working order, new brushes fitted.", pence: 28000, condition: "used-good", stock: 1 }
    ]
  },
  {
    slug: "demo-tom-bridges-scaffolding-leeds",
    posts: [
      { kind: "tools-sell", title: "20x scaffold boards 3.9m", body: "3-year-old boards, scan-tag on each. Selling due to yard downsize.", pence: 45000, condition: "used-good", stock: 20 }
    ]
  },
  {
    slug: "demo-mike-watson-drywall-manchester",
    posts: [
      { kind: "tools-sell", title: "Festool Planex sander LHS-E 225", body: "Fully working, comes with 2 backing pads and case. Manchester collection.", pence: 62000, condition: "used-like-new", stock: 1 }
    ]
  },
  {
    slug: "demo-jamie-mclean-electrician-edinburgh",
    posts: [
      { kind: "tools-sell", title: "Megger MFT1741+ tester (calibrated)", body: "Calibrated Jan 2026, cert available. Selling as upgraded to MFT1832.", pence: 55000, condition: "used-like-new", stock: 1 },
      { kind: "materials-surplus", title: "6mm T&E cable — 80m surplus", body: "Excess from job, unopened drums. Trade collection Edinburgh EH1.", pence: 12000, condition: "new", stock: 80 }
    ]
  },
  {
    slug: "demo-billy-ahmed-scaffolder-birmingham",
    posts: [
      { kind: "tools-rent", title: "Aluminium mobile tower 3m platform", body: "Day-hire rate. Tag-scanned, LOLER cert current. Birmingham area.", pence: 4500, condition: "used-good", stock: 1 }
    ]
  }
];

let postInsertCount = 0;
for (const seed of postSeeds) {
  const listing = req(seed.slug);
  if (!listing) continue;
  for (const post of seed.posts) {
    const currency = post.currency ?? "GBP";
    const condition = post.condition ?? "new";
    const stock = post.stock ?? 1;
    await q(`
      INSERT INTO hammerex_trade_off_yard_posts (
        listing_id, kind, trade_slug, title, body, country, region,
        product_price_pence, price_currency, condition, stock_qty,
        image_urls, status, audience_reach, expires_at
      ) VALUES (
        '${listing.id}',
        '${post.kind}',
        '${listing.primary_trade}',
        '${post.title.replace(/'/g, "''")}',
        '${post.body.replace(/'/g, "''")}',
        'UK',
        '${(listing.city ?? "").replace(/'/g, "''")}',
        ${post.pence},
        '${currency}',
        '${condition}',
        ${stock},
        '{}',
        'live',
        'feed',
        now() + interval '14 days'
      )
    `);
    postInsertCount++;
  }
}
console.log(`Yard posts seeded: ${postInsertCount}`);


// ── Public activity events ─────────────────────────────────────────
const activitySeeds = [
  { kind: "beacon_fired", slug: "demo-richard-holt-builders-supplies-leeds", summary: "A merchant in Leeds fired a beacon — nearby trades responding now.", trade: "building-merchant", city: "Leeds" },
  { kind: "trade_joined", slug: "demo-jamie-mclean-electrician-edinburgh", summary: "A new electrician in Edinburgh joined the Notebook.", trade: "electrician", city: "Edinburgh" },
  { kind: "thread_hot", slug: "demo-marcus-okafor-drywaller-manchester", summary: "A drywaller in Manchester replied on a Yard thread.", trade: "drywaller", city: "Manchester" },
  { kind: "trade_joined", slug: "demo-tom-bridges-scaffolding-leeds", summary: "A scaffolder in Leeds joined the Notebook.", trade: "scaffolder", city: "Leeds" },
  { kind: "project_posted", slug: null, summary: "New kitchen project in Manchester.", trade: null, city: "Manchester" },
  { kind: "trade_joined", slug: "demo-billy-ahmed-scaffolder-birmingham", summary: "A new scaffolder in Birmingham joined the Notebook.", trade: "scaffolder", city: "Birmingham" },
  { kind: "beacon_fired", slug: "demo-mike-watson-drywall-manchester", summary: "A drywaller in Manchester fired a beacon — nearby trades responding now.", trade: "drywaller", city: "Manchester" },
  { kind: "project_posted", slug: null, summary: "New bathroom project in Leeds.", trade: null, city: "Leeds" },
  { kind: "trade_joined", slug: "demo-manchester-plasterboard", summary: "A plasterboard merchant in Manchester joined the Notebook.", trade: "building-merchant", city: "Manchester" },
  { kind: "thread_hot", slug: "demo-jamie-mclean-electrician-edinburgh", summary: "An electrician in Edinburgh replied on a Yard thread.", trade: "electrician", city: "Edinburgh" }
];

let activityInsertCount = 0;
const now = Date.now();
for (let i = 0; i < activitySeeds.length; i++) {
  const seed = activitySeeds[i];
  const listing = seed.slug ? req(seed.slug) : null;
  const createdAt = new Date(now - (i + 1) * 8 * 60 * 1000).toISOString();
  await q(`
    INSERT INTO os_activity_events (
      kind, is_public, source_listing_id, source_trade, source_city,
      summary_text, created_at, expires_at
    ) VALUES (
      '${seed.kind}',
      true,
      ${listing ? `'${listing.id}'` : "NULL"},
      ${seed.trade ? `'${seed.trade}'` : "NULL"},
      ${seed.city ? `'${seed.city.replace(/'/g, "''")}'` : "NULL"},
      '${seed.summary.replace(/'/g, "''")}',
      '${createdAt}',
      now() + interval '3 days'
    )
  `);
  activityInsertCount++;
}
console.log(`Activity events seeded: ${activityInsertCount}`);

console.log("\n── Verification ──");
const counts = await q(`
  SELECT
    (SELECT count(*) FROM hammerex_material_prices WHERE is_live = true AND expires_at > now()) AS prices,
    (SELECT count(*) FROM hammerex_trade_off_yard_posts WHERE status = 'live' AND expires_at > now() AND kind IN ('product','tools-sell','tools-rent','materials-surplus')) AS yard_shop_posts,
    (SELECT count(*) FROM os_activity_events WHERE is_public = true AND expires_at > now()) AS public_events
`);
console.log(counts[0]);
