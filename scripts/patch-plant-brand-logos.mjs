// Update plant_hire.plant_brands logo_url entries for every merchant
// that has plant hire configured. Runs against Russell Haines (plant
// hire yard) AND Stuart Kingsley (building merchant with plant hire
// add-on) — user asked for "plant and plant hire merchants".

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

// Brand name → new logo URL. Case-insensitive matching against the
// existing plant_brands array on each merchant's plant_hire config.
const LOGOS = {
  "Wacker Neuson":
    "https://ik.imagekit.io/9mrgsv2rp/Untitledsadassssddsddsddddfddxcxcxcxcxczxccccv.png",
  Takeuchi:
    "https://ik.imagekit.io/9mrgsv2rp/Untitledsadassssddsddsddddfddxcxcxcxcxczxcccc.png",
  Thwaites:
    "https://ik.imagekit.io/9mrgsv2rp/Untitledsadassssddsddsddddfddxcxcxcxcxczxccc.png",
  Bobcat:
    "https://ik.imagekit.io/9mrgsv2rp/Untitledsadassssddsddsddddfddxcxcxcxcxczxc.png",
  Genie:
    "https://ik.imagekit.io/9mrgsv2rp/Untitledsadassssddsddsddddfddxcxcxcxc.png",
  Merlo:
    "https://ik.imagekit.io/9mrgsv2rp/Untitledsadassssddsddsddddfddxcxc.png",
  Manitou:
    "https://ik.imagekit.io/9mrgsv2rp/Untitledsadassssddsddsddddfddxc.png",
  Bomag:
    "https://ik.imagekit.io/9mrgsv2rp/Untitledsadassssddsddsddddfdd.png",
  Kubota:
    "https://ik.imagekit.io/9mrgsv2rp/Untitledsadassssddsddsddddfd.png",
  JCB: "https://ik.imagekit.io/9mrgsv2rp/Untitleddsdsdd.png"
};

const targets = await q(`
  SELECT slug, plant_hire->'plant_brands' AS plant_brands
    FROM hammerex_trade_off_listings
   WHERE addons_enabled ? 'plant_hire'
     AND (addons_enabled->>'plant_hire')::boolean = true
     AND jsonb_typeof(plant_hire->'plant_brands') = 'array';
`);

for (const row of targets) {
  const brands = Array.isArray(row.plant_brands) ? row.plant_brands : [];
  const next = brands.map((b) => {
    const match = Object.keys(LOGOS).find(
      (k) => k.toLowerCase() === (b.name ?? "").trim().toLowerCase()
    );
    return match ? { ...b, logo_url: LOGOS[match] } : b;
  });
  const changed = next.some((b, i) => b.logo_url !== brands[i].logo_url);
  if (!changed) {
    console.log(`- ${row.slug} — no matching brand names, skipped`);
    continue;
  }
  const upd = await q(`
    UPDATE hammerex_trade_off_listings
       SET plant_hire = jsonb_set(plant_hire, '{plant_brands}', '${JSON.stringify(next).replace(/'/g, "''")}'::jsonb, true)
     WHERE slug = '${row.slug}'
     RETURNING slug;
  `);
  const updated = next.filter((b, i) => b.logo_url !== brands[i].logo_url).map((b) => b.name);
  console.log(`✓ ${upd[0].slug} — updated: ${updated.join(", ")}`);
}
