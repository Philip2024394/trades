// scripts/nex-seed-aisha-shop.mts
//
// Dev seeder · gives Aisha Rahman (nex-52091) a nex_business row +
// 6 mock vintage-camera products so the shop icon on peer chat has
// something real to open into.
//
// Usage:
//   NEX_ALLOW_DEV_ADMIN=1 npx tsx scripts/nex-seed-aisha-shop.mts
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

const AISHA_ID = "d3e7f000-0002-4a00-b000-000000000002";
const BUSINESS_ID = "d3e7f000-0002-b001-4a00-000000000001";
const BUSINESS_SLUG = "aisha-vintage-cameras";

interface Product {
  id: string;
  name: string;
  description: string;
  price_pence: number;
  image_url: string;
  tags: string[];
}

const PRODUCTS: Product[] = [
  {
    id: "d3e7f000-0002-b001-4a00-000000000101",
    name: "Leica M3",
    description:
      "1954 · double-stroke · 50mm Summicron collapsible · glass excellent · body brassing consistent with age · CLA'd 2024.",
    price_pence: 285_000_00,
    image_url:
      "https://images.unsplash.com/photo-1495707902641-75cac588d2e9?w=800&auto=format&fit=crop",
    tags: ["rangefinder", "leica", "50s"],
  },
  {
    id: "d3e7f000-0002-b001-4a00-000000000102",
    name: "Rolleiflex 3.5F",
    description:
      "1960 · Planar 75mm f/3.5 · viewfinder crisp · shutter accurate at all speeds · leather like new · serviced.",
    price_pence: 195_000_00,
    image_url:
      "https://images.unsplash.com/photo-1516961642265-531546e84af2?w=800&auto=format&fit=crop",
    tags: ["tlr", "medium-format", "60s"],
  },
  {
    id: "d3e7f000-0002-b001-4a00-000000000103",
    name: "Nikon F Photomic",
    description:
      "1962 · original prism intact · Nikkor 50mm f/1.4 pre-Ai · fully mechanical · film tested with lab scan sample included.",
    price_pence: 88_000_00,
    image_url:
      "https://images.unsplash.com/photo-1494707892708-d2a45716be24?w=800&auto=format&fit=crop",
    tags: ["slr", "nikon", "60s"],
  },
  {
    id: "d3e7f000-0002-b001-4a00-000000000104",
    name: "Hasselblad 500 C/M",
    description:
      "1974 · Zeiss Planar 80mm f/2.8 T* · A12 back · CLA'd 2023 · dark slide included · the classic square.",
    price_pence: 320_000_00,
    image_url:
      "https://images.unsplash.com/photo-1611304565539-30b62ee2be1e?w=800&auto=format&fit=crop",
    tags: ["medium-format", "hasselblad", "70s"],
  },
  {
    id: "d3e7f000-0002-b001-4a00-000000000105",
    name: "Pentax K1000",
    description:
      "1978 · the beginner's classic · SMC Pentax 50mm f/2 · meter working · ideal first-film camera · body 8/10.",
    price_pence: 32_000_00,
    image_url:
      "https://images.unsplash.com/photo-1533703600665-5cf47f6b56f5?w=800&auto=format&fit=crop",
    tags: ["slr", "pentax", "70s"],
  },
  {
    id: "d3e7f000-0002-b001-4a00-000000000106",
    name: "Olympus OM-1",
    description:
      "1976 · smallest full-frame SLR of its era · Zuiko 50mm f/1.4 · light meter converted to LR44 · silky shutter.",
    price_pence: 48_000_00,
    image_url:
      "https://images.unsplash.com/photo-1512790803329-84b4b5a09c76?w=800&auto=format&fit=crop",
    tags: ["slr", "olympus", "70s"],
  },
];

async function main() {
  const db = new PgClient({ connectionString: process.env.DATABASE_URL });
  await db.connect();
  try {
    // 1. Business row · vintage camera shop.
    await db.query(
      `INSERT INTO nex_business (
         id, owner_account_id, display_name, slug,
         description, logo_url, address,
         accepts_cod, accepts_pickup,
         instagram_handle
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, false, true, $8)
       ON CONFLICT (id) DO UPDATE SET
         display_name = EXCLUDED.display_name,
         slug = EXCLUDED.slug,
         description = EXCLUDED.description,
         logo_url = EXCLUDED.logo_url,
         address = EXCLUDED.address,
         accepts_pickup = EXCLUDED.accepts_pickup,
         instagram_handle = EXCLUDED.instagram_handle,
         updated_at = now()`,
      [
        BUSINESS_ID,
        AISHA_ID,
        "Aisha · Vintage Cameras",
        BUSINESS_SLUG,
        "Working vintage cameras · sourced across Asia · every piece film-tested · Jakarta pickup or courier anywhere.",
        "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=200&h=200&fit=crop",
        "Jakarta · pickup by appointment",
        "aisha.vintage.cameras",
      ],
    );
    console.log("✓ business row synced");

    // 2. Products · 6 mock vintage cameras.
    for (const p of PRODUCTS) {
      await db.query(
        `INSERT INTO nex_product (
           id, business_id, name, description, price_pence,
           currency, status, image_url, tags, stock_status
         )
         VALUES ($1, $2, $3, $4, $5, 'IDR', 'live', $6, $7, 'in_stock')
         ON CONFLICT (id) DO UPDATE SET
           name = EXCLUDED.name,
           description = EXCLUDED.description,
           price_pence = EXCLUDED.price_pence,
           image_url = EXCLUDED.image_url,
           tags = EXCLUDED.tags,
           updated_at = now()`,
        [
          p.id,
          BUSINESS_ID,
          p.name,
          p.description,
          p.price_pence,
          p.image_url,
          p.tags,
        ],
      );
      console.log(`  · ${p.name}`);
    }
    console.log(`✓ ${PRODUCTS.length} products synced`);

    // 3. Verify.
    const r = await db.query(
      `SELECT b.display_name, b.slug, COUNT(p.id) AS product_count
         FROM nex_business b
         LEFT JOIN nex_product p ON p.business_id = b.id
        WHERE b.id = $1
        GROUP BY b.id, b.display_name, b.slug`,
      [BUSINESS_ID],
    );
    console.log("\nshop summary:", r.rows[0]);
  } finally {
    await db.end();
  }
}

main().catch((e) => {
  console.error("FAIL:", e);
  process.exit(1);
});
