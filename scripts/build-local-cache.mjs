// Dump Russell + Stuart's full listing rows + related child tables via
// the Management API SQL endpoint (which bypasses the capped project
// REST API), so the dev server can render both profiles without ever
// hitting Supabase REST.

import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
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

const OUT = "C:\\Users\\Victus\\trades\\src\\lib\\cache";
mkdirSync(OUT, { recursive: true });

const SLUGS = [
  "demo-russell-haines-plant-hire-leeds",
  "demo-stuart-kingsley-building-merchant-hull"
];

const bundle = {};

for (const slug of SLUGS) {
  console.log(`Caching ${slug}...`);
  const [listing] = await q(
    `SELECT to_jsonb(l) AS row FROM hammerex_trade_off_listings l WHERE slug = '${slug}' LIMIT 1;`
  );
  if (!listing) {
    console.warn(`  ✗ Not found`);
    continue;
  }
  const row = listing.row;
  const id = row.id;

  const projects = (
    await q(
      `SELECT to_jsonb(p) AS r FROM hammerex_trade_off_projects p WHERE listing_id = '${id}' ORDER BY sort_order ASC;`
    )
  ).map((x) => x.r);

  const reviews = (
    await q(
      `SELECT id, customer_name, customer_postcode, customer_avatar_url, project_type, service_name,
              overall_rating, workmanship_rating, communication_rating, value_rating, timeliness_rating,
              body, status, public_response, submitted_at
         FROM hammerex_xrated_reviews
        WHERE listing_id = '${id}' AND status IN ('live','disputed') AND goes_live_at <= now()
        ORDER BY submitted_at DESC LIMIT 20;`
    )
  );

  const products = (
    await q(
      `SELECT to_jsonb(p) AS r FROM hammerex_xrated_products p
        WHERE listing_id = '${id}' AND status = 'live' ORDER BY sort_order ASC;`
    )
  ).map((x) => x.r);

  bundle[slug] = { listing: row, projects, reviews, products };
  console.log(
    `  ✓ ${row.display_name} — projects=${projects.length}, reviews=${reviews.length}, products=${products.length}`
  );
}

writeFileSync(`${OUT}\\profiles.json`, JSON.stringify(bundle, null, 2), "utf-8");
console.log(`\nWrote src/lib/cache/profiles.json (${Object.keys(bundle).length} profiles)`);
