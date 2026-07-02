#!/usr/bin/env node
// Seed mock reviews on every Stuart Kingsley product so the
// ProductReviewsBlock + ReviewMarquee surface live data on the PDPs.
// 4-6 reviews per product, mix of 4★ and 5★, realistic UK trade-buyer
// names and bodies. Idempotent — skips if the (product, customer) pair
// already has a review.

import { readFileSync } from "node:fs";
import { exit } from "node:process";

function loadEnv(path) {
  const out = {};
  try {
    const raw = readFileSync(path, "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m) out[m[1]] = m[2].trim();
    }
  } catch {
    /* ignore */
  }
  return out;
}
const env = { ...loadEnv(".env.local"), ...process.env };
const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Missing env");
  exit(1);
}
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
  if (!r.ok) {
    const text = await r.text();
    throw new Error(`${path} → ${r.status}: ${text}`);
  }
  return r.json();
}

// Common UK first + surname pool — believable trade-buyer names.
const NAMES = [
  "James Whitaker", "Lewis Carter", "Mark Pearce", "Tom Bradshaw",
  "Daniel O'Brien", "Andrew McKenzie", "Liam Jenkins", "Connor Walsh",
  "Steven Brookes", "Adam Holroyd", "Ryan Fairhurst", "Sean Heath",
  "Paul Trenholm", "Harry Doyle", "Owen Greaves", "Reece Stanton",
  "Sarah Hollings", "Emma Fairburn", "Rachel Pemberton", "Lauren Bishop",
  "Karen Whitmore", "Charlotte Lockwood", "Jess Halliday", "Becky Trott"
];

// Review body templates — slot in the product context for variety.
const BODY_TEMPLATES = {
  paint: [
    "Two coats covered perfectly. Brilliant white finish, no streaking. Got the trade discount and same-day collection — top service.",
    "Used 3 tins on a renovation lounge — Dulux trade always reliable. Stuart's yard had it in stock when Travis Perkins didn't.",
    "Solid emulsion, even coverage on smooth plaster. Tin was sealed properly, no skin on top. Will order again.",
    "Fast collection, good price, no complaints. Used on a tenancy turnaround — landlord loved it."
  ],
  flooring: [
    "Laid 18 packs across two rooms, all consistent quality. Click-lock joined up nicely. Stuart's lads helped me load up.",
    "AC4 rating held up after 6 months in a busy hallway. No chipping, no fading. Decent price too.",
    "Delivered to site on the day they said. Boxes all sealed, no damage. Customer chuffed.",
    "Bought 22 packs for an open-plan job. Stuart matched a Wickes price — saved me a tenner per pack."
  ],
  tiles: [
    "Lovely porcelain, edges rectified perfectly so the joints sat flat. Got grey grout to match — looks high-end.",
    "Used these on a bathroom floor + bath surround. No lippage, no warped tiles in the boxes. Solid product.",
    "Trade price was sharp, delivery on the second day. Tile-cutter went through them easy. Recommend.",
    "Stuart's wife actually helped me pick the colour — proper service. Tiles came in well-packed pallets, zero breakage."
  ],
  concrete: [
    "Used 12 bags for a small slab. Set quick, easy mix. Good for fence-post bases too.",
    "Standard postcrete, does what it says. Got 30 bags for a driveway base — Stuart had them on a pallet ready.",
    "Bagged up neatly, no splits. Lads loaded into the van without issues.",
    "Reliable stuff. Used on a shed base — set solid, no cracking after the winter."
  ],
  mortar: [
    "Tarmac Multicem mixes consistently. Used 8 bags on a wall extension. Stuart kept them dry in the yard.",
    "Good cement, no lumps in the bag. Mixed up well in the small mixer. Job came out flush.",
    "Bought 4 bags for some repointing — went a long way. Decent price, sharp service.",
    "Always pick up cement from Stuart's — fair price and no faff. Trade account makes life easy."
  ],
  bricks_blocks: [
    "Pack of 500 turned up clean, no chips. Colour matched the existing house exactly. Used on a porch extension.",
    "Aircretes are light to lift but solid in the wall. Got 4 packs, all consistent. Stuart's yard helped me load.",
    "Reds were beautiful, customer was over the moon. Trade discount was fair too.",
    "Standard Ibstock multi — reliable. Used on a chimney rebuild. Frost-resistant after one winter."
  ],
  plasterboard: [
    "Gyproc standard, edges sharp, no damage in transit. 18 sheets for a loft conversion — all hung clean.",
    "Decent trade pricing. Tapered edges took the scrim tape well. Filler went on smooth.",
    "Stuart had them ready to go — saved a wasted trip. 1200×2400 standard, dead reliable.",
    "British Gypsum quality, no warping. Drylined a whole bedroom — no callbacks."
  ],
  insulation: [
    "Knauf loft roll, cross-laid as advised. Top floor went from freezing to toasty. Easy fit.",
    "Used 5 packs for a loft conversion. Cuts neat with a serrated knife. Decent thermal value.",
    "Good product — Stuart had them in stock when Wickes were out. Customer notice the warmth instantly.",
    "Bagged tight, no fibres flying about. Laid quick across joists. Recommend the cross-lay tip from his lad."
  ],
  decking: [
    "Q-Deck boards are spot-on. Cut and screwed without splitting. Looked sharp once oiled.",
    "Got 28 boards for a 12m² deck. Pressure-treated, straight edges, no warping. Stuart matched Wickes' promo price.",
    "Lads on the yard sorted my order quick. Drove the trailer in, loaded up, sorted in 10 mins.",
    "Solid softwood, smooth face, ribbed reverse. Looking forward to using these again on the next job."
  ],
  fencing: [
    "Stowford panels — solid build, no loose slats. 8 panels installed in a day with the help of a labourer.",
    "Pressure-treated nicely, no quick-rot. Stuart had matching gravel boards too — saved a trip to Wickes.",
    "Heavy panels but worth it for the longevity. Set them with postcrete from his yard — all in one go.",
    "Customer wanted brown — got it in within 2 days. Trade discount + delivery, fair."
  ],
  paving: [
    "Marshalls 600×600, packed on pallets sealed properly. Used on a 25 m² patio — laid flush, no lippage.",
    "Heavy slabs but Stuart had a forklift to load. Riven finish looked premium. Customer ecstatic.",
    "Sub-base mot also from Stuart's yard — one delivery, sorted. Patio came out a treat.",
    "Reliable quality, no chipped corners in any of the 60. Got pointing mortar too."
  ],
  skirting: [
    "MDF torus skirting, primed perfectly. Cut clean with a mitre saw. No splitting on the long lengths.",
    "Decent 4.2m lengths, took a chip-out for fewer joins. Painted up well. Customer happy.",
    "Stuart's yard cut me an open trade account on the spot. Quality MDF, decent price.",
    "Picked up 12 lengths for a 4-room job. All straight, all primed. No callbacks."
  ],
  roof_tiles: [
    "Marley Modern — even coverage, nice colour match to neighbouring houses. Lifted on the scaffold easy.",
    "Got 600 tiles for a re-roof. All clean, no breakages. Ridge tiles also from Stuart's — all matched.",
    "Stuart sorted same-week delivery. Used on a semi-detached, looked smart once done.",
    "Solid concrete tiles, fair price. Customer's surveyor approved them straight away."
  ],
  wallpaper: [
    "Graham & Brown linen paper, paste-the-wall, hung lovely. No pattern stretching. Customer loved it.",
    "Three rolls covered a feature wall perfectly. Stuart had it in stock — same day collection.",
    "Easy to hang, no curling at the edges. Smoothed out with the brush nicely.",
    "Good quality 5.2 m² roll, fair price for trade-grade vinyl."
  ],
  render: [
    "K Rend silicone, mixed up well in the paddle drill. Even spread, no cracking. Looked sharp after the topcoat.",
    "Used 15 bags on a back extension. Stuart had them in stock — saved me a special order.",
    "Trade price was fair, no special-rate nonsense like the chains pull. Good quality render.",
    "Mesh and corner beads from same yard — one stop. Render set evenly even in a damp week."
  ],
  turf: [
    "Rolawn Medallion is the best for new lawns. Stuart got it delivered same day — laid within 2 hours.",
    "Top quality turf, no yellow patches. Customer asked where I sourced it — pointed them straight to Stuart.",
    "Premium product, fair trade price. 80 m² lawn went down beautifully.",
    "Cut clean to shape, joints knitted in 2 weeks. Stuart's yard always has the best turf stocked."
  ],
  aggregates: [
    "Bulk bag delivered straight to the driveway. Clean ballast, no muck. Mixed up well for foundations.",
    "Got 5 bulk bags for a footings job. Delivered on a pallet truck — easy work.",
    "Good quality 20mm-to-dust mix. Used on a path sub-base and a slab — perfect grade.",
    "Stuart's wagon driver was sharp — got it placed exactly where I wanted. Fair price."
  ]
};

function pick(arr, idx) {
  return arr[idx % arr.length];
}
function randomBetween(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function isoMinus(daysAgo) {
  return new Date(Date.now() - daysAgo * 24 * 3600 * 1000).toISOString();
}

const products = await rest(
  `/hammerex_xrated_products?listing_id=eq.${LISTING_ID}&status=eq.live&select=id,name,slug,merchant_category&limit=100`
);
console.log(`Seeding mock reviews across ${products.length} products…`);

let inserted = 0;
let skipped = 0;
let nameIdx = 0;

for (const p of products) {
  const tmpls = BODY_TEMPLATES[p.merchant_category];
  if (!tmpls) {
    skipped += 1;
    continue;
  }
  const reviewCount = randomBetween(4, 6);
  for (let i = 0; i < reviewCount; i += 1) {
    const name = pick(NAMES, nameIdx++);
    const email = `${name.toLowerCase().replace(/[^a-z]+/g, ".")}@example.com`;
    const isFive = Math.random() < 0.75;
    const overall = isFive ? 5 : 4;
    const daysAgo = randomBetween(7, 180);
    const body = pick(tmpls, i);

    // Check duplicate by (product_id, customer_email)
    const dup = await rest(
      `/hammerex_xrated_reviews?product_id=eq.${p.id}&customer_email=eq.${encodeURIComponent(email)}&select=id&limit=1`
    );
    if (dup.length > 0) {
      skipped += 1;
      continue;
    }
    await rest(`/hammerex_xrated_reviews`, {
      method: "POST",
      body: JSON.stringify({
        listing_id: LISTING_ID,
        product_id: p.id,
        customer_name: name,
        customer_email: email,
        overall_rating: overall,
        workmanship_rating: overall,
        timeliness_rating: overall,
        communication_rating: Math.random() < 0.7 ? overall : overall - 1,
        value_rating: Math.random() < 0.6 ? overall : overall - 1,
        body,
        photo_urls: [],
        dispute_evidence_urls: [],
        status: "live",
        submitted_at: isoMinus(daysAgo),
        goes_live_at: isoMinus(daysAgo - 1)
      })
    });
    inserted += 1;
  }
  process.stdout.write(`. ${p.merchant_category}/${p.slug}\n`);
}

console.log(`\nInserted ${inserted} reviews. Skipped ${skipped}.`);
