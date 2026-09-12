// NEX Workforce v2 · Slice 1e · Orchestrator
// ─────────────────────────────────────────────────────────────────────────────
// Thin executor of the scheduling view. On a schedule (default 60s):
//   1. Read rotation_eligible for a COUNT (logging only)
//   2. INSERT into work_item via SELECT from rotation_eligible with
//      ON CONFLICT (matching the R4 partial unique index predicate) DO NOTHING
//
// Absolutely does NOT:
//   - inspect agent processes
//   - read heartbeats, leases, or completion history
//   - recalculate eligibility (the view is authoritative)
//   - apply adaptive priority, load-based throttling, or dependency logic
//   - discover new cities or sources
//   - restart / coordinate anything
//   - touch any schema other than nex_workforce
//
// The Orchestrator is deliberately dumb. If scheduling policy changes,
// change the rotation_eligible view (or its inputs) in a separately
// approved slice · never quietly add intelligence here.
//
// Deployment: dumb OS watchdog (Task Scheduler / systemd / pm2). Exactly
// ONE orchestrator process in production. Two accidental orchestrators
// are safe: the R4 partial unique index absorbs duplicate enqueue attempts
// via ON CONFLICT DO NOTHING.
//
// Reliability: each SQL statement is transactionally bounded by
// server-side query/statement limits; the Orchestrator has no unbounded
// application-side iteration.

import pg from "pg";
import { fileURLToPath, pathToFileURL } from "node:url";
import { withWorkforceRole } from "./lib/with_workforce_role.mjs";

const stderrLogger = (obj) => {
  try { process.stderr.write(JSON.stringify({ ts: new Date().toISOString(), ...obj }) + "\n"); } catch {}
};

export async function createOrch({ url, intervalMs, maxConsecutiveErrors, logger, poolMax } = {}) {
  const config = {
    url:                  url ?? process.env.NEX_WORKFORCE_URL,
    intervalMs:           intervalMs ?? Number(process.env.NEX_ORCH_INTERVAL_MS ?? 60000),
    maxConsecutiveErrors: maxConsecutiveErrors ?? Number(process.env.NEX_ORCH_MAX_CONSECUTIVE_ERRORS ?? 3),
    logger:               logger ?? stderrLogger,
    poolMax:              poolMax ?? 2,
  };
  if (!config.url) throw new Error("NEX_WORKFORCE_URL required");

  const pool = new pg.Pool({
    connectionString:  config.url,
    max:               config.poolMax,
    query_timeout:     30_000,
    statement_timeout: 30_000,
  });

  const check = await pool.query("SELECT 1 FROM pg_namespace WHERE nspname = 'nex_workforce'");
  if (check.rowCount === 0) {
    await pool.end();
    throw new Error("nex_workforce schema not present · migration not applied");
  }

  const orch = {
    config, pool,
    log: config.logger,
    stopping: false, stopReason: null,
    consecutiveErrors: 0,
    tickCount: 0,
    lastTick: null,
  };
  orch.log({ msg: "orch.created", interval_ms: config.intervalMs, max_consecutive_errors: config.maxConsecutiveErrors });
  return orch;
}

export async function destroyOrch(orch) {
  if (orch?.pool) await orch.pool.end().catch(() => {});
}

/**
 * Run ONE tick: read eligibility count from the view + enqueue.
 * The orchestrator does not know why a row is eligible; the view decides.
 */
export async function runOrchOnce(orch) {
  orch.tickCount++;
  const tickN = orch.tickCount;
  orch.log({ msg: "orch.tick.begin", tick_n: tickN });

  try {
    const t1 = Date.now();
    const eligibleQ = await withWorkforceRole(orch.pool, (c) =>
      c.query("SELECT COUNT(*)::int AS n FROM nex_workforce.rotation_eligible"));
    const eligibleCount = eligibleQ.rows[0].n;
    orch.log({ msg: "orch.eligible", eligible_count: eligibleCount, duration_ms: Date.now() - t1 });

    // Slice 3 refinement · call SECURITY DEFINER wrapper instead of inline INSERT.
    // Preserves Slice 1e "2 SQL surfaces per tick" contract · same semantic
    // (INSERT..SELECT..FROM rotation_eligible ON CONFLICT DO NOTHING against the
    // partial unique index). Moves the write server-side so runtime role does
    // not need direct INSERT grant on nex_workforce.work_item.
    const t2 = Date.now();
    const enqueueQ = await withWorkforceRole(orch.pool, (c) =>
      c.query("SELECT nex_workforce.enqueue_from_view() AS enqueued"));
    const enqueuedCount = enqueueQ.rows[0]?.enqueued ?? 0;
    orch.log({ msg: "orch.enqueue", enqueued_count: enqueuedCount, duration_ms: Date.now() - t2 });

    orch.consecutiveErrors = 0;
    orch.lastTick = {
      ok: true, at: Date.now(),
      eligible: eligibleCount, enqueued: enqueuedCount,
    };
    orch.log({ msg: "orch.tick.end", tick_n: tickN, ok: true });
    return orch.lastTick;

  } catch (err) {
    orch.consecutiveErrors++;
    orch.lastTick = { ok: false, at: Date.now(), err: err.message };
    orch.log({
      msg: "orch.tick.error",
      err: err.message,
      consecutive: orch.consecutiveErrors,
    });

    if (orch.consecutiveErrors >= orch.config.maxConsecutiveErrors) {
      orch.log({
        msg: "orch.exit",
        reason: "too_many_errors",
        ticks_total: tickN,
        exit_code: 1,
      });
      throw new Error(`orch too_many_errors: ${orch.consecutiveErrors} consecutive · last: ${err.message}`);
    }

    orch.log({ msg: "orch.tick.end", tick_n: tickN, ok: false });
    return orch.lastTick;
  }
}

export async function runOrchLoop(orch) {
  orch.log({ msg: "orch.loop.start", interval_ms: orch.config.intervalMs });
  try {
    while (!orch.stopping) {
      await runOrchOnce(orch);
      await sleepInterruptible(orch.config.intervalMs, () => orch.stopping);
    }
    orch.log({
      msg: "orch.exit",
      reason: orch.stopReason ?? "requested",
      ticks_total: orch.tickCount,
      exit_code: 0,
    });
  } catch (err) {
    orch.log({ msg: "orch.loop.err", err: err.message });
    throw err;
  }
}

export function requestStop(orch, reason) {
  orch.stopping = true;
  orch.stopReason = reason ?? "requested";
}

function sleepInterruptible(ms, stopFlag) {
  return new Promise((resolve) => {
    const start = Date.now();
    const t = setInterval(() => {
      if (stopFlag() || Date.now() - start >= ms) { clearInterval(t); resolve(); }
    }, Math.min(50, ms));
  });
}

async function main() {
  const orch = await createOrch();
  process.on("SIGTERM", () => requestStop(orch, "SIGTERM"));
  process.on("SIGINT",  () => requestStop(orch, "SIGINT"));
  try {
    await runOrchLoop(orch);
  } catch (err) {
    process.exit(1);
  } finally {
    await destroyOrch(orch);
  }
}

// Windows-safe main-guard · pathToFileURL normalises drive-letter + slash direction
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => { stderrLogger({ msg: "orch.main.fatal", err: err.message, stack: err.stack }); process.exit(1); });
}
