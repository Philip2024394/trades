// scripts/nex-orchestration/_zombie-reconciler.mjs
//
// P0 · 2026-08-24 · Autonomous zombie cycle reconciler.
// Marks cycles that have been in status='running' beyond a per-worker-type
// timeout as status='aborted', preserves cycle provenance in summary,
// and frees the slot for new work. Idempotent · never requires manual SQL ·
// registered as a 3-minute scheduler cron.
//
// Design decisions:
//   · Per-worker-type timeouts. Acquisition walkers are fast (avg 6.9s in
//     forensic report), so 15 min is a generous ceiling. Intake/manual/CLE
//     can legitimately run longer, so 60 min. Unknown workers default 30 min.
//   · Uses status='aborted' (existing check constraint allows: running,
//     completed, failed, aborted). Distinguishes reconciler-killed cycles
//     from worker-emitted 'failed'. Reason preserved in summary.reconciler_reason.
//   · UPDATE ... WHERE status='running' is the idempotency guard — a row that
//     was already reconciled (or completed) won't be touched.
//   · finished_at = now() + duration_ms = actual runtime — so downstream
//     analytics correctly reflect what happened.
//   · summary.reconciler_reason is preserved so operators can see WHY the
//     cycle was reconciled (audit trail).

import pg from "pg";

const NEX_POSTGRES_URL = process.env.NEX_POSTGRES_URL ?? "postgresql://postgres:Admin1phil@localhost:5433/nex_dev";
const pool = new pg.Pool({ connectionString: NEX_POSTGRES_URL, max: 2 });

// Per-worker-type timeouts. Anything not in this map uses DEFAULT_TIMEOUT_MIN.
const WORKER_TYPE_TIMEOUT_MIN = {
  acquisition: 15,
  social:      15,
  intake:      60,
  manual:      60,
  cle:         60,
  promotion:   30,
};
const DEFAULT_TIMEOUT_MIN = 30;

async function main() {
  const startedAt = Date.now();
  console.log(`[zombie-reconciler] tick @ ${new Date().toISOString()}`);

  // One UPDATE per timeout tier · cheaper than a single CASE-driven UPDATE
  // because it lets us log exactly what tier reconciled each row. All UPDATEs
  // are idempotent · no race between tiers.
  const tiers = [
    ...Object.entries(WORKER_TYPE_TIMEOUT_MIN).map(([wt, min]) => ({ workerTypes: [wt], min })),
    { workerTypes: null, min: DEFAULT_TIMEOUT_MIN }, // fallback for unknown types
  ];

  let totalReconciled = 0;
  for (const tier of tiers) {
    const tierLabel = tier.workerTypes ? tier.workerTypes.join(",") : "default(unknown)";
    // NB · tier.workerTypes=null branch skips workers that ARE in the map
    // (they were handled by their explicit tier). Idempotency guard prevents
    // double-reconciliation regardless.
    const whereWorkerType = tier.workerTypes
      ? `worker_type = ANY($1::text[])`
      : `worker_type NOT IN (${Object.keys(WORKER_TYPE_TIMEOUT_MIN).map((_, i) => `$${i + 1}`).join(",")})`;
    const params = tier.workerTypes
      ? [tier.workerTypes]
      : Object.keys(WORKER_TYPE_TIMEOUT_MIN);
    const timeoutParamIdx = params.length + 1;
    params.push(`${tier.min} minutes`);

    const sql = `
      UPDATE nex.worker_cycle_run
      SET status      = 'aborted',
          finished_at = now(),
          duration_ms = COALESCE(duration_ms, GREATEST(0, (EXTRACT(EPOCH FROM (now() - started_at)) * 1000)::int)),
          summary     = COALESCE(summary, '{}'::jsonb) || jsonb_build_object(
                          'reconciler_reason',      'exceeded_configured_timeout',
                          'reconciler_ran_at',      to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
                          'reconciler_timeout_min', ${tier.min}
                        )
      WHERE status = 'running'
        AND finished_at IS NULL
        AND started_at < now() - $${timeoutParamIdx}::interval
        AND ${whereWorkerType}
      RETURNING id, worker_id, worker_type, worker_config, started_at
    `;
    const r = await pool.query(sql, params);
    if (r.rowCount > 0) {
      totalReconciled += r.rowCount;
      console.log(`  · ${tierLabel} (timeout=${tier.min}min) reconciled ${r.rowCount} zombies:`);
      for (const row of r.rows) {
        const ageSec = Math.floor((Date.now() - new Date(row.started_at).getTime()) / 1000);
        console.log(`    - ${row.worker_type}/${row.worker_id} cfg=${row.worker_config} age=${ageSec}s`);
      }
    }
  }

  const durMs = Date.now() - startedAt;
  console.log(`[zombie-reconciler] done · ${totalReconciled} reconciled · ${durMs}ms`);
  await pool.end();
}

main().catch((e) => {
  console.error("[zombie-reconciler] FATAL", e);
  process.exit(1);
});
