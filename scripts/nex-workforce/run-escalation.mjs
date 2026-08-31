#!/usr/bin/env node
// scripts/nex-workforce/run-escalation.mjs
//
// NEX Workforce · Category Escalation Runner · Philip 2026-08-27.
//
// Purpose: automatically activate Phase 2B retail categories when Phase 2A
// has fully swept Indonesia. Runs on a 30-min scheduler cadence · idempotent ·
// pure read + rare JSON patch. NO discovery / walker spawn / cooldown effects.
//
// Escalation rule:
//   For every currently-active retail-* category:
//     · count total rotation state rows (city surfaces)
//     · count how many are in state='saturated'
//     · category is "swept" when saturated_ratio >= SWEEP_RATIO (0.9)
//   If ALL active retail categories are swept AND rotation state is populated
//   (>= MIN_ROTATION_ROWS_PER_CATEGORY), the runner flips every inactive
//   retail-* category to active=true by patching data/nex-job-registry.json.
//
// After activation, the next rotation-tick auto-creates rotation state rows
// for the newly-active categories · orchestrator picks them up · walkers
// spawn. No scheduler restart needed (fresh spawns re-read the file).
//
// Emits worker_cycle_run row with worker_type='workforce:escalation' so HQ
// observability shows the check even when no activation happens.

import pg from "pg";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { randomUUID } from "node:crypto";
import { loadJobRegistry } from "./_job-registry.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REGISTRY_PATH = join(__dirname, "..", "..", "data", "nex-job-registry.json");

const NEX_POSTGRES_URL = process.env.NEX_POSTGRES_URL
  ?? "postgresql://postgres:Admin1phil@localhost:5433/nex_dev";

/** Sweep ratio threshold · when ≥90% of a category's city rotation rows are
 *  saturated, that category is considered "swept across Indonesia". */
const SWEEP_RATIO = 0.9;

/** Minimum rotation rows per category before the sweep check is meaningful.
 *  If a category has fewer rows than this in rotation state, we assume it
 *  hasn't fully propagated yet · defer escalation. */
const MIN_ROTATION_ROWS_PER_CATEGORY = 10;

function parseArgs(argv) {
  const out = { dry: false };
  for (const a of argv.slice(2)) {
    if (a === "--dry") out.dry = true;
  }
  return out;
}

async function main() {
  const args = parseArgs(process.argv);
  const pool = new pg.Pool({ connectionString: NEX_POSTGRES_URL, max: 3 });

  const cycleRunId = randomUUID();
  const workerId   = randomUUID();
  const workerType   = "workforce:escalation";
  const workerConfig = "workforce:escalation:retail";
  const startMs = Date.now();

  const counters = {
    mode: "escalation_check",
    dry_run: args.dry,
    active_retail_categories: 0,
    inactive_retail_categories: 0,
    swept_categories: 0,
    unswept_categories: 0,
    not_populated_categories: 0,
    per_category: {},
    activated_slugs: [],
    errors: 0,
  };

  // Cycle row · running.
  try {
    await pool.query(
      `INSERT INTO nex.worker_cycle_run
         (id, worker_id, worker_type, worker_config, started_at, status, errors_count, summary)
       VALUES ($1::uuid, $2, $3, $4, to_timestamp($5::bigint / 1000.0), 'running', 0, '{}'::jsonb)`,
      [cycleRunId, workerId, workerType, workerConfig, startMs],
    );
  } catch (err) {
    console.error(`[escalation] cycle_run start failed: ${err.message}`);
  }

  // Load registry from disk (fresh · no cache).
  const raw = readFileSync(REGISTRY_PATH, "utf8");
  const registry = JSON.parse(raw);

  // Retail categories only · service categories out of scope for this runner.
  const retailJobs = registry.jobs.filter(
    (j) => j.category_slug?.startsWith("retail-") && j.target_table === "nex.mp_seller",
  );
  const activeRetail   = retailJobs.filter((j) => j.active !== false);
  const inactiveRetail = retailJobs.filter((j) => j.active === false);
  counters.active_retail_categories   = activeRetail.length;
  counters.inactive_retail_categories = inactiveRetail.length;

  // Snapshot rotation state per retail category.
  const rotSnap = await pool.query(
    `SELECT category, state, COUNT(*)::int AS n
       FROM nex.discovery_rotation_state
      WHERE category LIKE 'retail-%' AND surface != 'default'
      GROUP BY category, state`,
  );
  const byCategory = new Map();
  for (const r of rotSnap.rows) {
    if (!byCategory.has(r.category)) byCategory.set(r.category, { total: 0, saturated: 0 });
    const bucket = byCategory.get(r.category);
    bucket.total     += r.n;
    if (r.state === "saturated") bucket.saturated += r.n;
  }

  // Decide sweep per active category.
  let allActiveSwept = activeRetail.length > 0;
  for (const job of activeRetail) {
    const stats = byCategory.get(job.category_slug) ?? { total: 0, saturated: 0 };
    const ratio = stats.total > 0 ? stats.saturated / stats.total : 0;
    const populated = stats.total >= MIN_ROTATION_ROWS_PER_CATEGORY;
    const swept = populated && ratio >= SWEEP_RATIO;
    counters.per_category[job.category_slug] = {
      total: stats.total,
      saturated: stats.saturated,
      ratio: Number(ratio.toFixed(3)),
      populated,
      swept,
    };
    if (swept) counters.swept_categories += 1;
    else if (populated) counters.unswept_categories += 1;
    else counters.not_populated_categories += 1;
    if (!swept) allActiveSwept = false;
  }

  // Activation decision.
  if (allActiveSwept && inactiveRetail.length > 0) {
    // Flip every retail-* inactive job to active.
    for (const job of registry.jobs) {
      if (job.category_slug?.startsWith("retail-") && job.active === false) {
        job.active = true;
        counters.activated_slugs.push(job.category_slug);
      }
    }
    if (!args.dry) {
      // Atomic file write via temp + rename.
      try {
        const tmpPath = REGISTRY_PATH + ".tmp";
        writeFileSync(tmpPath, JSON.stringify(registry, null, 2) + "\n", "utf8");
        // Node's writeFileSync + rename is not truly atomic on Windows but
        // this is a dev/scheduler context · concurrency risk is trivial.
        const fs = await import("node:fs");
        fs.renameSync(tmpPath, REGISTRY_PATH);
      } catch (err) {
        counters.errors += 1;
        console.error(`[escalation] registry write failed: ${err.message}`);
      }
    } else {
      console.log(`[escalation] DRY RUN · would activate: ${counters.activated_slugs.join(", ")}`);
    }
  }

  const durationMs = Date.now() - startMs;
  try {
    await pool.query(
      `UPDATE nex.worker_cycle_run SET
         finished_at = now(), duration_ms = $2, status = $3,
         records_processed = $4, records_new = $5,
         records_rejected = 0, errors_count = $6, summary = $7::jsonb
       WHERE id = $1::uuid`,
      [
        cycleRunId, durationMs,
        counters.errors > 0 ? "failed" : "completed",
        activeRetail.length,
        counters.activated_slugs.length,
        counters.errors,
        JSON.stringify(counters),
      ],
    );
  } catch (err) {
    console.error(`[escalation] cycle_run finalize failed: ${err.message}`);
  }

  console.log(`[escalation] complete`, { cycle_run_id: cycleRunId, duration_ms: durationMs, ...counters });
  await pool.end();
}

const invokedAsScript = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (invokedAsScript) {
  main().catch((err) => { console.error(err); process.exit(1); });
}
