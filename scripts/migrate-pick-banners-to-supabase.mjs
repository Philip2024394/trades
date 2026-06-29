// Migrate Trade Center Picks banner images + video cover images
// from ImageKit → Supabase Storage, resized to 3200×1600 for sharp
// full-bleed display at all viewport widths.
//
// Why a focused script (not the general migrator):
//  - The general migrate-imagekit-to-supabase.mjs only handles
//    avatar_url + custom_app_hero_url on the listings table.
//  - Picks live in hammerex_xrated_trade_center_picks (new table).
//  - These images need RESIZE before upload (ImageKit ?tr= transform)
//    rather than copied as-is.
//
// Idempotent — already-migrated URLs are skipped via the shared
// .imagekit-migration-map.json.

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { join, basename } from "node:path";

const TRADES_ROOT = "C:\\Users\\Victus\\trades";
const MAP_PATH = join(TRADES_ROOT, "scripts", ".imagekit-migration-map.json");
const BUCKET = "product-images";
const STORAGE_PREFIX = "imagekit-import";

// 3200x1600 = 2:1 ratio at 2x DPI sharpness for desktop banners.
// c-maintain_ratio fits within bounds without crop.
const IK_TRANSFORM = "tr=w-3200,h-1600,c-maintain_ratio,f-jpg,q-85";

const ENV_TEXT = readFileSync(join(TRADES_ROOT, ".env.local"), "utf-8");
const supabaseUrl = (ENV_TEXT.match(/^NEXT_PUBLIC_SUPABASE_URL=(.+)$/m) ?? [])[1]?.trim();
const serviceRole = (ENV_TEXT.match(/^SUPABASE_SERVICE_ROLE_KEY=(.+)$/m) ?? [])[1]?.trim();
if (!supabaseUrl || !serviceRole) throw new Error("Missing Supabase env vars");

const HAMMER_ENV = readFileSync("C:\\Users\\Victus\\hammer\\.env.tools.local", "utf-8");
const managementToken = (HAMMER_ENV.match(/^SUPABASE_ACCESS_TOKEN=(.+)$/m) ?? [])[1]?.trim();
if (!managementToken) throw new Error("Missing management token");
const projectRef = "msdonkkechxzgagyguoe";

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

function safePath(url) {
  const hash = createHash("sha1").update(url).digest("hex").slice(0, 12);
  let raw;
  try {
    raw = decodeURIComponent(basename(new URL(url).pathname));
  } catch {
    raw = "image";
  }
  const safe = raw.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 60);
  return `${STORAGE_PREFIX}/${hash}-${safe.replace(/\.png$/, ".jpg")}`;
}

function withTransform(ikUrl) {
  // Insert the transform query before any existing query string (or as the
  // sole query string). ImageKit honours ?tr=... for re-encoding.
  const [base, qs] = ikUrl.split("?", 2);
  if (qs) {
    // Preserve other params but add tr.
    if (qs.includes("tr=")) return ikUrl; // already has a tr param
    return `${base}?${IK_TRANSFORM}&${qs}`;
  }
  return `${base}?${IK_TRANSFORM}`;
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
  if (!r.ok) throw new Error(`Storage upload ${r.status}: ${await r.text()}`);
  return `${supabaseUrl}/storage/v1/object/public/${BUCKET}/${path}`;
}

// 1. Query DB for ImageKit URLs across picks + listings.video_cover_url
const pickRows = await query(`
  SELECT id, banner_image_url
    FROM hammerex_xrated_trade_center_picks
   WHERE banner_image_url LIKE '%ik.imagekit.io%';
`);
const listingRows = await query(`
  SELECT id, slug, video_cover_url
    FROM hammerex_trade_off_listings
   WHERE video_cover_url LIKE '%ik.imagekit.io%';
`);

const allUrls = new Set();
for (const r of pickRows) allUrls.add(r.banner_image_url);
for (const r of listingRows) allUrls.add(r.video_cover_url);

console.log(`Found ${pickRows.length} pick rows + ${listingRows.length} listing rows referencing ImageKit.`);
console.log(`Unique URLs to migrate: ${allUrls.size}.`);

// 2. Download (resized) + upload each unique URL, track in map
const map = existsSync(MAP_PATH) ? JSON.parse(readFileSync(MAP_PATH, "utf-8")) : {};
let migrated = 0;
let skipped = 0;
let failed = 0;

for (const oldUrl of allUrls) {
  if (map[oldUrl]) {
    skipped++;
    continue;
  }
  try {
    const downloadUrl = withTransform(oldUrl);
    const r = await fetch(downloadUrl);
    if (!r.ok) throw new Error(`download ${r.status}`);
    const buf = Buffer.from(await r.arrayBuffer());
    const path = safePath(oldUrl);
    const newUrl = await uploadToSupabase(path, buf, "image/jpeg");
    map[oldUrl] = newUrl;
    migrated++;
    writeFileSync(MAP_PATH, JSON.stringify(map, null, 2));
    console.log(`  + ${path}  (${(buf.length / 1024).toFixed(0)} KB)`);
  } catch (e) {
    failed++;
    console.log(`  ! ${oldUrl.slice(0, 80)}…: ${e.message}`);
  }
}
console.log(`\nDownload+upload: ${migrated} new, ${skipped} already-mapped, ${failed} failed.`);

// 3. Rewrite DB rows
let pickUpdates = 0;
for (const row of pickRows) {
  const newUrl = map[row.banner_image_url];
  if (!newUrl) continue;
  await query(`
    UPDATE hammerex_xrated_trade_center_picks
       SET banner_image_url = '${newUrl.replace(/'/g, "''")}'
     WHERE id = '${row.id}';
  `);
  pickUpdates++;
}
let listingUpdates = 0;
for (const row of listingRows) {
  const newUrl = map[row.video_cover_url];
  if (!newUrl) continue;
  await query(`
    UPDATE hammerex_trade_off_listings
       SET video_cover_url = '${newUrl.replace(/'/g, "''")}'
     WHERE id = '${row.id}';
  `);
  listingUpdates++;
}
console.log(`\nDB rewrite: ${pickUpdates} pick rows, ${listingUpdates} listing rows updated.`);

// 4. Verify
const left = await query(`
  SELECT
    (SELECT count(*) FROM hammerex_xrated_trade_center_picks WHERE banner_image_url LIKE '%ik.imagekit.io%') AS picks_left,
    (SELECT count(*) FROM hammerex_trade_off_listings WHERE video_cover_url LIKE '%ik.imagekit.io%') AS listings_left;
`);
console.log(`\nVerification: ${left[0].picks_left} pick URLs + ${left[0].listings_left} listing URLs still on ImageKit.`);
if (left[0].picks_left === 0 && left[0].listings_left === 0) {
  console.log(`✓ ZERO ImageKit URLs remain in pick/video columns. Migration complete.`);
}
