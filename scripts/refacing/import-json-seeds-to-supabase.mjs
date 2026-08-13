#!/usr/bin/env node
// One-time migration: import every JSON directory seed under
// data/directory-seeds/**/*.json into the public.directory_seeds Supabase
// table. Preserves the existing UUID + slug + every field. Idempotent —
// safe to re-run · upserts by id.
//
// After a successful run the Collector switches to Supabase writes. The
// JSON files stay in-repo as archive/audit history (per Philip 2026-08-13).
//
// Usage: node scripts/refacing/import-json-seeds-to-supabase.mjs [--dry-run]

import { promises as fs } from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const DRY_RUN = process.argv.includes("--dry-run");
const SEEDS_ROOT = path.join(process.cwd(), "data", "directory-seeds");

// Point at the NEX project (ijvqdvsvwtwxzcqmoqit) · NOT the shared trades project.
const url = process.env.NEXT_PUBLIC_NEX_SUPABASE_URL;
const key = process.env.NEX_SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_NEX_SUPABASE_URL or NEX_SUPABASE_SERVICE_ROLE_KEY in env");
  process.exit(1);
}

const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// Recursively collect every non-underscore-prefixed .json file.
async function collectSeedFiles(dir) {
  let entries;
  try { entries = await fs.readdir(dir, { withFileTypes: true }); }
  catch { return []; }
  const files = [];
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) files.push(...(await collectSeedFiles(full)));
    else if (e.isFile() && e.name.endsWith(".json") && !e.name.startsWith("_")) files.push(full);
  }
  return files;
}

// Derive email_status from legacy fields if the JSON doesn't already have one.
function deriveEmailStatus(seed) {
  if (seed.email_status) return seed.email_status;
  if (!seed.email || !String(seed.email).trim()) return "not_found";
  return seed.email_verified ? "verified" : "needs_manual_verification";
}

// JSON seed → DB row. Never fabricates · missing fields stay null.
function jsonToRow(seed) {
  return {
    id:                     seed.id,
    slug:                   seed.slug,
    business_name:          seed.business_name,
    trading_name:           seed.trading_name ?? null,
    category:               seed.category ?? null,
    primary_trade:          seed.primary_trade ?? null,
    tags:                   Array.isArray(seed.tags) ? seed.tags : [],
    enrichment_status:      seed.enrichment_status ?? "stub",
    last_verified_at:       seed.last_verified_at ?? null,

    address_line_1:         seed.address_line_1 ?? null,
    address_line_2:         seed.address_line_2 ?? null,
    town:                   seed.town ?? null,
    county:                 seed.county ?? null,
    postcode:               seed.postcode ?? null,
    country:                seed.country ?? "United Kingdom",

    telephone:              seed.telephone ?? null,
    website:                seed.website ?? null,
    email:                  seed.email ?? null,

    opening_hours:          seed.opening_hours ?? null,
    description:            seed.description ?? null,
    services:               Array.isArray(seed.services) ? seed.services : [],

    google_rating:          seed.google_rating ?? null,
    google_review_count:    seed.google_review_count ?? null,
    google_maps_url:        seed.google_maps_url ?? null,

    latitude:               seed.latitude ?? null,
    longitude:              seed.longitude ?? null,

    status:                 seed.status ?? "listed",
    claimed:                Boolean(seed.claimed),
    verified:               Boolean(seed.verified),
    visibility:             seed.visibility ?? "public",

    photos:                 Array.isArray(seed.photos) ? seed.photos : [],
    cover_image:            seed.cover_image ?? null,

    source:                 seed.source ?? "refacing_discovery",
    imported_at:            seed.imported_at ?? new Date().toISOString(),

    capabilities:           seed.capabilities ?? {},
    refacing_evidence:      Array.isArray(seed.refacing_evidence) ? seed.refacing_evidence : [],
    refacing_qualification: seed.refacing_qualification ?? null,
    email_source:           seed.email_source ?? null,
    email_verified:         Boolean(seed.email_verified),
    email_checked_at:       seed.email_checked_at ?? null,
    lifecycle_status:       seed.lifecycle_status ?? "unclaimed",
    directory_state:        seed.directory_state ?? "listed",
    email_status:           deriveEmailStatus(seed),
  };
}

async function main() {
  console.log(`[import] scanning ${SEEDS_ROOT}...`);
  const files = await collectSeedFiles(SEEDS_ROOT);
  console.log(`[import] found ${files.length} seed JSON files`);

  const rows = [];
  for (const f of files) {
    try {
      const raw = await fs.readFile(f, "utf8");
      const seed = JSON.parse(raw);
      const row = jsonToRow(seed);
      if (!row.id || !row.slug || !row.business_name) {
        console.warn(`[import] SKIP ${f} — missing required id/slug/business_name`);
        continue;
      }
      rows.push({ file: f, row });
    } catch (e) {
      console.warn(`[import] SKIP ${f} — parse error:`, String(e));
    }
  }
  console.log(`[import] parsed ${rows.length} valid rows`);

  if (DRY_RUN) {
    console.log("[import] dry-run · no writes will happen");
    console.log("[import] sample row:", JSON.stringify(rows[0]?.row, null, 2).slice(0, 800));
    return;
  }

  // Upsert in batches of 100. Preserves id on conflict.
  let upserted = 0;
  let errors = 0;
  const BATCH = 100;
  for (let i = 0; i < rows.length; i += BATCH) {
    const chunk = rows.slice(i, i + BATCH).map((r) => r.row);
    const res = await supabase.from("directory_seeds").upsert(chunk, { onConflict: "id" });
    if (res.error) {
      console.error(`[import] batch ${i}-${i + chunk.length} failed:`, res.error.message);
      errors += chunk.length;
    } else {
      upserted += chunk.length;
      console.log(`[import] upserted ${upserted}/${rows.length}`);
    }
  }

  // Verify: count rows in the table by category
  const count = await supabase.from("directory_seeds").select("*", { count: "exact", head: true });
  console.log(`[import] table row count: ${count.count ?? "?"}`);

  const byCat = await supabase.from("directory_seeds").select("category").limit(10000);
  if (!byCat.error) {
    const cats = {};
    for (const r of byCat.data ?? []) {
      const c = r.category ?? "(none)";
      cats[c] = (cats[c] ?? 0) + 1;
    }
    console.log(`[import] by category:`, cats);
  }

  console.log(`[import] complete · upserted ${upserted} · errors ${errors} · JSON files preserved as archive`);
}

main().catch((e) => { console.error(e); process.exit(1); });
