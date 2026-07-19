// backfill-image-dims — probes every image URL in
// hammerex_feed_tile_library for natural width x height (via sharp)
// and writes the result to width_px + height_px columns.
//
// Zero layout shift on the inspiration + store grids depends on
// this data — the <img> gets width/height attributes so browser
// reserves the aspect-ratio box before bytes arrive.
//
// Run: `node scripts/backfill-image-dims.mjs`
// Safe to re-run — only touches rows where width_px IS NULL.

import fs from "node:fs";
import sharp from "sharp";

// Parse .env.tools.local manually.
const env = {};
try {
  const raw = fs.readFileSync(new URL("../.env.tools.local", import.meta.url), "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m) env[m[1]] = m[2].replace(/^"|"$/g, "");
  }
} catch (err) {
  console.error("[backfill] .env.tools.local not readable:", err);
  process.exit(1);
}

const TOKEN = env.SUPABASE_ACCESS_TOKEN;
const REF   = env.SUPABASE_PROJECT_REF;
if (!TOKEN || !REF) {
  console.error("[backfill] SUPABASE_ACCESS_TOKEN / SUPABASE_PROJECT_REF missing");
  process.exit(1);
}
const API = `https://api.supabase.com/v1/projects/${REF}/database/query`;

async function sql(query) {
  const res = await fetch(API, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ query })
  });
  const body = await res.text();
  if (!res.ok) throw new Error(`SQL ${res.status}: ${body}`);
  try { return JSON.parse(body); } catch { return body; }
}

async function probeImage(url) {
  // Fetch bytes (small — modern JPGs ≤ ~500KB, PNGs a few MB max).
  // Timeout 30s per image.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30_000);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    const meta = await sharp(buf).metadata();
    if (!meta.width || !meta.height) throw new Error("no dimensions");
    return { width: meta.width, height: meta.height };
  } finally {
    clearTimeout(timer);
  }
}

async function main() {
  console.log("[backfill] fetching rows needing dimensions…");
  const rows = await sql(`
    SELECT slug, url FROM hammerex_feed_tile_library
    WHERE active = true AND width_px IS NULL
    ORDER BY slug
    LIMIT 500;
  `);
  console.log(`[backfill] ${rows.length} rows to probe`);

  const CONCURRENCY = 6;
  let done = 0;
  let failed = 0;

  async function worker(row) {
    try {
      const dims = await probeImage(row.url);
      // Escape slug — should be safe (kebab-case) but belt-and-braces
      const escSlug = row.slug.replace(/'/g, "''");
      await sql(`
        UPDATE hammerex_feed_tile_library
        SET width_px = ${dims.width}, height_px = ${dims.height}
        WHERE slug = '${escSlug}';
      `);
      done++;
      if (done % 10 === 0) console.log(`[backfill] ${done}/${rows.length} done (${failed} failed)`);
    } catch (err) {
      failed++;
      console.warn(`[backfill] ${row.slug} FAILED:`, err.message);
    }
  }

  // Process in batches of CONCURRENCY parallel probes.
  for (let i = 0; i < rows.length; i += CONCURRENCY) {
    const batch = rows.slice(i, i + CONCURRENCY);
    await Promise.all(batch.map(worker));
  }

  console.log(`[backfill] DONE. ${done}/${rows.length} succeeded, ${failed} failed.`);
}

async function backfillHeroLibraryJson() {
  const jsonPath = new URL("../scripts/hero-library.json", import.meta.url);
  const raw = fs.readFileSync(jsonPath, "utf8");
  const data = JSON.parse(raw);
  if (!Array.isArray(data.entries)) {
    console.log("[backfill/json] no entries[] — skipping");
    return;
  }
  const missing = data.entries.filter((e) => !e.width_px || !e.height_px);
  console.log(`[backfill/json] ${missing.length}/${data.entries.length} JSON entries need dimensions`);
  if (missing.length === 0) return;

  const CONCURRENCY = 6;
  let done = 0, failed = 0;
  async function worker(entry) {
    try {
      const dims = await probeImage(entry.image_url);
      entry.width_px  = dims.width;
      entry.height_px = dims.height;
      done++;
      if (done % 10 === 0) console.log(`[backfill/json] ${done}/${missing.length} (${failed} failed)`);
    } catch (err) {
      failed++;
      console.warn(`[backfill/json] ${entry.id} FAILED:`, err.message);
    }
  }
  for (let i = 0; i < missing.length; i += CONCURRENCY) {
    const batch = missing.slice(i, i + CONCURRENCY);
    await Promise.all(batch.map(worker));
  }
  fs.writeFileSync(jsonPath, JSON.stringify(data, null, 2) + "\n");
  console.log(`[backfill/json] DONE. ${done}/${missing.length} succeeded, ${failed} failed. File written.`);
}

main()
  .then(backfillHeroLibraryJson)
  .catch((err) => {
    console.error("[backfill] fatal:", err);
    process.exit(1);
  });
