// NEX ImageKit → Supabase migration · Phase 3C · CORPUS VALIDATION.
// Philip 2026-09-02 · authorised · READ / VALIDATE ONLY.
//
// ═══════════════════════════════════════════════════════════════════════
// STRICT SCOPE
// ═══════════════════════════════════════════════════════════════════════
//
// Fresh HEAD sweep across all PENDING owned URLs.
// Purpose: resolve the known limitation from Phase 3A/2b — only 3 exact
// BROKEN URLs were retained, but Phase 2b measured ~49 total 404s. This
// pass identifies the missing ~46 permanent-broken URLs BEFORE any bulk
// migration wastes bandwidth on them.
//
// MUST NOT:
//   · Upload / download / GET binary
//   · Compute SHA-256 (that's a bulk-migration script concern)
//   · Modify Supabase Storage (no upload · no delete · no policy change)
//   · Modify Supabase DB (no SELECT that mutates · no INSERT/UPDATE/DELETE)
//   · Modify ImageKit (read-only HEAD requests only)
//   · Touch VERIFIED entries (10 test-batch entries stay as-is)
//   · Touch PROVENANCE_REVIEW_REQUIRED entries (410 unknowns stay as-is)
//   · Touch MIGRATION_BLOCKED_MAIN entries (127 MAIN stay as-is)
//   · Touch existing BROKEN entries (3 already-known 404s stay as-is)
//   · Modify any source file / manifest / DB row / .env
//   · Touch the NEX shell / frame / geometry / viewport / PWA manifest
//
// PERMITTED:
//   · HEAD requests to ik.imagekit.io
//   · One write: update data/nex-imagekit-migration-ledger.json in place
//
// CLASSIFICATION SEMANTICS (per authorisation)
//
//   REACHABLE       · HTTP 2xx + image/* Content-Type
//   BROKEN_404      · HTTP 404 (PERMANENT · marks status = BROKEN)
//   UNAVAILABLE     · Other non-2xx (5xx, 429, etc) OR timeout / network
//                     (TEMPORARY · status stays PENDING · eligible for retry)
//   INVALID_MEDIA   · HTTP 2xx but Content-Type is not image/*
//                     (surfaces via validation_state · status stays PENDING
//                      for human review · not automatically demoted)
//
// PRESERVATION RULES
//   · provenance field: NEVER changed
//   · status field: only changed to BROKEN when validation_state = BROKEN_404
//   · Adds two NEW fields per touched entry: validation_state, validated_at
//   · Adds/updates http_status, content_type, content_length from fresh HEAD

import { createClient } from "@supabase/supabase-js";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot  = join(__dirname, "..", "..");

// ═══════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════
const CONCURRENCY   = 8;              // per authorised 5-10 range
const HEAD_TIMEOUT  = 15_000;         // 15s per URL
const RETRY_ON_NET  = 1;              // 1 retry on network failure only
const RETRY_DELAY   = 2000;           // 2s before retry
const RATE_BACKOFF  = 5000;           // 5s backoff on HTTP 429
const ALLOWED_PROVENANCE = new Set(["OWNED_LIKELY_AI_GENERATED", "OWNED_LIKELY_UPLOAD"]);

// ─── Env / safety guard ───────────────────────────────────────────────
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
if (!NEX_URL || !NEX_URL.includes("ijvqdvsvwtwxzcqmoqit")) {
  console.error(`REFUSING · NEX project guard failed · saw ${NEX_URL}`);
  process.exit(1);
}
// We don't actually need a Supabase client for this phase (no Supabase
// operations occur), but we validate credentials to ensure the environment
// is correct in case the operator wanted a different phase.
const NEX_KEY  = env.NEX_SUPABASE_SERVICE_ROLE_KEY;
if (!NEX_KEY) { console.error("Missing NEX_SUPABASE_SERVICE_ROLE_KEY"); process.exit(1); }

const LEDGER_PATH = join(repoRoot, "data/nex-imagekit-migration-ledger.json");
const ledger = JSON.parse(readFileSync(LEDGER_PATH, "utf8"));

console.log("═══════════════════════════════════════════════════════════");
console.log(" NEX ImageKit → Supabase · Phase 3C · Corpus HEAD validation");
console.log("═══════════════════════════════════════════════════════════");
console.log(` Ledger entries: ${ledger.entries.length}\n`);

// ═══════════════════════════════════════════════════════════════════════
// SELECT ELIGIBLE ENTRIES (must not touch VERIFIED / UNKNOWN / MAIN / BROKEN)
// ═══════════════════════════════════════════════════════════════════════

const eligibleIdx = [];
for (let i = 0; i < ledger.entries.length; i++) {
  const e = ledger.entries[i];
  if (e.status !== "PENDING") continue;
  if (!ALLOWED_PROVENANCE.has(e.provenance)) continue;
  if (!e.source_url || !e.source_url.startsWith("https://ik.imagekit.io/")) continue;
  eligibleIdx.push(i);
}
console.log(`Eligible for validation (PENDING + owned + ImageKit URL): ${eligibleIdx.length}`);
console.log(`(VERIFIED · PROVENANCE_REVIEW_REQUIRED · MAIN · BROKEN entries untouched)`);
if (eligibleIdx.length === 0) { console.log("No eligible entries · nothing to do"); process.exit(0); }

// ═══════════════════════════════════════════════════════════════════════
// HEAD PROBE (with timeout + limited retry)
// ═══════════════════════════════════════════════════════════════════════

async function headProbe(url, attempt = 0) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), HEAD_TIMEOUT);
  try {
    const res = await fetch(url, { method: "HEAD", redirect: "follow", signal: ctrl.signal });
    clearTimeout(timer);
    return {
      http_status:    res.status,
      content_type:   res.headers.get("content-type"),
      content_length: Number(res.headers.get("content-length")) || null,
    };
  } catch (e) {
    clearTimeout(timer);
    // Retry once on network error (aborted, connection reset, DNS) — but
    // NEVER retry on an HTTP status result (that's a definitive answer).
    if (attempt < RETRY_ON_NET) {
      await new Promise((r) => setTimeout(r, RETRY_DELAY));
      return headProbe(url, attempt + 1);
    }
    return { http_status: null, error: e.name || "error", error_message: e.message };
  }
}

function classify(probe) {
  if (probe.http_status == null) return "UNAVAILABLE";
  if (probe.http_status === 404) return "BROKEN_404";
  if (probe.http_status === 429) return "UNAVAILABLE";
  if (probe.http_status >= 500)  return "UNAVAILABLE";
  if (probe.http_status >= 400)  return "UNAVAILABLE"; // non-404 4xx · treat as temporary until analysed
  if (probe.http_status >= 300)  return "UNAVAILABLE"; // unusual · shouldn't happen with redirect:follow
  // 2xx branch · check media type
  const ct = (probe.content_type || "").toLowerCase();
  if (ct.startsWith("image/")) return "REACHABLE";
  return "INVALID_MEDIA";
}

// ═══════════════════════════════════════════════════════════════════════
// CONCURRENCY POOL · fixed workers · rate-limit-aware
// ═══════════════════════════════════════════════════════════════════════

let rateLimitEvents = 0;
async function runPool(indices) {
  const results = new Array(indices.length);
  let cursor = 0;
  let completed = 0;
  const total = indices.length;
  async function worker(id) {
    while (true) {
      const idx = cursor++;
      if (idx >= indices.length) return;
      const entryIdx = indices[idx];
      const url = ledger.entries[entryIdx].source_url;
      let probe = await headProbe(url);
      // If we got HTTP 429 · back off and try one more time (do not retry
      // indefinitely per the "no aggressive retry loops" rule).
      if (probe.http_status === 429) {
        rateLimitEvents++;
        await new Promise((r) => setTimeout(r, RATE_BACKOFF));
        probe = await headProbe(url);
      }
      const cls = classify(probe);
      results[idx] = { entryIdx, probe, classification: cls };
      completed++;
      if (completed % 50 === 0 || completed === total) {
        process.stdout.write(`\r  progress: ${completed} / ${total}  · rate-limits: ${rateLimitEvents}`);
      }
    }
  }
  const workers = Array.from({ length: CONCURRENCY }, (_, i) => worker(i));
  await Promise.all(workers);
  console.log("");
  return results;
}

// ═══════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════

(async () => {
  const started = new Date();
  console.log(`\nStarted: ${started.toISOString()}  · concurrency ${CONCURRENCY}  · timeout ${HEAD_TIMEOUT / 1000}s\n`);

  const results = await runPool(eligibleIdx);
  const finished = new Date();
  console.log(`Finished: ${finished.toISOString()}  · elapsed ${Math.round((finished - started) / 1000)}s\n`);

  // ─── Apply updates to ledger · touching ONLY eligible entries ───────
  const stats = { REACHABLE: 0, BROKEN_404: 0, UNAVAILABLE: 0, INVALID_MEDIA: 0 };
  const totalRequests = results.length;
  const validatedAt = finished.toISOString();
  const newlyBrokenSample = [];
  const unavailableSample = [];
  const invalidMediaSample = [];

  for (const r of results) {
    const e = ledger.entries[r.entryIdx];
    stats[r.classification] = (stats[r.classification] || 0) + 1;
    // Update validation fields
    e.http_status    = r.probe.http_status ?? e.http_status;
    e.content_type   = r.probe.content_type ?? e.content_type;
    e.content_length = r.probe.content_length ?? e.content_length;
    e.validation_state = r.classification;
    e.validated_at     = validatedAt;
    // Status semantics:
    //   BROKEN_404 → status = BROKEN (permanent · marks 404s from bulk migration)
    //   Everything else → status stays PENDING (eligible for later retry or migration)
    if (r.classification === "BROKEN_404") {
      e.status = "BROKEN";
      const priorNotes = e.notes ? e.notes + " | " : "";
      e.notes = `${priorNotes}Phase 3C: HTTP 404 · marked BROKEN on ${validatedAt}`;
      if (newlyBrokenSample.length < 20) newlyBrokenSample.push(e.source_url);
    } else if (r.classification === "UNAVAILABLE") {
      // Do NOT flip to BROKEN · could be transient. Just annotate.
      const err = r.probe.error_message ? ` · ${r.probe.error_message}` : "";
      const priorNotes = e.notes ? e.notes + " | " : "";
      e.notes = `${priorNotes}Phase 3C: temporarily unavailable (HTTP ${r.probe.http_status ?? "network-err"})${err} on ${validatedAt}`;
      if (unavailableSample.length < 10) unavailableSample.push({ url: e.source_url, http_status: r.probe.http_status, error: r.probe.error_message });
    } else if (r.classification === "INVALID_MEDIA") {
      const priorNotes = e.notes ? e.notes + " | " : "";
      e.notes = `${priorNotes}Phase 3C: HTTP 2xx but non-image Content-Type '${r.probe.content_type}' on ${validatedAt}`;
      if (invalidMediaSample.length < 10) invalidMediaSample.push({ url: e.source_url, content_type: r.probe.content_type });
    } else if (r.classification === "REACHABLE") {
      // Clear any stale note that said BROKEN speculatively (there shouldn't be any).
    }
  }

  // Full-ledger post-audit counts
  const postCounts = { PENDING: 0, VERIFIED: 0, PROVENANCE_REVIEW_REQUIRED: 0, BROKEN: 0, MIGRATION_BLOCKED_MAIN: 0, FAILED: 0 };
  for (const e of ledger.entries) postCounts[e.status] = (postCounts[e.status] || 0) + 1;

  // Attach phase-3C summary to ledger root
  ledger.last_phase_3c_validation = {
    ran_at:              validatedAt,
    eligible_scanned:    eligibleIdx.length,
    concurrency:         CONCURRENCY,
    head_timeout_ms:     HEAD_TIMEOUT,
    total_requests_made: totalRequests, // 1 primary + up to 1 retry per URL · rate-limit backoff adds another
    rate_limit_events:   rateLimitEvents,
    classification:      stats,
    ledger_status_after: postCounts,
    newly_broken_sample_urls: newlyBrokenSample,
    unavailable_sample:       unavailableSample,
    invalid_media_sample:     invalidMediaSample,
  };

  writeFileSync(LEDGER_PATH, JSON.stringify(ledger, null, 2));

  console.log("═══════════════════════════════════════════════════════════");
  console.log(" Phase 3C validation complete");
  console.log(`   Eligible URLs scanned:      ${eligibleIdx.length}`);
  console.log(`   REACHABLE (owned + image):  ${stats.REACHABLE}`);
  console.log(`   BROKEN_404 (marked BROKEN): ${stats.BROKEN_404}`);
  console.log(`   UNAVAILABLE (temp · keep):  ${stats.UNAVAILABLE}`);
  console.log(`   INVALID_MEDIA (2xx non-img):${stats.INVALID_MEDIA}`);
  console.log(`   Rate-limit events:          ${rateLimitEvents}`);
  console.log("");
  console.log(" Full-ledger status after this run:");
  for (const [k, v] of Object.entries(postCounts)) if (v > 0) console.log(`   ${k}: ${v}`);
  console.log("═══════════════════════════════════════════════════════════");
})();
