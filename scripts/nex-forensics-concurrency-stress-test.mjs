// scripts/nex-forensics-concurrency-stress-test.mjs
//
// P0 verification harness · 2026-08-24 · reproduces the SERIALIZABLE (40001)
// storm we saw in the 7h forensic report and proves the retry helper drops
// the failure rate to near-zero. Runs against a SCRATCH provider row so it
// never contaminates real Nominatim/Overpass leases.
//
// Usage:
//   node scripts/nex-forensics-concurrency-stress-test.mjs
//     [--workers=N]         · default 20 · number of concurrent lease acquires
//     [--rounds=N]          · default 3  · number of back-to-back rounds
//     [--interval-ms=N]     · default 50 · scratch provider's min_interval_ms
//     [--concurrent=N]      · default 1  · scratch provider's max_concurrent
//     [--no-retry]          · disable the retry helper to prove BEFORE numbers
//
// The scratch provider name embeds a UUID so parallel runs don't collide.
// All rows created by the harness are cleaned up in the finally block.

import pg from "pg";
import { randomUUID } from "node:crypto";

const NEX_POSTGRES_URL = process.env.NEX_POSTGRES_URL
  ?? "postgresql://postgres:Admin1phil@localhost:5433/nex_dev";
const pool = new pg.Pool({ connectionString: NEX_POSTGRES_URL, max: 25 });

function argInt(name, dflt) {
  const raw = process.argv.find((a) => a.startsWith(`--${name}=`));
  if (!raw) return dflt;
  const v = parseInt(raw.slice(raw.indexOf("=") + 1), 10);
  return Number.isFinite(v) ? v : dflt;
}
const WORKERS      = argInt("workers", 20);
const ROUNDS       = argInt("rounds", 3);
const INTERVAL_MS  = argInt("interval-ms", 50);
const MAX_CONC     = argInt("concurrent", 1);
const NO_RETRY     = process.argv.includes("--no-retry");

const PROVIDER_ID = `stress-test-${randomUUID().slice(0, 8)}`;

// ── Direct copy of the acquireProviderLease control-flow so the harness
//    can toggle the retry behaviour on/off for BEFORE/AFTER comparison ──
const RETRYABLE = new Set(["40001", "40P01"]);
async function sleepWithJitter(base, attempt) {
  const backoff = Math.min(base * Math.pow(2, attempt), 2000);
  const jitter  = Math.floor(Math.random() * backoff);
  return new Promise((r) => setTimeout(r, backoff + jitter));
}

async function acquireLease(provider, walkerId, { retryEnabled }) {
  const MAX_WAIT_MS = 60000;
  const MAX_SERIALIZATION_RETRIES = 8;
  const deadline = Date.now() + MAX_WAIT_MS;
  let attempts = 0;
  const stats = { attempts: 0, serialization_conflicts: 0, retries: 0 };
  while (Date.now() < deadline) {
    stats.attempts += 1;
    const client = await pool.connect();
    let doRetry = false;
    try {
      await client.query("BEGIN ISOLATION LEVEL SERIALIZABLE");
      const cfgR = await client.query(
        `SELECT provider, min_interval_ms, max_concurrent FROM nex.provider_rate_config WHERE provider = $1 FOR UPDATE`,
        [provider],
      );
      if (cfgR.rowCount === 0) { await client.query("ROLLBACK"); throw new Error("Provider missing"); }
      const cfg = cfgR.rows[0];
      const activeR = await client.query(
        `SELECT lease_id, acquired_at, expires_at FROM nex.provider_rate_lease WHERE provider = $1 AND released_at IS NULL`,
        [provider],
      );
      const now = Date.now();
      const effectivelyActive = activeR.rows.filter((r) => new Date(r.expires_at).getTime() > now);
      if (effectivelyActive.length >= cfg.max_concurrent) {
        const oldest = effectivelyActive.reduce((a, b) => (new Date(a.expires_at) < new Date(b.expires_at) ? a : b));
        const wait = Math.max(20, new Date(oldest.expires_at).getTime() - now);
        await client.query("COMMIT");
        await new Promise((r) => setTimeout(r, Math.min(wait, deadline - Date.now())));
        continue;
      }
      const lastR = await client.query(
        `SELECT MAX(released_at) AS latest FROM nex.provider_rate_lease WHERE provider = $1 AND released_at IS NOT NULL`,
        [provider],
      );
      const lastActivity = Math.max(
        lastR.rows[0]?.latest ? new Date(lastR.rows[0].latest).getTime() : 0,
        ...effectivelyActive.map((r) => new Date(r.acquired_at).getTime()),
        0,
      );
      if (lastActivity > 0 && (now - lastActivity) < cfg.min_interval_ms) {
        const wait = cfg.min_interval_ms - (now - lastActivity);
        await client.query("COMMIT");
        await new Promise((r) => setTimeout(r, Math.min(wait, deadline - Date.now())));
        continue;
      }
      const ins = await client.query(
        `INSERT INTO nex.provider_rate_lease (provider, walker_id) VALUES ($1, $2) RETURNING lease_id`,
        [provider, walkerId],
      );
      await client.query("COMMIT");
      return { ok: true, leaseId: ins.rows[0].lease_id, stats };
    } catch (e) {
      try { await client.query("ROLLBACK"); } catch { /* ignore */ }
      if (RETRYABLE.has(e?.code)) {
        stats.serialization_conflicts += 1;
        if (retryEnabled && attempts < MAX_SERIALIZATION_RETRIES) {
          attempts += 1;
          stats.retries += 1;
          doRetry = true;
        } else {
          return { ok: false, error: e?.code ?? "unknown", stats };
        }
      } else {
        return { ok: false, error: e?.message ?? "unknown", stats };
      }
    } finally {
      client.release();
    }
    if (doRetry) await sleepWithJitter(50, attempts);
  }
  return { ok: false, error: "deadline", stats };
}

async function releaseLease(leaseId) {
  await pool.query(
    `UPDATE nex.provider_rate_lease SET released_at = now() WHERE lease_id = $1 AND released_at IS NULL`,
    [leaseId],
  );
}

async function setupScratchProvider() {
  await pool.query(
    `INSERT INTO nex.provider_rate_config (provider, min_interval_ms, max_concurrent)
     VALUES ($1, $2, $3)
     ON CONFLICT (provider) DO UPDATE SET min_interval_ms = EXCLUDED.min_interval_ms, max_concurrent = EXCLUDED.max_concurrent`,
    [PROVIDER_ID, INTERVAL_MS, MAX_CONC],
  );
}
async function teardownScratchProvider() {
  // Cascade cleanup so we never leave stress-test rows in prod tables.
  await pool.query(`DELETE FROM nex.provider_rate_lease  WHERE provider = $1`, [PROVIDER_ID]);
  await pool.query(`DELETE FROM nex.provider_rate_config WHERE provider = $1`, [PROVIDER_ID]);
}

async function runRound(round) {
  const workerFns = Array.from({ length: WORKERS }, (_, i) => async () => {
    const t0 = Date.now();
    const r = await acquireLease(PROVIDER_ID, `stress:${round}:${i}`, { retryEnabled: !NO_RETRY });
    const t1 = Date.now();
    if (r.ok) {
      // Hold lease briefly to force downstream workers to serialise.
      await new Promise((res) => setTimeout(res, 5));
      await releaseLease(r.leaseId);
    }
    return { round, worker: i, ok: r.ok, error: r.error, ms: t1 - t0, ...r.stats };
  });
  const roundStart = Date.now();
  const results = await Promise.all(workerFns.map((fn) => fn()));
  const roundMs = Date.now() - roundStart;
  const okCount = results.filter((r) => r.ok).length;
  const failCount = results.length - okCount;
  const totalConflicts = results.reduce((a, r) => a + (r.serialization_conflicts ?? 0), 0);
  const totalRetries   = results.reduce((a, r) => a + (r.retries ?? 0), 0);
  const failByCode = results
    .filter((r) => !r.ok)
    .reduce((acc, r) => ((acc[r.error] = (acc[r.error] ?? 0) + 1), acc), {});
  return { round, okCount, failCount, roundMs, totalConflicts, totalRetries, failByCode };
}

async function main() {
  console.log(`══════════════════════════════════════════════════════════════`);
  console.log(`  NEX Concurrency Stress Test`);
  console.log(`  provider   : ${PROVIDER_ID}`);
  console.log(`  workers    : ${WORKERS}`);
  console.log(`  rounds     : ${ROUNDS}`);
  console.log(`  interval   : ${INTERVAL_MS}ms  max_concurrent=${MAX_CONC}`);
  console.log(`  retry      : ${NO_RETRY ? "OFF (BEFORE-mode)" : "ON (AFTER-mode)"}`);
  console.log(`══════════════════════════════════════════════════════════════`);
  try {
    await setupScratchProvider();
    const roundResults = [];
    for (let r = 0; r < ROUNDS; r++) {
      console.log(`\n──── Round ${r + 1}/${ROUNDS} ────`);
      const res = await runRound(r);
      roundResults.push(res);
      console.log(`  ok=${res.okCount}/${WORKERS} · fail=${res.failCount} · roundMs=${res.roundMs}`);
      console.log(`  40001 conflicts observed: ${res.totalConflicts}`);
      console.log(`  retries executed        : ${res.totalRetries}`);
      if (res.failCount > 0) console.log(`  fail codes: ${JSON.stringify(res.failByCode)}`);
    }
    console.log(`\n══════════════════════════════════════════════════════════════`);
    console.log(`  SUMMARY (mode=${NO_RETRY ? "no-retry BEFORE" : "retry AFTER"})`);
    console.log(`══════════════════════════════════════════════════════════════`);
    const tOk        = roundResults.reduce((a, r) => a + r.okCount, 0);
    const tFail      = roundResults.reduce((a, r) => a + r.failCount, 0);
    const tConflicts = roundResults.reduce((a, r) => a + r.totalConflicts, 0);
    const tRetries   = roundResults.reduce((a, r) => a + r.totalRetries, 0);
    const total      = tOk + tFail;
    console.log(`  total workers      : ${total}`);
    console.log(`  succeeded          : ${tOk}  (${((tOk / total) * 100).toFixed(1)}%)`);
    console.log(`  failed             : ${tFail} (${((tFail / total) * 100).toFixed(1)}%)`);
    console.log(`  40001 conflicts    : ${tConflicts}  (raw contention · not user-visible)`);
    console.log(`  retries executed   : ${tRetries}  (contention recovered by retry helper)`);
  } finally {
    await teardownScratchProvider();
    await pool.end();
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
