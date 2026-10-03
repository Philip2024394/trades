// scripts/migrate-haunted-hotel-stickers-to-emoji.mjs
//
// Founder correction 2026-10-03: the 27 bellboy-ghost PNGs we uploaded
// to the sticker system (haunted-hotel-sticker-01..27) are actually
// emojis / mascots. They need to live in nex_theme_emoji with a label
// per tile so the Mascots-tab picker renders them exactly like the
// Joker emoji set (joker-08 "Sad", joker-25 "Evil", etc.).
//
// This script:
//   1. deletes the 27 rows from nex_theme_sticker where theme_id =
//      'haunted-hotel' and removes the matching bucket objects from
//      nex-theme-sticker/haunted-hotel/
//   2. uploads the same 27 source PNGs (strip metadata, re-encode)
//      to nex-theme-emoji/haunted-hotel/haunted-hotel-{NN}.png with
//      upsert semantics
//   3. upserts nex_theme_emoji rows (theme_id, slug, image_url, label,
//      sort_order) · idempotent via (theme_id, slug) UNIQUE
//
// Idempotent: safe to re-run. Prints a short summary at the end.

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

const EMOJI_BUCKET = "nex-theme-emoji";
const STICKER_BUCKET = "nex-theme-sticker";
const THEME_ID = "haunted-hotel";
const SRC_DIR = "C:/Users/Victus/Downloads";

// Labels mirror the Joker emoji pattern. Each entry = { sourceIdx, slug, label }.
// slug is the DB key AND the storage path; label is the picker caption.
const EMOJIS = [
  { i: 1,  label: "Welcoming" },
  { i: 2,  label: "Thumbs Up" },
  { i: 3,  label: "Shocked" },
  { i: 4,  label: "Laughing" },
  { i: 5,  label: "Sad" },
  { i: 6,  label: "Spooky" },
  { i: 7,  label: "Cool" },
  { i: 8,  label: "Wink" },
  { i: 9,  label: "In Love" },
  { i: 10, label: "Grumpy" },
  { i: 11, label: "Lantern" },
  { i: 12, label: "Sleeping" },
  { i: 13, label: "Crying" },
  { i: 14, label: "Scream" },
  { i: 15, label: "Peeking" },
  { i: 16, label: "Shh" },
  { i: 17, label: "Approve" },
  { i: 18, label: "Cheers" },
  { i: 19, label: "Yuck" },
  { i: 20, label: "Thinking" },
  { i: 21, label: "Worried" },
  { i: 22, label: "Smitten" },
  { i: 23, label: "Candle" },
  { i: 24, label: "Hiding" },
  { i: 25, label: "Thumbs Down" },
  { i: 26, label: "Cheeky" },
  { i: 27, label: "Ghost" },
];

function sourceFor(i) {
  if (i === 1) return path.join(SRC_DIR, "t1.png");
  return path.join(SRC_DIR, `t${i}-removebg-preview.png`);
}

function slugFor(i) {
  return `haunted-hotel-${String(i).padStart(2, "0")}`;
}

const sb = createClient(URL, KEY, { auth: { persistSession: false } });

async function tearDownStickerSystem() {
  console.log("── Teardown · remove sticker system rows + bucket objects ──");

  // 1. list sticker rows so we can print what's being removed.
  const { data: stickerRows, error: listErr } = await sb
    .from("nex_theme_sticker")
    .select("slug")
    .eq("theme_id", THEME_ID);
  if (listErr) throw new Error(`list stickers: ${listErr.message}`);
  console.log(
    `  found ${stickerRows?.length ?? 0} nex_theme_sticker rows for ${THEME_ID}`,
  );

  // 2. delete storage objects (safe to run with none existing).
  const bucketPaths = (stickerRows ?? []).map((r) => `${THEME_ID}/${r.slug}.png`);
  if (bucketPaths.length > 0) {
    const { error: objErr } = await sb.storage
      .from(STICKER_BUCKET)
      .remove(bucketPaths);
    if (objErr) {
      console.warn(`  WARN · storage.remove: ${objErr.message}`);
    } else {
      console.log(`  removed ${bucketPaths.length} objects from ${STICKER_BUCKET}`);
    }
  }

  // 3. delete the metadata rows.
  const { error: delErr } = await sb
    .from("nex_theme_sticker")
    .delete()
    .eq("theme_id", THEME_ID);
  if (delErr) throw new Error(`delete sticker rows: ${delErr.message}`);
  console.log(`  deleted nex_theme_sticker rows for ${THEME_ID}`);
}

async function uploadEmoji({ i, label }) {
  const slug = slugFor(i);
  const src = sourceFor(i);
  if (!fs.existsSync(src)) return { i, slug, ok: false, err: `source missing: ${src}` };

  const bytes = fs.readFileSync(src);
  // Emoji bucket caps at 500 KB. Our sources are 50-80 KB so this is
  // comfortably under the limit, but we still re-encode via sharp to
  // strip metadata and guarantee a clean PNG container.
  const png = await sharp(bytes).png({ compressionLevel: 9 }).toBuffer();
  const meta = await sharp(png).metadata();

  const remote = `${THEME_ID}/${slug}.png`;
  const putRes = await fetch(
    `${URL}/storage/v1/object/${EMOJI_BUCKET}/${remote}?upsert=true`,
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

  const image_url = `${URL}/storage/v1/object/public/${EMOJI_BUCKET}/${remote}`;
  const row = {
    theme_id: THEME_ID,
    slug,
    image_url,
    label,
    sort_order: i,
  };
  const { error } = await sb
    .from("nex_theme_emoji")
    .upsert(row, { onConflict: "theme_id,slug" });
  if (error) return { i, slug, ok: false, err: `db ${error.message}` };

  return {
    i,
    slug,
    label,
    ok: true,
    w: meta.width,
    h: meta.height,
    bytes: png.length,
  };
}

async function main() {
  await tearDownStickerSystem();

  console.log(
    `\n── Upload · ${EMOJIS.length} emoji tiles to ${EMOJI_BUCKET}/${THEME_ID}/ ──`,
  );
  const results = [];
  for (const spec of EMOJIS) {
    const r = await uploadEmoji(spec);
    results.push(r);
    if (r.ok) {
      console.log(
        `  OK  ${r.slug.padEnd(22)} "${r.label}"  ${r.w}x${r.h}  ${(r.bytes / 1024).toFixed(1)}KB`,
      );
    } else {
      console.error(`  FAIL ${r.slug}  ${r.err}`);
    }
  }
  const okCount = results.filter((r) => r.ok).length;
  console.log(`\n  ${okCount}/${results.length} uploaded`);

  console.log("\n── Verify · DB state ──");
  const { data: emojiRows } = await sb
    .from("nex_theme_emoji")
    .select("slug, label, sort_order")
    .eq("theme_id", THEME_ID)
    .order("sort_order");
  console.log(`  nex_theme_emoji rows for ${THEME_ID}: ${emojiRows?.length ?? 0}`);

  const { data: stickerRows } = await sb
    .from("nex_theme_sticker")
    .select("slug")
    .eq("theme_id", THEME_ID);
  console.log(`  nex_theme_sticker rows for ${THEME_ID}: ${stickerRows?.length ?? 0}`);

  if (okCount !== EMOJIS.length) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
