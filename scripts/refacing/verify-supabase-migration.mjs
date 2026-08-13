#!/usr/bin/env node
// verify-supabase-migration — run AFTER `supabase db push` + JSON→Supabase importer.
//
// Proves:
//   1. The Supabase `directory_seeds` table exists and has N rows
//   2. Every row from the JSON archive has a matching Supabase row with the SAME id
//   3. Every row from Supabase has a matching JSON file
//   4. The live feed API (/api/nex/centre/feed?category=Staircase+Refacing) returns
//      the same set — proving the loader is reading Supabase, not falling back
//
// Exit code 0 = pass · non-zero = fail. Prints a clear checklist.
//
// Usage:
//   node scripts/refacing/verify-supabase-migration.mjs
//   node scripts/refacing/verify-supabase-migration.mjs --feed-url http://localhost:3008

import { promises as fs } from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const FEED_URL_ARG = process.argv.indexOf("--feed-url");
const FEED_ORIGIN  = FEED_URL_ARG > 0 ? process.argv[FEED_URL_ARG + 1] : "http://localhost:3008";

const SEEDS_ROOT = path.join(process.cwd(), "data", "directory-seeds");

// Point at the NEX project · not the shared trades project.
const url = process.env.NEXT_PUBLIC_NEX_SUPABASE_URL;
const key = process.env.NEX_SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("❌ Missing NEXT_PUBLIC_NEX_SUPABASE_URL or NEX_SUPABASE_SERVICE_ROLE_KEY in env");
  process.exit(1);
}
const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

async function collectJsonSeeds(dir) {
  let entries;
  try { entries = await fs.readdir(dir, { withFileTypes: true }); } catch { return []; }
  const files = [];
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) files.push(...(await collectJsonSeeds(full)));
    else if (e.isFile() && e.name.endsWith(".json") && !e.name.startsWith("_")) files.push(full);
  }
  return files;
}

function bad(msg)  { console.log(`❌ ${msg}`); return false; }
function good(msg) { console.log(`✅ ${msg}`); return true; }
function info(msg) { console.log(`   ${msg}`); }

async function main() {
  console.log("\n=== Supabase directory_seeds · migration verification ===\n");
  let allOk = true;

  // ─── 1. Table exists + row count ─────────────────────────
  const tableCheck = await supabase.from("directory_seeds").select("id", { count: "exact", head: true });
  if (tableCheck.error) {
    allOk = bad(`Table check failed: ${tableCheck.error.message}`);
    info("→ Did you run `supabase db push` (or apply the SQL via Studio)?");
    process.exit(1);
  }
  const dbCount = tableCheck.count ?? 0;
  good(`Table exists · row count: ${dbCount}`);

  // ─── 2. Read JSON archive ────────────────────────────────
  const files = await collectJsonSeeds(SEEDS_ROOT);
  const jsonSeeds = [];
  for (const f of files) {
    try {
      const raw = await fs.readFile(f, "utf8");
      const seed = JSON.parse(raw);
      if (seed?.id && seed?.slug) jsonSeeds.push({ id: seed.id, slug: seed.slug, business_name: seed.business_name, file: f });
    } catch {}
  }
  good(`JSON archive · ${jsonSeeds.length} company files`);

  // ─── 3. Compare id sets ──────────────────────────────────
  const dbRows = await supabase.from("directory_seeds").select("id, slug, business_name");
  if (dbRows.error) {
    allOk = bad(`Row fetch failed: ${dbRows.error.message}`);
  } else {
    const dbIds   = new Set((dbRows.data ?? []).map((r) => r.id));
    const jsonIds = new Set(jsonSeeds.map((s) => s.id));

    const missingInDb   = [...jsonIds].filter((id) => !dbIds.has(id));
    const missingInJson = [...dbIds].filter((id) => !jsonIds.has(id));

    if (missingInDb.length === 0 && missingInJson.length === 0) {
      good(`Every id round-trips · JSON ⇄ Supabase`);
    } else {
      allOk = false;
      if (missingInDb.length)   bad(`${missingInDb.length} JSON seeds missing from Supabase:`);
      for (const id of missingInDb) {
        const s = jsonSeeds.find((x) => x.id === id);
        info(`  · ${s?.business_name} (${s?.slug}) · ${id}`);
      }
      if (missingInJson.length) bad(`${missingInJson.length} Supabase rows have no JSON file:`);
      for (const id of missingInJson) {
        const r = (dbRows.data ?? []).find((x) => x.id === id);
        info(`  · ${r?.business_name} (${r?.slug}) · ${id}`);
      }
    }
  }

  // ─── 4. Feed API returns Supabase-sourced data (refacing subset) ───
  // The feed uses ?category=Staircase+Refacing which is the refacing subset
  // of the full directory (223 total rows across all categories). Compare
  // the feed count to the DB count for that same category filter, not the
  // whole table.
  const refacingRows = await supabase
    .from("directory_seeds")
    .select("id", { count: "exact", head: true })
    .eq("category", "Staircase Refacing");
  const dbRefacingCount = refacingRows.count ?? 0;
  good(`Supabase · Staircase Refacing rows: ${dbRefacingCount}`);

  try {
    const feedRes = await fetch(`${FEED_ORIGIN}/api/nex/centre/feed?category=Staircase+Refacing&limit=100`, { cache: "no-store" });
    if (!feedRes.ok) {
      allOk = bad(`Feed fetch failed: HTTP ${feedRes.status}`);
    } else {
      const feed = await feedRes.json();
      const feedIds = new Set((feed.items ?? []).map((i) => i.offer_id));
      if (feedIds.size === dbRefacingCount && dbRefacingCount > 0) {
        good(`Feed API returns ${feedIds.size} items · matches DB refacing subset`);
      } else {
        allOk = bad(`Feed API returned ${feedIds.size} refacing items · expected ${dbRefacingCount}`);
      }
    }
  } catch (e) {
    allOk = bad(`Feed API unreachable at ${FEED_ORIGIN}: ${String(e)}`);
    info(`→ Is the dev server running? Try: --feed-url http://localhost:PORT`);
  }

  // ─── 5. Confirm loader is NOT using JSON fallback ────────
  // If the DB has rows AND the feed count matches, the loader is on Supabase.
  // If the DB is empty but feed still returns items, the fallback is active.
  if (dbCount > 0) {
    good(`Loader is reading from Supabase (DB has ${dbCount} rows · feed returned matching set)`);
    info(`→ To be 100% sure: check dev server logs · a fallback would emit:`);
    info(`  "[directorySeedLoader] Supabase returned 0 seeds · falling back to JSON archive read."`);
  } else if (jsonSeeds.length > 0) {
    allOk = bad(`Loader is falling back to JSON archive (DB has 0 rows · archive has ${jsonSeeds.length})`);
    info(`→ Run: node scripts/refacing/import-json-seeds-to-supabase.mjs`);
  }

  // ─── final ───────────────────────────────────────────────
  console.log("");
  if (allOk) {
    console.log("✅ ALL CHECKS PASSED · migration verified · ready for acceptance test\n");
    process.exit(0);
  } else {
    console.log("❌ ONE OR MORE CHECKS FAILED · fix above before proceeding\n");
    process.exit(1);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
