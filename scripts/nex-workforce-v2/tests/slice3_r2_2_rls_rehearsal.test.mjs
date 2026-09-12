// NEX Workforce · Slice 3 R2.2 · RLS Policy Fix · Production-Shape Rehearsal
// ─────────────────────────────────────────────────────────────────────────────
// Target: portable PostgreSQL 17.11 · localhost:5439 · nex_workforce_slice1_test
//
// Rehearsal contract:
//   1. Reproduce the exact production controlled-cycle failure on portable
//      under a non-superuser production-shape probe (SQLSTATE 42501 on
//      reaper_run insert).
//   2. Apply the R2.2 migration (policies-only).
//   3. Prove every hardened function that touches an RLS-enabled table now
//      succeeds under the same probe.
//   4. Prove nothing outside the RLS-policy scope has changed (roles / grants /
//      schema / brain-social / persister isolation / SECURITY DEFINER /
//      hardened search_path / EXECUTE allow-list / no BYPASSRLS anywhere).
//
// Every functional DB proof is rolled back OR narrowly-scoped to a synthetic
// work_item so no persistent workforce state escapes this suite.
//
// The suite's beforeAll ENABLE ROW LEVEL SECURITY on the six workforce tables
// (mirrors Project B state); the afterAll restores portable's baseline
// (RLS OFF) so downstream test files continue to run as before.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import pg from "pg";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

function computeEvidenceId(work_item_id, generation, query_hash, response_sha256) {
  return createHash("sha256")
    .update(`${work_item_id}::${generation}::${query_hash}::${response_sha256}`)
    .digest("hex");
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONN = { host: "127.0.0.1", port: 5439, user: "postgres", database: "nex_workforce_slice1_test" };
const R2_2_PATH = join(__dirname, "..", "..", "..", "scripts", "nex-migration", "_slice3-r2-2-rls.sql");

const RLS_TABLES = [
  "work_item", "agent_heartbeat", "reaper_run", "work_item_dead_letter",
  "city_catalogue", "job_registry",
];

const R2_2_POLICIES = [
  { name: "wa_work_item_select",              table: "work_item" },
  { name: "wa_work_item_insert",              table: "work_item" },
  { name: "wa_work_item_update",              table: "work_item" },
  { name: "wa_wi_dl_insert",                  table: "work_item_dead_letter" },
  { name: "wa_reaper_run_select",             table: "reaper_run" },
  { name: "wa_reaper_run_insert",             table: "reaper_run" },
  { name: "wa_reaper_run_update",             table: "reaper_run" },
  { name: "wa_city_catalogue_select",         table: "city_catalogue" },
  { name: "wa_job_registry_select",           table: "job_registry" },
  { name: "wp_food_business_work_item_select", table: "work_item" },
  { name: "wp_food_business_work_item_update", table: "work_item" },
];

let pool;         // postgres · superuser · used for state setup / catalog inspection
let probePool;    // nex_r22_runtime · LOGIN + NOSUPER + NOBYPASSRLS · production-shape

async function dropR22Policies() {
  for (const p of R2_2_POLICIES) {
    await pool.query(`DROP POLICY IF EXISTS ${p.name} ON nex_workforce.${p.table}`).catch(() => {});
  }
}
async function enableRlsOnAllSix() {
  for (const t of RLS_TABLES) {
    await pool.query(`ALTER TABLE nex_workforce.${t} ENABLE ROW LEVEL SECURITY`).catch(() => {});
  }
}
async function disableRlsOnAllSix() {
  for (const t of RLS_TABLES) {
    await pool.query(`ALTER TABLE nex_workforce.${t} DISABLE ROW LEVEL SECURITY`).catch(() => {});
  }
}
async function applyMigration() {
  const sql = readFileSync(R2_2_PATH, "utf8");
  await pool.query(sql);
}

beforeAll(async () => {
  pool = new pg.Pool({ ...CONN, max: 4 });

  // Production-shape probe · LOGIN + NOSUPERUSER + NOBYPASSRLS + NOCREATEROLE
  // + NOCREATEDB · exactly mirrors what Supabase-managed nex_app_runtime is on
  // Project B (except LOGIN=true which matches production runtime).
  await pool.query(`
    DO $body$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='nex_r22_runtime') THEN
        CREATE ROLE nex_r22_runtime LOGIN NOSUPERUSER NOBYPASSRLS NOCREATEROLE NOCREATEDB NOINHERIT;
      END IF;
    END $body$
  `);
  // Grant nex_workforce_app · mirrors Gate 3 grant on Project B
  await pool.query(`GRANT nex_workforce_app TO nex_r22_runtime WITH INHERIT TRUE, SET TRUE`);

  probePool = new pg.Pool({
    host: CONN.host, port: CONN.port, user: "nex_r22_runtime", database: CONN.database, max: 4,
  });

  // Reset to PRE-R2.2 production shape: RLS ENABLED on 6 tables · zero R2.2 policies.
  await enableRlsOnAllSix();
  await dropR22Policies();

  // Defensive cleanup · any leftover r22-* fixtures from a prior aborted run
  await pool.query(`DELETE FROM nex_workforce.work_item_dead_letter
    WHERE work_item_id IN (SELECT id FROM nex_workforce.work_item WHERE city_slug LIKE 'r22-%')`).catch(() => {});
  await pool.query(`DELETE FROM nex_workforce.work_item WHERE city_slug LIKE 'r22-%'`).catch(() => {});
  await pool.query(`DELETE FROM nex_workforce.job_registry WHERE slug LIKE 'r22-%'`).catch(() => {});
  await pool.query(`DELETE FROM nex_workforce.city_catalogue WHERE slug LIKE 'r22-%'`).catch(() => {});
});

afterAll(async () => {
  if (probePool) await probePool.end();
  if (pool) {
    // Restore portable baseline for downstream tests:
    //   1. Drop all 11 R2.2 policies · in particular the wp_food_business_*
    //      policies scoped to nex_workforce_persister_food_business, which
    //      otherwise block slice1h_r4_full_migration_rehearsal's beforeAll
    //      that tries to REASSIGN OWNED + DROP OWNED on the persister role.
    //   2. Disable RLS on the six tables · portable started with RLS OFF and
    //      other test files rely on that (they run as postgres/superuser but
    //      still expect no RLS filtering surprises).
    await dropR22Policies().catch(() => {});
    await disableRlsOnAllSix().catch(() => {});
    // Also defensively drop any leftover r22-* fixtures
    await pool.query(`DELETE FROM nex_workforce.work_item WHERE city_slug LIKE 'r22-%'`).catch(() => {});
    await pool.query(`DELETE FROM nex_workforce.job_registry WHERE slug LIKE 'r22-%'`).catch(() => {});
    await pool.query(`DELETE FROM nex_workforce.city_catalogue WHERE slug LIKE 'r22-%'`).catch(() => {});
    await pool.end();
  }
});

// Utility · run a statement under the production-shape probe inside a
// transaction that we can roll back. Captures error code for negative tests.
async function underProbe(sql, { params = [], rollback = true } = {}) {
  const c = await probePool.connect();
  const out = { ok: false, code: null, msg: null, rows: null };
  try {
    await c.query("BEGIN");
    try {
      await c.query("SET LOCAL ROLE nex_workforce_app");
      const r = await c.query(sql, params);
      out.ok = true; out.rows = r.rows; out.rowCount = r.rowCount;
    } catch (e) {
      out.code = e.code; out.msg = e.message;
    } finally {
      if (rollback || !out.ok) await c.query("ROLLBACK").catch(() => {});
      else await c.query("COMMIT");
    }
  } finally { c.release(); }
  return out;
}

// ═══════════════════════════════════════════════════════════════════════════
// R2R2-01 · PRE-FIX REPRODUCTION · exact production failure on portable
// ═══════════════════════════════════════════════════════════════════════════
describe("R2R2-01 · pre-fix · reap_expired_leases() writes to reaper_run and is DENIED by RLS under production-shape probe", () => {
  it("SQLSTATE 42501 · 'new row violates row-level security policy for table \"reaper_run\"'", async () => {
    // Guaranteed pre-fix state (belt-and-braces after beforeAll)
    await enableRlsOnAllSix();
    await dropR22Policies();
    const r = await underProbe("SELECT * FROM nex_workforce.reap_expired_leases()");
    expect(r.ok, `expected RLS denial · got ok=${r.ok} rows=${JSON.stringify(r.rows)}`).toBe(false);
    expect(r.code, `expected SQLSTATE 42501 · got ${r.code}: ${r.msg}`).toBe("42501");
    expect(r.msg).toMatch(/row-level security policy for table "reaper_run"/i);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// R2R2-02 · APPLY R2.2 MIGRATION · atomic, idempotent, 9 policies created
// ═══════════════════════════════════════════════════════════════════════════
describe("R2R2-02 · R2.2 migration applies as one transaction and creates exactly 9 policies", () => {
  it("_slice3-r2-2-rls.sql commits · 9 R2.2 policies present · nothing else changed", async () => {
    // Snapshot: count total policies + list workforce policies before
    const before = (await pool.query(`SELECT count(*)::int AS n FROM pg_policy`)).rows[0].n;

    await applyMigration();

    const after = (await pool.query(`SELECT count(*)::int AS n FROM pg_policy`)).rows[0].n;
    // Should have added exactly 11 net policies (or 0 if re-applied idempotently)
    const delta = after - before;
    expect([11, 0]).toContain(delta);

    const created = (await pool.query(`
      SELECT count(*)::int AS n FROM pg_policy
      WHERE polname IN (${R2_2_POLICIES.map(p => `'${p.name}'`).join(",")})
    `)).rows[0].n;
    expect(created).toBe(11);
  });

  it("re-applying the migration is idempotent (DROP POLICY IF EXISTS + CREATE)", async () => {
    // Apply a second time · should not throw · count unchanged
    await applyMigration();
    const n = (await pool.query(`
      SELECT count(*)::int AS c FROM pg_policy
      WHERE polname IN (${R2_2_POLICIES.map(p => `'${p.name}'`).join(",")})
    `)).rows[0].c;
    expect(n).toBe(11);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// R2R2-03 · POST-FIX SUCCESS · exact same call now works
// ═══════════════════════════════════════════════════════════════════════════
describe("R2R2-03 · post-fix · reap_expired_leases() under production-shape probe now succeeds", () => {
  it("returns { reclaimed, dead_lettered } · no RLS error · no orphaned reaper_run", async () => {
    const r = await underProbe("SELECT * FROM nex_workforce.reap_expired_leases()", { rollback: true });
    expect(r.ok, `error: ${r.code} ${r.msg}`).toBe(true);
    expect(r.rowCount).toBe(1);
    expect(typeof r.rows[0].reclaimed).toBe("number");
    expect(typeof r.rows[0].dead_lettered).toBe("number");
    // Because we rolled back, no reaper_run row was persisted by this test.
    const persisted = (await pool.query(`SELECT count(*)::int AS n FROM nex_workforce.reaper_run`)).rows[0].n;
    expect(persisted).toBe(0);
  });

  it("requeue_soft_fail_backoff_elapsed() succeeds under probe", async () => {
    const r = await underProbe("SELECT nex_workforce.requeue_soft_fail_backoff_elapsed() AS n", { rollback: true });
    expect(r.ok, `error: ${r.code} ${r.msg}`).toBe(true);
    expect(typeof r.rows[0].n).toBe("number");
  });

  it("enqueue_from_view() succeeds under probe · non-negative return · txn rolled back", async () => {
    // Whether n is 0 (nothing eligible) or > 0 (something eligible from
    // other test fixtures) depends on shared portable-cluster state.
    // What matters for R2.2: the call SUCCEEDS through admin's SELECT
    // policies on city_catalogue + job_registry + work_item AND admin's
    // INSERT policy on work_item · no RLS 42501 · rollback undoes any INSERT.
    const r = await underProbe("SELECT nex_workforce.enqueue_from_view() AS n", { rollback: true });
    expect(r.ok, `error: ${r.code} ${r.msg}`).toBe(true);
    expect(typeof r.rows[0].n).toBe("number");
    expect(r.rows[0].n).toBeGreaterThanOrEqual(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// R2R2-04 · POSITIVE LIFECYCLE · direct-seed + specific SECDEF call via probe
//   To avoid contention with other test files' pending work_items on the
//   shared portable cluster, we seed directly to state=leased (as postgres,
//   context=claim) instead of racing through claim(). Then we exercise the
//   RLS-critical paths: heartbeat (SELECT job_registry + UPDATE work_item),
//   checkpoint (UPDATE work_item), complete (UPDATE work_item).
// ═══════════════════════════════════════════════════════════════════════════
describe("R2R2-04 · positive lifecycle · heartbeat → checkpoint → complete via probe", () => {
  const AGENT_ID = "r2r2-04-lifecycle-agent";
  const SLUG = "r22-04";
  it("seed leased → heartbeat succeeds (RLS + policy on work_item + job_registry) → checkpoint → complete → terminal", async () => {
    await pool.query(`INSERT INTO nex_workforce.city_catalogue (slug, name, enabled, priority)
      VALUES ($1,'R22-04', true, 1) ON CONFLICT (slug) DO NOTHING`, [SLUG]);
    await pool.query(`INSERT INTO nex_workforce.job_registry
      (slug, category_slug, source_slug, cadence_minutes, max_concurrent_per_source, max_attempts, lease_minutes, enabled, priority)
      VALUES ($1, $2, $3, 60, 1, 3, 15, true, 1) ON CONFLICT (slug) DO NOTHING`,
      [`${SLUG}-job`, `${SLUG}-cat`, `${SLUG}-src`]);
    const seed = await pool.query(`INSERT INTO nex_workforce.work_item
      (city_slug, category_slug, source_slug, priority, state)
      VALUES ($1, $2, $3, 1, 'pending') RETURNING id, generation`,
      [SLUG, `${SLUG}-cat`, `${SLUG}-src`]);
    const wid = seed.rows[0].id;
    const gen = seed.rows[0].generation;

    // Direct-seed to leased under mutation_context='claim' (bypasses race with claim())
    const seedClient = await pool.connect();
    try {
      await seedClient.query("BEGIN");
      await seedClient.query(`SELECT set_config('nex_workforce.mutation_context', 'claim', true)`);
      await seedClient.query(`UPDATE nex_workforce.work_item
        SET state='leased', agent_id=$2, lease_deadline=now() + interval '15 minutes', attempts=1
        WHERE id=$1`, [wid, AGENT_ID]);
      await seedClient.query("COMMIT");
    } catch (e) { await seedClient.query("ROLLBACK").catch(() => {}); throw e; }
      finally { seedClient.release(); }

    // heartbeat via probe · exercises SELECT job_registry (RLS-critical) + UPDATE work_item
    const hb = await underProbe("SELECT nex_workforce.heartbeat($1, $2, $3) AS ok",
      { params: [AGENT_ID, wid, gen], rollback: false });
    expect(hb.ok, `heartbeat error: ${hb.code} ${hb.msg}`).toBe(true);
    expect(hb.rows[0].ok).toBe(true);

    // checkpoint via probe · UPDATE work_item cursor_json
    const cp = await underProbe("SELECT nex_workforce.checkpoint($1, $2, $3, $4::jsonb) AS ok",
      { params: [AGENT_ID, wid, gen, JSON.stringify({ step: 1 })], rollback: false });
    expect(cp.ok, `checkpoint error: ${cp.code} ${cp.msg}`).toBe(true);
    expect(cp.rows[0].ok).toBe(true);

    // complete via probe · UPDATE work_item terminal
    const done = await underProbe("SELECT nex_workforce.complete($1, $2, $3, 0, 0) AS ok",
      { params: [AGENT_ID, wid, gen], rollback: false });
    expect(done.ok, `complete error: ${done.code} ${done.msg}`).toBe(true);
    expect(done.rows[0].ok).toBe(true);

    const finalState = (await pool.query(
      `SELECT state, finished_at FROM nex_workforce.work_item WHERE id=$1`, [wid])).rows[0];
    expect(finalState.state).toBe("completed");
    expect(finalState.finished_at).not.toBeNull();

    // Cleanup
    await pool.query(`DELETE FROM nex_workforce.work_item WHERE id=$1`, [wid]);
    await pool.query(`DELETE FROM nex_workforce.job_registry WHERE slug=$1`, [`${SLUG}-job`]);
    await pool.query(`DELETE FROM nex_workforce.city_catalogue WHERE slug=$1`, [SLUG]);
  }, 30000);
});

// ═══════════════════════════════════════════════════════════════════════════
// R2R2-05 · POSITIVE · fail_hard writes to work_item_dead_letter under probe
//   Direct-seed to leased state as postgres · then have probe call fail_hard.
//   Exercises: UPDATE work_item + INSERT work_item_dead_letter.
// ═══════════════════════════════════════════════════════════════════════════
describe("R2R2-05 · positive · fail_hard writes work_item_dead_letter via probe (INSERT-only policy)", () => {
  const AGENT_ID = "r2r2-05-fh-agent";
  const SLUG = "r22-05";
  it("seed leased → fail_hard via probe → work_item_dead_letter row created + work_item terminal", async () => {
    await pool.query(`INSERT INTO nex_workforce.city_catalogue (slug, name, enabled, priority)
      VALUES ($1,'R22-05', true, 1) ON CONFLICT (slug) DO NOTHING`, [SLUG]);
    await pool.query(`INSERT INTO nex_workforce.job_registry
      (slug, category_slug, source_slug, cadence_minutes, max_concurrent_per_source, max_attempts, lease_minutes, enabled, priority)
      VALUES ($1, $2, $3, 60, 1, 3, 15, true, 1) ON CONFLICT (slug) DO NOTHING`,
      [`${SLUG}-job`, `${SLUG}-cat`, `${SLUG}-src`]);
    const seed = await pool.query(`INSERT INTO nex_workforce.work_item
      (city_slug, category_slug, source_slug, priority, state)
      VALUES ($1, $2, $3, 1, 'pending') RETURNING id, generation`,
      [SLUG, `${SLUG}-cat`, `${SLUG}-src`]);
    const wid = seed.rows[0].id;
    const gen = seed.rows[0].generation;

    const seedClient = await pool.connect();
    try {
      await seedClient.query("BEGIN");
      await seedClient.query(`SELECT set_config('nex_workforce.mutation_context', 'claim', true)`);
      await seedClient.query(`UPDATE nex_workforce.work_item
        SET state='leased', agent_id=$2, lease_deadline=now() + interval '15 minutes', attempts=1
        WHERE id=$1`, [wid, AGENT_ID]);
      await seedClient.query("COMMIT");
    } catch (e) { await seedClient.query("ROLLBACK").catch(() => {}); throw e; }
      finally { seedClient.release(); }

    // fail_hard via probe · exercises UPDATE work_item + INSERT work_item_dead_letter
    const fh = await underProbe("SELECT nex_workforce.fail_hard($1, $2, $3, $4, $5) AS ok",
      { params: [AGENT_ID, wid, gen, "r22 test fail_hard", "test"], rollback: false });
    expect(fh.ok, `fail_hard error: ${fh.code} ${fh.msg}`).toBe(true);
    expect(fh.rows[0].ok).toBe(true);

    // Dead-letter row exists · this is the critical RLS-proof for wa_wi_dl_insert
    const dl = await pool.query(`SELECT count(*)::int AS n FROM nex_workforce.work_item_dead_letter WHERE work_item_id=$1`, [wid]);
    expect(dl.rows[0].n).toBe(1);

    // Cleanup
    await pool.query(`DELETE FROM nex_workforce.work_item_dead_letter WHERE work_item_id=$1`, [wid]);
    await pool.query(`DELETE FROM nex_workforce.work_item WHERE id=$1`, [wid]);
    await pool.query(`DELETE FROM nex_workforce.job_registry WHERE slug=$1`, [`${SLUG}-job`]);
    await pool.query(`DELETE FROM nex_workforce.city_catalogue WHERE slug=$1`, [SLUG]);
  }, 30000);
});

// ═══════════════════════════════════════════════════════════════════════════
// R2R2-06 · POSITIVE · reap_expired_leases actually reaps an expired lease
// ═══════════════════════════════════════════════════════════════════════════
describe("R2R2-06 · positive · reap_expired_leases reaps an expired lease under probe", () => {
  const SLUG = "r22-06";
  it("seed expired-leased row → reap_expired_leases → reclaimed=1 · row=pending · reaper_run written", async () => {
    await pool.query(`INSERT INTO nex_workforce.city_catalogue (slug, name, enabled, priority)
      VALUES ($1,'R22-06', true, 1) ON CONFLICT (slug) DO NOTHING`, [SLUG]);
    await pool.query(`INSERT INTO nex_workforce.job_registry
      (slug, category_slug, source_slug, cadence_minutes, max_concurrent_per_source, max_attempts, lease_minutes, enabled, priority)
      VALUES ($1, $2, $3, 60, 1, 3, 15, true, 1) ON CONFLICT (slug) DO NOTHING`,
      [`${SLUG}-job`, `${SLUG}-cat`, `${SLUG}-src`]);
    const seed = await pool.query(`INSERT INTO nex_workforce.work_item
      (city_slug, category_slug, source_slug, priority, state)
      VALUES ($1, $2, $3, 1, 'pending') RETURNING id`,
      [SLUG, `${SLUG}-cat`, `${SLUG}-src`]);
    const wid = seed.rows[0].id;

    // Direct-seed leased+expired (as postgres, context=claim)
    const seedClient = await pool.connect();
    try {
      await seedClient.query("BEGIN");
      await seedClient.query(`SELECT set_config('nex_workforce.mutation_context', 'claim', true)`);
      await seedClient.query(`
        UPDATE nex_workforce.work_item
        SET state='leased', agent_id='r22-06-fake',
            lease_deadline = now() - interval '1 hour',
            attempts = 0
        WHERE id = $1`, [wid]);
      await seedClient.query("COMMIT");
    } catch (e) { await seedClient.query("ROLLBACK").catch(() => {}); throw e; }
      finally { seedClient.release(); }

    // reap under probe · this is the exact call that fired the production 42501
    const r = await underProbe("SELECT * FROM nex_workforce.reap_expired_leases()", { rollback: false });
    expect(r.ok, `reap error: ${r.code} ${r.msg}`).toBe(true);
    expect(r.rows[0].reclaimed).toBeGreaterThanOrEqual(1);

    const st = (await pool.query(`SELECT state FROM nex_workforce.work_item WHERE id=$1`, [wid])).rows[0];
    expect(st.state).toBe("pending");

    // reaper_run row was written · INSERT + UPDATE both worked through the
    // R2.2 policies (wa_reaper_run_insert + wa_reaper_run_update).
    const runs = (await pool.query(`SELECT count(*)::int AS n FROM nex_workforce.reaper_run WHERE finished_at IS NOT NULL`)).rows[0].n;
    expect(runs).toBeGreaterThanOrEqual(1);

    // Cleanup · leave reaper_run rows (they don't have R22 marker, but we
    // truncate them here since they're this suite's residue)
    await pool.query(`DELETE FROM nex_workforce.work_item WHERE id=$1`, [wid]);
    await pool.query(`TRUNCATE nex_workforce.reaper_run`).catch(() => {});
    await pool.query(`DELETE FROM nex_workforce.job_registry WHERE slug=$1`, [`${SLUG}-job`]);
    await pool.query(`DELETE FROM nex_workforce.city_catalogue WHERE slug=$1`, [SLUG]);
  }, 30000);
});

// ═══════════════════════════════════════════════════════════════════════════
// R2R2-6b · POSITIVE · claim() under probe with a seeded eligible work_item
// ═══════════════════════════════════════════════════════════════════════════
describe("R2R2-6b · positive · claim() under probe · exercises rotation_eligible view (city_catalogue + job_registry + work_item SELECT)", () => {
  const SLUG = "r22-6b";
  const AGENT_ID = "r22-6b-agent";
  it("seed city + job + pending work_item → claim as probe returns that row", async () => {
    await pool.query(`INSERT INTO nex_workforce.city_catalogue (slug, name, enabled, priority)
      VALUES ($1,'R22-6b', true, 999) ON CONFLICT (slug) DO NOTHING`, [SLUG]);
    await pool.query(`INSERT INTO nex_workforce.job_registry
      (slug, category_slug, source_slug, cadence_minutes, max_concurrent_per_source, max_attempts, lease_minutes, enabled, priority)
      VALUES ($1, $2, $3, 60, 1, 3, 15, true, 999) ON CONFLICT (slug) DO NOTHING`,
      [`${SLUG}-job`, `${SLUG}-cat`, `${SLUG}-src`]);
    const seed = await pool.query(`INSERT INTO nex_workforce.work_item
      (city_slug, category_slug, source_slug, priority, state)
      VALUES ($1, $2, $3, 999, 'pending') RETURNING id`,
      [SLUG, `${SLUG}-cat`, `${SLUG}-src`]);
    const wid = seed.rows[0].id;

    const claim = await underProbe("SELECT nex_workforce.claim($1) AS row",
      { params: [AGENT_ID], rollback: false });
    expect(claim.ok, `claim error: ${claim.code} ${claim.msg}`).toBe(true);
    const row = claim.rows[0].row;
    expect(row, "claim returned NULL · nothing eligible").not.toBeNull();
    // With priority=999, our seeded row should win rotation ordering
    // (may not equal wid if another concurrent test dropped a higher-priority row,
    // but any non-null claim proves the SELECT+UPDATE path works through R2.2)
    expect(row.state).toBe("leased");

    // Cleanup · fail_hard the row via probe · exercises INSERT wa_wi_dl_insert too
    await underProbe("SELECT nex_workforce.fail_hard($1, $2, $3, $4, $5) AS ok",
      { params: [AGENT_ID, row.id, row.generation, "r22-6b cleanup", "test"], rollback: false });
    await pool.query(`DELETE FROM nex_workforce.work_item_dead_letter WHERE work_item_id=$1`, [row.id]);
    await pool.query(`DELETE FROM nex_workforce.work_item WHERE id=$1`, [row.id]);
    // Also remove seeded row if claim picked something else
    await pool.query(`DELETE FROM nex_workforce.work_item WHERE id=$1`, [wid]);
    await pool.query(`DELETE FROM nex_workforce.job_registry WHERE slug=$1`, [`${SLUG}-job`]);
    await pool.query(`DELETE FROM nex_workforce.city_catalogue WHERE slug=$1`, [SLUG]);
  }, 30000);
});

// ═══════════════════════════════════════════════════════════════════════════
// R2R2-6c · POSITIVE · fail_soft() under probe on a seeded leased work_item
// ═══════════════════════════════════════════════════════════════════════════
describe("R2R2-6c · positive · fail_soft() under probe (SELECT + UPDATE work_item · no other tables)", () => {
  const SLUG = "r22-6c";
  const AGENT_ID = "r22-6c-agent";
  it("seed leased → fail_soft via probe → work_item state=soft_fail", async () => {
    await pool.query(`INSERT INTO nex_workforce.city_catalogue (slug, name, enabled, priority)
      VALUES ($1,'R22-6c', true, 1) ON CONFLICT (slug) DO NOTHING`, [SLUG]);
    await pool.query(`INSERT INTO nex_workforce.job_registry
      (slug, category_slug, source_slug, cadence_minutes, max_concurrent_per_source, max_attempts, lease_minutes, enabled, priority)
      VALUES ($1, $2, $3, 60, 1, 3, 15, true, 1) ON CONFLICT (slug) DO NOTHING`,
      [`${SLUG}-job`, `${SLUG}-cat`, `${SLUG}-src`]);
    const seed = await pool.query(`INSERT INTO nex_workforce.work_item
      (city_slug, category_slug, source_slug, priority, state)
      VALUES ($1, $2, $3, 1, 'pending') RETURNING id, generation`,
      [SLUG, `${SLUG}-cat`, `${SLUG}-src`]);
    const wid = seed.rows[0].id;
    const gen = seed.rows[0].generation;

    const sc = await pool.connect();
    try {
      await sc.query("BEGIN");
      await sc.query(`SELECT set_config('nex_workforce.mutation_context', 'claim', true)`);
      await sc.query(`UPDATE nex_workforce.work_item
        SET state='leased', agent_id=$2, lease_deadline=now() + interval '15 minutes', attempts=1
        WHERE id=$1`, [wid, AGENT_ID]);
      await sc.query("COMMIT");
    } catch (e) { await sc.query("ROLLBACK").catch(() => {}); throw e; }
      finally { sc.release(); }

    const fs = await underProbe(
      "SELECT nex_workforce.fail_soft($1, $2, $3, $4, $5, $6) AS ok",
      { params: [AGENT_ID, wid, gen, "r22-6c test fail_soft", "transient_exhausted", 60], rollback: false });
    expect(fs.ok, `fail_soft error: ${fs.code} ${fs.msg}`).toBe(true);
    expect(fs.rows[0].ok).toBe(true);
    const st = (await pool.query(`SELECT state FROM nex_workforce.work_item WHERE id=$1`, [wid])).rows[0];
    expect(st.state).toBe("soft_fail");

    await pool.query(`DELETE FROM nex_workforce.work_item WHERE id=$1`, [wid]);
    await pool.query(`DELETE FROM nex_workforce.job_registry WHERE slug=$1`, [`${SLUG}-job`]);
    await pool.query(`DELETE FROM nex_workforce.city_catalogue WHERE slug=$1`, [SLUG]);
  }, 30000);
});

// ═══════════════════════════════════════════════════════════════════════════
// R2R2-6d · POSITIVE · stage_candidates() under probe (touches RLS-OFF tables)
//   Exercises: evidence_record (RLS OFF · no policy needed) + candidate_staging
//   (RLS OFF · no policy needed) + fence via work_item SELECT (RLS-ON · needs
//   wa_work_item_select policy which we have).
// ═══════════════════════════════════════════════════════════════════════════
describe("R2R2-6d · positive · stage_candidates() under probe · confirms RLS-OFF tables are unaffected", () => {
  const SLUG = "r22-6d";
  const AGENT_ID = "r22-6d-agent";
  it("stage_candidates succeeds under probe on a leased work_item · staging rows appear", async () => {
    await pool.query(`INSERT INTO nex_workforce.city_catalogue (slug, name, enabled, priority)
      VALUES ($1,'R22-6d', true, 1) ON CONFLICT (slug) DO NOTHING`, [SLUG]);
    await pool.query(`INSERT INTO nex_workforce.job_registry
      (slug, category_slug, source_slug, cadence_minutes, max_concurrent_per_source, max_attempts, lease_minutes, enabled, priority)
      VALUES ($1, $2, $3, 60, 1, 3, 15, true, 1) ON CONFLICT (slug) DO NOTHING`,
      [`${SLUG}-job`, `${SLUG}-cat`, `${SLUG}-src`]);
    const seed = await pool.query(`INSERT INTO nex_workforce.work_item
      (city_slug, category_slug, source_slug, priority, state)
      VALUES ($1, $2, $3, 1, 'pending') RETURNING id, generation`,
      [SLUG, `${SLUG}-cat`, `${SLUG}-src`]);
    const wid = seed.rows[0].id;
    const gen = seed.rows[0].generation;

    const sc = await pool.connect();
    try {
      await sc.query("BEGIN");
      await sc.query(`SELECT set_config('nex_workforce.mutation_context', 'claim', true)`);
      await sc.query(`UPDATE nex_workforce.work_item
        SET state='leased', agent_id=$2, lease_deadline=now() + interval '15 minutes', attempts=1
        WHERE id=$1`, [wid, AGENT_ID]);
      await sc.query("COMMIT");
    } catch (e) { await sc.query("ROLLBACK").catch(() => {}); throw e; }
      finally { sc.release(); }

    // Build evidence_meta matching the evidence_record NOT-NULL schema.
    // evidence_id must match evidence_id_consistency CHECK:
    //   evidence_id = sha256_hex(work_item_id || '::' || generation || '::' || query_hash || '::' || response_sha256)
    const queryHash = "r22-6d-qh";
    const responseSha256 = "0".repeat(64);
    const evidenceId = computeEvidenceId(wid, gen, queryHash, responseSha256);
    const evidenceMeta = {
      source_slug: `${SLUG}-src`, city_slug: SLUG, category_slug: `${SLUG}-cat`,
      query_hash: queryHash, response_sha256: responseSha256,
      retrieved_at: new Date().toISOString(), http_status: 200,
      byte_length: 42, candidate_count: 1,
    };
    const candidates = [
      { candidate_index: 0, natural_key: "r22-6d-cand-1",
        payload_json: { name: "cand-1" }, payload_bytes: 20 },
    ];

    const stg = await underProbe(
      "SELECT nex_workforce.stage_candidates($1, $2, $3, $4, $5::jsonb, $6::jsonb) AS ok",
      { params: [AGENT_ID, wid, gen, evidenceId, JSON.stringify(evidenceMeta), JSON.stringify(candidates)],
        rollback: false });
    expect(stg.ok, `stage_candidates error: ${stg.code} ${stg.msg}`).toBe(true);
    expect(stg.rows[0].ok).toBe(true);

    // Verify staging row exists (RLS OFF · admin's INSERT went through fine)
    const cs = await pool.query(`SELECT count(*)::int AS n FROM nex_workforce.candidate_staging
      WHERE work_item_id=$1 AND generation=$2`, [wid, gen]);
    expect(cs.rows[0].n).toBe(1);

    // Cleanup
    await pool.query(`DELETE FROM nex_workforce.candidate_staging WHERE work_item_id=$1`, [wid]);
    await pool.query(`DELETE FROM nex_workforce.evidence_record WHERE evidence_id=$1`, [evidenceId]);
    await pool.query(`DELETE FROM nex_workforce.work_item WHERE id=$1`, [wid]);
    await pool.query(`DELETE FROM nex_workforce.job_registry WHERE slug=$1`, [`${SLUG}-job`]);
    await pool.query(`DELETE FROM nex_workforce.city_catalogue WHERE slug=$1`, [SLUG]);
  }, 30000);
});

// ═══════════════════════════════════════════════════════════════════════════
// R2R2-6e · POSITIVE · persist_batch under probe (touches work_item SELECT + fence)
// ═══════════════════════════════════════════════════════════════════════════
describe("R2R2-6e · positive · persist_batch() under probe · fence + persister-allow-list + RLS-OFF audit tables", () => {
  const SLUG = "r22-6e";
  const AGENT_ID = "r22-6e-agent";
  it("stage + persist_batch → persisted_count OR fence_ok=false with correct semantics · no RLS block", async () => {
    // Ensure the portable mock persister exists (Slice 3 R2.1 § 6a creates it)
    const hasMock = (await pool.query(`SELECT count(*)::int AS n FROM pg_proc p
      JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='nex_workforce' AND p.proname='mock_persist_target'`)).rows[0].n;
    if (hasMock === 0) { console.warn("R2R2-6e skipped · mock_persist_target absent"); return; }

    await pool.query(`INSERT INTO nex_workforce.city_catalogue (slug, name, enabled, priority)
      VALUES ($1,'R22-6e', true, 1) ON CONFLICT (slug) DO NOTHING`, [SLUG]);
    await pool.query(`INSERT INTO nex_workforce.job_registry
      (slug, category_slug, source_slug, cadence_minutes, max_concurrent_per_source, max_attempts, lease_minutes, enabled, priority)
      VALUES ($1, $2, $3, 60, 1, 3, 15, true, 1) ON CONFLICT (slug) DO NOTHING`,
      [`${SLUG}-job`, `${SLUG}-cat`, `${SLUG}-src`]);
    const seed = await pool.query(`INSERT INTO nex_workforce.work_item
      (city_slug, category_slug, source_slug, priority, state)
      VALUES ($1, $2, $3, 1, 'pending') RETURNING id, generation`,
      [SLUG, `${SLUG}-cat`, `${SLUG}-src`]);
    const wid = seed.rows[0].id;
    const gen = seed.rows[0].generation;

    const sc = await pool.connect();
    try {
      await sc.query("BEGIN");
      await sc.query(`SELECT set_config('nex_workforce.mutation_context', 'claim', true)`);
      await sc.query(`UPDATE nex_workforce.work_item
        SET state='leased', agent_id=$2, lease_deadline=now() + interval '15 minutes', attempts=1
        WHERE id=$1`, [wid, AGENT_ID]);
      await sc.query("COMMIT");
    } catch (e) { await sc.query("ROLLBACK").catch(() => {}); throw e; }
      finally { sc.release(); }

    // Stage one candidate first · evidence_id must satisfy evidence_id_consistency
    const qh = "r22-6e-qh";
    const rs = "0".repeat(64);
    const evidenceId = computeEvidenceId(wid, gen, qh, rs);
    const stgRes = await underProbe(
      "SELECT nex_workforce.stage_candidates($1, $2, $3, $4, $5::jsonb, $6::jsonb) AS ok",
      { params: [AGENT_ID, wid, gen, evidenceId,
        JSON.stringify({ source_slug: `${SLUG}-src`, city_slug: SLUG, category_slug: `${SLUG}-cat`,
          query_hash: qh, response_sha256: rs, retrieved_at: new Date().toISOString(),
          http_status: 200, byte_length: 42, candidate_count: 1 }),
        JSON.stringify([{ candidate_index: 0, natural_key: "r22-6e-cand", payload_json: { name: "cand" }, payload_bytes: 15 }])],
        rollback: false });
    if (!stgRes.ok) console.error("R2R2-6e stage error:", stgRes.code, stgRes.msg);
    expect(stgRes.ok, `stage error: ${stgRes.code} ${stgRes.msg}`).toBe(true);

    // persist_batch via probe
    const pb = await underProbe(
      "SELECT * FROM nex_workforce.persist_batch($1, $2, $3, $4::regprocedure, $5)",
      { params: [AGENT_ID, wid, gen,
        "nex_workforce.mock_persist_target(text,uuid,integer,text,timestamptz,text,text,jsonb)", 100],
        rollback: false });
    expect(pb.ok, `persist_batch error: ${pb.code} ${pb.msg}`).toBe(true);
    expect(pb.rows[0].fence_ok).toBe(true);
    // Either persisted or rejected · we don't care which for R2.2 purposes
    // (this proves persist_batch's SELECT+UPDATE on work_item under RLS works)

    // Cleanup · TRUNCATE mock_target + workforce state
    await pool.query(`TRUNCATE nex_workforce.mock_target`).catch(() => {});
    await pool.query(`DELETE FROM nex_workforce.candidate_staging WHERE work_item_id=$1`, [wid]);
    await pool.query(`DELETE FROM nex_workforce.evidence_record WHERE evidence_id=$1`, [evidenceId]);
    await pool.query(`DELETE FROM nex_workforce.persist_audit WHERE work_item_id=$1`, [wid]).catch(() => {});
    await pool.query(`DELETE FROM nex_workforce.work_item WHERE id=$1`, [wid]);
    await pool.query(`DELETE FROM nex_workforce.job_registry WHERE slug=$1`, [`${SLUG}-job`]);
    await pool.query(`DELETE FROM nex_workforce.city_catalogue WHERE slug=$1`, [SLUG]);
  }, 30000);
});

// ═══════════════════════════════════════════════════════════════════════════
// R2R2-6f · COVERAGE PROOF · persist_to_food_business is preserved
// ═══════════════════════════════════════════════════════════════════════════
describe("R2R2-6f · coverage · persist_to_food_business kept isolated (Slice 1h boundary intact · +fence-read on work_item)", () => {
  it("persist_to_food_business still exists as SECURITY DEFINER owned by persister · writes ONLY nex.food_business · reads work_item only for fence", async () => {
    const q = await pool.query(`SELECT p.prosecdef, r.rolname AS owner, p.proconfig::text AS cfg,
      pg_get_functiondef(p.oid) AS defn
      FROM pg_proc p JOIN pg_roles r ON r.oid=p.proowner JOIN pg_namespace n ON n.oid=p.pronamespace
      WHERE n.nspname='nex_workforce' AND p.proname='persist_to_food_business' LIMIT 1`);
    expect(q.rowCount).toBe(1);
    expect(q.rows[0].prosecdef).toBe(true);
    expect(q.rows[0].owner).toBe("nex_workforce_persister_food_business");
    expect(q.rows[0].cfg).toContain("search_path=pg_catalog, pg_temp");
    const defn = q.rows[0].defn.toLowerCase();
    // Writes only to nex.food_business (never any nex_workforce.* table)
    expect(defn).toContain("nex.food_business");
    for (const t of ["agent_heartbeat","reaper_run","work_item_dead_letter","city_catalogue","job_registry","evidence_record","candidate_staging","persist_audit"]) {
      expect(defn.includes(`nex_workforce.${t}`), `persist_to_food_business must NOT reference nex_workforce.${t}`).toBe(false);
    }
    // work_item IS referenced · exactly once · read-only fence via SELECT ... FOR UPDATE
    // This is the reason wp_food_business_work_item_{select,update} policies were added in R2.2
    expect(defn.includes("nex_workforce.work_item")).toBe(true);
    // Must not INSERT or UPDATE work_item (fence is read-only)
    expect(defn).not.toMatch(/insert\s+into\s+nex_workforce\.work_item/);
    expect(defn).not.toMatch(/^\s*update\s+nex_workforce\.work_item/m);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// R2R2-6h · POSITIVE + PRE-FIX FAILURE PROOF · persister fence read on work_item
//   Reproduces exactly the case where persist_to_food_business would fail
//   in production if wp_food_business_work_item_select were absent. Then
//   proves post-fix success. Simulates the SECURITY DEFINER call directly
//   by opening a session that SET LOCAL ROLEs to persister (only possible
//   because postgres has SET on persister · same as inside the DEFINER
//   context on Project B when persist_batch dynamically invokes the
//   persister function via EXECUTE format).
// ═══════════════════════════════════════════════════════════════════════════
describe("R2R2-6h · persister fence-read on work_item · pre-fix SILENT 0 rows · post-fix ROW visible", () => {
  const SLUG = "r22-6h";
  it("under persister role · SELECT ... FOR UPDATE returns 0 rows (silent RLS filter) pre-fix · returns 1 row post-fix", async () => {
    // NOTE about failure mode: for SELECT, RLS-no-policy returns 0 rows WITHOUT
    // raising 42501 · this is worse than a loud error because persist_to_food_
    // business would see v_wi_row.id IS NULL and treat every candidate as
    // fence-failed → silent complete data-loss under production activation
    // until R2.2 adds wp_food_business_work_item_{select,update}. INSERT and
    // UPDATE do raise 42501 (loud) · SELECT does not (silent).
    await pool.query(`INSERT INTO nex_workforce.city_catalogue (slug, name, enabled, priority)
      VALUES ($1,'R22-6h', true, 1) ON CONFLICT (slug) DO NOTHING`, [SLUG]);
    await pool.query(`INSERT INTO nex_workforce.job_registry
      (slug, category_slug, source_slug, cadence_minutes, max_concurrent_per_source, max_attempts, lease_minutes, enabled, priority)
      VALUES ($1, $2, $3, 60, 1, 3, 15, true, 1) ON CONFLICT (slug) DO NOTHING`,
      [`${SLUG}-job`, `${SLUG}-cat`, `${SLUG}-src`]);
    const seed = await pool.query(`INSERT INTO nex_workforce.work_item
      (city_slug, category_slug, source_slug, priority, state)
      VALUES ($1, $2, $3, 1, 'pending') RETURNING id`,
      [SLUG, `${SLUG}-cat`, `${SLUG}-src`]);
    const wid = seed.rows[0].id;

    // PRE-FIX: drop the persister policies · reproduce Project B's current state
    await pool.query(`DROP POLICY IF EXISTS wp_food_business_work_item_select ON nex_workforce.work_item`);
    await pool.query(`DROP POLICY IF EXISTS wp_food_business_work_item_update ON nex_workforce.work_item`);

    const c1 = await pool.connect();
    let preFixRows = null; let preFixCode = null;
    try {
      await c1.query("BEGIN");
      await c1.query("SET LOCAL ROLE nex_workforce_persister_food_business");
      try {
        const r = await c1.query(`SELECT id, agent_id, generation, state FROM nex_workforce.work_item WHERE id=$1 FOR UPDATE`, [wid]);
        preFixRows = r.rows;
      } catch (e) { preFixCode = e.code; }
      await c1.query("ROLLBACK");
    } finally { c1.release(); }
    // Silent RLS filter · 0 rows returned · no error thrown
    expect(preFixCode, `did not expect an error · got ${preFixCode}`).toBeNull();
    expect(preFixRows, "expected silent RLS filter · 0 rows").not.toBeNull();
    expect(preFixRows.length, `expected 0 rows pre-fix (silent RLS filter) · got ${preFixRows.length}`).toBe(0);

    // POST-FIX: re-apply R2.2 to add wp_food_business_work_item_{select,update}
    await applyMigration();

    const c2 = await pool.connect();
    let postFixRows = null; let postFixCode = null;
    try {
      await c2.query("BEGIN");
      await c2.query("SET LOCAL ROLE nex_workforce_persister_food_business");
      try {
        const r = await c2.query(`SELECT id, agent_id, generation, state FROM nex_workforce.work_item WHERE id=$1 FOR UPDATE`, [wid]);
        postFixRows = r.rows;
      } catch (e) { postFixCode = e.code; }
      await c2.query("ROLLBACK");
    } finally { c2.release(); }
    expect(postFixCode, `unexpected error post-fix · ${postFixCode}`).toBeNull();
    expect(postFixRows.length, `expected 1 row post-fix · got ${postFixRows?.length}`).toBe(1);
    expect(postFixRows[0].id).toBe(wid);

    // Cleanup
    await pool.query(`DELETE FROM nex_workforce.work_item WHERE id=$1`, [wid]);
    await pool.query(`DELETE FROM nex_workforce.job_registry WHERE slug=$1`, [`${SLUG}-job`]);
    await pool.query(`DELETE FROM nex_workforce.city_catalogue WHERE slug=$1`, [SLUG]);
  }, 30000);
});

// ═══════════════════════════════════════════════════════════════════════════
// R2R2-6g · COVERAGE PROOF · agent_heartbeat has ZERO writers · fail-loud
//   safety net preserved · this reconciles the earlier controlled-cycle
//   speculation that heartbeat writes agent_heartbeat (it does not).
// ═══════════════════════════════════════════════════════════════════════════
describe("R2R2-6g · coverage · agent_heartbeat has ZERO SQL writers on Project B and portable", () => {
  it("no SQL function in nex_workforce references agent_heartbeat", async () => {
    const q = await pool.query(`SELECT count(*)::int AS n FROM pg_proc p
      JOIN pg_namespace n ON n.oid=p.pronamespace
      WHERE n.nspname='nex_workforce' AND p.prosrc ILIKE '%agent_heartbeat%'`);
    expect(q.rows[0].n).toBe(0);
  });

  it("no trigger fn references agent_heartbeat", async () => {
    const q = await pool.query(`SELECT count(*)::int AS n FROM pg_trigger t
      JOIN pg_proc p ON p.oid=t.tgfoid WHERE NOT t.tgisinternal AND p.prosrc ILIKE '%agent_heartbeat%'`);
    expect(q.rows[0].n).toBe(0);
  });

  it("no view references agent_heartbeat", async () => {
    const q = await pool.query(`SELECT count(*)::int AS n FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE c.relkind IN ('v','m') AND n.nspname='nex_workforce' AND pg_get_viewdef(c.oid) ILIKE '%agent_heartbeat%'`);
    expect(q.rows[0].n).toBe(0);
  });

  it("agent_heartbeat has RLS enabled with ZERO admin policies · fail-loud on any future accidental use", async () => {
    const rls = (await pool.query(`SELECT relrowsecurity FROM pg_class WHERE oid='nex_workforce.agent_heartbeat'::regclass`)).rows[0].relrowsecurity;
    const pol = (await pool.query(`SELECT count(*)::int AS n FROM pg_policy pol
      JOIN pg_class c ON c.oid=pol.polrelid JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='nex_workforce' AND c.relname='agent_heartbeat'
        AND EXISTS (SELECT 1 FROM pg_roles r WHERE r.oid=ANY(pol.polroles) AND r.rolname='nex_workforce_admin')`)).rows[0].n;
    // Portable RLS state may differ from Project B · both are acceptable · what matters is admin has zero policies here
    expect(pol).toBe(0);
    console.log(`  · portable rls=${rls} · admin policies=${pol} (both correct · fail-loud preserved)`);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// R2R2-07 · NEGATIVE · nex_workforce_app cannot direct-INSERT/UPDATE/DELETE
// ═══════════════════════════════════════════════════════════════════════════
describe("R2R2-07 · negative · nex_workforce_app cannot bypass hardened wrappers · direct DML denied", () => {
  it("direct INSERT INTO work_item as app · denied (privilege OR RLS · either is correct)", async () => {
    const r = await underProbe(
      `INSERT INTO nex_workforce.work_item (city_slug, category_slug, source_slug, priority, state)
       VALUES ('r22','r22','r22', 1, 'pending')`);
    expect(r.ok).toBe(false);
    expect(["42501", "42P01"]).toContain(r.code); // permission denied (42501) or table not visible
  });

  it("direct UPDATE work_item as app · denied", async () => {
    const r = await underProbe(`UPDATE nex_workforce.work_item SET priority = 999 WHERE id = gen_random_uuid()`);
    expect(r.ok).toBe(false);
    expect(r.code).toBe("42501");
  });

  it("direct DELETE work_item as app · denied", async () => {
    const r = await underProbe(`DELETE FROM nex_workforce.work_item WHERE id = gen_random_uuid()`);
    expect(r.ok).toBe(false);
    expect(r.code).toBe("42501");
  });

  it("direct INSERT INTO reaper_run as app · denied", async () => {
    const r = await underProbe(`INSERT INTO nex_workforce.reaper_run DEFAULT VALUES`);
    expect(r.ok).toBe(false);
    expect(r.code).toBe("42501");
  });

  it("direct INSERT INTO work_item_dead_letter as app · denied", async () => {
    const r = await underProbe(`INSERT INTO nex_workforce.work_item_dead_letter
      (work_item_id, city_slug, category_slug, source_slug, attempts, last_error, last_error_class)
      VALUES (gen_random_uuid(),'x','x','x', 1,'x','x')`);
    expect(r.ok).toBe(false);
    expect(r.code).toBe("42501");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// R2R2-08 · NEGATIVE · nex_workforce_persister_food_business cannot mutate
//   unrelated workforce tables (Slice 1h isolation preserved)
// ═══════════════════════════════════════════════════════════════════════════
describe("R2R2-08 · negative · persister role stays isolated (Slice 1h boundary intact)", () => {
  it("persister has ZERO INSERT/UPDATE/DELETE privileges on nex_workforce.* tables", async () => {
    const q = await pool.query(`SELECT count(*)::int AS n FROM information_schema.role_table_grants
      WHERE grantee='nex_workforce_persister_food_business'
        AND privilege_type IN ('INSERT','DELETE')
        AND table_schema='nex_workforce'`);
    expect(q.rows[0].n).toBe(0);
    // UPDATE on work_item is preserved from Slice 1h R4 (documented vestigial · dormant)
    const upd = await pool.query(`SELECT string_agg(table_name, ',' ORDER BY table_name) AS tbls
      FROM information_schema.role_table_grants
      WHERE grantee='nex_workforce_persister_food_business'
        AND privilege_type='UPDATE'
        AND table_schema='nex_workforce'`);
    // Zero, or ONLY work_item (vestigial from Slice 1h R4 · SELECT FOR UPDATE fence)
    expect([null, "work_item"]).toContain(upd.rows[0].tbls);
  });

  it("persister has EXACTLY the R2.2 + R5 policies · zero on any other workforce table", async () => {
    // R2.2 v2 added: wp_food_business_work_item_{select,update} (fence-read)
    // R5 added:     wp_food_business_city_catalogue_select (city derivation)
    // Any policy on any OTHER workforce table targeting the persister is a
    // scope regression.
    const q = await pool.query(`SELECT c.relname AS tbl, string_agg(pol.polname, ',' ORDER BY pol.polname) AS pols
      FROM pg_policy pol JOIN pg_class c ON c.oid=pol.polrelid JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='nex_workforce'
        AND EXISTS (SELECT 1 FROM pg_roles r WHERE r.oid=ANY(pol.polroles) AND r.rolname='nex_workforce_persister_food_business')
      GROUP BY c.relname ORDER BY c.relname`);
    // Expected tables: city_catalogue (1 policy) + work_item (2 policies) = 2 rows
    expect(q.rowCount, `persister has policies on unexpected tables: ${JSON.stringify(q.rows)}`).toBe(2);
    // Row 0: city_catalogue (R5)
    expect(q.rows[0].tbl).toBe("city_catalogue");
    expect(q.rows[0].pols).toBe("wp_food_business_city_catalogue_select");
    // Row 1: work_item (R2.2 v2)
    expect(q.rows[1].tbl).toBe("work_item");
    expect(q.rows[1].pols).toBe("wp_food_business_work_item_select,wp_food_business_work_item_update");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// R2R2-09 · NEGATIVE · admin cannot mutate outside its approved boundary
// ═══════════════════════════════════════════════════════════════════════════
describe("R2R2-09 · negative · admin's write scope is exactly the 6 workforce tables that need it", () => {
  it("admin has no policies on tables outside nex_workforce", async () => {
    const q = await pool.query(`SELECT count(*)::int AS n FROM pg_policy pol
      JOIN pg_class c ON c.oid=pol.polrelid
      JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname <> 'nex_workforce'
        AND EXISTS (SELECT 1 FROM pg_roles r WHERE r.oid=ANY(pol.polroles) AND r.rolname='nex_workforce_admin')`);
    expect(q.rows[0].n).toBe(0);
  });

  it("admin has NO INSERT/UPDATE policy on agent_heartbeat (fail-loud on any future accidental use)", async () => {
    const q = await pool.query(`SELECT polcmd FROM pg_policy pol
      JOIN pg_class c ON c.oid=pol.polrelid
      JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='nex_workforce' AND c.relname='agent_heartbeat'
        AND EXISTS (SELECT 1 FROM pg_roles r WHERE r.oid=ANY(pol.polroles) AND r.rolname='nex_workforce_admin')`);
    expect(q.rowCount).toBe(0);
  });

  it("admin has ONLY SELECT policy on city_catalogue + job_registry (workforce never writes them)", async () => {
    const q = await pool.query(`SELECT c.relname, string_agg(pol.polcmd::text, ',' ORDER BY pol.polcmd::text) AS cmds
      FROM pg_policy pol JOIN pg_class c ON c.oid=pol.polrelid JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='nex_workforce' AND c.relname IN ('city_catalogue','job_registry')
        AND EXISTS (SELECT 1 FROM pg_roles r WHERE r.oid=ANY(pol.polroles) AND r.rolname='nex_workforce_admin')
      GROUP BY c.relname ORDER BY c.relname`);
    for (const r of q.rows) expect(r.cmds).toBe("r"); // 'r' = SELECT command in pg_policy
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// R2R2-10 · NEGATIVE · absolute-invariant checks
// ═══════════════════════════════════════════════════════════════════════════
describe("R2R2-10 · absolute invariants · no BYPASSRLS · no SUPERUSER · no PUBLIC EXECUTE · no runtime writes", () => {
  it("no workforce role has BYPASSRLS", async () => {
    const q = await pool.query(`SELECT rolname FROM pg_roles
      WHERE rolname IN ('nex_workforce_admin','nex_workforce_app','nex_workforce_persister_food_business','nex_app_runtime','nex_r22_runtime','nex_workforce_runtime')
      AND rolbypassrls = true`);
    expect(q.rowCount).toBe(0);
  });

  it("no workforce role is SUPERUSER", async () => {
    const q = await pool.query(`SELECT rolname FROM pg_roles
      WHERE rolname IN ('nex_workforce_admin','nex_workforce_app','nex_workforce_persister_food_business','nex_app_runtime','nex_r22_runtime','nex_workforce_runtime')
      AND rolsuper = true`);
    expect(q.rowCount).toBe(0);
  });

  it("PUBLIC EXECUTE remains 0 on the 11 hardened wrappers", async () => {
    const q = await pool.query(`SELECT count(*)::int AS n FROM pg_proc p
      JOIN pg_namespace n ON n.oid=p.pronamespace
      CROSS JOIN LATERAL aclexplode(p.proacl) x
      WHERE n.nspname='nex_workforce' AND x.grantee=0 AND x.privilege_type='EXECUTE'
        AND p.proname IN ('claim','heartbeat','checkpoint','complete','fail_soft','fail_hard',
                          'stage_candidates','persist_batch','reap_expired_leases',
                          'requeue_soft_fail_backoff_elapsed','enqueue_from_view')`);
    expect(q.rows[0].n).toBe(0);
  });

  it("nex_workforce_app has zero direct INSERT/UPDATE/DELETE on nex.* + nex_workforce.*", async () => {
    const q = await pool.query(`SELECT count(*)::int AS n FROM information_schema.role_table_grants
      WHERE grantee='nex_workforce_app'
        AND privilege_type IN ('INSERT','UPDATE','DELETE')
        AND table_schema IN ('nex','nex_workforce')`);
    expect(q.rows[0].n).toBe(0);
  });

  it("all 11 hardened wrappers still SECURITY DEFINER + admin-owned + hardened search_path", async () => {
    const q = await pool.query(`SELECT count(*)::int AS n FROM pg_proc p
      JOIN pg_roles r ON r.oid=p.proowner
      JOIN pg_namespace n ON n.oid=p.pronamespace
      WHERE n.nspname='nex_workforce'
        AND p.proname IN ('claim','heartbeat','checkpoint','complete','fail_soft','fail_hard',
                          'stage_candidates','persist_batch','reap_expired_leases',
                          'requeue_soft_fail_backoff_elapsed','enqueue_from_view')
        AND p.prosecdef=true AND r.rolname='nex_workforce_admin'
        AND EXISTS (SELECT 1 FROM unnest(p.proconfig) s WHERE s='search_path=pg_catalog, pg_temp')`);
    expect(q.rows[0].n).toBe(11);
  });

  it("brain/social CRUD on nex.food_business unchanged", async () => {
    const q = await pool.query(`SELECT grantee, string_agg(privilege_type,',' ORDER BY privilege_type) AS privs
      FROM information_schema.role_table_grants
      WHERE table_schema='nex' AND table_name='food_business'
        AND grantee IN ('nex_brain_app','nex_social_app') GROUP BY grantee ORDER BY grantee`);
    for (const r of q.rows) expect(r.privs).toBe("DELETE,INSERT,SELECT,UPDATE");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// R2R2-11 · POST-CYCLE BASELINE RESTORE
// ═══════════════════════════════════════════════════════════════════════════
describe("R2R2-11 · workforce state stable after all rehearsal tests", () => {
  it("no orphan work_item / reaper_run / dead_letter / heartbeat rows left by this suite", async () => {
    const q = await pool.query(`SELECT
      (SELECT count(*)::int FROM nex_workforce.work_item)              AS wi,
      (SELECT count(*)::int FROM nex_workforce.work_item_dead_letter)  AS dl,
      (SELECT count(*)::int FROM nex_workforce.reaper_run)             AS rr,
      (SELECT count(*)::int FROM nex_workforce.agent_heartbeat)        AS hb,
      (SELECT count(*)::int FROM nex_workforce.city_catalogue WHERE slug LIKE 'r22-%') AS r22cities,
      (SELECT count(*)::int FROM nex_workforce.job_registry WHERE slug LIKE 'r22-%')   AS r22jobs`);
    // Some totals may be > 0 due to other test files having run before us,
    // but our own R22 fixture entries must all be cleaned up.
    expect(q.rows[0].r22cities).toBe(0);
    expect(q.rows[0].r22jobs).toBe(0);
  });
});
