#!/usr/bin/env node
// scripts/nex-workforce/enrich-directory-images.mjs
//
// NEX Directory Image Walker · Philip 2026-08-28.
//
// Fetches high-quality, category-matched, Indonesia-focused, CC-licensed
// images from Wikimedia Commons and assigns them to directory cards that
// have no image yet. Owner-uploaded images are NEVER overwritten.
//
// Constitutional anchors:
//   · project_nex_cc_category_placeholder_imagery_2026_08_28.md
//     (ADR-0022 amendment · CC category placeholder allowed · owner wins)
//   · project_nex_free_infrastructure_principle_2026_08_27.md
//     (no paid image APIs · Wikimedia Commons only)
//   · ADR-0025 (tiered thresholds · directory floor = 0.65 · category match required)
//   · ADR-0027 Rule #11 (image_type · image_purpose · can_become — walker fills
//     placeholder tier which is superseded by owner upload)
//   · ADR-0030 (never fabricate · leave null when no confident match)
//
// Usage:
//   node scripts/nex-workforce/enrich-directory-images.mjs \
//     --table=nex.food_business --category=restaurant --city=Jakarta --limit=20
//
//   node scripts/nex-workforce/enrich-directory-images.mjs \
//     --table=nex.accommodation_business --category=hotel --city=Denpasar --dry
//
// Flags:
//   --table=<nex.food_business | nex.accommodation_business>  (required)
//   --category=<slug from that table>                          (required)
//   --city=<city name>                                         (required)
//   --limit=<max rows to assign this cycle>                    (default 20)
//   --dry                                                       (log-only)
//
// Owner-protection contract:
//   Walker WHERE clause: hero_image_url IS NULL AND (hero_image_approved IS NOT TRUE)
//   Any owner upload MUST set hero_image_approved = true so this walker skips it.

import pg from "pg";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve as pathResolve } from "node:path";
import { acquireProviderLease, releaseProviderLease } from "../nex-acquisition/sources/_provider-lease-helper.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CURATED_MANIFEST_PATH = pathResolve(__dirname, "..", "..", "data", "nex-curated-images-manifest.json");

// Load Philip's owner-supplied curated pool once at cycle start · preferred
// over Commons for any category listed in `categories_suitable_for`.
function loadCuratedPool(categorySlug) {
  if (!existsSync(CURATED_MANIFEST_PATH)) return [];
  try {
    const raw = JSON.parse(readFileSync(CURATED_MANIFEST_PATH, "utf8"));
    const all = Array.isArray(raw.images) ? raw.images : [];
    return all
      .filter((img) => Array.isArray(img.categories_suitable_for)
                    && img.categories_suitable_for.includes(categorySlug))
      .map((img) => ({
        title:       img.id,
        url:         img.source_url,
        full_url:    img.source_url,
        width:       1200,
        height:      1200,
        licence:     "Owner-uploaded · NEX first-party asset",
        attribution: "Philip · NEX curated",
        licence_url: null,
        source_page: img.source_url,
        category_matched: `curated:${img.id}`,
      }));
  } catch { return []; }
}

// ── args ───────────────────────────────────────────────────────────────
const args = new Map();
for (const a of process.argv.slice(2)) {
  const [k, v] = a.split("=");
  args.set(k.replace(/^--/, ""), v ?? true);
}
const TABLE    = String(args.get("table")    ?? "");
const CATEGORY = String(args.get("category") ?? "");
const CITY     = String(args.get("city")     ?? "");
const LIMIT    = Number(args.get("limit")    ?? 20);
const DRY      = args.has("dry");

if (!TABLE || !CATEGORY || !CITY) {
  console.error("usage: --table=<nex.food_business|nex.accommodation_business> --category=<slug> --city=<name> [--limit=N] [--dry]");
  process.exit(2);
}
if (!/^nex\.(food_business|accommodation_business)$/.test(TABLE)) {
  console.error(`table not allowed: ${TABLE}`);
  process.exit(2);
}

const USER_AGENT = "NEX-Directory-Image-Walker/1.0 (+https://nex.example · CC-attribution-respected)";
const MIN_WIDTH  = 800;                    // premium quality floor · doctrine
const CANDIDATE_FETCH_LIMIT = 50;          // pull up to 50 from Commons per cycle
const WORKER_ID   = `images:${TABLE.replace("nex.", "")}:${CATEGORY}:${CITY}`;
const WORKER_TYPE = `images:${TABLE.replace("nex.", "")}`;

const pool = new pg.Pool({
  connectionString:
    process.env.NEX_POSTGRES_URL ??
    "postgresql://postgres:Admin1phil@localhost:5433/nex_dev",
  max: 3,
});

// ── Commons category mapping ───────────────────────────────────────────
// Category slug + city → ordered list of Commons categories to try.
// Order: most-specific (city+category) → country-level fallback.
// Every category must exist on Commons · no fabricated names.
const COMMONS_CATEGORIES = {
  // Food business
  "restaurant": (city) => [
    `Restaurants in ${city}`,
    `Restaurants in Indonesia`,
    `Food of Indonesia`,
  ],
  "coffee-cafe": (city) => [
    `Coffeehouses in ${city}`,
    `Coffee shops in Indonesia`,
    `Coffee of Indonesia`,
  ],
  "fast-food": (_city) => [
    `Fast food restaurants in Indonesia`,
    `Restaurants in Indonesia`,
  ],
  "ice-cream-dessert": (_city) => [
    `Desserts of Indonesia`,
    `Ice cream of Indonesia`,
    `Sweets of Indonesia`,
  ],
  // Accommodation
  "hotel": (city) => [
    `Hotels in ${city}`,
    `Hotels in Indonesia`,
  ],
  "villa": (city) => [
    `Villas in ${city}`,
    `Villas in Indonesia`,
    `Resorts in Indonesia`,
  ],
  "guesthouse": (city) => [
    `Guesthouses in ${city}`,
    `Guesthouses in Indonesia`,
    `Hotels in Indonesia`,
  ],
  "homestay": (city) => [
    `Guesthouses in ${city}`,
    `Guesthouses in Indonesia`,
    `Hotels in Indonesia`,
  ],
  "hostel": (_city) => [
    `Hostels in Indonesia`,
    `Guesthouses in Indonesia`,
  ],
  "kos": (_city) => [
    `Guesthouses in Indonesia`,
    `Boarding houses in Indonesia`,
  ],
  "apartment": (city) => [
    `Apartments in ${city}`,
    `Apartments in Indonesia`,
    `Residential buildings in Indonesia`,
  ],
};

function commonsCategoriesFor(category, city) {
  const fn = COMMONS_CATEGORIES[category];
  if (!fn) return [`Buildings in Indonesia`]; // last-resort · won't match well, guarded by MIN_WIDTH + already-used dedupe
  return fn(city);
}

// ── Commons fetch ──────────────────────────────────────────────────────
async function fetchCommonsCategory(categoryName) {
  const url = new URL("https://commons.wikimedia.org/w/api.php");
  url.search = new URLSearchParams({
    action: "query",
    generator: "categorymembers",
    gcmtitle: `Category:${categoryName}`,
    gcmtype: "file",
    gcmlimit: String(CANDIDATE_FETCH_LIMIT),
    prop: "imageinfo",
    iiprop: "url|size|extmetadata|mime",
    iiurlwidth: "1200",
    format: "json",
    formatversion: "2",
  });

  const resp = await fetch(url.toString(), {
    headers: { "User-Agent": USER_AGENT },
  });
  if (!resp.ok) throw new Error(`Commons ${categoryName}: HTTP ${resp.status}`);
  const data = await resp.json();
  const pages = data?.query?.pages;
  if (!Array.isArray(pages)) return [];

  const files = [];
  for (const p of pages) {
    const ii = p.imageinfo?.[0];
    if (!ii) continue;
    if (!ii.mime?.startsWith("image/")) continue;                 // no PDFs/videos
    if (!ii.width || ii.width < MIN_WIDTH) continue;              // premium floor
    const licence = String(ii.extmetadata?.LicenseShortName?.value ?? "");
    if (!/^(CC|Public|PD)/i.test(licence)) continue;              // CC/PD only
    const artistHtml = String(ii.extmetadata?.Artist?.value ?? "");
    const artist = artistHtml.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim() || "Unknown";
    files.push({
      title:      p.title,
      url:        ii.thumburl ?? ii.url,   // 1200px thumbnail for card rendering
      full_url:   ii.url,                  // original for provenance
      width:      ii.width,
      height:     ii.height,
      licence,
      attribution: artist,
      licence_url: String(ii.extmetadata?.LicenseUrl?.value ?? "") || null,
      source_page: `https://commons.wikimedia.org/wiki/${encodeURIComponent(p.title)}`,
    });
  }
  return files;
}

async function buildCommonsPool(category, city, log) {
  const cats = commonsCategoriesFor(category, city);
  const seen = new Set();
  const pool_ = [];

  // Curated (owner-uploaded) images FIRST · per CC-category-placeholder doctrine
  // (owner supply always wins). These have effectively unlimited "quality" and
  // are known-perfect Indonesia-focused imagery for the category.
  const curated = loadCuratedPool(category);
  if (curated.length > 0) {
    log(`curated pool "${category}" → ${curated.length} owner-supplied images`);
    for (const f of curated) {
      if (seen.has(f.url)) continue;
      seen.add(f.url);
      pool_.push(f);
    }
  }

  for (const cat of cats) {
    let leaseId = null;
    try {
      leaseId = await acquireProviderLease("wikimedia_commons", WORKER_ID);
      const files = await fetchCommonsCategory(cat);
      log(`commons category "${cat}" → ${files.length} eligible files`);
      for (const f of files) {
        if (seen.has(f.url)) continue;
        seen.add(f.url);
        pool_.push({ ...f, category_matched: cat });
      }
    } catch (err) {
      log(`commons category "${cat}" · fetch failed · ${err.message}`);
    } finally {
      if (leaseId) await releaseProviderLease(leaseId);
    }
    if (pool_.length >= CANDIDATE_FETCH_LIMIT) break;
  }
  return pool_;
}

// ── DB helpers ─────────────────────────────────────────────────────────
async function loadRowsMissingImage(client, table, category, city, limit) {
  const { rows } = await client.query(
    `SELECT public_listing_ref
       FROM ${table}
      WHERE category = $1
        AND city = $2
        AND hero_image_url IS NULL
        AND (hero_image_approved IS NOT TRUE)
      ORDER BY updated_at DESC NULLS LAST
      LIMIT $3`,
    [category, city, limit],
  );
  return rows.map((r) => r.public_listing_ref);
}

async function loadUrlsAlreadyAssigned(client, table, category, city) {
  const { rows } = await client.query(
    `SELECT hero_image_url, count(*) AS uses
       FROM ${table}
      WHERE category = $1 AND city = $2
        AND hero_image_url IS NOT NULL
        AND hero_image_source LIKE 'walker:wikimedia_commons%'
      GROUP BY hero_image_url`,
    [category, city],
  );
  const usage = new Map();
  for (const r of rows) usage.set(r.hero_image_url, Number(r.uses));
  return usage;
}

async function assignImage(client, table, publicRef, pick, cycleRunId) {
  const provenance = {
    source_url:     pick.source_page,
    source_page:    pick.source_page,
    licence:        pick.licence,
    licence_url:    pick.licence_url,
    attribution:    pick.attribution,
    full_url:       pick.full_url,
    width:          pick.width,
    height:         pick.height,
    category_matched: pick.category_matched,
    extracted_at:   new Date().toISOString(),
    worker_id:      WORKER_ID,
    cycle_run_id:   cycleRunId,
    walker_family:  "directory-image-walker",
  };
  const sourceLabel = pick.category_matched?.startsWith("curated:")
    ? "walker:curated_owner_asset"
    : "walker:wikimedia_commons";
  await client.query(
    `UPDATE ${table}
        SET hero_image_url        = $1,
            hero_image_source     = $4,
            hero_image_approved   = false,
            hero_image_provenance = $2::jsonb,
            updated_at            = now()
      WHERE public_listing_ref = $3
        AND hero_image_url IS NULL
        AND (hero_image_approved IS NOT TRUE)`,
    [pick.url, JSON.stringify(provenance), publicRef, sourceLabel],
  );
}

// ── cycle attribution ───────────────────────────────────────────────────
async function openCycle() {
  const r = await pool.query(
    `INSERT INTO nex.worker_cycle_run (worker_type, worker_id, worker_config, status, summary)
     VALUES ($1, $2, $3, 'running', jsonb_build_object('table', $4::text, 'category', $5::text, 'city', $6::text, 'limit', $7::int))
     RETURNING id`,
    [WORKER_TYPE, WORKER_ID, `${TABLE}:${CATEGORY}:${CITY}`, TABLE, CATEGORY, CITY, LIMIT],
  );
  return r.rows[0].id;
}
async function closeCycle(cycleId, status, summary) {
  await pool.query(
    `UPDATE nex.worker_cycle_run
        SET status = $2, finished_at = now(),
            records_processed = $4, records_new = $5, records_rejected = $6,
            summary = COALESCE(summary, '{}'::jsonb) || $3::jsonb
      WHERE id = $1`,
    [
      cycleId, status, JSON.stringify(summary),
      Number.isFinite(summary.records_processed) ? summary.records_processed : 0,
      Number.isFinite(summary.records_new) ? summary.records_new : 0,
      Number.isFinite(summary.records_rejected) ? summary.records_rejected : 0,
    ],
  );
}

// ── main ────────────────────────────────────────────────────────────────
async function main() {
  console.log(`▶ image walker · table=${TABLE} · category=${CATEGORY} · city=${CITY} · limit=${LIMIT} · dry=${DRY}`);
  const cycleId = await openCycle();

  let assigned = 0, skipped_no_pool = 0, processed = 0;
  let cycleStatus = "completed";
  const client = await pool.connect();

  try {
    const rows = await loadRowsMissingImage(client, TABLE, CATEGORY, CITY, LIMIT);
    console.log(`rows missing image: ${rows.length}`);
    if (rows.length === 0) {
      // no work · early return with clean summary
      return;
    }

    const commonsPool = await buildCommonsPool(CATEGORY, CITY, (m) => console.log(`  ${m}`));
    console.log(`commons pool: ${commonsPool.length} unique images`);
    if (commonsPool.length === 0) {
      skipped_no_pool = rows.length;
      return;
    }

    // In-memory usage counter · seeded from existing DB assignments so
    // anti-duplicate rotation persists across cycles per (category, city).
    const usage = await loadUrlsAlreadyAssigned(client, TABLE, CATEGORY, CITY);
    for (const f of commonsPool) if (!usage.has(f.url)) usage.set(f.url, 0);

    for (const publicRef of rows) {
      processed += 1;
      // Pick the least-used image from pool · deterministic tiebreak on url hash.
      const pick = [...commonsPool].sort((a, b) => {
        const ua = usage.get(a.url) ?? 0;
        const ub = usage.get(b.url) ?? 0;
        if (ua !== ub) return ua - ub;
        return a.url.localeCompare(b.url);
      })[0];
      if (!pick) { skipped_no_pool += 1; continue; }

      if (DRY) {
        console.log(`  DRY · ${publicRef} ← ${pick.title} · ${pick.width}x${pick.height} · ${pick.licence}`);
      } else {
        await assignImage(client, TABLE, publicRef, pick, cycleId);
        console.log(`  ok · ${publicRef} ← ${pick.title.slice(0, 60)}`);
      }
      usage.set(pick.url, (usage.get(pick.url) ?? 0) + 1);
      assigned += 1;
    }
  } catch (err) {
    cycleStatus = "failed";
    console.error(`fatal · ${err.message}`);
    throw err;
  } finally {
    client.release();
    let cycleOutcome;
    if (cycleStatus === "failed") cycleOutcome = "PROVIDER_ERROR";
    else if (assigned === 0 && processed === 0) cycleOutcome = "NO_NEW_CANDIDATES";
    else if (assigned === 0 && skipped_no_pool > 0) cycleOutcome = "PROVIDER_EMPTY";
    else if (assigned > 0 && skipped_no_pool > 0) cycleOutcome = "PARTIAL";
    else if (assigned > 0) cycleOutcome = "PRODUCTIVE";
    else cycleOutcome = "NO_NEW_CANDIDATES";

    try {
      await closeCycle(cycleId, cycleStatus, {
        cycle_outcome:     cycleOutcome,
        records_processed: processed,
        records_new:       assigned,
        records_rejected:  skipped_no_pool,
        table:             TABLE,
        category:          CATEGORY,
        city:              CITY,
        dry:               DRY,
      });
    } catch (err) {
      console.error(`cycle_run close failed: ${err.message}`);
    }
    console.log(`── cycle ${cycleId} · outcome=${cycleOutcome} · assigned=${assigned} · skipped=${skipped_no_pool} · processed=${processed}`);
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
