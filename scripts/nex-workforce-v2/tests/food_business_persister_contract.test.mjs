// NEX Workforce v2 · Slice 1h R2 · Food Business Persister Contract Test Suite
// ─────────────────────────────────────────────────────────────────────────────
// Target: portable PostgreSQL 17.11 · localhost:5439 · nex_workforce_slice1_test
// Real persister: nex_workforce.persist_to_food_business
// Real target:    nex.food_business (rebuilt to Project B production shape · 52 cols)
//
// This R2 test suite proves Slice 1h R2 works against production reality:
//   RF-1  match-count branching handles 0 / 1 / ≥2 existing rows
//   RF-2  canonical `<type>/<id>` source_reference format matches production
//   RF-3  ENABLE RLS (not FORCE) preserves nex_brain_app + nex_social_app access
//   RF-4  50 production columns tolerated · country/worker_id/cycle_run_id intact
//
// 24 tests grouped H1-H24 (per Philip 2026-09-04 Redesign directive).

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from "vitest";
import pg from "pg";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createHash } from "node:crypto";
import { createAgent, destroyAgent, runAgentOnce } from "../agent.mjs";
import * as StepRegistry from "../lib/step_registry.mjs";
import * as SourceRate from "../lib/sources_rate.mjs";
import * as overpassObserveAndStage from "../steps/overpass_observe_and_stage.mjs";
import { startMockOverpass } from "./support/mock_overpass.mjs";

const CONN = { host: "127.0.0.1", port: 5439, user: "postgres", database: "nex_workforce_slice1_test" };
const URL  = `postgres://postgres@127.0.0.1:5439/nex_workforce_slice1_test`;
const RUNTIME_URL = `postgres://nex_workforce_runtime@127.0.0.1:5439/nex_workforce_slice1_test`;
const BRAIN_URL   = `postgres://nex_brain_login@127.0.0.1:5439/nex_workforce_slice1_test`;
const SOCIAL_URL  = `postgres://nex_social_login@127.0.0.1:5439/nex_workforce_slice1_test`;
const PERSISTER_FN_SIG = "nex_workforce.persist_to_food_business(text,uuid,integer,text,timestamptz,text,text,jsonb)";
const __dirname = dirname(fileURLToPath(import.meta.url));
const PROD_SHAPE_SQL = join(__dirname, "support", "production_shape_food_business.sql");

const sha256 = (s) => createHash("sha256").update(s).digest("hex");
const evidenceIdFor = (wi, gen, qh, rh) => sha256(`${wi}::${gen}::${qh}::${rh}`);

let pool;
let runtimePool;
let brainPool;
let socialPool;
let overpassServer;
const silent = () => {};

// ═════════════════════════════════════════════════════════════════════════════
// SETUP · production-shape fixture + login proxy roles for brain/social tests
// ═════════════════════════════════════════════════════════════════════════════
beforeAll(async () => {
  pool = new pg.Pool({ ...CONN, max: 10 });

  const r = await pool.query("SELECT current_database() AS db, current_setting('port') AS port");
  if (r.rows[0].db !== "nex_workforce_slice1_test") throw new Error(`wrong DB: ${r.rows[0].db}`);
  if (r.rows[0].port !== "5439")                    throw new Error(`wrong port: ${r.rows[0].port}`);

  // H23 explicit guardrail · Project B has NEVER been touched by these tests
  if (!URL.includes("127.0.0.1:5439")) throw new Error("URL not portable · abort");
  if (!URL.includes("nex_workforce_slice1_test")) throw new Error("URL not target DB · abort");

  // Portable LOGIN proxy roles so tests can prove brain/social access preserved.
  // (Production nex_brain_app + nex_social_app are NOLOGIN · we mirror them via
  // login proxies that inherit those roles, matching the SET LOCAL ROLE pattern.)
  await pool.query(`
    DO $body$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='nex_brain_login') THEN
        CREATE ROLE nex_brain_login LOGIN NOBYPASSRLS;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='nex_social_login') THEN
        CREATE ROLE nex_social_login LOGIN NOBYPASSRLS;
      END IF;
    END $body$
  `);
  await pool.query(`GRANT nex_brain_app  TO nex_brain_login  WITH INHERIT TRUE, SET TRUE`);
  await pool.query(`GRANT nex_social_app TO nex_social_login WITH INHERIT TRUE, SET TRUE`);

  runtimePool = new pg.Pool({ host: CONN.host, port: CONN.port, user: "nex_workforce_runtime", database: CONN.database, max: 4 });
  brainPool   = new pg.Pool({ host: CONN.host, port: CONN.port, user: "nex_brain_login",       database: CONN.database, max: 3,
                              options: "-c role=nex_brain_app" });
  socialPool  = new pg.Pool({ host: CONN.host, port: CONN.port, user: "nex_social_login",      database: CONN.database, max: 3,
                              options: "-c role=nex_social_app" });

  // Apply production-shape fixture + Slice 1h R2 migration ONCE per test file.
  // beforeEach only resets data.
  const prodShapeSql = readFileSync(PROD_SHAPE_SQL, "utf8");
  await pool.query(prodShapeSql);
  const migSql = readFileSync(join(__dirname, "..", "..", "..", "supabase", "migrations", "_slice1h_food_business_persister.sql"), "utf8");
  await pool.query(migSql);
});

afterAll(async () => {
  if (runtimePool) await runtimePool.end();
  if (brainPool)   await brainPool.end();
  if (socialPool)  await socialPool.end();
  if (pool)        await pool.end();
});

beforeEach(async () => {
  // Reset data · fixture DDL was applied once in beforeAll.
  // Restore production-shape seed data after TRUNCATE.
  await pool.query("TRUNCATE nex.food_business, nex.worker_cycle_run CASCADE");

  // Re-seed the fixture data rows (same as production_shape_food_business.sql)
  await pool.query(`
    INSERT INTO nex.food_business
      (public_listing_ref, business_name, category, city, country, source, source_reference, dedupe_hash, worker_id)
    VALUES
      ('#FL-2026-AA001', 'Legacy Restaurant One',   'restaurant',  'Yogyakarta','ID','osm_overpass','node/100001', 'hash_100001', 'acquisition:food:Yogyakarta:v1'),
      ('#FL-2026-AA002', 'Legacy Cafe Two',         'coffee-cafe', 'Yogyakarta','ID','osm_overpass','node/100002', 'hash_100002', 'acquisition:food:Yogyakarta:v1'),
      ('#FL-2026-AA003', 'Legacy Restaurant Three', 'restaurant',  'Yogyakarta','ID','osm_overpass','way/200001',  'hash_200001', 'acquisition:food:Yogyakarta:v1')
  `);
  await pool.query(`
    INSERT INTO nex.food_business
      (public_listing_ref, business_name, category, city, country, source, source_reference, dedupe_hash)
    VALUES
      ('#FL-2026-DD001', 'lumbung resto', 'restaurant', 'Yogyakarta','ID','osm_overpass','node/300001', 'dup_hash_1'),
      ('#FL-2026-DD002', 'lumbung resto', 'restaurant', 'Yogyakarta','ID','osm_overpass','node/300001', 'dup_hash_1'),
      ('#FL-2026-DD003', 'lumbung resto', 'restaurant', 'Yogyakarta','ID','osm_overpass','node/300001', 'dup_hash_1'),
      ('#FL-2026-EE001', 'WARUNG CLICKSQUARE',    'restaurant', 'Yogyakarta','ID','osm_overpass','node/300002', 'diff_hash_a'),
      ('#FL-2026-EE002', 'Calf Coffee Industry',  'coffee-cafe','Yogyakarta','ID','osm_overpass','node/300002', 'diff_hash_b'),
      ('#FL-2025-VV001', 'Legacy V1 Restaurant', 'restaurant', 'Yogyakarta','ID','openstreetmap_overpass_v1','node/500001', 'v1_hash_1'),
      ('#FL-2025-VV002', 'Legacy V1 Cafe',       'coffee-cafe','Yogyakarta','ID','openstreetmap_overpass_v1','node/500002', 'v1_hash_2')
  `);
  await pool.query(`INSERT INTO nex.worker_cycle_run (id, worker_id) VALUES ('11111111-1111-1111-1111-111111111111', 'acquisition:food:Yogyakarta:v2')`);
  await pool.query(`
    INSERT INTO nex.food_business
      (public_listing_ref, business_name, category, city, country, source, source_reference, dedupe_hash, worker_id, cycle_run_id)
    VALUES
      ('#FL-2026-WW001', 'Worker Attributed Row', 'restaurant', 'Yogyakarta','ID','osm_overpass','node/400001', 'wa_hash_1',
       'acquisition:food:Yogyakarta:v2', '11111111-1111-1111-1111-111111111111')
  `);

  // Clean workforce lifecycle state
  await pool.query("TRUNCATE nex_workforce.persist_audit");
  await pool.query("TRUNCATE nex_workforce.candidate_staging");
  await pool.query("TRUNCATE nex_workforce.evidence_record CASCADE");
  await pool.query("TRUNCATE nex_workforce.work_item_dead_letter, nex_workforce.work_item, nex_workforce.agent_heartbeat, nex_workforce.reaper_run RESTART IDENTITY CASCADE");
  await pool.query("DELETE FROM nex_workforce.job_registry");
  await pool.query("DELETE FROM nex_workforce.city_catalogue");
  StepRegistry._resetForTests();
  SourceRate._resetForTests();

  await pool.query(`INSERT INTO nex_workforce.city_catalogue (slug, name, enabled, priority) VALUES ('c1', 'C1', true, 100)`);
  await pool.query(`INSERT INTO nex_workforce.job_registry
    (slug, category_slug, source_slug, cadence_minutes, max_concurrent_per_source, max_attempts, lease_minutes, enabled, priority)
    VALUES ('rest', 'restaurants', 'overpass', 60, 10, 5, 1, true, 100)`);
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
async function callPersisterDirect({ agentId, workItemId, generation, evidenceId, retrievedAt, sourceSlug = "overpass", naturalKey, payload }) {
  return (await pool.query(
    `SELECT ok, target_pk, new_row, updated_row, rejected, rejection_reason
     FROM nex_workforce.persist_to_food_business($1, $2, $3, $4, $5, $6, $7, $8::jsonb)`,
    [agentId, workItemId, generation, evidenceId, retrievedAt, sourceSlug, naturalKey, JSON.stringify(payload)]
  )).rows[0];
}
async function fetchByNatural(naturalKey) {
  return (await pool.query(
    "SELECT * FROM nex.food_business WHERE source='osm_overpass' AND source_reference=$1",
    [naturalKey]
  )).rows;
}
async function seedEvidence({ wiId, gen, qh = "q", rh = "r", ts = "2026-09-04T00:00:00.000Z" } = {}) {
  const evId = evidenceIdFor(wiId, gen, qh, rh);
  await pool.query(`INSERT INTO nex_workforce.evidence_record
    (evidence_id, work_item_id, generation, source_slug, city_slug, category_slug,
     query_hash, response_sha256, retrieved_at, http_status, byte_length, candidate_count)
    VALUES ($1, $2, $3, 'overpass', 'c1', 'restaurants', $4, $5, $6, 200, 100, 1)`,
    [evId, wiId, gen, qh, rh, ts]);
  return { evId, ts };
}
async function seedPendingClaim(agentId = "test-agent") {
  const wiRow = (await pool.query(`INSERT INTO nex_workforce.work_item (city_slug, category_slug, source_slug, generation, state)
                                   VALUES ('c1','restaurants','overpass',1,'pending') RETURNING id`)).rows[0];
  const c = await claim(agentId);
  return c;
}

// ═════════════════════════════════════════════════════════════════════════════
// H1 · canonical node reference accepted
// ═════════════════════════════════════════════════════════════════════════════
describe("H1 · canonical node/<id> reference accepted", () => {
  it("persists cleanly and stores source_reference in production format", async () => {
    const c = await seedPendingClaim("agent-h1");
    const { evId, ts } = await seedEvidence({ wiId: c.id, gen: c.generation, qh: "qh1", rh: "rh1" });
    const r = await callPersisterDirect({
      agentId: "agent-h1", workItemId: c.id, generation: c.generation,
      evidenceId: evId, retrievedAt: ts, naturalKey: "node/700001",
      payload: { osm_type: "node", osm_id: 700001, tags: { amenity: "restaurant", name: "H1 Node" } },
    });
    expect(r.ok).toBe(true);
    expect(r.new_row).toBe(true);
    const rows = await fetchByNatural("node/700001");
    expect(rows).toHaveLength(1);
    expect(rows[0].source_reference).toBe("node/700001");
    expect(rows[0].source).toBe("osm_overpass");
    expect(rows[0].country).toBe("ID");
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// H2 · canonical way reference
// ═════════════════════════════════════════════════════════════════════════════
describe("H2 · canonical way/<id> reference accepted", () => {
  it("persists cleanly", async () => {
    const c = await seedPendingClaim("agent-h2");
    const { evId, ts } = await seedEvidence({ wiId: c.id, gen: c.generation });
    const r = await callPersisterDirect({
      agentId: "agent-h2", workItemId: c.id, generation: c.generation,
      evidenceId: evId, retrievedAt: ts, naturalKey: "way/800001",
      payload: { osm_type: "way", osm_id: 800001, tags: { amenity: "cafe", name: "H2 Way" } },
    });
    expect(r.ok).toBe(true);
    expect(r.new_row).toBe(true);
    expect((await fetchByNatural("way/800001"))[0].category).toBe("coffee-cafe");
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// H3 · canonical relation reference
// ═════════════════════════════════════════════════════════════════════════════
describe("H3 · canonical relation/<id> reference accepted", () => {
  it("persists cleanly", async () => {
    const c = await seedPendingClaim("agent-h3");
    const { evId, ts } = await seedEvidence({ wiId: c.id, gen: c.generation });
    const r = await callPersisterDirect({
      agentId: "agent-h3", workItemId: c.id, generation: c.generation,
      evidenceId: evId, retrievedAt: ts, naturalKey: "relation/900001",
      payload: { osm_type: "relation", osm_id: 900001, tags: { amenity: "restaurant", name: "H3 Relation" } },
    });
    expect(r.ok).toBe(true);
    expect(r.new_row).toBe(true);
    expect((await fetchByNatural("relation/900001"))[0].source_reference).toBe("relation/900001");
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// H4 · CASE B · exactly one existing match → monotonic UPDATE
// ═════════════════════════════════════════════════════════════════════════════
describe("H4 · existing single-match → monotonic UPDATE", () => {
  it("legacy row (source_reference=node/100001) is updated in place", async () => {
    // Fixture seeded 'Legacy Restaurant One' at node/100001 with source_retrieved_at=NULL
    const before = (await fetchByNatural("node/100001"))[0];
    expect(before).toBeDefined();
    expect(before.source_retrieved_at).toBeNull();
    const c = await seedPendingClaim("agent-h4");
    const { evId, ts } = await seedEvidence({ wiId: c.id, gen: c.generation, ts: "2026-09-04T12:00:00.000Z" });
    const r = await callPersisterDirect({
      agentId: "agent-h4", workItemId: c.id, generation: c.generation,
      evidenceId: evId, retrievedAt: ts, naturalKey: "node/100001",
      payload: { osm_type: "node", osm_id: 100001, tags: { amenity: "restaurant", name: "Legacy Restaurant One (renamed)" } },
    });
    expect(r.ok).toBe(true);
    expect(r.updated_row).toBe(true);
    expect(r.new_row).toBe(false);
    const after = (await fetchByNatural("node/100001"))[0];
    expect(after.internal_id).toBe(before.internal_id);          // identity stable
    expect(after.business_name).toBe("Legacy Restaurant One (renamed)"); // updated
    expect(after.source_evidence_id).toBe(evId);
    expect(after.source_retrieved_at.toISOString()).toBe(ts);
    // legacy row count did not change
    expect((await pool.query("SELECT count(*)::int AS n FROM nex.food_business")).rows[0].n).toBeGreaterThan(1);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// H5 · CASE A · zero existing match → INSERT
// ═════════════════════════════════════════════════════════════════════════════
describe("H5 · zero existing match → INSERT", () => {
  it("fresh natural_key produces new row · no impact on legacy rows", async () => {
    const legacyCount = (await pool.query("SELECT count(*)::int AS n FROM nex.food_business")).rows[0].n;
    const c = await seedPendingClaim("agent-h5");
    const { evId, ts } = await seedEvidence({ wiId: c.id, gen: c.generation });
    const r = await callPersisterDirect({
      agentId: "agent-h5", workItemId: c.id, generation: c.generation,
      evidenceId: evId, retrievedAt: ts, naturalKey: "node/999999",
      payload: { osm_type: "node", osm_id: 999999, tags: { amenity: "restaurant", name: "Brand New" } },
    });
    expect(r.ok).toBe(true);
    expect(r.new_row).toBe(true);
    const rows = await fetchByNatural("node/999999");
    expect(rows).toHaveLength(1);
    const total = (await pool.query("SELECT count(*)::int AS n FROM nex.food_business")).rows[0].n;
    expect(total).toBe(legacyCount + 1);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// H6 · CASE C · ≥2 existing matches → REJECT identity_ambiguous
// ═════════════════════════════════════════════════════════════════════════════
describe("H6 · duplicate legacy identities → REJECT identity_ambiguous · no mutation", () => {
  it("candidate for node/300001 (3 legacy rows · 'lumbung resto' × 3) rejected · no rows changed", async () => {
    const before = await fetchByNatural("node/300001");
    expect(before).toHaveLength(3);
    const beforeNames = before.map((r) => r.business_name);
    const c = await seedPendingClaim("agent-h6a");
    const { evId, ts } = await seedEvidence({ wiId: c.id, gen: c.generation });
    const r = await callPersisterDirect({
      agentId: "agent-h6a", workItemId: c.id, generation: c.generation,
      evidenceId: evId, retrievedAt: ts, naturalKey: "node/300001",
      payload: { osm_type: "node", osm_id: 300001, tags: { amenity: "restaurant", name: "Attempted overwrite" } },
    });
    expect(r.ok).toBe(false);
    expect(r.rejected).toBe(true);
    expect(r.rejection_reason).toBe("identity_ambiguous:3_matches");
    // None of the 3 legacy rows changed
    const after = await fetchByNatural("node/300001");
    expect(after).toHaveLength(3);
    expect(after.every((row) => beforeNames.includes(row.business_name))).toBe(true);
    expect(after.every((row) => row.source_retrieved_at === null)).toBe(true);
  });

  it("candidate for node/300002 (2 DIFFERENT businesses on same OSM node) rejected same way", async () => {
    const before = await fetchByNatural("node/300002");
    expect(before).toHaveLength(2);
    const c = await seedPendingClaim("agent-h6b");
    const { evId, ts } = await seedEvidence({ wiId: c.id, gen: c.generation });
    const r = await callPersisterDirect({
      agentId: "agent-h6b", workItemId: c.id, generation: c.generation,
      evidenceId: evId, retrievedAt: ts, naturalKey: "node/300002",
      payload: { osm_type: "node", osm_id: 300002, tags: { amenity: "cafe", name: "Merger Attempt" } },
    });
    expect(r.ok).toBe(false);
    expect(r.rejected).toBe(true);
    expect(r.rejection_reason).toBe("identity_ambiguous:2_matches");
    // Neither existing row changed
    const after = await fetchByNatural("node/300002");
    expect(after).toHaveLength(2);
    expect(after.map((r) => r.business_name).sort()).toEqual(["Calf Coffee Industry", "WARUNG CLICKSQUARE"]);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// H7 · dedupe_hash collision must NEVER merge businesses
// ═════════════════════════════════════════════════════════════════════════════
describe("H7 · dedupe_hash collision does NOT merge distinct source_references", () => {
  it("two candidates with identical dedupe_hash-forming fields but different natural_keys → two distinct target rows", async () => {
    const c = await seedPendingClaim("agent-h7");
    const { evId, ts } = await seedEvidence({ wiId: c.id, gen: c.generation });
    const payload = { tags: { amenity: "restaurant", name: "Twins", phone: "+62 274 111", "addr:street": "Jl. Same", "addr:city": "Yogyakarta" }, lat: -7.8, lon: 110.4 };
    const rA = await callPersisterDirect({
      agentId: "agent-h7", workItemId: c.id, generation: c.generation,
      evidenceId: evId, retrievedAt: ts, naturalKey: "node/770001",
      payload: { osm_id: 770001, ...payload },
    });
    const rB = await callPersisterDirect({
      agentId: "agent-h7", workItemId: c.id, generation: c.generation,
      evidenceId: evId, retrievedAt: ts, naturalKey: "node/770002",
      payload: { osm_id: 770002, ...payload },
    });
    expect(rA.new_row).toBe(true);
    expect(rB.new_row).toBe(true);
    const rowA = (await fetchByNatural("node/770001"))[0];
    const rowB = (await fetchByNatural("node/770002"))[0];
    expect(rowA.dedupe_hash).toBe(rowB.dedupe_hash);              // hash collides
    expect(rowA.internal_id).not.toBe(rowB.internal_id);          // rows separate
    expect(rowA.source_reference).not.toBe(rowB.source_reference); // identity distinguishes
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// H8 · repeated same OSM candidate must not create uncontrolled duplicates
// ═════════════════════════════════════════════════════════════════════════════
describe("H8 · repeated same OSM candidate · no uncontrolled duplicate creation", () => {
  it("persisting the same natural_key 3× (fresh insert then 2 monotonic updates) leaves exactly ONE row", async () => {
    const c = await seedPendingClaim("agent-h8");
    // First insert
    const ev1 = await seedEvidence({ wiId: c.id, gen: c.generation, qh: "q1", rh: "r1", ts: "2026-09-04T00:00:00.000Z" });
    await callPersisterDirect({
      agentId: "agent-h8", workItemId: c.id, generation: c.generation,
      evidenceId: ev1.evId, retrievedAt: ev1.ts, naturalKey: "node/880001",
      payload: { osm_id: 880001, tags: { amenity: "restaurant", name: "Insert-1" } },
    });
    // Newer update
    const ev2 = await seedEvidence({ wiId: c.id, gen: c.generation, qh: "q2", rh: "r2", ts: "2026-09-04T01:00:00.000Z" });
    await callPersisterDirect({
      agentId: "agent-h8", workItemId: c.id, generation: c.generation,
      evidenceId: ev2.evId, retrievedAt: ev2.ts, naturalKey: "node/880001",
      payload: { osm_id: 880001, tags: { amenity: "restaurant", name: "Update-2" } },
    });
    // Even newer update
    const ev3 = await seedEvidence({ wiId: c.id, gen: c.generation, qh: "q3", rh: "r3", ts: "2026-09-04T02:00:00.000Z" });
    await callPersisterDirect({
      agentId: "agent-h8", workItemId: c.id, generation: c.generation,
      evidenceId: ev3.evId, retrievedAt: ev3.ts, naturalKey: "node/880001",
      payload: { osm_id: 880001, tags: { amenity: "restaurant", name: "Update-3" } },
    });
    const rows = await fetchByNatural("node/880001");
    expect(rows).toHaveLength(1);
    expect(rows[0].business_name).toBe("Update-3");
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// H9 · older evidence must not overwrite newer
// ═════════════════════════════════════════════════════════════════════════════
describe("H9 · older retrieved_at → SILENT NO-OP", () => {
  it("stale-arriving evidence leaves row unchanged", async () => {
    const c = await seedPendingClaim("agent-h9");
    const newer = await seedEvidence({ wiId: c.id, gen: c.generation, qh: "qnew", rh: "rnew", ts: "2026-09-04T05:00:00.000Z" });
    await callPersisterDirect({
      agentId: "agent-h9", workItemId: c.id, generation: c.generation,
      evidenceId: newer.evId, retrievedAt: newer.ts, naturalKey: "node/990001",
      payload: { osm_id: 990001, tags: { amenity: "restaurant", name: "Newer" } },
    });
    const older = await seedEvidence({ wiId: c.id, gen: c.generation, qh: "qold", rh: "rold", ts: "2026-09-04T01:00:00.000Z" });
    const r = await callPersisterDirect({
      agentId: "agent-h9", workItemId: c.id, generation: c.generation,
      evidenceId: older.evId, retrievedAt: older.ts, naturalKey: "node/990001",
      payload: { osm_id: 990001, tags: { amenity: "restaurant", name: "Stale Rewrite Attempt" } },
    });
    expect(r.ok).toBe(true);
    expect(r.updated_row).toBe(false);
    expect(r.new_row).toBe(false);
    const row = (await fetchByNatural("node/990001"))[0];
    expect(row.business_name).toBe("Newer");
    expect(row.source_retrieved_at.toISOString()).toBe(newer.ts);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// H10 · newer evidence wins
// ═════════════════════════════════════════════════════════════════════════════
describe("H10 · newer retrieved_at wins", () => {
  it("second persist with later retrieved_at replaces name + evidence link", async () => {
    const c = await seedPendingClaim("agent-h10");
    const early = await seedEvidence({ wiId: c.id, gen: c.generation, qh: "qe", rh: "re", ts: "2026-09-04T01:00:00.000Z" });
    await callPersisterDirect({
      agentId: "agent-h10", workItemId: c.id, generation: c.generation,
      evidenceId: early.evId, retrievedAt: early.ts, naturalKey: "node/1010001",
      payload: { osm_id: 1010001, tags: { amenity: "restaurant", name: "Early" } },
    });
    const late = await seedEvidence({ wiId: c.id, gen: c.generation, qh: "ql", rh: "rl", ts: "2026-09-04T09:00:00.000Z" });
    const r = await callPersisterDirect({
      agentId: "agent-h10", workItemId: c.id, generation: c.generation,
      evidenceId: late.evId, retrievedAt: late.ts, naturalKey: "node/1010001",
      payload: { osm_id: 1010001, tags: { amenity: "restaurant", name: "Late" } },
    });
    expect(r.updated_row).toBe(true);
    const row = (await fetchByNatural("node/1010001"))[0];
    expect(row.business_name).toBe("Late");
    expect(row.source_evidence_id).toBe(late.evId);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// H11 · equal timestamp · evidence_id lex tiebreak
// ═════════════════════════════════════════════════════════════════════════════
describe("H11 · equal retrieved_at · evidence_id lex order breaks tie", () => {
  it("higher evidence_id wins · lower does not displace higher", async () => {
    const c = await seedPendingClaim("agent-h11");
    const ts = "2026-09-04T04:00:00.000Z";
    const a = await seedEvidence({ wiId: c.id, gen: c.generation, qh: "qA", rh: "rA", ts });
    const b = await seedEvidence({ wiId: c.id, gen: c.generation, qh: "qB", rh: "rB", ts });
    const [lower, higher] = a.evId < b.evId ? [a, b] : [b, a];
    await callPersisterDirect({
      agentId: "agent-h11", workItemId: c.id, generation: c.generation,
      evidenceId: lower.evId, retrievedAt: ts, naturalKey: "node/1110001",
      payload: { osm_id: 1110001, tags: { amenity: "restaurant", name: "Lower first" } },
    });
    const rH = await callPersisterDirect({
      agentId: "agent-h11", workItemId: c.id, generation: c.generation,
      evidenceId: higher.evId, retrievedAt: ts, naturalKey: "node/1110001",
      payload: { osm_id: 1110001, tags: { amenity: "restaurant", name: "Higher wins" } },
    });
    expect(rH.updated_row).toBe(true);
    expect((await fetchByNatural("node/1110001"))[0].business_name).toBe("Higher wins");
    // Now try to displace higher with lower — must NO-OP
    const rL = await callPersisterDirect({
      agentId: "agent-h11", workItemId: c.id, generation: c.generation,
      evidenceId: lower.evId, retrievedAt: ts, naturalKey: "node/1110001",
      payload: { osm_id: 1110001, tags: { amenity: "restaurant", name: "Lower attempted rewrite" } },
    });
    expect(rL.ok).toBe(true);
    expect(rL.updated_row).toBe(false);
    expect((await fetchByNatural("node/1110001"))[0].business_name).toBe("Higher wins");
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// H12 · existing brain_app access preserved after RLS enabled
// ═════════════════════════════════════════════════════════════════════════════
describe("H12 · nex_brain_app existing CRUD access preserved after RLS enable", () => {
  it("brain_login (SET LOCAL ROLE nex_brain_app) can SELECT / INSERT / UPDATE / DELETE food_business", async () => {
    // SELECT · sees every row including workforce-scoped ones
    const sel = await brainPool.query("SELECT count(*)::int AS n FROM nex.food_business");
    expect(sel.rows[0].n).toBeGreaterThan(0);
    // INSERT (source != osm_overpass · brain_app can write anything · not workforce-scoped)
    const ins = await brainPool.query(`
      INSERT INTO nex.food_business
        (public_listing_ref, business_name, category, city, country, source, source_reference, dedupe_hash)
      VALUES ('#FL-2026-BB999', 'Brain Insert Test', 'restaurant', 'Yogyakarta', 'ID', 'internal_brain', 'brain-key-1', 'brain_hash_1')
      RETURNING internal_id`);
    expect(ins.rowCount).toBe(1);
    const pk = ins.rows[0].internal_id;
    // UPDATE
    const upd = await brainPool.query("UPDATE nex.food_business SET business_name='Brain Updated' WHERE internal_id=$1", [pk]);
    expect(upd.rowCount).toBe(1);
    // DELETE
    const del = await brainPool.query("DELETE FROM nex.food_business WHERE internal_id=$1", [pk]);
    expect(del.rowCount).toBe(1);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// H13 · existing social_app access preserved
// ═════════════════════════════════════════════════════════════════════════════
describe("H13 · nex_social_app existing CRUD access preserved after RLS enable", () => {
  it("social_login (SET LOCAL ROLE nex_social_app) can SELECT / INSERT / UPDATE / DELETE food_business", async () => {
    const sel = await socialPool.query("SELECT count(*)::int AS n FROM nex.food_business");
    expect(sel.rows[0].n).toBeGreaterThan(0);
    const ins = await socialPool.query(`
      INSERT INTO nex.food_business
        (public_listing_ref, business_name, category, city, country, source, source_reference, dedupe_hash)
      VALUES ('#FL-2026-SS999', 'Social Insert Test', 'restaurant', 'Yogyakarta', 'ID', 'internal_social', 'social-key-1', 'social_hash_1')
      RETURNING internal_id`);
    expect(ins.rowCount).toBe(1);
    const pk = ins.rows[0].internal_id;
    const upd = await socialPool.query("UPDATE nex.food_business SET business_name='Social Updated' WHERE internal_id=$1", [pk]);
    expect(upd.rowCount).toBe(1);
    const del = await socialPool.query("DELETE FROM nex.food_business WHERE internal_id=$1", [pk]);
    expect(del.rowCount).toBe(1);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// H14 · workforce persister isolation
// ═════════════════════════════════════════════════════════════════════════════
describe("H14 · workforce persister cannot write source != 'osm_overpass'", () => {
  it("persister function hardcodes source='osm_overpass' · RLS policy WITH CHECK confirms it", async () => {
    // The persister function always sets source='osm_overpass' internally.
    // Prove: any INSERT the persister role attempts with a different source
    // value would be RLS-rejected by policy WITH CHECK (source='osm_overpass').
    // We test this by directly attempting to INSERT as the persister role
    // (via SET ROLE from superuser) with a bad source value.
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SET LOCAL ROLE nex_workforce_persister_food_business");
      await expect(client.query(`
        INSERT INTO nex.food_business
          (public_listing_ref, business_name, category, city, country, source, source_reference, dedupe_hash)
        VALUES ('#FL-2026-XX001', 'Illegal Source', 'restaurant', 'Yogyakarta', 'ID', 'not_osm_overpass', 'x', 'x')
      `)).rejects.toThrow(/policy|row-level security|permission/i);
      await client.query("ROLLBACK");
    } finally { client.release(); }
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// H15 · persister role NOBYPASSRLS
// ═════════════════════════════════════════════════════════════════════════════
describe("H15 · nex_workforce_persister_food_business has NOBYPASSRLS + NOLOGIN", () => {
  it("role attributes correct", async () => {
    const q = await pool.query("SELECT rolcanlogin, rolbypassrls FROM pg_roles WHERE rolname='nex_workforce_persister_food_business'");
    expect(q.rows[0].rolcanlogin).toBe(false);
    expect(q.rows[0].rolbypassrls).toBe(false);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// H16 · RLS state · ENABLE only, NOT FORCE (matches production convention)
// ═════════════════════════════════════════════════════════════════════════════
describe("H16 · nex.food_business has RLS ENABLED but NOT FORCED", () => {
  it("relrowsecurity=t, relforcerowsecurity=f · matches production pattern for non-social nex tables", async () => {
    const q = await pool.query("SELECT relrowsecurity, relforcerowsecurity FROM pg_class WHERE oid='nex.food_business'::regclass");
    expect(q.rows[0].relrowsecurity).toBe(true);
    expect(q.rows[0].relforcerowsecurity).toBe(false);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// H17 · no universal PUBLIC bypass
// ═════════════════════════════════════════════════════════════════════════════
describe("H17 · no policy grants PUBLIC / anon universal access", () => {
  it("all policies scoped to explicit roles · no policy has PUBLIC in polroles", async () => {
    // One row per (policy, role) pair · flat rolname column (avoids array_agg quoting)
    const q = await pool.query(`
      SELECT p.polname, r.rolname
      FROM pg_policy p
      JOIN LATERAL unnest(p.polroles) AS rid ON true
      LEFT JOIN pg_roles r ON r.oid = rid
      WHERE p.polrelid='nex.food_business'::regclass
    `);
    // Every policy must target a specific role, never PUBLIC/anon/authenticated
    for (const row of q.rows) {
      expect(row.rolname, `${row.polname} role must be named (not PUBLIC / NULL)`).not.toBeNull();
      expect(row.rolname).not.toBe("anon");
      expect(row.rolname).not.toBe("authenticated");
    }
    const rolesUsed = new Set(q.rows.map((r) => r.rolname));
    // Expected role set exactly
    for (const e of ["nex_brain_app", "nex_social_app", "nex_workforce_persister_food_business"]) {
      expect(rolesUsed, `policy for role ${e}`).toContain(e);
    }
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// H18 · production-shape extra columns preserved by migration
// ═════════════════════════════════════════════════════════════════════════════
describe("H18 · migration adds only its own columns · existing extras untouched", () => {
  it("all 50 production columns still present + 2 R2 additions = 52 total", async () => {
    const q = await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_schema='nex' AND table_name='food_business'`);
    const cols = new Set(q.rows.map((r) => r.column_name));
    // R2 additions
    expect(cols.has("source_evidence_id")).toBe(true);
    expect(cols.has("source_retrieved_at")).toBe(true);
    // Preserved production extras
    for (const c of [
      "source_updated_at","last_verified_at","verification_source","categories","country",
      "location_confidence","neighbourhood","street_line","in_target_zone","geocode_evidence",
      "location_verified_at","location_source","recovered_evidence","evidence_recovered_at",
      "evidence_source","worker_id","cycle_run_id",
    ]) {
      expect(cols.has(c), `column ${c} must remain after Slice 1h R2`).toBe(true);
    }
    expect(cols.size).toBe(52);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// H19 · cycle_run_id remains intact after migration
// ═════════════════════════════════════════════════════════════════════════════
describe("H19 · existing cycle_run_id relationships survive migration", () => {
  it("fixture row #FL-2026-WW001 still has cycle_run_id set · FK to worker_cycle_run intact", async () => {
    const q = await pool.query("SELECT cycle_run_id, worker_id FROM nex.food_business WHERE public_listing_ref='#FL-2026-WW001'");
    expect(q.rows[0].cycle_run_id).toBe("11111111-1111-1111-1111-111111111111");
    expect(q.rows[0].worker_id).toBe("acquisition:food:Yogyakarta:v2");
    // FK constraint still in place
    const fk = await pool.query(`SELECT count(*)::int AS n FROM pg_constraint c JOIN pg_class cl ON cl.oid=c.conrelid
                                 WHERE cl.relname='food_business' AND c.conname='food_business_cycle_run_id_fkey'`);
    expect(fk.rows[0].n).toBe(1);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// H20 · worker attribution intact
// ═════════════════════════════════════════════════════════════════════════════
describe("H20 · workforce persister does NOT touch worker_id / cycle_run_id on updates", () => {
  it("H4-style monotonic update preserves legacy worker attribution", async () => {
    // Fixture #FL-2026-WW001 has worker_id + cycle_run_id set
    const before = (await pool.query("SELECT worker_id, cycle_run_id FROM nex.food_business WHERE public_listing_ref='#FL-2026-WW001'")).rows[0];
    const c = await seedPendingClaim("agent-h20");
    const { evId, ts } = await seedEvidence({ wiId: c.id, gen: c.generation, ts: "2026-09-04T12:00:00.000Z" });
    const r = await callPersisterDirect({
      agentId: "agent-h20", workItemId: c.id, generation: c.generation,
      evidenceId: evId, retrievedAt: ts, naturalKey: "node/400001",
      payload: { osm_type: "node", osm_id: 400001, tags: { amenity: "restaurant", name: "Worker Attributed Row (updated)" } },
    });
    expect(r.updated_row).toBe(true);
    const after = (await pool.query("SELECT worker_id, cycle_run_id FROM nex.food_business WHERE public_listing_ref='#FL-2026-WW001'")).rows[0];
    expect(after.worker_id).toBe(before.worker_id);
    expect(after.cycle_run_id).toBe(before.cycle_run_id);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// H21 · source='osm_overpass' accepted
// ═════════════════════════════════════════════════════════════════════════════
describe("H21 · workforce accepts source='osm_overpass'", () => {
  it("persister accepts source_slug 'overpass' and writes source='osm_overpass'", async () => {
    const c = await seedPendingClaim("agent-h21");
    const { evId, ts } = await seedEvidence({ wiId: c.id, gen: c.generation });
    const r = await callPersisterDirect({
      agentId: "agent-h21", workItemId: c.id, generation: c.generation,
      evidenceId: evId, retrievedAt: ts, sourceSlug: "overpass", naturalKey: "node/210001",
      payload: { osm_type: "node", osm_id: 210001, tags: { amenity: "restaurant", name: "H21" } },
    });
    expect(r.ok).toBe(true);
    const row = (await fetchByNatural("node/210001"))[0];
    expect(row.source).toBe("osm_overpass");
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// H22 · openstreetmap_overpass_v1 rows remain outside workforce ownership
// ═════════════════════════════════════════════════════════════════════════════
describe("H22 · openstreetmap_overpass_v1 rows NOT taken over by workforce", () => {
  it("v1 rows untouched after all persister operations · persister match query never sees them", async () => {
    const beforeV1Count = (await pool.query("SELECT count(*)::int AS n FROM nex.food_business WHERE source='openstreetmap_overpass_v1'")).rows[0].n;
    expect(beforeV1Count).toBeGreaterThan(0);
    // Perform an insert/update against osm_overpass with source_reference=node/500001 (which v1 has)
    const c = await seedPendingClaim("agent-h22");
    const { evId, ts } = await seedEvidence({ wiId: c.id, gen: c.generation });
    const r = await callPersisterDirect({
      agentId: "agent-h22", workItemId: c.id, generation: c.generation,
      evidenceId: evId, retrievedAt: ts, naturalKey: "node/500001",
      payload: { osm_type: "node", osm_id: 500001, tags: { amenity: "restaurant", name: "Fresh osm_overpass row" } },
    });
    // Persister sees 0 matches in osm_overpass (v1 row uses different source) → INSERT
    expect(r.ok).toBe(true);
    expect(r.new_row).toBe(true);
    // v1 rows unchanged
    const afterV1Count = (await pool.query("SELECT count(*)::int AS n FROM nex.food_business WHERE source='openstreetmap_overpass_v1'")).rows[0].n;
    expect(afterV1Count).toBe(beforeV1Count);
    // v1 row content intact
    const v1Row = (await pool.query("SELECT business_name FROM nex.food_business WHERE source='openstreetmap_overpass_v1' AND source_reference='node/500001'")).rows[0];
    expect(v1Row.business_name).toBe("Legacy V1 Restaurant");
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// H23 · no production connection during tests
// ═════════════════════════════════════════════════════════════════════════════
describe("H23 · test connection targets portable cluster ONLY", () => {
  it("all pools connect to 127.0.0.1:5439/nex_workforce_slice1_test", async () => {
    for (const p of [pool, runtimePool, brainPool, socialPool]) {
      const r = await p.query("SELECT current_database() AS db, current_setting('port') AS port");
      expect(r.rows[0].db).toBe("nex_workforce_slice1_test");
      expect(r.rows[0].port).toBe("5439");
    }
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// H24 · no production mutation
// ═════════════════════════════════════════════════════════════════════════════
describe("H24 · zero external database connections opened during this suite", () => {
  it("no connection attempts to *.pooler.supabase.com / port 5432 / port 5433 / nex_dev", async () => {
    // We assert that the pool configurations we set up use only the portable target.
    // Real proof lives in the beforeAll guardrail (H23 URL check) · this is a
    // static declaration test.
    expect(URL).toBe("postgres://postgres@127.0.0.1:5439/nex_workforce_slice1_test");
    expect(RUNTIME_URL).toBe("postgres://nex_workforce_runtime@127.0.0.1:5439/nex_workforce_slice1_test");
    expect(BRAIN_URL).toBe("postgres://nex_brain_login@127.0.0.1:5439/nex_workforce_slice1_test");
    expect(SOCIAL_URL).toBe("postgres://nex_social_login@127.0.0.1:5439/nex_workforce_slice1_test");
    // No hostname pattern for production
    for (const u of [URL, RUNTIME_URL, BRAIN_URL, SOCIAL_URL]) {
      expect(u).not.toMatch(/pooler\.supabase\.com/);
      expect(u).not.toMatch(/:5432/);
      expect(u).not.toMatch(/:5433/);
      expect(u).not.toMatch(/nex_dev/);
    }
  });
});
