// Seed Russell's trade counter: hero image URL + 24 realistic UK plant
// parts items across the 6 existing categories.

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

const hero = "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%202,%202026,%2003_42_48%20PM.png";

// Refresh categories with slugs so items can filter properly.
const categories = [
  { name: "Hydraulic hoses", slug: "hoses", description: "1/4\"–1\" BSP/JIC/ORFS. Cut + crimped while you wait.", manual_url: "", in_stock: true, lead_time: "Same day", icon_url: "" },
  { name: "Filters", slug: "filters", description: "Fuel, oil, air, hydraulic. Bring the machine PIN — we cross-reference.", manual_url: "", in_stock: true, lead_time: "Same day", icon_url: "" },
  { name: "Tracks & undercarriage", slug: "tracks", description: "Rubber + steel tracks, sprockets, idlers, rollers.", manual_url: "", in_stock: true, lead_time: "Next day", icon_url: "" },
  { name: "Buckets & attachments", slug: "buckets", description: "Digging buckets, grading buckets, quick-hitches.", manual_url: "", in_stock: false, lead_time: "3–5 days", icon_url: "" },
  { name: "Belts & drivetrain", slug: "belts", description: "Drive belts, alternator belts, fan blades — OEM references.", manual_url: "", in_stock: true, lead_time: "Same day", icon_url: "" },
  { name: "Lubricants & fluids", slug: "fluids", description: "Engine oil, hydraulic fluid (ISO 46/68), grease, coolant, AdBlue.", manual_url: "", in_stock: true, lead_time: "Same day", icon_url: "" }
];

// 24 realistic UK plant parts (prices are indicative but plausible).
const items = [
  // Filters
  { sku: "FIL-KX57-HYD", name: "Kubota KX057-4 hydraulic filter", brand: "Kubota", fits: "Kubota KX57-4, U55-4", category_slug: "filters", price_pence: 4250, image_url: "", in_stock: true, stock_count: 12, lead_time: "Same day", short_desc: "OEM-spec inner hydraulic filter for KX57-4 tank.", featured: true, manual_url: "" },
  { sku: "FIL-JCB-3CX-FUEL", name: "JCB 3CX fuel filter kit", brand: "JCB", fits: "JCB 3CX Series 3, 4CX", category_slug: "filters", price_pence: 3800, image_url: "", in_stock: true, stock_count: 8, lead_time: "Same day", short_desc: "Water separator + primary fuel filter combo.", featured: true, manual_url: "" },
  { sku: "FIL-CAT-320-AIR", name: "CAT 320D air filter (primary)", brand: "Caterpillar", fits: "CAT 320D, 323D", category_slug: "filters", price_pence: 5900, image_url: "", in_stock: true, stock_count: 4, lead_time: "Same day", short_desc: "Genuine Cat primary element.", featured: false, manual_url: "" },
  { sku: "FIL-KOM-PC138-OIL", name: "Komatsu PC138 engine oil filter", brand: "Komatsu", fits: "Komatsu PC138US-8, PC128US", category_slug: "filters", price_pence: 2200, image_url: "", in_stock: true, stock_count: 15, lead_time: "Same day", short_desc: "Spin-on oil filter, 15µm.", featured: false, manual_url: "" },
  // Hoses
  { sku: "HOS-14-BSP-500", name: "1/4\" BSP hydraulic hose · 500mm", brand: "Alfagomma", fits: "Universal — cut to length", category_slug: "hoses", price_pence: 1800, image_url: "", in_stock: true, stock_count: 30, lead_time: "Same day", short_desc: "R2AT-rated, 400 bar working pressure.", featured: true, manual_url: "" },
  { sku: "HOS-38-JIC-800", name: "3/8\" JIC hydraulic hose · 800mm", brand: "Alfagomma", fits: "Universal — cut to length", category_slug: "hoses", price_pence: 2600, image_url: "", in_stock: true, stock_count: 22, lead_time: "Same day", short_desc: "JIC 37° flare ends, R2AT.", featured: false, manual_url: "" },
  { sku: "HOS-12-ORFS-1M", name: "1/2\" ORFS hydraulic hose · 1m", brand: "Alfagomma", fits: "Universal — cut to length", category_slug: "hoses", price_pence: 3400, image_url: "", in_stock: true, stock_count: 18, lead_time: "Same day", short_desc: "O-ring face seal, 350 bar.", featured: false, manual_url: "" },
  { sku: "HOS-CRIMP-4STK", name: "Hose crimp — walk-in service", brand: "Russell Haines", fits: "Bring the failed hose", category_slug: "hoses", price_pence: 1500, image_url: "", in_stock: true, stock_count: null, lead_time: "Same day", short_desc: "Cut + crimp on the yard press — 5-minute service.", featured: false, manual_url: "" },
  // Tracks
  { sku: "TRK-230X48-KUB", name: "Rubber track 230×48×62 (Kubota)", brand: "TAGEX", fits: "Kubota KX016, KX018-4, U17-3", category_slug: "tracks", price_pence: 24500, image_url: "", in_stock: true, stock_count: 2, lead_time: "Same day", short_desc: "Aftermarket rubber track, 1000-hour rating.", featured: true, manual_url: "" },
  { sku: "TRK-300X52-JCB", name: "Rubber track 300×52×80 (JCB)", brand: "TAGEX", fits: "JCB 8018 CTS, 8020 CTS", category_slug: "tracks", price_pence: 32000, image_url: "", in_stock: true, stock_count: 1, lead_time: "Same day", short_desc: "Aftermarket rubber track for 1.8T/2T minis.", featured: false, manual_url: "" },
  { sku: "TRK-450X81-CAT", name: "Steel track 450×81×74 (CAT 320)", brand: "Berco", fits: "CAT 320D/323D", category_slug: "tracks", price_pence: 285000, image_url: "", in_stock: false, stock_count: 0, lead_time: "5–7 days", short_desc: "Steel track chain + shoe assembly.", featured: false, manual_url: "" },
  { sku: "TRK-ROLLER-8020", name: "Track roller · JCB 8020", brand: "JCB OEM", fits: "JCB 8020 CTS", category_slug: "tracks", price_pence: 12500, image_url: "", in_stock: true, stock_count: 6, lead_time: "Same day", short_desc: "Sealed idler roller.", featured: false, manual_url: "" },
  // Buckets
  { sku: "BUK-300MM-8018", name: "300mm digging bucket · JCB 8018", brand: "Rhinox", fits: "JCB 8018 CTS quick-hitch", category_slug: "buckets", price_pence: 18500, image_url: "", in_stock: false, stock_count: 0, lead_time: "3–5 days", short_desc: "Hardox 400 wear plate, replaceable teeth.", featured: true, manual_url: "" },
  { sku: "BUK-600MM-KX57", name: "600mm grading bucket · Kubota KX57", brand: "Rhinox", fits: "Kubota KX57-4 45mm pin", category_slug: "buckets", price_pence: 27000, image_url: "", in_stock: false, stock_count: 0, lead_time: "3–5 days", short_desc: "1500mm wide grading bucket for finishing.", featured: false, manual_url: "" },
  { sku: "QH-4520-3CX", name: "Quick-hitch (auto) · JCB 3CX", brand: "Miller UK", fits: "JCB 3CX backhoe boom", category_slug: "buckets", price_pence: 89500, image_url: "", in_stock: false, stock_count: 0, lead_time: "5–7 days", short_desc: "Auto hydraulic quick-hitch, HS7460 compliant.", featured: false, manual_url: "" },
  { sku: "BUK-TEETH-4PC", name: "Bucket tooth kit · 4 piece", brand: "ESCO", fits: "Universal — 20 & 25 series pin", category_slug: "buckets", price_pence: 4800, image_url: "", in_stock: true, stock_count: 20, lead_time: "Same day", short_desc: "Hammerless retainer, 4 teeth + 4 pins.", featured: false, manual_url: "" },
  // Belts
  { sku: "BEL-6PK1500-JCB", name: "6PK1500 drive belt · JCB 3CX", brand: "Gates", fits: "JCB 3CX Series 4 Perkins", category_slug: "belts", price_pence: 1800, image_url: "", in_stock: true, stock_count: 25, lead_time: "Same day", short_desc: "Poly-V belt for alternator + AC.", featured: false, manual_url: "" },
  { sku: "BEL-FAN-KUB-D902", name: "Fan belt · Kubota D902", brand: "Gates", fits: "Kubota D902 (KX016, U17-3, GX2200)", category_slug: "belts", price_pence: 1400, image_url: "", in_stock: true, stock_count: 30, lead_time: "Same day", short_desc: "V-belt for water pump.", featured: false, manual_url: "" },
  { sku: "BEL-TIMING-1104", name: "Timing belt · Perkins 1104", brand: "Perkins OEM", fits: "Perkins 1104 (CAT 3054 equivalent)", category_slug: "belts", price_pence: 5200, image_url: "", in_stock: true, stock_count: 4, lead_time: "Same day", short_desc: "Toothed timing belt.", featured: false, manual_url: "" },
  // Fluids
  { sku: "FLU-HYD-46-20L", name: "Hydraulic oil ISO 46 · 20L", brand: "Millers Oils", fits: "Universal hydraulic systems", category_slug: "fluids", price_pence: 4900, image_url: "", in_stock: true, stock_count: 40, lead_time: "Same day", short_desc: "Anti-wear hydraulic oil, DIN 51524-2 HLP.", featured: true, manual_url: "" },
  { sku: "FLU-HYD-68-20L", name: "Hydraulic oil ISO 68 · 20L", brand: "Millers Oils", fits: "High-temp hydraulic systems", category_slug: "fluids", price_pence: 5200, image_url: "", in_stock: true, stock_count: 30, lead_time: "Same day", short_desc: "Higher viscosity for warm-climate hire.", featured: false, manual_url: "" },
  { sku: "FLU-ENG-15W40-5L", name: "Engine oil 15W-40 · 5L", brand: "Comma", fits: "All diesel plant engines", category_slug: "fluids", price_pence: 3200, image_url: "", in_stock: true, stock_count: 60, lead_time: "Same day", short_desc: "API CI-4 spec, Perkins & Kubota approved.", featured: false, manual_url: "" },
  { sku: "FLU-GRS-EP2-400G", name: "EP2 grease cartridge · 400g", brand: "Rocol", fits: "Universal grease guns", category_slug: "fluids", price_pence: 450, image_url: "", in_stock: true, stock_count: 120, lead_time: "Same day", short_desc: "Extreme pressure lithium grease, NLGI 2.", featured: false, manual_url: "" },
  { sku: "FLU-ADB-10L", name: "AdBlue / DEF · 10L", brand: "GreenChem", fits: "All Stage V + Euro 6 engines", category_slug: "fluids", price_pence: 1800, image_url: "", in_stock: true, stock_count: 24, lead_time: "Same day", short_desc: "ISO 22241 spec DEF for SCR aftertreatment.", featured: false, manual_url: "" }
];

const upd = await q(`
  UPDATE hammerex_trade_off_listings
     SET plant_hire = jsonb_set(plant_hire, '{parts_counter,hero_image_url}', '"${hero}"'::jsonb, true)
   WHERE slug = 'demo-russell-haines-plant-hire-leeds'
   RETURNING id;
`);
console.log("Russell parts_counter.hero_image_url set:", upd);

const cats = await q(`
  UPDATE hammerex_trade_off_listings
     SET plant_hire = jsonb_set(plant_hire, '{parts_counter,categories}', '${JSON.stringify(categories).replace(/'/g, "''")}'::jsonb, true)
   WHERE slug = 'demo-russell-haines-plant-hire-leeds'
   RETURNING id;
`);
console.log("Russell parts_counter.categories seeded:", cats);

const its = await q(`
  UPDATE hammerex_trade_off_listings
     SET plant_hire = jsonb_set(plant_hire, '{parts_counter,items}', '${JSON.stringify(items).replace(/'/g, "''")}'::jsonb, true)
   WHERE slug = 'demo-russell-haines-plant-hire-leeds'
   RETURNING id;
`);
console.log("Russell parts_counter.items seeded (" + items.length + "):", its);
