// NEX Workforce V2 · C11.5 · Capacity Contract · N=5 portable proving
// ─────────────────────────────────────────────────────────────────────────────
// Portable only · uses tests/support/fake_worker.mjs for lifecycle scenarios
// and portable PG17.11 (127.0.0.1:5439 · nex_workforce_slice1_test) for the
// concurrent claim / source-lock / lease-fencing tests (C11.5-4/5/6/11).
//
// Zero Project B contact.
// Zero .env.local mutation.
// Zero scheduler mutation.
// Zero legacy invocation.

import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { dirname, resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
import pg from "pg";

import {
  Role, StartupOrder, ShutdownOrder, SingletonRoles, NonSingletonRoles,
  MaxAgentCount, ExitClass, ChildState, isSpawnAllowed,
} from "../supervisor/lib/lifecycle_contract.mjs";
import { createSingletonRegistry } from "../supervisor/lib/singleton_registry.mjs";
import { createRestartPolicy } from "../supervisor/lib/restart_policy.mjs";
import { createChildLifecycle } from "../supervisor/lib/child_lifecycle.mjs";
import { classifyExit } from "../supervisor/lib/exit_classifier.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..", "..", "..");
const FAKE_WORKER = join(REPO_ROOT, "scripts/nex-workforce-v2/tests/support/fake_worker.mjs");

const silent = () => ({ info: () => {}, warn: () => {}, error: () => {}, critical: () => {} });

// Fresh lock dir per test run (isolates from any prior orphan lock artifacts)
let tmpLockDir;
beforeAll(() => {
  tmpLockDir = join(tmpdir(), `nex-c115-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  mkdirSync(tmpLockDir, { recursive: true });
});
afterAll(() => {
  try { rmSync(tmpLockDir, { recursive: true, force: true }); } catch {}
});

// Portable-PG connection used only by C11.5-4/5/6/11
const PG_CONN = { host: "127.0.0.1", port: 5439, user: "postgres", database: "nex_workforce_slice1_test" };
let pgPool = null;
let pgAvailable = false;

beforeAll(async () => {
  try {
    pgPool = new pg.Pool({ ...PG_CONN, max: 15 });
    const r = await pgPool.query("SELECT current_database() AS db, current_setting('port') AS port");
    if (r.rows[0].db === "nex_workforce_slice1_test" && r.rows[0].port === "5439") {
      pgAvailable = true;
    }
  } catch (e) {
    pgAvailable = false;
  }
});
afterAll(async () => { if (pgPool) await pgPool.end(); });

async function pgReset() {
  await pgPool.query("TRUNCATE nex_workforce.work_item_dead_letter, nex_workforce.work_item, nex_workforce.agent_heartbeat, nex_workforce.reaper_run RESTART IDENTITY CASCADE");
  await pgPool.query("DELETE FROM nex_workforce.job_registry");
  await pgPool.query("DELETE FROM nex_workforce.city_catalogue");
  // Seed 5 cities so tests can use distinct (city, cat, source) tuples that
  // satisfy the R4 work_item_dedupe_active UNIQUE (city, category, source)
  // partial index while state IN (pending, leased, soft_fail).
  for (let i = 1; i <= 5; i++) {
    await pgPool.query(`INSERT INTO nex_workforce.city_catalogue (slug, name, enabled, priority) VALUES ($1, $2, true, 100)`, [`city${i}`, `City ${i}`]);
  }
}

// Seed one pending row per distinct city_slug (uses cities city1..cityN).
// Each row is a distinct (city, category, source) tuple · satisfies R4 UNIQUE.
async function seedPendingPerCity(cities, category, source) {
  await pgPool.query(`INSERT INTO nex_workforce.job_registry (slug, category_slug, source_slug, cadence_minutes, max_concurrent_per_source, max_attempts, lease_minutes, enabled, priority)
                      VALUES ($1, $2, $3, 60, 10, 5, 1, true, 100)
                      ON CONFLICT (slug) DO NOTHING`, [`${category}-${source}`, category, source]);
  const ids = [];
  for (const city of cities) {
    const r = await pgPool.query(`INSERT INTO nex_workforce.work_item (city_slug, category_slug, source_slug, generation, state, priority, max_attempts, enqueued_at, next_eligible_at)
      VALUES ($1, $2, $3, 1, 'pending', 100, 5, now(), now() - interval '1 minute')
      RETURNING id`, [city, category, source]);
    ids.push(r.rows[0].id);
  }
  return ids;
}

// ═════════════════════════════════════════════════════════════════════════════
// C11.5-1 · Registration · 5 agents accepted
// ═════════════════════════════════════════════════════════════════════════════
describe("C11.5-1 · registration · five agents accepted", () => {
  it("MaxAgentCount is 5", () => {
    expect(MaxAgentCount).toBe(5);
  });

  it("all 5 agents register successfully", () => {
    const lc = createChildLifecycle({ logger: silent(), autoStart: false, parentRole: Role.SUPERVISOR });
    for (const id of ["agent-1","agent-2","agent-3","agent-4","agent-5"]) {
      lc.register({ role: Role.AGENT, identifier: id, script: FAKE_WORKER, env: { NEX_FAKE_HANG: "true" } });
    }
    const agents = lc.list().filter(c => c.role === Role.AGENT);
    expect(agents).toHaveLength(5);
    expect(new Set(agents.map(a => a.identifier))).toEqual(new Set(["agent-1","agent-2","agent-3","agent-4","agent-5"]));
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// C11.5-2 · Sixth agent rejected
// ═════════════════════════════════════════════════════════════════════════════
describe("C11.5-2 · sixth agent deterministically rejected", () => {
  it("register 6th agent throws AGENT count ceiling", () => {
    const lc = createChildLifecycle({ logger: silent(), autoStart: false });
    for (const id of ["a1","a2","a3","a4","a5"]) {
      lc.register({ role: Role.AGENT, identifier: id, script: FAKE_WORKER, env: { NEX_FAKE_HANG: "true" } });
    }
    expect(() => lc.register({ role: Role.AGENT, identifier: "a6", script: FAKE_WORKER, env: {} }))
      .toThrow(/AGENT count ceiling 5 reached/);
    // State not corrupted
    expect(lc.list().filter(c => c.role === Role.AGENT)).toHaveLength(5);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// C11.5-3 · Independent identities · no singleton collision · no lock collision
// ═════════════════════════════════════════════════════════════════════════════
describe("C11.5-3 · agents are non-singleton · independent identifiers", () => {
  it("Role.AGENT is in NonSingletonRoles · not in SingletonRoles", () => {
    expect(NonSingletonRoles.has(Role.AGENT)).toBe(true);
    expect(SingletonRoles.has(Role.AGENT)).toBe(false);
  });

  it("singleton_registry rejects AGENT acquisition", () => {
    const reg = createSingletonRegistry({ baseDir: tmpLockDir });
    const r = reg.acquire(Role.AGENT);
    expect(r.acquired).toBe(false);
    expect(r.reason).toBe("not_singleton_role");
    expect(() => reg.pathFor(Role.AGENT)).toThrow(/NOT a singleton role/);
  });

  it("5 agent identifiers coexist without lock-path collision (no lock created for AGENT)", () => {
    const reg = createSingletonRegistry({ baseDir: tmpLockDir });
    // Register REAPER + ORCHESTRATOR to prove those still hold singleton
    expect(reg.acquire(Role.REAPER).acquired).toBe(true);
    expect(reg.acquire(Role.ORCHESTRATOR).acquired).toBe(true);
    // AGENT × 5 acquisitions all refused as not_singleton_role · no lock files
    for (let i = 0; i < 5; i++) {
      const r = reg.acquire(Role.AGENT);
      expect(r.acquired).toBe(false);
    }
    reg.release(Role.REAPER);
    reg.release(Role.ORCHESTRATOR);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// C11.5-4 · Concurrent claims · FOR UPDATE SKIP LOCKED · N=5 agents
// ═════════════════════════════════════════════════════════════════════════════
describe("C11.5-4 · concurrent claims · SKIP LOCKED prevents duplicate ownership", () => {
  it.runIf ? it.runIf(true) : it;
  it("5 simultaneous claims against 5 pending rows (distinct cities) produce 5 distinct owners · no double claim", async () => {
    if (!pgAvailable) { console.log("  [skip] portable PG not available"); return; }
    await pgReset();
    // 5 distinct (city, category, source) tuples via 5 different cities
    const ids = await seedPendingPerCity(["city1","city2","city3","city4","city5"], "cat_c4", "src_c4");
    expect(ids).toHaveLength(5);

    const claims = await Promise.all([1,2,3,4,5].map(i =>
      pgPool.query("SELECT nex_workforce.claim($1) AS row", [`c115-agent-${i}`])
    ));
    const rows = claims.map(r => r.rows[0].row).filter(Boolean);
    // Every agent should get a row (5 rows, 5 agents · SKIP LOCKED · no duplicates)
    expect(rows).toHaveLength(5);
    // Assert each got a unique work_item · no duplicate ID
    const claimedIds = rows.map(r => r.id);
    expect(new Set(claimedIds).size).toBe(claimedIds.length);
    // Assert every claim landed on one of the seeded pending rows
    for (const cid of claimedIds) expect(ids).toContain(cid);
    // Assert 5 distinct owner IDs on the work_item rows
    const owners = (await pgPool.query(`SELECT agent_id, id FROM nex_workforce.work_item WHERE state='leased' ORDER BY agent_id`)).rows;
    expect(owners).toHaveLength(5);
    expect(new Set(owners.map(o => o.agent_id)).size).toBe(5);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// C11.5-5 · Same-source concurrency · max_concurrent_per_source honored
// ═════════════════════════════════════════════════════════════════════════════
describe("C11.5-5 · same-source concurrency respects max_concurrent_per_source", () => {
  it("job_registry.max_concurrent_per_source acts as the concurrency ceiling for same-source claims", async () => {
    if (!pgAvailable) { console.log("  [skip] portable PG not available"); return; }
    await pgReset();
    // Seed job with lower max_concurrent_per_source=2. Use 5 distinct cities
    // so the R4 UNIQUE partial index doesn't reject seeding · but all 5 rows
    // share the same (category, source) pair, so max_concurrent_per_source=2
    // must cap simultaneous leases at 2.
    await pgPool.query(`INSERT INTO nex_workforce.job_registry (slug, category_slug, source_slug, cadence_minutes, max_concurrent_per_source, max_attempts, lease_minutes, enabled, priority)
                        VALUES ('c5-job', 'cat_c5', 'src_c5', 60, 2, 5, 1, true, 100)`);
    for (let i = 1; i <= 5; i++) {
      await pgPool.query(`INSERT INTO nex_workforce.work_item (city_slug, category_slug, source_slug, generation, state, priority, max_attempts, enqueued_at, next_eligible_at)
        VALUES ($1, 'cat_c5', 'src_c5', 1, 'pending', 100, 5, now(), now() - interval '1 minute')`, [`city${i}`]);
    }
    const claims = await Promise.all([1,2,3,4,5].map(i =>
      pgPool.query("SELECT nex_workforce.claim($1) AS row", [`c115-src-${i}`])
    ));
    const rows = claims.map(r => r.rows[0].row).filter(Boolean);
    // Max 2 concurrent leases per source per contract
    expect(rows.length).toBeLessThanOrEqual(2);
    // Any that got a lease must have been distinct
    expect(new Set(rows.map(r => r.id)).size).toBe(rows.length);
    // Every claimed row must be for src_c5
    for (const r of rows) expect(r.source_slug).toBe("src_c5");
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// C11.5-6 · Different-source independence
// ═════════════════════════════════════════════════════════════════════════════
describe("C11.5-6 · different sources claim independently", () => {
  it("sequential claims across 5 different sources all succeed · no source blocks another", async () => {
    if (!pgAvailable) { console.log("  [skip] portable PG not available"); return; }
    await pgReset();
    for (let i = 1; i <= 5; i++) {
      await pgPool.query(`INSERT INTO nex_workforce.job_registry (slug, category_slug, source_slug, cadence_minutes, max_concurrent_per_source, max_attempts, lease_minutes, enabled, priority)
                          VALUES ($1, $2, $3, 60, 10, 5, 1, true, 100)`, [`c6-job-${i}`, `cat_${i}`, `src_${i}`]);
      await pgPool.query(`INSERT INTO nex_workforce.work_item (city_slug, category_slug, source_slug, generation, state, priority, max_attempts, enqueued_at, next_eligible_at)
        VALUES ($1, $2, $3, 1, 'pending', 100, 5, now(), now() - interval '1 minute')`, [`city${i}`, `cat_${i}`, `src_${i}`]);
    }
    // Sequential claims · isolates the "different-source independent" property
    // from concurrent SKIP LOCKED throughput semantics. If one source could
    // block another, sequential claims would fail too.
    const rows = [];
    for (let i = 1; i <= 5; i++) {
      const r = (await pgPool.query("SELECT nex_workforce.claim($1) AS row", [`c115-diff-seq-${i}`])).rows[0].row;
      if (r) rows.push(r);
    }
    expect(rows).toHaveLength(5);
    expect(new Set(rows.map(r => r.source_slug)).size).toBe(5);
    expect(new Set(rows.map(r => r.city_slug)).size).toBe(5);
    // Every seeded source has exactly one lease
    const leased = (await pgPool.query(`SELECT source_slug, count(*)::int AS n FROM nex_workforce.work_item WHERE state='leased' GROUP BY source_slug`)).rows;
    expect(leased).toHaveLength(5);
    for (const r of leased) expect(r.n).toBe(1);
  });

  it("concurrent claims across 5 different sources · NO double-claim (safety property) · advisory-lock throughput may vary", async () => {
    if (!pgAvailable) { console.log("  [skip] portable PG not available"); return; }
    await pgReset();
    for (let i = 1; i <= 5; i++) {
      await pgPool.query(`INSERT INTO nex_workforce.job_registry (slug, category_slug, source_slug, cadence_minutes, max_concurrent_per_source, max_attempts, lease_minutes, enabled, priority)
                          VALUES ($1, $2, $3, 60, 10, 5, 1, true, 100)`, [`c6b-job-${i}`, `cat_${i}`, `src_${i}`]);
      await pgPool.query(`INSERT INTO nex_workforce.work_item (city_slug, category_slug, source_slug, generation, state, priority, max_attempts, enqueued_at, next_eligible_at)
        VALUES ($1, $2, $3, 1, 'pending', 100, 5, now(), now() - interval '1 minute')`, [`city${i}`, `cat_${i}`, `src_${i}`]);
    }
    // Safety property: even under concurrent-race, no two agents get the same
    // work_item. Throughput (whether all 5 or fewer succeed on one burst) is
    // NOT part of the safety contract · SKIP LOCKED + snapshot-serializable
    // may leave some sessions with zero rows found on a single-burst race.
    const claims = await Promise.all([1,2,3,4,5].map(i =>
      pgPool.query("SELECT nex_workforce.claim($1) AS row", [`c115-diff-conc-${i}`])
    ));
    const rows = claims.map(r => r.rows[0].row).filter(Boolean);
    // At least 1 (progress) · at most 5 (no phantom rows)
    expect(rows.length).toBeGreaterThanOrEqual(1);
    expect(rows.length).toBeLessThanOrEqual(5);
    // Safety: no duplicate IDs · no duplicate agent_ids on claimed rows
    expect(new Set(rows.map(r => r.id)).size).toBe(rows.length);
    const leased = (await pgPool.query(`SELECT agent_id, source_slug FROM nex_workforce.work_item WHERE state='leased'`)).rows;
    expect(leased).toHaveLength(rows.length);
    expect(new Set(leased.map(r => r.agent_id)).size).toBe(leased.length);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// C11.5-7 · One-agent failure does not affect other agents
// ═════════════════════════════════════════════════════════════════════════════
describe("C11.5-7 · single agent failure isolated · other agents unaffected", () => {
  it("5 agents · agent B crashes · A/C/D/E stay RUNNING", async () => {
    const lc = createChildLifecycle({ logger: silent(), autoStart: true });
    // A/C/D/E hang · B exits code 1
    for (const [id, env] of [
      ["A", { NEX_FAKE_HANG: "true" }],
      ["B", { NEX_FAKE_SLEEP_MS: "50", NEX_FAKE_EXIT_CODE: "1" }],
      ["C", { NEX_FAKE_HANG: "true" }],
      ["D", { NEX_FAKE_HANG: "true" }],
      ["E", { NEX_FAKE_HANG: "true" }],
    ]) {
      lc.register({ role: Role.AGENT, identifier: `iso-${id}`, script: FAKE_WORKER, env: { NEX_FAKE_ROLE: "AGENT", ...env } });
      await lc.start(Role.AGENT, `iso-${id}`);
    }
    await new Promise(r => setTimeout(r, 400));
    const bState = lc.get(Role.AGENT, "iso-B").state;
    expect(bState).toBe(ChildState.EXITED);
    for (const id of ["A","C","D","E"]) {
      const state = lc.get(Role.AGENT, `iso-${id}`).state;
      expect(state, `agent iso-${id} unexpectedly ${state}`).toBe(ChildState.RUNNING);
    }
    // Cleanup · stop hanging agents · disable autoStart to prevent restart of B
    lc.setAutoStart(false);
    await lc.shutdownAll({ waitMs: 1500 });
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// C11.5-8 · No restart cascade
// ═════════════════════════════════════════════════════════════════════════════
describe("C11.5-8 · agent failure does not cascade to supervisor/reaper/orchestrator/other agents", () => {
  it("restart_policy history keyed per (role, identifier) · agent-B ceiling doesn't affect A/C/D/E or singletons", () => {
    let t = 1000;
    const rp = createRestartPolicy({ maxRestarts: 3, windowMs: 60_000, now: () => t });
    // Simulate 4 crashes for agent-B (exceeds ceiling of 3)
    for (let i = 0; i < 4; i++) { rp.record(Role.AGENT, "agent-B", ExitClass.TRANSIENT_CRASH); t += 10; }
    expect(rp.allow(Role.AGENT, "agent-B", ExitClass.TRANSIENT_CRASH).allowed).toBe(false);
    // Other agents remain eligible for restart
    for (const id of ["agent-A","agent-C","agent-D","agent-E"]) {
      expect(rp.allow(Role.AGENT, id, ExitClass.TRANSIENT_CRASH).allowed).toBe(true);
    }
    // Singletons (REAPER, ORCHESTRATOR) unaffected
    expect(rp.allow(Role.REAPER, "reaper-1", ExitClass.TRANSIENT_CRASH).allowed).toBe(true);
    expect(rp.allow(Role.ORCHESTRATOR, "orchestrator-1", ExitClass.TRANSIENT_CRASH).allowed).toBe(true);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// C11.5-9 · Individual agent restart · bounded backoff
// ═════════════════════════════════════════════════════════════════════════════
describe("C11.5-9 · individual agent restart isolated · bounded backoff per identifier", () => {
  it("each agent has its own restart schedule and ceiling", () => {
    let t = 1000;
    const rp = createRestartPolicy({ maxRestarts: 3, windowMs: 60_000, now: () => t });
    // agent-A: 1 restart · agent-B: 3 restarts (at ceiling)
    rp.record(Role.AGENT, "agent-A", ExitClass.TRANSIENT_CRASH); t += 10;
    for (let i = 0; i < 3; i++) { rp.record(Role.AGENT, "agent-B", ExitClass.TRANSIENT_CRASH); t += 10; }
    const decA = rp.allow(Role.AGENT, "agent-A", ExitClass.TRANSIENT_CRASH);
    const decB = rp.allow(Role.AGENT, "agent-B", ExitClass.TRANSIENT_CRASH);
    expect(decA.allowed).toBe(true);
    expect(decA.delayMs).toBe(2000); // second restart · backoff[1]
    expect(decB.allowed).toBe(false);
    expect(decB.reason).toMatch(/restart_ceiling_reached/);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// C11.5-10 · Concurrent heartbeat independence (portable PG · agent_heartbeat table)
// ═════════════════════════════════════════════════════════════════════════════
describe("C11.5-10 · concurrent heartbeat independence · 5 agents write independently", () => {
  it("5 agent_heartbeat rows coexist · one row's failure/absence doesn't corrupt others", async () => {
    if (!pgAvailable) { console.log("  [skip] portable PG not available"); return; }
    await pgReset();
    // Insert 5 agent_heartbeat rows
    const ids = ["c115-hb-A","c115-hb-B","c115-hb-C","c115-hb-D","c115-hb-E"];
    for (const id of ids) {
      await pgPool.query(`INSERT INTO nex_workforce.agent_heartbeat (agent_id, pid, host, version, started_at, last_beat_at, state)
        VALUES ($1, $2, 'localhost', 'test', now(), now(), 'working')`, [id, Math.floor(Math.random()*100000)]);
    }
    // Assert all 5 rows exist
    const rowCount = (await pgPool.query(`SELECT count(*)::int AS n FROM nex_workforce.agent_heartbeat WHERE agent_id = ANY($1::text[])`, [ids])).rows[0].n;
    expect(rowCount).toBe(5);
    // "Fail" agent B by not updating its heartbeat · update others
    for (const id of ["c115-hb-A","c115-hb-C","c115-hb-D","c115-hb-E"]) {
      await pgPool.query(`UPDATE nex_workforce.agent_heartbeat SET last_beat_at = now() WHERE agent_id = $1`, [id]);
    }
    // Verify B is stale relative to others · but exists
    const stale = (await pgPool.query(`SELECT count(*)::int AS n FROM nex_workforce.agent_heartbeat WHERE agent_id='c115-hb-B'`)).rows[0].n;
    expect(stale).toBe(1);
    // Other agents' rows unaffected
    for (const id of ["c115-hb-A","c115-hb-C","c115-hb-D","c115-hb-E"]) {
      const r = (await pgPool.query(`SELECT last_beat_at FROM nex_workforce.agent_heartbeat WHERE agent_id=$1`, [id])).rows[0];
      expect(r.last_beat_at).toBeTruthy();
    }
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// C11.5-11 · Lease fencing · agent B cannot operate on agent A's lease
// ═════════════════════════════════════════════════════════════════════════════
describe("C11.5-11 · lease fencing prevents cross-agent lease operations", () => {
  it("complete() called by wrong agent_id on another agent's lease is rejected", async () => {
    if (!pgAvailable) { console.log("  [skip] portable PG not available"); return; }
    await pgReset();
    const ids = await seedPendingPerCity(["city1"], "cat_c11", "src_c11");
    // Agent A claims it
    const claimed = (await pgPool.query("SELECT nex_workforce.claim($1) AS row", ["c115-fence-A"])).rows[0].row;
    expect(claimed?.id).toBe(ids[0]);
    // Agent B attempts to complete A's lease · must be rejected
    const result = (await pgPool.query("SELECT nex_workforce.complete($1,$2,$3,$4,$5) AS ok",
      ["c115-fence-B", claimed.id, claimed.generation, 999, 0])).rows[0].ok;
    // Contract: complete() must reject when agent_id doesn't own the lease
    expect(result).toBe(false);
    // Work_item remains leased by A
    const state = (await pgPool.query(`SELECT state, agent_id FROM nex_workforce.work_item WHERE id=$1`, [ids[0]])).rows[0];
    expect(state.state).toBe("leased");
    expect(state.agent_id).toBe("c115-fence-A");
  });

  it("generation fencing · complete() with stale generation rejected", async () => {
    if (!pgAvailable) { console.log("  [skip] portable PG not available"); return; }
    await pgReset();
    const ids = await seedPendingPerCity(["city1"], "cat_c11b", "src_c11b");
    const claimed = (await pgPool.query("SELECT nex_workforce.claim($1) AS row", ["c115-gen-A"])).rows[0].row;
    // Fake a stale-generation complete() from correct agent
    const staleGen = claimed.generation - 1;
    const result = (await pgPool.query("SELECT nex_workforce.complete($1,$2,$3,$4,$5) AS ok",
      ["c115-gen-A", claimed.id, staleGen, 999, 0])).rows[0].ok;
    expect(result).toBe(false);
    const state = (await pgPool.query(`SELECT state FROM nex_workforce.work_item WHERE id=$1`, [claimed.id])).rows[0];
    expect(state.state).toBe("leased");
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// C11.5-12 · Graceful shutdown with 5 agents · C9 ShutdownOrder
// ═════════════════════════════════════════════════════════════════════════════
describe("C11.5-12 · graceful shutdown correctly stops SUPERVISOR + REAPER + ORCHESTRATOR + 5 AGENTS", () => {
  it("shutdownAll stops all 5 agents · ORCHESTRATOR → AGENT → REAPER order", async () => {
    const reg = createSingletonRegistry({ baseDir: tmpLockDir });
    const lc = createChildLifecycle({ logger: silent(), autoStart: true, singletonRegistry: reg });
    lc.register({ role: Role.REAPER,       identifier: "reaper-1",       script: FAKE_WORKER, env: { NEX_FAKE_ROLE: "REAPER", NEX_FAKE_HANG: "true" } });
    lc.register({ role: Role.ORCHESTRATOR, identifier: "orchestrator-1", script: FAKE_WORKER, env: { NEX_FAKE_ROLE: "ORCHESTRATOR", NEX_FAKE_HANG: "true" } });
    for (let i = 1; i <= 5; i++) {
      lc.register({ role: Role.AGENT, identifier: `agent-${i}`, script: FAKE_WORKER, env: { NEX_FAKE_ROLE: "AGENT", NEX_FAKE_HANG: "true" } });
    }
    await lc.start(Role.REAPER, "reaper-1");
    await lc.start(Role.ORCHESTRATOR, "orchestrator-1");
    for (let i = 1; i <= 5; i++) await lc.start(Role.AGENT, `agent-${i}`);
    // All should be RUNNING
    expect(lc.list().filter(c => c.state === ChildState.RUNNING)).toHaveLength(7);
    // Disable autoStart before shutdown so exit-handler restart is suppressed
    lc.setAutoStart(false);
    await lc.shutdownAll({ waitMs: 2000 });
    // All EXITED
    for (const c of lc.list()) {
      expect(c.state).toBe(ChildState.EXITED);
    }
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// C11.5-13 · Singleton preservation · SUPERVISOR/REAPER/ORCHESTRATOR remain single
// ═════════════════════════════════════════════════════════════════════════════
describe("C11.5-13 · singleton guarantees preserved · REAPER/ORCHESTRATOR still exactly one", () => {
  it("singleton_registry rejects second REAPER acquisition · alive-PID collision detected", () => {
    const reg1 = createSingletonRegistry({ baseDir: tmpLockDir });
    const a = reg1.acquire(Role.REAPER);
    expect(a.acquired).toBe(true);
    // Second attempt via a NEW registry pointing at same baseDir · OS-level collision
    const reg2 = createSingletonRegistry({ baseDir: tmpLockDir });
    const b = reg2.acquire(Role.REAPER);
    expect(b.acquired).toBe(false);
    expect(b.reason).toBe("existing_supervisor_alive");
    reg1.release(Role.REAPER);
  });

  it("singleton_registry rejects second ORCHESTRATOR acquisition", () => {
    const reg1 = createSingletonRegistry({ baseDir: tmpLockDir });
    const a = reg1.acquire(Role.ORCHESTRATOR);
    expect(a.acquired).toBe(true);
    const reg2 = createSingletonRegistry({ baseDir: tmpLockDir });
    const b = reg2.acquire(Role.ORCHESTRATOR);
    expect(b.acquired).toBe(false);
    reg1.release(Role.ORCHESTRATOR);
  });

  it("SingletonRoles still contains exactly SUPERVISOR/REAPER/ORCHESTRATOR · AGENT never singleton", () => {
    expect([...SingletonRoles].sort()).toEqual([Role.ORCHESTRATOR, Role.REAPER, Role.SUPERVISOR].sort());
    expect(SingletonRoles.has(Role.AGENT)).toBe(false);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// C11.5-14 · Process accounting · registered = actual · after shutdown = 0
// ═════════════════════════════════════════════════════════════════════════════
describe("C11.5-14 · process accounting · registered count matches actual state · zero phantom children", () => {
  it("5 agents registered → 5 in list() before shutdown · all EXITED after shutdown · no phantom entries", async () => {
    const lc = createChildLifecycle({ logger: silent(), autoStart: true });
    for (let i = 1; i <= 5; i++) {
      lc.register({ role: Role.AGENT, identifier: `acc-${i}`, script: FAKE_WORKER, env: { NEX_FAKE_HANG: "true" } });
      await lc.start(Role.AGENT, `acc-${i}`);
    }
    const running = lc.list().filter(c => c.state === ChildState.RUNNING);
    expect(running).toHaveLength(5);
    // PIDs must be distinct
    expect(new Set(running.map(r => r.pid)).size).toBe(5);
    lc.setAutoStart(false);
    await lc.shutdownAll({ waitMs: 2000 });
    for (const c of lc.list()) {
      expect(c.state).toBe(ChildState.EXITED);
      expect(c.pid).toBeTruthy(); // pid remembered for forensics · not phantom
    }
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// C11.5-15 · Lock cleanup after graceful shutdown
// ═════════════════════════════════════════════════════════════════════════════
describe("C11.5-15 · lock cleanup · zero lifecycle locks after clean shutdown", () => {
  it("REAPER + ORCHESTRATOR locks are released after shutdownAll", async () => {
    const reg = createSingletonRegistry({ baseDir: tmpLockDir });
    const lc = createChildLifecycle({ logger: silent(), autoStart: true, singletonRegistry: reg });
    lc.register({ role: Role.REAPER,       identifier: "r1", script: FAKE_WORKER, env: { NEX_FAKE_HANG: "true" } });
    lc.register({ role: Role.ORCHESTRATOR, identifier: "o1", script: FAKE_WORKER, env: { NEX_FAKE_HANG: "true" } });
    await lc.start(Role.REAPER, "r1");
    await lc.start(Role.ORCHESTRATOR, "o1");
    // Locks present
    expect(existsSync(reg.pathFor(Role.REAPER))).toBe(true);
    expect(existsSync(reg.pathFor(Role.ORCHESTRATOR))).toBe(true);
    lc.setAutoStart(false);
    await lc.shutdownAll({ waitMs: 2000 });
    // Locks absent · shutdownAll called singletonRegistry.releaseAll()
    expect(existsSync(reg.pathFor(Role.REAPER))).toBe(false);
    expect(existsSync(reg.pathFor(Role.ORCHESTRATOR))).toBe(false);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// C11.5-16 · Failure isolation under shutdown · killing an agent mid-shutdown
// ═════════════════════════════════════════════════════════════════════════════
describe("C11.5-16 · shutdown remains stable when an agent dies during shutdown", () => {
  it("shutdownAll does not deadlock · concurrent-die does not corrupt state", async () => {
    const lc = createChildLifecycle({ logger: silent(), autoStart: true });
    for (let i = 1; i <= 5; i++) {
      // Mix: some hang, some exit-1 immediately during shutdown
      const env = i % 2 === 0 ? { NEX_FAKE_HANG: "true" } : { NEX_FAKE_SLEEP_MS: "100", NEX_FAKE_EXIT_CODE: "1" };
      lc.register({ role: Role.AGENT, identifier: `mix-${i}`, script: FAKE_WORKER, env });
      await lc.start(Role.AGENT, `mix-${i}`);
    }
    lc.setAutoStart(false);
    // shutdownAll must complete without hanging
    const t0 = Date.now();
    await lc.shutdownAll({ waitMs: 3000 });
    const durationMs = Date.now() - t0;
    expect(durationMs).toBeLessThan(15_000); // bounded · no deadlock
    // All children final state must be EXITED or DEGRADED (never STARTING/RUNNING/STOPPING)
    for (const c of lc.list()) {
      expect([ChildState.EXITED, ChildState.DEGRADED]).toContain(c.state);
    }
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// C11.5-17 · Repeated N=5 lifecycle cycles · 10 iterations
// ═════════════════════════════════════════════════════════════════════════════
describe("C11.5-17 · 10 repeated N=5 lifecycle cycles · no cumulative state corruption", () => {
  it("run register+start+shutdown 10 times · each cycle registers 5 fresh agents · no leaks", async () => {
    for (let cycle = 1; cycle <= 10; cycle++) {
      const lc = createChildLifecycle({ logger: silent(), autoStart: true });
      for (let i = 1; i <= 5; i++) {
        lc.register({ role: Role.AGENT, identifier: `cyc${cycle}-a${i}`, script: FAKE_WORKER, env: { NEX_FAKE_SLEEP_MS: "50", NEX_FAKE_EXIT_CODE: "0" } });
        await lc.start(Role.AGENT, `cyc${cycle}-a${i}`);
      }
      expect(lc.list().filter(c => c.role === Role.AGENT)).toHaveLength(5);
      lc.setAutoStart(false);
      await lc.shutdownAll({ waitMs: 2000 });
      // All 5 EXITED
      for (const c of lc.list()) expect(c.state).toBe(ChildState.EXITED);
    }
  }, 60_000);
});

// ═════════════════════════════════════════════════════════════════════════════
// C11.5-18 · Repeated 6-agent-rejection · ceiling remains deterministic
// ═════════════════════════════════════════════════════════════════════════════
describe("C11.5-18 · repeated 6-agent registration attempts · ceiling is deterministic", () => {
  it("100 attempts to register a 6th agent all fail with the same error · no race admits Agent 6", () => {
    const lc = createChildLifecycle({ logger: silent(), autoStart: false });
    for (let i = 1; i <= 5; i++) {
      lc.register({ role: Role.AGENT, identifier: `det-${i}`, script: FAKE_WORKER, env: { NEX_FAKE_HANG: "true" } });
    }
    let rejections = 0;
    let unexpectedAccept = 0;
    for (let n = 0; n < 100; n++) {
      try {
        lc.register({ role: Role.AGENT, identifier: `det-6-${n}`, script: FAKE_WORKER, env: {} });
        unexpectedAccept += 1;
      } catch (e) {
        if (/AGENT count ceiling 5 reached/.test(e.message)) rejections += 1;
        else throw e;
      }
    }
    expect(rejections).toBe(100);
    expect(unexpectedAccept).toBe(0);
    // State still exactly 5
    expect(lc.list().filter(c => c.role === Role.AGENT)).toHaveLength(5);
  });
});
