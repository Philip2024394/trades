// One-shot — upload 3 PIR Insulation Board images to Supabase Storage
// and update (or insert) the matching product on Stuart Kingsley's
// trade-off listing.
//
// Idempotent — `x-upsert: true` on storage, SELECT-then-UPDATE/INSERT
// on the products table. Re-run is safe.

import { readFileSync } from "node:fs";

// --- 1. Env -------------------------------------------------------

const TRADES_ENV = readFileSync("C:\\Users\\Victus\\trades\\.env.local", "utf-8");
const supabaseUrl = (TRADES_ENV.match(/^NEXT_PUBLIC_SUPABASE_URL=(.+)$/m) ?? [])[1]?.trim();
const serviceRole = (TRADES_ENV.match(/^SUPABASE_SERVICE_ROLE_KEY=(.+)$/m) ?? [])[1]?.trim();
if (!supabaseUrl || !serviceRole) {
  throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in trades/.env.local");
}

const HAMMER_ENV = readFileSync("C:\\Users\\Victus\\hammer\\.env.tools.local", "utf-8");
const managementToken = (HAMMER_ENV.match(/^SUPABASE_ACCESS_TOKEN=(.+)$/m) ?? [])[1]?.trim();
if (!managementToken) throw new Error("Missing SUPABASE_ACCESS_TOKEN in hammer/.env.tools.local");

const projectRef = "msdonkkechxzgagyguoe";
const BUCKET = "product-images";
const STORAGE_PREFIX = "imagekit-import";
const LISTING_SLUG = "demo-stuart-kingsley-building-merchant-hull";

// --- 2. Inputs ----------------------------------------------------

const IMAGE_URLS = [
  "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jun%2029,%202026,%2009_18_42%20AM.png",
  "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jun%2029,%202026,%2009_22_04%20AM.png",
  "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jun%2029,%202026,%2009_26_46%20AM.png"
];

const PRODUCT_NAME = "PIR Insulation Board 100mm — pack of 6";
const PRODUCT_PRICE_POUNDS = 210; // pack of 6, mid-market UK PIR 100mm 2.4×1.2 ≈ £30-£40/board
const PRODUCT_PRICE_PENCE = PRODUCT_PRICE_POUNDS * 100;

const DESCRIPTION = `This high-performance 100mm PIR Insulation Board delivers exceptional thermal efficiency and versatility. Designed for flat roofs, pitched roofs, solid floors, and framed walls, these lightweight rigid sheets reduce heat loss and lower energy bills while maintaining a sleek, manageable build-up.

**Key Specifications**

- Thickness: 100 mm
- Board Dimensions: 2400 mm × 1200 mm
- Pack Size: 6 Boards
- Total Pack Coverage: 17.28 m² (Each board covers 2.88 m²)
- Thermal Conductivity: 0.022 W/mK
- Thermal Resistance (R-Value): 4.50 m²K/W
- Facings: Low-emissivity aluminium foil on both sides

**Why Choose This PIR Board?**

- **Superior Thermal Performance**: Highly efficient polyisocyanurate (PIR) core requires less thickness to hit required U-values compared to traditional insulation.
- **Low-E Foil Facings**: Multi-layer foil reflects radiated heat back into the living space while acting as a reliable moisture vapour barrier.
- **Easy to Install**: Lightweight and rigid, making the boards straightforward to measure, cut, and shape using standard hand tools.
- **Eco-Friendly Core**: Manufactured without harmful CFCs or HCFCs, resulting in zero Ozone Depletion Potential (ODP) and low Global Warming Potential (GWP).`;

// Multi-buy → DB column is `bulk_tiers` (see
// supabase/migrations/20260627040000_xrated_wholesale_mode.sql).
// Shape: { min_qty, max_qty?, price_pence }. Computed from the user's
// percent discount against the base price.
const BULK_TIERS = [
  {
    min_qty: 2,
    max_qty: 3,
    price_pence: Math.round(PRODUCT_PRICE_PENCE * 0.95) // 5% off at 2-3
  },
  {
    min_qty: 4,
    max_qty: null,
    price_pence: Math.round(PRODUCT_PRICE_PENCE * 0.93) // 7% off at 4+
  }
];

console.log(`Base price: £${PRODUCT_PRICE_POUNDS} (${PRODUCT_PRICE_PENCE}p)`);
console.log(`Tier 1 (2-3): £${(BULK_TIERS[0].price_pence / 100).toFixed(2)} (5% off)`);
console.log(`Tier 2 (4+):  £${(BULK_TIERS[1].price_pence / 100).toFixed(2)} (7% off)`);

// --- 3. Helpers ---------------------------------------------------

async function query(sql) {
  const r = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${managementToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ query: sql })
  });
  if (!r.ok) throw new Error(`Supabase ${r.status}: ${await r.text()}`);
  return r.json();
}

async function uploadToSupabase(path, bytes, contentType) {
  const r = await fetch(`${supabaseUrl}/storage/v1/object/${BUCKET}/${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${serviceRole}`,
      "Content-Type": contentType,
      "x-upsert": "true"
    },
    body: bytes
  });
  if (!r.ok) {
    throw new Error(`Storage upload ${r.status}: ${await r.text()}`);
  }
  return `${supabaseUrl}/storage/v1/object/public/${BUCKET}/${path}`;
}

function sqlStr(v) {
  if (v === null || v === undefined) return "NULL";
  return `'${String(v).replace(/'/g, "''")}'`;
}

function sqlJsonb(v) {
  return `'${JSON.stringify(v).replace(/'/g, "''")}'::jsonb`;
}

function sqlArrText(arr) {
  // text[] array literal
  const inner = arr.map((s) => `"${String(s).replace(/"/g, '\\"')}"`).join(",");
  return `ARRAY[${arr.map((s) => sqlStr(s)).join(", ")}]::text[]`;
  // (use the second form — ARRAY[...] is safer for quoting)
}

// --- 4. Schema sanity check --------------------------------------

console.log("\n--- Schema check ---");
const cols = await query(`
  SELECT column_name, data_type, udt_name
    FROM information_schema.columns
   WHERE table_schema = 'public'
     AND table_name = 'hammerex_xrated_products'
     AND column_name IN (
       'id','listing_id','name','description','price_pence','cover_url',
       'gallery_urls','image_urls','bulk_tiers','multi_buy','status',
       'product_kind','kind','stock_count','dispatch_days','sort_order'
     )
   ORDER BY column_name;
`);
console.log("Relevant columns present:");
for (const c of cols) console.log(`  ${c.column_name.padEnd(20)} ${c.data_type}${c.udt_name ? ` (${c.udt_name})` : ""}`);

const colNames = new Set(cols.map((c) => c.column_name));
if (!colNames.has("bulk_tiers")) throw new Error("Expected bulk_tiers column on hammerex_xrated_products");
if (!colNames.has("gallery_urls")) throw new Error("Expected gallery_urls column on hammerex_xrated_products");
if (!colNames.has("cover_url")) throw new Error("Expected cover_url column on hammerex_xrated_products");

// --- 5. Upload images --------------------------------------------

console.log("\n--- Image upload ---");
const publicUrls = [];
for (let i = 0; i < IMAGE_URLS.length; i++) {
  const src = IMAGE_URLS[i];
  const path = `${STORAGE_PREFIX}/stuart-pir-insulation-${i + 1}.png`;
  console.log(`[${i + 1}/${IMAGE_URLS.length}] fetching ${src.slice(0, 80)}…`);
  const r = await fetch(src);
  if (!r.ok) throw new Error(`download ${src}: ${r.status}`);
  const buf = Buffer.from(await r.arrayBuffer());
  const contentType = r.headers.get("content-type") ?? "image/png";
  console.log(`         uploading ${buf.byteLength} bytes (${contentType}) → ${path}`);
  const publicUrl = await uploadToSupabase(path, buf, contentType);
  publicUrls.push(publicUrl);
  console.log(`         ${publicUrl}`);
}

const [coverUrl, galleryA, galleryB] = publicUrls;
const galleryUrls = [galleryA, galleryB]; // capped 3 in API; we use 2

// --- 6. Find listing ---------------------------------------------

console.log("\n--- Listing lookup ---");
const listingRows = await query(`
  SELECT id, slug, display_name
    FROM hammerex_trade_off_listings
   WHERE slug = '${LISTING_SLUG}';
`);
if (listingRows.length === 0) throw new Error(`Listing '${LISTING_SLUG}' not found.`);
const listing = listingRows[0];
console.log(`Listing: ${listing.display_name ?? "(no name)"} — id ${listing.id}`);

// --- 7. Find existing product ------------------------------------

console.log("\n--- Product lookup ---");
const productRows = await query(`
  SELECT id, name, price_pence, cover_url, gallery_urls, bulk_tiers, description
    FROM hammerex_xrated_products
   WHERE listing_id = '${listing.id}'
     AND name ILIKE '%PIR Insulation%';
`);

const descLit = sqlStr(DESCRIPTION);
const coverLit = sqlStr(coverUrl);
// gallery_urls is jsonb on this project (not text[])
const galleryLit = sqlJsonb(galleryUrls);
const bulkLit = sqlJsonb(BULK_TIERS);
const nameLit = sqlStr(PRODUCT_NAME);

let mode;
let productId;

if (productRows.length > 0) {
  mode = "UPDATE";
  const existing = productRows[0];
  productId = existing.id;
  console.log(`Existing product found: id ${productId}, current name "${existing.name}"`);
  const upd = await query(`
    UPDATE hammerex_xrated_products
       SET name         = ${nameLit},
           description  = ${descLit},
           cover_url    = ${coverLit},
           gallery_urls = ${galleryLit},
           bulk_tiers   = ${bulkLit}
     WHERE id = '${productId}'
       AND listing_id = '${listing.id}'
     RETURNING id, name, price_pence, cover_url, gallery_urls, bulk_tiers,
               LENGTH(description) AS description_len;
  `);
  console.log("UPDATE result:", JSON.stringify(upd[0], null, 2));
} else {
  mode = "INSERT";
  console.log("No existing PIR product — inserting fresh row.");
  const ins = await query(`
    INSERT INTO hammerex_xrated_products
      (listing_id, name, description, price_pence, cover_url, gallery_urls, bulk_tiers, status, sort_order)
    VALUES
      ('${listing.id}',
       ${nameLit},
       ${descLit},
       ${PRODUCT_PRICE_PENCE},
       ${coverLit},
       ${galleryLit},
       ${bulkLit},
       'live',
       0)
    RETURNING id, name, price_pence, cover_url, gallery_urls, bulk_tiers,
              LENGTH(description) AS description_len;
  `);
  productId = ins[0].id;
  console.log("INSERT result:", JSON.stringify(ins[0], null, 2));
}

// --- 8. Verify ----------------------------------------------------

console.log("\n--- Verification ---");
const finalRows = await query(`
  SELECT id, name, price_pence, cover_url,
         jsonb_array_length(gallery_urls) AS gallery_count,
         jsonb_array_length(bulk_tiers) AS tier_count,
         LENGTH(description) AS description_len,
         status
    FROM hammerex_xrated_products
   WHERE id = '${productId}';
`);
console.log(JSON.stringify(finalRows[0], null, 2));

console.log(`\n${mode === "INSERT" ? "Inserted" : "Updated"} product ${productId} on listing ${listing.id}.`);
console.log("\nPublic image URLs:");
for (const u of publicUrls) console.log(`  ${u}`);
