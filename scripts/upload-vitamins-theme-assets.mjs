// scripts/upload-vitamins-theme-assets.mjs
//
// NEX Vitamins theme · asset upload + migration applier.
// Founder-authorised 2026-10-04.
//
// Does five things in order:
//   1. Apply migration 137 (nex_chat_theme row for vitamins)
//   2. Upload wallpaper to nex-chat-theme-hero bucket · verify URL
//   3. Upload intro video to nex-theme-intro bucket · verify URL
//   4. UPDATE nex_chat_theme.intro_video_url for the vitamins row
//   5. Verify end-to-end: theme row + wallpaper + intro are all live
//
// Pinned to the canonical NEX Supabase project (ijvqdvsvwtwxzcqmoqit).
// Idempotent: upserts the migration row, upserts storage objects,
// re-UPDATEs the intro URL. Safe to re-run.

import { createClient } from "@supabase/supabase-js";
import crypto from "node:crypto";
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

const SB_URL = process.env.NEXT_PUBLIC_NEX_SUPABASE_URL;
const SB_KEY = process.env.NEX_SUPABASE_SERVICE_ROLE_KEY;
if (!SB_URL || !SB_KEY) throw new Error("Missing NEX Supabase env");

const sb = createClient(SB_URL, SB_KEY, { auth: { persistSession: false } });

const THEME_ID = "vitamins";
const MIGRATION_PATH = path.join(ROOT, "nex-supabase/migrations/137_nex_chat_theme_vitamins.sql");

const WALLPAPER_SRC = "C:/Users/Victus/Pictures/VITAMINS.png";
const WALLPAPER_BUCKET = "nex-chat-theme-hero";
const WALLPAPER_REMOTE = `${THEME_ID}.png`;
const WALLPAPER_URL = `${SB_URL}/storage/v1/object/public/${WALLPAPER_BUCKET}/${WALLPAPER_REMOTE}`;

const INTRO_SRC = "C:/Users/Victus/Downloads/Girl_behind_vitamins_and_fruit_20261004224905.mp4";
const INTRO_BUCKET = "nex-theme-intro";
const INTRO_REMOTE = `${THEME_ID}/intro.mp4`;
const INTRO_URL = `${SB_URL}/storage/v1/object/public/${INTRO_BUCKET}/${INTRO_REMOTE}`;

function sha256(buf) { return crypto.createHash("sha256").update(buf).digest("hex"); }

async function uploadObject(bucket, remote, bytes, contentType, cacheControl) {
  const r = await fetch(
    `${SB_URL}/storage/v1/object/${bucket}/${remote}?upsert=true`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${SB_KEY}`,
        apikey: SB_KEY,
        "Content-Type": contentType,
        "cache-control": cacheControl,
        "x-upsert": "true",
      },
      body: bytes,
    },
  );
  if (!r.ok) throw new Error(`upload ${bucket}/${remote}: ${r.status} ${await r.text()}`);
  return `${SB_URL}/storage/v1/object/public/${bucket}/${remote}`;
}

async function applyMigration() {
  console.log("── Step 1 · apply migration 137 ──");
  const sql = fs.readFileSync(MIGRATION_PATH, "utf8");
  const dbUrlRaw = process.env.DATABASE_URL;
  if (!dbUrlRaw) throw new Error("DATABASE_URL env var required for migration apply");

  const { Client } = await import("pg");
  const client = new Client({ connectionString: dbUrlRaw });
  await client.connect();
  try {
    await client.query(sql);
    console.log(`  migration 137 applied`);
    const r = await client.query(
      "SELECT version, description FROM nex_migration_history WHERE version = $1",
      ["137"],
    );
    console.log(`  ledger: ${r.rows[0]?.description ?? "NOT RECORDED"}`);
    const t = await client.query(
      "SELECT id, name, tier, category, accent_hex, bubble_rim_hex, composer_rim_hex, hero_image_url, layout_style, sort_order, is_active FROM nex_chat_theme WHERE id = $1",
      [THEME_ID],
    );
    if (!t.rows[0]) throw new Error("theme row missing after migration");
    console.log(`  theme row:`, JSON.stringify(t.rows[0], null, 2).split("\n").map((l) => "    " + l).join("\n"));
    return t.rows[0];
  } finally {
    await client.end();
  }
}

async function uploadWallpaper() {
  console.log("\n── Step 2 · upload wallpaper ──");
  if (!fs.existsSync(WALLPAPER_SRC)) throw new Error(`wallpaper source missing: ${WALLPAPER_SRC}`);
  const bytes = fs.readFileSync(WALLPAPER_SRC);
  console.log(`  src: ${WALLPAPER_SRC} (${(bytes.length / 1024 / 1024).toFixed(2)} MB, sha256=${sha256(bytes).slice(0,12)}…)`);
  const url = await uploadObject(WALLPAPER_BUCKET, WALLPAPER_REMOTE, bytes, "image/png", "public, max-age=86400, must-revalidate");
  console.log(`  uploaded → ${url}`);
  const r = await fetch(url + "?__bust=" + Date.now(), { method: "HEAD" });
  console.log(`  HEAD: status=${r.status}  content-type=${r.headers.get("content-type")}  content-length=${r.headers.get("content-length")}`);
  if (!r.ok) throw new Error(`wallpaper HEAD after upload: ${r.status}`);
  return url;
}

async function uploadIntro() {
  console.log("\n── Step 3 · upload intro video ──");
  if (!fs.existsSync(INTRO_SRC)) throw new Error(`intro source missing: ${INTRO_SRC}`);
  const bytes = fs.readFileSync(INTRO_SRC);
  console.log(`  src: ${INTRO_SRC} (${(bytes.length / 1024 / 1024).toFixed(2)} MB, sha256=${sha256(bytes).slice(0,12)}…)`);
  const url = await uploadObject(INTRO_BUCKET, INTRO_REMOTE, bytes, "video/mp4", "public, max-age=86400, must-revalidate");
  console.log(`  uploaded → ${url}`);
  const r = await fetch(url + "?__bust=" + Date.now(), { method: "HEAD" });
  console.log(`  HEAD: status=${r.status}  content-type=${r.headers.get("content-type")}  content-length=${r.headers.get("content-length")}`);
  if (!r.ok) throw new Error(`intro HEAD after upload: ${r.status}`);
  return url;
}

async function setIntroUrl() {
  console.log("\n── Step 4 · UPDATE intro_video_url on theme row ──");
  const { data: before } = await sb
    .from("nex_chat_theme")
    .select("id, name, intro_video_url, intro_duration_ms, intro_poster_url")
    .eq("id", THEME_ID)
    .single();
  const { data: after, error } = await sb
    .from("nex_chat_theme")
    .update({ intro_video_url: INTRO_URL })
    .eq("id", THEME_ID)
    .select("id, name, intro_video_url, intro_duration_ms, intro_poster_url")
    .single();
  if (error) throw new Error(`UPDATE intro_video_url: ${error.message}`);
  console.log(`  before: intro_video_url=${before?.intro_video_url ?? "NULL"}`);
  console.log(`  after : intro_video_url=${after.intro_video_url}`);
  console.log(`  invariants: duration=${after.intro_duration_ms} poster=${after.intro_poster_url ?? "NULL"} (both preserved)`);
  return after;
}

async function verifyEndToEnd() {
  console.log("\n── Step 5 · end-to-end verification ──");
  const { data: row } = await sb
    .from("nex_chat_theme")
    .select("*")
    .eq("id", THEME_ID)
    .single();
  const vp = await fetch(WALLPAPER_URL, { method: "HEAD" });
  const vi = await fetch(INTRO_URL, { method: "HEAD" });
  const checks = [
    { name: "theme row exists",            pass: !!row },
    { name: "theme row is_active",         pass: row?.is_active === true },
    { name: "theme tier gratis",           pass: row?.tier === "gratis" },
    { name: "theme category premium",      pass: row?.category === "premium" },
    { name: "accent #FF8C1A",              pass: row?.accent_hex === "#FF8C1A" },
    { name: "bubble_rim #FFB84D",          pass: row?.bubble_rim_hex === "#FFB84D" },
    { name: "composer_rim #FFB84D",        pass: row?.composer_rim_hex === "#FFB84D" },
    { name: "layout_style bubbles",        pass: row?.layout_style === "bubbles" },
    { name: "sort_order 70",               pass: row?.sort_order === 70 },
    { name: "wallpaper HEAD 200 image/png",pass: vp.ok && vp.headers.get("content-type") === "image/png" },
    { name: "intro HEAD 200 video/mp4",    pass: vi.ok && vi.headers.get("content-type") === "video/mp4" },
    { name: "intro_video_url matches",     pass: row?.intro_video_url === INTRO_URL },
    { name: "hero_image_url matches",      pass: row?.hero_image_url === WALLPAPER_URL },
    { name: "wallpaper_config has bubbleStyle preset", pass: row?.wallpaper_config?.bubbleStyle?.preset === "outlined" },
    { name: "wallpaper_config has particleDrift", pass: !!row?.wallpaper_config?.particleDrift },
    { name: "wallpaper_config has sparkle",       pass: !!row?.wallpaper_config?.sparkle },
  ];
  const passed = checks.filter((c) => c.pass).length;
  for (const c of checks) console.log(`  ${c.pass ? "✓" : "✗"} ${c.name}`);
  console.log(`\n  ${passed}/${checks.length} checks pass`);
  if (passed !== checks.length) process.exit(1);
}

async function main() {
  console.log(`\nVitamins theme setup · ${new Date().toISOString()}\n`);
  await applyMigration();
  await uploadWallpaper();
  await uploadIntro();
  await setIntroUrl();
  await verifyEndToEnd();
  console.log(`\nTheme is live. Visit /nex-native/chat-themes-library signed in to preview it.`);
}

main().catch((e) => {
  console.error("\nFATAL:", e.message);
  console.error(e.stack);
  process.exit(1);
});
