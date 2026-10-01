// scripts/upload-joker-stickers.mjs
//
// Seed the Joker (theme-0) sticker set from source PNGs in
// C:/Users/Victus/Pictures/j1.png..j9.png. Uploads each file to the
// nex-theme-sticker bucket under theme-0/joker-sticker-01.png..
// joker-sticker-09.png and upserts a row into nex_theme_sticker with
// sticker_type='static' and the measured aspect ratio.
//
// Pinned to the canonical NEX Supabase project
// (NEXT_PUBLIC_NEX_SUPABASE_URL · ij...). Metadata is stripped and
// files are re-encoded as PNG to guarantee a clean container · the
// original scene art + text labels are preserved exactly (no crop,
// no padding, no square-ification).

import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

function loadEnv() {
  const raw = fs.readFileSync(path.join(ROOT, ".env.local"), "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const m = /^([A-Z0-9_]+)=(.*)$/.exec(line);
    if (m) process.env[m[1]] ??= m[2];
  }
}
loadEnv();

const URL = process.env.NEXT_PUBLIC_NEX_SUPABASE_URL;
const KEY = process.env.NEX_SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !KEY) {
  throw new Error(
    "Missing NEX Supabase env (NEXT_PUBLIC_NEX_SUPABASE_URL / NEX_SUPABASE_SERVICE_ROLE_KEY)",
  );
}

const BUCKET = "nex-theme-sticker";
const THEME_ID = "theme-0";
const SRC_DIR = "C:/Users/Victus/Pictures";
const START = 1;
const END = 9;

const sb = createClient(URL, KEY, { auth: { persistSession: false } });

async function uploadOne(i) {
  const slug = `joker-sticker-${String(i).padStart(2, "0")}`;
  const src = path.join(SRC_DIR, `j${i}.png`);
  if (!fs.existsSync(src)) return { i, slug, ok: false, err: "source missing" };

  // Preserve the sticker artwork exactly · just strip metadata and
  // re-encode via sharp to guarantee a clean PNG container.
  const bytes = fs.readFileSync(src);
  const png = await sharp(bytes).png({ compressionLevel: 9 }).toBuffer();
  const meta = await sharp(png).metadata();
  const aspect =
    meta.width && meta.height
      ? Number((meta.width / meta.height).toFixed(4))
      : 1;

  const remote = `${THEME_ID}/${slug}.png`;
  const putRes = await fetch(
    `${URL}/storage/v1/object/${BUCKET}/${remote}?upsert=true`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${KEY}`,
        apikey: KEY,
        "Content-Type": "image/png",
        "cache-control": "public, max-age=3600, must-revalidate",
        "x-upsert": "true",
      },
      body: png,
    },
  );
  if (!putRes.ok) {
    return {
      i,
      slug,
      ok: false,
      err: `storage ${putRes.status} ${await putRes.text()}`,
    };
  }

  const image_url = `${URL}/storage/v1/object/public/${BUCKET}/${remote}`;

  const row = {
    theme_id: THEME_ID,
    slug,
    image_url,
    label: "",
    sort_order: i,
    sticker_type: "static",
    aspect_ratio: aspect,
  };
  const { error } = await sb
    .from("nex_theme_sticker")
    .upsert(row, { onConflict: "theme_id,slug" });
  if (error) return { i, slug, ok: false, err: `db ${error.message}` };

  return {
    i,
    slug,
    ok: true,
    w: meta.width,
    h: meta.height,
    aspect,
    bytes: png.length,
  };
}

async function main() {
  console.log(
    `Uploading joker-sticker-${String(START).padStart(2, "0")}..joker-sticker-${String(END).padStart(2, "0")} to ${BUCKET}/${THEME_ID}/`,
  );
  const results = [];
  for (let i = START; i <= END; i++) {
    const r = await uploadOne(i);
    results.push(r);
    if (r.ok) {
      console.log(
        `  OK  ${r.slug}  ${r.w}x${r.h}  aspect=${r.aspect}  ${(r.bytes / 1024).toFixed(1)}KB  sort=${r.i}`,
      );
    } else {
      console.error(`  FAIL ${r.slug}  ${r.err}`);
    }
  }
  const okCount = results.filter((r) => r.ok).length;
  console.log(`\nDone. ${okCount}/${results.length} uploaded.`);

  const { data: rows, error } = await sb
    .from("nex_theme_sticker")
    .select("slug, sort_order, aspect_ratio, sticker_type")
    .eq("theme_id", THEME_ID)
    .order("sort_order");
  if (!error) {
    console.log(`\nnex_theme_sticker rows for ${THEME_ID} (${rows.length}):`);
    for (const r of rows)
      console.log(
        `  ${String(r.sort_order).padStart(3)}  ${r.slug}  aspect=${r.aspect_ratio}  type=${r.sticker_type}`,
      );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
