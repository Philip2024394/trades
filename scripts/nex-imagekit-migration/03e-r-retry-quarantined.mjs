// NEX ImageKit → Supabase migration · Phase 3E-R · Retry the 12 quarantined TRANSIENT entries.
// Philip 2026-09-02 · authorised BUILD ONLY · DO NOT EXECUTE without explicit auth.
//
// ═══════════════════════════════════════════════════════════════════════
// HARD SCOPE
// ═══════════════════════════════════════════════════════════════════════
//
// Phase 3E completed with 88/100 VERIFIED and 12 PENDING (all Supabase
// Storage 429 · "Too many connections issued to the database").
//
// This script retries EXACTLY those 12 quarantined entries with:
//   · Supabase upload retry on 429  (max_attempts: 4 · 5s → 10s → 20s)
//   · Supabase retrieve retry on 429 (max_attempts: 4 · 5s → 10s → 20s)
//   · Conservative concurrency of 3
//   · All other safety guarantees from 03e-migrate-batch-100.mjs preserved:
//       - upsert:false (enforced inside pipeline-utils.uploadWithDetail)
//       - Fresh HEAD before each GET (defends corpus drift)
//       - Byte-preserving download
//       - SHA-256 + size + MIME verification against source binary
//       - Existing-object safety (retrieve+verify runs regardless of uploadOutcome)
//       - Never mark VERIFIED unless SHA + size + MIME all match
//       - Resumability (VERIFIED entries skip with zero HEAD/GET/upload/retrieve)
//       - Rich diagnostic capture (retry_history preserved on ultimate failure)
//
// SELECTION SEMANTICS
//   · NOT a new selection · does NOT call selectDealiased.
//   · Explicit list of the 12 specific source_urls identified by
//     the notes-matching filter: status === "PENDING" AND notes contains
//     both "Phase 3E" and "TRANSIENT".
//   · HARD_LIMIT_RETRY = 12 constant · not env/CLI-overridable.
//   · If the ledger no longer has exactly 12 such entries, script aborts.
//
// FORBIDDEN (grep-audited)
//   · upsert:true
//   · sb.from(...)                                    — DB writes
//   · storage.remove/move/copy/emptyBucket
//   · createBucket/deleteBucket/updateBucket
//   · ImageKit POST/PUT/PATCH/DELETE
//   · src/**, data/nex-*.json manifests, frame/shell/PWA edits
//   · Silent overwrites (upsert:false is enforced inside the library)
//   · Marking VERIFIED without SHA+size+MIME match on retrieved bytes

import { createClient } from "@supabase/supabase-js";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createHash } from "node:crypto";
import { uploadWithDetail, retrieveWithDetail } from "./pipeline-utils.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const repoRoot   = join(__dirname, "..", "..");

// ═══════════════════════════════════════════════════════════════════════
// HARD LIMITS · CONSTANTS · NOT OVERRIDABLE
// ═══════════════════════════════════════════════════════════════════════
const HARD_LIMIT_RETRY   = 12;      // exact quarantined-set size from Phase 3E
const BUCKET             = "nex-media";
const CONCURRENCY        = 3;       // conservative · Philip 3–4 range
const HEAD_TIMEOUT_MS    = 15_000;
const IMAGEKIT_BACKOFF_MS = 5_000;  // for ImageKit 429s (unchanged)

// Supabase Storage retry policy · applied to BOTH upload and retrieve
const SUPABASE_RETRY_POLICY = {
  max_attempts:  4,       // initial + 3 retries
  base_delay_ms: 5_000,   // 5 seconds base
  factor:        2,       // exponential · yields 5s → 10s → 20s
};
// Worst-case delay per image if all 4 attempts fail on both upload and retrieve:
//   upload:   0 + 5000 + 10000 + 20000 = 35s
//   retrieve: 0 + 5000 + 10000 + 20000 = 35s
//   total:    70s per image · at concurrency 3, 12 images ≤ ~5 min

// NB: no env / argv lookup for HARD_LIMIT_RETRY, CONCURRENCY, or retry policy.

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
// PER-IMAGE PIPELINE (resumable · retry-hardened on Supabase 429)
// ═══════════════════════════════════════════════════════════════════════
async function processOne(entry, calls, imagekitRateLimitCounter) {
  // ── 1 · Resumability check ───────────────────────────────────────────
  const currentLedger = JSON.parse(readFileSync(LEDGER_PATH, "utf8"));
  const currentEntry  = currentLedger.entries.find((e) => e.source_url === entry.source_url);
  if (currentEntry?.status === "VERIFIED") {
    return { entry, ok: true, skipped: "already_verified" };
  }

  // ── 2 · HEAD (ImageKit) · unchanged from 3E ─────────────────────────
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

  // ── 3 · GET (ImageKit) · unchanged ──────────────────────────────────
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

  // ── 4 · Upload (with Supabase 429 retry via pipeline-utils) ─────────
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

  // ── 5 · Retrieve (with Supabase 429 retry via pipeline-utils) ───────
  //    Always retrieve regardless of uploadOutcome ("uploaded" | "existing").
  //    Never mark VERIFIED without SHA+size+MIME match against source binary.
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
      e.notes       = `${priorNotes}Phase 3E-R ${ranAt}: verified (${r.uploadOutcome}) after upload_attempts=${r.uploadAttempts} retrieve_attempts=${r.retrieveAttempts}`;
    } else if (r.is404) {
      e.status      = "BROKEN";
      e.notes       = `${priorNotes}Phase 3E-R ${ranAt}: BROKEN ${r.reason}`;
    } else if (r.mismatch) {
      e.notes       = `${priorNotes}Phase 3E-R ${ranAt}: MISMATCH (retained PENDING) ${r.reason} · srcSha=${r.srcSha?.slice(0,10)}… retSha=${r.retSha?.slice(0,10)}…`;
    } else if (r.transient) {
      let note = `${priorNotes}Phase 3E-R ${ranAt}: TRANSIENT (retained PENDING) ${r.reason}`;
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
// MAIN
// ═══════════════════════════════════════════════════════════════════════
(async () => {
  console.log("═══════════════════════════════════════════════════════════");
  console.log(" NEX ImageKit → Supabase · Phase 3E-R · Retry 12 quarantined");
  console.log("═══════════════════════════════════════════════════════════");
  console.log(` Target:       ${NEX_URL}`);
  console.log(` Bucket:       ${BUCKET}`);
  console.log(` Hard limit:   ${HARD_LIMIT_RETRY} (constant · not overridable)`);
  console.log(` Concurrency:  ${CONCURRENCY}  (conservative for Supabase 429)`);
  console.log(` Retry policy: ${JSON.stringify(SUPABASE_RETRY_POLICY)}  (applied to Supabase upload + retrieve)`);
  console.log("");

  const startedAt = new Date();
  const ledger    = JSON.parse(readFileSync(LEDGER_PATH, "utf8"));
  const totalEntriesAtStart = ledger.entries.length;

  // ── Select EXACTLY the 12 quarantined entries from Phase 3E ──────────
  const quarantined = ledger.entries.filter((e) =>
    e.status === "PENDING" &&
    typeof e.notes === "string" &&
    e.notes.includes("Phase 3E") &&
    e.notes.includes("TRANSIENT")
  );
  if (quarantined.length !== HARD_LIMIT_RETRY) {
    console.error(`REFUSING · expected ${HARD_LIMIT_RETRY} quarantined entries · found ${quarantined.length}`);
    console.error(`  The ledger has drifted since Phase 3E. Investigate before retrying.`);
    process.exit(1);
  }
  if (quarantined.length > HARD_LIMIT_RETRY) {
    console.error(`REFUSING · quarantined pool exceeds HARD_LIMIT_RETRY`);
    process.exit(1);
  }
  const candidates = quarantined;

  const distCheck = candidates.reduce((acc, c) => { acc[c.imagekit_account] = (acc[c.imagekit_account] || 0) + 1; return acc; }, {});
  const provCheck = candidates.reduce((acc, c) => { acc[c.provenance]        = (acc[c.provenance]        || 0) + 1; return acc; }, {});
  console.log(`Retry candidates (exact 12 · not a new selection):`);
  console.log(`  Distribution:  ${JSON.stringify(distCheck)}`);
  console.log(`  Provenance:    ${JSON.stringify(provCheck)}`);
  candidates.forEach((c, i) => console.log(`  R${String(i + 1).padStart(2, "0")}: ${c.imagekit_account} · ${c.source_url}`));

  console.log(`\nStarted: ${startedAt.toISOString()}\n`);
  const { results, imagekitRateLimitCounter, perImageCalls } = await runPool(candidates);
  const finished = new Date();
  const ranAt = finished.toISOString();
  console.log(`\nFinished: ${ranAt} · elapsed ${Math.round((finished - startedAt) / 1000)}s`);

  // Log per-image outcomes
  results.forEach((r, i) => {
    const c = perImageCalls[i];
    const label = `[${String(i + 1).padStart(2, "0")}] ${r.entry.imagekit_account}/${(r.entry.source_path || "").slice(-40)}`;
    if (r.skipped) return console.log(`${label} · SKIP ${r.skipped}`);
    if (r.ok) {
      const upAttempts = r.uploadAttempts ?? 1;
      const retAttempts = r.retrieveAttempts ?? 1;
      return console.log(`${label} · ✓ VERIFIED (${r.uploadOutcome}) · ${r.srcLen}B · sha=${r.srcSha.slice(0, 10)}… · upload_attempts=${upAttempts} retrieve_attempts=${retAttempts}`);
    }
    if (r.is404)     return console.log(`${label} · ✗ BROKEN · ${r.reason}`);
    if (r.mismatch)  return console.log(`${label} · ✗ MISMATCH · ${r.reason}`);
    if (r.transient) {
      let extra = "";
      if (r.upload_retry_history)   extra += ` · upload_history=${JSON.stringify(r.upload_retry_history)}`;
      if (r.retrieve_retry_history) extra += ` · retrieve_history=${JSON.stringify(r.retrieve_retry_history)}`;
      return console.log(`${label} · ✗ TRANSIENT · ${r.reason}${extra}`);
    }
  });

  const updated = applyLedgerUpdates(results, ranAt);

  updated.last_phase_3e_r_retry = {
    ran_at:                    ranAt,
    started_at:                startedAt.toISOString(),
    hard_limit:                HARD_LIMIT_RETRY,
    concurrency:               CONCURRENCY,
    supabase_retry_policy:     SUPABASE_RETRY_POLICY,
    quarantined_input:         candidates.map((c) => c.source_url),
    selected:                  candidates.length,
    processed:                 results.length,
    verified:                  results.filter((r) => r.ok && !r.skipped).length,
    skipped_already_verified:  results.filter((r) => r.skipped === "already_verified").length,
    broken_404:                results.filter((r) => r.is404).length,
    mismatch_retained_pending: results.filter((r) => r.mismatch).length,
    transient_retained_pending: results.filter((r) => r.transient).length,
    imagekit_rate_limit_events: imagekitRateLimitCounter.count,
    per_result: results.map((r) => ({
      source_url:         r.entry.source_url,
      ok:                 r.ok,
      skipped:            !!r.skipped,
      is404:              !!r.is404,
      mismatch:           !!r.mismatch,
      transient:          !!r.transient,
      uploadAttempts:     r.uploadAttempts ?? null,
      retrieveAttempts:   r.retrieveAttempts ?? null,
      uploadHistory:      r.uploadHistory ?? null,
      retrieveHistory:    r.retrieveHistory ?? null,
      upload_error_detail:   r.upload_error_detail ?? null,
      retrieve_error_detail: r.retrieve_error_detail ?? null,
    })),
  };

  if (updated.entries.length !== totalEntriesAtStart) {
    console.error(`LEDGER CONSERVATION FAILURE · before ${totalEntriesAtStart} · after ${updated.entries.length}`);
    process.exit(1);
  }
  writeFileSync(LEDGER_PATH, JSON.stringify(updated, null, 2));

  const postCounts = { PENDING: 0, VERIFIED: 0, PROVENANCE_REVIEW_REQUIRED: 0, BROKEN: 0, MIGRATION_BLOCKED_MAIN: 0, FAILED: 0 };
  for (const e of updated.entries) postCounts[e.status] = (postCounts[e.status] || 0) + 1;

  console.log("\n═══════════════════════════════════════════════════════════");
  console.log(` Phase 3E-R complete`);
  console.log(`   Retry target:                 ${candidates.length}`);
  console.log(`   VERIFIED:                     ${updated.last_phase_3e_r_retry.verified}`);
  console.log(`   BROKEN (404):                 ${updated.last_phase_3e_r_retry.broken_404}`);
  console.log(`   MISMATCH (kept PENDING):      ${updated.last_phase_3e_r_retry.mismatch_retained_pending}`);
  console.log(`   TRANSIENT (kept PENDING):     ${updated.last_phase_3e_r_retry.transient_retained_pending}`);
  console.log(`   SKIPPED (already VERIFIED):   ${updated.last_phase_3e_r_retry.skipped_already_verified}`);
  console.log(`   ImageKit HEAD 429 events:     ${imagekitRateLimitCounter.count}`);
  console.log(`   Elapsed:                      ${Math.round((finished - startedAt) / 1000)}s`);
  console.log("");
  console.log(" Full-ledger status after:");
  for (const [k, v] of Object.entries(postCounts)) if (v > 0) console.log(`   ${k}: ${v}`);
  console.log("═══════════════════════════════════════════════════════════");
})();
