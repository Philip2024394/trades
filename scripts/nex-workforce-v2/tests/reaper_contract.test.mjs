// NEX Workforce v2 · Slice 1d · Reaper Contract Test Suite
// ─────────────────────────────────────────────────────────────────────────────
// Target: portable PostgreSQL 17.11 · localhost:5439 · nex_workforce_slice1_test
// Governed by NEX Workforce Fault-Isolation Doctrine v1.
//
// Ten scenarios (Philip's approved contract):
//   R1  · empty queue tick
//   R2  · reclaim expired recoverable lease
//   R3  · dead-letter exhausted expired lease + audit row
//   R4  · requeue soft_fail whose backoff has elapsed
//   R5  · two reapers no double-process (SKIP LOCKED)
//   R6  · single tick error then next tick succeeds (consecutive resets)
//   R7  · 3 consecutive errors → runReaperOnce throws too_many_errors
//   R8  · SIGTERM (requestStop) mid-loop → graceful exit(0) equivalent
//   R9  · healthy (non-expired) leases NEVER touched
//   R10 · agent_heartbeat rows NEVER touched (D2 rejection empirically proven)

import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import pg from "pg";
import { createReaper, destroyReaper, runReaperOnce, runReaperLoop, requestStop } from "../reaper.mjs";

const CONN = {
  host: "127.0.0.1", port: 5439,
  user: "postgres", database: "nex_workforce_slice1_test",
};
const URL = `postgres://postgres@127.0.0.1:5439/nex_workforce_slice1_test`;

let pool;
const silent = () => {};

beforeAll(async () => {
  pool = new pg.Pool({ ...CONN, max: 10 });
  const r = await pool.query("SELECT current_database() AS db, current_setting('port') AS port");
  if (r.rows[0].db !== "nex_workforce_slice1_test") throw new Error(`wrong DB: ${r.rows[0].db}`);
  if (r.rows[0].port !== "5439") throw new Error(`wrong port: ${r.rows[0].port}`);
  console.log(`[setup] target · db=${r.rows[0].db} port=${r.rows[0].port}`);
});

afterAll(async () => { if (pool) await pool.end(); });

beforeEach(async () => {
  await pool.query("TRUNCATE nex_workforce.work_item_dead_letter, nex_workforce.work_item, nex_workforce.agent_heartbeat, nex_workforce.reaper_run RESTART IDENTITY CASCADE");
  await pool.query("DELETE FROM nex_workforce.job_registry");
  await pool.query("DELETE FROM nex_workforce.city_catalogue");
  await pool.query(`INSERT INTO nex_workforce.city_catalogue (slug, name, enabled, priority) VALUES ('city1', 'City 1', true, 100)`);
  await pool.query(`INSERT INTO nex_workforce.job_registry (slug, category_slug, source_slug, cadence_minutes, max_concurrent_per_source, max_attempts, lease_minutes, enabled, priority)
                    VALUES ('helloworld-job', 'helloworld', 'helloworld', 60, 25, 5, 1, true, 100)`);
});

async function seedPending(city) {
  await pool.query(`INSERT INTO nex_workforce.city_catalogue (slug, name, enabled, priority) VALUES ($1, $1, true, 100) ON CONFLICT DO NOTHING`, [city]);
  const r = await pool.query(`INSERT INTO nex_workforce.work_item (city_slug, category_slug, source_slug, generation, state)
                              VALUES ($1, 'helloworld', 'helloworld', 1, 'pending') RETURNING id`, [city]);
  return r.rows[0].id;
}
async function claim(agentId = "test-agent") {
  const r = await pool.query("SELECT nex_workforce.claim($1) AS row", [agentId]);
  return r.rows[0].row;
}
async function forceExpire(id, hoursAgo = 1) {
  await pool.query("UPDATE nex_workforce.work_item SET lease_deadline = now() - make_interval(hours => $2) WHERE id = $1", [id, hoursAgo]);
}
async function forceAttemptsMax(id) {
  await pool.query("UPDATE nex_workforce.work_item SET attempts = max_attempts WHERE id = $1", [id]);
}

async function makeReaper(overrides = {}) {
  return createReaper({
    url: URL,
    intervalMs: 50,
    maxConsecutiveErrors: 3,
    logger: silent,
    poolMax: 2,
    ...overrides,
  });
}

async function waitFor(cond, { timeoutMs = 5000, intervalMs = 30 } = {}) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await cond()) return true;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return false;
}

// ═════════════════════════════════════════════════════════════════════════════
// R1 · empty queue
// ═════════════════════════════════════════════════════════════════════════════
describe("R1 · empty queue tick", () => {
  it("reports 0 reclaimed · 0 dead_lettered · 0 requeued", async () => {
    const reaper = await makeReaper();
    try {
      const r = await runReaperOnce(reaper);
      expect(r.ok).toBe(true);
      expect(r.reclaimed).toBe(0);
      expect(r.dead_lettered).toBe(0);
      expect(r.requeued).toBe(0);
      expect(reaper.consecutiveErrors).toBe(0);
      // reaper_run audit row was inserted by the SQL function
      const rr = await pool.query("SELECT COUNT(*)::int AS n FROM nex_workforce.reaper_run");
      expect(rr.rows[0].n).toBe(1);
    } finally { await destroyReaper(reaper); }
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// R2 · reclaim expired recoverable
// ═════════════════════════════════════════════════════════════════════════════
describe("R2 · reclaim expired recoverable lease", () => {
  it("expired lease with attempts remaining → pending", async () => {
    const id = await seedPending("city1");
    const row = await claim();
    await forceExpire(id);
    const reaper = await makeReaper();
    try {
      const r = await runReaperOnce(reaper);
      expect(r.reclaimed).toBe(1);
      expect(r.dead_lettered).toBe(0);
      const wi = await pool.query("SELECT state, agent_id, lease_deadline, last_error_class FROM nex_workforce.work_item WHERE id = $1", [id]);
      expect(wi.rows[0].state).toBe("pending");
      expect(wi.rows[0].agent_id).toBeNull();
      expect(wi.rows[0].lease_deadline).toBeNull();
      expect(wi.rows[0].last_error_class).toBe("lease_expired");
    } finally { await destroyReaper(reaper); }
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// R3 · dead-letter exhausted expired
// ═════════════════════════════════════════════════════════════════════════════
describe("R3 · dead-letter exhausted expired lease + audit row", () => {
  it("expired with attempts=max → dead_letter + INSERT into work_item_dead_letter", async () => {
    const id = await seedPending("city1");
    await claim();
    await forceAttemptsMax(id);
    await forceExpire(id);
    const reaper = await makeReaper();
    try {
      const r = await runReaperOnce(reaper);
      expect(r.reclaimed).toBe(0);
      expect(r.dead_lettered).toBe(1);
      const wi = await pool.query("SELECT state, finished_at, last_error, last_error_class FROM nex_workforce.work_item WHERE id = $1", [id]);
      expect(wi.rows[0].state).toBe("dead_letter");
      expect(wi.rows[0].finished_at).not.toBeNull();
      expect(wi.rows[0].last_error).toMatch(/lease_expired.*exhausted/);
      const dl = await pool.query("SELECT work_item_id, last_error_class FROM nex_workforce.work_item_dead_letter WHERE work_item_id = $1", [id]);
      expect(dl.rows).toHaveLength(1);
      expect(dl.rows[0].last_error_class).toBe("lease_expired");
    } finally { await destroyReaper(reaper); }
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// R4 · requeue soft_fail elapsed
// ═════════════════════════════════════════════════════════════════════════════
describe("R4 · requeue soft_fail whose backoff has elapsed", () => {
  it("soft_fail row with next_eligible_at <= now → pending", async () => {
    const id = await seedPending("city1");
    const row = await claim();
    // fail_soft with a short backoff · then force next_eligible_at to now
    await pool.query("SELECT nex_workforce.fail_soft($1,$2,$3,$4,$5,$6)",
      ["test-agent", row.id, row.generation, "test transient", "transient", 60]);
    await pool.query("UPDATE nex_workforce.work_item SET next_eligible_at = now() - interval '1 minute' WHERE id = $1", [id]);
    const reaper = await makeReaper();
    try {
      const r = await runReaperOnce(reaper);
      expect(r.requeued).toBe(1);
      const wi = await pool.query("SELECT state FROM nex_workforce.work_item WHERE id = $1", [id]);
      expect(wi.rows[0].state).toBe("pending");
    } finally { await destroyReaper(reaper); }
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// R5 · two reapers no double-process
// ═════════════════════════════════════════════════════════════════════════════
describe("R5 · two reapers run in parallel · no double-process", () => {
  it("20 expired leases · 2 reapers concurrent · each lease reclaimed exactly once", async () => {
    // Seed + claim 20 distinct pending items
    for (let i = 0; i < 20; i++) await seedPending(`city-r5-${i}`);
    for (let i = 0; i < 20; i++) {
      const row = await claim(`claimer-${i}`);
      expect(row).not.toBeNull();
    }
    // Force all to expired
    await pool.query("UPDATE nex_workforce.work_item SET lease_deadline = now() - interval '1 hour' WHERE state = 'leased'");

    const r1 = await makeReaper();
    const r2 = await makeReaper();
    try {
      const [a, b] = await Promise.all([runReaperOnce(r1), runReaperOnce(r2)]);
      expect(a.ok && b.ok).toBe(true);
      const sumReclaimed = a.reclaimed + b.reclaimed;
      const sumDead      = a.dead_lettered + b.dead_lettered;
      expect(sumReclaimed + sumDead).toBe(20);
      const stillLeased = await pool.query("SELECT COUNT(*)::int AS n FROM nex_workforce.work_item WHERE state = 'leased'");
      expect(stillLeased.rows[0].n).toBe(0);
      // Sum of reaper_run rows = 2
      const rr = await pool.query("SELECT COUNT(*)::int AS n FROM nex_workforce.reaper_run");
      expect(rr.rows[0].n).toBe(2);
    } finally { await destroyReaper(r1); await destroyReaper(r2); }
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// R6 · single tick error then next tick succeeds
// ═════════════════════════════════════════════════════════════════════════════
describe("R6 · single tick error · consecutive resets on next success", () => {
  it("wrap pool to fail once · next tick succeeds", async () => {
    const reaper = await makeReaper();
    try {
      // R6 fault injection · pre-cutover this replaced pool.query; post-cutover
      // the reaper accesses the DB via withWorkforceRole(pool, cb) which calls
      // pool.connect() and cb(client). So we inject the fault at the CLIENT
      // layer: wrap pool.connect() to return a client whose .query() throws
      // once on the FIRST reap SQL, then delegates.
      const realPool = reaper.pool;
      let faultsInjected = 0;
      reaper.pool = {
        async connect() {
          const c = await realPool.connect();
          const origQuery = c.query.bind(c);
          c.query = async (sql, params) => {
            // Only fault the actual reap invocation · leave BEGIN/SET LOCAL ROLE/
            // SELECT current_user/COMMIT/ROLLBACK/RESET ROLE intact so the
            // helper's fail-closed shell operates normally.
            if (typeof sql === "string" && /reap_expired_leases\s*\(/i.test(sql) && faultsInjected === 0) {
              faultsInjected++;
              throw new Error("simulated tick fault");
            }
            return origQuery(sql, params);
          };
          return c;
        },
        end: () => realPool.end(),
      };

      const r1 = await runReaperOnce(reaper);
      expect(r1.ok).toBe(false);
      expect(r1.err).toMatch(/simulated tick fault/);
      expect(reaper.consecutiveErrors).toBe(1);

      const r2 = await runReaperOnce(reaper);
      expect(r2.ok).toBe(true);
      expect(reaper.consecutiveErrors).toBe(0);
    } finally { await destroyReaper(reaper); }
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// R7 · 3 consecutive errors → throws too_many_errors
// ═════════════════════════════════════════════════════════════════════════════
describe("R7 · N consecutive errors → runReaperOnce throws too_many_errors", () => {
  it("3 back-to-back failures · third throws · logs reaper.exit reason=too_many_errors", async () => {
    const logs = [];
    const reaper = await makeReaper({
      maxConsecutiveErrors: 3,
      logger: (obj) => logs.push(obj),
    });
    try {
      const realPool = reaper.pool;
      reaper.pool = {
        query: async () => { throw new Error("persistent DB fault"); },
        end: () => realPool.end(),
      };

      const r1 = await runReaperOnce(reaper);
      expect(r1.ok).toBe(false);
      expect(reaper.consecutiveErrors).toBe(1);

      const r2 = await runReaperOnce(reaper);
      expect(r2.ok).toBe(false);
      expect(reaper.consecutiveErrors).toBe(2);

      await expect(runReaperOnce(reaper)).rejects.toThrow(/too_many_errors/);
      expect(reaper.consecutiveErrors).toBe(3);

      const exitLog = logs.find((l) => l.msg === "reaper.exit");
      expect(exitLog).toBeDefined();
      expect(exitLog.reason).toBe("too_many_errors");
      expect(exitLog.exit_code).toBe(1);
    } finally { await destroyReaper(reaper); }
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// R8 · SIGTERM (requestStop) mid-loop → graceful
// ═════════════════════════════════════════════════════════════════════════════
describe("R8 · requestStop mid-loop → graceful exit", () => {
  it("loop exits cleanly · log has reaper.exit reason=SIGTERM · exit_code=0", async () => {
    const logs = [];
    const reaper = await makeReaper({ intervalMs: 30, logger: (obj) => logs.push(obj) });
    try {
      const loopP = runReaperLoop(reaper);
      // Wait for at least one tick to complete
      await waitFor(() => reaper.tickCount >= 1);
      requestStop(reaper, "SIGTERM");
      await loopP;
      const exitLog = logs.find((l) => l.msg === "reaper.exit");
      expect(exitLog).toBeDefined();
      expect(exitLog.reason).toBe("SIGTERM");
      expect(exitLog.exit_code).toBe(0);
      expect(reaper.tickCount).toBeGreaterThanOrEqual(1);
    } finally { await destroyReaper(reaper); }
  }, 10000);
});

// ═════════════════════════════════════════════════════════════════════════════
// R9 · healthy leases never touched
// ═════════════════════════════════════════════════════════════════════════════
describe("R9 · healthy (non-expired) leases NEVER touched", () => {
  it("seed 3 expired + 5 healthy leases · reaper touches only the 3 expired", async () => {
    const expiredIds = [];
    const healthyIds = [];
    for (let i = 0; i < 3; i++) {
      const id = await seedPending(`city-r9-exp-${i}`);
      await claim(`agent-${i}`);
      expiredIds.push(id);
    }
    for (let i = 0; i < 5; i++) {
      const id = await seedPending(`city-r9-ok-${i}`);
      await claim(`agent-ok-${i}`);
      healthyIds.push(id);
    }
    // Force only the 3 to expired · leave 5 with healthy lease_deadline (in the future)
    for (const id of expiredIds) await forceExpire(id);

    const reaper = await makeReaper();
    try {
      const r = await runReaperOnce(reaper);
      expect(r.reclaimed).toBe(3);
      expect(r.dead_lettered).toBe(0);
      // Healthy ones must remain leased with lease_deadline in the future
      const rows = await pool.query(
        "SELECT id, state, lease_deadline > now() AS healthy FROM nex_workforce.work_item WHERE id = ANY($1::uuid[])",
        [healthyIds]
      );
      expect(rows.rows).toHaveLength(5);
      expect(rows.rows.every((r) => r.state === "leased" && r.healthy)).toBe(true);
      // Expired ones now pending
      const exp = await pool.query(
        "SELECT state FROM nex_workforce.work_item WHERE id = ANY($1::uuid[])",
        [expiredIds]
      );
      expect(exp.rows.every((r) => r.state === "pending")).toBe(true);
    } finally { await destroyReaper(reaper); }
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// R10 · agent_heartbeat rows NEVER touched (D2 rejection · proven)
// ═════════════════════════════════════════════════════════════════════════════
describe("R10 · agent_heartbeat rows NEVER touched by the reaper (D2 proven)", () => {
  it("seed old heartbeat rows · run 5 reaper ticks · every row still present with unchanged last_beat_at", async () => {
    // Seed 3 stale heartbeat rows (last_beat_at 2 hours ago) that a "cleanup"
    // reaper WOULD delete. Since D2 was rejected, the reaper must leave them
    // completely alone.
    for (let i = 0; i < 3; i++) {
      await pool.query(`
        INSERT INTO nex_workforce.agent_heartbeat (agent_id, pid, host, started_at, last_beat_at, state)
        VALUES ($1, $2, 'test-host', now() - interval '3 hours', now() - interval '2 hours', 'idle')
      `, [`stale-agent-${i}`, 10000 + i]);
    }
    const before = await pool.query("SELECT agent_id, EXTRACT(EPOCH FROM last_beat_at)::bigint AS ts FROM nex_workforce.agent_heartbeat ORDER BY agent_id");
    expect(before.rows).toHaveLength(3);

    const reaper = await makeReaper();
    try {
      for (let i = 0; i < 5; i++) await runReaperOnce(reaper);

      const after = await pool.query("SELECT agent_id, EXTRACT(EPOCH FROM last_beat_at)::bigint AS ts FROM nex_workforce.agent_heartbeat ORDER BY agent_id");
      // Same rows, same last_beat_at → reaper made ZERO mutations to this table
      expect(after.rows).toHaveLength(3);
      expect(after.rows).toEqual(before.rows);
    } finally { await destroyReaper(reaper); }
  });
});
