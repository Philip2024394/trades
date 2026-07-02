import { readFileSync } from "node:fs";
const envText = readFileSync("C:\\Users\\Victus\\hammer\\.env.tools.local", "utf-8");
const token = envText.match(/^SUPABASE_ACCESS_TOKEN=(.+)$/m)[1].trim();
const ref = "msdonkkechxzgagyguoe";

const r = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
  method: "POST",
  headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  body: JSON.stringify({
    query: `SELECT plant_hire->'categories' AS cats
              FROM hammerex_trade_off_listings
              WHERE slug='demo-russell-haines-plant-hire-leeds';`
  })
});
const j = await r.json();
const cats = j[0].cats;
const out = [];
for (const [slug, cfg] of Object.entries(cats)) {
  if (!cfg?.enabled) continue;
  out.push({
    slug,
    has_image: !!cfg.image_url,
    image_url: cfg.image_url?.slice(0, 60) ?? "",
    gallery_count: cfg.gallery_urls?.length ?? 0
  });
}
console.table(out);
