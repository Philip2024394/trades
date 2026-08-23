#!/usr/bin/env node
// scripts/nex-factory/run-scorer.mjs
//
// Directory Factory · Calibration Harness · standalone/on-demand runner.
//
// Two modes:
//   default          Only re-runs the score recorder against existing
//                    candidates in nex.category_candidate.
//   --run-writer     ALSO triggers Phase 1 candidate writer against
//                    current DB state · useful for bootstrapping the
//                    calibration set from historic Walker data.
//
// Usage:
//   node --env-file=.env.local scripts/nex-factory/run-scorer.mjs
//   node --env-file=.env.local scripts/nex-factory/run-scorer.mjs --run-writer
//
// Never activates a Registry category. Never modifies category_registry.
// Never sets admin_decision != 'pending' on candidate rows.

import pg from "pg";
import { proposeCategoryCandidates } from "../nex-acquisition/category-candidate-writer.mjs";
import { recordCandidateScores } from "./record-candidate-scores.mjs";

const args = process.argv.slice(2);
const shouldRunWriter = args.includes("--run-writer");

const url = process.env.NEX_POSTGRES_URL;
if (!url) {
  console.error("NEX_POSTGRES_URL not set");
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: url, max: 4 });

async function main() {
  console.log(`── nex-factory scorer runner · ${new Date().toISOString()} ──`);
  console.log(`  mode: ${shouldRunWriter ? "run-writer + scorer" : "scorer only"}`);
  console.log("");

  if (shouldRunWriter) {
    console.log("── Phase 1 · candidate writer (food/Yogyakarta/ID) ──");
    // Bootstrap: no real cycle_run_id available in standalone mode. Create
    // a synthetic worker_cycle_run entry so provenance FKs are valid.
    const cycleRes = await pool.query(
      `INSERT INTO nex.worker_cycle_run
         (worker_id, worker_type, worker_config, status)
       VALUES ('factory:manual:run-scorer','manual','food:Yogyakarta:bootstrap','completed')
       RETURNING id`,
    );
    const bootstrapCycleRunId = cycleRes.rows[0].id;

    const wr = await proposeCategoryCandidates(pool, {
      cycleRunId: bootstrapCycleRunId,
      vertical:   "food",
      country:    "ID",
      city:       "Yogyakarta",
      workerId:   "factory:manual:run-scorer",
    });
    console.log(`  ${wr.summary}`);
    for (const p of wr.proposed) console.log(`  proposed  ${p.id.padEnd(24)} businesses=${p.businessCount} cycles=${p.cycleCount} confidence=${p.confidence}`);
    for (const u of wr.updated)  console.log(`  refreshed ${u.id.padEnd(24)} businesses=${u.businessCount} cycles=${u.cycleCount} confidence=${u.confidence}`);
    if (wr.skipped.length > 0) {
      const reasons = new Map();
      for (const s of wr.skipped) reasons.set(s.reason, (reasons.get(s.reason) ?? 0) + 1);
      console.log(`  skipped   ${[...reasons.entries()].map(([r, n]) => `${r}=${n}`).join("  ")}`);
    }
    console.log("");
  }

  console.log("── Calibration Harness · score recorder ──");
  const sr = await recordCandidateScores(pool, {
    computedBy: `scorer:era1:manual:${new Date().toISOString()}`,
  });
  console.log(`  ${sr.summary}`);
  if ((sr.errors ?? []).length > 0) {
    console.log(`  errors (${sr.errors.length}):`);
    for (const e of sr.errors) console.log(`    · ${e.candidateId}: ${e.error}`);
  }
  console.log("");

  console.log("── Post-run state ──");
  const state = await pool.query(
    `SELECT
       (SELECT COUNT(*)::int FROM nex.category_candidate)                                 AS candidates_total,
       (SELECT COUNT(*)::int FROM nex.category_candidate WHERE admin_decision='pending')   AS candidates_pending,
       (SELECT COUNT(*)::int FROM nex.category_candidate_score)                           AS scores_total,
       (SELECT COUNT(DISTINCT candidate_id)::int FROM nex.category_candidate_score)       AS candidates_with_score,
       (SELECT COUNT(*)::int FROM nex.category_registry)                                  AS registry_rows_UNCHANGED`,
  );
  const s = state.rows[0];
  console.log(`  candidates total     : ${s.candidates_total}`);
  console.log(`  candidates pending   : ${s.candidates_pending}`);
  console.log(`  scores total         : ${s.scores_total}`);
  console.log(`  candidates with score: ${s.candidates_with_score}`);
  console.log(`  registry rows        : ${s.registry_rows_UNCHANGED} (must be 13 · unchanged)`);
  console.log("");

  await pool.end();
}

main().catch((err) => {
  console.error(`FATAL: ${err?.stack ?? err}`);
  pool.end().finally(() => process.exit(1));
});
