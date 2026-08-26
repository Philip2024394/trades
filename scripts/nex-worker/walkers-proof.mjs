// scripts/nex-worker/walkers-proof.mjs
//
// NEX WALKER PRODUCTION PROOF · Philip 2026-08-26 P6.
//
// Observational only. NO INSERTs, NO UPDATEs, NO DELETEs. NO walker invocation.
// Just SELECTs against nex.* tables · reports the real state of the workforce.
//
// Exit code 0 = HEALTHY · exit code 1 = ANOMALY (with detail printed).
//
// Watchdog distinguishes:
//   HEALTHY zero-record cycles: ALL_DEDUPED · PROVIDER_EMPTY · NO_NEW_CANDIDATES
//   ANOMALY zero-record patterns:
//     · STUCK_CYCLE          (running > 30 min)
//     · DUPLICATE_ASSIGNMENT (same worker_config running twice)
//     · NO_ACQUISITION_PICK  (no orchestrator pick in last N minutes)
//     · INVARIANT_FAILED     (persistence contract broken)
//     · PROVIDER_ERROR_STORM (> 50% of last-hour cycles are PROVIDER_ERROR)
//
// Usage:
//   npm run walkers:proof            (default · pretty print + exit code)
//   npm run walkers:proof -- --json  (machine-readable · piped to alerting)

import pg from "pg";

const pool = new pg.Pool({
  connectionString: process.env.NEX_POSTGRES_URL
    ?? "postgresql://postgres:Admin1phil@localhost:5433/nex_dev",
  max: 3,
});

const args = new Set(process.argv.slice(2));
const asJson = args.has("--json");

// Thresholds · tunable via env for future tuning without editing code.
const STUCK_CYCLE_MINUTES         = Number(process.env.WALKERS_PROOF_STUCK_MINUTES         ?? 30);
const NO_PICK_ANOMALY_MINUTES     = Number(process.env.WALKERS_PROOF_NO_PICK_MINUTES       ?? 5);
const NO_CYCLE_ANOMALY_MINUTES    = Number(process.env.WALKERS_PROOF_NO_CYCLE_MINUTES      ?? 15);
const PROVIDER_ERROR_STORM_PCT    = Number(process.env.WALKERS_PROOF_PROVIDER_STORM_PCT    ?? 50);

const WORKER_TYPES = ["acquisition", "shop"];
const DESTINATION_TABLES = [
  { table: "nex.food_business",             label: "food_business",             pkCol: "internal_id" },
  { table: "nex.accommodation_business",    label: "accommodation_business",    pkCol: "internal_id" },
  { table: "nex.mp_seller",                 label: "mp_seller",                 pkCol: "seller_id"   },
  { table: "nex.transport_acquisition_record", label: "transport_acquisition_record", pkCol: "provider_id" },
];

async function q(sql, params = []) {
  const r = await pool.query(sql, params);
  return r.rows;
}

// ── Collect all observations in parallel where possible ────────────────

async function collectEvidence() {
  const now = new Date();
  const evidence = { at: now.toISOString(), thresholds: { STUCK_CYCLE_MINUTES, NO_PICK_ANOMALY_MINUTES, NO_CYCLE_ANOMALY_MINUTES, PROVIDER_ERROR_STORM_PCT } };

  // Orchestrator picks · last 24h + latency to most recent
  const picks = await q(
    `SELECT picked_at, city, category, surface
       FROM nex.discovery_orchestrator_pick
      WHERE picked_at > NOW() - INTERVAL '24 hours'
      ORDER BY picked_at DESC`
  );
  evidence.orchestrator = {
    picks_24h: picks.length,
    last_pick_at: picks[0]?.picked_at?.toISOString() ?? null,
    seconds_since_last_pick: picks[0] ? Math.round((now.getTime() - picks[0].picked_at.getTime()) / 1000) : null,
    recent_picks_sample: picks.slice(0, 5).map((p) => ({
      picked_at: p.picked_at.toISOString(), city: p.city, category: p.category, surface: p.surface,
    })),
  };

  // Cycles · last hour + last 24h
  const cyclesLastHour = await q(
    `SELECT id, worker_id, worker_type, worker_config, status, started_at, finished_at,
            records_new, errors_count,
            summary->>'cycle_outcome' AS cycle_outcome,
            (summary->'persistence_invariant'->>'held')::boolean AS invariant_held
       FROM nex.worker_cycle_run
      WHERE worker_type = ANY($1) AND started_at > NOW() - INTERVAL '1 hour'
      ORDER BY started_at DESC`,
    [WORKER_TYPES]
  );
  const cyclesLast24h = await q(
    `SELECT worker_type, status, summary->>'cycle_outcome' AS cycle_outcome,
            COUNT(*)::int AS n
       FROM nex.worker_cycle_run
      WHERE worker_type = ANY($1) AND started_at > NOW() - INTERVAL '24 hours'
      GROUP BY worker_type, status, summary->>'cycle_outcome'`,
    [WORKER_TYPES]
  );
  evidence.cycles = {
    last_hour_count:  cyclesLastHour.length,
    last_hour_sample: cyclesLastHour.slice(0, 10).map((c) => ({
      id: c.id, worker_config: c.worker_config, status: c.status,
      cycle_outcome: c.cycle_outcome, records_new: c.records_new,
      invariant_held: c.invariant_held, duration_ms: c.finished_at ? c.finished_at.getTime() - c.started_at.getTime() : null,
    })),
    last_24h_breakdown: cyclesLast24h,
  };

  // Stuck cycles · status='running' beyond threshold
  const stuck = await q(
    `SELECT id, worker_id, worker_config, started_at,
            EXTRACT(EPOCH FROM (NOW() - started_at))::int AS running_seconds
       FROM nex.worker_cycle_run
      WHERE status = 'running' AND started_at < NOW() - INTERVAL '${STUCK_CYCLE_MINUTES} minutes'
      ORDER BY started_at ASC`
  );
  evidence.stuck_cycles = stuck.map((s) => ({
    id: s.id, worker_config: s.worker_config,
    running_seconds: s.running_seconds, started_at: s.started_at.toISOString(),
  }));

  // Duplicate active assignments · same worker_config running > 1x
  const dupes = await q(
    `SELECT worker_config, COUNT(*)::int AS n, array_agg(id) AS ids
       FROM nex.worker_cycle_run
      WHERE status = 'running' AND started_at > NOW() - INTERVAL '2 hours'
      GROUP BY worker_config HAVING COUNT(*) > 1`
  );
  evidence.duplicate_active = dupes.map((d) => ({
    worker_config: d.worker_config, count: d.n, cycle_ids: d.ids,
  }));

  // Invariant failures · last 24h
  const invFail = await q(
    `SELECT id, worker_config, started_at, finished_at,
            summary->'persistence_invariant' AS invariant,
            summary->'persistence_counts' AS counts
       FROM nex.worker_cycle_run
      WHERE started_at > NOW() - INTERVAL '24 hours'
        AND status = 'failed'
        AND (summary->'persistence_invariant'->>'held')::boolean = false
      ORDER BY started_at DESC`
  );
  evidence.invariant_failures = invFail.map((r) => ({
    id: r.id, worker_config: r.worker_config,
    started_at: r.started_at?.toISOString(),
    invariant: r.invariant, counts: r.counts,
  }));

  // Provider error rate · last hour
  const providerErrors = cyclesLastHour.filter((c) => c.cycle_outcome === "PROVIDER_ERROR");
  evidence.provider_errors = {
    last_hour_count: providerErrors.length,
    last_hour_pct:   cyclesLastHour.length > 0
      ? Math.round((providerErrors.length / cyclesLastHour.length) * 100)
      : 0,
  };

  // Verified records last hour · via DB JOIN on cycle_run_id (P5 contract)
  // Only counts rows attributed to a cycle that COMPLETED in the last hour.
  const verifiedRecords = {};
  for (const t of DESTINATION_TABLES) {
    const r = await q(
      `SELECT COUNT(*)::int AS n FROM ${t.table} tbl
        WHERE tbl.cycle_run_id IN (
          SELECT id FROM nex.worker_cycle_run
           WHERE started_at > NOW() - INTERVAL '1 hour' AND status = 'completed'
        )`
    );
    verifiedRecords[t.label] = r[0].n;
  }
  evidence.verified_records_last_hour = verifiedRecords;
  evidence.verified_records_last_hour.total = Object.values(verifiedRecords).reduce((a, b) => a + b, 0);

  // Time since last SUCCESSFUL (records_new > 0) acquisition
  const lastSuccess = await q(
    `SELECT started_at, worker_config, records_new
       FROM nex.worker_cycle_run
      WHERE worker_type = 'acquisition' AND status = 'completed' AND records_new > 0
      ORDER BY started_at DESC LIMIT 1`
  );
  evidence.last_productive_acquisition = lastSuccess[0] ? {
    started_at: lastSuccess[0].started_at.toISOString(),
    worker_config: lastSuccess[0].worker_config,
    records_new: lastSuccess[0].records_new,
    hours_ago: Math.round((now.getTime() - lastSuccess[0].started_at.getTime()) / 36e5 * 10) / 10,
  } : null;

  // Time since last ATTEMPTED acquisition (any status)
  const lastAttempt = await q(
    `SELECT started_at, worker_config, status
       FROM nex.worker_cycle_run
      WHERE worker_type = 'acquisition'
      ORDER BY started_at DESC LIMIT 1`
  );
  evidence.last_acquisition_attempt = lastAttempt[0] ? {
    started_at: lastAttempt[0].started_at.toISOString(),
    worker_config: lastAttempt[0].worker_config,
    status: lastAttempt[0].status,
    minutes_ago: Math.round((now.getTime() - lastAttempt[0].started_at.getTime()) / 60000),
  } : null;

  // Rotation state · saturation/reactivation counts
  const rotState = await q(
    `SELECT state::text AS state, COUNT(*)::int AS n,
            COUNT(cooldown_until)::int AS with_cooldown,
            COUNT(*) FILTER (WHERE cooldown_until < NOW())::int AS cooldown_expired
       FROM nex.discovery_rotation_state
      GROUP BY state ORDER BY state`
  );
  evidence.rotation_state = rotState;

  // Worker heartbeat freshness
  const heartbeats = await q(
    `SELECT worker_id, worker_type, last_status, last_heartbeat_at,
            EXTRACT(EPOCH FROM (NOW() - last_heartbeat_at))::int AS seconds_since_heartbeat
       FROM nex.worker_heartbeat
      WHERE worker_type = ANY($1)
      ORDER BY last_heartbeat_at DESC`,
    [WORKER_TYPES]
  );
  evidence.workers = heartbeats.map((h) => ({
    worker_id: h.worker_id, worker_type: h.worker_type,
    last_status: h.last_status, last_heartbeat_at: h.last_heartbeat_at?.toISOString(),
    seconds_since_heartbeat: h.seconds_since_heartbeat,
  }));

  return evidence;
}

// ── Watchdog verdict ────────────────────────────────────────────────────

function verdictFor(e) {
  const anomalies = [];

  if (e.stuck_cycles.length > 0) {
    anomalies.push({ kind: "STUCK_CYCLE", detail: `${e.stuck_cycles.length} cycle(s) running > ${STUCK_CYCLE_MINUTES}min · sample: ${e.stuck_cycles[0].worker_config} (${e.stuck_cycles[0].running_seconds}s)` });
  }
  if (e.duplicate_active.length > 0) {
    anomalies.push({ kind: "DUPLICATE_ASSIGNMENT", detail: `${e.duplicate_active.length} worker_config(s) with 2+ concurrent running cycles: ${e.duplicate_active.map((d) => d.worker_config).join(", ")}` });
  }
  if (e.invariant_failures.length > 0) {
    anomalies.push({ kind: "INVARIANT_FAILED", detail: `${e.invariant_failures.length} cycle(s) with broken persistence invariant · newest: ${e.invariant_failures[0].id}` });
  }
  if (e.orchestrator.seconds_since_last_pick != null
      && e.orchestrator.seconds_since_last_pick > NO_PICK_ANOMALY_MINUTES * 60) {
    // Only flag NO_PICK if the workforce has eligible work waiting.
    const eligibleCount = e.rotation_state
      .filter((r) => r.state === "build" || r.state === "reactivate" || (r.state === "saturated" && r.cooldown_expired > 0))
      .reduce((a, r) => a + r.n, 0);
    if (eligibleCount > 0) {
      anomalies.push({ kind: "NO_ACQUISITION_PICK", detail: `Last orchestrator pick ${Math.round(e.orchestrator.seconds_since_last_pick / 60)}min ago · but ${eligibleCount} eligible surfaces waiting` });
    }
  }
  if (e.orchestrator.seconds_since_last_pick == null) {
    anomalies.push({ kind: "NO_ACQUISITION_PICK", detail: `Zero orchestrator picks recorded in the last 24h · scheduler may not be ticking with NEX_ORCHESTRATOR_ENABLED=true` });
  }
  if (e.last_acquisition_attempt == null) {
    anomalies.push({ kind: "NO_ACQUISITION_ATTEMPT", detail: `No acquisition cycles ever attempted` });
  } else if (e.last_acquisition_attempt.minutes_ago > NO_CYCLE_ANOMALY_MINUTES) {
    const eligibleCount = e.rotation_state.filter((r) => r.state === "build" || r.state === "reactivate" || (r.state === "saturated" && r.cooldown_expired > 0)).reduce((a, r) => a + r.n, 0);
    if (eligibleCount > 0) {
      anomalies.push({ kind: "NO_ACQUISITION_CYCLE", detail: `No acquisition cycle in ${e.last_acquisition_attempt.minutes_ago}min · but ${eligibleCount} eligible/reactivate surfaces exist` });
    }
  }
  if (e.cycles.last_hour_count > 4 && e.provider_errors.last_hour_pct >= PROVIDER_ERROR_STORM_PCT) {
    anomalies.push({ kind: "PROVIDER_ERROR_STORM", detail: `${e.provider_errors.last_hour_pct}% of last-hour cycles are PROVIDER_ERROR (${e.provider_errors.last_hour_count}/${e.cycles.last_hour_count}) · upstream provider outage suspected` });
  }

  return {
    verdict: anomalies.length === 0 ? "HEALTHY" : "ANOMALY",
    anomaly_count: anomalies.length,
    anomalies,
  };
}

// ── Pretty printer ─────────────────────────────────────────────────────

function printPretty(e, v) {
  const line = (s = "") => console.log(s);
  const hr   = () => line("─".repeat(72));

  line("");
  line("═".repeat(72));
  line("  NEX WALKER PRODUCTION PROOF · Philip 2026-08-26");
  line(`  Report at: ${e.at}`);
  line("═".repeat(72));

  line("");
  line("── WATCHDOG VERDICT ────────────────────────────────────────────────────");
  hr();
  if (v.verdict === "HEALTHY") {
    line(`  ✓ HEALTHY · no anomalies detected`);
  } else {
    line(`  ✗ ANOMALY · ${v.anomaly_count} issue(s) found`);
    for (const a of v.anomalies) {
      line(`    [${a.kind}] ${a.detail}`);
    }
  }

  line("");
  line("── ORCHESTRATOR / SCHEDULER ────────────────────────────────────────────");
  hr();
  line(`  Orchestrator picks · last 24h : ${e.orchestrator.picks_24h}`);
  line(`  Last pick                     : ${e.orchestrator.last_pick_at ?? "(none in 24h)"}`);
  line(`  Time since last pick          : ${e.orchestrator.seconds_since_last_pick != null ? Math.round(e.orchestrator.seconds_since_last_pick) + "s" : "n/a"}`);
  for (const p of e.orchestrator.recent_picks_sample) {
    line(`    · ${p.picked_at.slice(11, 19)}Z  ${p.city} / ${p.category} / ${p.surface}`);
  }

  line("");
  line("── WORKERS (heartbeats) ────────────────────────────────────────────────");
  hr();
  for (const w of e.workers) {
    line(`  ${w.worker_id.padEnd(38)}  ${w.last_status.padEnd(10)}  ${w.seconds_since_heartbeat}s ago`);
  }

  line("");
  line("── ACQUISITION CYCLES · last hour ──────────────────────────────────────");
  hr();
  line(`  Total cycles                  : ${e.cycles.last_hour_count}`);
  for (const c of e.cycles.last_hour_sample) {
    const inv = c.invariant_held === true ? "HELD" : c.invariant_held === false ? "FAIL" : "n/a";
    line(`    · ${c.id.slice(0, 8)}  ${c.worker_config.padEnd(38)}  ${c.status.padEnd(9)}  new=${String(c.records_new).padStart(3)}  ${(c.cycle_outcome ?? "-").padEnd(18)}  inv=${inv}`);
  }
  line("");
  line("  24h breakdown by outcome:");
  for (const row of e.cycles.last_24h_breakdown) {
    line(`    · ${(row.worker_type + ":" + row.status).padEnd(24)}  ${(row.cycle_outcome ?? "(no outcome)").padEnd(20)}  ${row.n}`);
  }

  line("");
  line("── VERIFIED RECORDS · last hour · attributed via cycle_run_id ──────────");
  hr();
  for (const t of DESTINATION_TABLES) {
    line(`  ${t.label.padEnd(36)}  ${e.verified_records_last_hour[t.label]}`);
  }
  line(`  ${"TOTAL".padEnd(36)}  ${e.verified_records_last_hour.total}`);

  line("");
  line("── PROVIDER ERRORS · last hour ─────────────────────────────────────────");
  hr();
  line(`  PROVIDER_ERROR count : ${e.provider_errors.last_hour_count}`);
  line(`  PROVIDER_ERROR pct   : ${e.provider_errors.last_hour_pct}%`);

  line("");
  line("── STUCK / DUPLICATE / FAILED CYCLES ──────────────────────────────────");
  hr();
  line(`  Stuck cycles (running > ${STUCK_CYCLE_MINUTES}min)  : ${e.stuck_cycles.length}`);
  line(`  Duplicate active assignments      : ${e.duplicate_active.length}`);
  line(`  Invariant failures (last 24h)     : ${e.invariant_failures.length}`);

  line("");
  line("── ROTATION STATE ──────────────────────────────────────────────────────");
  hr();
  for (const r of e.rotation_state) {
    const cd = r.state === "saturated"
      ? `  · ${r.cooldown_expired} of ${r.with_cooldown} cooldown_expired (eligible for next tick)`
      : "";
    line(`  ${r.state.padEnd(12)}  n=${r.n}${cd}`);
  }

  line("");
  line("── TIME SINCE LAST ACTIVITY ────────────────────────────────────────────");
  hr();
  line(`  Last productive acquisition : ${e.last_productive_acquisition?.started_at ?? "never"}  (${e.last_productive_acquisition?.hours_ago ?? "n/a"}h ago)`);
  if (e.last_productive_acquisition) {
    line(`    · ${e.last_productive_acquisition.worker_config}  records_new=${e.last_productive_acquisition.records_new}`);
  }
  line(`  Last acquisition attempt    : ${e.last_acquisition_attempt?.started_at ?? "never"}  (${e.last_acquisition_attempt?.minutes_ago ?? "n/a"}min ago)`);
  if (e.last_acquisition_attempt) {
    line(`    · ${e.last_acquisition_attempt.worker_config}  status=${e.last_acquisition_attempt.status}`);
  }

  line("");
  line("═".repeat(72));
  line(`  VERDICT: ${v.verdict}${v.verdict === "ANOMALY" ? " · exit code 1" : " · exit code 0"}`);
  line("═".repeat(72));
}

// ── Main ────────────────────────────────────────────────────────────────

const evidence = await collectEvidence();
const verdict = verdictFor(evidence);

if (asJson) {
  console.log(JSON.stringify({ evidence, verdict }, null, 2));
} else {
  printPretty(evidence, verdict);
}

await pool.end();
process.exit(verdict.verdict === "HEALTHY" ? 0 : 1);
