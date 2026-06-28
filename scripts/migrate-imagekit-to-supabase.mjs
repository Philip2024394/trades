// One-shot ImageKit → Supabase Storage migration for the trades app.
//
// Mirrors the Hammerex auto-migration policy (memory:
// reference_hammerex_imagekit_migration_routine.md) but adapted to the
// trades repo's structure. Runs end-to-end in one pass:
//   1. Walks src/ for every ik.imagekit.io URL.
//   2. Queries the live DB for ik.imagekit.io URLs on
//      hammerex_trade_off_listings (avatar_url, custom_app_hero_url).
//   3. For each unique URL, downloads the bytes and uploads to the
//      `product-images` Supabase Storage bucket under
//      `imagekit-import/<hash>-<basename>` to avoid collisions.
//   4. Builds a mapping old → new and writes to
//      scripts/.imagekit-migration-map.json.
//   5. Rewrites every source file with the new URLs.
//   6. UPDATEs every DB row with the new URLs.
//   7. Verifies zero ik.imagekit.io URLs survive in src/ or DB.
//
// Idempotent — already-migrated URLs are recognised via the map and
// skipped. Re-run to migrate any new ImageKit URLs added since.

import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { createHash } from "node:crypto";
import { join, basename } from "node:path";

const TRADES_ROOT = "C:\\Users\\Victus\\trades";
const SRC_ROOT = join(TRADES_ROOT, "src");
const MAP_PATH = join(TRADES_ROOT, "scripts", ".imagekit-migration-map.json");
const BUCKET = "product-images";
const STORAGE_PREFIX = "imagekit-import";

const ENV_TEXT = readFileSync(join(TRADES_ROOT, ".env.local"), "utf-8");
const supabaseUrl = (ENV_TEXT.match(/^NEXT_PUBLIC_SUPABASE_URL=(.+)$/m) ?? [])[1]?.trim();
const serviceRole = (ENV_TEXT.match(/^SUPABASE_SERVICE_ROLE_KEY=(.+)$/m) ?? [])[1]?.trim();
if (!supabaseUrl || !serviceRole) {
  throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
}

const HAMMER_ENV = readFileSync("C:\\Users\\Victus\\hammer\\.env.tools.local", "utf-8");
const managementToken = (HAMMER_ENV.match(/^SUPABASE_ACCESS_TOKEN=(.+)$/m) ?? [])[1]?.trim();
if (!managementToken) throw new Error("Missing SUPABASE_ACCESS_TOKEN in hammer/.env.tools.local");
const projectRef = "msdonkkechxzgagyguoe";

// --- 1. Walk src/ + collect URLs -------------------------------

const IK_RE = /https:\/\/ik\.imagekit\.io\/[^"'\s)]+/g;

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === ".next") continue;
    const p = join(dir, name);
    const s = statSync(p);
    if (s.isDirectory()) walk(p, out);
    else if (/\.(ts|tsx|mjs|md)$/.test(name)) out.push(p);
  }
  return out;
}

const sourceFiles = walk(SRC_ROOT);
const fileUrls = new Map(); // file → Set<url>
const allUrls = new Set();

for (const f of sourceFiles) {
  const text = readFileSync(f, "utf-8");
  const matches = text.match(IK_RE);
  if (!matches) continue;
  const set = new Set(matches);
  fileUrls.set(f, set);
  for (const u of set) allUrls.add(u);
}

console.log(`Found ${allUrls.size} unique ImageKit URLs across ${fileUrls.size} source files.`);

// --- 2. Query DB for ImageKit URLs ----------------------------

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

const dbRows = await query(`
  SELECT id, slug, avatar_url, custom_app_hero_url
    FROM hammerex_trade_off_listings
   WHERE avatar_url LIKE '%ik.imagekit.io%'
      OR custom_app_hero_url LIKE '%ik.imagekit.io%';
`);
for (const row of dbRows) {
  if (row.avatar_url && row.avatar_url.includes("ik.imagekit.io")) allUrls.add(row.avatar_url);
  if (row.custom_app_hero_url && row.custom_app_hero_url.includes("ik.imagekit.io")) allUrls.add(row.custom_app_hero_url);
}
console.log(`+ ${dbRows.length} DB rows reference ImageKit. Total unique URLs to migrate: ${allUrls.size}.`);

// --- 3. Download + upload ------------------------------------

const map = existsSync(MAP_PATH) ? JSON.parse(readFileSync(MAP_PATH, "utf-8")) : {};
let migrated = 0;
let skipped = 0;
let failed = 0;

function safePath(url) {
  // Hash the URL so two different files with the same basename never
  // collide, then preserve a readable basename suffix for debuggability.
  const hash = createHash("sha1").update(url).digest("hex").slice(0, 12);
  const raw = decodeURIComponent(basename(new URL(url).pathname));
  const safe = raw.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 60);
  return `${STORAGE_PREFIX}/${hash}-${safe}`;
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
    const txt = await r.text();
    throw new Error(`Storage upload ${r.status}: ${txt}`);
  }
  return `${supabaseUrl}/storage/v1/object/public/${BUCKET}/${path}`;
}

for (const oldUrl of allUrls) {
  if (map[oldUrl]) {
    skipped++;
    continue;
  }
  try {
    const r = await fetch(oldUrl);
    if (!r.ok) throw new Error(`download ${r.status}`);
    const buf = Buffer.from(await r.arrayBuffer());
    const contentType = r.headers.get("content-type") ?? "image/png";
    const path = safePath(oldUrl);
    const newUrl = await uploadToSupabase(path, buf, contentType);
    map[oldUrl] = newUrl;
    migrated++;
    writeFileSync(MAP_PATH, JSON.stringify(map, null, 2));
    if (migrated % 5 === 0) console.log(`  +${migrated} migrated`);
  } catch (e) {
    failed++;
    console.log(`  ! ${oldUrl.slice(0, 80)}…: ${e.message}`);
  }
}
console.log(`\nMigration phase done. New: ${migrated}. Already-migrated (skipped): ${skipped}. Failed: ${failed}.`);

// --- 4. Rewrite source files ---------------------------------

let filesChanged = 0;
let urlSwapsInSource = 0;
for (const [file, urls] of fileUrls) {
  let text = readFileSync(file, "utf-8");
  let changed = false;
  for (const u of urls) {
    if (!map[u]) continue;
    if (text.includes(u)) {
      text = text.split(u).join(map[u]);
      urlSwapsInSource++;
      changed = true;
    }
  }
  if (changed) {
    writeFileSync(file, text);
    filesChanged++;
  }
}
console.log(`Source rewrite: ${urlSwapsInSource} URL swaps across ${filesChanged} files.`);

// --- 5. Rewrite DB rows --------------------------------------

let dbRowsUpdated = 0;
for (const row of dbRows) {
  const updates = [];
  if (row.avatar_url && map[row.avatar_url]) {
    updates.push(`avatar_url = '${map[row.avatar_url].replace(/'/g, "''")}'`);
  }
  if (row.custom_app_hero_url && map[row.custom_app_hero_url]) {
    updates.push(`custom_app_hero_url = '${map[row.custom_app_hero_url].replace(/'/g, "''")}'`);
  }
  if (updates.length === 0) continue;
  await query(`UPDATE hammerex_trade_off_listings SET ${updates.join(", ")} WHERE id = '${row.id}';`);
  dbRowsUpdated++;
}
console.log(`DB rewrite: ${dbRowsUpdated} listings updated.`);

// --- 6. Verify ------------------------------------------------

let remainingInSource = 0;
for (const f of sourceFiles) {
  const t = readFileSync(f, "utf-8");
  const m = t.match(IK_RE);
  if (m) remainingInSource += m.length;
}
const remainingInDb = await query(`
  SELECT count(*)::int AS c FROM hammerex_trade_off_listings
   WHERE avatar_url LIKE '%ik.imagekit.io%' OR custom_app_hero_url LIKE '%ik.imagekit.io%';
`);
console.log(`\nVerification:`);
console.log(`  ImageKit URLs left in src/: ${remainingInSource}`);
console.log(`  ImageKit URLs left in DB:   ${remainingInDb[0].c}`);
if (remainingInSource === 0 && remainingInDb[0].c === 0) {
  console.log(`\n✓ ZERO ImageKit URLs remain. Migration complete.`);
} else {
  console.log(`\n! Some URLs survived — re-run to migrate the stragglers.`);
}
