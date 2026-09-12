#!/usr/bin/env node
// scripts/upload-nex-app-background.mjs
//
// Pulls the founder-provided background image from ImageKit, uploads
// it to Supabase Storage under network-uploads/nex-app/backgrounds/,
// and prints the public URL for wiring into CSS.
//
//   node scripts/upload-nex-app-background.mjs
//
// Two-step tsx pattern so .env.local is loaded and supabaseAdmin's
// process.env guards pass.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..");

if (!process.env.NEX_SEED_INNER) {
  const envArgs = fs.existsSync(path.join(repoRoot, ".env.local"))
    ? ["--env-file=.env.local"]
    : [];
  const entryFile = fileURLToPath(import.meta.url);
  const res = spawnSync(
    "npx",
    ["tsx", ...envArgs, entryFile, ...process.argv.slice(2)],
    { stdio: "inherit", cwd: repoRoot, shell: true, env: { ...process.env, NEX_SEED_INNER: "1" } },
  );
  process.exit(res.status ?? 1);
}

const { createClient } = await import("@supabase/supabase-js");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}
const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

const SOURCE = "https://ik.imagekit.io/ctlxgvqcm/ChatGPT%20Image%20Sep%206,%202026,%2011_12_25%20PM.png";
const BUCKET = "network-uploads";
const OBJECT_PATH = "nex-app/backgrounds/main-2026-09-07.png";

console.log(`Fetching ${SOURCE}`);
const resp = await fetch(SOURCE);
if (!resp.ok) { console.error("FATAL · could not fetch source · status", resp.status); process.exit(1); }
const buf = new Uint8Array(await resp.arrayBuffer());
console.log(`Fetched ${buf.byteLength} bytes`);

// Detect content type from magic bytes so we don't send the wrong header.
let contentType = "image/png";
if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) contentType = "image/jpeg";

console.log(`Uploading to ${BUCKET}/${OBJECT_PATH} · content-type ${contentType}`);
const up = await supabase.storage.from(BUCKET).upload(OBJECT_PATH, buf, {
  contentType,
  upsert: true,
  cacheControl: "31536000, immutable",
});
if (up.error) { console.error("Upload failed:", up.error.message); process.exit(1); }

const pub = supabase.storage.from(BUCKET).getPublicUrl(OBJECT_PATH);
console.log("\n=== SUCCESS ===");
console.log("Public URL:");
console.log(pub.data.publicUrl);
