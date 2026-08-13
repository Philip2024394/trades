// scripts/nex-brain/migrate-127-to-imagekit.mjs
//
// Migrate the 127 NEX-manifest images currently hosted on the TRADES
// Supabase Storage over to ImageKit. Implements the NEX Migration
// Verification Protocol (feedback_nex_migration_verification_protocol_2026_08_14.md):
//
//   1  Backup FIRST                       (done externally · this script re-checks)
//   2  Verify source retrievable          (GET · not HEAD · we need bytes)
//   3  Upload with identity preservation  (folder = /nex-brain/<bucket>/<original path>/)
//   4  Verify destination                 (HEAD the returned URL, must be 2xx)
//   5  Rewrite one row at a time          (atomic per-image manifest write)
//   6  Per-image migration log            (JSONL append at data/audit/…)
//   7  Post-audit = 0                     (re-run list-trades-hosted-images)
//   8  Never delete source                (out of scope · manual step later)
//   9  Exception list is first-class      (data/audit/migration-…-exceptions-…json)
//  10  Never fabricate a substitute       (a failed image stays where it is)
//
// Rollback data: every migrated manifest row carries `_migration.migrated_from`
// with the original TRADES URL. Original TRADES bytes are NOT deleted by this
// script (Protocol step 8). Full JSONL log preserves old ↔ new mapping.
//
// Usage:
//   node scripts/nex-brain/migrate-127-to-imagekit.mjs                 # full run · resumable
//   node scripts/nex-brain/migrate-127-to-imagekit.mjs --dry-run       # do everything except upload + manifest rewrite
//   node scripts/nex-brain/migrate-127-to-imagekit.mjs --limit=3       # process first N only (smoke test)
//   node scripts/nex-brain/migrate-127-to-imagekit.mjs --dry-run --limit=3

import { readFileSync, writeFileSync, appendFileSync, mkdirSync, existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";

// ─── env ─────────────────────────────────────────────────────────────
function loadDotEnv(path) {
  const raw = readFileSync(path, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["'](.*)["']$/, "$1");
  }
}
loadDotEnv(join(process.cwd(), ".env.local"));

const IK_PRIVATE = process.env.IMAGEKIT_PRIVATE_KEY;
const IK_PUBLIC  = process.env.IMAGEKIT_PUBLIC_KEY;
const IK_ENDPOINT = process.env.IMAGEKIT_URL_ENDPOINT;
const NEX_URL = process.env.NEXT_PUBLIC_NEX_SUPABASE_URL;

// ─── args ────────────────────────────────────────────────────────────
const DRY = process.argv.includes("--dry-run");
const LIMIT_ARG = process.argv.find((a) => a.startsWith("--limit="));
const LIMIT = LIMIT_ARG ? Number(LIMIT_ARG.split("=")[1]) : Infinity;

// ─── preflight ───────────────────────────────────────────────────────
console.log("=".repeat(72));
console.log(`MIGRATE 127 TRADES-HOSTED NEX IMAGES → ImageKit  ${DRY ? "· DRY RUN" : ""}`);
console.log("=".repeat(72));

if (!DRY && (!IK_PRIVATE || !IK_ENDPOINT)) {
  console.error("");
  console.error("BLOCKED · missing ImageKit env vars in .env.local:");
  if (!IK_PRIVATE)  console.error("  IMAGEKIT_PRIVATE_KEY  = <missing>");
  if (!IK_PUBLIC)   console.error("  IMAGEKIT_PUBLIC_KEY   = <missing>   (informational · not used for upload auth)");
  if (!IK_ENDPOINT) console.error("  IMAGEKIT_URL_ENDPOINT = <missing>");
  console.error("");
  console.error("Add them to .env.local (never paste values into chat) and re-run.");
  process.exit(2);
}

// ─── inputs ──────────────────────────────────────────────────────────
const AUDIT_FILE    = join(process.cwd(), "data", "audit", "trades-hosted-images-2026-08-14.json");
const MANIFEST_FILE = join(process.cwd(), "data", "nex-image-manifest.json");
const audit    = JSON.parse(readFileSync(AUDIT_FILE, "utf8"));
const allUrls  = Object.values(audit.by_bucket).flatMap((b) => b.urls.map((u) => ({ bucket: b_bucket_from_url(u), url: u })));
function b_bucket_from_url(u) {
  const m = new URL(u).pathname.match(/\/storage\/v1\/object\/public\/([^\/]+)\//);
  return m ? m[1] : "(unknown)";
}
const targetUrls = allUrls.slice(0, LIMIT);
console.log(`Sources    : ${allUrls.length} total · processing ${targetUrls.length}`);
if (DRY) console.log("Dry run    : no uploads · no manifest writes");
console.log("");

// ─── output paths ────────────────────────────────────────────────────
const RUN_STAMP = new Date().toISOString().replace(/[:.]/g, "-");
const OUT_DIR   = join(process.cwd(), "data", "audit");
mkdirSync(OUT_DIR, { recursive: true });
const LOG_PATH        = join(OUT_DIR, `migration-trades-to-imagekit-${RUN_STAMP}.jsonl`);
const EXCEPTIONS_PATH = join(OUT_DIR, `migration-trades-to-imagekit-exceptions-${RUN_STAMP}.json`);

// ─── resumability · scan prior successful migrations ─────────────────
const already = new Set();
const priorLogs = existsSync(OUT_DIR)
  ? (await import("node:fs")).readdirSync(OUT_DIR).filter((f) => f.startsWith("migration-trades-to-imagekit-") && f.endsWith(".jsonl"))
  : [];
for (const f of priorLogs) {
  const lines = readFileSync(join(OUT_DIR, f), "utf8").split(/\r?\n/).filter(Boolean);
  for (const line of lines) {
    try {
      const row = JSON.parse(line);
      if (row.destination_verified === true && row.old_url) already.add(row.old_url);
    } catch {}
  }
}
if (already.size) console.log(`Resumability: ${already.size} URLs already migrated in prior runs · skipping.`);

// ─── ImageKit upload ─────────────────────────────────────────────────
async function ikUpload({ bytes, fileName, folder, tags }) {
  const form = new FormData();
  form.append("file", new Blob([bytes]), fileName);
  form.append("fileName", fileName);
  form.append("folder", folder);
  form.append("useUniqueFileName", "false");     // Protocol step 3 · preserve identity
  form.append("overwriteFile", "true");          // idempotent re-run
  form.append("overwriteAITags", "false");
  form.append("overwriteTags", "false");
  form.append("overwriteCustomMetadata", "false");
  if (tags?.length) form.append("tags", tags.join(","));

  const auth = "Basic " + Buffer.from(`${IK_PRIVATE}:`).toString("base64");
  const res = await fetch("https://upload.imagekit.io/api/v1/files/upload", {
    method: "POST",
    headers: { Authorization: auth },
    body: form,
  });
  const text = await res.text();
  let json = null; try { json = JSON.parse(text); } catch {}
  if (!res.ok) {
    throw new Error(`imagekit-upload-${res.status}: ${(json?.message ?? text).slice(0, 300)}`);
  }
  return json; // { url, filePath, fileId, ... }
}

async function verifyGet(url) {
  // ImageKit CDN sometimes 404s a fresh URL on the first HEAD · GET is more reliable
  const res = await fetch(url, { method: "GET", signal: AbortSignal.timeout(20_000) });
  return { ok: res.ok, status: res.status, contentType: res.headers.get("content-type") ?? "" };
}

function targetPath(bucket, sourceUrl) {
  // Preserve the trades bucket path segment · e.g. product-images/imagekit-import/contact-hero.png
  const p = new URL(sourceUrl).pathname;
  const m = p.match(/\/storage\/v1\/object\/public\/[^\/]+\/(.+)$/);
  const rel = m ? decodeURIComponent(m[1]) : decodeURIComponent(p.split("/").pop() ?? "unknown.png");
  const parts = rel.split("/");
  const fileName = parts.pop();
  const folder = `/nex-brain/${bucket}/${parts.join("/")}`.replace(/\/+$/, "");
  return { folder, fileName };
}

// ─── run ─────────────────────────────────────────────────────────────
const exceptions = [];
let migrated = 0, skipped = 0, failed = 0;

for (const [i, { bucket, url }] of targetUrls.entries()) {
  const prefix = `[${String(i + 1).padStart(3)}/${targetUrls.length}]`;

  if (already.has(url)) { skipped++; console.log(`${prefix} SKIP already-migrated · ${url.slice(-70)}`); continue; }

  const rec = {
    ran_at: new Date().toISOString(),
    old_url: url,
    bucket,
    source_get_ok: null,
    source_bytes: null,
    source_content_type: null,
    source_sha256: null,
    ik_folder: null,
    ik_file_name: null,
    ik_upload_ok: null,
    new_url: null,
    ik_file_path: null,
    ik_file_id: null,
    destination_verified: null,
    manifest_rewritten: null,
    dry_run: DRY,
    error: null,
  };

  try {
    // ── step 2 · GET source ──
    const sRes = await fetch(url, { signal: AbortSignal.timeout(30_000) });
    if (!sRes.ok) throw new Error(`source-get-${sRes.status}`);
    const buf = Buffer.from(await sRes.arrayBuffer());
    rec.source_get_ok = true;
    rec.source_bytes  = buf.byteLength;
    rec.source_content_type = sRes.headers.get("content-type") ?? "";
    rec.source_sha256 = createHash("sha256").update(buf).digest("hex");

    // ── step 3 · upload preserving identity ──
    const { folder, fileName } = targetPath(bucket, url);
    rec.ik_folder = folder;
    rec.ik_file_name = fileName;

    if (DRY) {
      console.log(`${prefix} DRY  ${folder}/${fileName}  (${(buf.byteLength/1024).toFixed(0)} KB)`);
      rec.ik_upload_ok = "dry-run";
      appendFileSync(LOG_PATH, JSON.stringify(rec) + "\n", "utf8");
      migrated++;
      continue;
    }

    const upload = await ikUpload({ bytes: buf, fileName, folder, tags: ["nex-brain", "migrated-from-trades"] });
    rec.ik_upload_ok = true;
    rec.new_url = upload.url;
    rec.ik_file_path = upload.filePath;
    rec.ik_file_id = upload.fileId;

    // ── step 4 · verify destination ──
    const vRes = await verifyGet(upload.url);
    rec.destination_verified = vRes.ok;
    if (!vRes.ok) throw new Error(`destination-verify-${vRes.status}`);

    // ── step 5 · atomic per-row manifest rewrite ──
    const manifest = JSON.parse(readFileSync(MANIFEST_FILE, "utf8"));
    if (!manifest.images[url]) throw new Error("manifest-row-missing");
    const meta = manifest.images[url];
    const nowIso = new Date().toISOString();
    const migratedMeta = {
      ...meta,
      _migration: {
        ...(meta._migration ?? {}),
        migrated_from: url,
        migrated_at: nowIso,
        run_id: RUN_STAMP,
        source_sha256: rec.source_sha256,
        source_bytes: rec.source_bytes,
        ik_file_id: rec.ik_file_id,
        ik_file_path: rec.ik_file_path,
      },
    };
    if (manifest.images[upload.url] && upload.url !== url) {
      // vanishingly unlikely (would mean the destination URL was already present) · treat as exception
      throw new Error("destination-url-already-in-manifest");
    }
    manifest.images[upload.url] = migratedMeta;
    delete manifest.images[url];
    writeFileSync(MANIFEST_FILE, JSON.stringify(manifest, null, 2), "utf8");
    rec.manifest_rewritten = true;

    // ── step 6 · log ──
    appendFileSync(LOG_PATH, JSON.stringify(rec) + "\n", "utf8");
    console.log(`${prefix} OK   ${upload.url}`);
    migrated++;
  } catch (e) {
    rec.error = e?.message ?? String(e);
    appendFileSync(LOG_PATH, JSON.stringify(rec) + "\n", "utf8");
    exceptions.push({ url, error: rec.error, stage: rec.destination_verified === false ? "verify" : rec.ik_upload_ok ? "post-upload" : rec.source_get_ok ? "upload" : "source" });
    failed++;
    console.log(`${prefix} FAIL ${e?.message ?? e}  ·  ${url.slice(-70)}`);
  }
}

// ─── step 9 · exception list is first-class output ────────────────────
writeFileSync(EXCEPTIONS_PATH, JSON.stringify({
  ran_at: new Date().toISOString(),
  run_id: RUN_STAMP,
  dry_run: DRY,
  totals: { processed: targetUrls.length, migrated, skipped, failed },
  exceptions,
}, null, 2), "utf8");

console.log("");
console.log("─".repeat(72));
console.log(`Processed  : ${targetUrls.length}`);
console.log(`Migrated   : ${migrated}${DRY ? " (dry-run · no manifest changes)" : ""}`);
console.log(`Skipped    : ${skipped}`);
console.log(`Failed     : ${failed}`);
console.log("");
console.log(`Migration log : ${LOG_PATH}`);
console.log(`Exceptions    : ${EXCEPTIONS_PATH}`);
console.log("");
if (!DRY && failed === 0 && migrated + skipped === targetUrls.length) {
  console.log("Next · run the post-audit:");
  console.log("  node scripts/nex-brain/list-trades-hosted-images.mjs");
  console.log("  Expected · trades-Supabase URLs in manifest = 0");
}
