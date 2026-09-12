// NEX Workforce v2 · Slice 1d · Reaper
// ─────────────────────────────────────────────────────────────────────────────
// Boring housekeeping process. On a schedule (default 30s):
//   1. nex_workforce.reap_expired_leases()          — reclaim expired · dead-letter exhausted
//   2. nex_workforce.requeue_soft_fail_backoff_elapsed() — graduate soft_fail whose backoff elapsed
//
// Absolutely does NOT:
//   - inspect individual agent behaviour
//   - restart agents · tell agents what to do
//   - execute any domain work
//   - become a supervisor · become an orchestrator
//   - make business decisions
//   - interfere with healthy (non-expired) leases
//   - delete agent_heartbeat history (D2 rejected · that's a separate maintenance job)
//   - touch any schema other than nex_workforce
//
// Deployment: dumb OS watchdog (Task Scheduler / systemd / pm2). One reaper
// process in production. If two accidentally run, FOR UPDATE SKIP LOCKED in
// the SQL functions guarantees no double-processing (proven at Slice 1b).
//
// Reliability claim (per Philip's wording change 2026-09-04):
//   Each SQL function is transactionally bounded by its server-side query /
//   statement limits and processes work using FOR UPDATE SKIP LOCKED; the
//   Reaper itself has no unbounded application-side iteration.

import pg from "pg";
import { fileURLToPath, pathToFileURL } from "node:url";
import { withWorkforceRole } from "./lib/with_workforce_role.mjs";

const stderrLogger = (obj) => {
  try { process.stderr.write(JSON.stringify({ ts: new Date().toISOString(), ...obj }) + "\n"); } catch {}
};

export async function createReaper({ url, intervalMs, maxConsecutiveErrors, logger, poolMax } = {}) {
  const config = {
    url:                  url ?? process.env.NEX_WORKFORCE_URL,
    intervalMs:           intervalMs ?? Number(process.env.NEX_REAPER_INTERVAL_MS ?? 30000),
    maxConsecutiveErrors: maxConsecutiveErrors ?? Number(process.env.NEX_REAPER_MAX_CONSECUTIVE_ERRORS ?? 3),
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

  // Startup verify · nex_workforce schema must be present
  const check = await pool.query("SELECT 1 FROM pg_namespace WHERE nspname = 'nex_workforce'");
  if (check.rowCount === 0) {
    await pool.end();
    throw new Error("nex_workforce schema not present · migration not applied");
  }

  const reaper = {
    config, pool,
    log: config.logger,
    stopping: false, stopReason: null,
    consecutiveErrors: 0,
    tickCount: 0,
    lastTick: null,
  };
  reaper.log({ msg: "reaper.created", interval_ms: config.intervalMs, max_consecutive_errors: config.maxConsecutiveErrors });
  return reaper;
}

export async function destroyReaper(reaper) {
  if (reaper?.pool) await reaper.pool.end().catch(() => {});
}

/**
 * Run ONE tick: reap + requeue. Returns { ok, reclaimed?, dead_lettered?, requeued?, err? }.
 * On error, increments consecutiveErrors. If consecutiveErrors >= max, THROWS.
 * Otherwise, returns { ok: false, err } and caller can retry next tick.
 */
export async function runReaperOnce(reaper) {
  reaper.tickCount++;
  const tickN = reaper.tickCount;
  reaper.log({ msg: "reaper.tick.begin", tick_n: tickN });

  try {
    const t1 = Date.now();
    const r = await withWorkforceRole(reaper.pool, (c) =>
      c.query("SELECT * FROM nex_workforce.reap_expired_leases()"));
    const reclaim = r.rows[0];
    reaper.log({
      msg: "reaper.reap",
      reclaimed: reclaim.reclaimed,
      dead_lettered: reclaim.dead_lettered,
      duration_ms: Date.now() - t1,
    });

    const t2 = Date.now();
    const rq = await withWorkforceRole(reaper.pool, (c) =>
      c.query("SELECT nex_workforce.requeue_soft_fail_backoff_elapsed() AS requeued"));
    const requeued = rq.rows[0].requeued;
    reaper.log({
      msg: "reaper.requeue",
      requeued,
      duration_ms: Date.now() - t2,
    });

    reaper.consecutiveErrors = 0;
    reaper.lastTick = {
      ok: true, at: Date.now(),
      reclaimed: reclaim.reclaimed,
      dead_lettered: reclaim.dead_lettered,
      requeued,
    };
    reaper.log({ msg: "reaper.tick.end", tick_n: tickN, ok: true });
    return reaper.lastTick;

  } catch (err) {
    reaper.consecutiveErrors++;
    reaper.lastTick = { ok: false, at: Date.now(), err: err.message };
    reaper.log({
      msg: "reaper.tick.error",
      err: err.message,
      consecutive: reaper.consecutiveErrors,
    });

    if (reaper.consecutiveErrors >= reaper.config.maxConsecutiveErrors) {
      reaper.log({
        msg: "reaper.exit",
        reason: "too_many_errors",
        ticks_total: tickN,
        exit_code: 1,
      });
      throw new Error(`reaper too_many_errors: ${reaper.consecutiveErrors} consecutive · last: ${err.message}`);
    }

    reaper.log({ msg: "reaper.tick.end", tick_n: tickN, ok: false });
    return reaper.lastTick;
  }
}

/** Run the loop until requestStop is called OR too_many_errors escapes. */
export async function runReaperLoop(reaper) {
  reaper.log({ msg: "reaper.loop.start", interval_ms: reaper.config.intervalMs });
  try {
    while (!reaper.stopping) {
      await runReaperOnce(reaper);
      await sleepInterruptible(reaper.config.intervalMs, () => reaper.stopping);
    }
    reaper.log({
      msg: "reaper.exit",
      reason: reaper.stopReason ?? "requested",
      ticks_total: reaper.tickCount,
      exit_code: 0,
    });
  } catch (err) {
    reaper.log({ msg: "reaper.loop.err", err: err.message });
    throw err;
  }
}

export function requestStop(reaper, reason) {
  reaper.stopping = true;
  reaper.stopReason = reason ?? "requested";
}

function sleepInterruptible(ms, stopFlag) {
  return new Promise((resolve) => {
    const start = Date.now();
    const t = setInterval(() => {
      if (stopFlag() || Date.now() - start >= ms) { clearInterval(t); resolve(); }
    }, Math.min(50, ms));
  });
}

// ────────────────────────────────────────────────────────────────────────────
// Main · when invoked directly
// ────────────────────────────────────────────────────────────────────────────
async function main() {
  const reaper = await createReaper();
  process.on("SIGTERM", () => requestStop(reaper, "SIGTERM"));
  process.on("SIGINT",  () => requestStop(reaper, "SIGINT"));
  try {
    await runReaperLoop(reaper);
  } catch (err) {
    // too_many_errors already logged; let OS watchdog restart us
    process.exit(1);
  } finally {
    await destroyReaper(reaper);
  }
}

// Windows-safe main-guard · pathToFileURL normalises drive-letter + slash direction
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => { stderrLogger({ msg: "reaper.main.fatal", err: err.message, stack: err.stack }); process.exit(1); });
}
