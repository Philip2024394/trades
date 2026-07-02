// Patch Stuart's plant_hire config: add the 18 new categories, seed
// them enabled with sensible UK 2026 defaults, and set image_urls on
// all 26 image mappings (8 to existing categories, 18 to new ones).
// Preserves everything else (modes, trust, waivers, delivery, etc.).

import { readFileSync } from "node:fs";
const envText = readFileSync("C:\\Users\\Victus\\hammer\\.env.tools.local", "utf-8");
const token = envText.match(/^SUPABASE_ACCESS_TOKEN=(.+)$/m)[1].trim();
const ref = "msdonkkechxzgagyguoe";

async function q(sql, opts = {}) {
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

// Full mapping — image URL keyed by category slug.
const IMG = {
  // Existing categories that get images.
  midi_excavator:
    "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%201,%202026,%2009_49_06%20AM.png?updatedAt=1782874162256",
  dumper:
    "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%201,%202026,%2009_53_21%20AM.png?updatedAt=1782874420198",
  telehandler:
    "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%201,%202026,%2009_59_00%20AM.png?updatedAt=1782874756305",
  skid_steer:
    "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%201,%202026,%2010_01_28%20AM.png?updatedAt=1782874906531",
  roller:
    "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%201,%202026,%2010_08_40%20AM.png?updatedAt=1782875342258",
  cherry_picker:
    "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%201,%202026,%2010_21_05%20AM.png?updatedAt=1782876083188",
  generator:
    "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%201,%202026,%2010_26_36%20AM.png?updatedAt=1782876414760",
  attachments:
    "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%201,%202026,%2011_05_58%20AM.png?updatedAt=1782878781138",

  // New categories.
  backhoe_loader:
    "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%201,%202026,%2009_51_28%20AM.png?updatedAt=1782874306909",
  wheel_loader:
    "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%201,%202026,%2010_06_27%20AM.png?updatedAt=1782875206396",
  bulldozer:
    "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%201,%202026,%2010_10_26%20AM.png?updatedAt=1782875442775",
  articulated_dumper:
    "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%201,%202026,%2010_14_09%20AM.png?updatedAt=1782875669629",
  grader:
    "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%201,%202026,%2010_16_53%20AM.png?updatedAt=1782875828089",
  tracked_dumper:
    "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%201,%202026,%2010_18_41%20AM.png?updatedAt=1782875936148",
  compressor:
    "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%201,%202026,%2010_30_26%20AM.png?updatedAt=1782876644594",
  water_bowser:
    "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%201,%202026,%2010_32_42%20AM.png?updatedAt=1782876783266",
  plate_compactor:
    "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%201,%202026,%2010_37_36%20AM.png?updatedAt=1782877074516",
  trench_rammer:
    "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%201,%202026,%2010_41_40%20AM.png?updatedAt=1782877316668",
  concrete_mixer:
    "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%201,%202026,%2010_47_58%20AM.png?updatedAt=1782877702897",
  concrete_pump:
    "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%201,%202026,%2010_50_34%20AM.png?updatedAt=1782877857013",
  space_heater:
    "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%201,%202026,%2010_53_45%20AM.png?updatedAt=1782878042716",
  wood_chipper:
    "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%201,%202026,%2010_55_08%20AM.png?updatedAt=1782878126178",
  trencher:
    "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%201,%202026,%2010_57_57%20AM.png?updatedAt=1782878298934",
  floor_saw:
    "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%201,%202026,%2011_01_57%20AM.png?updatedAt=1782878567348",
  flail_mower:
    "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%201,%202026,%2011_04_26%20AM.png?updatedAt=1782878681352",
  plant_trailer:
    "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%201,%202026,%2011_09_49%20AM.png?updatedAt=1782879010182"
};

// New category configs (only for the 18 new slugs — existing ones keep
// their current pricing and we only patch image_url).
const NEW_CATS = {
  backhoe_loader: {
    enabled: true,
    price_day_pence: 20000,
    price_week_pence: 65000,
    price_month_pence: 195000,
    operator_premium_day_pence: 22000,
    note: "Roadable — no low-loader needed for local moves.",
    cart_enabled: false,
    sub_types: ["JCB 3CX", "JCB 4CX", "Case 580"],
    image_url: IMG.backhoe_loader
  },
  wheel_loader: {
    enabled: true,
    price_day_pence: 18000,
    price_week_pence: 60000,
    price_month_pence: 180000,
    operator_premium_day_pence: 22000,
    note: "Yard stockpile handling. Multiple bucket sizes.",
    cart_enabled: false,
    sub_types: ["Kubota R070", "Volvo L25", "JCB 407"],
    image_url: IMG.wheel_loader
  },
  bulldozer: {
    enabled: true,
    price_day_pence: 40000,
    price_week_pence: 140000,
    price_month_pence: 420000,
    operator_premium_day_pence: 25000,
    note: "D6-class dozers. CPCS blue card operator recommended.",
    cart_enabled: false,
    sub_types: ["CAT D6", "Komatsu D51", "John Deere 700"],
    image_url: IMG.bulldozer
  },
  articulated_dumper: {
    enabled: true,
    price_day_pence: 55000,
    price_week_pence: 190000,
    price_month_pence: 560000,
    operator_premium_day_pence: 25000,
    note: "20T–40T haul trucks. CPCS ticket required.",
    cart_enabled: false,
    sub_types: ["Volvo A25G", "Bell B30E", "CAT 730"],
    image_url: IMG.articulated_dumper
  },
  grader: {
    enabled: true,
    price_day_pence: 45000,
    price_week_pence: 160000,
    price_month_pence: 480000,
    operator_premium_day_pence: 25000,
    note: "Haul-road formation. Delivered on low-loader.",
    cart_enabled: false,
    sub_types: ["CAT 140M", "Volvo G930", "Komatsu GD555"],
    image_url: IMG.grader
  },
  tracked_dumper: {
    enabled: true,
    price_day_pence: 14000,
    price_week_pence: 45000,
    price_month_pence: 135000,
    operator_premium_day_pence: 20000,
    note: "Ideal for soft ground and landscaping muck-away.",
    cart_enabled: false,
    sub_types: ["Kubota KC70", "Yanmar C08", "Thwaites 3T"],
    image_url: IMG.tracked_dumper
  },
  compressor: {
    enabled: true,
    price_day_pence: 8000,
    price_week_pence: 24000,
    price_month_pence: 72000,
    operator_premium_day_pence: 0,
    note: "Two-tool outlets standard. Road-towable.",
    cart_enabled: true,
    sub_types: ["Atlas Copco XAS47", "Doosan 7/26", "Sullair 88"],
    image_url: IMG.compressor
  },
  water_bowser: {
    enabled: true,
    price_day_pence: 4500,
    price_week_pence: 14000,
    price_month_pence: 42000,
    operator_premium_day_pence: 0,
    note: "1,000L – 2,000L. Pump + hose kit included.",
    cart_enabled: true,
    sub_types: ["1000L", "2000L", "Highway-tow tank"],
    image_url: IMG.water_bowser
  },
  plate_compactor: {
    enabled: true,
    price_day_pence: 3500,
    price_week_pence: 11000,
    price_month_pence: 32000,
    operator_premium_day_pence: 0,
    note: "60kg – 120kg plates. Block-paving pads available.",
    cart_enabled: true,
    sub_types: ["18kN forward", "Reversible 30kN", "Belle PCX"],
    image_url: IMG.plate_compactor
  },
  trench_rammer: {
    enabled: true,
    price_day_pence: 4000,
    price_week_pence: 12000,
    price_month_pence: 35000,
    operator_premium_day_pence: 0,
    note: "68kg – 82kg upright rammers. Petrol only.",
    cart_enabled: true,
    sub_types: ["Wacker BS60-4", "Bomag BT65", "Belle RTX"],
    image_url: IMG.trench_rammer
  },
  concrete_mixer: {
    enabled: true,
    price_day_pence: 4500,
    price_week_pence: 13000,
    price_month_pence: 40000,
    operator_premium_day_pence: 0,
    note: "3/2 mixers. Diesel engine — no site power needed.",
    cart_enabled: true,
    sub_types: ["Winget 100T", "Belle Premier XT", "Baromix Trojan"],
    image_url: IMG.concrete_mixer
  },
  concrete_pump: {
    enabled: true,
    price_day_pence: 30000,
    price_week_pence: 105000,
    price_month_pence: 315000,
    operator_premium_day_pence: 22000,
    note: "Small-line trailer pumps. Operator strongly recommended.",
    cart_enabled: false,
    sub_types: ["Putzmeister BSA 1005", "Schwing SP305", "Cifa PC307"],
    image_url: IMG.concrete_pump
  },
  space_heater: {
    enabled: true,
    price_day_pence: 3500,
    price_week_pence: 11000,
    price_month_pence: 32000,
    operator_premium_day_pence: 0,
    note: "Direct-fired diesel. 20kW – 80kW options.",
    cart_enabled: true,
    sub_types: ["20kW", "50kW", "80kW", "Indirect-fired"],
    image_url: IMG.space_heater
  },
  wood_chipper: {
    enabled: true,
    price_day_pence: 12000,
    price_week_pence: 40000,
    price_month_pence: 120000,
    operator_premium_day_pence: 20000,
    note: "6\" and 8\" chippers. Chipper Awareness ticket required.",
    cart_enabled: false,
    sub_types: ["Timberwolf TW150", "Forst ST6", "Greenmech CM220"],
    image_url: IMG.wood_chipper
  },
  trencher: {
    enabled: true,
    price_day_pence: 12000,
    price_week_pence: 40000,
    price_month_pence: 120000,
    operator_premium_day_pence: 20000,
    note: "Tracked trenchers + stump grinders. Utility strike prevention training required.",
    cart_enabled: false,
    sub_types: ["Ditch Witch RT45", "Vermeer LM42", "Predator P50 stump grinder"],
    image_url: IMG.trencher
  },
  floor_saw: {
    enabled: true,
    price_day_pence: 5500,
    price_week_pence: 17000,
    price_month_pence: 50000,
    operator_premium_day_pence: 0,
    note: "13hp – 20hp petrol floor saws. Diamond blade included.",
    cart_enabled: true,
    sub_types: ["Belle FS250", "Husqvarna FS400", "Stihl TS800"],
    image_url: IMG.floor_saw
  },
  flail_mower: {
    enabled: true,
    price_day_pence: 18000,
    price_week_pence: 60000,
    price_month_pence: 180000,
    operator_premium_day_pence: 22000,
    note: "Compact tractor + rear flail. Verge, land clearance, hedge cutting.",
    cart_enabled: false,
    sub_types: ["Kubota L1-522 + flail", "JCB Fastrac + flail", "Massey 4707 + flail"],
    image_url: IMG.flail_mower
  },
  plant_trailer: {
    enabled: true,
    price_day_pence: 8000,
    price_week_pence: 26000,
    price_month_pence: 78000,
    operator_premium_day_pence: 0,
    note: "3.5T – 26T low-loaders. Beavertail + ramps included.",
    cart_enabled: false,
    sub_types: ["3.5T twin-axle", "10T beavertail", "26T tri-axle low-loader"],
    image_url: IMG.plant_trailer
  }
};

// Build JSONB set operations. We need to:
//   1. Merge new category configs into categories map (jsonb_set for each)
//   2. Set image_url on the 8 existing categories (jsonb_set for each)
const EXISTING_IMG_MAP = {
  midi_excavator: IMG.midi_excavator,
  dumper: IMG.dumper,
  telehandler: IMG.telehandler,
  skid_steer: IMG.skid_steer,
  roller: IMG.roller,
  cherry_picker: IMG.cherry_picker,
  generator: IMG.generator,
  attachments: IMG.attachments
};

// Compose one big update. Use `||` on the categories object to merge
// the new-cats, then chain jsonb_set for each existing-cat image.
const newCatsJson = JSON.stringify(NEW_CATS).replace(/'/g, "''");

let expr = `jsonb_set(plant_hire, '{categories}', (COALESCE(plant_hire->'categories','{}'::jsonb) || '${newCatsJson}'::jsonb), true)`;
for (const [slug, url] of Object.entries(EXISTING_IMG_MAP)) {
  expr = `jsonb_set(${expr}, '{categories,${slug},image_url}', '"${url}"'::jsonb, true)`;
}

const upd = await q(`
  UPDATE hammerex_trade_off_listings
     SET plant_hire = ${expr}
   WHERE slug = '${slug}'
   RETURNING id;
`);
console.log("Patched 26 image mappings + 18 new categories:", upd);

// Verify — pull back the category keys.
const check = await q(`
  SELECT jsonb_object_keys(plant_hire->'categories') AS category_slug
    FROM hammerex_trade_off_listings
   WHERE slug = '${slug}';
`);
console.log(`Category slugs now on record (${check.length}):`, check.map((r) => r.category_slug).sort());
