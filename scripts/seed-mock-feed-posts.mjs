// One-off seed script for mock demo-merchant yard feed posts.
// 6 staircase + 8 tiler + 8 kitchen-maker = 22 posts across
// three demo merchants. Each post gets one image + a natural
// caption in the trade's voice.

import fs from "node:fs";
import path from "node:path";
for (const f of [".env.local", ".env.tools.local"]) {
  const p = path.join(process.cwd(), f);
  if (fs.existsSync(p)) {
    for (const line of fs.readFileSync(p, "utf8").split("\n")) {
      const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, "");
    }
  }
}

const SB_REF   = process.env.SUPABASE_PROJECT_REF;
const SB_TOKEN = process.env.SUPABASE_ACCESS_TOKEN;
const SB_URL   = process.env.NEXT_PUBLIC_SUPABASE_URL;
const BASE     = `${SB_URL}/storage/v1/object/public/network-uploads/yard-feed`;

// Demo merchant listing_ids (already looked up)
const STAIR_ID  = "55b69f5e-c6df-4afe-816b-20beebacb451";  // Richard Hollings
const STAIR_SLUG = "staircase-manufacturer";
const TILE_ID   = "0dabda47-8dc0-4de7-ad2b-170dff7e9176";  // Anya Petrova
const TILE_SLUG = "tiler";
const KIT_ID    = "861cd5df-17e3-478f-b0ac-ecc3146f7af4";  // Charlotte Pemberton
const KIT_SLUG  = "kitchen-manufacturer";

const posts = [
  // ─── STAIRCASE MAKER — Richard Hollings ─────────────────────
  { listing_id: STAIR_ID, trade_slug: STAIR_SLUG, kind: "showcase", title: "Marking up the risers on today's build",
    body: "Fresh oak flight going out to a customer in West Bridgford this week. Every riser marked + double-checked before the glue-up.",
    image: "staircase-workshop-fitter-marking-riser.png" },
  { listing_id: STAIR_ID, trade_slug: STAIR_SLUG, kind: "showcase", title: "Full workshop view — 3 builds in progress",
    body: "Peak season. Two straight flights + a curved on the go simultaneously. All bespoke, all UK oak / European walnut.",
    image: "staircase-workshop-full-view-multi-build.png" },
  { listing_id: STAIR_ID, trade_slug: STAIR_SLUG, kind: "showcase", title: "Glue-up + clamping stage",
    body: "This is the part homeowners never see — 24 hours in clamps at 20°C before we go anywhere near a sander. No shortcuts on this.",
    image: "staircase-workshop-glue-clamping.png" },
  { listing_id: STAIR_ID, trade_slug: STAIR_SLUG, kind: "showcase", title: "Showroom flight — bespoke oak, lacquered",
    body: "Come see this in person if you're spec'ing a new stair. Oak with hand-scraped surface, matt lacquer, glass balustrade. Ready-made display.",
    image: "staircase-showroom-oak-display.png" },
  { listing_id: STAIR_ID, trade_slug: STAIR_SLUG, kind: "showcase", title: "Spraying treads in the finish booth",
    body: "Water-based lacquer, 3 coats, sanded between each. Dries hard as glass + safer on-site than solvent. Every tread + riser gets the same treatment.",
    image: "staircase-workshop-spraying-treads.png" },
  { listing_id: STAIR_ID, trade_slug: STAIR_SLUG, kind: "showcase", title: "On-site install day — this one goes in a Georgian house",
    body: "Bespoke walnut cantilever going into a Grade II Georgian in Nottingham. Two-day install with conservation officer sign-off.",
    image: "staircase-workshop-fitter-installing.png" },

  // ─── TILER — Anya Petrova ────────────────────────────────────
  { listing_id: TILE_ID, trade_slug: TILE_SLUG, kind: "showcase", title: "Front porch getting a slate makeover today",
    body: "Notched trowel + weatherproof adhesive. This porch had cracked concrete slabs — new porcelain slate-effect going down. Homeowner picked the colour last week.",
    image: "tiler-external-porch-slate-adhesive.png" },
  { listing_id: TILE_ID, trade_slug: TILE_SLUG, kind: "showcase", title: "Adhesive combing — the bit that separates good tiling from bad",
    body: "Consistent bed thickness is everything. If your tiles ring hollow when tapped, this is where it went wrong. Fresh 10mm notched trowel here.",
    image: "tiler-external-porch-single-tile-notched.png" },
  { listing_id: TILE_ID, trade_slug: TILE_SLUG, kind: "showcase", title: "Finished porcelain floor — Bristol job wrapped up",
    body: "600×600 rectified porcelain, minimum 2mm grout lines, fully levelled with a laser before we started. Client is over the moon.",
    image: "tiler-floor-porcelain-finished.png" },
  { listing_id: TILE_ID, trade_slug: TILE_SLUG, kind: "showcase", title: "Large-format kitchen floor complete",
    body: "1200×600 porcelain planks. Levelling clips + wedges to keep every tile perfectly flush. Underfloor heating below.",
    image: "tiler-floor-large-format-finished.png" },
  { listing_id: TILE_ID, trade_slug: TILE_SLUG, kind: "showcase", title: "Master bathroom finish — grey porcelain throughout",
    body: "Full bathroom refit — walls + floor in matching 900×600 large-format porcelain. Wall-hung vanity + walk-in shower. 3-week job.",
    image: "tiler-bathroom-large-grey-porcelain.png" },
  { listing_id: TILE_ID, trade_slug: TILE_SLUG, kind: "showcase", title: "Laser level over multiple courses — how straight lines stay straight",
    body: "Every wall gets a horizontal + vertical laser reference before the first tile goes up. Cheap laser levels are worth every penny.",
    image: "tiler-wall-laser-level-multi.png" },
  { listing_id: TILE_ID, trade_slug: TILE_SLUG, kind: "showcase", title: "Bathroom wall laser setup — first course",
    body: "Bottom course is the most important — set it wrong and every course above drifts. Laser + spacers + patience.",
    image: "tiler-wall-laser-level-single.png" },
  { listing_id: TILE_ID, trade_slug: TILE_SLUG, kind: "showcase", title: "Floor tile choices for the client to pick",
    body: "Brought a selection to today's site meeting. Marble-effect vs stone-effect vs concrete-effect porcelain. Client went with the mid-grey stone.",
    image: "tiler-floor-tile-samples-grid.png" },

  // ─── KITCHEN MAKER — Charlotte Pemberton ────────────────────
  { listing_id: KIT_ID, trade_slug: KIT_SLUG, kind: "showcase", title: "Edge banding a set of cabinet doors",
    body: "PU hot-melt adhesive, precision trimmed. This machine bands 40 doors an hour — used to take a full day by hand.",
    image: "kitchen-maker-edge-bander-machine-op.png" },
  { listing_id: KIT_ID, trade_slug: KIT_SLUG, kind: "showcase", title: "Kitchen island out of the workshop, ready for install",
    body: "Bespoke island — 2.4m long, walnut carcass, granite worktop templated separately. Delivered next Tuesday.",
    image: "kitchen-maker-island-assembled-workshop.png" },
  { listing_id: KIT_ID, trade_slug: KIT_SLUG, kind: "showcase", title: "Finish samples — which one for your kitchen?",
    body: "Fresh batch of door samples in shaker, slab + tongue-and-groove profiles. Come look at them in person before you commit.",
    image: "kitchen-maker-kitchen-designs-showcase.png" },
  { listing_id: KIT_ID, trade_slug: KIT_SLUG, kind: "showcase", title: "Second edge bander running today — order backlog",
    body: "Fully booked into February. Second bander now humming to keep up. Every door has 4 sides banded to prevent moisture ingress.",
    image: "kitchen-maker-edge-banders-multi-machine.png" },
  { listing_id: KIT_ID, trade_slug: KIT_SLUG, kind: "showcase", title: "Close-up of the banding head",
    body: "0.4mm ABS tape being applied at 8m/min. The trimmer + buffing wheel finish it flush. Modern kitchens live or die on edge banding quality.",
    image: "kitchen-maker-edge-bander-single.png" },
  { listing_id: KIT_ID, trade_slug: KIT_SLUG, kind: "showcase", title: "Cabinet carcass on the assembly line",
    body: "Pre-drilled, dowelled + glued. Consistency at this stage saves the fitter hours on-site. Everything squared to 0.5mm tolerance.",
    image: "kitchen-maker-assembly-line-panel.png" },
  { listing_id: KIT_ID, trade_slug: KIT_SLUG, kind: "showcase", title: "Hand-assembly of a bespoke unit",
    body: "Some pieces still get built by hand — bespoke bevels + non-standard sizes. Skilled hands + calm music + coffee.",
    image: "kitchen-maker-assembly-workbench.png" },
  { listing_id: KIT_ID, trade_slug: KIT_SLUG, kind: "showcase", title: "CNC cutting a cabinet panel to design spec",
    body: "CAM file loaded, 18mm birch ply going onto the bed. Cuts + drills + labels every panel in one pass. Turnaround improved 3× since we invested.",
    image: "kitchen-maker-cnc-cutting-panel.png" }
];

async function insertPost(p) {
  const hoursAgo = Math.floor(Math.random() * 30);
  const q = `insert into hammerex_trade_off_yard_posts
    (listing_id, kind, trade_slug, title, body, country, image_urls, is_sample, status, moderation_status, created_at, expires_at)
    values (
      '${p.listing_id}',
      'chat',
      '${p.trade_slug}',
      '${p.title.replace(/'/g, "''")}',
      '${p.body.replace(/'/g, "''")}',
      'GB',
      array['${BASE}/${p.image}'],
      true,
      'live',
      'live',
      now() - interval '${hoursAgo} hours',
      now() + interval '90 days'
    )
    returning id, title`;
  const res = await fetch(`https://api.supabase.com/v1/projects/${SB_REF}/database/query`, {
    method:  "POST",
    headers: { "Authorization": `Bearer ${SB_TOKEN}`, "Content-Type": "application/json" },
    body:    JSON.stringify({ query: q })
  });
  const j = await res.json();
  if (Array.isArray(j) && j[0]) console.log(`✓ ${p.trade_slug} · ${j[0].title.slice(0, 55)}`);
  else console.log(`✗ ${p.title} · ${JSON.stringify(j).slice(0, 150)}`);
}

(async () => {
  for (const p of posts) await insertPost(p);
  console.log(`\nSeeded ${posts.length} yard posts across 3 demo merchants.`);
})();
