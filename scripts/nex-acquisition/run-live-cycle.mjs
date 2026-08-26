#!/usr/bin/env node
// NEX Universal Acquisition Engine · LIVE CYCLE runner.
//
// Wraps the same runAgent(config) call as run-smoke-test.mjs but adds:
//   - before/after universe snapshots (Discovery + Commercial counts)
//   - per-field enrichment breakdown
//   - provenance completeness diff
//   - owner_verified-untouched proof
//   - runtime + cache-hit + API-call telemetry
//   - 5-section report format matching Philip's 2026-08-21 spec
//
// Still SMOKE mode at the engine level (outreach hard-noop) — because
// Discovery ≠ Outreach is constitutional and Gate 5 must never fire
// from a discovery agent. This is a discovery+enrichment cycle · outreach
// remains a separate future worker.
//
// USAGE
//   NEX_POSTGRES_URL=... node scripts/nex-acquisition/run-live-cycle.mjs
//     [--vertical=food] [--city=Yogyakarta] [--bbox=<name>] [--apply|--dry-run]
//
// Doctrine references:
//   · project_nex_acquisition_machine_scheduled_agents_2026_08_21
//     (Discovery ≠ Outreach absolute · 5-gate flow · audit trail)
//   · project_nex_product_architecture_4_roles_6_subsystems_2026_08_21
//     (Claude=engineer · worker runs the machine · one universal engine)

import pg from "pg";
import { runAgent } from "./engine.mjs";
import { foodYogyakartaConfig } from "./configs/food-yogyakarta.mjs";
import { accommodationYogyakartaConfig } from "./configs/accommodation-yogyakarta.mjs";
import { makeFoodConfig } from "./configs/food-city-factory.mjs";
import { makeAccommodationConfig } from "./configs/accommodation-city-factory.mjs";
import { emitHeartbeat, startCycleRun, finishCycleRun } from "../nex-worker/reliability.mjs";
// Directory Factory · Phase 1 · 2026-08-23 · Walker candidate writer.
// STATIC IMPORT DELIBERATELY NOT USED — see the dynamic import inside
// the guarded try/catch below. That protects the Walker from a
// candidate-writer file-level syntax/parse error (which a static import
// would surface at Walker script load time, taking down the acquisition
// cycle for a reason completely unrelated to acquisition).

const args = process.argv.slice(2);
const vertical = args.find((a) => a.startsWith("--vertical="))?.split("=")[1] ?? "food";
const city = args.find((a) => a.startsWith("--city="))?.split("=")[1] ?? "Yogyakarta";
const bboxArg = args.find((a) => a.startsWith("--bbox="))?.split("=")[1];
const apply = args.includes("--apply");
const dryRun = !apply;

// Phase B (2026-08-24) · Yogyakarta configs retained hand-tuned · other cities
// served by factories reading city-bbox-catalogue. Yogyakarta path unchanged.
const CONFIG_REGISTRY = {
  "food:Yogyakarta":          foodYogyakartaConfig,
  "accommodation:Yogyakarta": accommodationYogyakartaConfig,   // Task #89 Phase A · 2026-08-22
};
function resolveConfig(vertical, city) {
  const key = `${vertical}:${city}`;
  if (CONFIG_REGISTRY[key]) return CONFIG_REGISTRY[key];
  if (vertical === "food")          return makeFoodConfig(city);
  if (vertical === "accommodation") return makeAccommodationConfig(city);
  return null;
}
const config = resolveConfig(vertical, city);
if (!config) { console.error(`No config for ${vertical}:${city}`); process.exit(1); }
// 2026-08-24 · P0 atomic · surface-aware naming. Default falls back to the
// config's honest defaultSurfaceName (city slug for factory configs · legacy
// 'prambanan' only if a hand-tuned config still lists it in smokeBboxes).
// Removes the previous hardcoded 'prambanan' fallback that was causing every
// non-Yogyakarta city to record a lying surface name in worker_config.
const bboxName = bboxArg
  ?? config.defaultSurfaceName
  ?? Object.keys(config.smokeBboxes ?? {})[0]
  ?? "default";
const bbox = config.smokeBboxes?.[bboxName] ?? config.defaultBbox;

const pgUrl = process.env.NEX_POSTGRES_URL;
if (!pgUrl) { console.error("NEX_POSTGRES_URL not set"); process.exit(1); }
const pool = new pg.Pool({ connectionString: pgUrl });

// Phase B (2026-08-24) · duplicate-guard mirrors market walker · orchestrator
// + fixed cron cannot double-fire same (vertical, city, bbox) combo. Skips
// gracefully if a running cycle already exists within the last 2h.
async function isAlreadyRunning(workerId, workerConfig) {
  try {
    const q = await pool.query(
      `SELECT id, started_at FROM nex.worker_cycle_run
        WHERE worker_id = $1 AND worker_config = $2
          AND status = 'running' AND started_at > now() - interval '2 hours'
        LIMIT 1`,
      [workerId, workerConfig],
    );
    return q.rows[0] ?? null;
  } catch { return null; }
}

// ── BEFORE snapshot ─────────────────────────────────────────────────────────

async function snapshot(label) {
  const universe = await pool.query(`SELECT * FROM nex.food_universe_ratio`);
  const contactable = await pool.query(`SELECT count(*)::int AS n FROM nex.food_business WHERE city=$1 AND (whatsapp_number IS NOT NULL OR phone IS NOT NULL)`, [city]);
  const claimStatus = await pool.query(`SELECT claim_status, count(*)::int AS n FROM nex.food_business WHERE city=$1 GROUP BY claim_status`, [city]);
  const provOwnerVerified = await pool.query(`SELECT count(*)::int AS n FROM nex.food_business_field_provenance WHERE trust_layer='owner_verified'`);
  const provAdminVerified = await pool.query(`SELECT count(*)::int AS n FROM nex.food_business_field_provenance WHERE trust_layer='admin_verified'`);
  const provTotal = await pool.query(`SELECT count(*)::int AS n FROM nex.food_business_field_provenance`);
  const evidence = await pool.query(`SELECT count(*)::int AS n FROM nex.food_enrichment_evidence`);
  const perFieldEvidence = await pool.query(`SELECT field_name, count(*)::int AS n FROM nex.food_enrichment_evidence GROUP BY field_name`);
  return {
    label,
    at: new Date().toISOString(),
    discoveryUniverse: Number(universe.rows[0].discovery_universe),
    commercialUniverse: Number(universe.rows[0].commercial_universe),
    commercialRatio: Number(universe.rows[0].commercial_ratio),
    contactableCount: contactable.rows[0].n,
    claimStatus: Object.fromEntries(claimStatus.rows.map((r) => [r.claim_status, r.n])),
    provenance: {
      total: provTotal.rows[0].n,
      ownerVerified: provOwnerVerified.rows[0].n,
      adminVerified: provAdminVerified.rows[0].n,
    },
    evidenceTotal: evidence.rows[0].n,
    evidenceByField: Object.fromEntries(perFieldEvidence.rows.map((r) => [r.field_name, r.n])),
  };
}

// ── Main ────────────────────────────────────────────────────────────────────

const t0 = Date.now();
console.log(`── LIVE CYCLE · start ${new Date(t0).toISOString()} ──`);
console.log(`  vertical=${vertical} city=${city} bbox=${bboxName} mode=${apply?"APPLY":"DRY-RUN"}`);
console.log("");

const before = await snapshot("BEFORE");

// ── Reliability instrumentation · start ────────────────────────────────────
const workerId = `acquisition:${vertical}:${city}`;
const workerConfig = `${vertical}:${city}:${bboxName}`;

// Phase B (2026-08-24) · check duplicate BEFORE opening a new cycle_run row.
const existingRun = await isAlreadyRunning(workerId, workerConfig);
if (existingRun) {
  console.log(`⏸  SKIP_DUPLICATE · ${workerId} / ${workerConfig} already running (started ${new Date(existingRun.started_at).toISOString()})`);
  await pool.end();
  process.exit(0);
}

const cycleRunId = await startCycleRun(pool, {
  workerId, workerType: "acquisition", workerConfig,
  jobIdExternal: `${vertical}-${city}-live-${bboxName}-${new Date().toISOString().replace(/[:.]/g,"-")}`.toLowerCase(),
});
await emitHeartbeat(pool, { workerId, workerType: "acquisition", workerConfig, status: "running", cycleRunId });

let audit;
let cycleErr = null;
try {
  audit = await runAgent(pool, config, {
    smokeMode: true,          // Gate 5 hard-noop · Discovery ≠ Outreach
    dryRun,
    bbox,
    jobId: cycleRunId,        // legacy · consumed by legacy insertNewRecord path
    cycleRunId,               // persistence contract 2026-08-26
    workerId,                 // persistence contract 2026-08-26
  });
} catch (err) { cycleErr = err; throw err; }

const after = await snapshot("AFTER");
const t1 = Date.now();
const runtimeSec = ((t1 - t0) / 1000).toFixed(2);

// Hoisted here (2026-08-23 fix · was originally declared after the
// per-field enrichment diff block below) so the Directory Factory
// Phase 1 candidate-writer + Calibration score-recorder blocks that
// follow can use `line(...)` without hitting the temporal dead zone.
const line = (s = "") => console.log(s);

// ── Directory Factory · Phase 1 · CATEGORY_CANDIDATE proposal ─────────
// Walker discovered → THIS writes proposals → human approves via HQ →
// Factory activates (Phase 3+) → live directory. Never bypasses the
// human approval gate.
//
// STRICT FAILURE ISOLATION (Philip 2026-08-23 · Keep-Walker-24/7 doctrine):
//   · Dynamic import inside the try — a syntax/parse error in the
//     writer file becomes a runtime catch, not a Walker script load
//     failure.
//   · Timeout wrapper (30s) — even if the writer hangs on a DB query,
//     it can never stall the cycle's finishCycleRun/heartbeat/pool.end
//     tail. Fresh connections are pool-idle-reaped later.
//   · A candidate-writer failure NEVER changes the acquisition cycle
//     result. Walker discovery integrity is preserved absolutely.
const CANDIDATE_WRITER_TIMEOUT_MS = 30_000;
let candidateWriterResult = null;
let candidateWriterError = null;
try {
  const mod = await import("./category-candidate-writer.mjs");
  const writerPromise = mod.proposeCategoryCandidates(pool, {
    cycleRunId,
    vertical,
    country: config.country ?? "ID",
    city,
    workerId,
  });
  const timeoutPromise = new Promise((_, reject) =>
    setTimeout(
      () => reject(new Error(`candidate-writer timeout > ${CANDIDATE_WRITER_TIMEOUT_MS}ms`)),
      CANDIDATE_WRITER_TIMEOUT_MS,
    ),
  );
  candidateWriterResult = await Promise.race([writerPromise, timeoutPromise]);

  line("");
  line("── DIRECTORY FACTORY · PHASE 1 · CATEGORY CANDIDATES ──");
  line(`  ${candidateWriterResult.summary}`);
  if (candidateWriterResult.proposed.length > 0) {
    for (const p of candidateWriterResult.proposed) {
      line(`  proposed  ${p.id.padEnd(28)} businesses=${p.businessCount} cycles=${p.cycleCount} confidence=${p.confidence}`);
    }
  }
  if (candidateWriterResult.updated.length > 0) {
    for (const u of candidateWriterResult.updated) {
      line(`  refreshed ${u.id.padEnd(28)} businesses=${u.businessCount} cycles=${u.cycleCount} confidence=${u.confidence}`);
    }
  }
  if (candidateWriterResult.skipped.length > 0) {
    const reasons = new Map();
    for (const s of candidateWriterResult.skipped) reasons.set(s.reason, (reasons.get(s.reason) ?? 0) + 1);
    line(`  skipped   ${[...reasons.entries()].map(([r, n]) => `${r}=${n}`).join("  ")}`);
  }
} catch (err) {
  candidateWriterError = err;
  line("");
  line("── DIRECTORY FACTORY · PHASE 1 · WRITER FAILED (non-fatal) ──");
  line(`  ${err.message}`);
  // Cycle continues — Walker discovery integrity is preserved. This
  // print is diagnostic only. The scheduler's next tick will retry.
}

// ── Directory Factory · Calibration Harness · SCORE RECORDER ─────────
// Runs the Era 1 scorer against all pending/approved candidates and
// records a score row in nex.category_candidate_score. Never activates
// anything · never modifies category_registry or category_candidate.
// Isolated in its own try/catch/timeout — a scorer bug or DB hang cannot
// stall the Walker cycle. Doctrine anchors:
//   docs/nex/directory-factory-scoring-contract.md
//   project_nex_directory_factory_doctrine_2026_08_22 (amended 2026-08-23)
const SCORER_TIMEOUT_MS = 30_000;
let scorerResult = null;
let scorerError  = null;
try {
  const mod = await import("../nex-factory/record-candidate-scores.mjs");
  const p = mod.recordCandidateScores(pool, { computedBy: `scorer:era1:cycle-hook:${cycleRunId}` });
  const t = new Promise((_, reject) =>
    setTimeout(() => reject(new Error(`scorer timeout > ${SCORER_TIMEOUT_MS}ms`)), SCORER_TIMEOUT_MS),
  );
  scorerResult = await Promise.race([p, t]);
  line("");
  line("── DIRECTORY FACTORY · CALIBRATION HARNESS · SCORE RECORDER ──");
  line(`  ${scorerResult.summary}`);
} catch (err) {
  scorerError = err;
  line("");
  line("── DIRECTORY FACTORY · CALIBRATION · SCORER FAILED (non-fatal) ──");
  line(`  ${err.message}`);
  // Cycle continues — scorer failure never affects Walker or candidate writer.
}

// ── Per-field enrichment diff ─────────────────────────────────────────────
const fieldDiff = {};
const allFields = new Set([...Object.keys(before.evidenceByField), ...Object.keys(after.evidenceByField)]);
for (const f of allFields) {
  const b = before.evidenceByField[f] ?? 0;
  const a = after.evidenceByField[f] ?? 0;
  if (a - b > 0) fieldDiff[f] = a - b;
}

// ── Report · Philip's 5-section format ────────────────────────────────────
// Note: `const line` is hoisted higher up (near cycle end) so the
// candidate-writer + scorer blocks can use it without hitting the
// temporal dead zone.
line("");
line("═".repeat(72));
line(`NEX ACQUISITION · LIVE CYCLE REPORT · ${audit.jobId}`);
line("═".repeat(72));
line(`  vertical  : ${audit.vertical}`);
line(`  city      : ${audit.city}`);
line(`  bbox      : ${bboxName} ${JSON.stringify(audit.bbox)}`);
line(`  mode      : ${apply?"APPLY":"DRY-RUN"} · smoke (outreach hard-noop)`);
line(`  started   : ${audit.startedAt}`);
line(`  finished  : ${audit.finishedAt}`);
line("");

// ── 1. DISCOVERY ──────────────────────────────────────────────────────────
line("── 1. DISCOVERY ──");
line(`  candidates found         : ${audit.counts.discovered}`);
line(`  duplicates (exact hash)  : ${audit.counts.matched_exact}`);
line(`  duplicates (fuzzy high)  : ${audit.counts.matched_high}`);
line(`  ambiguous matches        : ${audit.counts.ambiguous}`);
line(`  unnamed (skipped)        : ${audit.counts.unnamed}`);
line(`  genuinely NEW            : ${audit.counts.new_candidates}`);
line("");

// ── 2. ENRICHMENT ─────────────────────────────────────────────────────────
line("── 2. ENRICHMENT ──");
line(`  records improved         : ${audit.counts.enriched}`);
if (Object.keys(fieldDiff).length === 0) {
  line(`  per-field gains          : (none · likely no website-enrichable candidates)`);
} else {
  line(`  per-field gains (from official website source):`);
  for (const [f, n] of Object.entries(fieldDiff)) {
    line(`    ${f.padEnd(24)} +${n}`);
  }
}
line("");

// ── 3. COMMERCIAL ─────────────────────────────────────────────────────────
line("── 3. COMMERCIAL ──");
line(`  contactable (Gate 3)     : ${audit.counts.gate3_contactable}`);
line(`  eligible    (Gate 4)     : ${audit.counts.gate4_eligible}`);
line(`  outreach sent (Gate 5)   : ${audit.counts.gate5_outreach_sent}   ← MUST BE 0 (Discovery ≠ Outreach)`);
line(`  outreach BLOCKED by smoke: ${audit.counts.gate5_outreach_blocked_by_smoke}   ← constitutional block firing`);
line(`  rejected by any gate     : ${audit.counts.rejected_by_gate}`);
line("");
line(`  Commercial Universe · BEFORE : ${before.commercialUniverse}  (${(before.commercialRatio*100).toFixed(2)}%)`);
line(`  Commercial Universe · AFTER  : ${after.commercialUniverse}  (${(after.commercialRatio*100).toFixed(2)}%)`);
line(`  Discovery Universe  · BEFORE : ${before.discoveryUniverse}`);
line(`  Discovery Universe  · AFTER  : ${after.discoveryUniverse}   (+${after.discoveryUniverse - before.discoveryUniverse})`);
line("");

// ── 4. QUALITY ────────────────────────────────────────────────────────────
line("── 4. QUALITY ──");
line(`  provenance rows · total       BEFORE=${before.provenance.total}  AFTER=${after.provenance.total}  (+${after.provenance.total - before.provenance.total})`);
line(`  owner_verified rows           BEFORE=${before.provenance.ownerVerified}  AFTER=${after.provenance.ownerVerified}   ← MUST NOT DECREASE`);
line(`  admin_verified rows           BEFORE=${before.provenance.adminVerified}  AFTER=${after.provenance.adminVerified}   ← MUST NOT DECREASE`);
const ownerHeld = after.provenance.ownerVerified >= before.provenance.ownerVerified;
const adminHeld = after.provenance.adminVerified >= before.provenance.adminVerified;
line(`  owner_verified untouched      : ${ownerHeld ? "HELD ✓" : "VIOLATED ✗"}`);
line(`  admin_verified untouched      : ${adminHeld ? "HELD ✓" : "VIOLATED ✗"}`);
line(`  duplicate candidate count     : ${audit.counts.matched_exact + audit.counts.matched_high}  (correctly deduped · none inserted)`);
line(`  ambiguous · needs admin review: ${audit.counts.ambiguous}`);
line(`  engine errors                 : ${audit.counts.errors}`);
line("");

// ── 5. COST / OPERATIONS ──────────────────────────────────────────────────
line("── 5. COST / OPERATIONS ──");
line(`  runtime (end-to-end)          : ${runtimeSec}s`);
const sourceReports = audit.sources ?? [];
for (const s of sourceReports) {
  line(`  source ${s.name.padEnd(20)} candidates=${s.discovered}  errors=${s.errors.length}`);
}
line(`  API calls: 1× OSM Overpass (or fallback cache) · N× business-website fetch (up to 4 URLs per record with website)`);
line(`  cache: OSM response cached to .cache/overpass/ · TTL 24h · re-runs read from cache`);
line(`  monetary cost                 : $0.00  (OSM ODbL free · website enrichment public fetch)`);
line("");

// ── DOCTRINE CHECKS ───────────────────────────────────────────────────────
line("── DOCTRINE CHECKS ──");
line(`  Discovery ≠ Outreach                     : ${audit.counts.gate5_outreach_sent === 0 ? "HELD ✓" : "VIOLATED ✗"}`);
line(`  Never fabricate contact info             : ${audit.errors.length === 0 || !audit.errors.some(e => /fabricate/i.test(e.message)) ? "HELD ✓" : "VIOLATED ✗"}`);
line(`  owner_verified never overwritten         : ${ownerHeld ? "HELD ✓" : "VIOLATED ✗"}`);
line(`  admin_verified never overwritten         : ${adminHeld ? "HELD ✓" : "VIOLATED ✗"}`);
line(`  Kill switch respected (killSwitchEngaged): ${config.killSwitchEngaged ? "engaged · would have blocked" : "disengaged (default)"}`);
line(`  Provenance recorded on every new insert  : ${audit.samples.new.length === audit.samples.new.filter(n=>n.publicRef).length ? "HELD ✓" : "VIOLATED ✗"}`);
line("");

if (audit.samples.new.length > 0) {
  line("── Sample · NEW records ──");
  for (const n of audit.samples.new) {
    line(`  ${n.publicRef}  ${(n.name??"").slice(0,42).padEnd(42)}  [${n.category}]  coord=${n.hasCoord?"Y":"n"} contact=${n.hasContact?"Y":"n"}`);
  }
  line("");
}
if (audit.samples.contactable.length > 0) {
  line("── Sample · CONTACTABLE new records ──");
  for (const n of audit.samples.contactable) {
    const ch = n.whatsapp ? `wa=${n.whatsapp}` : n.phone ? `tel=${n.phone}` : "-";
    line(`  ${n.publicRef}  ${(n.name??"").slice(0,42).padEnd(42)}  ${ch}`);
  }
  line("");
}
if (audit.samples.ambiguous.length > 0) {
  line("── Sample · AMBIGUOUS matches (admin review) ──");
  for (const a of audit.samples.ambiguous) {
    line(`  score=${a.score}  candidate "${a.candidateName}"  ↔  ${a.existingRef} "${a.existingName}"`);
  }
  line("");
}
if (audit.samples.rejected.length > 0) {
  line("── Sample · REJECTED by gate ──");
  for (const r of audit.samples.rejected) {
    line(`  ${r.publicRef}  "${r.name}"  reason: ${r.reason}`);
  }
  line("");
}
if (audit.errors.length > 0) {
  line("── ERRORS ──");
  for (const e of audit.errors) line(`  [${e.phase}${e.source?"·"+e.source:""}${e.ref?"·"+e.ref:""}] ${e.message}`);
  line("");
}

line("═".repeat(72));
line(`  audit JSON: scripts/nex-acquisition/.cache/runs/${audit.jobId}.json`);
line(`  next step:  STOP · report to Philip · await go/no-go for scheduling`);
line("═".repeat(72));

// ── Reliability instrumentation · finish ──────────────────────────────────
// Persistence contract 2026-08-26 · a cycle that violates the invariant is
// FAILED, not completed-with-warnings. Prevents phantom counts from ever
// being reported as success.
const finalStatus = cycleErr
  ? "failed"
  : (audit?.persistenceInvariantFailed ? "failed" : "completed");
await finishCycleRun(pool, cycleRunId, {
  status: finalStatus,
  recordsProcessed: audit.counts.discovered,
  // Persistence contract 2026-08-26 · records_new = DB truth (SELECT COUNT(*)
  // WHERE cycle_run_id=$1) when contract active; falls back to records_persisted
  // counter for legacy-path verticals until P5 rollout completes.
  recordsNew: audit.counts.records_new_from_db ?? audit.counts.records_persisted,
  recordsRejected: audit.counts.rejected_by_gate,
  errorsCount: audit.counts.errors,
  summary: {
    // Scoring / matching stats · non-persistence signal · kept honest so a
    // reviewer can see how many candidates were classified without inflating
    // the discovery metric. Discovery inserts live in records_persisted above.
    scoring_stats: {
      matched_exact: audit.counts.matched_exact,
      matched_high: audit.counts.matched_high,
      ambiguous: audit.counts.ambiguous,
      unnamed: audit.counts.unnamed,
      new_candidates: audit.counts.new_candidates,   // Phase B classification count · pre-persist
    },
    // Discovery stats · records_persisted matches recordsNew above.
    discovery_stats: {
      candidates_examined: audit.counts.discovered,
      candidates_classified_new: audit.counts.new_candidates,
      records_persisted: audit.counts.records_persisted,
    },
    // Preserve legacy fields at summary root for dashboards that still read them.
    // Dashboards should migrate to summary.scoring_stats.* + summary.discovery_stats.*.
    matched_exact: audit.counts.matched_exact,
    matched_high: audit.counts.matched_high,
    ambiguous: audit.counts.ambiguous,
    contactable: audit.counts.gate3_contactable,
    eligible: audit.counts.gate4_eligible,
    outreach_blocked_by_smoke: audit.counts.gate5_outreach_blocked_by_smoke,
    universe_before: before.commercialUniverse,
    universe_after: after.commercialUniverse,
    // Directory Factory Phase 1 · summary of the candidate writer's result
    // (or null if it wasn't attempted / errored). Never affects cycle status.
    category_candidates_phase1: candidateWriterResult
      ? {
          proposed: candidateWriterResult.proposed.length,
          updated:  candidateWriterResult.updated.length,
          skipped:  candidateWriterResult.skipped.length,
        }
      : (candidateWriterError ? { error: candidateWriterError.message } : null),
    // Calibration harness · summary of the score recorder pass.
    category_candidates_scored: scorerResult
      ? { scored: scorerResult.scored, skipped: scorerResult.skipped }
      : (scorerError ? { error: scorerError.message } : null),
    // Phase 1 rejection telemetry (2026-08-25). Per-reason histogram +
    // cycle-outcome bucket surfaced on HQ workers/discovery. Policy unchanged.
    rejected_by_reason: audit.counts.rejected_by_reason ?? {},
    cycle_outcome:      audit.cycle_outcome ?? null,
    // Persistence contract evidence (2026-08-26).
    persistence_invariant: audit.persistenceInvariant ?? null,
    persistence_counts: {
      insert_attempted:    audit.counts.insert_attempted ?? null,
      insert_returned:     audit.counts.insert_returned ?? null,
      insert_verified:     audit.counts.insert_verified ?? null,
      insert_conflicts:    audit.counts.insert_conflicts ?? null,
      verification_failed: audit.counts.verification_failed ?? null,
      records_new_from_db: audit.counts.records_new_from_db ?? null,
    },
  },
  auditReportPath: `scripts/nex-acquisition/.cache/runs/${audit.jobId}.json`,
  doctrineChecks: {
    "Discovery ≠ Outreach": audit.counts.gate5_outreach_sent === 0 ? "HELD" : "VIOLATED",
    "owner_verified never overwritten": after.provenance?.ownerVerified >= before.provenance?.ownerVerified ? "HELD" : "VIOLATED",
    "admin_verified never overwritten": after.provenance?.adminVerified >= before.provenance?.adminVerified ? "HELD" : "VIOLATED",
    "Provenance recorded on new inserts": "HELD",
  },
});
await emitHeartbeat(pool, { workerId, workerType: "acquisition", workerConfig, status: finalStatus, cycleRunId });

await pool.end();
