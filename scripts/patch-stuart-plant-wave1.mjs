// Enable the new sections + set depot_postcode + seed sample specs,
// gallery, video, docs, compat, rating, reviews on 5 flagship machines.

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

const slug = "demo-stuart-kingsley-building-merchant-hull";

const sections = {
  spec_panel: true,
  gallery: true,
  video: true,
  documents: true,
  attachments_compat: true,
  postcode_calculator: true,
  search_filter: true,
  break_even_nudge: true,
  reviews: true,
  notify_when_free: false,
  repeat_customer_ladder: false,
  cdm_pack: false,
  ai_recommender: false
};

// Sample per-category enrichment on 5 flagship machines.
const seeds = {
  mini_excavator: {
    specs: {
      weight_kg: 1500,
      hp: 15,
      dig_depth_mm: 2100,
      reach_mm: 3300,
      bucket_l: 25,
      transport_length_mm: 3300,
      transport_width_mm: 990,
      transport_height_mm: 2200,
      fuel_type: "diesel",
      emission: "stage_v"
    },
    video_url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    brochure_pdf_url: "https://www.kubota.co.uk/-/media/kubota/countrysites/uk/documents/machinery/u10-3.pdf",
    loler_cert_url: "",
    compatible_attachments: ["breaker", "attachments", "trench_rammer"],
    rating: { avg: 4.7, count: 23 },
    reviews: [
      {
        author: "Dave M.",
        rating: 5,
        text: "Turned up on time, machine spotless, no drama. Cut my landscaping job in half a day.",
        date: "2026-06-14"
      },
      {
        author: "Fred (Fred's Fencing)",
        rating: 5,
        text: "Third time I've hired this Kubota. Reliable every time. Stuart's yard is my go-to.",
        date: "2026-05-02"
      }
    ]
  },
  midi_excavator: {
    specs: {
      weight_kg: 5500,
      hp: 45,
      dig_depth_mm: 3700,
      reach_mm: 6100,
      bucket_l: 120,
      fuel_type: "diesel",
      emission: "stage_v"
    },
    compatible_attachments: ["breaker", "attachments"],
    rating: { avg: 4.8, count: 11 }
  },
  telehandler: {
    specs: {
      weight_kg: 6800,
      hp: 74,
      reach_mm: 6000,
      bucket_l: 0,
      transport_length_mm: 4700,
      transport_width_mm: 2100,
      transport_height_mm: 2000,
      fuel_type: "diesel",
      emission: "stage_v"
    },
    compatible_attachments: ["attachments"],
    rating: { avg: 4.6, count: 18 },
    reviews: [
      {
        author: "Anna (SiteWorks Yorkshire)",
        rating: 5,
        text: "Loaded three articulated lorries in a morning. Manitou is faultless.",
        date: "2026-06-01"
      }
    ]
  },
  dumper: {
    specs: {
      weight_kg: 2100,
      hp: 25,
      fuel_type: "diesel",
      emission: "stage_v"
    },
    compatible_attachments: ["mini_excavator"],
    rating: { avg: 4.5, count: 9 }
  },
  breaker: {
    specs: {
      weight_kg: 30,
      hp: 5,
      fuel_type: "petrol"
    },
    compatible_attachments: ["mini_excavator", "compressor"],
    rating: { avg: 4.4, count: 6 }
  }
};

let expr = `jsonb_set(plant_hire, '{sections_enabled}', '${JSON.stringify(sections).replace(/'/g, "''")}'::jsonb, true)`;
expr = `jsonb_set(${expr}, '{depot_postcode}', '"HU8 8DZ"'::jsonb, true)`;
for (const [catSlug, seed] of Object.entries(seeds)) {
  for (const [field, value] of Object.entries(seed)) {
    expr = `jsonb_set(${expr}, '{categories,${catSlug},${field}}', '${JSON.stringify(value).replace(/'/g, "''")}'::jsonb, true)`;
  }
}

const upd = await q(`
  UPDATE hammerex_trade_off_listings
     SET plant_hire = ${expr}
   WHERE slug = '${slug}'
   RETURNING id;
`);
console.log("Enabled sections + seeded 5 machines with specs/gallery/video/docs/reviews:", upd);
