#!/usr/bin/env node
// One-time bootstrap: download the RMBG-1.4 ONNX weights and upload
// them to our Supabase Storage bucket. Once this runs successfully,
// browsers fetch the model from OUR bucket (self-hosted, no 3rd
// party CDN dependency).
//
// Model: briaai/RMBG-1.4, Apache-2.0 licensed.
// Origin: HuggingFace (one-time download only — after this the
// weights live entirely in our Supabase project).
//
// Usage:
//   node scripts/setup-bgremoval-model.mjs
//
// Reads NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY from
// .env.local. Idempotent — safe to re-run.

import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync, statSync, createWriteStream } from "node:fs";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { config as dotenv } from "dotenv";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT      = resolve(__dirname, "..");
dotenv({ path: resolve(ROOT, ".env.local") });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

const BUCKET     = "bgremoval-models";
const MODEL_FILE = "rmbg-1.4.onnx";
const CACHE_PATH = resolve(ROOT, "tmp", "bgremoval-model", MODEL_FILE);
// Prefer the HuggingFace direct-download URL, which returns a signed
// CDN blob. The weights are Apache-2.0 so redistribution via our
// Supabase Storage is permitted.
const SOURCE_URL = "https://huggingface.co/briaai/RMBG-1.4/resolve/main/onnx/model.onnx?download=true";

async function downloadIfMissing() {
  if (existsSync(CACHE_PATH) && statSync(CACHE_PATH).size > 100_000_000) {
    console.log(`✓ Model already cached at ${CACHE_PATH} (${(statSync(CACHE_PATH).size / 1024 / 1024).toFixed(1)}MB)`);
    return;
  }
  console.log(`↓ Downloading RMBG-1.4 weights (~176MB) — one-time…`);
  const { mkdirSync } = await import("node:fs");
  mkdirSync(dirname(CACHE_PATH), { recursive: true });

  const res = await fetch(SOURCE_URL);
  if (!res.ok || !res.body) throw new Error(`Download failed: HTTP ${res.status}`);
  const total = Number(res.headers.get("content-length") ?? "0");
  let done = 0;
  const nodeStream = Readable.fromWeb(res.body);
  nodeStream.on("data", (chunk) => {
    done += chunk.length;
    if (total) process.stdout.write(`\r  ${(done / 1024 / 1024).toFixed(1)}MB / ${(total / 1024 / 1024).toFixed(1)}MB`);
  });
  await pipeline(nodeStream, createWriteStream(CACHE_PATH));
  process.stdout.write("\n");
}

async function uploadToSupabase() {
  const buf  = readFileSync(CACHE_PATH);
  console.log(`↑ Uploading to Supabase Storage bucket "${BUCKET}"…`);
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(MODEL_FILE, buf, {
      contentType: "application/octet-stream",
      cacheControl: "31536000",     // 1 year — model never changes
      upsert: true
    });
  if (error) throw error;
  const { publicUrl } = supabase.storage.from(BUCKET).getPublicUrl(MODEL_FILE).data;
  console.log(`✓ Uploaded. Public URL:`);
  console.log(`  ${publicUrl}`);
}

async function main() {
  await downloadIfMissing();
  await uploadToSupabase();
  console.log("");
  console.log("Done. The Site Editor Cutout tool is now backed by our own model weights.");
  console.log("Merchants download the model once (cached forever) and inference runs on their device.");
}

main().catch((err) => { console.error(err); process.exit(1); });
