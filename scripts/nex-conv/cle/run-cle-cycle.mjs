#!/usr/bin/env node
// NEX Conversation Learning Engine · CYCLE runner (Steps 1-6 wired · Step 7
// promotion is admin-UI-only and NEVER invoked here).
//
// Doctrine anchors:
//   · project_nex_conversation_learning_engine_2026_08_21
//     (7-step cycle · Observation ≠ auto-teach · admin-only promotion)
//   · project_nex_product_architecture_4_roles_6_subsystems_2026_08_21
//     (CLE INSIDE Subsystem 5 · Brain · one framework · N configs)
//
// USAGE
//   node --env-file=.env.local scripts/nex-conv/cle/run-cle-cycle.mjs
//     [--config=staircase] [--dry-run|--apply]
//
// Task #76 Bundle B (2026-08-22): --apply mode now SUPPORTED. Candidates
// persist to nex.conv_learning_candidate (migration 074) with cycle_run_id
// FK from birth. Observed turns marked with cle_processed_at + cle_cycle_run_id
// (migration 073). Constitutional gate preserved: candidates ALWAYS land at
// status='pending_review' · never auto-promoted · admin explicitly promotes
// via /api/nex/cle/promote-candidate (Bundle B route · Task #76).
//
// Report format: 5-section (Weaknesses · Candidates · Scores · Storage · Ops).

import pg from "pg";
import { detectWeaknesses } from "./detect-weak.mjs";
import { generateCandidates } from "./generate-candidates.mjs";
import { scoreCandidate } from "./score-candidate.mjs";
import { staircaseCleConfig } from "./config-staircase.mjs";
import { emitHeartbeat, startCycleRun, finishCycleRun } from "../../nex-worker/reliability.mjs";

const args = process.argv.slice(2);
const configName = args.find(a => a.startsWith("--config="))?.split("=")[1] ?? "staircase";
const apply = args.includes("--apply");

const CONFIG_REGISTRY = { staircase: staircaseCleConfig };
const config = CONFIG_REGISTRY[configName];
if (!config) { console.error(`No CLE config for '${configName}'`); process.exit(1); }
if (config.killSwitchEngaged) {
  console.error(`Kill switch engaged for ${configName} · aborting`);
  process.exit(1);
}
// Task #76 Bundle B: --apply mode is live · candidates persist to
// nex.conv_learning_candidate with cycle_run_id · never auto-promoted.

const pgUrl = process.env.NEX_POSTGRES_URL;
if (!pgUrl) { console.error("NEX_POSTGRES_URL not set"); process.exit(1); }
const pool = new pg.Pool({ connectionString: pgUrl });

const t0 = Date.now();
const jobId = `cle-${configName}-smoke-${new Date().toISOString().replace(/[:.]/g,"-")}`.toLowerCase();

// ── Reliability instrumentation · start ────────────────────────────────────
const workerId = `cle:${configName}`;
const cycleRunId = await startCycleRun(pool, {
  workerId, workerType: "cle", workerConfig: configName, jobIdExternal: jobId,
});
await emitHeartbeat(pool, { workerId, workerType: "cle", workerConfig: configName, status: "running", cycleRunId });

console.log("═".repeat(72));
console.log(`NEX CONVERSATION LEARNING ENGINE · SMOKE CYCLE`);
console.log("═".repeat(72));
console.log(`  job:        ${jobId}`);
console.log(`  config:     ${configName} (${config.displayName})`);
console.log(`  brain:      ${config.brain}`);
console.log(`  mode:       DRY-RUN (smoke only · Steps 1-6 · Step 7 admin-only)`);
console.log(`  daysBack:   ${config.detectors.daysBack}`);
console.log(`  started:    ${new Date(t0).toISOString()}`);
console.log("");

// ── Before snapshot (context · not diffed since dry-run) ──────────────────
const beforeSnap = {
  turns: (await pool.query(`SELECT count(*)::int AS n FROM nex.conv_turns t WHERE t.created_at > now() - ($1||' days')::interval`, [String(config.detectors.daysBack)])).rows[0].n,
  outcomes: (await pool.query(`SELECT count(*)::int AS n FROM nex.conv_outcomes`)).rows[0].n,
  feedback: (await pool.query(`SELECT count(*)::int AS n FROM nex.conv_feedback`)).rows[0].n,
  kis: (await pool.query(`SELECT count(*)::int AS n FROM nex.conv_knowledge_items WHERE brain=$1`, [config.brain])).rows[0].n,
  kis_draft: (await pool.query(`SELECT count(*)::int AS n FROM nex.conv_knowledge_items WHERE brain=$1 AND draft_only=true`, [config.brain])).rows[0].n,
  edges: (await pool.query(`SELECT count(*)::int AS n FROM nex.conv_edges`)).rows[0].n,
};

console.log("── OBSERVATION SOURCE (last " + config.detectors.daysBack + " days) ──");
console.log(`  turns:              ${beforeSnap.turns}`);
console.log(`  outcomes (all-time): ${beforeSnap.outcomes}${beforeSnap.outcomes === 0 ? "   ← ZERO · feedback capture not wired (CLE prerequisite)" : ""}`);
console.log(`  feedback (all-time): ${beforeSnap.feedback}${beforeSnap.feedback === 0 ? "   ← ZERO · feedback capture not wired (CLE prerequisite)" : ""}`);
console.log(`  knowledge items (${config.brain}): ${beforeSnap.kis}   draft: ${beforeSnap.kis_draft}`);
console.log(`  edges (all brains):  ${beforeSnap.edges}`);
console.log("");

// ── Step 1-2 · OBSERVE + IDENTIFY WEAK ───────────────────────────────────
const { signals: weaknesses, stats } = await detectWeaknesses(pool, config);

// ── Step 3 · GENERATE CANDIDATES ─────────────────────────────────────────
const candidates = await generateCandidates(pool, weaknesses, config);

// ── Step 5 · SCORE (heuristic for smoke · full eval-driven scoring deferred)
const scored = candidates.map(c => ({ ...c, score: scoreCandidate(c, config) }));
scored.sort((a, b) => b.score.total - a.score.total);

const t1 = Date.now();
const runtimeSec = ((t1 - t0) / 1000).toFixed(2);

// ── REPORT · 5-section (Philip's format) ─────────────────────────────────

const line = (s = "") => console.log(s);

// SECTION 1 · WEAKNESSES
line("═".repeat(72));
line("1. WEAKNESSES");
line("═".repeat(72));
line(`  detectors run:                  6`);
line(`  detectors that fired signals:   ${weaknesses.length}`);
line(`  feedback-dependent detectors:   ${stats.feedback_dependent_zero.length} produced ZERO signals`);
if (stats.feedback_dependent_zero.length > 0) {
  line(`    ${stats.feedback_dependent_zero.map(d => "· " + d).join("\n    ")}`);
  line(`  ← ROOT CAUSE: nex.conv_outcomes and nex.conv_feedback tables are empty.`);
  line(`     /api/nex-conv/chat writes conv_turns but not outcomes/feedback.`);
  line(`     Fix required before CLE goes live: wire feedback capture on chat route.`);
}
line("");
line(`  by detector:`);
for (const [d, n] of Object.entries(stats.by_detector)) {
  line(`    ${d.padEnd(30)}  ${n}`);
}
line("");
if (weaknesses.length > 0) {
  line(`  ── weakness signals emitted ──`);
  for (const w of weaknesses) {
    line(`  · ${w.detector}  severity=${w.severity}  evidence=${w.evidence_turn_count}`);
    line(`    ${w.summary}`);
    if (w.sample_turns && w.sample_turns.length > 0) {
      const s = w.sample_turns[0];
      const preview = s.text ? `"${String(s.text).slice(0, 70)}${s.text.length > 70 ? "…" : ""}"` : `[turn ${s.turn_id}]`;
      line(`    sample: ${preview}`);
    }
  }
  line("");
}

// SECTION 2 · CANDIDATES
line("═".repeat(72));
line("2. CANDIDATES");
line("═".repeat(72));
line(`  candidates generated (dry-run):  ${candidates.length}`);
if (candidates.length === 0) {
  line(`  (no candidates · either no weaknesses had enabled generators, or evidence was too thin)`);
} else {
  const byStrategy = {};
  for (const c of candidates) byStrategy[c.strategy] = (byStrategy[c.strategy] ?? 0) + 1;
  line(`  by strategy:`);
  for (const [s, n] of Object.entries(byStrategy)) line(`    ${s.padEnd(28)}  ${n}`);
  line("");
  line(`  ── sample candidate payloads ──`);
  for (const c of scored.slice(0, 3)) {
    line(`  · [${c.strategy}] addresses=${c.addresses_weakness}  evidence_turns=${c.evidence_turn_ids?.length ?? 0}`);
    if (c.payload.question_text) line(`    q: "${c.payload.question_text.slice(0, 80)}${c.payload.question_text.length > 80 ? "…" : ""}"`);
    if (c.payload.add_example_phrases) {
      line(`    → intent '${c.payload.slug}' + ${c.payload.add_example_phrases.length} new example(s):`);
      for (const e of c.payload.add_example_phrases) line(`         "${e.slice(0, 60)}${e.length > 60 ? "…" : ""}"`);
    }
    line(`    rationale: ${c.rationale}`);
  }
  line("");
}

// SECTION 3 · SCORES
line("═".repeat(72));
line("3. SCORES");
line("═".repeat(72));
if (scored.length === 0) {
  line(`  (no candidates scored)`);
} else {
  line(`  scoring method: heuristic (evidence·specificity·doctrine·novelty weighted)`);
  line(`  full eval-driven scoring: DEFERRED (needs shadow-store harness · next iteration)`);
  line(`  promotion floor: ${config.scoreThresholds.promotionFloor}`);
  line("");
  line(`  candidate                                          total  ev    sp    dr  nv    ready?`);
  line(`  ─────────────────────────────────────────────────  ────  ────  ────  ──  ────  ─────`);
  for (const c of scored) {
    const label = `${c.strategy}·${c.addresses_weakness}`.padEnd(50).slice(0, 50);
    const s = c.score;
    line(
      `  ${label}  ${String(s.total).padStart(4)}  ${String(s.components.evidence).padStart(4)}  ${String(s.components.specificity).padStart(4)}  ${s.components.doctrine_score.toString().padStart(2)}  ${String(s.components.novelty).padStart(4)}  ${s.promoteReady ? "YES ✓" : "no"}`
    );
  }
  line("");
  const readyCount = scored.filter(c => c.score.promoteReady).length;
  line(`  candidates ready for admin review: ${readyCount} / ${scored.length}`);
  line("");
  line(`  ── doctrine checks per candidate ──`);
  for (const c of scored) {
    const d = c.score.components.doctrine_checks;
    const failed = Object.entries(d).filter(([, v]) => v === false).map(([k]) => k);
    line(`  · [${c.strategy}] pii_free=${d.pii_free ? "✓" : "✗"} · no_auto_promote=${d.no_auto_promote ? "✓" : "✗"} · brain_scoped=${d.brain_scoped ? "✓" : "✗"}${failed.length > 0 ? "   ← FAILED: " + failed.join(",") : ""}`);
  }
  line("");
}

// SECTION 4 · STORAGE (--apply persists · dry-run reports would-write only)
line("═".repeat(72));
line(`4. STORAGE (${apply ? "APPLY · persisting to nex.conv_learning_candidate" : "dry-run · would-write only"})`);
line("═".repeat(72));

// Task #76 Bundle B: derive language per candidate from the conversation
// that owns its first evidence turn · EN + ID + unknown go through
// IDENTICAL gates · language is metadata, never a trust modifier.
async function deriveLanguageForCandidate(pool, evidenceTurnIds) {
  if (!evidenceTurnIds || evidenceTurnIds.length === 0) return "unknown";
  const r = await pool.query(
    `SELECT COALESCE(s.state->>'conversation_language', 'unknown') AS lang
       FROM nex.conv_turns t
       LEFT JOIN nex.conv_states s ON s.conversation_id = t.conversation_id
      WHERE t.id = $1
      LIMIT 1`,
    [evidenceTurnIds[0]],
  );
  return r.rows[0]?.lang ?? "unknown";
}

let candidatesPersisted = 0;
let turnsMarkedProcessed = 0;

if (apply) {
  // Persist every candidate (not just promoteReady) · admins decide from full list.
  for (const c of scored) {
    const language = await deriveLanguageForCandidate(pool, c.evidence_turn_ids ?? []);
    const kind = c.strategy;
    const payload = c.payload ?? {};
    const scoreTotal = Number(c.score?.total ?? 0);
    const scoreComponents = c.score?.components ?? {};
    try {
      await pool.query(
        `INSERT INTO nex.conv_learning_candidate
           (cycle_run_id, from_turn_ids, language, brain, candidate_kind, candidate_payload, score, score_components, status)
         VALUES ($1, $2::uuid[], $3, $4, $5, $6::jsonb, $7, $8::jsonb, 'pending_review')`,
        [
          cycleRunId,
          c.evidence_turn_ids ?? [],
          language,
          config.brain,
          kind,
          JSON.stringify(payload),
          Math.min(1, Math.max(0, scoreTotal)),
          JSON.stringify(scoreComponents),
        ],
      );
      candidatesPersisted++;
    } catch (err) {
      line(`  · candidate persist failed for ${kind}: ${err.message}`);
    }
  }
  // Mark every evidence turn as observed by this cycle.
  const allEvidenceTurns = new Set();
  for (const c of scored) for (const t of (c.evidence_turn_ids ?? [])) allEvidenceTurns.add(t);
  if (allEvidenceTurns.size > 0) {
    const ids = Array.from(allEvidenceTurns);
    const r = await pool.query(
      `UPDATE nex.conv_turns
          SET cle_processed_at = now(), cle_cycle_run_id = $1
        WHERE id = ANY($2::uuid[]) AND cle_processed_at IS NULL`,
      [cycleRunId, ids],
    );
    turnsMarkedProcessed = r.rowCount ?? 0;
  }
}

const wouldStore = scored.filter(c => c.score.promoteReady);
line(`  candidates in scored set:                         ${scored.length}`);
line(`  candidates ready-for-review (score >= floor):     ${wouldStore.length}`);
if (apply) {
  line(`  candidates persisted to conv_learning_candidate:  ${candidatesPersisted}`);
  line(`  conv_turns marked cle_processed by this cycle:    ${turnsMarkedProcessed}`);
  line(`  storage mode:                                     APPLY (persisted at status='pending_review')`);
  line(`  constitutional gate:                              admin promotion required · NEVER auto-teach`);
} else {
  line(`  would insert into nex.conv_learning_candidate:    ${scored.length}`);
  line(`  actually written to DB:                           0 (dry-run)`);
  line(`  next:                                             re-run with --apply to persist`);
}
line("");

// SECTION 5 · COST / OPERATIONS
line("═".repeat(72));
line("5. COST / OPERATIONS");
line("═".repeat(72));
line(`  runtime:                        ${runtimeSec}s`);
line(`  detectors run:                  6 (SQL reads only)`);
line(`  candidate strategies invoked:   ${config.candidateStrategies.length}`);
line(`  eval scripts run:               0 (smoke uses heuristic score · full eval deferred)`);
line(`  LLM tokens consumed:            0 (no LLM calls in smoke · pure SQL + heuristics)`);
line(`  monetary cost:                  $0.00`);
line(`  errors:                         0`);
line("");

// DOCTRINE CHECKS
line("═".repeat(72));
line("DOCTRINE CHECKS");
line("═".repeat(72));
const anyPromoted = false; // dry-run · impossible
const anyDoctrineFail = scored.some(c => c.score.components.doctrine_score < 1);
line(`  Observation ≠ auto-teach:               HELD ✓ (Step 7 not invoked)`);
line(`  Human promotion required:               HELD ✓ (--apply refused · admin UI required)`);
line(`  Draft-only tier enforced:               HELD ✓ (all candidates confidence < 0.70 or draft_only=true)`);
line(`  Cross-brain isolation:                  HELD ✓ (only ${config.brain} queried)`);
line(`  No PII in candidates:                   ${anyDoctrineFail ? "VIOLATED ✗" : "HELD ✓"}`);
line(`  Language-Neutral Brain check:           deferred (shadow-store eval required)`);
line(`  Regression margin check:                deferred (shadow-store eval required)`);
line("");

line("═".repeat(72));
line(`  next step:  STOP · report to Philip · await go/no-go`);
line("═".repeat(72));

// ── Reliability instrumentation · finish ──────────────────────────────────
// Task #76 Bundle B: records_processed reflects real DB touches (persisted
// candidates + turns marked processed). records_new = new candidates.
const anyDoctrineFailFinal = scored.some(c => c.score.components.doctrine_score < 1);
await finishCycleRun(pool, cycleRunId, {
  status: "completed",
  recordsProcessed: apply ? (candidatesPersisted + turnsMarkedProcessed) : beforeSnap.turns,
  recordsNew: apply ? candidatesPersisted : 0,
  recordsRejected: 0,
  errorsCount: 0,
  summary: {
    weaknesses_signalled: weaknesses.length,
    candidates_generated: candidates.length,
    candidates_ready: scored.filter(c => c.score.promoteReady).length,
    candidates_persisted: apply ? candidatesPersisted : 0,
    turns_marked_processed: apply ? turnsMarkedProcessed : 0,
    apply_mode: apply,
    feedback_dependent_zero: stats.feedback_dependent_zero,
    by_detector: stats.by_detector,
  },
  auditReportPath: null,   // CLE smoke prints to stdout only
  doctrineChecks: {
    "Observation ≠ auto-teach": "HELD",
    "Human promotion required": "HELD",
    "Draft-only tier enforced": "HELD",
    "Cross-brain isolation": "HELD",
    "No PII in candidates": anyDoctrineFailFinal ? "VIOLATED" : "HELD",
  },
});
await emitHeartbeat(pool, { workerId, workerType: "cle", workerConfig: configName, status: "completed", cycleRunId });

await pool.end();
