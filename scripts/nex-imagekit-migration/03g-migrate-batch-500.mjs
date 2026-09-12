// NEX ImageKit → Supabase migration · Phase 3G · 500-image controlled batch.
// Philip 2026-09-02 · authorised · MAX 500 IMAGES.
//
// ═══════════════════════════════════════════════════════════════════════
// HARD SCOPE
// ═══════════════════════════════════════════════════════════════════════
//
// Same proven configuration as Phase 3F (which cleared 250/250 in 4m37s):
//
//   · HARD_LIMIT_IMAGES = 500    (const · no env/CLI override · asserted)
//   · CONCURRENCY       = 3      (const · Phase 3E-R + 3F proved stable)
//   · Retry policy: 5s → 10s → 20s exponential · max 4 attempts · 429 only
//   · Uploader: pipeline-utils.mjs · uploadWithDetail (with SUPABASE_RETRY_POLICY)
//   · Retriever: pipeline-utils.mjs · retrieveWithDetail (with SUPABASE_RETRY_POLICY)
//   · Selector: pipeline-utils.mjs · selectDealiased (called TWICE for
//               provenance preference · see PROVENANCE PREFERENCE below)
//
// PROVENANCE PREFERENCE (Philip 2026-09-02)
//   Prefer remaining OWNED_LIKELY_UPLOAD entries first (verification-corpus
//   is currently heavy on AI-generated after Phase 3F). Then fill the
//   remainder with OWNED_LIKELY_AI_GENERATED.
//
//   This is a SELECTION preference only. Every existing safety rule holds:
//     · Only PENDING · owned · REACHABLE · ImageKit URL entries eligible
//     · One candidate per destination_path (de-alias)
//     · Destinations already VERIFIED via any alias excluded
//     · Existing VERIFIED entries never touched
//     · PROVENANCE_REVIEW_REQUIRED / BROKEN / MIGRATION_BLOCKED_MAIN never
//       selected regardless of preference
//
//   Implemented as TWO-PASS caller-side over selectDealiased · no
//   modification to the proven pipeline-utils library.
//
// FORBIDDEN (grep-audited)
//   · upsert:true                                            (grep 0)
//   · sb.from(...)                — DB writes                (grep 0)
//   · storage.remove/move/copy/emptyBucket                   (grep 0)
//   · createBucket/deleteBucket/updateBucket                 (grep 0)
//   · ImageKit POST/PUT/PATCH/DELETE                         (grep 0)
//   · src/**, data/nex-*.json manifests, frame/shell/PWA     (0 edits)
//   · Image transformation (resize/recompress/convert)       (byte-preserving GET only)
//   · Destination-path redesign                              (uses existing imported/<account>/)

import { createClient } from "@supabase/supabase-js";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createHash } from "node:crypto";
import { selectDealiased, uploadWithDetail, retrieveWithDetail } from "./pipeline-utils.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const repoRoot   = join(__dirname, "..", "..");

// ═══════════════════════════════════════════════════════════════════════
// HARD LIMITS · CONSTANTS · NOT OVERRIDABLE
// ═══════════════════════════════════════════════════════════════════════
const HARD_LIMIT_IMAGES  = 500;
const BUCKET             = "nex-media";
const CONCURRENCY        = 3;
const HEAD_TIMEOUT_MS    = 15_000;
const IMAGEKIT_BACKOFF_MS = 5_000;

const SUPABASE_RETRY_POLICY = {
  max_attempts:  4,
  base_delay_ms: 5_000,
  factor:        2,
};

const PROVENANCE_PREFERENCE_ORDER = [
  "OWNED_LIKELY_UPLOAD",
  "OWNED_LIKELY_AI_GENERATED",
];

// NB: no env / argv lookup for HARD_LIMIT_IMAGES, CONCURRENCY, or retry policy.

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
// PROVENANCE-PREFERENCE SELECTION (two-pass · caller-side · never
// weakens any safety rule inside selectDealiased)
// ═══════════════════════════════════════════════════════════════════════
function selectWithProvenancePreference(ledger, { hardLimit, provenanceOrder }) {
  const combined = [];
  const seenDests = new Set();
  const seenUrls  = new Set();
  const passReports = [];

  for (const prov of provenanceOrder) {
    if (combined.length >= hardLimit) break;
    const remaining = hardLimit - combined.length;

    // Each pass calls selectDealiased with strict PENDING+REACHABLE+etc filters
    // AND provenance restricted to just `prov`. All safety rules preserved.
    const sel = selectDealiased(ledger, {
      hardLimit: remaining,
      provenanceAllowed: new Set([prov]),
      distribution: null,   // natural distribution within this provenance
    });

    let addedInPass = 0;
    for (const c of sel.candidates) {
      if (combined.length >= hardLimit) break;
      // Defensive dedup against cross-pass collisions (theoretically shouldn't
      // happen · aliased URLs share provenance · content-duplicates have
      // distinct destination_paths · but we guard anyway).
      if (seenDests.has(c.destination_path)) continue;
      if (seenUrls.has(c.source_url))        continue;
      combined.push(c);
      seenDests.add(c.destination_path);
      seenUrls.add(c.source_url);
      addedInPass++;
    }

    passReports.push({
      provenance:                          prov,
      eligible_before_dealias:             sel.eligible_before,
      candidate_pool_after_dealias:        sel.candidate_pool,
      groups_skipped_alias_of_selected:    sel.groups_skipped_alias_of_selected,
      groups_skipped_destination_verified: sel.groups_skipped_destination_verified,
      skipped_aliases_count:               sel.skipped_aliases.length,
      returned_by_selector:                sel.candidates.length,
      added_to_combined:                   addedInPass,
    });
  }

  return { candidates: combined, passes: passReports };
}

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
// PER-IMAGE PIPELINE (identical to 3F · retry-hardened)
// ═══════════════════════════════════════════════════════════════════════
async function processOne(entry, calls, imagekitRateLimitCounter) {
  const currentLedger = JSON.parse(readFileSync(LEDGER_PATH, "utf8"));
  const currentEntry  = currentLedger.entries.find((e) => e.source_url === entry.source_url);
  if (currentEntry?.status === "VERIFIED") {
    return { entry, ok: true, skipped: "already_verified" };
  }

  calls.head++;
  let head = await headWithTimeout(entry.source_url);
  if (head.status === 429) {
    imagekitRateLimitCounter.count++;
    await new Promise((r) => setTimeout(r, IMAGEKIT_BACKOFF_MS));
    const retry = await headWithTimeout(entry.source_url);
    if (!retry.status || retry.status < 200 || retry.status >= 300) {
      const is404 = retry.status === 404;
      return { entry, ok: false, ...(is404 ? { is404: true } : { transient: true }), reason: `HEAD rate-limited then ${retry.status || retry.error || "network"}` };
    }
    head = retry;
  }
  if (head.status === 404) return { entry, ok: false, is404: true, reason: `HEAD 404` };
  if (!head.status || head.status < 200 || head.status >= 300) {
    return { entry, ok: false, transient: true, reason: `HEAD non-2xx: ${head.status}${head.error ? " · " + head.error : ""}` };
  }
  const headMime = head.mime;

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

  calls.upload++;
  const uploadResult = await uploadWithDetail(sb, {
    bucket:           BUCKET,
    destination_path: entry.destination_path,
    body:             Buffer.from(buf),
    content_type:     headMime,
    source_url:       entry.source_url,
    retry_policy:     SUPABASE_RETRY_POLICY,
  });
  if (!uploadResult.ok) {
    return {
      entry, ok: false, transient: true,
      reason: `upload ${uploadResult.uploadOutcome} after ${uploadResult.attempts_made} attempts`,
      upload_error_detail: uploadResult.error_detail,
      upload_retry_history: uploadResult.retry_history,
      headMime, srcLen, srcSha,
    };
  }
  const uploadOutcome  = uploadResult.uploadOutcome;
  const uploadAttempts = uploadResult.attempts_made;
  const uploadHistory  = uploadResult.retry_history;

  calls.retrieve++;
  const retrieveUrl = `${NEX_URL}/storage/v1/object/public/${BUCKET}/${encodeURI(entry.destination_path)}`;
  const retrieveResult = await retrieveWithDetail(retrieveUrl, { retry_policy: SUPABASE_RETRY_POLICY });
  if (!retrieveResult.ok) {
    return {
      entry, ok: false, transient: true,
      reason: `retrieve failed after ${retrieveResult.attempts_made} attempts`,
      retrieve_error_detail:  retrieveResult.error_detail,
      retrieve_retry_history: retrieveResult.retry_history,
      headMime, srcLen, srcSha, retrieveUrl,
      uploadOutcome, uploadAttempts, uploadHistory,
    };
  }
  const retLen  = retrieveResult.content_length;
  const retSha  = sha256(retrieveResult.body);
  const retMime = retrieveResult.content_type;

  const shaOk  = srcSha === retSha;
  const sizeOk = srcLen === retLen;
  const mimeOk = mimeEquiv(headMime, retMime);
  const verified = shaOk && sizeOk && mimeOk;

  if (!verified) {
    return {
      entry, ok: false, mismatch: true,
      reason: `mismatch (sha=${shaOk} size=${sizeOk} mime=${mimeOk})${uploadOutcome === "existing" ? " · destination pre-existed with different content" : ""}`,
      uploadOutcome, uploadAttempts, uploadHistory,
      retrieveAttempts: retrieveResult.attempts_made, retrieveHistory: retrieveResult.retry_history,
      headMime, srcLen, srcSha, retLen, retSha, retMime, retrieveUrl,
    };
  }

  return {
    entry, ok: true,
    uploadOutcome, uploadAttempts, uploadHistory,
    retrieveAttempts: retrieveResult.attempts_made, retrieveHistory: retrieveResult.retry_history,
    headMime, srcLen, srcSha, retLen, retSha, retMime, retrieveUrl,
  };
}

// ═══════════════════════════════════════════════════════════════════════
// CONCURRENCY POOL (3 workers)
// ═══════════════════════════════════════════════════════════════════════
async function runPool(candidates) {
  const results = new Array(candidates.length);
  const imagekitRateLimitCounter = { count: 0 };
  const perImageCalls = new Array(candidates.length);
  let cursor = 0;
  async function worker() {
    while (true) {
      const i = cursor++;
      if (i >= candidates.length) return;
      const calls = { head: 0, get: 0, upload: 0, retrieve: 0 };
      perImageCalls[i] = calls;
      results[i] = await processOne(candidates[i], calls, imagekitRateLimitCounter);
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  return { results, imagekitRateLimitCounter, perImageCalls };
}

// ═══════════════════════════════════════════════════════════════════════
// LEDGER UPDATE
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
      e.notes       = `${priorNotes}Phase 3G ${ranAt}: verified (${r.uploadOutcome}) upload_attempts=${r.uploadAttempts} retrieve_attempts=${r.retrieveAttempts}`;
    } else if (r.is404) {
      e.status      = "BROKEN";
      e.notes       = `${priorNotes}Phase 3G ${ranAt}: BROKEN ${r.reason}`;
    } else if (r.mismatch) {
      e.notes       = `${priorNotes}Phase 3G ${ranAt}: MISMATCH (retained PENDING) ${r.reason} · srcSha=${r.srcSha?.slice(0,10)}… retSha=${r.retSha?.slice(0,10)}…`;
    } else if (r.transient) {
      let note = `${priorNotes}Phase 3G ${ranAt}: TRANSIENT (retained PENDING) ${r.reason}`;
      if (r.upload_error_detail)    note += ` · upload_error=${JSON.stringify(r.upload_error_detail)}`;
      if (r.upload_retry_history)   note += ` · upload_history=${JSON.stringify(r.upload_retry_history)}`;
      if (r.retrieve_error_detail)  note += ` · retrieve_error=${JSON.stringify(r.retrieve_error_detail)}`;
      if (r.retrieve_retry_history) note += ` · retrieve_history=${JSON.stringify(r.retrieve_retry_history)}`;
      e.notes = note;
    }
  }
  if (ledger.entries.length !== totalBefore) {
    throw new Error(`LEDGER CONSERVATION FAILURE · before ${totalBefore} · after ${ledger.entries.length}`);
  }
  return ledger;
}

// ═══════════════════════════════════════════════════════════════════════
// DUPLICATE DETECTION
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
  console.log(" NEX ImageKit → Supabase · Phase 3G · 500-image controlled batch");
  console.log("═══════════════════════════════════════════════════════════");
  console.log(` Target:       ${NEX_URL}`);
  console.log(` Bucket:       ${BUCKET}`);
  console.log(` Hard limit:   ${HARD_LIMIT_IMAGES} (constant · not overridable)`);
  console.log(` Concurrency:  ${CONCURRENCY} (proven stable · do not increase)`);
  console.log(` Retry policy: ${JSON.stringify(SUPABASE_RETRY_POLICY)} (upload + retrieve · 429 only)`);
  console.log(` Provenance preference: ${JSON.stringify(PROVENANCE_PREFERENCE_ORDER)} (Philip 2026-09-02)`);
  console.log(` Selection safety:      de-alias + PENDING-only + REACHABLE + owned + ImageKit-URL enforced in both passes`);
  console.log("");

  const startedAt = new Date();
  const ledger    = JSON.parse(readFileSync(LEDGER_PATH, "utf8"));
  const totalEntriesAtStart = ledger.entries.length;

  const existingVerifiedHashes = new Map();
  for (const e of ledger.entries) {
    if (e.status === "VERIFIED" && e.sha256) {
      if (!existingVerifiedHashes.has(e.sha256)) existingVerifiedHashes.set(e.sha256, []);
      existingVerifiedHashes.get(e.sha256).push(e.source_url);
    }
  }
  console.log(`Existing corpus-wide VERIFIED sha256 count: ${existingVerifiedHashes.size}`);

  // ── Two-pass de-aliased selection with provenance preference ────────
  const sel = selectWithProvenancePreference(ledger, {
    hardLimit:       HARD_LIMIT_IMAGES,
    provenanceOrder: PROVENANCE_PREFERENCE_ORDER,
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
  console.log(`  Selection passes:`);
  sel.passes.forEach((p) => {
    console.log(`    · ${p.provenance}: eligible=${p.eligible_before_dealias} · pool=${p.candidate_pool_after_dealias} · added=${p.added_to_combined} (skipped_aliases=${p.skipped_aliases_count} alias-of-selected=${p.groups_skipped_alias_of_selected} dest-already-verified=${p.groups_skipped_destination_verified})`);
  });

  // PREFLIGHT · all 500 entries before any pipeline call
  console.log("\n" + "─".repeat(88));
  console.log(" PREFLIGHT · exact selected candidates to be migrated:");
  console.log("─".repeat(88));
  candidates.forEach((c, i) => {
    console.log(`  [${String(i + 1).padStart(3, "0")}] ${c.imagekit_account} · status=${c.status} · ${c.provenance} · ${c.content_type || "?"} · ${c.content_length || "?"}B`);
    console.log(`        src:  ${c.source_url}`);
    console.log(`        dest: ${c.destination_path}`);
  });
  console.log("─".repeat(88));
  console.log(" Safety confirmation:");
  console.log(`   · HARD_LIMIT_IMAGES        = ${HARD_LIMIT_IMAGES} (const · asserted)`);
  console.log(`   · CONCURRENCY              = ${CONCURRENCY} (const · asserted)`);
  console.log(`   · Retry policy             = ${JSON.stringify(SUPABASE_RETRY_POLICY)}`);
  console.log(`   · upsert                   = false (enforced inside pipeline-utils.uploadWithDetail)`);
  console.log(`   · De-alias                 = active (per-pass, enforced inside selectDealiased)`);
  console.log(`   · Selection scope          = PENDING + owned + REACHABLE + ImageKit source URL (per pass)`);
  console.log(`   · Existing VERIFIED        = untouched (${existingVerifiedHashes.size} entries)`);
  console.log(`   · Provenance preference    = ${JSON.stringify(PROVENANCE_PREFERENCE_ORDER)} (preference only · no safety rule weakened)`);
  console.log("─".repeat(88));

  console.log(`\nStarted: ${startedAt.toISOString()}\n`);
  const { results, imagekitRateLimitCounter, perImageCalls } = await runPool(candidates);
  const finished = new Date();
  const ranAt = finished.toISOString();
  console.log(`\nFinished: ${ranAt} · elapsed ${Math.round((finished - startedAt) / 1000)}s`);

  results.forEach((r, i) => {
    const label = `[${String(i + 1).padStart(3, "0")}] ${r.entry.imagekit_account}/${(r.entry.source_path || "").slice(-40)}`;
    if (r.skipped) return console.log(`${label} · SKIP ${r.skipped}`);
    if (r.ok) {
      const upA = r.uploadAttempts ?? 1, retA = r.retrieveAttempts ?? 1;
      const retryFlag = (upA > 1 || retA > 1) ? ` · retries!` : "";
      return console.log(`${label} · ✓ VERIFIED (${r.uploadOutcome}) · ${r.srcLen}B · sha=${r.srcSha.slice(0, 10)}… · upA=${upA} retA=${retA}${retryFlag}`);
    }
    if (r.is404)     return console.log(`${label} · ✗ BROKEN · ${r.reason}`);
    if (r.mismatch)  return console.log(`${label} · ✗ MISMATCH · ${r.reason}`);
    if (r.transient) {
      let extra = "";
      if (r.upload_retry_history)   extra += ` · uploadH=${JSON.stringify(r.upload_retry_history)}`;
      if (r.retrieve_retry_history) extra += ` · retrieveH=${JSON.stringify(r.retrieve_retry_history)}`;
      return console.log(`${label} · ✗ TRANSIENT · ${r.reason}${extra}`);
    }
  });

  const updated = applyLedgerUpdates(results, ranAt);
  const dupes   = detectDuplicates(results, existingVerifiedHashes);

  const uploadRetried    = results.filter((r) => (r.uploadAttempts ?? 1) > 1).length;
  const retrieveRetried  = results.filter((r) => (r.retrieveAttempts ?? 1) > 1).length;
  const upload429Count   = results.reduce((acc, r) => acc + (r.uploadHistory || []).filter((h) => h.is429).length, 0);
  const retrieve429Count = results.reduce((acc, r) => acc + (r.retrieveHistory || []).filter((h) => h.is429).length, 0);
  const uploadedFresh    = results.filter((r) => r.ok && r.uploadOutcome === "uploaded").length;
  const reconciledExisting = results.filter((r) => r.ok && r.uploadOutcome === "existing").length;
  const totalBytes       = results.filter((r) => r.ok).reduce((acc, r) => acc + (r.srcLen || 0), 0);

  updated.last_phase_3g_migration = {
    ran_at:                    ranAt,
    started_at:                startedAt.toISOString(),
    hard_limit:                HARD_LIMIT_IMAGES,
    concurrency:               CONCURRENCY,
    supabase_retry_policy:     SUPABASE_RETRY_POLICY,
    provenance_preference:     PROVENANCE_PREFERENCE_ORDER,
    selection_passes:          sel.passes,
    selected:                  candidates.length,
    processed:                 results.length,
    verified:                  results.filter((r) => r.ok && !r.skipped).length,
    verified_uploaded_fresh:   uploadedFresh,
    verified_reconciled_existing: reconciledExisting,
    skipped_already_verified:  results.filter((r) => r.skipped === "already_verified").length,
    broken_404:                results.filter((r) => r.is404).length,
    mismatch_retained_pending: results.filter((r) => r.mismatch).length,
    transient_retained_pending: results.filter((r) => r.transient).length,
    imagekit_rate_limit_events: imagekitRateLimitCounter.count,
    supabase_upload_429_count:  upload429Count,
    supabase_retrieve_429_count: retrieve429Count,
    images_needing_upload_retry:    uploadRetried,
    images_needing_retrieve_retry:  retrieveRetried,
    total_bytes_migrated:      totalBytes,
    duplicates:                dupes,
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
    per_provenance: results.reduce((acc, r) => {
      const p = r.entry.provenance || "unknown";
      acc[p] ??= { total: 0, verified: 0, failed: 0 };
      acc[p].total++;
      if (r.skipped) return acc;
      if (r.ok) acc[p].verified++; else acc[p].failed++;
      return acc;
    }, {}),
    per_mime_verified: results.filter((r) => r.ok).reduce((acc, r) => {
      const m = r.headMime || "unknown";
      acc[m] = (acc[m] || 0) + 1;
      return acc;
    }, {}),
  };

  if (updated.entries.length !== totalEntriesAtStart) {
    console.error(`LEDGER CONSERVATION FAILURE · before ${totalEntriesAtStart} · after ${updated.entries.length}`);
    process.exit(1);
  }
  writeFileSync(LEDGER_PATH, JSON.stringify(updated, null, 2));

  const postCounts = { PENDING: 0, VERIFIED: 0, PROVENANCE_REVIEW_REQUIRED: 0, BROKEN: 0, MIGRATION_BLOCKED_MAIN: 0, FAILED: 0 };
  for (const e of updated.entries) postCounts[e.status] = (postCounts[e.status] || 0) + 1;
  const cumulativePercent = ((postCounts.VERIFIED / updated.entries.length) * 100).toFixed(2);

  console.log("\n═══════════════════════════════════════════════════════════");
  console.log(` Phase 3G complete`);
  console.log(`   Selected:                        ${candidates.length}`);
  console.log(`   VERIFIED:                        ${updated.last_phase_3g_migration.verified}`);
  console.log(`     · fresh upload:                ${uploadedFresh}`);
  console.log(`     · reconciled existing object:  ${reconciledExisting}`);
  console.log(`   BROKEN (404):                    ${updated.last_phase_3g_migration.broken_404}`);
  console.log(`   MISMATCH (kept PENDING):         ${updated.last_phase_3g_migration.mismatch_retained_pending}`);
  console.log(`   TRANSIENT (kept PENDING):        ${updated.last_phase_3g_migration.transient_retained_pending}`);
  console.log(`   SKIPPED (already VERIFIED):      ${updated.last_phase_3g_migration.skipped_already_verified}`);
  console.log(`   Duplicates (report only):        ${dupes.length}`);
  console.log(`   ImageKit HEAD 429:               ${imagekitRateLimitCounter.count}`);
  console.log(`   Supabase upload 429 (retried):   ${upload429Count}`);
  console.log(`   Supabase retrieve 429 (retried): ${retrieve429Count}`);
  console.log(`   Images needing upload retry:     ${uploadRetried}`);
  console.log(`   Images needing retrieve retry:   ${retrieveRetried}`);
  console.log(`   Total bytes migrated:            ${totalBytes} (${(totalBytes/1024/1024).toFixed(2)} MB)`);
  console.log(`   Elapsed:                         ${Math.round((finished - startedAt) / 1000)}s`);
  console.log("");
  console.log(" Full-ledger status after:");
  for (const [k, v] of Object.entries(postCounts)) if (v > 0) console.log(`   ${k}: ${v}`);
  console.log(` Cumulative VERIFIED: ${postCounts.VERIFIED} / ${updated.entries.length} = ${cumulativePercent}%`);
  console.log("═══════════════════════════════════════════════════════════");
})();
