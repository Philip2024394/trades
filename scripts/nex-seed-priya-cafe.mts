// scripts/nex-seed-priya-cafe.mts
//
// Dev seeder · turns Priya Patel (nex-91280) into a real Mumbai cafe
// with a full menu · 4 sections · 16 items with photography, dietary
// tags, allergens, spice levels, prep times.
//
// Usage:
//   NEX_ALLOW_DEV_ADMIN=1 npx tsx scripts/nex-seed-priya-cafe.mts
//
// Idempotent · uses fixed UUIDs so re-running just refreshes rows.

import * as fs from "node:fs";
import * as path from "node:path";
import { Client as PgClient } from "pg";

function loadEnv() {
  const p = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(p)) return;
  for (const line of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (m && !process.env[m[1]!])
      process.env[m[1]!] = m[2]!.replace(/^["']|["']$/g, "");
  }
}
loadEnv();

if (process.env.NEX_ALLOW_DEV_ADMIN !== "1") {
  console.error("FAIL · NEX_ALLOW_DEV_ADMIN=1 required · dev-only seeder");
  process.exit(1);
}
if (!process.env.DATABASE_URL) {
  console.error("FAIL · DATABASE_URL missing");
  process.exit(1);
}

const PRIYA_ID = "d3e7f000-0005-4a00-b000-000000000005";
const BUSINESS_ID = "d3e7f000-0005-b001-4a00-000000000001";
const BUSINESS_SLUG = "priya-mumbai-cafe";

interface SectionSeed {
  id: string;
  name: string;
  description: string | null;
  sort_order: number;
}

interface ItemSeed {
  id: string;
  section_id: string;
  name: string;
  description: string;
  price_pence: number;
  image_url: string;
  dietary_tags: string[];
  allergens: string[];
  spice_level: number;
  is_featured: boolean;
  preparation_time: string | null;
  portion_note: string | null;
  sort_order: number;
}

const SECTIONS: SectionSeed[] = [
  {
    id: "d3e7f000-0005-c001-4a00-000000000101",
    name: "Chai & Filter Coffee",
    description:
      "Small-batch spiced chai brewed to order · single-origin filter coffee from Chikmagalur.",
    sort_order: 10,
  },
  {
    id: "d3e7f000-0005-c001-4a00-000000000102",
    name: "Breakfast",
    description:
      "Served all day · every plate made from scratch with produce from our neighbourhood market.",
    sort_order: 20,
  },
  {
    id: "d3e7f000-0005-c001-4a00-000000000103",
    name: "Mains",
    description:
      "Priya's family recipes · slow-cooked · vegetarian by default, meat available on request.",
    sort_order: 30,
  },
  {
    id: "d3e7f000-0005-c001-4a00-000000000104",
    name: "Sweets & Desserts",
    description:
      "House-made daily · limited quantities · call ahead for large orders.",
    sort_order: 40,
  },
];

const ITEMS: ItemSeed[] = [
  // --- Chai & Coffee ---
  {
    id: "d3e7f000-0005-d001-4a00-000000000201",
    section_id: SECTIONS[0]!.id,
    name: "Masala Chai",
    description:
      "Assam CTC · cardamom · fresh ginger · cinnamon · clove · brewed with full-cream milk from a small dairy in Alibag.",
    price_pence: 25_000_00,
    image_url:
      "https://images.unsplash.com/photo-1571934811356-5cc061b6821f?w=800&auto=format&fit=crop",
    dietary_tags: ["vegetarian"],
    allergens: ["dairy"],
    spice_level: 1,
    is_featured: true,
    preparation_time: "5 mins",
    portion_note: "200ml cup",
    sort_order: 10,
  },
  {
    id: "d3e7f000-0005-d001-4a00-000000000202",
    section_id: SECTIONS[0]!.id,
    name: "Filter Coffee",
    description:
      "60/40 Arabica/Peaberry from Chikmagalur · brewed South-Indian style in a stainless dabara set · served hot with jaggery on the side.",
    price_pence: 30_000_00,
    image_url:
      "https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=800&auto=format&fit=crop",
    dietary_tags: ["vegetarian"],
    allergens: ["dairy"],
    spice_level: 0,
    is_featured: false,
    preparation_time: "4 mins",
    portion_note: "180ml",
    sort_order: 20,
  },
  {
    id: "d3e7f000-0005-d001-4a00-000000000203",
    section_id: SECTIONS[0]!.id,
    name: "Cutting Chai",
    description:
      "The Mumbai classic · half-glass strong chai · perfect between breakfast and lunch.",
    price_pence: 15_000_00,
    image_url:
      "https://images.unsplash.com/photo-1594631252845-29fc4cc8cde9?w=800&auto=format&fit=crop",
    dietary_tags: ["vegetarian"],
    allergens: ["dairy"],
    spice_level: 1,
    is_featured: false,
    preparation_time: "3 mins",
    portion_note: "100ml cutting glass",
    sort_order: 30,
  },
  // --- Breakfast ---
  {
    id: "d3e7f000-0005-d001-4a00-000000000301",
    section_id: SECTIONS[1]!.id,
    name: "Masala Dosa",
    description:
      "Fermented rice-and-urad crepe · yellow potato filling with mustard seeds, curry leaves, and turmeric · coconut chutney + sambar on the side.",
    price_pence: 65_000_00,
    image_url:
      "https://images.unsplash.com/photo-1668236543090-82eba5ee5976?w=800&auto=format&fit=crop",
    dietary_tags: ["vegetarian", "gluten-free"],
    allergens: [],
    spice_level: 1,
    is_featured: true,
    preparation_time: "15 mins",
    portion_note: "1 large dosa · serves 1",
    sort_order: 10,
  },
  {
    id: "d3e7f000-0005-d001-4a00-000000000302",
    section_id: SECTIONS[1]!.id,
    name: "Poha",
    description:
      "Flattened rice tempered with mustard seeds, curry leaves, turmeric, green chili · finished with lemon, coriander, and pomegranate.",
    price_pence: 45_000_00,
    image_url:
      "https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?w=800&auto=format&fit=crop",
    dietary_tags: ["vegan", "vegetarian", "gluten-free"],
    allergens: [],
    spice_level: 1,
    is_featured: false,
    preparation_time: "10 mins",
    portion_note: "Serves 1",
    sort_order: 20,
  },
  {
    id: "d3e7f000-0005-d001-4a00-000000000303",
    section_id: SECTIONS[1]!.id,
    name: "Idli Sambar",
    description:
      "Three fluffy steamed rice cakes · lentil-vegetable sambar simmered for four hours · coconut chutney.",
    price_pence: 40_000_00,
    image_url:
      "https://images.unsplash.com/photo-1610192244261-3f33de3f55e4?w=800&auto=format&fit=crop",
    dietary_tags: ["vegan", "vegetarian", "gluten-free"],
    allergens: [],
    spice_level: 1,
    is_featured: false,
    preparation_time: "8 mins",
    portion_note: "3 pieces · serves 1",
    sort_order: 30,
  },
  {
    id: "d3e7f000-0005-d001-4a00-000000000304",
    section_id: SECTIONS[1]!.id,
    name: "Bombay Sandwich",
    description:
      "Cucumber · tomato · onion · boiled potato · mint chutney · butter on white bread · grilled crisp · served with masala potato chips.",
    price_pence: 55_000_00,
    image_url:
      "https://images.unsplash.com/photo-1608847569619-fddfec1a3f39?w=800&auto=format&fit=crop",
    dietary_tags: ["vegetarian"],
    allergens: ["wheat", "gluten", "dairy"],
    spice_level: 1,
    is_featured: false,
    preparation_time: "12 mins",
    portion_note: "Cut into 4 triangles",
    sort_order: 40,
  },
  {
    id: "d3e7f000-0005-d001-4a00-000000000305",
    section_id: SECTIONS[1]!.id,
    name: "Anda Bhurji",
    description:
      "Scrambled eggs the Bombay way · caramelised onion · tomato · green chili · coriander · served with buttered pav (Indian dinner rolls).",
    price_pence: 60_000_00,
    image_url:
      "https://images.unsplash.com/photo-1590301157890-4810ed352733?w=800&auto=format&fit=crop",
    dietary_tags: [],
    allergens: ["eggs", "wheat", "gluten", "dairy"],
    spice_level: 2,
    is_featured: false,
    preparation_time: "10 mins",
    portion_note: "3 eggs · 2 pav",
    sort_order: 50,
  },
  // --- Mains ---
  {
    id: "d3e7f000-0005-d001-4a00-000000000401",
    section_id: SECTIONS[2]!.id,
    name: "Rajma Chawal",
    description:
      "Punjabi kidney-bean curry cooked overnight in a heavy iron pot · onion, tomato, ginger-garlic base · basmati rice · a wedge of raw onion.",
    price_pence: 85_000_00,
    image_url:
      "https://images.unsplash.com/photo-1512058564366-18510be2db19?w=800&auto=format&fit=crop",
    dietary_tags: ["vegan", "vegetarian", "gluten-free"],
    allergens: [],
    spice_level: 2,
    is_featured: true,
    preparation_time: "15 mins (pre-cooked)",
    portion_note: "Serves 1 hearty",
    sort_order: 10,
  },
  {
    id: "d3e7f000-0005-d001-4a00-000000000402",
    section_id: SECTIONS[2]!.id,
    name: "Chole Bhature",
    description:
      "Slow-cooked chickpea curry with a Delhi spice bloom (jeera, coriander, amchur) · two puffed maida bhature made to order · pickled onion.",
    price_pence: 95_000_00,
    image_url:
      "https://images.unsplash.com/photo-1626132647523-66c30f5c9264?w=800&auto=format&fit=crop",
    dietary_tags: ["vegetarian"],
    allergens: ["wheat", "gluten"],
    spice_level: 2,
    is_featured: false,
    preparation_time: "18 mins",
    portion_note: "2 bhature · serves 1",
    sort_order: 20,
  },
  {
    id: "d3e7f000-0005-d001-4a00-000000000403",
    section_id: SECTIONS[2]!.id,
    name: "Paneer Butter Masala",
    description:
      "Ghar-made paneer in a cashew-tomato gravy · butter-finished · served with garlic naan and cumin-scented basmati.",
    price_pence: 130_000_00,
    image_url:
      "https://images.unsplash.com/photo-1631452180519-c014fe946bc7?w=800&auto=format&fit=crop",
    dietary_tags: ["vegetarian"],
    allergens: ["dairy", "nuts", "wheat", "gluten"],
    spice_level: 1,
    is_featured: false,
    preparation_time: "20 mins",
    portion_note: "Serves 1 (large enough to share)",
    sort_order: 30,
  },
  {
    id: "d3e7f000-0005-d001-4a00-000000000404",
    section_id: SECTIONS[2]!.id,
    name: "Bhindi Do Pyaza",
    description:
      "Okra sautéed with double the onion (a base fry + a fresh crunch on top) · dry-style · rotli on the side.",
    price_pence: 75_000_00,
    image_url:
      "https://images.unsplash.com/photo-1642821373181-696a54913e93?w=800&auto=format&fit=crop",
    dietary_tags: ["vegan", "vegetarian"],
    allergens: ["wheat", "gluten"],
    spice_level: 2,
    is_featured: false,
    preparation_time: "15 mins",
    portion_note: "Serves 1",
    sort_order: 40,
  },
  // --- Sweets ---
  {
    id: "d3e7f000-0005-d001-4a00-000000000501",
    section_id: SECTIONS[3]!.id,
    name: "Gulab Jamun",
    description:
      "Two golden khoya balls in warm cardamom-rose syrup · served with a scoop of vanilla ice cream if you ask.",
    price_pence: 40_000_00,
    image_url:
      "https://images.unsplash.com/photo-1614844450826-cf9d17d80100?w=800&auto=format&fit=crop",
    dietary_tags: ["vegetarian"],
    allergens: ["dairy", "wheat", "gluten"],
    spice_level: 0,
    is_featured: true,
    preparation_time: "5 mins",
    portion_note: "2 pieces",
    sort_order: 10,
  },
  {
    id: "d3e7f000-0005-d001-4a00-000000000502",
    section_id: SECTIONS[3]!.id,
    name: "Kesar Kulfi",
    description:
      "Dense reduced-milk kulfi flavoured with saffron and cardamom · pistachio garnish · frozen on a stick.",
    price_pence: 45_000_00,
    image_url:
      "https://images.unsplash.com/photo-1590080875515-8a3a8dc5735e?w=800&auto=format&fit=crop",
    dietary_tags: ["vegetarian"],
    allergens: ["dairy", "nuts"],
    spice_level: 0,
    is_featured: false,
    preparation_time: "2 mins",
    portion_note: "1 stick",
    sort_order: 20,
  },
  {
    id: "d3e7f000-0005-d001-4a00-000000000503",
    section_id: SECTIONS[3]!.id,
    name: "Kaju Katli",
    description:
      "Cashew-and-cardamom fudge slice · pressed thin · finished with edible silver leaf · sold by weight when packed for gifting.",
    price_pence: 55_000_00,
    image_url:
      "https://images.unsplash.com/photo-1541599540903-216a46ca1dc0?w=800&auto=format&fit=crop",
    dietary_tags: ["vegetarian", "gluten-free"],
    allergens: ["nuts", "dairy"],
    spice_level: 0,
    is_featured: false,
    preparation_time: "Immediate",
    portion_note: "2 pieces",
    sort_order: 30,
  },
];

async function main() {
  const db = new PgClient({ connectionString: process.env.DATABASE_URL });
  await db.connect();
  try {
    // 1. Business row · cafe category.
    await db.query(
      `INSERT INTO nex_business (
         id, owner_account_id, display_name, slug,
         description, logo_url, address,
         accepts_cod, accepts_pickup,
         instagram_handle,
         business_category,
         search_keywords
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, true, true, $8, 'cafe', $9)
       ON CONFLICT (id) DO UPDATE SET
         display_name = EXCLUDED.display_name,
         slug = EXCLUDED.slug,
         description = EXCLUDED.description,
         logo_url = EXCLUDED.logo_url,
         address = EXCLUDED.address,
         accepts_cod = true,
         accepts_pickup = true,
         instagram_handle = EXCLUDED.instagram_handle,
         business_category = 'cafe',
         search_keywords = EXCLUDED.search_keywords,
         updated_at = now()`,
      [
        BUSINESS_ID,
        PRIYA_ID,
        "Priya's · Mumbai Cafe",
        BUSINESS_SLUG,
        "A neighbourhood cafe in Bandra West · Priya cooks her grandmother's recipes and pours filter coffee the way South India taught her. Small kitchen · no shortcuts · food ready when it's ready.",
        "https://images.unsplash.com/photo-1554118811-1e0d58224f24?w=1200&auto=format&fit=crop",
        "Bandra West · Mumbai · pickup by appointment",
        "priya.mumbai.cafe",
        [
          "indian food",
          "mumbai cafe",
          "chai",
          "filter coffee",
          "vegetarian",
          "masala dosa",
          "bandra",
          "breakfast",
          "gulab jamun",
          "home cooking",
          "regional indian",
          "small batch",
        ],
      ],
    );
    console.log("✓ business synced · cafe category");

    // 2. Sections
    for (const s of SECTIONS) {
      await db.query(
        `INSERT INTO nex_menu_section (id, business_id, name, description, sort_order)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (id) DO UPDATE SET
           name = EXCLUDED.name,
           description = EXCLUDED.description,
           sort_order = EXCLUDED.sort_order,
           updated_at = now()`,
        [s.id, BUSINESS_ID, s.name, s.description, s.sort_order],
      );
      console.log(`  · section · ${s.name}`);
    }

    // 3. Items
    for (const it of ITEMS) {
      await db.query(
        `INSERT INTO nex_menu_item (
           id, business_id, section_id, name, description,
           price_pence, currency, image_url,
           dietary_tags, allergens, spice_level,
           is_available, is_featured, preparation_time, portion_note,
           sort_order, status
         )
         VALUES ($1, $2, $3, $4, $5, $6, 'IDR', $7, $8, $9, $10, true, $11, $12, $13, $14, 'live')
         ON CONFLICT (id) DO UPDATE SET
           section_id = EXCLUDED.section_id,
           name = EXCLUDED.name,
           description = EXCLUDED.description,
           price_pence = EXCLUDED.price_pence,
           image_url = EXCLUDED.image_url,
           dietary_tags = EXCLUDED.dietary_tags,
           allergens = EXCLUDED.allergens,
           spice_level = EXCLUDED.spice_level,
           is_featured = EXCLUDED.is_featured,
           preparation_time = EXCLUDED.preparation_time,
           portion_note = EXCLUDED.portion_note,
           sort_order = EXCLUDED.sort_order,
           updated_at = now()`,
        [
          it.id,
          BUSINESS_ID,
          it.section_id,
          it.name,
          it.description,
          it.price_pence,
          it.image_url,
          it.dietary_tags,
          it.allergens,
          it.spice_level,
          it.is_featured,
          it.preparation_time,
          it.portion_note,
          it.sort_order,
        ],
      );
      console.log(`  · item · ${it.name}`);
    }

    // 4. Summary
    const r = await db.query(
      `SELECT b.display_name, b.slug, b.business_category,
              (SELECT COUNT(*) FROM nex_menu_section WHERE business_id=b.id) AS sections,
              (SELECT COUNT(*) FROM nex_menu_item    WHERE business_id=b.id) AS items
         FROM nex_business b WHERE b.id=$1`,
      [BUSINESS_ID],
    );
    console.log("\nsummary:", r.rows[0]);
  } finally {
    await db.end();
  }
}

main().catch((e) => {
  console.error("FAIL:", e);
  process.exit(1);
});
