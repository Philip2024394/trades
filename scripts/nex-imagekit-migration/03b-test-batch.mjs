// NEX ImageKit → Supabase migration · Phase 3B · CONTROLLED TEST BATCH.
// Philip 2026-09-02 · authorised · MAX 10 IMAGES.
//
// ═══════════════════════════════════════════════════════════════════════
// HARD SCOPE · this script is authorised to migrate AT MOST 10 images.
// ═══════════════════════════════════════════════════════════════════════
//
// Selection rules (from authorisation):
//   · Only from ledger entries with status = PENDING
//   · Only OWNED_LIKELY_AI_GENERATED or OWNED_LIKELY_UPLOAD provenance
//   · Fresh HEAD before download · reject any non-2xx
//   · Spread across at least 2 ImageKit accounts if possible
//   · Never touch UNKNOWN / PROVENANCE_REVIEW_REQUIRED
//   · Never touch BROKEN
//   · Never touch MIGRATION_BLOCKED_MAIN (127 MAIN URLs)
//
// Per-image pipeline:
//   1. HEAD source URL · verify 2xx
//   2. GET binary · verify successful download
//   3. SHA-256(source binary)
//   4. Upload to nex-media/<destination_path> with contentType from HEAD
//   5. Retrieve via public URL · fetch back the binary
//   6. SHA-256(retrieved binary)
//   7. Compare · byte length + SHA-256 + content-type
//   8. Update ledger entry: status = VERIFIED (or FAILED with reason)
//
// MUST NOT:
//   · Exceed 10 uploads (hard cap enforced at line ~40)
//   · Migrate UNKNOWN / BROKEN / MAIN entries
//   · Modify any file other than the ledger (data/nex-imagekit-migration-ledger.json)
//   · Modify any existing NEX manifest / source code / DB row
//   · Delete anything from ImageKit
//   · Delete anything from Supabase (no storage.remove calls anywhere)
//   · Rewrite production URLs / cutover the application
//   · Touch the frozen NEX shell/frame

import { createClient } from "@supabase/supabase-js";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createHash } from "node:crypto";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot  = join(__dirname, "..", "..");

// ═══════════════════════════════════════════════════════════════════════
// HARD LIMITS (constants · not overridable via CLI)
// ═══════════════════════════════════════════════════════════════════════
const HARD_LIMIT_IMAGES = 10;
const BUCKET            = "nex-media";
const ALLOWED_ACCOUNTS  = new Set(["5vv5pw26q", "9mrgsv2rp", "nepgaxllc"]);
const ALLOWED_PROVENANCE = new Set(["OWNED_LIKELY_AI_GENERATED", "OWNED_LIKELY_UPLOAD"]);

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

// Safety guard · refuse to run against MAIN.
if (!NEX_URL || !NEX_URL.includes("ijvqdvsvwtwxzcqmoqit")) {
  console.error(`REFUSING to run · NEX_URL missing or not NEX project · saw ${NEX_URL}`);
  process.exit(1);
}
if (!NEX_KEY) { console.error("Missing NEX_SUPABASE_SERVICE_ROLE_KEY"); process.exit(1); }

const sb = createClient(NEX_URL, NEX_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const LEDGER_PATH = join(repoRoot, "data/nex-imagekit-migration-ledger.json");
if (!existsSync(LEDGER_PATH)) { console.error(`Ledger not found: ${LEDGER_PATH}`); process.exit(1); }

console.log("═══════════════════════════════════════════════════════════");
console.log(" NEX ImageKit → Supabase · Phase 3B · TEST BATCH (max 10)");
console.log("═══════════════════════════════════════════════════════════");
console.log(` Target: ${NEX_URL}\n Bucket: ${BUCKET}\n Hard limit: ${HARD_LIMIT_IMAGES} images\n`);

// ═══════════════════════════════════════════════════════════════════════
// SELECTION · pick up to 10 candidates spread across accounts
// ═══════════════════════════════════════════════════════════════════════

function selectCandidates(ledger) {
  const eligible = ledger.entries.filter((e) =>
    e.status === "PENDING"
    && ALLOWED_PROVENANCE.has(e.provenance)
    && ALLOWED_ACCOUNTS.has(e.imagekit_account)
    && e.destination_path,
  );
  // Distribution target: 4 from 5vv5pw26q, 4 from 9mrgsv2rp, 2 from nepgaxllc
  const target = { "5vv5pw26q": 4, "9mrgsv2rp": 4, "nepgaxllc": 2 };
  const picked = [];
  const buckets = { "5vv5pw26q": [], "9mrgsv2rp": [], "nepgaxllc": [] };
  for (const e of eligible) buckets[e.imagekit_account].push(e);

  for (const acc of Object.keys(target)) {
    for (let i = 0; i < target[acc] && i < buckets[acc].length; i++) {
      picked.push(buckets[acc][i]);
    }
  }
  // Backfill from any account if we're short (e.g. nepgaxllc only has 13 PENDING)
  while (picked.length < HARD_LIMIT_IMAGES) {
    let backfilled = false;
    for (const acc of Object.keys(buckets)) {
      const alreadyPicked = picked.filter((p) => p.imagekit_account === acc).length;
      if (buckets[acc][alreadyPicked]) {
        picked.push(buckets[acc][alreadyPicked]);
        backfilled = true;
        if (picked.length >= HARD_LIMIT_IMAGES) break;
      }
    }
    if (!backfilled) break;
  }
  if (picked.length > HARD_LIMIT_IMAGES) picked.length = HARD_LIMIT_IMAGES;
  return picked;
}

// ═══════════════════════════════════════════════════════════════════════
// PER-IMAGE PIPELINE
// ═══════════════════════════════════════════════════════════════════════

function sha256(buffer) {
  return createHash("sha256").update(Buffer.from(buffer)).digest("hex");
}

async function processOne(entry, index) {
  const label = `[${index + 1}/${HARD_LIMIT_IMAGES}] ${entry.imagekit_account}/${(entry.source_path || "").slice(-40)}`;
  console.log(`\n${label}`);

  // Step 1 · fresh HEAD
  let headStatus, headMime, headLen;
  try {
    const head = await fetch(entry.source_url, { method: "HEAD", redirect: "follow" });
    headStatus = head.status;
    headMime   = head.headers.get("content-type");
    headLen    = Number(head.headers.get("content-length")) || null;
    if (!head.ok) {
      return { entry, ok: false, reason: `HEAD non-2xx: ${headStatus}`, headStatus, headMime, headLen };
    }
    console.log(`  HEAD  ${headStatus}  ${headMime}  ${headLen ?? "?"}B`);
  } catch (e) {
    return { entry, ok: false, reason: `HEAD threw: ${e.message}` };
  }

  // Step 2 · download binary
  let sourceBuffer, sourceLen, sourceSha;
  try {
    const res = await fetch(entry.source_url, { redirect: "follow" });
    if (!res.ok) return { entry, ok: false, reason: `GET non-2xx: ${res.status}`, headStatus, headMime, headLen };
    sourceBuffer = await res.arrayBuffer();
    sourceLen    = sourceBuffer.byteLength;
    sourceSha    = sha256(sourceBuffer);
    console.log(`  GET   ${res.status}  ${sourceLen}B  sha256=${sourceSha.slice(0, 12)}…`);
    if (headLen && headLen !== sourceLen) {
      console.log(`  ⚠  HEAD Content-Length (${headLen}) != actual body (${sourceLen})`);
    }
  } catch (e) {
    return { entry, ok: false, reason: `GET threw: ${e.message}`, headStatus, headMime, headLen };
  }

  // Step 3 · upload to Supabase (service role · upsert:false so we never
  // silently overwrite an existing object with different content)
  try {
    const { error } = await sb.storage.from(BUCKET).upload(
      entry.destination_path,
      Buffer.from(sourceBuffer),
      { contentType: headMime, upsert: false, cacheControl: "3600" },
    );
    if (error) {
      // If the object already exists at that path with the same SHA-256
      // treat as idempotent success (test re-runs are safe). Otherwise fail.
      if (/already exists|duplicate/i.test(error.message)) {
        console.log(`  UPLD  already exists at path · verifying identity below`);
      } else {
        return { entry, ok: false, reason: `upload: ${error.message}`, headStatus, headMime, headLen, sourceLen, sourceSha };
      }
    } else {
      console.log(`  UPLD  ok`);
    }
  } catch (e) {
    return { entry, ok: false, reason: `upload threw: ${e.message}`, headStatus, headMime, headLen, sourceLen, sourceSha };
  }

  // Step 4 · retrieve back via public URL (end-to-end verification incl. CDN)
  let retrieveBuffer, retrieveLen, retrieveSha, retrieveMime, retrieveUrl;
  try {
    retrieveUrl = `${NEX_URL}/storage/v1/object/public/${BUCKET}/${encodeURI(entry.destination_path)}`;
    const res = await fetch(retrieveUrl);
    if (!res.ok) return { entry, ok: false, reason: `retrieve non-2xx: ${res.status}`, headStatus, headMime, headLen, sourceLen, sourceSha, retrieveUrl };
    retrieveBuffer = await res.arrayBuffer();
    retrieveLen    = retrieveBuffer.byteLength;
    retrieveSha    = sha256(retrieveBuffer);
    retrieveMime   = res.headers.get("content-type");
    console.log(`  RETR  ${res.status}  ${retrieveLen}B  sha256=${retrieveSha.slice(0, 12)}…  ct=${retrieveMime}`);
  } catch (e) {
    return { entry, ok: false, reason: `retrieve threw: ${e.message}`, headStatus, headMime, headLen, sourceLen, sourceSha, retrieveUrl };
  }

  // Step 5 · byte-for-byte + SHA-256 + Content-Type comparison
  const shaMatch  = sourceSha === retrieveSha;
  const sizeMatch = sourceLen === retrieveLen;
  const mimeMatch = (headMime || "").toLowerCase() === (retrieveMime || "").toLowerCase()
                    // Supabase sometimes normalises image/jpg → image/jpeg — treat as equivalent
                    || ((/jpeg|jpg/i.test(headMime) && /jpeg|jpg/i.test(retrieveMime)));
  const verified = shaMatch && sizeMatch && mimeMatch;

  console.log(`  CHECK sha=${shaMatch ? "✓" : "✗"}  size=${sizeMatch ? "✓" : "✗"}  mime=${mimeMatch ? "✓" : "✗"}  ${verified ? "VERIFIED" : "FAILED"}`);
  return {
    entry,
    ok: verified,
    reason: verified ? "verified" : `mismatch (sha=${shaMatch} size=${sizeMatch} mime=${mimeMatch})`,
    headStatus, headMime, headLen,
    sourceLen, sourceSha,
    retrieveLen, retrieveSha, retrieveMime, retrieveUrl,
  };
}

// ═══════════════════════════════════════════════════════════════════════
// LEDGER UPDATE · only for the 10 test entries
// ═══════════════════════════════════════════════════════════════════════

function applyLedgerUpdates(ledger, results) {
  const urlToIndex = new Map();
  ledger.entries.forEach((e, i) => urlToIndex.set(e.source_url, i));
  const now = new Date().toISOString();
  for (const r of results) {
    const idx = urlToIndex.get(r.entry.source_url);
    if (idx == null) continue;
    ledger.entries[idx] = {
      ...ledger.entries[idx],
      http_status:    r.headStatus     ?? ledger.entries[idx].http_status,
      content_type:   r.headMime       ?? ledger.entries[idx].content_type,
      content_length: r.sourceLen      ?? ledger.entries[idx].content_length,
      sha256:         r.sourceSha      ?? ledger.entries[idx].sha256,
      destination_url:r.retrieveUrl    ?? ledger.entries[idx].destination_url,
      status:         r.ok ? "VERIFIED" : "FAILED",
      notes:          `test-batch ${now}: ${r.reason}`,
    };
  }
  return ledger;
}

// ═══════════════════════════════════════════════════════════════════════
// DUPLICATE DETECTION (across the 10 test images)
// ═══════════════════════════════════════════════════════════════════════

function detectDuplicates(results) {
  const byHash = new Map();
  for (const r of results) {
    if (!r.sourceSha) continue;
    if (!byHash.has(r.sourceSha)) byHash.set(r.sourceSha, []);
    byHash.get(r.sourceSha).push(r.entry.source_url);
  }
  const dupes = [];
  for (const [hash, urls] of byHash.entries()) {
    if (urls.length > 1) dupes.push({ sha256: hash, source_urls: urls });
  }
  return dupes;
}

// ═══════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════

(async () => {
  const ledger = JSON.parse(readFileSync(LEDGER_PATH, "utf8"));
  const candidates = selectCandidates(ledger);
  console.log(`Selected ${candidates.length} candidate(s):`);
  candidates.forEach((c, i) => console.log(`  ${i + 1}. ${c.imagekit_account} · ${c.provenance} · ${(c.source_path || "").slice(-60)}`));
  if (candidates.length === 0) {
    console.error("No candidates matched selection criteria · aborting");
    process.exit(1);
  }
  if (candidates.length > HARD_LIMIT_IMAGES) {
    console.error(`Selection produced ${candidates.length} · hard limit is ${HARD_LIMIT_IMAGES} · aborting`);
    process.exit(1);
  }

  // Run pipeline serially · fail-forward · don't stop on one failure
  const results = [];
  for (let i = 0; i < candidates.length; i++) {
    results.push(await processOne(candidates[i], i));
  }

  // Duplicate detection
  const dupes = detectDuplicates(results);

  // Apply ledger updates
  applyLedgerUpdates(ledger, results);
  ledger.last_test_batch = {
    ran_at:      new Date().toISOString(),
    tested:      results.length,
    verified:    results.filter((r) => r.ok).length,
    failed:      results.filter((r) => !r.ok).length,
    duplicates:  dupes,
    per_account: results.reduce((acc, r) => { const a = r.entry.imagekit_account; acc[a] ??= { total: 0, verified: 0, failed: 0 }; acc[a].total++; if (r.ok) acc[a].verified++; else acc[a].failed++; return acc; }, {}),
  };
  writeFileSync(LEDGER_PATH, JSON.stringify(ledger, null, 2));

  console.log(`\n═══════════════════════════════════════════════════════════`);
  console.log(` Test batch complete · ${results.filter((r) => r.ok).length}/${results.length} VERIFIED`);
  console.log(` Ledger updated: ${LEDGER_PATH}`);
  if (dupes.length > 0) {
    console.log(` Duplicate SHA-256 detected (${dupes.length}):`);
    dupes.forEach((d) => console.log(`  ${d.sha256.slice(0, 12)}… · ${d.source_urls.length} URLs`));
  } else {
    console.log(` No duplicate SHA-256s among the ${results.length} tested images.`);
  }
  console.log(`═══════════════════════════════════════════════════════════`);
})();
