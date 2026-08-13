// scripts/nex-brain/list-trades-hosted-images.mjs
//
// Extract the 127 image URLs in the NEX manifest that are hosted in the
// TRADES Supabase Storage · saves the list + grouped-by-bucket summary to
// data/audit/trades-hosted-images-2026-08-14.json for reference.

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

function loadDotEnv(path) {
  const raw = readFileSync(path, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["'](.*)["']$/, "$1");
  }
}
loadDotEnv(join(process.cwd(), ".env.local"));

const TRADES_HOST = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).host;
const NEX_HOST    = new URL(process.env.NEXT_PUBLIC_NEX_SUPABASE_URL).host;

const manifest = JSON.parse(readFileSync(join(process.cwd(), "data", "nex-image-manifest.json"), "utf8"));
const urls = Object.keys(manifest.images ?? {});
const tradesHosted = [];
const nexHosted    = [];
const other = new Map();

for (const u of urls) {
  let host;
  try { host = new URL(u).host; } catch { host = "(unparsed)"; }
  if (host === TRADES_HOST) tradesHosted.push(u);
  else if (host === NEX_HOST) nexHosted.push(u);
  else other.set(host, (other.get(host) ?? 0) + 1);
}

// Group trades-hosted URLs by bucket (path is /storage/v1/object/public/<bucket>/...)
const byBucket = {};
for (const u of tradesHosted) {
  try {
    const p = new URL(u).pathname;
    const m = p.match(/\/storage\/v1\/object\/(?:public|sign)\/([^\/]+)\//);
    const bucket = m ? m[1] : "(unknown-bucket)";
    (byBucket[bucket] ??= []).push(u);
  } catch { (byBucket["(unparsed)"] ??= []).push(u); }
}

console.log(`Manifest URLs total:                ${urls.length}`);
console.log(`  hosted at NEX Supabase   :        ${nexHosted.length}`);
console.log(`  hosted at TRADES Supabase :       ${tradesHosted.length}   ← contamination surface`);
for (const [h, n] of other) console.log(`  hosted at other (${h}) : ${n}`);
console.log("");
console.log("Trades Supabase URLs · grouped by bucket:");
for (const [bucket, list] of Object.entries(byBucket).sort((a, b) => b[1].length - a[1].length)) {
  console.log(`  · ${bucket.padEnd(30)}  ${String(list.length).padStart(4)} images`);
}

const OUT_DIR = join(process.cwd(), "data", "audit");
mkdirSync(OUT_DIR, { recursive: true });
const OUT_FILE = join(OUT_DIR, "trades-hosted-images-2026-08-14.json");
writeFileSync(OUT_FILE, JSON.stringify({
  generated_at: new Date().toISOString(),
  nex_host: NEX_HOST,
  trades_host: TRADES_HOST,
  totals: { total_manifest_urls: urls.length, nex_hosted: nexHosted.length, trades_hosted: tradesHosted.length },
  by_bucket: Object.fromEntries(Object.entries(byBucket).map(([k, v]) => [k, { count: v.length, urls: v }])),
}, null, 2), "utf8");
console.log("");
console.log(`Full list written to ${OUT_FILE}`);
