// scripts/backfill-frame-fits.ts
//
// Probes every image in hammerex_feed_tile_library, reads its real
// pixel dimensions (sharp fetches + decodes the header only — no full
// decode), computes natural_aspect + fits_frames per src/lib/siteEditor/
// frames.computeFitsFrames, and writes the two columns back.
//
// Runs in batches of 20 concurrent, resumable — safe to re-run at any
// time. Skips rows that already have natural_aspect set unless --force.
//
// Usage:
//   npx tsx scripts/backfill-frame-fits.ts
//   npx tsx scripts/backfill-frame-fits.ts --force
//   npx tsx scripts/backfill-frame-fits.ts --limit 50

import sharp from "sharp";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { computeFitsFrames } from "../src/lib/siteEditor/frames";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

// Load .env.local without dotenv dep — simple parse.
function loadEnv() {
  const raw = fs.readFileSync(path.join(ROOT, ".env.local"), "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const m = /^([A-Z0-9_]+)=(.*)$/.exec(line);
    if (m) process.env[m[1]] ??= m[2];
  }
}
loadEnv();

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !KEY) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");

const sb = createClient(URL, KEY, { auth: { persistSession: false } });

const args = new Set(process.argv.slice(2));
const FORCE = args.has("--force");
const LIMIT = Number(process.argv.find((a) => a.startsWith("--limit="))?.split("=")[1] ?? "0") || null;
const CONC  = 20;

async function probe(url: string): Promise<{ w: number; h: number } | null> {
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    // Read only enough bytes to decode the header (sharp handles this
    // gracefully with a full buffer — small images are ~30KB anyway).
    const buf = Buffer.from(await res.arrayBuffer());
    const meta = await sharp(buf).metadata();
    if (!meta.width || !meta.height) return null;
    return { w: meta.width, h: meta.height };
  } catch {
    return null;
  }
}

async function main() {
  let q = sb.from("hammerex_feed_tile_library")
    .select("slug, url, natural_aspect")
    .eq("active", true);
  if (!FORCE) q = q.is("natural_aspect", null);
  if (LIMIT)   q = q.limit(LIMIT);
  const rows = await q;
  if (rows.error) throw rows.error;
  const list = rows.data ?? [];
  console.log(`probing ${list.length} rows (force=${FORCE})`);

  let done = 0, failed = 0, skipped = 0, empty = 0;
  for (let i = 0; i < list.length; i += CONC) {
    const chunk = list.slice(i, i + CONC);
    await Promise.all(chunk.map(async (row) => {
      const dims = await probe(row.url as string);
      if (!dims) { failed++; return; }
      const aspect = dims.w / dims.h;
      const fits   = computeFitsFrames(aspect);
      if (fits.length === 0) empty++;
      const upd = await sb.from("hammerex_feed_tile_library")
        .update({ natural_aspect: aspect, fits_frames: fits })
        .eq("slug", row.slug as string);
      if (upd.error) { skipped++; console.error(`update fail ${row.slug}: ${upd.error.message}`); return; }
      done++;
    }));
    process.stdout.write(`\r  ${i + chunk.length} / ${list.length}  ok=${done} fail=${failed} empty-fits=${empty}`);
  }
  console.log(`\ndone — ${done} updated · ${failed} failed · ${empty} with empty fits_frames (excluded from gallery)`);
}

main().catch((e) => { console.error(e); process.exit(1); });
