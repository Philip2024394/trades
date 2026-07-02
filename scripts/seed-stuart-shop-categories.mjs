#!/usr/bin/env node
// Seeds Stuart Kingsley's building-merchant profile with the 19 shop
// categories the user supplied + auto-tags each of his ~48 products
// with the categories they belong to based on name / merchant_category.

import { readFileSync } from "node:fs";

function loadEnv(path) {
  const out = {};
  try {
    const raw = readFileSync(path, "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m) out[m[1]] = m[2].trim();
    }
  } catch { /* ignore */ }
  return out;
}
const env = { ...loadEnv(".env.local"), ...process.env };
const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) throw new Error("Missing SUPABASE env");

const LISTING_ID = "109de7be-77ae-47df-87e4-3ed05e4aa224";

async function rest(path, init = {}) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    ...init,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...(init.headers ?? {})
    }
  });
  if (!r.ok) throw new Error(`${path} → ${r.status}: ${await r.text()}`);
  return r.json();
}

const CATEGORIES = [
  { slug: "roofing",             label: "Roofing",             image_url: "https://ik.imagekit.io/9mrgsv2rp/Untitledccccx-removebg-preview.png" },
  { slug: "timber",              label: "Timber",              image_url: "https://ik.imagekit.io/9mrgsv2rp/Untitledccccxxc-removebg-preview.png" },
  { slug: "windows_and_doors",   label: "Windows & Doors",     image_url: "https://ik.imagekit.io/9mrgsv2rp/Untitledccccxxcxc-removebg-preview.png" },
  { slug: "plumbing",            label: "Plumbing",            image_url: "https://ik.imagekit.io/9mrgsv2rp/Untitledccccxxcxcxc-removebg-preview.png" },
  { slug: "electric",            label: "Electric",            image_url: "https://ik.imagekit.io/9mrgsv2rp/Untitledccccxxcxcxccc-removebg-preview.png" },
  { slug: "insulation",          label: "Insulation",          image_url: "https://ik.imagekit.io/9mrgsv2rp/Untitledccccxxcxcxcccc-removebg-preview.png" },
  { slug: "plastering_drywall",  label: "Plastering & Drywall",image_url: "https://ik.imagekit.io/9mrgsv2rp/Untitledccccxxcxcxccccxx-removebg-preview.png" },
  { slug: "flooring",            label: "Flooring",            image_url: "https://ik.imagekit.io/9mrgsv2rp/Untitledccccxxcxcxccccxxxx-removebg-preview.png" },
  { slug: "painting",            label: "Painting",            image_url: "https://ik.imagekit.io/9mrgsv2rp/Untitledccccxxcxcxccccxxxxddd-removebg-preview.png" },
  { slug: "landscaping_fencing", label: "Landscaping & Fencing", image_url: "https://ik.imagekit.io/9mrgsv2rp/Untitledccccxxcxcxccccxxxxdddd-removebg-preview.png" },
  { slug: "paving",              label: "Paving",              image_url: "https://ik.imagekit.io/9mrgsv2rp/Untitledccccxxcxcxccccxxxxddddd-removebg-preview.png" },
  { slug: "bricks_and_blocks",   label: "Bricks & Blocks",     image_url: "https://ik.imagekit.io/9mrgsv2rp/Untitledccccxxcxcxccccxxxxdddddffsd-removebg-preview.png" },
  { slug: "sand_gravel",         label: "Sand & Gravel",       image_url: "https://ik.imagekit.io/9mrgsv2rp/Untitledccccxxcxcxccccxxxxdddddffsdd-removebg-preview.png" },
  { slug: "scaffolding",         label: "Scaffolding",         image_url: "https://ik.imagekit.io/9mrgsv2rp/Untitledccccxxcxcxccccxxxxdddddffsddds-removebg-preview.png" },
  { slug: "hand_tools",          label: "Hand Tools",          image_url: "https://ik.imagekit.io/9mrgsv2rp/Untitledccccxxcxcxccccxxxxdddddffsdddsd-removebg-preview.png" },
  { slug: "nuts_bolts_screws",   label: "Nuts, Bolts & Screws",image_url: "https://ik.imagekit.io/9mrgsv2rp/Untitledccccxxcxcxccccxxxxdddddffsdddsdsdds-removebg-preview.png" },
  { slug: "piping",              label: "Piping",              image_url: "https://ik.imagekit.io/9mrgsv2rp/Untitledccccxxcxcxccccxxxxdddddffsdddsdsddsds-removebg-preview.png" },
  { slug: "garden",              label: "Garden",              image_url: "https://ik.imagekit.io/9mrgsv2rp/Untitledccccxxcxcxccccxxxxdddddffsdddsdsddsdssdd-removebg-preview.png" },
  { slug: "workwear",            label: "Workwear",            image_url: "https://ik.imagekit.io/9mrgsv2rp/Untitledccccxxcxcxccccxxxxdddddffsdddsdsddsdssdddsd-removebg-preview.png" }
].map((c, i) => ({ ...c, enabled: true, sort_order: i }));

// Save categories on the listing.
await rest(`/hammerex_trade_off_listings?id=eq.${LISTING_ID}`, {
  method: "PATCH",
  body: JSON.stringify({ shop_categories: CATEGORIES })
});
console.log(`Saved ${CATEGORIES.length} shop_categories on Stuart's listing.`);

// Auto-tag his products. Rules match product name + existing
// merchant_category → strip slugs. A product can match multiple.
const RULES = [
  { slugs: ["roofing"],             match: /roof|felt|slate|tile/i,             merchantCats: ["roof_tiles"] },
  { slugs: ["timber"],              match: /timber|joist|beam|batten|stud|sleeper|log|CLS|OSB|MDF|plywood|decking/i, merchantCats: ["decking", "skirting"] },
  { slugs: ["windows_and_doors"],   match: /window|door|frame|glazing|handle|hinge|lock/i,      merchantCats: [] },
  { slugs: ["plumbing"],            match: /pipe|tap|valve|copper|solder|olive|compression|WC|toilet|basin|sink|bath|shower|waste/i, merchantCats: [] },
  { slugs: ["electric"],            match: /cable|wire|socket|switch|MCB|consumer unit|junction|clip|conduit|LED|bulb|light fitting/i, merchantCats: [] },
  { slugs: ["insulation"],          match: /insulation|Rockwool|Kingspan|Celotex|loft roll|glass wool|acoustic/i, merchantCats: ["insulation"] },
  { slugs: ["plastering_drywall"],  match: /plaster|drywall|plasterboard|gyproc|scrim|tape|beading|multi[- ]?finish/i, merchantCats: ["plasterboard"] },
  { slugs: ["flooring"],            match: /floor|laminate|LVT|vinyl|carpet|underlay/i,        merchantCats: ["flooring"] },
  { slugs: ["painting"],            match: /paint|primer|emulsion|gloss|satin|matt|undercoat|masonry paint|brush|roller|tray|sanding|sandpaper/i, merchantCats: ["paint"] },
  { slugs: ["landscaping_fencing"], match: /fence|panel|post|gravel board|arris|trellis|gate|hedge/i, merchantCats: ["fencing"] },
  { slugs: ["paving"],              match: /paving|slab|flag|sett|kerb|edging|driveway|patio/i, merchantCats: ["paving"] },
  { slugs: ["bricks_and_blocks"],   match: /brick|block|aircrete|concrete block|lintel/i,      merchantCats: ["bricks_blocks"] },
  { slugs: ["sand_gravel"],         match: /sand|ballast|MOT|hardcore|shingle|gravel|aggregate|building sand|sharp sand/i, merchantCats: ["aggregates", "gravel"] },
  { slugs: ["sand_gravel", "bricks_and_blocks"], match: /cement|postcrete|mortar|multicem|concrete mix/i, merchantCats: ["concrete", "mortar"] },
  { slugs: ["scaffolding"],         match: /scaffold|trestle|hop.?up|ladder|step|platform/i,   merchantCats: [] },
  { slugs: ["hand_tools"],          match: /trowel|hammer|chisel|saw|square|level|tape|spanner|pliers|screwdriver|wrench|knife|blade|bar/i, merchantCats: [] },
  { slugs: ["nuts_bolts_screws"],   match: /screw|nail|bolt|washer|nut|anchor|plug|coach|fixing/i, merchantCats: [] },
  { slugs: ["piping"],              match: /pipe|conduit|duct|elbow|tee|coupling/i,            merchantCats: [] },
  { slugs: ["garden"],              match: /garden|lawn|seed|compost|topsoil|bark|turf|planter|border/i, merchantCats: ["turf"] },
  { slugs: ["workwear"],            match: /boot|jacket|trouser|glove|hard hat|hi.?vis|safety|goggle|mask|earmuff/i, merchantCats: [] },
  { slugs: ["plastering_drywall"],  match: /render|K.?rend|silicone render/i,                  merchantCats: ["render"] },
  { slugs: ["painting"],            match: /wallpaper/i,                                       merchantCats: ["wallpaper"] }
];

const products = await rest(
  `/hammerex_xrated_products?listing_id=eq.${LISTING_ID}&status=eq.live&select=id,name,merchant_category,shop_category_slugs&limit=200`
);
console.log(`Auto-tagging ${products.length} products…`);
let updated = 0;
for (const p of products) {
  const tags = new Set(Array.isArray(p.shop_category_slugs) ? p.shop_category_slugs : []);
  for (const rule of RULES) {
    if (rule.match.test(p.name) || rule.merchantCats.includes(p.merchant_category)) {
      for (const s of rule.slugs) tags.add(s);
    }
  }
  const next = [...tags];
  await rest(`/hammerex_xrated_products?id=eq.${p.id}`, {
    method: "PATCH",
    body: JSON.stringify({ shop_category_slugs: next })
  });
  process.stdout.write(`. ${p.name} → [${next.join(", ")}]\n`);
  updated += 1;
}
console.log(`\nTagged ${updated} products across ${CATEGORIES.length} categories.`);
