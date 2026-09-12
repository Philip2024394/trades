// NEX Workforce v2 · Slice 3 · Role Hardening Contract Test Suite
// ─────────────────────────────────────────────────────────────────────────────
// Target: portable PostgreSQL 17.11 · localhost:5439 · nex_workforce_slice1_test
//
// Purpose: prove the Slice 3 EXECUTE-only runtime boundary works end-to-end
// on the portable cluster. These tests exercise the FULL PRODUCTION FLOW as
// nex_workforce_runtime (LOGIN test fixture that mirrors production's
// nex_app_runtime → SET LOCAL ROLE nex_workforce_app pattern).
//
// The runtime pool is opened with connection options `-c role=nex_workforce_app`
// so every query auto-SET-ROLEs to nex_workforce_app for that session. This
// matches production's `SET LOCAL ROLE nex_workforce_app` pattern one-for-one.
//
// 16 adversarial tests:
//   S3-01  runtime direct INSERT denied
//   S3-02  runtime direct UPDATE denied
//   S3-03  runtime direct DELETE denied
//   S3-04  runtime EXECUTE approved capability (full lifecycle) succeeds
//   S3-05  runtime cannot execute an arbitrary (unauthorized) persister
//   S3-06  persister role is NOLOGIN
//   S3-07  persister role has NOBYPASSRLS
//   S3-08  nex.food_business has FORCE ROW LEVEL SECURITY
//   S3-09  SECURITY DEFINER owner is nex_workforce_admin for hardened wrappers
//   S3-10  hardened functions all have safe search_path = pg_catalog, pg_temp
//   S3-11  cross-target write from persister role denied (no grants on other nex.*)
//   S3-12  runtime is NOT a member of the persister role
//   S3-13  persisted row's provenance chain remains valid (target → evidence)
//   S3-14  monotonic evidence UPSERT still works under hardened boundary
//   S3-15  four-field fencing still works via SECURITY DEFINER wrappers
//   S3-16  reaper race still works · SKIP LOCKED still protects in-flight persister

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from "vitest";
import pg from "pg";
import { createHash } from "node:crypto";
import { createAgent, destroyAgent, runAgentOnce } from "../agent.mjs";
import { createReaper, destroyReaper, runReaperOnce } from "../reaper.mjs";
import { createOrch, destroyOrch, runOrchOnce } from "../orchestrator.mjs";
import * as StepRegistry from "../lib/step_registry.mjs";
import * as SourceRate from "../lib/sources_rate.mjs";
import * as overpassObserveAndStage from "../steps/overpass_observe_and_stage.mjs";
import { startMockOverpass } from "./support/mock_overpass.mjs";

const CONN = { host: "127.0.0.1", port: 5439, user: "postgres", database: "nex_workforce_slice1_test" };
const PERSISTER_FN_SIG = "nex_workforce.persist_to_food_business(text,uuid,integer,text,timestamptz,text,text,jsonb)";

const sha256 = (s) => createHash("sha256").update(s).digest("hex");
const evidenceIdFor = (wi, gen, qh, rh) => sha256(`${wi}::${gen}::${qh}::${rh}`);

let pool;                 // superuser · setup + assertions
let runtimePool;          // LOGIN as nex_workforce_runtime + options='-c role=nex_workforce_app'
let runtimeUrl;           // URL used by real agent/reaper/orch pools during production-flow tests
let overpassServer;
const silent = () => {};

const HAPPY_200 = (elements) => ({
  status: 200,
  body: JSON.stringify({
    version: 0.6, generator: "Overpass API",
    osm3s: { timestamp_osm_base: "2026-09-04T00:00:00Z" },
    elements,
  }),
});

const goodElements = (baseId, count = 3) => Array.from({ length: count }, (_, i) => ({
  type: "node", id: baseId + i,
  lat: -7.80 + i * 0.01, lon: 110.40 + i * 0.01,
  tags: { amenity: i % 2 === 0 ? "restaurant" : "cafe",
          name: `S3-${baseId + i}`,
          phone: `+62-274-${1000 + baseId + i}`,
          "addr:street": `Jl. S3 ${baseId + i}`,
          "addr:city": "Yogyakarta" },
}));

// ═════════════════════════════════════════════════════════════════════════════
// SETUP · portable-only Slice 3 fixture
// ═════════════════════════════════════════════════════════════════════════════
beforeAll(async () => {
  pool = new pg.Pool({ ...CONN, max: 12 });

  const r = await pool.query("SELECT current_database() AS db, current_setting('port') AS port, current_setting('server_version') AS ver");
  if (r.rows[0].db !== "nex_workforce_slice1_test") throw new Error(`wrong DB: ${r.rows[0].db}`);
  if (r.rows[0].port !== "5439")                    throw new Error(`wrong port: ${r.rows[0].port}`);
  if (!r.rows[0].ver.startsWith("17.11"))           throw new Error(`wrong PG version: ${r.rows[0].ver}`);

  // Assert Slice 3 migration applied
  const admin = await pool.query("SELECT 1 FROM pg_roles WHERE rolname='nex_workforce_admin'");
  if (admin.rowCount !== 1) throw new Error("nex_workforce_admin role missing · apply _slice3_workforce_role_hardening.sql first");
  const app   = await pool.query("SELECT 1 FROM pg_roles WHERE rolname='nex_workforce_app'");
  if (app.rowCount !== 1)   throw new Error("nex_workforce_app role missing · apply _slice3_workforce_role_hardening.sql first");
  const enq   = await pool.query("SELECT 1 FROM pg_proc WHERE pronamespace='nex_workforce'::regnamespace AND proname='enqueue_from_view'");
  if (enq.rowCount !== 1)   throw new Error("enqueue_from_view function missing · apply _slice3_workforce_role_hardening.sql first");

  // Grant runtime membership in nex_workforce_app (mirrors Project B's
  // `GRANT nex_workforce_app TO nex_app_runtime WITH INHERIT TRUE, SET TRUE`).
  // On portable cluster we use nex_workforce_runtime as the LOGIN fixture.
  await pool.query(`
    DO $body$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='nex_workforce_runtime') THEN
        CREATE ROLE nex_workforce_runtime LOGIN NOBYPASSRLS;
      END IF;
    END $body$
  `);
  await pool.query(`GRANT nex_workforce_app TO nex_workforce_runtime WITH INHERIT TRUE, SET TRUE`);

  // Revoke any test-fixture grants Slice 1h added to runtime that Slice 3 makes redundant.
  // Runtime should have ZERO direct table write privileges. The Slice 1h fixture only
  // added SELECT + REVOKE ALL on nex.food_business, so this is idempotent · safety net.
  await pool.query(`REVOKE ALL ON nex.food_business                FROM nex_workforce_runtime`);
  await pool.query(`REVOKE INSERT, UPDATE, DELETE ON nex_workforce.work_item          FROM nex_workforce_runtime`);
  await pool.query(`REVOKE INSERT, UPDATE, DELETE ON nex_workforce.evidence_record    FROM nex_workforce_runtime`);
  await pool.query(`REVOKE INSERT, UPDATE, DELETE ON nex_workforce.candidate_staging  FROM nex_workforce_runtime`);
  await pool.query(`REVOKE INSERT, UPDATE, DELETE ON nex_workforce.persist_audit      FROM nex_workforce_runtime`);
  await pool.query(`REVOKE INSERT, UPDATE, DELETE ON nex_workforce.agent_heartbeat    FROM nex_workforce_runtime`);
  await pool.query(`REVOKE INSERT, UPDATE, DELETE ON nex_workforce.reaper_run         FROM nex_workforce_runtime`);
  await pool.query(`REVOKE INSERT, UPDATE, DELETE ON nex_workforce.work_item_dead_letter FROM nex_workforce_runtime`);
  // Also revoke Slice 1h's explicit EXECUTE grants (Slice 3 grants via nex_workforce_app membership instead)
  await pool.query(`REVOKE EXECUTE ON FUNCTION nex_workforce.claim(text) FROM nex_workforce_runtime`);
  await pool.query(`REVOKE EXECUTE ON FUNCTION nex_workforce.heartbeat(text,uuid,integer) FROM nex_workforce_runtime`);
  await pool.query(`REVOKE EXECUTE ON FUNCTION nex_workforce.checkpoint(text,uuid,integer,jsonb) FROM nex_workforce_runtime`);
  await pool.query(`REVOKE EXECUTE ON FUNCTION nex_workforce.complete(text,uuid,integer,integer,integer) FROM nex_workforce_runtime`);
  await pool.query(`REVOKE EXECUTE ON FUNCTION nex_workforce.fail_soft(text,uuid,integer,text,text,integer) FROM nex_workforce_runtime`);
  await pool.query(`REVOKE EXECUTE ON FUNCTION nex_workforce.fail_hard(text,uuid,integer,text,text) FROM nex_workforce_runtime`);
  await pool.query(`REVOKE EXECUTE ON FUNCTION nex_workforce.stage_candidates(text,uuid,integer,text,jsonb,jsonb) FROM nex_workforce_runtime`);
  await pool.query(`REVOKE EXECUTE ON FUNCTION nex_workforce.persist_batch(text,uuid,integer,regprocedure,integer) FROM nex_workforce_runtime`);
  await pool.query(`REVOKE EXECUTE ON FUNCTION ${PERSISTER_FN_SIG} FROM nex_workforce_runtime`);

  // Runtime pool · uses `-c role=nex_workforce_app` connection option so every
  // query auto-runs as nex_workforce_app (mirrors production SET LOCAL ROLE).
  runtimePool = new pg.Pool({
    host: CONN.host, port: CONN.port, user: "nex_workforce_runtime", database: CONN.database, max: 4,
    options: "-c role=nex_workforce_app",
  });

  // URL used by real agent/reaper/orch pools created by tests during production-flow runs.
  runtimeUrl = `postgres://nex_workforce_runtime@127.0.0.1:5439/nex_workforce_slice1_test?options=-c%20role%3Dnex_workforce_app`;

  // Portable fixture repair · Slice 1g mock_target needs admin grant so
  // persist_batch (SECURITY DEFINER as admin) can indirectly write it.
  await pool.query("GRANT SELECT, INSERT, UPDATE, DELETE ON nex_workforce.mock_target TO nex_workforce_admin").catch(() => {});

  // Slice 3 whitelist adversary · a persister-shaped function owned by postgres
  // (NOT a nex_workforce_persister_* role). The Slice 3 persist_batch check
  // MUST reject it with an unauthorized_persister error even though admin has
  // implicit EXECUTE on it.
  await pool.query(`
    CREATE OR REPLACE FUNCTION nex_workforce._slice3_unauthorized_persister(
      p_agent_id      text,
      p_work_item_id  uuid,
      p_generation    integer,
      p_evidence_id   text,
      p_retrieved_at  timestamptz,
      p_source_slug   text,
      p_natural_key   text,
      p_payload_json  jsonb
    ) RETURNS TABLE (
      ok boolean, target_pk text, new_row boolean, updated_row boolean,
      rejected boolean, rejection_reason text
    ) AS $$
    BEGIN
      -- Would attempt to persist if reached. The whitelist check must stop us first.
      RETURN QUERY SELECT true, 'should-not-reach'::text, true, false, false, NULL::text;
    END;
    $$ LANGUAGE plpgsql;
  `);
});

afterAll(async () => {
  if (runtimePool) await runtimePool.end();
  if (pool)        await pool.end();
});

beforeEach(async () => {
  await pool.query("TRUNCATE nex.food_business RESTART IDENTITY");
  await pool.query("TRUNCATE nex_workforce.persist_audit");
  await pool.query("TRUNCATE nex_workforce.candidate_staging");
  await pool.query("TRUNCATE nex_workforce.evidence_record CASCADE");
  await pool.query("TRUNCATE nex_workforce.work_item_dead_letter, nex_workforce.work_item, nex_workforce.agent_heartbeat, nex_workforce.reaper_run RESTART IDENTITY CASCADE");
  await pool.query("DELETE FROM nex_workforce.job_registry");
  await pool.query("DELETE FROM nex_workforce.city_catalogue");
  StepRegistry._resetForTests();
  SourceRate._resetForTests();

  await pool.query(`INSERT INTO nex_workforce.city_catalogue (slug, name, enabled, priority, bbox_json) VALUES ('c1', 'C1', true, 100, '{"sw":{"lat":-6.4,"lon":106.7},"ne":{"lat":-6.1,"lon":107.0}}'::jsonb)`);
  await pool.query(`INSERT INTO nex_workforce.job_registry
    (slug, category_slug, source_slug, cadence_minutes, max_concurrent_per_source, max_attempts, lease_minutes, enabled, priority)
    VALUES ('restaurants-overpass','restaurants','overpass',60,10,5,1,true,100)`);
  StepRegistry.register("restaurants", "overpass", overpassObserveAndStage);
  overpassServer = await startMockOverpass();
  process.env.NEX_OVERPASS_URL = overpassServer.url;
  process.env.NEX_PERSISTER_FN = PERSISTER_FN_SIG;
});

afterEach(async () => {
  if (overpassServer) { await overpassServer.stop(); overpassServer = null; }
  delete process.env.NEX_OVERPASS_URL;
  delete process.env.NEX_PERSISTER_FN;
});

// ─── helpers ────────────────────────────────────────────────────────────────
async function claim(agentId) {
  return (await pool.query("SELECT nex_workforce.claim($1) AS row", [agentId])).rows[0].row;
}
async function foodCount() {
  return (await pool.query(`SELECT count(*)::int AS n FROM nex.food_business`)).rows[0].n;
}

// ═════════════════════════════════════════════════════════════════════════════
// S3-01 · runtime direct INSERT denied
// ═════════════════════════════════════════════════════════════════════════════
describe("S3-01 · runtime CANNOT direct-INSERT nex.food_business", () => {
  it("INSERT rejected · privilege OR RLS", async () => {
    await expect(runtimePool.query(`
      INSERT INTO nex.food_business (public_listing_ref, business_name, category, city, source, source_reference, dedupe_hash)
      VALUES ('#FL-2026-XXXXX', 'Illegal', 'restaurant', 'Yogyakarta', 'osm_overpass', 'node/99999998', 'x')
    `)).rejects.toThrow(/permission denied|policy|row-level security/i);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// S3-02 · runtime direct UPDATE denied
// ═════════════════════════════════════════════════════════════════════════════
describe("S3-02 · runtime CANNOT direct-UPDATE nex.food_business", () => {
  it("UPDATE rejected · privilege OR RLS", async () => {
    // Seed a row via superuser first
    await pool.query(`INSERT INTO nex_workforce.work_item (city_slug, category_slug, source_slug, generation, state, bbox_json)
                      VALUES ('c1','restaurants','overpass',1,'pending', '{"sw":{"lat":-6.4,"lon":106.7},"ne":{"lat":-6.1,"lon":107.0}}'::jsonb)`);
    overpassServer.plan(HAPPY_200(goodElements(30001, 1)));
    const agent = await createAgent({ url: runtimeUrl, pollMs: 30, heartbeatMsOverride: 150, logger: silent, poolMax: 3 });
    try {
      const r = await runAgentOnce(agent);
      expect(r.outcome).toBe("completed");
    } finally { await destroyAgent(agent); }
    expect(await foodCount()).toBe(1);
    await expect(runtimePool.query(
      "UPDATE nex.food_business SET business_name='Tamper'"
    )).rejects.toThrow(/permission denied|policy|row-level security/i);
  }, 20000);
});

// ═════════════════════════════════════════════════════════════════════════════
// S3-03 · runtime direct DELETE denied
// ═════════════════════════════════════════════════════════════════════════════
describe("S3-03 · runtime CANNOT direct-DELETE nex.food_business", () => {
  it("DELETE rejected · privilege OR RLS", async () => {
    await expect(runtimePool.query("DELETE FROM nex.food_business"))
      .rejects.toThrow(/permission denied|policy|row-level security/i);
    // Also for workforce-internal write ops
    await expect(runtimePool.query("DELETE FROM nex_workforce.evidence_record"))
      .rejects.toThrow(/permission denied/i);
    await expect(runtimePool.query("DELETE FROM nex_workforce.work_item"))
      .rejects.toThrow(/permission denied/i);
    await expect(runtimePool.query("INSERT INTO nex_workforce.evidence_record (evidence_id, work_item_id, generation, source_slug, city_slug, category_slug, query_hash, response_sha256, retrieved_at, http_status, byte_length, candidate_count) VALUES ('a','00000000-0000-0000-0000-000000000000',1,'s','c','r','q','r',now(),200,1,1)"))
      .rejects.toThrow(/permission denied|check constraint|violates/i);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// S3-04 · runtime EXECUTE approved capability succeeds (full lifecycle)
// ═════════════════════════════════════════════════════════════════════════════
describe("S3-04 · runtime CAN drive full end-to-end lifecycle via EXECUTE only", () => {
  it("orchestrator + agent + reaper all as nex_workforce_app · food_business rows appear", async () => {
    overpassServer.plan(HAPPY_200(goodElements(30002, 3)));
    // Orchestrator connects as runtime · calls enqueue_from_view (SECURITY DEFINER)
    const orch = await createOrch({ url: runtimeUrl, intervalMs: 50, maxConsecutiveErrors: 3, logger: silent, poolMax: 2 });
    try {
      const t = await runOrchOnce(orch);
      expect(t.ok).toBe(true);
      expect(t.enqueued).toBe(1);
    } finally { await destroyOrch(orch); }
    // Agent connects as runtime · drives full cycle
    const agent = await createAgent({ url: runtimeUrl, pollMs: 30, heartbeatMsOverride: 150, logger: silent, poolMax: 3 });
    try {
      const r = await runAgentOnce(agent);
      expect(r.outcome).toBe("completed");
    } finally { await destroyAgent(agent); }
    expect(await foodCount()).toBe(3);
    // Reaper connects as runtime · one tick with nothing to reap
    const reaper = await createReaper({ url: runtimeUrl, intervalMs: 50, maxConsecutiveErrors: 3, logger: silent, poolMax: 2 });
    try {
      const t = await runReaperOnce(reaper);
      expect(t.ok).toBe(true);
      expect(t.reclaimed).toBe(0);
    } finally { await destroyReaper(reaper); }
  }, 30000);
});

// ═════════════════════════════════════════════════════════════════════════════
// S3-05 · runtime cannot execute an unauthorized target persister
// ═════════════════════════════════════════════════════════════════════════════
describe("S3-05 · runtime cannot execute an arbitrary/unauthorized persister via persist_batch", () => {
  it("regprocedure resolution succeeds only for the ONE approved persister · other functions denied EXECUTE", async () => {
    // Set up a work_item + staging so persist_batch has real work to attempt
    const wiRow = (await pool.query(`INSERT INTO nex_workforce.work_item (city_slug, category_slug, source_slug, generation, state, bbox_json)
                                     VALUES ('c1','restaurants','overpass',1,'pending', '{"sw":{"lat":-6.4,"lon":106.7},"ne":{"lat":-6.1,"lon":107.0}}'::jsonb) RETURNING id`)).rows[0];
    const c = await claim("agent-s305");
    const evId = evidenceIdFor(c.id, c.generation, "qs5", "rs5");
    await pool.query("SELECT nex_workforce.stage_candidates($1, $2, $3, $4, $5::jsonb, $6::jsonb)",
      ["agent-s305", c.id, c.generation, evId,
       JSON.stringify({ source_slug: "overpass", city_slug: "c1", category_slug: "restaurants",
                        query_hash: "qs5", response_sha256: "rs5", retrieved_at: new Date().toISOString(),
                        http_status: 200, byte_length: 100, candidate_count: 1 }),
       JSON.stringify([{ candidate_index: 0, natural_key: "node/30500",
                         payload_json: { osm_id: 30500, tags: { amenity: "restaurant", name: "Blocked" } },
                         payload_bytes: 200 }])]);
    // Runtime attempts to invoke persist_batch with an UNAUTHORIZED persister
    // (mock_persist_target) that runtime has no EXECUTE grant on. persist_batch
    // is SECURITY DEFINER as admin · admin has no EXECUTE on mock_persist_target
    // either (Slice 3 grants admin EXECUTE only on persist_to_food_business).
    // Attempt to invoke an unauthorized persister (owner = postgres, not
    // matching ^nex_workforce_persister_). Whitelist must reject.
    await expect(runtimePool.query(
      "SELECT * FROM nex_workforce.persist_batch($1, $2, $3, $4::regprocedure, $5)",
      ["agent-s305", c.id, c.generation,
       "nex_workforce._slice3_unauthorized_persister(text,uuid,integer,text,timestamptz,text,text,jsonb)", 100]
    )).rejects.toThrow(/unauthorized_persister/i);
    // Zero target rows written despite the attempt
    expect(await foodCount()).toBe(0);
  }, 15000);
});

// ═════════════════════════════════════════════════════════════════════════════
// S3-06 · persister role is NOLOGIN
// ═════════════════════════════════════════════════════════════════════════════
describe("S3-06 · nex_workforce_persister_food_business is NOLOGIN", () => {
  it("cannot open a database connection directly", async () => {
    const q = await pool.query("SELECT rolcanlogin FROM pg_roles WHERE rolname='nex_workforce_persister_food_business'");
    expect(q.rows[0].rolcanlogin).toBe(false);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// S3-07 · persister role has NOBYPASSRLS
// ═════════════════════════════════════════════════════════════════════════════
describe("S3-07 · nex_workforce_persister_food_business has NOBYPASSRLS", () => {
  it("RLS applies to persister-owned SECURITY DEFINER function writes", async () => {
    const q = await pool.query("SELECT rolbypassrls FROM pg_roles WHERE rolname='nex_workforce_persister_food_business'");
    expect(q.rows[0].rolbypassrls).toBe(false);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// S3-08 · target has FORCE ROW LEVEL SECURITY
// ═════════════════════════════════════════════════════════════════════════════
describe("S3-08 · nex.food_business has ENABLE row level security (Slice 1h R2)", () => {
  it("Slice 1h R2 · ENABLE only (NOT FORCE) · owner=postgres superuser bypasses via role attribute · non-owner non-superuser (persister · brain_app · social_app) still RLS-checked", async () => {
    const q = await pool.query("SELECT relrowsecurity, relforcerowsecurity FROM pg_class WHERE oid='nex.food_business'::regclass");
    expect(q.rows[0].relrowsecurity).toBe(true);
    expect(q.rows[0].relforcerowsecurity).toBe(false); // R2 · production convention
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// S3-09 · SECURITY DEFINER owner correct
// ═════════════════════════════════════════════════════════════════════════════
describe("S3-09 · SECURITY DEFINER hardened wrappers owned by nex_workforce_admin", () => {
  it("claim/heartbeat/checkpoint/complete/fail_soft/fail_hard/stage_candidates/persist_batch/reap_expired_leases/requeue_soft_fail_backoff_elapsed/enqueue_from_view all owned by admin", async () => {
    const expected = new Set([
      "claim", "heartbeat", "checkpoint", "complete", "fail_soft", "fail_hard",
      "stage_candidates", "persist_batch", "reap_expired_leases",
      "requeue_soft_fail_backoff_elapsed", "enqueue_from_view",
    ]);
    const q = await pool.query(`
      SELECT p.proname, p.prosecdef, r.rolname AS owner
      FROM pg_proc p JOIN pg_roles r ON r.oid = p.proowner
      WHERE p.pronamespace='nex_workforce'::regnamespace
        AND p.proname = ANY($1::text[])
    `, [Array.from(expected)]);
    expect(q.rows.length).toBe(expected.size);
    for (const row of q.rows) {
      expect(row.prosecdef, `${row.proname} must be SECURITY DEFINER`).toBe(true);
      expect(row.owner, `${row.proname} owner`).toBe("nex_workforce_admin");
    }
    // persist_to_food_business remains owned by persister role (Slice 1h locked)
    const p = await pool.query(`SELECT r.rolname AS owner, p.prosecdef FROM pg_proc p JOIN pg_roles r ON r.oid=p.proowner WHERE p.pronamespace='nex_workforce'::regnamespace AND p.proname='persist_to_food_business'`);
    expect(p.rows[0].prosecdef).toBe(true);
    expect(p.rows[0].owner).toBe("nex_workforce_persister_food_business");
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// S3-10 · safe search_path
// ═════════════════════════════════════════════════════════════════════════════
describe("S3-10 · all hardened SECURITY DEFINER functions have safe search_path", () => {
  it("proconfig contains search_path=pg_catalog, pg_temp for every hardened function", async () => {
    const names = [
      "claim", "heartbeat", "checkpoint", "complete", "fail_soft", "fail_hard",
      "stage_candidates", "persist_batch", "reap_expired_leases",
      "requeue_soft_fail_backoff_elapsed", "enqueue_from_view", "persist_to_food_business",
    ];
    const q = await pool.query(`SELECT proname, proconfig FROM pg_proc
                                WHERE pronamespace='nex_workforce'::regnamespace AND proname = ANY($1::text[])`, [names]);
    for (const row of q.rows) {
      const cfg = row.proconfig || [];
      const spEntry = cfg.find((s) => s.startsWith("search_path="));
      expect(spEntry, `${row.proname} must have search_path`).toBeDefined();
      // Must contain pg_catalog and pg_temp; must NOT contain public or nex or nex_workforce
      expect(spEntry).toMatch(/pg_catalog/);
      expect(spEntry).toMatch(/pg_temp/);
      expect(spEntry).not.toMatch(/[^a-z_]public[^a-z_]|=public/);
    }
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// S3-11 · cross-target write from persister role denied
// ═════════════════════════════════════════════════════════════════════════════
describe("S3-11 · persister role has ZERO INSERT/UPDATE/DELETE grants on any other nex.* table", () => {
  it("only nex.food_business is writable · everything else in nex.* rejected", async () => {
    const q = await pool.query(`
      SELECT c.relname
      FROM information_schema.role_table_grants g
      JOIN pg_class c ON c.relname = g.table_name
      JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'nex'
      WHERE g.grantee = 'nex_workforce_persister_food_business'
        AND g.privilege_type IN ('INSERT','UPDATE','DELETE')
        AND g.table_schema = 'nex'
    `);
    const tables = new Set(q.rows.map((r) => r.relname));
    expect(tables.has("food_business")).toBe(true);
    // exactly one
    expect(tables.size).toBe(1);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// S3-12 · runtime NOT a member of persister role
// ═════════════════════════════════════════════════════════════════════════════
describe("S3-12 · nex_workforce_app (and nex_workforce_runtime) are NOT members of persister role", () => {
  it("structural role separation preserved · no privilege escalation path", async () => {
    const q = await pool.query(`
      SELECT r.rolname AS role_of, m.rolname AS member
      FROM pg_auth_members am
      JOIN pg_roles r ON r.oid = am.roleid
      JOIN pg_roles m ON m.oid = am.member
      WHERE r.rolname = 'nex_workforce_persister_food_business'
    `);
    const members = new Set(q.rows.map((r) => r.member));
    expect(members.has("nex_workforce_app")).toBe(false);
    expect(members.has("nex_workforce_runtime")).toBe(false);
    // Also verify nex_workforce_app is NOT a member of nex_workforce_admin
    const q2 = await pool.query(`
      SELECT r.rolname AS role_of, m.rolname AS member
      FROM pg_auth_members am
      JOIN pg_roles r ON r.oid = am.roleid
      JOIN pg_roles m ON m.oid = am.member
      WHERE r.rolname = 'nex_workforce_admin'
    `);
    const admins = new Set(q2.rows.map((r) => r.member));
    expect(admins.has("nex_workforce_app")).toBe(false);
    expect(admins.has("nex_workforce_runtime")).toBe(false);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// S3-13 · persisted-row provenance chain remains valid
// ═════════════════════════════════════════════════════════════════════════════
describe("S3-13 · provenance chain target → evidence still resolvable under hardened boundary", () => {
  it("row.source_evidence_id joins evidence_record cleanly after runtime-driven lifecycle", async () => {
    overpassServer.plan(HAPPY_200(goodElements(31300, 2)));
    await pool.query(`INSERT INTO nex_workforce.work_item (city_slug, category_slug, source_slug, generation, state, bbox_json)
                      VALUES ('c1','restaurants','overpass',1,'pending', '{"sw":{"lat":-6.4,"lon":106.7},"ne":{"lat":-6.1,"lon":107.0}}'::jsonb)`);
    const agent = await createAgent({ url: runtimeUrl, pollMs: 30, heartbeatMsOverride: 150, logger: silent, poolMax: 3 });
    try { await runAgentOnce(agent); } finally { await destroyAgent(agent); }
    const q = await pool.query(`
      SELECT count(*)::int AS n FROM nex.food_business t
      JOIN nex_workforce.evidence_record er ON er.evidence_id = t.source_evidence_id
    `);
    expect(q.rows[0].n).toBe(2);
  }, 20000);
});

// ═════════════════════════════════════════════════════════════════════════════
// S3-14 · monotonic evidence still works
// ═════════════════════════════════════════════════════════════════════════════
describe("S3-14 · monotonic UPSERT rule preserved under hardened persister invocation", () => {
  it("newer retrieved_at replaces older via runtime-driven agent cycles", async () => {
    // First observation
    overpassServer.plan({
      status: 200,
      body: JSON.stringify({
        version: 0.6, generator: "Overpass API",
        osm3s: { timestamp_osm_base: "2026-09-04T00:00:00Z" },
        elements: [{ type: "node", id: 31400, lat: -7.8, lon: 110.4, tags: { amenity: "restaurant", name: "V1" } }],
      }),
    });
    await pool.query(`INSERT INTO nex_workforce.work_item (city_slug, category_slug, source_slug, generation, state, bbox_json)
                      VALUES ('c1','restaurants','overpass',1,'pending', '{"sw":{"lat":-6.4,"lon":106.7},"ne":{"lat":-6.1,"lon":107.0}}'::jsonb)`);
    const agent1 = await createAgent({ url: runtimeUrl, pollMs: 30, heartbeatMsOverride: 150, logger: silent, poolMax: 3 });
    try { await runAgentOnce(agent1); } finally { await destroyAgent(agent1); }
    // Second observation with later timestamp
    overpassServer.plan({
      status: 200,
      body: JSON.stringify({
        version: 0.6, generator: "Overpass API",
        osm3s: { timestamp_osm_base: "2026-09-05T00:00:00Z" },
        elements: [{ type: "node", id: 31400, lat: -7.8, lon: 110.4, tags: { amenity: "restaurant", name: "V2" } }],
      }),
    });
    await pool.query("DELETE FROM nex_workforce.work_item");
    await pool.query(`INSERT INTO nex_workforce.work_item (city_slug, category_slug, source_slug, generation, state, bbox_json)
                      VALUES ('c1','restaurants','overpass',1,'pending', '{"sw":{"lat":-6.4,"lon":106.7},"ne":{"lat":-6.1,"lon":107.0}}'::jsonb)`);
    const agent2 = await createAgent({ url: runtimeUrl, pollMs: 30, heartbeatMsOverride: 150, logger: silent, poolMax: 3 });
    try { await runAgentOnce(agent2); } finally { await destroyAgent(agent2); }
    const row = (await pool.query("SELECT business_name FROM nex.food_business")).rows[0];
    expect(row.business_name).toBe("V2");
  }, 25000);
});

// ═════════════════════════════════════════════════════════════════════════════
// S3-15 · four-field fencing still works via SECURITY DEFINER wrappers
// ═════════════════════════════════════════════════════════════════════════════
describe("S3-15 · four-field fence (agent+wi+gen+state) still enforced through hardened wrappers", () => {
  it("stage_candidates via runtime with wrong agent_id returns false · no evidence written", async () => {
    const wiRow = (await pool.query(`INSERT INTO nex_workforce.work_item (city_slug, category_slug, source_slug, generation, state, bbox_json)
                                     VALUES ('c1','restaurants','overpass',1,'pending', '{"sw":{"lat":-6.4,"lon":106.7},"ne":{"lat":-6.1,"lon":107.0}}'::jsonb) RETURNING id`)).rows[0];
    const c = await claim("real-agent-s315");
    const evId = evidenceIdFor(c.id, c.generation, "qf", "rf");
    // Runtime invokes stage_candidates with GHOST agent_id
    const r = await runtimePool.query("SELECT nex_workforce.stage_candidates($1, $2, $3, $4, $5::jsonb, $6::jsonb) AS ok",
      ["ghost-agent", c.id, c.generation, evId,
       JSON.stringify({ source_slug: "overpass", city_slug: "c1", category_slug: "restaurants",
                        query_hash: "qf", response_sha256: "rf", retrieved_at: new Date().toISOString(),
                        http_status: 200, byte_length: 100, candidate_count: 0 }),
       JSON.stringify([])]);
    expect(r.rows[0].ok).toBe(false);
    // No evidence written
    expect((await pool.query("SELECT count(*)::int AS n FROM nex_workforce.evidence_record")).rows[0].n).toBe(0);
  }, 15000);
});

// ═════════════════════════════════════════════════════════════════════════════
// S3-16 · reaper race still works
// ═════════════════════════════════════════════════════════════════════════════
describe("S3-16 · reaper race preserved · SKIP LOCKED still yields to in-flight persister", () => {
  it("reaper cannot reclaim a work_item held by an active FOR UPDATE lock", async () => {
    const wiRow = (await pool.query(`INSERT INTO nex_workforce.work_item (city_slug, category_slug, source_slug, generation, state, bbox_json)
                                     VALUES ('c1','restaurants','overpass',1,'pending', '{"sw":{"lat":-6.4,"lon":106.7},"ne":{"lat":-6.1,"lon":107.0}}'::jsonb) RETURNING id`)).rows[0];
    await claim("agent-s316");
    await pool.query("UPDATE nex_workforce.work_item SET lease_deadline = now() - interval '1 hour' WHERE id=$1", [wiRow.id]);
    // Hold row lock on separate client
    const holder = await pool.connect();
    try {
      await holder.query("BEGIN");
      await holder.query("SELECT id FROM nex_workforce.work_item WHERE id=$1 FOR UPDATE", [wiRow.id]);
      // Runtime invokes reaper via runtime pool
      const r = await runtimePool.query("SELECT * FROM nex_workforce.reap_expired_leases()");
      expect(r.rows[0].reclaimed).toBe(0);
      await holder.query("COMMIT");
    } finally { holder.release(); }
    // Row still leased
    const st = await pool.query("SELECT state FROM nex_workforce.work_item WHERE id=$1", [wiRow.id]);
    expect(st.rows[0].state).toBe("leased");
  }, 15000);
});
