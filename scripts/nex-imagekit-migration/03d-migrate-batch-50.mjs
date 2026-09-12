// NEX ImageKit → Supabase migration · Phase 3D · 50-image bulk test.
// Philip 2026-09-02 · authorised · MAX 50 IMAGES · RESUMABLE.
//
// ═══════════════════════════════════════════════════════════════════════
// HARD SCOPE
// ═══════════════════════════════════════════════════════════════════════
//
// Migrates AT MOST 50 additional images from ImageKit → nex-media on
// the NEX Supabase project. Same proven pipeline as Phase 3B (HEAD →
// GET → SHA-256 → upload → retrieve → SHA-256 verify) plus:
//   · Concurrency pool of 6 workers (in the 5-10 authorised range)
//   · Fresh pre-flight HEAD immediately before each upload (defends
//     against corpus reachability drift between Phase 3C validation
//     and this run)
//   · Resumability · script is safe if interrupted OR re-run · already
//     VERIFIED entries are skipped and existing Supabase objects are
//     re-verified rather than duplicated
//   · Duplicate detection · SHA-256 across (this batch ∪ existing 10 VERIFIED)
//
// SELECTION RULES (from authorisation)
//   status                        === "PENDING"
//   provenance                    ∈ ALLOWED_PROVENANCE
//   validation_state              === "REACHABLE" (from Phase 3C)
//   source_url starts with        "https://ik.imagekit.io/"
//   distribution                  22 / 22 / 6 across accounts (backfill if short)
//
// MUST NOT:
//   · Exceed 50 uploads (hard cap enforced pre-run)
//   · Migrate any UNKNOWN / BROKEN / MAIN / UNAVAILABLE entry
//   · Touch the 10 existing VERIFIED entries (except read their SHA for dup check)
//   · Modify any source file / existing manifest / DB row / .env
//   · Delete anything from Supabase (no storage.remove) or ImageKit
//   · Rewrite production URLs / cutover the application
//   · Auto-merge duplicates (report only)
//   · Touch NEX shell / frame / geometry / viewport / PWA manifest

import { createClient } from "@supabase/supabase-js";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createHash } from "node:crypto";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot  = join(__dirname, "..", "..");

// ═══════════════════════════════════════════════════════════════════════
// HARD LIMITS (constants · not overridable)
// ═══════════════════════════════════════════════════════════════════════
const HARD_LIMIT       = 50;
const BUCKET           = "nex-media";
const CONCURRENCY      = 6;                            // in authorised 5-10 range
const HEAD_TIMEOUT_MS  = 15_000;
const RATE_BACKOFF_MS  = 5_000;
const ALLOWED_PROVENANCE = new Set(["OWNED_LIKELY_AI_GENERATED", "OWNED_LIKELY_UPLOAD"]);
const ALLOWED_ACCOUNTS   = new Set(["5vv5pw26q", "9mrgsv2rp", "nepgaxllc"]);
const DIST_TARGET        = { "5vv5pw26q": 22, "9mrgsv2rp": 22, "nepgaxllc": 6 };

// ─── Env / safety guard ───────────────────────────────────────────────
function loadEnv() {
  const env = {};
  for (const line of readFileSync(join(repoRoot, ".env.local"), "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return env;
}
const env = loadEnv();
const NEX_URL = env.NEX_SUPABASE_URL || env.NEXT_PUBLIC_NEX_SUPABASE_URL;
const NEX_KEY = env.NEX_SUPABASE_SERVICE_ROLE_KEY;
if (!NEX_URL || !NEX_URL.includes("ijvqdvsvwtwxzcqmoqit")) {
  console.error(`REFUSING · NEX project guard failed · saw ${NEX_URL}`);
  process.exit(1);
}
if (!NEX_KEY) { console.error("Missing service role key"); process.exit(1); }

const sb = createClient(NEX_URL, NEX_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const LEDGER_PATH = join(repoRoot, "data/nex-imagekit-migration-ledger.json");
if (!existsSync(LEDGER_PATH)) { console.error("Ledger not found"); process.exit(1); }

console.log("═══════════════════════════════════════════════════════════");
console.log(" NEX ImageKit → Supabase · Phase 3D · 50-image bulk test");
console.log("═══════════════════════════════════════════════════════════");
console.log(` Target: ${NEX_URL}\n Bucket: ${BUCKET}\n Hard limit: ${HARD_LIMIT}\n Concurrency: ${CONCURRENCY}\n`);

// ═══════════════════════════════════════════════════════════════════════
// LEDGER LOAD + SELECTION
// ═══════════════════════════════════════════════════════════════════════
const ledger = JSON.parse(readFileSync(LEDGER_PATH, "utf8"));

// Existing VERIFIED hashes · used for dup detection across the wider corpus
const existingVerifiedHashes = new Map(); // sha256 → [source_url]
for (const e of ledger.entries) {
  if (e.status === "VERIFIED" && e.sha256) {
    if (!existingVerifiedHashes.has(e.sha256)) existingVerifiedHashes.set(e.sha256, []);
    existingVerifiedHashes.get(e.sha256).push(e.source_url);
  }
}
console.log(`Existing VERIFIED entries with SHA-256 recorded: ${existingVerifiedHashes.size}`);

// Selection · PENDING + owned + REACHABLE from Phase 3C · distribute across accounts
function selectCandidates() {
  const buckets = { "5vv5pw26q": [], "9mrgsv2rp": [], "nepgaxllc": [] };
  for (const e of ledger.entries) {
    if (e.status !== "PENDING") continue;
    if (!ALLOWED_PROVENANCE.has(e.provenance)) continue;
    if (!ALLOWED_ACCOUNTS.has(e.imagekit_account)) continue;
    if (e.validation_state !== "REACHABLE") continue;
    if (!e.source_url?.startsWith("https://ik.imagekit.io/")) continue;
    if (!e.destination_path) continue;
    buckets[e.imagekit_account].push(e);
  }
  const picked = [];
  // First pass · fill per-account target
  for (const acc of Object.keys(DIST_TARGET)) {
    const take = Math.min(DIST_TARGET[acc], buckets[acc].length);
    for (let i = 0; i < take; i++) picked.push(buckets[acc][i]);
  }
  // Backfill if under 50 (e.g. nepgaxllc short) from the deeper account queues
  const rem = () => HARD_LIMIT - picked.length;
  for (const acc of ["5vv5pw26q", "9mrgsv2rp"]) {
    while (rem() > 0 && buckets[acc][picked.filter((p) => p.imagekit_account === acc).length]) {
      picked.push(buckets[acc][picked.filter((p) => p.imagekit_account === acc).length]);
    }
  }
  if (picked.length > HARD_LIMIT) picked.length = HARD_LIMIT;
  return picked;
}
const candidates = selectCandidates();
console.log(`\nSelected ${candidates.length} candidate(s):`);
const distCheck = candidates.reduce((acc, c) => { acc[c.imagekit_account] = (acc[c.imagekit_account] || 0) + 1; return acc; }, {});
console.log(`  Distribution: ${JSON.stringify(distCheck)}`);
const provCheck = candidates.reduce((acc, c) => { acc[c.provenance] = (acc[c.provenance] || 0) + 1; return acc; }, {});
console.log(`  Provenance:   ${JSON.stringify(provCheck)}`);
if (candidates.length === 0) { console.error("No eligible candidates · aborting"); process.exit(1); }
if (candidates.length > HARD_LIMIT) { console.error(`Selection exceeded hard limit · aborting`); process.exit(1); }

// ═══════════════════════════════════════════════════════════════════════
// PIPELINE (per image · resumable · defensive)
// ═══════════════════════════════════════════════════════════════════════
const sha256 = (buf) => createHash("sha256").update(Buffer.from(buf)).digest("hex");

async function headWithTimeout(url) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), HEAD_TIMEOUT_MS);
  try {
    const r = await fetch(url, { method: "HEAD", redirect: "follow", signal: ctrl.signal });
    clearTimeout(t);
    return { status: r.status, mime: r.headers.get("content-type"), len: Number(r.headers.get("content-length")) || null };
  } catch (e) {
    clearTimeout(t);
    return { status: 0, error: e.message };
  }
}

async function processOne(entry, index, rateLimitCounter) {
  const label = `[${String(index + 1).padStart(2, "0")}/${candidates.length}] ${entry.imagekit_account}/${(entry.source_path || "").slice(-40)}`;

  // Resumability · re-read ledger state (in case a prior run partially completed)
  const currentLedger = JSON.parse(readFileSync(LEDGER_PATH, "utf8"));
  const currentEntry = currentLedger.entries.find((e) => e.source_url === entry.source_url);
  if (currentEntry?.status === "VERIFIED") {
    console.log(`${label} · SKIP · already VERIFIED`);
    return { entry, ok: true, skipped: "already_verified" };
  }

  // Step 1 · fresh HEAD (defends against corpus drift since Phase 3C)
  const head = await headWithTimeout(entry.source_url);
  if (head.status === 429) {
    rateLimitCounter.count++;
    await new Promise((r) => setTimeout(r, RATE_BACKOFF_MS));
    const retry = await headWithTimeout(entry.source_url);
    if (!retry.status || retry.status < 200 || retry.status >= 300) {
      console.log(`${label} · SKIP · rate-limited then ${retry.status || "network-err"}`);
      return { entry, ok: false, reason: `HEAD rate-limited then ${retry.status || retry.error}` };
    }
    Object.assign(head, retry);
  }
  if (!head.status || head.status < 200 || head.status >= 300) {
    console.log(`${label} · SKIP · HEAD ${head.status || "network-err"} ${head.error || ""}`);
    return { entry, ok: false, reason: `HEAD non-2xx: ${head.status}${head.error ? " · " + head.error : ""}` };
  }
  const headMime = head.mime;

  // Step 2 · GET binary
  let buf;
  try {
    const res = await fetch(entry.source_url, { redirect: "follow" });
    if (!res.ok) {
      console.log(`${label} · FAIL · GET ${res.status}`);
      return { entry, ok: false, reason: `GET non-2xx: ${res.status}` };
    }
    buf = await res.arrayBuffer();
  } catch (e) {
    console.log(`${label} · FAIL · GET threw ${e.message}`);
    return { entry, ok: false, reason: `GET threw: ${e.message}` };
  }
  const srcLen = buf.byteLength;
  const srcSha = sha256(buf);

  // Step 3 · upload with upsert:false (never silently overwrite)
  let uploadOutcome = "uploaded";
  try {
    const { error } = await sb.storage.from(BUCKET).upload(
      entry.destination_path,
      Buffer.from(buf),
      { contentType: headMime, upsert: false, cacheControl: "3600" },
    );
    if (error) {
      // If object already exists, proceed to verify-existing path
      if (/already exists|duplicate|resource already/i.test(error.message)) {
        uploadOutcome = "existing";
      } else {
        console.log(`${label} · FAIL · upload ${error.message}`);
        return { entry, ok: false, reason: `upload: ${error.message}`, srcLen, srcSha, headMime };
      }
    }
  } catch (e) {
    console.log(`${label} · FAIL · upload threw ${e.message}`);
    return { entry, ok: false, reason: `upload threw: ${e.message}`, srcLen, srcSha, headMime };
  }

  // Step 4 · retrieve via public URL · hash + size + MIME check
  const retrieveUrl = `${NEX_URL}/storage/v1/object/public/${BUCKET}/${encodeURI(entry.destination_path)}`;
  let retBuf, retLen, retSha, retMime;
  try {
    const r = await fetch(retrieveUrl);
    if (!r.ok) return { entry, ok: false, reason: `retrieve ${r.status}`, srcLen, srcSha, headMime, retrieveUrl };
    retBuf  = await r.arrayBuffer();
    retLen  = retBuf.byteLength;
    retSha  = sha256(retBuf);
    retMime = r.headers.get("content-type");
  } catch (e) {
    return { entry, ok: false, reason: `retrieve threw: ${e.message}`, srcLen, srcSha, headMime, retrieveUrl };
  }

  const shaOk  = srcSha === retSha;
  const sizeOk = srcLen === retLen;
  const mimeOk = (headMime || "").toLowerCase() === (retMime || "").toLowerCase()
                 || (/jpe?g/i.test(headMime) && /jpe?g/i.test(retMime));
  const verified = shaOk && sizeOk && mimeOk;
  const symbol = verified ? "✓" : "✗";
  console.log(`${label} · ${symbol} ${uploadOutcome} · ${srcLen}B · sha=${srcSha.slice(0, 10)}… · sha ${shaOk ? "✓" : "✗"} · size ${sizeOk ? "✓" : "✗"} · mime ${mimeOk ? "✓" : "✗"}`);

  return {
    entry, ok: verified,
    uploadOutcome, reason: verified ? "verified" : `mismatch (sha=${shaOk} size=${sizeOk} mime=${mimeOk})`,
    headMime, srcLen, srcSha, retLen, retSha, retMime, retrieveUrl,
  };
}

// ═══════════════════════════════════════════════════════════════════════
// CONCURRENCY POOL
// ═══════════════════════════════════════════════════════════════════════
async function runPool() {
  const results = new Array(candidates.length);
  const rateLimitCounter = { count: 0 };
  let cursor = 0;
  async function worker() {
    while (true) {
      const i = cursor++;
      if (i >= candidates.length) return;
      results[i] = await processOne(candidates[i], i, rateLimitCounter);
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  return { results, rateLimitCounter };
}

// ═══════════════════════════════════════════════════════════════════════
// LEDGER UPDATE + DUP DETECTION
// ═══════════════════════════════════════════════════════════════════════
function applyLedgerUpdates(results, ranAt) {
  // Re-load ledger to avoid stomping any concurrent update (defensive).
  const currentLedger = JSON.parse(readFileSync(LEDGER_PATH, "utf8"));
  const idxByUrl = new Map(currentLedger.entries.map((e, i) => [e.source_url, i]));
  for (const r of results) {
    if (r.skipped) continue;
    const idx = idxByUrl.get(r.entry.source_url);
    if (idx == null) continue;
    const e = currentLedger.entries[idx];
    e.http_status    = 200; // HEAD passed if we reached upload path
    if (r.headMime) e.content_type = r.headMime;
    if (r.srcLen)   e.content_length = r.srcLen;
    if (r.srcSha)   e.sha256 = r.srcSha;
    if (r.retrieveUrl) e.destination_url = r.retrieveUrl;
    if (r.ok) {
      e.status = "VERIFIED";
      const prior = e.notes ? e.notes + " | " : "";
      e.notes = `${prior}Phase 3D ${ranAt}: verified (upload ${r.uploadOutcome})`;
    } else {
      e.status = "FAILED";
      const prior = e.notes ? e.notes + " | " : "";
      e.notes = `${prior}Phase 3D ${ranAt}: ${r.reason}`;
    }
  }
  return currentLedger;
}

function detectDuplicates(results) {
  const byHash = new Map();
  // this batch
  for (const r of results) {
    if (!r.srcSha) continue;
    if (!byHash.has(r.srcSha)) byHash.set(r.srcSha, { in_this_batch: [], in_prior_verified: [] });
    byHash.get(r.srcSha).in_this_batch.push(r.entry.source_url);
  }
  // vs existing 10 VERIFIED
  for (const [hash, urls] of existingVerifiedHashes.entries()) {
    if (byHash.has(hash)) byHash.get(hash).in_prior_verified.push(...urls);
    else byHash.set(hash, { in_this_batch: [], in_prior_verified: urls });
  }
  const dupes = [];
  for (const [hash, groups] of byHash.entries()) {
    const total = groups.in_this_batch.length + groups.in_prior_verified.length;
    if (total > 1) dupes.push({ sha256: hash, in_this_batch: groups.in_this_batch, in_prior_verified: groups.in_prior_verified });
  }
  return dupes;
}

// ═══════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════
(async () => {
  const started = new Date();
  console.log(`\nStarted: ${started.toISOString()}\n`);
  const { results, rateLimitCounter } = await runPool();
  const finished = new Date();
  const ranAt = finished.toISOString();
  console.log(`\nFinished: ${ranAt} · elapsed ${Math.round((finished - started) / 1000)}s`);

  const updated = applyLedgerUpdates(results, ranAt);
  const dupes = detectDuplicates(results);

  updated.last_phase_3d_migration = {
    ran_at:              ranAt,
    hard_limit:          HARD_LIMIT,
    selected:            candidates.length,
    processed:           results.length,
    verified:            results.filter((r) => r.ok && !r.skipped).length,
    skipped_already_verified: results.filter((r) => r.skipped === "already_verified").length,
    failed:              results.filter((r) => !r.ok && !r.skipped).length,
    rate_limit_events:   rateLimitCounter.count,
    duplicates:          dupes,
    per_account: results.reduce((acc, r) => {
      const a = r.entry.imagekit_account;
      acc[a] ??= { total: 0, verified: 0, failed: 0, skipped: 0 };
      acc[a].total++;
      if (r.skipped) acc[a].skipped++;
      else if (r.ok) acc[a].verified++;
      else acc[a].failed++;
      return acc;
    }, {}),
  };

  // Ledger conservation check
  const totalBefore = ledger.entries.length;
  const totalAfter  = updated.entries.length;
  if (totalBefore !== totalAfter) {
    console.error(`LEDGER CONSERVATION FAILURE · before ${totalBefore} · after ${totalAfter}`);
    process.exit(1);
  }

  writeFileSync(LEDGER_PATH, JSON.stringify(updated, null, 2));

  const postCounts = { PENDING: 0, VERIFIED: 0, PROVENANCE_REVIEW_REQUIRED: 0, BROKEN: 0, MIGRATION_BLOCKED_MAIN: 0, FAILED: 0 };
  for (const e of updated.entries) postCounts[e.status] = (postCounts[e.status] || 0) + 1;

  console.log("\n═══════════════════════════════════════════════════════════");
  console.log(` Phase 3D complete`);
  console.log(`   Selected:  ${candidates.length}`);
  console.log(`   VERIFIED:  ${updated.last_phase_3d_migration.verified}`);
  console.log(`   FAILED:    ${updated.last_phase_3d_migration.failed}`);
  console.log(`   SKIPPED:   ${updated.last_phase_3d_migration.skipped_already_verified}`);
  console.log(`   Duplicates:${dupes.length}`);
  console.log(`   Rate-limits:${rateLimitCounter.count}`);
  console.log(`   Elapsed:   ${Math.round((finished - started) / 1000)}s`);
  console.log("");
  console.log(" Full-ledger status after:");
  for (const [k, v] of Object.entries(postCounts)) if (v > 0) console.log(`   ${k}: ${v}`);
  console.log("═══════════════════════════════════════════════════════════");
})();
