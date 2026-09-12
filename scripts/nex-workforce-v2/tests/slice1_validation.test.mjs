// NEX Workforce v2 · Slice 1b · Validation Suite
// Target: portable PostgreSQL 17.11 · localhost:5439 · nex_workforce_slice1_test
// Governing doctrine: doctrine_nex_workforce_fault_isolation_v1_2026_09_03.md
// Migration under test: supabase/migrations/_slice1_nex_workforce_v2_schema.sql (R3)
//
// Ten assertions per Philip's approval instructions (2026-09-03):
//   1. terminal rows cannot be mutated
//   2. stale generation / ghost agent cannot heartbeat/checkpoint/complete/fail_soft
//   3. soft_fail generation fencing works
//   4. exhausted expired leases become dead_letter
//   5. dead-letter audit rows are created
//   6. concurrent reapers cannot double-process the same lease
//   7. simultaneous claims against one source never exceed max_concurrent_per_source
//   8. simultaneous claims against different sources remain independently concurrent
//   9. generation increments correctly on every re-lease
//  10. runs against the isolated staged migration only (proven by connection target)
//
// PRODUCTION MODEL note: each work_item has a UNIQUE (city, category, source)
// tuple at any moment. Multi-item tests seed distinct cities per item (mirrors
// real orchestrator behavior of enqueueing one row per rotation-eligible tuple).

import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import pg from "pg";

const CONN = {
  host: "127.0.0.1",
  port: 5439,
  user: "postgres",
  database: "nex_workforce_slice1_test",
};

let pool;

beforeAll(async () => {
  pool = new pg.Pool({ ...CONN, max: 10 });
  const r = await pool.query(
    "SELECT current_database() AS db, current_setting('port') AS port, current_setting('listen_addresses') AS listen"
  );
  if (r.rows[0].db !== "nex_workforce_slice1_test") throw new Error(`wrong DB: ${r.rows[0].db}`);
  if (r.rows[0].port !== "5439") throw new Error(`wrong port: ${r.rows[0].port}`);
  console.log(`[setup] target verified · db=${r.rows[0].db} port=${r.rows[0].port} listen=${r.rows[0].listen}`);
});

afterAll(async () => {
  if (pool) await pool.end();
});

beforeEach(async () => {
  await pool.query("TRUNCATE nex_workforce.work_item_dead_letter, nex_workforce.work_item, nex_workforce.agent_heartbeat, nex_workforce.reaper_run RESTART IDENTITY CASCADE");
  await pool.query("DELETE FROM nex_workforce.job_registry");
  await pool.query("DELETE FROM nex_workforce.city_catalogue");

  // Baseline city + job registry for single-item tests
  await pool.query(`
    INSERT INTO nex_workforce.city_catalogue (slug, name, enabled, priority) VALUES
      ('yogyakarta', 'Yogyakarta', true, 100)
  `);
  await pool.query(`
    INSERT INTO nex_workforce.job_registry (slug, category_slug, source_slug, cadence_minutes, max_concurrent_per_source, max_attempts, lease_minutes, enabled, priority) VALUES
      ('restaurants-overpass',   'restaurants',   'overpass', 60, 3,  5, 15, true, 100),
      ('cafes-overpass',         'cafes',         'overpass', 60, 3,  5, 15, true, 100),
      ('retail-fashion-source2', 'retail-fashion','source2',  60, 3,  5, 15, true, 100),
      ('retail-books-source3',   'retail-books',  'source3',  60, 3,  5, 15, true, 100),
      ('retail-shoes-source4',   'retail-shoes',  'source4',  60, 3,  5, 15, true, 100),
      ('retail-tyres-source5',   'retail-tyres',  'source5',  60, 3,  5, 15, true, 100)
  `);
});

// Seed one pending row for a specific (city, category, source) tuple.
async function seedOne(city, category, source) {
  await pool.query(
    `INSERT INTO nex_workforce.city_catalogue (slug, name, enabled, priority)
     VALUES ($1, $1, true, 100) ON CONFLICT (slug) DO NOTHING`,
    [city]
  );
  await pool.query(
    `INSERT INTO nex_workforce.work_item (city_slug, category_slug, source_slug, generation, state)
     VALUES ($1, $2, $3, 1, 'pending')`,
    [city, category, source]
  );
}

// Seed N pending rows across N distinct cities, all sharing (category, source).
// Mirrors real production: each work_item has a unique tuple.
async function seedManyForSource(count, category, source, cityPrefix = "testcity") {
  for (let i = 0; i < count; i++) {
    await seedOne(`${cityPrefix}-${i}`, category, source);
  }
}

async function claim(agentId, client = pool) {
  const r = await client.query("SELECT nex_workforce.claim($1) AS row", [agentId]);
  return r.rows[0].row;
}

async function countByState(state, source = null) {
  const params = [state];
  let sql = "SELECT COUNT(*)::int AS n FROM nex_workforce.work_item WHERE state = $1";
  if (source) { sql += " AND source_slug = $2"; params.push(source); }
  const r = await pool.query(sql, params);
  return r.rows[0].n;
}

// Test-only fast-forward: after a reap that pushed next_eligible_at into the
// future, this lets the next claim() pick the row up immediately. Same-state
// UPDATE (state stays 'pending'), permitted by the trigger.
async function fastForwardEligibility() {
  await pool.query("UPDATE nex_workforce.work_item SET next_eligible_at = now() WHERE state = 'pending' AND next_eligible_at > now()");
}

// ═════════════════════════════════════════════════════════════════════════════
// ASSERTION 1 · terminal-state immutability
// ═════════════════════════════════════════════════════════════════════════════
describe("Assertion 1 · terminal-state immutability", () => {
  it("completed row rejects any UPDATE", async () => {
    await seedOne("yogyakarta", "restaurants", "overpass");
    const row = await claim("agent-t1");
    const ok = (await pool.query("SELECT nex_workforce.complete($1,$2,$3,$4,$5) AS r",
      ["agent-t1", row.id, row.generation, 100, 0])).rows[0].r;
    expect(ok).toBe(true);

    await expect(
      pool.query("UPDATE nex_workforce.work_item SET last_error='tampering' WHERE id=$1", [row.id])
    ).rejects.toThrow(/terminal and immutable/);
    await expect(
      pool.query("UPDATE nex_workforce.work_item SET state='pending' WHERE id=$1", [row.id])
    ).rejects.toThrow(/terminal and immutable/);
  });

  it("dead_letter row rejects any UPDATE", async () => {
    await seedOne("yogyakarta", "restaurants", "overpass");
    const row = await claim("agent-t2");
    const ok = (await pool.query("SELECT nex_workforce.fail_hard($1,$2,$3,$4,$5) AS r",
      ["agent-t2", row.id, row.generation, "permanent", "permanent"])).rows[0].r;
    expect(ok).toBe(true);

    await expect(
      pool.query("UPDATE nex_workforce.work_item SET last_error='tampering' WHERE id=$1", [row.id])
    ).rejects.toThrow(/terminal and immutable/);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// ASSERTION 2 · ghost-agent generation fencing
// ═════════════════════════════════════════════════════════════════════════════
describe("Assertion 2 · ghost-agent generation fencing", () => {
  it("stale generation cannot heartbeat/checkpoint/complete/fail_soft/fail_hard", async () => {
    await seedOne("yogyakarta", "restaurants", "overpass");

    const agentA = await claim("agent-A");
    const staleGen = agentA.generation;

    await pool.query("UPDATE nex_workforce.work_item SET lease_deadline = now() - interval '1 hour' WHERE id=$1", [agentA.id]);
    await pool.query("SELECT * FROM nex_workforce.reap_expired_leases()");
    await fastForwardEligibility();  // bypass backoff

    const agentB = await claim("agent-B");
    expect(agentB).not.toBeNull();
    expect(agentB.id).toBe(agentA.id);
    expect(agentB.generation).toBeGreaterThan(staleGen);

    const hb  = (await pool.query("SELECT nex_workforce.heartbeat($1,$2,$3) AS r", ["agent-A", agentA.id, staleGen])).rows[0].r;
    const cp  = (await pool.query("SELECT nex_workforce.checkpoint($1,$2,$3,$4::jsonb) AS r", ["agent-A", agentA.id, staleGen, "{}"])).rows[0].r;
    const cmp = (await pool.query("SELECT nex_workforce.complete($1,$2,$3,$4,$5) AS r", ["agent-A", agentA.id, staleGen, 999, 999])).rows[0].r;
    const fs  = (await pool.query("SELECT nex_workforce.fail_soft($1,$2,$3,$4,$5,$6) AS r", ["agent-A", agentA.id, staleGen, "err", "transient", 30])).rows[0].r;
    const fh  = (await pool.query("SELECT nex_workforce.fail_hard($1,$2,$3,$4,$5) AS r", ["agent-A", agentA.id, staleGen, "err", "permanent"])).rows[0].r;

    expect(hb).toBe(false);
    expect(cp).toBe(false);
    expect(cmp).toBe(false);
    expect(fs).toBe(false);
    expect(fh).toBe(false);

    const okB = (await pool.query("SELECT nex_workforce.heartbeat($1,$2,$3) AS r", ["agent-B", agentB.id, agentB.generation])).rows[0].r;
    expect(okB).toBe(true);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// ASSERTION 3 · soft_fail generation fencing
// ═════════════════════════════════════════════════════════════════════════════
describe("Assertion 3 · soft_fail generation fencing", () => {
  it("fail_hard on soft_fail rejects stale generation, accepts current", async () => {
    await seedOne("yogyakarta", "restaurants", "overpass");
    const claimed = await claim("agent-sf-1");

    const okSoft = (await pool.query("SELECT nex_workforce.fail_soft($1,$2,$3,$4,$5,$6) AS r",
      ["agent-sf-1", claimed.id, claimed.generation, "transient error", "transient", 30])).rows[0].r;
    expect(okSoft).toBe(true);

    const r = await pool.query("SELECT state, generation FROM nex_workforce.work_item WHERE id=$1", [claimed.id]);
    expect(r.rows[0].state).toBe("soft_fail");
    const currentGen = r.rows[0].generation;

    const okBadGen = (await pool.query("SELECT nex_workforce.fail_hard($1,$2,$3,$4,$5) AS r",
      ["some-other-agent", claimed.id, currentGen - 1, "wrong gen", "permanent"])).rows[0].r;
    expect(okBadGen).toBe(false);

    const okRightGen = (await pool.query("SELECT nex_workforce.fail_hard($1,$2,$3,$4,$5) AS r",
      ["some-other-agent", claimed.id, currentGen, "correct gen", "permanent"])).rows[0].r;
    expect(okRightGen).toBe(true);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// ASSERTION 4 + 5 · reaper dead-letters exhausted expired lease + audit row
// ═════════════════════════════════════════════════════════════════════════════
describe("Assertion 4+5 · reaper dead-letters exhausted leases + creates audit row", () => {
  it("reaper transitions leased→dead_letter, INSERTs audit row", async () => {
    await seedOne("yogyakarta", "restaurants", "overpass");
    const row = await claim("agent-exhaust");

    await pool.query(
      "UPDATE nex_workforce.work_item SET attempts=max_attempts, lease_deadline=now() - interval '1 hour' WHERE id=$1",
      [row.id]
    );

    const r = await pool.query("SELECT * FROM nex_workforce.reap_expired_leases()");
    expect(r.rows[0].reclaimed).toBe(0);
    expect(r.rows[0].dead_lettered).toBe(1);

    const wi = await pool.query("SELECT state, finished_at FROM nex_workforce.work_item WHERE id=$1", [row.id]);
    expect(wi.rows[0].state).toBe("dead_letter");
    expect(wi.rows[0].finished_at).not.toBeNull();

    const dl = await pool.query(
      "SELECT work_item_id, last_error, last_error_class FROM nex_workforce.work_item_dead_letter WHERE work_item_id=$1",
      [row.id]
    );
    expect(dl.rows).toHaveLength(1);
    expect(dl.rows[0].last_error).toMatch(/lease_expired.*exhausted/);
    expect(dl.rows[0].last_error_class).toBe("lease_expired");
  });

  it("reaper reclaims (leased→pending) when attempts remaining", async () => {
    await seedOne("yogyakarta", "restaurants", "overpass");
    const row = await claim("agent-recover");
    await pool.query("UPDATE nex_workforce.work_item SET lease_deadline=now() - interval '1 hour' WHERE id=$1", [row.id]);

    const r = await pool.query("SELECT * FROM nex_workforce.reap_expired_leases()");
    expect(r.rows[0].reclaimed).toBe(1);
    expect(r.rows[0].dead_lettered).toBe(0);

    const wi = await pool.query(
      "SELECT state, agent_id, lease_deadline, last_error_class FROM nex_workforce.work_item WHERE id=$1",
      [row.id]
    );
    expect(wi.rows[0].state).toBe("pending");
    expect(wi.rows[0].agent_id).toBeNull();
    expect(wi.rows[0].lease_deadline).toBeNull();
    expect(wi.rows[0].last_error_class).toBe("lease_expired");
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// ASSERTION 6 · concurrent reapers do not double-process
// ═════════════════════════════════════════════════════════════════════════════
describe("Assertion 6 · concurrent reapers do not double-process", () => {
  it("5 concurrent reapers process 20 expired leases exactly once each", async () => {
    // Seed 20 distinct pending items (different cities, same source)
    await seedManyForSource(20, "restaurants", "overpass");
    // Raise cap so we can claim all 20 for setup
    await pool.query("UPDATE nex_workforce.job_registry SET max_concurrent_per_source = 25 WHERE source_slug = 'overpass'");

    for (let i = 0; i < 20; i++) {
      const row = await claim(`agent-mass-${i}`);
      expect(row).not.toBeNull();
    }
    expect(await countByState("leased", "overpass")).toBe(20);

    // Force all 20 to expired
    await pool.query("UPDATE nex_workforce.work_item SET lease_deadline = now() - interval '1 hour' WHERE state='leased'");

    // 5 concurrent reapers via separate connections
    const reaperPool = new pg.Pool({ ...CONN, max: 5 });
    try {
      const results = await Promise.all(
        Array.from({ length: 5 }, () => reaperPool.query("SELECT * FROM nex_workforce.reap_expired_leases()"))
      );
      const totalReclaimed = results.reduce((s, r) => s + r.rows[0].reclaimed, 0);
      const totalDead      = results.reduce((s, r) => s + r.rows[0].dead_lettered, 0);
      console.log(`[assertion-6] reclaimed=${totalReclaimed} dead_lettered=${totalDead} sum=${totalReclaimed + totalDead}`);
      expect(totalReclaimed + totalDead).toBe(20);
      expect(await countByState("leased")).toBe(0);

      const rr = await pool.query("SELECT COUNT(*)::int AS n FROM nex_workforce.reaper_run");
      expect(rr.rows[0].n).toBe(5);
    } finally {
      await reaperPool.end();
    }
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// ASSERTION 7 · single-source concurrency cap is HARD-BOUNDED
// ═════════════════════════════════════════════════════════════════════════════
describe("Assertion 7 · single-source concurrency cap is HARD-BOUNDED", () => {
  it("20 parallel claims for one source with cap=3 · leased count never exceeds 3", async () => {
    await seedManyForSource(20, "restaurants", "overpass");
    // Cap 3 (default from beforeEach)

    const workerPool = new pg.Pool({ ...CONN, max: 25 });
    let maxObserved = 0;
    let observationCount = 0;
    let successCount = 0;
    try {
      const stopMonitor = { flag: false };
      const monitor = (async () => {
        while (!stopMonitor.flag) {
          const r = await pool.query("SELECT COUNT(*)::int AS n FROM nex_workforce.work_item WHERE state='leased' AND source_slug='overpass'");
          maxObserved = Math.max(maxObserved, r.rows[0].n);
          observationCount++;
          await new Promise((res) => setTimeout(res, 3));
        }
      })();

      const results = await Promise.all(
        Array.from({ length: 20 }, (_, i) => workerPool.query("SELECT nex_workforce.claim($1) AS row", [`worker-${i}`]))
      );
      successCount = results.filter((r) => r.rows[0].row !== null).length;

      stopMonitor.flag = true;
      await monitor;

      const finalLeased = await countByState("leased", "overpass");
      console.log(`[assertion-7] successCount=${successCount} finalLeased=${finalLeased} maxObserved=${maxObserved} monitorSamples=${observationCount}`);

      expect(successCount).toBeLessThanOrEqual(3);
      expect(finalLeased).toBeLessThanOrEqual(3);
      expect(maxObserved).toBeLessThanOrEqual(3);
      expect(successCount).toBeGreaterThanOrEqual(1);
    } finally {
      await workerPool.end();
    }
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// ASSERTION 8 · multi-source claims stay independently concurrent
// ═════════════════════════════════════════════════════════════════════════════
describe("Assertion 8 · multi-source independent concurrency", () => {
  it("parallel claims distribute across sources · advisory lock is not global", async () => {
    // 20 pending per source × 5 sources = 100 pending
    await seedManyForSource(20, "restaurants",   "overpass", "ovp");
    await seedManyForSource(20, "retail-fashion","source2",  "src2");
    await seedManyForSource(20, "retail-books",  "source3",  "src3");
    await seedManyForSource(20, "retail-shoes",  "source4",  "src4");
    await seedManyForSource(20, "retail-tyres",  "source5",  "src5");

    const workerPool = new pg.Pool({ ...CONN, max: 30 });
    try {
      const results = await Promise.all(
        Array.from({ length: 30 }, (_, i) => workerPool.query("SELECT nex_workforce.claim($1) AS row", [`multi-w-${i}`]))
      );
      const claims = results.map((r) => r.rows[0].row).filter(Boolean);
      const perSource = {};
      for (const c of claims) {
        perSource[c.source_slug] = (perSource[c.source_slug] || 0) + 1;
      }
      const distinctSources = Object.keys(perSource).length;
      console.log(`[assertion-8] totalClaimed=${claims.length} distinctSources=${distinctSources} perSource=${JSON.stringify(perSource)}`);

      for (const [src, count] of Object.entries(perSource)) {
        expect(count).toBeLessThanOrEqual(3);
      }
      expect(distinctSources).toBeGreaterThanOrEqual(2);
      expect(claims.length).toBeGreaterThanOrEqual(5);
    } finally {
      await workerPool.end();
    }
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// ASSERTION 9 · generation increments on every re-lease
// ═════════════════════════════════════════════════════════════════════════════
describe("Assertion 9 · generation increments on every re-lease", () => {
  it("three claim/reap cycles produce strictly increasing generations", async () => {
    await seedOne("yogyakarta", "restaurants", "overpass");

    const gens = [];
    for (let cycle = 0; cycle < 3; cycle++) {
      const row = await claim(`gen-agent-${cycle}`);
      expect(row).not.toBeNull();
      gens.push(row.generation);
      await pool.query("UPDATE nex_workforce.work_item SET lease_deadline = now() - interval '1 hour' WHERE id=$1", [row.id]);
      await pool.query("SELECT * FROM nex_workforce.reap_expired_leases()");
      await fastForwardEligibility();
    }
    console.log(`[assertion-9] generations=${JSON.stringify(gens)}`);
    for (let i = 1; i < gens.length; i++) {
      expect(gens[i]).toBeGreaterThan(gens[i - 1]);
    }
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// ASSERTION 10 · connection isolation
// ═════════════════════════════════════════════════════════════════════════════
describe("Assertion 10 · connection isolation", () => {
  it("all tests targeted port 5439 · database nex_workforce_slice1_test · 127.0.0.1", async () => {
    const r = await pool.query(
      "SELECT current_database() AS db, current_setting('port') AS port, inet_server_addr()::text AS addr"
    );
    expect(r.rows[0].db).toBe("nex_workforce_slice1_test");
    expect(r.rows[0].port).toBe("5439");
    // inet_server_addr returns CIDR notation (e.g. 127.0.0.1/32)
    expect(r.rows[0].addr).toMatch(/^127\.0\.0\.1/);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// ASSERTION 11 · R4 · historical + active can coexist for the same tuple
// A completed OR dead_letter row for (city, category, source) must NOT block
// a new pending row for the same tuple. The partial unique index
// work_item_dedupe_active covers only pending/leased/soft_fail.
// ═════════════════════════════════════════════════════════════════════════════
describe("Assertion 11 · R4 · completed historical row does NOT block new active row", () => {
  it("cycle 1 completes → cycle 2 INSERT for same tuple succeeds", async () => {
    await seedOne("yogyakarta", "restaurants", "overpass");
    const cycle1 = await claim("agent-c1");
    const ok = (await pool.query("SELECT nex_workforce.complete($1,$2,$3,$4,$5) AS r",
      ["agent-c1", cycle1.id, cycle1.generation, 42, 3])).rows[0].r;
    expect(ok).toBe(true);

    const wi1 = await pool.query("SELECT state FROM nex_workforce.work_item WHERE id=$1", [cycle1.id]);
    expect(wi1.rows[0].state).toBe("completed");

    // Cycle 2 · orchestrator enqueues a NEW active row for the same tuple.
    // In R3 this would have failed with unique constraint violation.
    // In R4 this must succeed.
    await pool.query(
      `INSERT INTO nex_workforce.work_item (city_slug, category_slug, source_slug, generation, state)
       VALUES ('yogyakarta', 'restaurants', 'overpass', 1, 'pending')`
    );

    const all = await pool.query(
      "SELECT state FROM nex_workforce.work_item WHERE city_slug='yogyakarta' AND category_slug='restaurants' AND source_slug='overpass' ORDER BY enqueued_at"
    );
    expect(all.rows.map((r) => r.state)).toEqual(["completed", "pending"]);

    // And cycle 2 is claimable
    const cycle2 = await claim("agent-c2");
    expect(cycle2).not.toBeNull();
    expect(cycle2.id).not.toBe(cycle1.id);
    expect(cycle2.city_slug).toBe("yogyakarta");
    expect(cycle2.category_slug).toBe("restaurants");
    expect(cycle2.source_slug).toBe("overpass");
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// ASSERTION 12 · R4 · dead_letter historical row does NOT block new active row
// ═════════════════════════════════════════════════════════════════════════════
describe("Assertion 12 · R4 · dead_letter historical row does NOT block new active row", () => {
  it("cycle 1 dead-letters → cycle 2 INSERT for same tuple succeeds", async () => {
    await seedOne("yogyakarta", "restaurants", "overpass");
    const cycle1 = await claim("agent-c1-dl");
    const ok = (await pool.query("SELECT nex_workforce.fail_hard($1,$2,$3,$4,$5) AS r",
      ["agent-c1-dl", cycle1.id, cycle1.generation, "permanent", "permanent"])).rows[0].r;
    expect(ok).toBe(true);

    const wi1 = await pool.query("SELECT state FROM nex_workforce.work_item WHERE id=$1", [cycle1.id]);
    expect(wi1.rows[0].state).toBe("dead_letter");

    // A NEW active row for the same tuple must succeed
    await pool.query(
      `INSERT INTO nex_workforce.work_item (city_slug, category_slug, source_slug, generation, state)
       VALUES ('yogyakarta', 'restaurants', 'overpass', 1, 'pending')`
    );

    const all = await pool.query(
      "SELECT state FROM nex_workforce.work_item WHERE city_slug='yogyakarta' AND category_slug='restaurants' AND source_slug='overpass' ORDER BY enqueued_at"
    );
    expect(all.rows.map((r) => r.state)).toEqual(["dead_letter", "pending"]);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// ASSERTION 13 · R4 · two simultaneous ACTIVE rows for same tuple are rejected
// The partial unique index MUST prevent double-enqueue while a row is active.
// ═════════════════════════════════════════════════════════════════════════════
describe("Assertion 13 · R4 · two active rows for same tuple are rejected", () => {
  it("second INSERT of pending for same tuple raises unique violation", async () => {
    await seedOne("yogyakarta", "restaurants", "overpass");
    // First row exists (pending). Second INSERT must fail.
    await expect(
      pool.query(
        `INSERT INTO nex_workforce.work_item (city_slug, category_slug, source_slug, generation, state)
         VALUES ('yogyakarta', 'restaurants', 'overpass', 1, 'pending')`
      )
    ).rejects.toThrow(/duplicate key.*work_item_dedupe_active/);
  });

  it("pending + leased for same tuple is also rejected (both are active states)", async () => {
    await seedOne("yogyakarta", "restaurants", "overpass");
    // Claim the pending → leased
    const row = await claim("agent-conflict");
    expect(row).not.toBeNull();
    // Now try to INSERT a second pending for the same tuple → must fail
    await expect(
      pool.query(
        `INSERT INTO nex_workforce.work_item (city_slug, category_slug, source_slug, generation, state)
         VALUES ('yogyakarta', 'restaurants', 'overpass', 2, 'pending')`
      )
    ).rejects.toThrow(/duplicate key.*work_item_dedupe_active/);
  });

  it("soft_fail is also an active state · second active row rejected", async () => {
    await seedOne("yogyakarta", "restaurants", "overpass");
    const row = await claim("agent-sf-conflict");
    const okSoft = (await pool.query("SELECT nex_workforce.fail_soft($1,$2,$3,$4,$5,$6) AS r",
      ["agent-sf-conflict", row.id, row.generation, "err", "transient", 30])).rows[0].r;
    expect(okSoft).toBe(true);
    // Now the row is soft_fail. A new pending for same tuple must fail.
    await expect(
      pool.query(
        `INSERT INTO nex_workforce.work_item (city_slug, category_slug, source_slug, generation, state)
         VALUES ('yogyakarta', 'restaurants', 'overpass', 1, 'pending')`
      )
    ).rejects.toThrow(/duplicate key.*work_item_dedupe_active/);
  });
});
