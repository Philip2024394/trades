// NEX ImageKit → Supabase migration · Phase 3E · 100-image bulk migration.
// Philip 2026-09-02 · BUILD ONLY · DO NOT EXECUTE without explicit authorisation.
//
// ═══════════════════════════════════════════════════════════════════════
// HARD SCOPE
// ═══════════════════════════════════════════════════════════════════════
//
// Migrates AT MOST 100 additional images from ImageKit → nex-media on
// the NEX Supabase project, subject to:
//
//   · HARD_LIMIT_IMAGES is a top-level `const` · not env-overridable ·
//     not CLI-overridable · not runtime-configurable.
//
//   · Candidate selection goes through pipeline-utils.mjs · selectDealiased:
//       - Only PENDING · owned provenance · REACHABLE · ImageKit source URL
//       - At most ONE candidate per destination_path (de-alias)
//       - Groups where any sibling entry is already VERIFIED are excluded
//       - Existing 60+ VERIFIED entries can never be selected
//         (selectDealiased filters strictly to status === "PENDING")
//
//   · Uploads go through pipeline-utils.mjs · uploadWithDetail:
//       - upsert:false enforced inside the helper (grep-verified)
//       - Rich structured error detail on any non-"already-exists" failure
//       - "already exists" outcome falls through to retrieve+verify path
//
//   · Per-image pipeline · resumable · defensive:
//       HEAD → GET → SHA-256(src) → upload → retrieve → SHA-256(retrieved)
//       → verify size, SHA, MIME → only then mark VERIFIED
//
//   · Existing-object safety · CRITICAL:
//       When upload returns "already exists", the pipeline STILL retrieves
//       the destination object and verifies SHA + size + MIME against the
//       source binary before marking VERIFIED. An unrelated object at the
//       same path CANNOT be silently promoted to VERIFIED (SHA mismatch
//       would leave the entry PENDING with a MISMATCH note for review).
//
//   · Failure semantics:
//       - Confirmed 404 (HEAD or GET)                → status: BROKEN
//       - SHA/size/MIME mismatch on retrieve         → status: PENDING + MISMATCH note (review)
//       - Transient failure (network, 5xx, timeout, non-"exists" upload err)
//                                                     → status: PENDING + TRANSIENT note (retryable)
//       - Full pipeline pass                          → status: VERIFIED
//
//   · Duplicate detection (report only · never merge · never delete):
//       - Within this batch (SHA-256 across selected candidates)
//       - Against all existing VERIFIED SHA-256 in the wider corpus
//
// ═══════════════════════════════════════════════════════════════════════
// FORBIDDEN OPERATIONS (grep-audited before authorisation)
// ═══════════════════════════════════════════════════════════════════════
//   · upsert:true                                           (grep 0)
//   · sb.from(...)             — DB writes                  (grep 0)
//   · storage.remove/move/copy/emptyBucket                  (grep 0)
//   · createBucket/deleteBucket/updateBucket                (grep 0)
//   · ImageKit POST/PUT/PATCH/DELETE                        (grep 0)
//   · src/**, data/nex-*.json manifests, frame/shell/PWA    (0 edits)

import { createClient } from "@supabase/supabase-js";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createHash } from "node:crypto";
import { selectDealiased, uploadWithDetail } from "./pipeline-utils.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const repoRoot   = join(__dirname, "..", "..");

// ═══════════════════════════════════════════════════════════════════════
// HARD LIMITS · CONSTANTS · NOT OVERRIDABLE
// ═══════════════════════════════════════════════════════════════════════
const HARD_LIMIT_IMAGES  = 100;                                   // ← audited: exactly 100
const BUCKET             = "nex-media";
const CONCURRENCY        = 6;                                      // in Philip's 5-10 range
const HEAD_TIMEOUT_MS    = 15_000;
const RATE_BACKOFF_MS    = 5_000;
const DIST_TARGET        = { "5vv5pw26q": 45, "9mrgsv2rp": 45, "nepgaxllc": 10 };
// NB: no env / argv / config lookup for HARD_LIMIT_IMAGES anywhere in this file.

// ─── Env / NEX-only project guard ─────────────────────────────────────
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

// ═══════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════
const sha256 = (buf) => createHash("sha256").update(Buffer.from(buf)).digest("hex");

const mimeEquiv = (a, b) => {
  const la = (a || "").toLowerCase();
  const lb = (b || "").toLowerCase();
  if (la === lb) return true;
  if (/jpe?g/i.test(la) && /jpe?g/i.test(lb)) return true;
  return false;
};

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

// ═══════════════════════════════════════════════════════════════════════
// PER-IMAGE PIPELINE (resumable · defensive · returns granular failure kind)
// ═══════════════════════════════════════════════════════════════════════
//
// Return shape (only the fields relevant to each outcome are populated):
//   { entry, ok: true,  skipped: "already_verified" }                        ← resumability skip
//   { entry, ok: true,  uploadOutcome, headMime, srcLen, srcSha,
//                       retLen, retSha, retMime, retrieveUrl }                ← full pass
//   { entry, ok: false, is404: true, reason }                                 ← BROKEN
//   { entry, ok: false, mismatch: true, reason, ...verificationFields }      ← MISMATCH (PENDING)
//   { entry, ok: false, transient: true, reason, [upload_error_detail] }     ← transient (PENDING)
async function processOne(entry, calls, rateLimitCounter) {
  const shortLabel = `${entry.imagekit_account}/${(entry.source_path || "").slice(-40)}`;

  // ── 1 · Resumability check · re-read ledger from disk each time ──────
  //    If ledger already says VERIFIED, return SKIP immediately with
  //    ZERO HEAD / GET / upload / retrieve calls.
  const currentLedger = JSON.parse(readFileSync(LEDGER_PATH, "utf8"));
  const currentEntry  = currentLedger.entries.find((e) => e.source_url === entry.source_url);
  if (currentEntry?.status === "VERIFIED") {
    return { entry, ok: true, skipped: "already_verified" };
  }

  // ── 2 · HEAD (transient / 429 / 404 semantics) ───────────────────────
  calls.head++;
  let head = await headWithTimeout(entry.source_url);
  if (head.status === 429) {
    rateLimitCounter.count++;
    await new Promise((r) => setTimeout(r, RATE_BACKOFF_MS));
    const retry = await headWithTimeout(entry.source_url);
    if (!retry.status || retry.status < 200 || retry.status >= 300) {
      const is404 = retry.status === 404;
      return {
        entry, ok: false,
        ...(is404 ? { is404: true } : { transient: true }),
        reason: `HEAD rate-limited then ${retry.status || retry.error || "network"}`,
      };
    }
    head = retry;
  }
  if (head.status === 404) return { entry, ok: false, is404: true, reason: `HEAD 404` };
  if (!head.status || head.status < 200 || head.status >= 300) {
    return { entry, ok: false, transient: true, reason: `HEAD non-2xx: ${head.status}${head.error ? " · " + head.error : ""}` };
  }
  const headMime = head.mime;

  // ── 3 · GET (transient / 404 semantics · preserve original binary) ───
  calls.get++;
  let buf;
  try {
    const res = await fetch(entry.source_url, { redirect: "follow" });
    if (res.status === 404) return { entry, ok: false, is404: true, reason: `GET 404`, headMime };
    if (!res.ok)            return { entry, ok: false, transient: true, reason: `GET non-2xx: ${res.status}`, headMime };
    buf = await res.arrayBuffer();
  } catch (e) {
    return { entry, ok: false, transient: true, reason: `GET threw: ${e.message}`, headMime };
  }
  const srcLen = buf.byteLength;
  const srcSha = sha256(buf);

  // ── 4 · Upload via pipeline-utils.uploadWithDetail (upsert:false) ────
  //    uploadOutcome ∈ { "uploaded", "existing", "failed", "threw" }
  //    "existing" is NOT treated as VERIFIED · falls through to retrieve
  //    step which recomputes SHA against source binary before verifying.
  calls.upload++;
  const uploadResult = await uploadWithDetail(sb, {
    bucket:           BUCKET,
    destination_path: entry.destination_path,
    body:             Buffer.from(buf),
    content_type:     headMime,
    source_url:       entry.source_url,
    attempt:          1,
  });
  if (!uploadResult.ok) {
    return {
      entry, ok: false, transient: true,
      reason: `upload ${uploadResult.uploadOutcome}`,
      upload_error_detail: uploadResult.error_detail,   // ← rich Fix 2 capture
      headMime, srcLen, srcSha,
    };
  }
  const uploadOutcome = uploadResult.uploadOutcome;      // "uploaded" | "existing"

  // ── 5 · Retrieve + verify (ALWAYS · uploadOutcome-agnostic) ──────────
  //    This step runs regardless of whether we just uploaded fresh or
  //    encountered an existing object. Never mark VERIFIED without SHA
  //    + size + MIME match against the source binary we just downloaded.
  calls.retrieve++;
  const retrieveUrl = `${NEX_URL}/storage/v1/object/public/${BUCKET}/${encodeURI(entry.destination_path)}`;
  let retLen, retSha, retMime;
  try {
    const r = await fetch(retrieveUrl);
    if (!r.ok) {
      return { entry, ok: false, transient: true, reason: `retrieve ${r.status}`, headMime, srcLen, srcSha, retrieveUrl, uploadOutcome };
    }
    const retBuf = await r.arrayBuffer();
    retLen  = retBuf.byteLength;
    retSha  = sha256(retBuf);
    retMime = r.headers.get("content-type");
  } catch (e) {
    return { entry, ok: false, transient: true, reason: `retrieve threw: ${e.message}`, headMime, srcLen, srcSha, retrieveUrl, uploadOutcome };
  }

  const shaOk  = srcSha === retSha;
  const sizeOk = srcLen === retLen;
  const mimeOk = mimeEquiv(headMime, retMime);
  const verified = shaOk && sizeOk && mimeOk;

  if (!verified) {
    return {
      entry, ok: false, mismatch: true,
      reason: `mismatch (sha=${shaOk} size=${sizeOk} mime=${mimeOk})${uploadOutcome === "existing" ? " · destination pre-existed with different content" : ""}`,
      uploadOutcome, headMime, srcLen, srcSha, retLen, retSha, retMime, retrieveUrl,
    };
  }

  return {
    entry, ok: true,
    uploadOutcome, headMime, srcLen, srcSha, retLen, retSha, retMime, retrieveUrl,
  };
}

// ═══════════════════════════════════════════════════════════════════════
// CONCURRENCY POOL
// ═══════════════════════════════════════════════════════════════════════
async function runPool(candidates) {
  const results = new Array(candidates.length);
  const rateLimitCounter = { count: 0 };
  const perImageCalls    = new Array(candidates.length);
  let cursor = 0;
  async function worker() {
    while (true) {
      const i = cursor++;
      if (i >= candidates.length) return;
      const calls = { head: 0, get: 0, upload: 0, retrieve: 0 };
      perImageCalls[i] = calls;
      results[i] = await processOne(candidates[i], calls, rateLimitCounter);
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  return { results, rateLimitCounter, perImageCalls };
}

// ═══════════════════════════════════════════════════════════════════════
// LEDGER UPDATE (granular status handling · never silent state changes)
// ═══════════════════════════════════════════════════════════════════════
function applyLedgerUpdates(results, ranAt) {
  const ledger = JSON.parse(readFileSync(LEDGER_PATH, "utf8"));
  const totalBefore = ledger.entries.length;
  const idxByUrl = new Map(ledger.entries.map((e, i) => [e.source_url, i]));
  for (const r of results) {
    if (r.skipped) continue;
    const idx = idxByUrl.get(r.entry.source_url);
    if (idx == null) continue;
    const e = ledger.entries[idx];
    if (r.headMime)    e.content_type   = r.headMime;
    if (r.srcLen)      e.content_length = r.srcLen;
    if (r.srcSha)      e.sha256         = r.srcSha;
    if (r.retrieveUrl) e.destination_url = r.retrieveUrl;
    const priorNotes = e.notes ? e.notes + " | " : "";
    if (r.ok) {
      e.http_status = 200;
      e.status      = "VERIFIED";
      e.notes       = `${priorNotes}Phase 3E ${ranAt}: verified (${r.uploadOutcome})`;
    } else if (r.is404) {
      e.status      = "BROKEN";
      e.notes       = `${priorNotes}Phase 3E ${ranAt}: BROKEN ${r.reason}`;
    } else if (r.mismatch) {
      // PENDING preserved · retain MISMATCH note for review · no VERIFIED
      e.notes       = `${priorNotes}Phase 3E ${ranAt}: MISMATCH (retained PENDING) ${r.reason} · srcSha=${r.srcSha?.slice(0,10)}… retSha=${r.retSha?.slice(0,10)}…`;
    } else if (r.transient) {
      // PENDING preserved · retain TRANSIENT note for retry · no VERIFIED
      let note = `${priorNotes}Phase 3E ${ranAt}: TRANSIENT (retained PENDING) ${r.reason}`;
      if (r.upload_error_detail) note += ` · upload_error=${JSON.stringify(r.upload_error_detail)}`;
      e.notes = note;
    }
  }
  if (ledger.entries.length !== totalBefore) {
    throw new Error(`LEDGER CONSERVATION FAILURE · before ${totalBefore} · after ${ledger.entries.length}`);
  }
  return ledger;
}

// ═══════════════════════════════════════════════════════════════════════
// DUPLICATE DETECTION (report only · never merge / delete / overwrite)
// ═══════════════════════════════════════════════════════════════════════
function detectDuplicates(results, existingVerifiedHashes) {
  const byHash = new Map();
  for (const r of results) {
    if (!r.srcSha) continue;
    if (!byHash.has(r.srcSha)) byHash.set(r.srcSha, { in_this_batch: [], in_prior_verified: [] });
    byHash.get(r.srcSha).in_this_batch.push(r.entry.source_url);
  }
  for (const [hash, urls] of existingVerifiedHashes.entries()) {
    if (byHash.has(hash)) byHash.get(hash).in_prior_verified.push(...urls);
    else byHash.set(hash, { in_this_batch: [], in_prior_verified: urls });
  }
  const dupes = [];
  for (const [hash, groups] of byHash.entries()) {
    const total = groups.in_this_batch.length + groups.in_prior_verified.length;
    if (total > 1 && groups.in_this_batch.length > 0) {
      dupes.push({ sha256: hash, in_this_batch: groups.in_this_batch, in_prior_verified: groups.in_prior_verified });
    }
  }
  return dupes;
}

// ═══════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════
(async () => {
  console.log("═══════════════════════════════════════════════════════════");
  console.log(" NEX ImageKit → Supabase · Phase 3E · 100-image bulk");
  console.log("═══════════════════════════════════════════════════════════");
  console.log(` Target:      ${NEX_URL}`);
  console.log(` Bucket:      ${BUCKET}`);
  console.log(` Hard limit:  ${HARD_LIMIT_IMAGES} (constant · not overridable)`);
  console.log(` Concurrency: ${CONCURRENCY}`);
  console.log("");

  const startedAt = new Date();
  const ledger    = JSON.parse(readFileSync(LEDGER_PATH, "utf8"));
  const totalEntriesAtStart = ledger.entries.length;

  // ── Existing VERIFIED SHA-256 (for corpus-wide duplicate detection) ──
  const existingVerifiedHashes = new Map();
  for (const e of ledger.entries) {
    if (e.status === "VERIFIED" && e.sha256) {
      if (!existingVerifiedHashes.has(e.sha256)) existingVerifiedHashes.set(e.sha256, []);
      existingVerifiedHashes.get(e.sha256).push(e.source_url);
    }
  }
  console.log(`Existing corpus-wide VERIFIED sha256 count: ${existingVerifiedHashes.size}`);

  // ── De-aliased selection via pipeline-utils.mjs · selectDealiased ────
  const sel = selectDealiased(ledger, {
    hardLimit: HARD_LIMIT_IMAGES,
    distribution: DIST_TARGET,
  });
  const candidates = sel.candidates;
  if (candidates.length === 0) { console.error("No eligible candidates · aborting"); process.exit(1); }
  if (candidates.length > HARD_LIMIT_IMAGES) { console.error(`Selection exceeded hard limit · aborting`); process.exit(1); }

  const distCheck = candidates.reduce((acc, c) => { acc[c.imagekit_account] = (acc[c.imagekit_account] || 0) + 1; return acc; }, {});
  const provCheck = candidates.reduce((acc, c) => { acc[c.provenance]        = (acc[c.provenance]        || 0) + 1; return acc; }, {});
  const mimeCheck = candidates.reduce((acc, c) => { const m = c.content_type || "unknown"; acc[m] = (acc[m] || 0) + 1; return acc; }, {});
  console.log(`\nSelected ${candidates.length} candidate(s):`);
  console.log(`  Distribution:  ${JSON.stringify(distCheck)}`);
  console.log(`  Provenance:    ${JSON.stringify(provCheck)}`);
  console.log(`  Reported MIME: ${JSON.stringify(mimeCheck)}`);
  console.log(`  De-alias:      eligible=${sel.eligible_before} pool=${sel.candidate_pool} skipped_aliases=${sel.skipped_aliases.length} (alias-of-selected=${sel.groups_skipped_alias_of_selected} dest-already-verified=${sel.groups_skipped_destination_verified})`);

  console.log(`\nStarted: ${startedAt.toISOString()}\n`);
  const { results, rateLimitCounter, perImageCalls } = await runPool(candidates);
  const finished = new Date();
  const ranAt = finished.toISOString();
  console.log(`\nFinished: ${ranAt} · elapsed ${Math.round((finished - startedAt) / 1000)}s`);

  // Log per-image outcomes
  results.forEach((r, i) => {
    const c = perImageCalls[i];
    const label = `[${String(i + 1).padStart(3, "0")}] ${r.entry.imagekit_account}/${(r.entry.source_path || "").slice(-40)}`;
    if (r.skipped) return console.log(`${label} · SKIP ${r.skipped} · HEAD=${c.head} GET=${c.get} UPLOAD=${c.upload} RETRIEVE=${c.retrieve}`);
    if (r.ok)     return console.log(`${label} · ✓ VERIFIED (${r.uploadOutcome}) · ${r.srcLen}B · sha=${r.srcSha.slice(0, 10)}…`);
    if (r.is404)   return console.log(`${label} · ✗ BROKEN · ${r.reason}`);
    if (r.mismatch) return console.log(`${label} · ✗ MISMATCH · ${r.reason}`);
    if (r.transient) return console.log(`${label} · ✗ TRANSIENT · ${r.reason}${r.upload_error_detail ? " · " + JSON.stringify(r.upload_error_detail) : ""}`);
    console.log(`${label} · ✗ UNKNOWN · ${JSON.stringify(r)}`);
  });

  const updated = applyLedgerUpdates(results, ranAt);
  const dupes   = detectDuplicates(results, existingVerifiedHashes);

  updated.last_phase_3e_migration = {
    ran_at:                    ranAt,
    started_at:                startedAt.toISOString(),
    hard_limit:                HARD_LIMIT_IMAGES,
    selected:                  candidates.length,
    processed:                 results.length,
    verified:                  results.filter((r) => r.ok && !r.skipped).length,
    skipped_already_verified:  results.filter((r) => r.skipped === "already_verified").length,
    broken_404:                results.filter((r) => r.is404).length,
    mismatch_retained_pending: results.filter((r) => r.mismatch).length,
    transient_retained_pending: results.filter((r) => r.transient).length,
    rate_limit_events:         rateLimitCounter.count,
    duplicates:                dupes,
    de_alias_selection:        {
      eligible_before:                     sel.eligible_before,
      candidate_pool:                      sel.candidate_pool,
      groups_skipped_alias_of_selected:    sel.groups_skipped_alias_of_selected,
      groups_skipped_destination_verified: sel.groups_skipped_destination_verified,
      skipped_aliases_count:               sel.skipped_aliases.length,
    },
    per_account: results.reduce((acc, r) => {
      const a = r.entry.imagekit_account;
      acc[a] ??= { total: 0, verified: 0, broken: 0, mismatch: 0, transient: 0, skipped: 0 };
      acc[a].total++;
      if (r.skipped)        acc[a].skipped++;
      else if (r.ok)        acc[a].verified++;
      else if (r.is404)     acc[a].broken++;
      else if (r.mismatch)  acc[a].mismatch++;
      else if (r.transient) acc[a].transient++;
      return acc;
    }, {}),
  };

  // Final ledger conservation check
  if (updated.entries.length !== totalEntriesAtStart) {
    console.error(`LEDGER CONSERVATION FAILURE · before ${totalEntriesAtStart} · after ${updated.entries.length}`);
    process.exit(1);
  }
  writeFileSync(LEDGER_PATH, JSON.stringify(updated, null, 2));

  const postCounts = { PENDING: 0, VERIFIED: 0, PROVENANCE_REVIEW_REQUIRED: 0, BROKEN: 0, MIGRATION_BLOCKED_MAIN: 0, FAILED: 0 };
  for (const e of updated.entries) postCounts[e.status] = (postCounts[e.status] || 0) + 1;

  console.log("\n═══════════════════════════════════════════════════════════");
  console.log(` Phase 3E complete`);
  console.log(`   Selected:                     ${candidates.length}`);
  console.log(`   VERIFIED:                     ${updated.last_phase_3e_migration.verified}`);
  console.log(`   BROKEN (404):                 ${updated.last_phase_3e_migration.broken_404}`);
  console.log(`   MISMATCH (kept PENDING):      ${updated.last_phase_3e_migration.mismatch_retained_pending}`);
  console.log(`   TRANSIENT (kept PENDING):     ${updated.last_phase_3e_migration.transient_retained_pending}`);
  console.log(`   SKIPPED (already VERIFIED):   ${updated.last_phase_3e_migration.skipped_already_verified}`);
  console.log(`   Duplicates:                   ${dupes.length}`);
  console.log(`   Rate-limit events:            ${rateLimitCounter.count}`);
  console.log(`   Elapsed:                      ${Math.round((finished - startedAt) / 1000)}s`);
  console.log("");
  console.log(" Full-ledger status after:");
  for (const [k, v] of Object.entries(postCounts)) if (v > 0) console.log(`   ${k}: ${v}`);
  console.log("═══════════════════════════════════════════════════════════");
})();
