// scripts/upload-joker-emoji.mjs
//
// Upload joker3..joker25 PNGs from Downloads/ into the nex-theme-emoji
// bucket under theme-0/joker-NN.png (zero-padded), then upsert rows in
// nex_theme_emoji for theme_id='theme-0'. Pinned to the canonical NEX
// Supabase project (NEXT_PUBLIC_NEX_SUPABASE_URL · ij...).
//
// Idempotent: bucket upload uses upsert; row insert uses upsert on
// (theme_id, slug) via onConflict.

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
if (!URL || !KEY) throw new Error("Missing NEX Supabase env (NEXT_PUBLIC_NEX_SUPABASE_URL / NEX_SUPABASE_SERVICE_ROLE_KEY)");

const BUCKET = "nex-theme-emoji";
const THEME_ID = "theme-0";
const SRC_DIR = "C:/Users/Victus/Downloads";
const START = 3;
const END = 25;

const sb = createClient(URL, KEY, { auth: { persistSession: false } });

async function uploadOne(i) {
  const slug = `joker-${String(i).padStart(2, "0")}`;
  const src = path.join(SRC_DIR, `joker${i}-removebg-preview.png`);
  if (!fs.existsSync(src)) return { i, slug, ok: false, err: "source missing" };

  // 1. Trim fully-transparent border (removebg leaves big empty halos).
  // 2. Centre on a square canvas with ~6% breathing room so the subject
  //    fills the picker tile without touching the neighbours.
  const bytes = fs.readFileSync(src);
  const trimmed = await sharp(bytes)
    .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 }, threshold: 10 })
    .png()
    .toBuffer();
  const tm = await sharp(trimmed).metadata();
  const subject = Math.max(tm.width ?? 1, tm.height ?? 1);
  const canvas = Math.round(subject * 1.12); // 6% padding each side
  const png = await sharp({
    create: {
      width: canvas,
      height: canvas,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: trimmed, gravity: "centre" }])
    .png({ compressionLevel: 9 })
    .toBuffer();
  const meta = await sharp(png).metadata();

  const remote = `${THEME_ID}/${slug}.png`;
  const putRes = await fetch(`${URL}/storage/v1/object/${BUCKET}/${remote}?upsert=true`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${KEY}`,
      apikey: KEY,
      "Content-Type": "image/png",
      "cache-control": "public, max-age=3600, must-revalidate",
      "x-upsert": "true",
    },
    body: png,
  });
  if (!putRes.ok) {
    return { i, slug, ok: false, err: `storage ${putRes.status} ${await putRes.text()}` };
  }

  // Append a version query so browsers refetch the resized bytes even
  // though the object path is unchanged.
  const image_url = `${URL}/storage/v1/object/public/${BUCKET}/${remote}?v=2`;

  const row = {
    theme_id: THEME_ID,
    slug,
    image_url,
    label: "",
    sort_order: i,
  };
  const { error } = await sb
    .from("nex_theme_emoji")
    .upsert(row, { onConflict: "theme_id,slug" });
  if (error) return { i, slug, ok: false, err: `db ${error.message}` };

  return { i, slug, ok: true, w: meta.width, h: meta.height, bytes: png.length };
}

async function main() {
  console.log(`Uploading joker-${String(START).padStart(2, "0")}..joker-${String(END).padStart(2, "0")} to ${BUCKET}/${THEME_ID}/`);
  const results = [];
  for (let i = START; i <= END; i++) {
    const r = await uploadOne(i);
    results.push(r);
    if (r.ok) {
      console.log(`  OK  ${r.slug}  ${r.w}x${r.h}  ${(r.bytes / 1024).toFixed(1)}KB  sort=${r.i}`);
    } else {
      console.error(`  FAIL ${r.slug}  ${r.err}`);
    }
  }
  const okCount = results.filter((r) => r.ok).length;
  console.log(`\nDone. ${okCount}/${results.length} uploaded.`);

  const { data: rows, error } = await sb
    .from("nex_theme_emoji")
    .select("slug,sort_order")
    .eq("theme_id", THEME_ID)
    .order("sort_order");
  if (!error) {
    console.log(`\nnex_theme_emoji rows for ${THEME_ID} (${rows.length}):`);
    for (const r of rows) console.log(`  ${String(r.sort_order).padStart(3)}  ${r.slug}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
