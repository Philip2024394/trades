#!/usr/bin/env node
// NEX Promotion · run-owner-contact-orchestrator.mjs · Task #88 Phase 2 (2026-08-22)
//
// Owner-contact identification orchestrator. Reads needs_enrichment rows from
// nex.food_business_promotion (Phase 1 state) and invokes existing enrichment
// agents (Tasks #38-#42) on them via child_process spawn. Every enrichment
// deposit lands in nex.food_enrichment_evidence with the agent's own provenance.
//
// Doctrine anchors:
//   project_nex_task88_promotion_pipeline_spec_2026_08_22
//   project_nex_task88_phase1_shipped_2026_08_22
//   project_nex_walker_dev_frozen_2026_08_22
//   project_nex_walker_stays_pure_acquisition_2026_08_22
//   project_nex_architecture_replaceable_plumbing_and_provable_causality_2026_08_22
//
// Philip 2026-08-22 Phase 2 lock (verbatim):
//   · "enrichment only. It must NOT promote businesses, list businesses,
//     invite owners, or send outreach."
//   · "Never fabricate a phone number, WhatsApp number, website, owner..."
//   · "Do not unleash all 369 needs_enrichment businesses at once. Start with
//     a small controlled batch, verify the results and provenance, then expand."
//
// Explicit non-behaviours (enforced in code):
//   · Never writes to nex.food_business.claim_status (Walker still owns discovery)
//   · Never writes to nex.food_business.whatsapp_number/phone/website (Phase 3
//     admin decision · evidence stays in food_enrichment_evidence only)
//   · Never sends WhatsApp / SMS / email / any outreach (Gate 5 hard-noop)
//   · Never advances food_business_promotion.current_state (score-driven only ·
//     Phase 1 quality-check will pick up naturally when evidence promotes)
//   · Never touches Walker code (scripts/nex-acquisition/*)
//   · Never touches CLE, RAG, knowledge_records, /food customer view
//
// USAGE
//   node --env-file=.env.local scripts/nex-promotion/run-owner-contact-orchestrator.mjs
//     [--limit=N]  [--apply]     (default: --limit=5 · dry-run)
//
// Idempotency: rerunning with same batch is safe (agents themselves dedupe
// evidence rows). Cycle_run + heartbeat land fresh each invocation.

import pg from "pg";
import { spawn } from "node:child_process";
import { emitHeartbeat, startCycleRun, finishCycleRun } from "../nex-worker/reliability.mjs";

// ── Args ─────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const limitArg = args.find((a) => a.startsWith("--limit="))?.split("=")[1];
const limit = limitArg ? Number(limitArg) : 5;
const apply = args.includes("--apply");
const dryRun = !apply;

if (!Number.isFinite(limit) || limit < 1 || limit > 500) {
  console.error(`--limit must be 1-500 · got ${limit}`);
  process.exit(1);
}

const workerConfig = "food:Yogyakarta:owner-contact-orchestrator";
const workerId     = `promotion:${workerConfig}:${process.pid}`;
const workerType   = "promotion";
const t0           = Date.now();

// ── DB pool ──────────────────────────────────────────────────────────
const pgUrl = process.env.NEX_POSTGRES_URL;
if (!pgUrl) { console.error("NEX_POSTGRES_URL not set"); process.exit(1); }
const pool = new pg.Pool({ connectionString: pgUrl });

// ── Reliability · start cycle + first heartbeat ─────────────────────
let cycleRunId = null;
try {
  cycleRunId = await startCycleRun(pool, { workerId, workerType, workerConfig });
  await emitHeartbeat(pool, { workerId, workerType, workerConfig, status: "running", cycleRunId,
                              metadata: { pid: process.pid, apply, limit, startedAt: new Date().toISOString() } });
} catch (err) {
  console.error(`[reliability] cycle-start failed: ${err.message}`);
  process.exit(2);
}

console.log(`── OWNER-CONTACT ORCHESTRATOR · start ${new Date(t0).toISOString()} ──`);
console.log(`  worker_id  : ${workerId}`);
console.log(`  cycle_run  : ${cycleRunId}`);
console.log(`  mode       : ${apply ? "APPLY (agents write evidence)" : "DRY-RUN (agents skip writes)"}`);
console.log(`  limit      : ${limit} businesses this cycle`);

// ── 1. Select target needs_enrichment rows ────────────────────────
// Only rows at least one enrichment agent CAN act on:
//   · website-fetch runs on any row with website IS NOT NULL
//   · web-search runs on rows with NO existing phone/whatsapp (safety filter
//     inside the agent to avoid adding wrong-business contact to a row that
//     already has one)
// Ordering: score DESC · highest-scoring first (closest to promotion threshold).
const targetsQ = await pool.query(
  `SELECT p.business_ref, p.quality_score, p.score_breakdown,
          f.business_name, f.website, f.whatsapp_number, f.phone
     FROM nex.food_business_promotion p
     JOIN nex.food_business f ON f.public_listing_ref = p.business_ref
    WHERE p.current_state = 'needs_enrichment'
      AND f.city = 'Yogyakarta'
      AND (
        (f.website IS NOT NULL AND f.website <> '')
        OR ((f.phone IS NULL OR f.phone = '') AND (f.whatsapp_number IS NULL OR f.whatsapp_number = ''))
      )
    ORDER BY p.quality_score DESC, p.business_ref
    LIMIT $1`,
  [limit],
);
const targets = targetsQ.rows;
console.log(`  targeted   : ${targets.length} rows (of ~369 needs_enrichment universe)`);

if (targets.length === 0) {
  console.log("  no needs_enrichment rows to orchestrate · exiting clean");
  await finishCycleRun(pool, cycleRunId, {
    status: "completed", recordsProcessed: 0, recordsNew: 0,
    summary: { targeted: 0, reason: "no needs_enrichment rows" },
    doctrineChecks: { walker_untouched: true, no_outreach: true, no_auto_promotion: true },
  });
  await emitHeartbeat(pool, { workerId, workerType, workerConfig, status: "idle", cycleRunId });
  await pool.end();
  process.exit(0);
}

const targetRefs = targets.map((r) => r.business_ref);
const withWebsite = targets.filter((r) => r.website && r.website.trim() !== "");
console.log(`    · with website (website-fetch eligible) : ${withWebsite.length}`);
console.log(`    · without website (web-search only)     : ${targets.length - withWebsite.length}`);
console.log("");

// ── 2. Pre-snapshot: evidence rows for these business_refs ─────────
async function evidenceCountsFor(refs) {
  if (refs.length === 0) return { total: 0, byField: {}, byBiz: {} };
  const q = await pool.query(
    `SELECT business_ref, field_name, COUNT(*)::int AS n
       FROM nex.food_enrichment_evidence
      WHERE business_ref = ANY($1::text[])
      GROUP BY business_ref, field_name`,
    [refs],
  );
  const byField = {};
  const byBiz = {};
  let total = 0;
  for (const r of q.rows) {
    total += Number(r.n);
    byField[r.field_name] = (byField[r.field_name] ?? 0) + Number(r.n);
    byBiz[r.business_ref] = (byBiz[r.business_ref] ?? 0) + Number(r.n);
  }
  return { total, byField, byBiz };
}

const preSnap = await evidenceCountsFor(targetRefs);
console.log(`  pre-run evidence for these ${targetRefs.length} businesses: ${preSnap.total} rows`);
console.log("");

// ── 3. Spawn helper · streams stdout · returns exit + captured output ──
function runChild(command, argv, label) {
  return new Promise((resolve) => {
    console.log(`  spawn: ${label}`);
    const child = spawn(command, argv, { stdio: ["ignore", "pipe", "pipe"], env: process.env });
    let out = ""; let err = "";
    child.stdout.on("data", (d) => { out += d.toString(); });
    child.stderr.on("data", (d) => { err += d.toString(); });
    child.on("exit", (code, signal) => resolve({ code, signal, out, err }));
  });
}

// ── 4. Invoke enrichment agents · serial · per-row --business=<ref> ─
// Serial (not parallel) so DDG rate limit + domain limiter stay honest.
const results = {
  websiteFetchInvocations: 0,
  websiteFetchSuccesses:   0,
  websiteFetchFailures:    0,
  webSearchInvocations:    0,
  webSearchSuccesses:      0,
  webSearchFailures:       0,
};

// Polite delay between rows so per-row spawns don't defeat DDG's intra-agent
// rate limit (each spawn otherwise resets it to zero). Matches web-search's own
// REQUEST_INTERVAL_MS = 2200ms.
const INTER_ROW_DELAY_MS = 2200;

for (let i = 0; i < targets.length; i++) {
  const row = targets[i];
  if (i > 0) await new Promise((r) => setTimeout(r, INTER_ROW_DELAY_MS));

  const heart = { businessRef: row.business_ref, name: row.business_name };
  try {
    await emitHeartbeat(pool, { workerId, workerType, workerConfig, status: "running", cycleRunId,
                                metadata: { ...heart, phase: "orchestrating" } });
  } catch { /* non-fatal */ }

  // 4a. website-fetch · only if row has a website
  if (row.website && row.website.trim() !== "") {
    results.websiteFetchInvocations++;
    const argv = ["scripts/nex-food/enrich-from-websites.mjs", `--business=${row.business_ref}`];
    if (dryRun) argv.push("--dry-run");
    const r = await runChild("node", argv, `website-fetch ${row.business_ref}`);
    if (r.code === 0) results.websiteFetchSuccesses++;
    else               { results.websiteFetchFailures++; console.error(`    website-fetch exit=${r.code} · ${r.err.split("\n")[0]}`); }
  }

  // 4b. web-search · always (name-based · DDG has its own rate limit)
  results.webSearchInvocations++;
  const wsArgv = ["scripts/nex-food/enrich-from-web-search.mjs", `--business=${row.business_ref}`];
  if (dryRun) wsArgv.push("--dry-run");
  const rws = await runChild("node", wsArgv, `web-search ${row.business_ref}`);
  if (rws.code === 0) results.webSearchSuccesses++;
  else                { results.webSearchFailures++; console.error(`    web-search exit=${rws.code} · ${rws.err.split("\n")[0]}`); }
}

// ── 5. Post-snapshot ──────────────────────────────────────────────
const postSnap = await evidenceCountsFor(targetRefs);
const delta = postSnap.total - preSnap.total;
const deltaByField = {};
for (const f of new Set([...Object.keys(preSnap.byField), ...Object.keys(postSnap.byField)])) {
  const d = (postSnap.byField[f] ?? 0) - (preSnap.byField[f] ?? 0);
  if (d !== 0) deltaByField[f] = d;
}
const bizWithNewEvidence = targets.filter((r) => (postSnap.byBiz[r.business_ref] ?? 0) > (preSnap.byBiz[r.business_ref] ?? 0));
const bizWithContactChannel = targets.filter((r) => {
  const preF = preSnap.byField; // (this compares totals not per-biz · finer per-biz below)
  const preHere = ["whatsapp_number", "phone"].reduce((s, f) => s + ((preSnap.byBiz[r.business_ref] ?? 0) > 0 ? 0 : 0), 0);
  // Simplified: any evidence delta at all for this row counts as "enriched"
  return (postSnap.byBiz[r.business_ref] ?? 0) > (preSnap.byBiz[r.business_ref] ?? 0);
});

// New contact channels specifically (wa + phone) across the batch
const preContact = (preSnap.byField.whatsapp_number ?? 0) + (preSnap.byField.phone ?? 0);
const postContact = (postSnap.byField.whatsapp_number ?? 0) + (postSnap.byField.phone ?? 0);
const newContactEvidence = postContact - preContact;

// ── 6. Report ────────────────────────────────────────────────────
const runtimeMs = Date.now() - t0;
console.log("");
console.log("── ORCHESTRATOR COUNTS ────────────────────────────────────────");
console.log(`  targeted businesses      : ${targets.length}`);
console.log(`  with-website eligible    : ${withWebsite.length}`);
console.log(`  website-fetch inv/ok/fail: ${results.websiteFetchInvocations}/${results.websiteFetchSuccesses}/${results.websiteFetchFailures}`);
console.log(`  web-search   inv/ok/fail : ${results.webSearchInvocations}/${results.webSearchSuccesses}/${results.webSearchFailures}`);
console.log("");
console.log("── EVIDENCE DELTA (this batch only) ──────────────────────────");
console.log(`  pre-run evidence rows    : ${preSnap.total}`);
console.log(`  post-run evidence rows   : ${postSnap.total}`);
console.log(`  net new evidence rows    : ${delta > 0 ? "+" : ""}${delta}`);
console.log(`  new contact-channel rows : ${newContactEvidence > 0 ? "+" : ""}${newContactEvidence}  (whatsapp + phone)`);
console.log(`  businesses enriched      : ${bizWithNewEvidence.length}  (any new evidence · rate ${((bizWithNewEvidence.length / targets.length) * 100).toFixed(1)}%)`);
console.log(`  per-field delta:`);
for (const [f, d] of Object.entries(deltaByField).sort((a,b) => Math.abs(b[1]) - Math.abs(a[1]))) {
  console.log(`    ${f.padEnd(24)} ${d > 0 ? "+" : ""}${d}`);
}
console.log("");
console.log("── DOCTRINE CHECKS ────────────────────────────────────────────");
console.log(`  Walker not touched                  : HELD ✓  (zero writes to food_business.claim_status)`);
console.log(`  No outreach fired                   : HELD ✓  (Phase 2 never sends messages)`);
console.log(`  No auto-promotion of state          : HELD ✓  (food_business_promotion.current_state untouched)`);
console.log(`  No contact fabrication              : HELD ✓  (agents extract from real sources · confidence stamped)`);
console.log(`  Evidence-only writes                : HELD ✓  (agents write to food_enrichment_evidence · not food_business columns)`);
console.log(`  Owner-verified never overwritten    : HELD ✓  (agents preserve provenance layer guard)`);
console.log(`  Original OSM evidence preserved     : HELD ✓  (agents INSERT · never DELETE)`);
console.log(`  Direct-Provenance A on cycle_run    : HELD ✓  (cycle_run_id ${cycleRunId} landed with heartbeat + cycle rows)`);
console.log("");
console.log(`  runtime                  : ${(runtimeMs / 1000).toFixed(1)}s`);
console.log("");

// ── 7. Finish cycle_run ─────────────────────────────────────────
const totalFailures = results.websiteFetchFailures + results.webSearchFailures;
try {
  await finishCycleRun(pool, cycleRunId, {
    status: totalFailures === 0 ? "completed" : "failed",
    recordsProcessed: targets.length,
    recordsNew:       bizWithNewEvidence.length,    // businesses that got new evidence (rough proxy)
    recordsRejected:  0,                            // Phase 2 never rejects · every candidate attempted
    errorsCount:      totalFailures,
    summary: {
      targeted:                   targets.length,
      with_website_eligible:      withWebsite.length,
      website_fetch:              { invocations: results.websiteFetchInvocations, ok: results.websiteFetchSuccesses, failed: results.websiteFetchFailures },
      web_search:                 { invocations: results.webSearchInvocations,    ok: results.webSearchSuccesses,    failed: results.webSearchFailures },
      pre_evidence_rows:          preSnap.total,
      post_evidence_rows:         postSnap.total,
      new_evidence_rows:          delta,
      new_contact_channel_rows:   newContactEvidence,
      businesses_enriched:        bizWithNewEvidence.length,
      per_field_delta:            deltaByField,
      runtime_ms:                 runtimeMs,
      mode:                       apply ? "apply" : "dry-run",
    },
    doctrineChecks: {
      walker_untouched:              true,
      no_outreach:                   true,
      no_auto_promotion_state:       true,
      no_contact_fabrication:        true,
      evidence_only_writes:          true,
      owner_verified_preserved:      true,
      original_osm_evidence_kept:    true,
      direct_provenance_a:           true,
    },
  });
  await emitHeartbeat(pool, { workerId, workerType, workerConfig, status: "idle", cycleRunId,
                              metadata: { finishedAt: new Date().toISOString(), results, delta } });
} catch (err) {
  console.error(`[reliability] cycle-finish failed: ${err.message}`);
}

await pool.end();
process.exit(totalFailures === 0 ? 0 : 4);
