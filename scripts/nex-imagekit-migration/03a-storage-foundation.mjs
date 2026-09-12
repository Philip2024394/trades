// NEX ImageKit → Supabase migration · Phase 3A · Storage foundation.
// Philip 2026-09-02 · authorised.
//
// ═══════════════════════════════════════════════════════════════════════
// STRICT SCOPE — this script is authorised ONLY to:
//   1. Create the `nex-media` bucket on the NEX Supabase project
//      IF (and only if) it does not already exist.
//   2. Write ONE new data file: `data/nex-imagekit-migration-ledger.json`
//      Composed from existing read-only audit outputs.
//
// MUST NOT:
//   · Upload any image
//   · Copy / move / delete any Storage object
//   · Modify any DB row / DDL / RPC
//   · Modify any source file
//   · Modify any existing manifest (nex-image-manifest.json etc.)
//   · Touch the NEX shell / frame / geometry / viewport / manifest
//   · Modify anything on the MAIN Supabase project
//   · Delete or modify any ImageKit asset
//
// PRE-CONDITIONS (verified inside script):
//   · Both audit reports must exist:
//       data/nex-imagekit-migration-report-2b.json  (HEAD reachability)
//       data/nex-imagekit-unknown-review.json       (UNKNOWN URLs)
//   · NEX_SUPABASE_URL + NEX_SUPABASE_SERVICE_ROLE_KEY must be in .env.local

import { createClient } from "@supabase/supabase-js";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot  = join(__dirname, "..", "..");

// ─── Env ───────────────────────────────────────────────────────────────
function loadEnv() {
  const env = {};
  for (const line of readFileSync(join(repoRoot, ".env.local"), "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return env;
}
const env      = loadEnv();
const NEX_URL  = env.NEX_SUPABASE_URL || env.NEXT_PUBLIC_NEX_SUPABASE_URL;
const NEX_KEY  = env.NEX_SUPABASE_SERVICE_ROLE_KEY;
const NEX_PROJECT_HOST = new URL(NEX_URL).host;
if (!NEX_URL || !NEX_KEY) { console.error("Missing NEX Supabase env"); process.exit(1); }

// Safety guard · refuse to run against MAIN by accident.
if (!NEX_URL.includes("ijvqdvsvwtwxzcqmoqit")) {
  console.error(`REFUSING to run · NEX_URL does not match ijvqdvsvwtwxzcqmoqit · saw ${NEX_URL}`);
  process.exit(1);
}

const sb = createClient(NEX_URL, NEX_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// Pre-condition · audit reports must exist
const REPORT_2B = join(repoRoot, "data/nex-imagekit-migration-report-2b.json");
const UNKNOWN   = join(repoRoot, "data/nex-imagekit-unknown-review.json");
for (const p of [REPORT_2B, UNKNOWN]) {
  if (!existsSync(p)) {
    console.error(`Missing pre-req audit file: ${p} · run Phase 2b first`);
    process.exit(1);
  }
}

console.log("═══════════════════════════════════════════════════════════");
console.log(" NEX ImageKit → Supabase · Phase 3A · Storage foundation");
console.log("═══════════════════════════════════════════════════════════");
console.log(` Target project: ${NEX_PROJECT_HOST}\n`);

// ═══════════════════════════════════════════════════════════════════════
// TASK 1 · Create bucket `nex-media` if missing (idempotent)
// ═══════════════════════════════════════════════════════════════════════
const BUCKET = "nex-media";

async function ensureBucket() {
  console.log("─── Task 1 · Ensure nex-media bucket exists ────────");
  const { data: existing, error: listErr } = await sb.storage.listBuckets();
  if (listErr) {
    console.error(`  listBuckets failed: ${listErr.message}`);
    process.exit(1);
  }
  const found = existing.find((b) => b.name === BUCKET);
  if (found) {
    console.log(`  ✓ Bucket already exists · public=${found.public} · created=${found.created_at}`);
    return { existed: true, bucket: found };
  }
  // Bucket creation config · public read, server-side write only.
  // No allowedMimeTypes filter (accept any image · we validate MIME per-file at upload).
  // No fileSizeLimit (leave to Supabase defaults · can be tightened later).
  const { data, error } = await sb.storage.createBucket(BUCKET, {
    public: true,
    fileSizeLimit: null,
    allowedMimeTypes: null,
  });
  if (error) {
    console.error(`  createBucket failed: ${error.message}`);
    process.exit(1);
  }
  console.log(`  ✓ Created bucket · name=${BUCKET} · public=true`);
  return { existed: false, bucket: data };
}

// ═══════════════════════════════════════════════════════════════════════
// TASK 2 · Build migration ledger (data/nex-imagekit-migration-ledger.json)
// ═══════════════════════════════════════════════════════════════════════
//
// The ledger is the single source of truth for the migration. Every
// authorised operation (test batch, rollout batch, verification, rewrite)
// consumes and updates this file. Never migrated blindly.
//
// Statuses used at ledger-creation time (in this script):
//   PENDING                        · owned + reachable · candidate
//   PROVENANCE_REVIEW_REQUIRED     · unknown provenance · human review
//   BROKEN                         · HEAD returned non-2xx · skip
//   MIGRATION_BLOCKED_MAIN         · URL points at MAIN Supabase, not IK
//
// Statuses reserved for later scripts:
//   IN_PROGRESS · MIGRATED · VERIFIED · FAILED

const MANIFEST_FILES = [
  "data/nex-image-manifest.json",
  "data/nex-curated-images-manifest.json",
  "data/nex-confirmed-images.json",
];

function classifyProvenance(url) {
  if (/\.supabase\.(co|in)/.test(url)) return "ALREADY_ON_MAIN_SUPABASE";
  if (/ChatGPT%20Image|ChatGPT_Image|chatgpt.image/i.test(url)) return "OWNED_LIKELY_AI_GENERATED";
  if (/Untitled[a-z]+/i.test(url)) return "OWNED_LIKELY_UPLOAD";
  if (/removebg-preview/i.test(url)) return "OWNED_LIKELY_PROCESSED";
  return "UNKNOWN_PROVENANCE";
}

// Extract account + source path from ImageKit URL
function parseImageKitUrl(url) {
  const m = url.match(/^https:\/\/ik\.imagekit\.io\/([a-z0-9]+)\/([^?]*)/i);
  if (!m) return { account: null, source_path: null };
  return { account: m[1], source_path: decodeURIComponent(m[2]) };
}

// Sanitise filename for Supabase Storage path.
// Preserves identity but strips characters known to break Storage:
// preserves letters/digits/dot/dash/underscore/space/comma/parens · replaces
// anything else with `_` · collapses repeated underscores.
function sanitiseForStorage(name) {
  if (!name) return "";
  const decoded = decodeURIComponent(name);
  return decoded
    .replace(/[^\w.\-, ()]/g, "_")
    .replace(/_+/g, "_")
    .trim();
}

// Load HEAD reachability outcomes from Phase 2b · index by URL for lookup.
function loadReachabilityIndex() {
  const raw = JSON.parse(readFileSync(REPORT_2B, "utf8"));
  const idx = new Map();
  const perAccount = raw.task_3_imagekit_availability?.perAccount ?? {};
  // Phase 2b tracked stats per account but not per URL in the report ·
  // fall back: no per-URL data available except sample_bad entries.
  // We'll mark reachability as "assumed_reachable" for candidates, and
  // rely on the fresh HEAD check in the future test-batch script.
  // sample_bad entries (up to 3 per account) can be marked BROKEN here.
  for (const [acc, stats] of Object.entries(perAccount)) {
    for (const bad of stats.sample_bad ?? []) {
      idx.set(bad.url, { known_bad: true, status: bad.status, error: bad.error });
    }
  }
  return idx;
}

// Load UNKNOWN URLs from Phase 2b · index by URL for lookup.
function loadUnknownIndex() {
  const raw = JSON.parse(readFileSync(UNKNOWN, "utf8"));
  const idx = new Set();
  for (const u of raw.unknowns ?? [])                    idx.add(u.imagekit_url);
  for (const u of raw.broken_malformed_from_curated ?? []) idx.add(u.imagekit_url);
  return idx;
}

async function buildLedger() {
  console.log("\n─── Task 2 · Build migration ledger ─────────────────");

  const reachability = loadReachabilityIndex();
  const unknownSet   = loadUnknownIndex();

  // Aggregate all unique URLs across the 3 manifests + source code sample.
  const urlSet = new Set();
  const urlSources = new Map(); // url → [manifest paths where it appears]
  for (const manifestPath of MANIFEST_FILES) {
    const p = join(repoRoot, manifestPath);
    if (!existsSync(p)) continue;
    const raw = readFileSync(p, "utf8");
    for (const u of raw.match(/https?:\/\/[^"'\s\)]+/g) || []) {
      urlSet.add(u);
      if (!urlSources.has(u)) urlSources.set(u, []);
      urlSources.get(u).push(manifestPath);
    }
  }
  console.log(`  Unique URLs across 3 manifests: ${urlSet.size}`);

  // Determine destination path per URL.
  // Per Philip's spec · use `imported/` as quarantine when category is
  // not confidently determined. First-pass ledger uses `imported/<account>/<file>`.
  function destinationFor(url) {
    const { account, source_path } = parseImageKitUrl(url);
    if (!account) return null;
    const filename = sanitiseForStorage(source_path.split("/").pop() ?? "");
    if (!filename) return null;
    const subPath = source_path.includes("/") ? source_path.split("/").slice(0, -1).join("/") : "";
    const cleanSub = sanitiseForStorage(subPath);
    const bucketPath = ["imported", account, cleanSub, filename].filter(Boolean).join("/");
    return {
      destination_bucket: BUCKET,
      destination_path:   bucketPath,
      destination_url:    `${NEX_URL}/storage/v1/object/public/${BUCKET}/${encodeURI(bucketPath)}`,
    };
  }

  // Build ledger entries.
  const ledger = [];
  const stats = { PENDING: 0, PROVENANCE_REVIEW_REQUIRED: 0, BROKEN: 0, MIGRATION_BLOCKED_MAIN: 0 };

  // Deduplication tracking · same source_url only appears once.
  // Different URLs that resolve to identical binary content are flagged
  // later in the test-batch script (needs SHA-256 which requires download).
  for (const url of urlSet) {
    const parsed = parseImageKitUrl(url);
    const provenance = classifyProvenance(url);
    const dest = provenance === "ALREADY_ON_MAIN_SUPABASE" ? null : destinationFor(url);

    let status;
    if (provenance === "ALREADY_ON_MAIN_SUPABASE") {
      status = "MIGRATION_BLOCKED_MAIN";
    } else if (unknownSet.has(url) || provenance === "UNKNOWN_PROVENANCE") {
      status = "PROVENANCE_REVIEW_REQUIRED";
    } else if (reachability.get(url)?.known_bad) {
      status = "BROKEN";
    } else {
      status = "PENDING";
    }
    stats[status] = (stats[status] || 0) + 1;

    ledger.push({
      source_url:         url,
      imagekit_account:   parsed.account,
      source_path:        parsed.source_path,
      source_manifest:    urlSources.get(url) ?? [],
      provenance,
      http_status:        null, // populated per-URL by test-batch script
      content_type:       null,
      content_length:     null,
      sha256:             null,
      destination_bucket: dest?.destination_bucket ?? null,
      destination_path:   dest?.destination_path   ?? null,
      destination_url:    dest?.destination_url    ?? null,
      status,
      notes: reachability.get(url)?.error ? `HEAD error: ${reachability.get(url).error}` : null,
    });
  }

  const outPath = join(repoRoot, "data/nex-imagekit-migration-ledger.json");
  const doc = {
    generated_at:                new Date().toISOString(),
    target_project:              NEX_PROJECT_HOST,
    bucket:                      BUCKET,
    total_entries:               ledger.length,
    status_counts:               stats,
    quarantine_folder:           "nex-media/imported/",
    canonical_folder_structure_planned: [
      "ui/", "frames/", "avatars/", "profiles/",
      "directory/food/", "directory/accommodation/", "directory/businesses/", "directory/places/",
      "marketplace/", "social/", "live/", "projects/", "uploads/",
    ],
    per_account: {},
    entries: ledger,
  };
  // per-account rollup
  for (const e of ledger) {
    const a = e.imagekit_account ?? "OTHER";
    doc.per_account[a] ??= { total: 0, PENDING: 0, PROVENANCE_REVIEW_REQUIRED: 0, BROKEN: 0, MIGRATION_BLOCKED_MAIN: 0 };
    doc.per_account[a].total++;
    doc.per_account[a][e.status]++;
  }

  writeFileSync(outPath, JSON.stringify(doc, null, 2));
  console.log(`  ✓ Ledger written · ${ledger.length} entries · ${outPath}`);
  console.log("  Status counts:", stats);
  console.log("  Per-account:");
  for (const [acc, s] of Object.entries(doc.per_account)) {
    console.log(`    ${acc}  total ${s.total}  PENDING ${s.PENDING}  REVIEW ${s.PROVENANCE_REVIEW_REQUIRED}  BROKEN ${s.BROKEN}  MAIN ${s.MIGRATION_BLOCKED_MAIN}`);
  }
  return { stats, path: outPath, total: ledger.length };
}

// ═══════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════
(async () => {
  const bucketResult = await ensureBucket();
  const ledgerResult = await buildLedger();

  console.log("\n═══════════════════════════════════════════════════════════");
  console.log(" Phase 3A complete · storage foundation ready");
  console.log(`   Bucket:  ${BUCKET}  (${bucketResult.existed ? "already existed" : "created"})`);
  console.log(`   Ledger:  ${ledgerResult.path}`);
  console.log(`   Entries: ${ledgerResult.total}`);
  console.log(`   Migration candidates (PENDING): ${ledgerResult.stats.PENDING}`);
  console.log(`   Awaiting provenance review:     ${ledgerResult.stats.PROVENANCE_REVIEW_REQUIRED}`);
  console.log(`   Broken (skip):                  ${ledgerResult.stats.BROKEN}`);
  console.log(`   MAIN Supabase (don't touch):    ${ledgerResult.stats.MIGRATION_BLOCKED_MAIN}`);
  console.log(" NEXT · await explicit test-batch authorisation (5-10 images)");
  console.log("═══════════════════════════════════════════════════════════");
})();
