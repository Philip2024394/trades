#!/usr/bin/env node
// Seed Stuart Kingsley's demo listing with mock products covering every
// Material Calculator type + a set of cross-sell items tagged with
// merchant_subcategory so the "Complete your project" panel renders
// real merchant products instead of just advisory tips.
//
// Idempotent — checks slug existence before inserting. Re-run safely.
//
// Run: node scripts/seed-stuart-calculator-mocks.mjs
// Env: NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY from .env.local

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
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  exit(1);
}

const STUART_LISTING_ID = "109de7be-77ae-47df-87e4-3ed05e4aa224";

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

function slug(s) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

// Generic Pexels building-materials placeholders. Free CC0 use.
const IMG = {
  paint: "https://images.pexels.com/photos/1669754/pexels-photo-1669754.jpeg?auto=compress&cs=tinysrgb&w=600",
  flooring: "https://images.pexels.com/photos/1090638/pexels-photo-1090638.jpeg?auto=compress&cs=tinysrgb&w=600",
  tile: "https://images.pexels.com/photos/1457847/pexels-photo-1457847.jpeg?auto=compress&cs=tinysrgb&w=600",
  concrete: "https://images.pexels.com/photos/2219024/pexels-photo-2219024.jpeg?auto=compress&cs=tinysrgb&w=600",
  mortar: "https://images.pexels.com/photos/8961428/pexels-photo-8961428.jpeg?auto=compress&cs=tinysrgb&w=600",
  brick: "https://images.pexels.com/photos/2092078/pexels-photo-2092078.jpeg?auto=compress&cs=tinysrgb&w=600",
  plasterboard: "https://images.pexels.com/photos/3990359/pexels-photo-3990359.jpeg?auto=compress&cs=tinysrgb&w=600",
  insulation: "https://images.pexels.com/photos/8961451/pexels-photo-8961451.jpeg?auto=compress&cs=tinysrgb&w=600",
  decking: "https://images.pexels.com/photos/277559/pexels-photo-277559.jpeg?auto=compress&cs=tinysrgb&w=600",
  fencing: "https://images.pexels.com/photos/1031634/pexels-photo-1031634.jpeg?auto=compress&cs=tinysrgb&w=600",
  paving: "https://images.pexels.com/photos/1438834/pexels-photo-1438834.jpeg?auto=compress&cs=tinysrgb&w=600",
  skirting: "https://images.pexels.com/photos/4480530/pexels-photo-4480530.jpeg?auto=compress&cs=tinysrgb&w=600",
  roof: "https://images.pexels.com/photos/259751/pexels-photo-259751.jpeg?auto=compress&cs=tinysrgb&w=600",
  wallpaper: "https://images.pexels.com/photos/1112598/pexels-photo-1112598.jpeg?auto=compress&cs=tinysrgb&w=600",
  render: "https://images.pexels.com/photos/3990851/pexels-photo-3990851.jpeg?auto=compress&cs=tinysrgb&w=600",
  turf: "https://images.pexels.com/photos/1903702/pexels-photo-1903702.jpeg?auto=compress&cs=tinysrgb&w=600",
  brush: "https://images.pexels.com/photos/1669799/pexels-photo-1669799.jpeg?auto=compress&cs=tinysrgb&w=600",
  roller: "https://images.pexels.com/photos/279607/pexels-photo-279607.jpeg?auto=compress&cs=tinysrgb&w=600",
  screw: "https://images.pexels.com/photos/175039/pexels-photo-175039.jpeg?auto=compress&cs=tinysrgb&w=600"
};

// Primary calculator products (one per calc type Stuart is missing)
const PRIMARY = [
  { name: "Dulux Trade Vinyl Matt Emulsion — 5L White", price_pounds: 34.99, category: "paint", img: IMG.paint, description: "Premium UK trade-grade emulsion. Covers ~60 m² per tin (12 m²/L real-world)." },
  { name: "Krono Original Vario Oak Laminate Flooring — 8mm pack", price_pounds: 19.99, category: "flooring", img: IMG.flooring, description: "1.62 m² per pack. Click-lock install. AC4 rating for domestic use." },
  { name: "Porcelanosa Studio Beige 600×300 Porcelain Tile — box of 6", price_pounds: 28.50, category: "tiles", img: IMG.tile, description: "Rectified edges, suitable for walls + floors. 1.08 m² per box." },
  { name: "Hanson Postcrete 20kg Pre-mix Concrete Bag", price_pounds: 4.85, category: "concrete", img: IMG.concrete, description: "Rapid-set concrete for fence posts, slabs and bases. ~0.012 m³ per bag." },
  { name: "Tarmac Blue Circle Multicem Cement — 25kg bag", price_pounds: 7.25, category: "mortar", img: IMG.mortar, description: "CEM II/A-L 32.5 N general-purpose UK cement for mortar mixes." },
  { name: "Ibstock Tradesman Red Multi Brick — pack of 500", price_pounds: 295.00, category: "bricks_blocks", img: IMG.brick, description: "Standard 215×102.5×65mm UK brick. 60 bricks/m² single skin." },
  { name: "British Gypsum Gyproc Standard Plasterboard — 1200×2400×12.5mm", price_pounds: 11.95, category: "plasterboard", img: IMG.plasterboard, description: "Square-edge tapered. 2.88 m² per sheet." },
  { name: "Knauf Loft Roll 44 Combi-Cut — 100mm × 8.3 m²", price_pounds: 22.50, category: "insulation", img: IMG.insulation, description: "Loft insulation, U-value 0.44. Cross-lay two rolls for Part L 0.16." },
  { name: "Q-Deck Premium Smooth Decking Board — 28×144×3600mm", price_pounds: 14.99, category: "decking", img: IMG.decking, description: "Pressure-treated softwood. ~145 mm cover face per board." },
  { name: "Stowford Lap Fence Panel — 6'×6' (1830×1830mm)", price_pounds: 39.99, category: "fencing", img: IMG.fencing, description: "Pressure-treated overlap panel. 1.83 m wide, 1.83 m tall." },
  { name: "MDF Pre-primed Torus Skirting — 145×18×4200mm length", price_pounds: 17.50, category: "skirting", img: IMG.skirting, description: "Standard UK MDF skirting, primed ready for paint." },
  { name: "Marley Modern Concrete Roof Tile — Smooth Grey", price_pounds: 2.45, category: "roof_tiles", img: IMG.roof, description: "Standard interlocking concrete tile. ~10 tiles/m² at typical gauge." },
  { name: "Graham & Brown Linen Plain Wallpaper Roll — Cream", price_pounds: 18.99, category: "wallpaper", img: IMG.wallpaper, description: "Standard UK 10.05m × 0.52m = 5.2 m² raw, 4.5 m² usable." },
  { name: "K Rend Silicone TC Render — 25kg bag", price_pounds: 24.95, category: "render", img: IMG.render, description: "Thin-coat silicone render. ~8 kg/m² for two coats." },
  { name: "Rolawn Medallion Turf — 1m × 410mm roll", price_pounds: 4.99, category: "turf", img: IMG.turf, description: "Premium UK lawn turf, 0.41 m² per roll. Lay within 24h of delivery." },
  // Aggregates and paving — Stuart already has some but add one more for the calc demos
  { name: "Cotswold Buff Decorative Gravel — 25kg bag", price_pounds: 6.50, category: "aggregates", subcategory: null, img: IMG.concrete, description: "20mm decorative gravel for paths, drives and borders. 1.6 t/m³ density." }
];

// Cross-sell items — tagged with merchant_subcategory so the calculator
// "Complete your project" panel actually surfaces real merchant products.
const CROSS_SELL = [
  // Paint cross-sell
  { name: "Harris Essentials 4-inch Paint Brush — 2 pack", price_pounds: 5.99, category: "hand_tools", subcategory: "paint_brush", img: IMG.brush, description: "Synthetic bristle, suits all emulsion/gloss." },
  { name: "Hamilton Performance 9-inch Roller Sleeve + Tray Kit", price_pounds: 12.50, category: "hand_tools", subcategory: "paint_roller", img: IMG.roller, description: "Medium-pile sleeve + tray, masking tape and stirrer." },
  { name: "Frog Tape Multi-Surface Masking Tape — 36mm × 41m", price_pounds: 8.75, category: "other", subcategory: "masking_tape", img: IMG.brush, description: "Clean paint lines on freshly painted walls and trim." },
  { name: "Oakey Liberty Green Sandpaper — 240 grit pack of 10", price_pounds: 6.95, category: "other", subcategory: "sandpaper", img: IMG.brush, description: "For sanding between paint coats and on wood trim." },
  { name: "Polycell Trade Smoothover One Coat Filler — 1kg", price_pounds: 9.25, category: "paint", subcategory: "filler", img: IMG.paint, description: "Smooths cracks, holes and blown plaster before painting." },
  { name: "Bartoline White Spirit — 2L", price_pounds: 5.85, category: "paint", subcategory: "paint_thinner", img: IMG.paint, description: "For thinning oil-based paint + cleaning brushes." },
  { name: "Zinsser Bullseye 1-2-3 Primer-Sealer — 2.5L", price_pounds: 19.99, category: "paint", subcategory: "primer", img: IMG.paint, description: "Bonds to almost any surface. Mist-coat fresh plaster." },
  { name: "Heavy-Duty Cotton Twill Dust Sheet — 4m × 3m", price_pounds: 8.95, category: "other", subcategory: "drop_sheet", img: IMG.brush, description: "Reusable, absorbent — protects floors and furniture." },
  { name: "Sandvik Wide Paint Scraper 4-inch", price_pounds: 6.50, category: "hand_tools", subcategory: "scraper", img: IMG.brush, description: "Carbon steel blade for removing old paint and wallpaper." },

  // Tile cross-sell
  { name: "Mapei Keraflex Maxi S1 Tile Adhesive — 20kg bag (White)", price_pounds: 18.95, category: "tiles", subcategory: "tile_adhesive", img: IMG.tile, description: "Flexible cementitious adhesive for large-format tiles. ~1.5 kg/m²." },
  { name: "BAL Wide Joint Grout Wall + Floor — 5kg (Limestone)", price_pounds: 14.50, category: "tiles", subcategory: "grout", img: IMG.tile, description: "Flexible grout for joints 3-20mm. Covers ~12 m²." },
  { name: "Vitrex Wedge Tile Spacers 3mm — bag of 250", price_pounds: 3.99, category: "tiles", subcategory: "tile_spacer", img: IMG.tile, description: "Even joints for floor + wall tiling." },

  // Flooring cross-sell
  { name: "Quickstep Heat-Block Underlay — 15 m² roll", price_pounds: 28.50, category: "flooring", subcategory: "underlay", img: IMG.flooring, description: "Suitable over underfloor heating. 2mm." },
  { name: "Oak Beading / Scotia 18×18mm — 2.4m length", price_pounds: 7.95, category: "flooring", subcategory: "beading", img: IMG.flooring, description: "Covers expansion gaps at room edges." },

  // Plasterboard cross-sell
  { name: "Hilti Drywall Screws 38mm — box of 1000", price_pounds: 17.95, category: "fixings", subcategory: "drywall_screw", img: IMG.screw, description: "Self-tapping, bugle head. 30 screws per 1200×2400 board." },
  { name: "Tilcon Joint Scrim Tape 90mm × 90m", price_pounds: 6.25, category: "plasterboard", subcategory: "scrim_tape", img: IMG.plasterboard, description: "Fibreglass mesh for plasterboard joints." },

  // Decking cross-sell
  { name: "Spax Decking Screws 4.5×60mm — tub of 250", price_pounds: 19.95, category: "fixings", subcategory: "deck_screw", img: IMG.screw, description: "T-Star Plus head, A2 stainless. 4 screws per board crossing." },
  { name: "Ronseal Ultimate Decking Oil — 5L Natural Cedar", price_pounds: 38.99, category: "paint", subcategory: "deck_oil", img: IMG.paint, description: "Weatherproof finish for new + restored decks. ~12 m² per litre." },

  // Fencing cross-sell
  { name: "Tarmac Post Mix Concrete — 20kg bag", price_pounds: 5.95, category: "fencing", subcategory: "postcrete", img: IMG.concrete, description: "Rapid-set concrete for fence posts. One bag per standard post." },
  { name: "Wickes Acorn Post Cap — 100×100mm Brown", price_pounds: 3.50, category: "fencing", subcategory: "post_cap", img: IMG.fencing, description: "Weather protection + finishing detail for fence posts." },

  // Paving cross-sell
  { name: "Geofix Easy All-Weather Jointing Compound — 14kg (Slate Grey)", price_pounds: 28.95, category: "paving", subcategory: "jointing_compound", img: IMG.paving, description: "Brush-in jointing for patios. Covers ~5 m² at 50mm depth." },
  { name: "MOT Type 1 Sub-base — bulk bag (~0.85 t)", price_pounds: 65.00, category: "aggregates", subcategory: "sub_base", img: IMG.concrete, description: "Crushed limestone, compacts to a strong base under slabs/driveways." },
  { name: "Sharp Sand — bulk bag (~0.85 t)", price_pounds: 55.00, category: "aggregates", subcategory: "sharp_sand", img: IMG.concrete, description: "Grit-sand for screed beds + mortar mixes." },

  // Insulation cross-sell
  { name: "Visqueen Vapour Control Membrane — 4m × 25m roll", price_pounds: 42.50, category: "insulation", subcategory: "vapour_barrier", img: IMG.insulation, description: "Polyethylene 250-micron VCL for warm-side walls + ceilings." },

  // Bricks cross-sell
  { name: "Catnic CG90/100 Steel Cavity Lintel — 1200mm", price_pounds: 36.95, category: "bricks_blocks", subcategory: "lintel", img: IMG.brick, description: "100mm cavity wall lintel for openings up to 1.05 m." },

  // Skirting cross-sell
  { name: "No More Nails Original Adhesive — 290ml cartridge", price_pounds: 6.99, category: "fixings", subcategory: "panel_adhesive", img: IMG.screw, description: "Fast-grab adhesive for skirting, coving, panels." },

  // Wallpaper cross-sell
  { name: "Solvite All-Purpose Wallpaper Paste — 30 roll size", price_pounds: 4.99, category: "wallpaper", subcategory: "wallpaper_paste", img: IMG.wallpaper, description: "Quick-mix paste for standard + heavy papers." },
  { name: "Erfurt Wallpaper Smoother Brush", price_pounds: 4.50, category: "hand_tools", subcategory: "wallpaper_smoother", img: IMG.brush, description: "Bristle smoother for removing air bubbles from hung paper." },

  // Turf cross-sell
  { name: "Westland Aftercut All-In-One Lawn Feed — 80 m² bag", price_pounds: 16.99, category: "turf", subcategory: "lawn_feed", img: IMG.turf, description: "Feeds + thickens + kills moss. Apply 2-3 weeks after laying." },

  // Roof tiles cross-sell
  { name: "Marley Modern Ridge Tile — Grey", price_pounds: 7.95, category: "roof_tiles", subcategory: "ridge_tile", img: IMG.roof, description: "Concrete ridge tile, 300mm gauge typical." },
  { name: "Klober Permo Forte Roofing Underlay — 1.5m × 50m roll", price_pounds: 89.00, category: "roof_tiles", subcategory: "eaves_felt", img: IMG.roof, description: "Vapour-permeable roof felt + battens." },

  // Render cross-sell
  { name: "Weber Rend Aid Reinforcement Mesh — 1m × 50m roll", price_pounds: 38.50, category: "render", subcategory: "render_mesh", img: IMG.render, description: "Alkali-resistant mesh for render reinforcement." }
];

async function existsBySlug(s) {
  const r = await rest(
    `/hammerex_xrated_products?listing_id=eq.${STUART_LISTING_ID}&slug=eq.${encodeURIComponent(s)}&select=id&limit=1`
  );
  return r.length > 0;
}

async function insert(p) {
  const s = slug(p.name);
  if (await existsBySlug(s)) {
    console.log(`skip (exists): ${p.name}`);
    return;
  }
  const row = {
    listing_id: STUART_LISTING_ID,
    name: p.name,
    slug: s,
    description: p.description,
    price_pence: Math.round(p.price_pounds * 100),
    cover_url: p.img,
    status: "live",
    kind: "product",
    product_kind: "stock",
    merchant_category: p.category,
    merchant_subcategory: p.subcategory ?? null,
    sort_order: 0,
    gallery_urls: [],
    variants: [],
    compare_with: [],
    bulk_tiers: []
  };
  await rest(`/hammerex_xrated_products`, { method: "POST", body: JSON.stringify(row) });
  console.log(`+ ${p.category}${p.subcategory ? "/" + p.subcategory : ""}  ·  ${p.name}`);
}

console.log("Seeding primary calculator products…");
for (const p of PRIMARY) await insert(p);
console.log("\nSeeding cross-sell items (subcategory-tagged)…");
for (const p of CROSS_SELL) await insert(p);
console.log("\nDone.");
