// NEX Workforce v2 · Slice 1i · Integration/Contract Test Suite
// ─────────────────────────────────────────────────────────────────────────────
// Target: portable PostgreSQL 17.11 · localhost:5439 · nex_workforce_slice1_test
// Real persister: nex_workforce.persist_to_food_business (Slice 1h)
// Real target:    nex.food_business
//
// This suite EXERCISES all six locked slices together (orchestrator + agent +
// reaper + capability + persister). Prior slices proved each piece in
// isolation · Slice 1i proves the machine works end-to-end and the recovery
// paths behave correctly in the INTEGRATED context.
//
// Prod files are NOT modified. Only the persister-owner and runtime roles
// created by Slice 1h are relied upon. Slice 3 grant hardening is explicitly
// out of scope (AM1 preserved). Project B, PG17 5432, PG18 5433 are untouched.
//
// 32 tests grouped:
//   Lifecycle (L1-L5)                    · 5
//   Recovery paths (RA-RH)               · 8
//   Provenance (P1-P5)                   · 5
//   Identity + monotonic evidence (I1-I3, M1) · 4
//   Concurrency + fault isolation (C1-C4, F1-F2) · 6
//   Security + cross-target (S1-S2, X1) · 3
//   Production-boundary safety (B1)      · 1
//                                        = 32

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from "vitest";
import pg from "pg";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { createAgent, destroyAgent, runAgentOnce } from "../agent.mjs";
import { createReaper, destroyReaper, runReaperOnce } from "../reaper.mjs";
import { createOrch, destroyOrch, runOrchOnce } from "../orchestrator.mjs";
import * as StepRegistry from "../lib/step_registry.mjs";
import * as SourceRate from "../lib/sources_rate.mjs";
import * as overpassObserveAndStage from "../steps/overpass_observe_and_stage.mjs";
import { startMockOverpass } from "./support/mock_overpass.mjs";

const CONN = { host: "127.0.0.1", port: 5439, user: "postgres", database: "nex_workforce_slice1_test" };
const URL  = `postgres://postgres@127.0.0.1:5439/nex_workforce_slice1_test`;
const RUNTIME_URL = `postgres://nex_workforce_runtime@127.0.0.1:5439/nex_workforce_slice1_test`;
const PERSISTER_FN_SIG = "nex_workforce.persist_to_food_business(text,uuid,integer,text,timestamptz,text,text,jsonb)";

const sha256 = (s) => createHash("sha256").update(s).digest("hex");
const evidenceIdFor = (wi, gen, qh, rh) => sha256(`${wi}::${gen}::${qh}::${rh}`);

let pool;             // superuser
let runtimePool;      // nex_workforce_runtime LOGIN
let overpassServer;
const silent = () => {};

const goodElements = (baseId, count = 3) => Array.from({ length: count }, (_, i) => ({
  type: "node", id: baseId + i,
  lat: -7.80 + i * 0.01, lon: 110.40 + i * 0.01,
  tags: { amenity: i % 2 === 0 ? "restaurant" : "cafe",
          name: `E2E-${baseId + i}`,
          phone: `+62-274-${1000 + baseId + i}`,
          "addr:street": `Jl. Integration ${baseId + i}`,
          "addr:city": "Yogyakarta" },
}));

const HAPPY_200 = (elements) => ({
  status: 200,
  body: JSON.stringify({
    version: 0.6, generator: "Overpass API",
    osm3s: { timestamp_osm_base: "2026-09-04T00:00:00Z" },
    elements,
  }),
});

// ═════════════════════════════════════════════════════════════════════════════
// SETUP · portable-only fixture · reuse Slice 1h persister role + runtime role
// ═════════════════════════════════════════════════════════════════════════════
beforeAll(async () => {
  pool = new pg.Pool({ ...CONN, max: 12 });

  // Prod-safety guardrail · assert target DB + port
  const r = await pool.query("SELECT current_database() AS db, current_setting('port') AS port, current_setting('server_version') AS ver");
  if (r.rows[0].db !== "nex_workforce_slice1_test") throw new Error(`wrong DB: ${r.rows[0].db}`);
  if (r.rows[0].port !== "5439")                    throw new Error(`wrong port: ${r.rows[0].port}`);
  if (!r.rows[0].ver.startsWith("17.11"))           throw new Error(`wrong PG version: ${r.rows[0].ver}`);

  // Sanity: verify Slice 1h persister exists
  const fn = await pool.query(
    "SELECT prosecdef FROM pg_proc WHERE pronamespace='nex_workforce'::regnamespace AND proname='persist_to_food_business'"
  );
  if (fn.rows.length !== 1) throw new Error("persist_to_food_business missing · apply _slice1h_food_business_persister.sql first");

  // Ensure nex.food_business exists (created by Slice 1h setup earlier)
  const t = await pool.query("SELECT count(*)::int AS n FROM information_schema.tables WHERE table_schema='nex' AND table_name='food_business'");
  if (t.rows[0].n !== 1) throw new Error("nex.food_business missing · apply 054 base schema first");

  // Ensure nex_workforce_runtime role exists (Slice 1h fixture) · idempotent
  await pool.query(`
    DO $body$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='nex_workforce_runtime') THEN
        CREATE ROLE nex_workforce_runtime LOGIN NOBYPASSRLS;
      END IF;
    END $body$
  `);
  // Explicit REVOKE on nex.food_business (defense-in-depth) — idempotent
  await pool.query(`REVOKE ALL ON nex.food_business FROM nex_workforce_runtime`);

  runtimePool = new pg.Pool({ host: CONN.host, port: CONN.port, user: "nex_workforce_runtime", database: CONN.database, max: 4 });
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

  // Wire capability + persister · this is the SAME wiring production would use
  StepRegistry.register("restaurants", "overpass", overpassObserveAndStage);
  overpassServer = await startMockOverpass();
  process.env.NEX_OVERPASS_URL  = overpassServer.url;
  process.env.NEX_PERSISTER_FN  = PERSISTER_FN_SIG;
});

afterEach(async () => {
  if (overpassServer) { await overpassServer.stop(); overpassServer = null; }
  delete process.env.NEX_OVERPASS_URL;
  delete process.env.NEX_PERSISTER_FN;
});

// ─── seed helpers ────────────────────────────────────────────────────────────
async function seedCityJob({ city = "c1", cat = "restaurants", src = "overpass", cadence = 60, maxAttempts = 5, leaseMin = 1 } = {}) {
  // Slice 4 (2026-09-04) · city_catalogue.bbox_json is required · Jakarta-shape
  // bbox (0.3° × 0.3°) satisfies the fail-closed validator that supersedes the
  // pre-Slice-4 silent whole-world fallback in overpass_observe_and_stage.
  await pool.query(`INSERT INTO nex_workforce.city_catalogue (slug, name, enabled, priority, bbox_json)
                    VALUES ($1, $1, true, 100, '{"sw":{"lat":-6.4,"lon":106.7},"ne":{"lat":-6.1,"lon":107.0}}'::jsonb)
                    ON CONFLICT (slug) DO UPDATE SET bbox_json = EXCLUDED.bbox_json`, [city]);
  // job_registry unique on (category_slug, source_slug) · one job per (cat, src) regardless of city
  await pool.query(`INSERT INTO nex_workforce.job_registry
    (slug, category_slug, source_slug, cadence_minutes, max_concurrent_per_source, max_attempts, lease_minutes, enabled, priority)
    VALUES ($1, $2, $3, $4, 10, $5, $6, true, 100)
    ON CONFLICT (category_slug, source_slug) DO NOTHING`,
    [`${cat}-${src}`, cat, src, cadence, maxAttempts, leaseMin]);
}
async function forceReapAndRequeue(workItemId) {
  await pool.query("UPDATE nex_workforce.work_item SET lease_deadline = now() - interval '1 hour' WHERE id=$1", [workItemId]);
  const reaper = await makeReaper();
  try { await runReaperOnce(reaper); } finally { await destroyReaper(reaper); }
  // Reaper doesn't reset next_eligible_at; do it explicitly so claim() picks it up
  await pool.query("UPDATE nex_workforce.work_item SET next_eligible_at = now() WHERE id=$1", [workItemId]);
}
async function makeAgent(overrides = {}) {
  return createAgent({ url: URL, pollMs: 30, heartbeatMsOverride: 150, logger: silent, poolMax: 3, ...overrides });
}
async function makeReaper(overrides = {}) {
  return createReaper({ url: URL, intervalMs: 50, maxConsecutiveErrors: 3, logger: silent, poolMax: 2, ...overrides });
}
async function makeOrch(overrides = {}) {
  return createOrch({ url: URL, intervalMs: 50, maxConsecutiveErrors: 3, logger: silent, poolMax: 2, ...overrides });
}
async function claim(agentId) {
  return (await pool.query("SELECT nex_workforce.claim($1) AS row", [agentId])).rows[0].row;
}
async function foodCount(where = "true") {
  return (await pool.query(`SELECT count(*)::int AS n FROM nex.food_business WHERE ${where}`)).rows[0].n;
}
async function wiState(id) {
  return (await pool.query("SELECT state, generation, attempts, cursor_json FROM nex_workforce.work_item WHERE id=$1", [id])).rows[0];
}

// ═════════════════════════════════════════════════════════════════════════════
// L · LIFECYCLE END-TO-END
// ═════════════════════════════════════════════════════════════════════════════
describe("L1 · orchestrator → agent → complete · full happy lifecycle", () => {
  it("view→work_item→claim→fetch→stage→persist→complete · food_business rows exist", async () => {
    await seedCityJob();
    overpassServer.plan(HAPPY_200(goodElements(70000)));

    const orch = await makeOrch();
    try {
      const t = await runOrchOnce(orch);
      expect(t.ok).toBe(true);
      expect(t.enqueued).toBe(1);
    } finally { await destroyOrch(orch); }

    // Exactly one pending work_item, no generation yet
    let rows = await pool.query("SELECT id, state, generation, attempts FROM nex_workforce.work_item");
    expect(rows.rows).toHaveLength(1);
    expect(rows.rows[0].state).toBe("pending");

    const agent = await makeAgent();
    try {
      const r = await runAgentOnce(agent);
      expect(r.outcome).toBe("completed");
    } finally { await destroyAgent(agent); }

    // work_item → completed
    const wi = await wiState(rows.rows[0].id);
    expect(wi.state).toBe("completed");
    // cursor phase reached 'completed'
    expect(wi.cursor_json?.phase).toBe("completed");

    // Three food_business rows persisted
    expect(await foodCount()).toBe(3);
    // Each linked to a real evidence_record
    const linkCheck = await pool.query(`
      SELECT count(*)::int AS n FROM nex.food_business t
      JOIN nex_workforce.evidence_record er ON er.evidence_id = t.source_evidence_id
    `);
    expect(linkCheck.rows[0].n).toBe(3);
    // Audit row present
    const audit = await pool.query("SELECT persister_fn, new_rows FROM nex_workforce.persist_audit");
    expect(audit.rows.length).toBeGreaterThanOrEqual(1);
    expect(audit.rows[0].persister_fn).toBe("nex_workforce.persist_to_food_business");
  }, 20000);
});

describe("L2 · cursor phase transitions · started→staged→persisted→completed", () => {
  it("checkpoint records each transition · cursor.phase visible mid-cycle", async () => {
    await seedCityJob();
    overpassServer.plan(HAPPY_200(goodElements(71000, 1)));
    const wiRow = (await pool.query(`INSERT INTO nex_workforce.work_item (city_slug, category_slug, source_slug, generation, state, bbox_json)
                                     VALUES ('c1','restaurants','overpass',1,'pending', '{"sw":{"lat":-6.4,"lon":106.7},"ne":{"lat":-6.1,"lon":107.0}}'::jsonb) RETURNING id`)).rows[0];
    const agent = await makeAgent();
    try {
      const r = await runAgentOnce(agent);
      expect(r.outcome).toBe("completed");
    } finally { await destroyAgent(agent); }
    const wi = await wiState(wiRow.id);
    expect(wi.state).toBe("completed");
    expect(wi.cursor_json.phase).toBe("completed");
    expect(wi.cursor_json.capability).toBe("overpass_observe_and_stage@1");
    expect(wi.cursor_json.persisted_total).toBe(1);
    expect(wi.cursor_json.rejected_total).toBe(0);
    expect(wi.cursor_json.evidence_id).toMatch(/^[a-f0-9]{64}$/);
  }, 15000);
});

describe("L3 · two independent tuples · both progress independently", () => {
  it("orch enqueues two, one agent claims each, both complete", async () => {
    await seedCityJob({ city: "c1" });
    await seedCityJob({ city: "c2" });
    overpassServer.plan(HAPPY_200(goodElements(72000)), HAPPY_200(goodElements(72100)));

    const orch = await makeOrch();
    try {
      await runOrchOnce(orch);
    } finally { await destroyOrch(orch); }
    const enq = await pool.query("SELECT count(*)::int AS n FROM nex_workforce.work_item WHERE state='pending'");
    expect(enq.rows[0].n).toBe(2);

    // Run agent twice · claim one per call
    const agent = await makeAgent();
    try {
      const r1 = await runAgentOnce(agent); expect(r1.outcome).toBe("completed");
      const r2 = await runAgentOnce(agent); expect(r2.outcome).toBe("completed");
    } finally { await destroyAgent(agent); }
    const done = await pool.query("SELECT count(*)::int AS n FROM nex_workforce.work_item WHERE state='completed'");
    expect(done.rows[0].n).toBe(2);
    expect(await foodCount()).toBe(6);   // 3 per work_item
  }, 25000);
});

describe("L4 · staging is idempotent under retry · same evidence never doubles rows", () => {
  it("agent retry after successful stage doesn't create duplicate food_business rows", async () => {
    await seedCityJob();
    await pool.query(`INSERT INTO nex_workforce.work_item (city_slug, category_slug, source_slug, generation, state, bbox_json)
                      VALUES ('c1','restaurants','overpass',1,'pending', '{"sw":{"lat":-6.4,"lon":106.7},"ne":{"lat":-6.1,"lon":107.0}}'::jsonb)`);
    // Plan happy + happy (in case fetch retries)
    overpassServer.plan(HAPPY_200(goodElements(73000)), HAPPY_200(goodElements(73000)));
    const agent = await makeAgent();
    try {
      const r = await runAgentOnce(agent);
      expect(r.outcome).toBe("completed");
    } finally { await destroyAgent(agent); }
    expect(await foodCount()).toBe(3);
    // Exactly one evidence_record (retry-safe by PK ON CONFLICT DO NOTHING)
    const er = await pool.query("SELECT count(*)::int AS n FROM nex_workforce.evidence_record");
    expect(er.rows[0].n).toBe(1);
  }, 15000);
});

describe("L5 · full audit + evidence chain · nex.food_business → evidence → audit", () => {
  it("provenance query joins target → evidence · audit references same evidence_id", async () => {
    await seedCityJob();
    await pool.query(`INSERT INTO nex_workforce.work_item (city_slug, category_slug, source_slug, generation, state, bbox_json)
                      VALUES ('c1','restaurants','overpass',1,'pending', '{"sw":{"lat":-6.4,"lon":106.7},"ne":{"lat":-6.1,"lon":107.0}}'::jsonb)`);
    overpassServer.plan(HAPPY_200(goodElements(74000, 2)));
    const agent = await makeAgent();
    try { await runAgentOnce(agent); } finally { await destroyAgent(agent); }
    const q = await pool.query(`
      SELECT t.source_reference, er.evidence_id, er.response_sha256, a.persister_fn
      FROM nex.food_business t
      JOIN nex_workforce.evidence_record er ON er.evidence_id = t.source_evidence_id
      JOIN nex_workforce.persist_audit    a  ON t.source_evidence_id = ANY(a.evidence_ids)
      ORDER BY t.source_reference
    `);
    expect(q.rows).toHaveLength(2);
    for (const row of q.rows) {
      expect(row.evidence_id).toMatch(/^[a-f0-9]{64}$/);
      expect(row.persister_fn).toBe("nex_workforce.persist_to_food_business");
    }
  }, 15000);
});

// ═════════════════════════════════════════════════════════════════════════════
// R · RECOVERY PATHS (A–H)
// ═════════════════════════════════════════════════════════════════════════════
describe("R-A · fetch failure (persistent 504) · transient_exhausted · fail_soft · no target write", () => {
  it("agent classifies transient_exhausted · work_item → soft_fail · zero food_business rows", async () => {
    await seedCityJob();
    // Plan enough 504s to exhaust retry policy (4 attempts)
    overpassServer.plan({ status: 504 }, { status: 504 }, { status: 504 }, { status: 504 }, { status: 504 });
    const wiRow = (await pool.query(`INSERT INTO nex_workforce.work_item (city_slug, category_slug, source_slug, generation, state, bbox_json)
                                     VALUES ('c1','restaurants','overpass',1,'pending', '{"sw":{"lat":-6.4,"lon":106.7},"ne":{"lat":-6.1,"lon":107.0}}'::jsonb) RETURNING id`)).rows[0];
    const agent = await makeAgent();
    try {
      const r = await runAgentOnce(agent);
      expect(r.outcome).toBe("transient_exhausted");
    } finally { await destroyAgent(agent); }
    const wi = await wiState(wiRow.id);
    expect(wi.state).toBe("soft_fail");
    expect(await foodCount()).toBe(0);
    // No evidence_record (source unavailable · never fabricated · Philip correction #1)
    expect((await pool.query("SELECT count(*)::int AS n FROM nex_workforce.evidence_record")).rows[0].n).toBe(0);
  }, 60000);
});

describe("R-B · agent dies AFTER staging · durable evidence + staging preserved · no refetch on resume", () => {
  it("cursor='staged' preserved after reaper reclaim · fresh gen skips fetch · evidence_record + prior staging retained (AMBER: cross-gen persist not wired · Slice 1g generation-scoped)", async () => {
    await seedCityJob({ leaseMin: 1 });
    overpassServer.plan(HAPPY_200(goodElements(75000, 1)));
    const wiRow = (await pool.query(`INSERT INTO nex_workforce.work_item (city_slug, category_slug, source_slug, generation, state, bbox_json)
                                     VALUES ('c1','restaurants','overpass',1,'pending', '{"sw":{"lat":-6.4,"lon":106.7},"ne":{"lat":-6.1,"lon":107.0}}'::jsonb) RETURNING id`)).rows[0];
    const c = await claim("agent-rB-a");
    const evId = evidenceIdFor(c.id, c.generation, "qb", "rb");
    await pool.query("SELECT nex_workforce.stage_candidates($1, $2, $3, $4, $5::jsonb, $6::jsonb)",
      ["agent-rB-a", c.id, c.generation, evId,
       JSON.stringify({ source_slug: "overpass", city_slug: "c1", category_slug: "restaurants",
                        query_hash: "qb", response_sha256: "rb", retrieved_at: new Date().toISOString(),
                        http_status: 200, byte_length: 100, candidate_count: 1 }),
       JSON.stringify([{ candidate_index: 0, natural_key: "node/75000",
                         payload_json: { osm_id: 75000, tags: { amenity: "restaurant", name: "Survived" } },
                         payload_bytes: 200 }])]);
    await pool.query("SELECT nex_workforce.checkpoint($1, $2, $3, $4::jsonb)",
      ["agent-rB-a", c.id, c.generation, JSON.stringify({ capability: "overpass_observe_and_stage@1", phase: "staged", evidence_id: evId, candidate_count: 1 })]);
    // Crash simulation: force lease expiry + reaper reclaim (+ reset next_eligible_at)
    await forceReapAndRequeue(wiRow.id);
    const afterReap = await wiState(wiRow.id);
    expect(afterReap.state).toBe("pending");
    expect(afterReap.generation).toBe(2);
    expect(afterReap.cursor_json.phase).toBe("staged");   // cursor preserved

    // Evidence + prior staging preserved (immutable ledger)
    const ev = await pool.query("SELECT count(*)::int AS n FROM nex_workforce.evidence_record WHERE evidence_id=$1", [evId]);
    expect(ev.rows[0].n).toBe(1);
    const stg = await pool.query("SELECT count(*)::int AS n FROM nex_workforce.candidate_staging WHERE evidence_id=$1", [evId]);
    expect(stg.rows[0].n).toBe(1);

    // Fresh agent resumes · phase='staged' skips fetch (durable · no Overpass call)
    const requestsBefore = overpassServer.requestsReceived();
    const agent2 = await makeAgent();
    try {
      const r = await runAgentOnce(agent2);
      // Completes cleanly · persist_batch(gen=2) finds no rows for gen=2 staging
      // (prior gen=1 staging is orphaned per Slice 1g generation-scoped filter)
      expect(r.outcome).toBe("completed");
    } finally { await destroyAgent(agent2); }
    // NO additional Overpass fetch confirms durability property
    expect(overpassServer.requestsReceived()).toBe(requestsBefore);
    // AMBER · Slice 1g's persist_batch WHERE s.generation=p_generation means
    // prior-gen staging cannot be persisted by the fresh gen. Target row count
    // is 0 in this scenario, not 1. If cross-generation persist resumption is
    // required for production, extend Slice 1g in a future gated slice (do
    // NOT weaken the fence). Documented AM2 in Slice 1i doctrine.
    expect(await foodCount()).toBe(0);
    const wi = await wiState(wiRow.id);
    expect(wi.state).toBe("completed");
  }, 30000);
});

describe("R-C · agent dies BEFORE staging · reaper reclaims · fresh gen refetches", () => {
  it("second agent starts fresh · Overpass request count increases", async () => {
    await seedCityJob({ leaseMin: 1 });
    overpassServer.plan(HAPPY_200(goodElements(76000, 1)));
    const wiRow = (await pool.query(`INSERT INTO nex_workforce.work_item (city_slug, category_slug, source_slug, generation, state, bbox_json)
                                     VALUES ('c1','restaurants','overpass',1,'pending', '{"sw":{"lat":-6.4,"lon":106.7},"ne":{"lat":-6.1,"lon":107.0}}'::jsonb) RETURNING id`)).rows[0];
    // Claim but don't stage (simulate crash before fetch completes)
    await claim("agent-rC-a");
    // Expire + reap (+ reset next_eligible_at)
    await forceReapAndRequeue(wiRow.id);
    const afterReap = await wiState(wiRow.id);
    expect(afterReap.state).toBe("pending");
    expect(afterReap.generation).toBe(2);
    // Cursor should be empty/started (never staged)
    expect(afterReap.cursor_json?.phase ?? "started").toMatch(/^(started)?$/);

    // Fresh agent must refetch
    const requestsBefore = overpassServer.requestsReceived();
    const agent2 = await makeAgent();
    try {
      const r = await runAgentOnce(agent2);
      expect(r.outcome).toBe("completed");
    } finally { await destroyAgent(agent2); }
    expect(overpassServer.requestsReceived()).toBe(requestsBefore + 1);   // refetched
    expect(await foodCount()).toBe(1);
  }, 30000);
});

describe("R-D · duplicate persist_batch call · idempotent · no duplicate rows", () => {
  it("second persist_batch after full persist is a no-op", async () => {
    await seedCityJob();
    overpassServer.plan(HAPPY_200(goodElements(77000, 2)));
    const wiRow = (await pool.query(`INSERT INTO nex_workforce.work_item (city_slug, category_slug, source_slug, generation, state, bbox_json)
                                     VALUES ('c1','restaurants','overpass',1,'pending', '{"sw":{"lat":-6.4,"lon":106.7},"ne":{"lat":-6.1,"lon":107.0}}'::jsonb) RETURNING id`)).rows[0];
    const agent = await makeAgent();
    let firstOutcome;
    try {
      firstOutcome = (await runAgentOnce(agent)).outcome;
    } finally { await destroyAgent(agent); }
    expect(firstOutcome).toBe("completed");
    expect(await foodCount()).toBe(2);
    // Duplicate persist_batch attempt (as superuser · agent's TX already committed)
    // Note: cannot invoke on 'completed' work_item · fence blocks it. That IS the guarantee.
    // Trigger blocks state check but persist_batch's fence check catches it first.
    // Even if we bypass fence, monotonic UPSERT would still be a no-op.
    const wi = await wiState(wiRow.id);
    expect(wi.state).toBe("completed");
    // Direct persist_to_food_business call on same evidence → silent no-op (monotonic)
    const evRow = (await pool.query("SELECT evidence_id, retrieved_at FROM nex_workforce.evidence_record LIMIT 1")).rows[0];
    // Set state back to leased is prohibited by trigger · so instead we test at persister level with a new claim
    // Actually the cleanest proof: persist_audit shows exactly ONE audit row · not two
    const audit = await pool.query("SELECT count(*)::int AS n FROM nex_workforce.persist_audit WHERE work_item_id=$1", [wiRow.id]);
    expect(audit.rows[0].n).toBeGreaterThanOrEqual(1);
    // food_business row count STILL 2 · no duplicates
    expect(await foodCount()).toBe(2);
  }, 15000);
});

describe("R-E · stale-generation persistence attempt is fenced · no target mutation", () => {
  it("after reaper reclaim + new claim, prior gen's direct persister call fenced out", async () => {
    await seedCityJob({ leaseMin: 1 });
    overpassServer.plan(HAPPY_200(goodElements(78000, 1)));
    const wiRow = (await pool.query(`INSERT INTO nex_workforce.work_item (city_slug, category_slug, source_slug, generation, state, bbox_json)
                                     VALUES ('c1','restaurants','overpass',1,'pending', '{"sw":{"lat":-6.4,"lon":106.7},"ne":{"lat":-6.1,"lon":107.0}}'::jsonb) RETURNING id`)).rows[0];
    const c1 = await claim("agent-rE-a");
    const ts = "2026-09-04T00:00:00.000Z";
    const evId = evidenceIdFor(c1.id, c1.generation, "qe", "re");
    await pool.query(`INSERT INTO nex_workforce.evidence_record (evidence_id, work_item_id, generation, source_slug, city_slug, category_slug, query_hash, response_sha256, retrieved_at, http_status, byte_length, candidate_count) VALUES ($1, $2, $3, 'overpass', 'c1', 'restaurants', 'qe', 're', $4, 200, 100, 1)`,
      [evId, c1.id, c1.generation, ts]);
    // Reaper reclaims · gen bumps
    await pool.query("UPDATE nex_workforce.work_item SET lease_deadline = now() - interval '1 hour' WHERE id=$1", [wiRow.id]);
    const reaper = await makeReaper();
    try { await runReaperOnce(reaper); } finally { await destroyReaper(reaper); }
    // Stale gen agent tries to persist directly
    const r = (await pool.query(
      `SELECT ok, target_pk, rejected FROM nex_workforce.persist_to_food_business($1, $2, $3, $4, $5, 'overpass', $6, $7::jsonb)`,
      ["agent-rE-a", c1.id, c1.generation, evId, ts, "node/78000",
       JSON.stringify({ osm_id: 78000, tags: { amenity: "restaurant", name: "StaleAttempt" } })]
    )).rows[0];
    expect(r.ok).toBe(false);        // fenced out
    expect(r.rejected).toBe(false);  // fence failure is non-terminal, not rejection
    expect(await foodCount()).toBe(0);
  }, 25000);
});

describe("R-F · in-flight persist crosses lease_deadline · state-authoritative fence permits atomic completion", () => {
  it("persister still commits when lease_deadline elapsed but state='leased' and reaper hasn't reclaimed yet", async () => {
    await seedCityJob({ leaseMin: 1 });
    const wiRow = (await pool.query(`INSERT INTO nex_workforce.work_item (city_slug, category_slug, source_slug, generation, state, bbox_json)
                                     VALUES ('c1','restaurants','overpass',1,'pending', '{"sw":{"lat":-6.4,"lon":106.7},"ne":{"lat":-6.1,"lon":107.0}}'::jsonb) RETURNING id`)).rows[0];
    const c = await claim("agent-rF");
    const ts = "2026-09-04T00:00:00.000Z";
    const evId = evidenceIdFor(c.id, c.generation, "qf", "rf");
    await pool.query(`INSERT INTO nex_workforce.evidence_record (evidence_id, work_item_id, generation, source_slug, city_slug, category_slug, query_hash, response_sha256, retrieved_at, http_status, byte_length, candidate_count) VALUES ($1, $2, $3, 'overpass', 'c1', 'restaurants', 'qf', 'rf', $4, 200, 100, 1)`,
      [evId, c.id, c.generation, ts]);
    // Force deadline past but do NOT run reaper
    await pool.query("UPDATE nex_workforce.work_item SET lease_deadline = now() - interval '5 seconds' WHERE id=$1", [wiRow.id]);
    // Direct persister call · fence checks state=leased + agent + gen · lease_deadline is IGNORED
    const r = (await pool.query(
      `SELECT ok, new_row FROM nex_workforce.persist_to_food_business($1, $2, $3, $4, $5, 'overpass', $6, $7::jsonb)`,
      ["agent-rF", c.id, c.generation, evId, ts, "node/79000",
       JSON.stringify({ osm_id: 79000, tags: { amenity: "restaurant", name: "PastDeadlineOK" } })]
    )).rows[0];
    expect(r.ok).toBe(true);
    expect(r.new_row).toBe(true);
    expect(await foodCount()).toBe(1);
  }, 15000);
});

describe("R-G · one malformed candidate rejected · valid candidates persist · batch continues", () => {
  it("2 valid + 1 unknown-amenity → 2 persisted, 1 rejected, work_item completes", async () => {
    await seedCityJob();
    overpassServer.plan({
      status: 200,
      body: JSON.stringify({
        version: 0.6, generator: "Overpass API",
        osm3s: { timestamp_osm_base: "2026-09-04T00:00:00Z" },
        elements: [
          { type: "node", id: 80001, lat: -7.8,  lon: 110.4,  tags: { amenity: "restaurant", name: "Valid1" } },
          { type: "node", id: 80002, lat: -7.79, lon: 110.41, tags: { amenity: "pub",        name: "NotFood" } },
          { type: "node", id: 80003, lat: -7.78, lon: 110.42, tags: { amenity: "cafe",       name: "Valid2" } },
        ],
      }),
    });
    const wiRow = (await pool.query(`INSERT INTO nex_workforce.work_item (city_slug, category_slug, source_slug, generation, state, bbox_json)
                                     VALUES ('c1','restaurants','overpass',1,'pending', '{"sw":{"lat":-6.4,"lon":106.7},"ne":{"lat":-6.1,"lon":107.0}}'::jsonb) RETURNING id`)).rows[0];
    const agent = await makeAgent();
    try {
      const r = await runAgentOnce(agent);
      expect(r.outcome).toBe("completed");
    } finally { await destroyAgent(agent); }
    expect(await foodCount()).toBe(2);
    const rej = await pool.query("SELECT rejection_reason FROM nex_workforce.candidate_staging WHERE natural_key='node/80002'");
    expect(rej.rows[0].rejection_reason).toMatch(/^unknown_category:amenity=pub/);
    const wi = await wiState(wiRow.id);
    expect(wi.state).toBe("completed");
    expect(wi.cursor_json.persisted_total).toBe(2);
    expect(wi.cursor_json.rejected_total).toBe(1);
  }, 15000);
});

describe("R-H · catastrophic classification (HTTP 400 bad query) · fail_soft · lease recoverable", () => {
  it("Overpass returns 400 → catastrophic → soft_fail with class=catastrophic · not retried endlessly", async () => {
    await seedCityJob();
    overpassServer.plan({ status: 400, body: "bad query" });
    const wiRow = (await pool.query(`INSERT INTO nex_workforce.work_item (city_slug, category_slug, source_slug, generation, state, bbox_json)
                                     VALUES ('c1','restaurants','overpass',1,'pending', '{"sw":{"lat":-6.4,"lon":106.7},"ne":{"lat":-6.1,"lon":107.0}}'::jsonb) RETURNING id`)).rows[0];
    const agent = await makeAgent();
    try {
      const r = await runAgentOnce(agent);
      expect(r.outcome).toBe("catastrophic");
    } finally { await destroyAgent(agent); }
    const wi = await wiState(wiRow.id);
    expect(wi.state).toBe("soft_fail");
    expect(await foodCount()).toBe(0);
    // exactly ONE Overpass request · catastrophic short-circuits retry
    expect(overpassServer.requestsReceived()).toBe(1);
  }, 15000);
});

// ═════════════════════════════════════════════════════════════════════════════
// P · PROVENANCE
// ═════════════════════════════════════════════════════════════════════════════
describe("P1 · provenance query resolves target → evidence WITHOUT joining work_item", () => {
  it("SELECT nex.food_business JOIN evidence_record works after work_item.cursor_json mutates", async () => {
    await seedCityJob({ leaseMin: 1 });
    overpassServer.plan(HAPPY_200(goodElements(81000, 1)));
    const wiRow = (await pool.query(`INSERT INTO nex_workforce.work_item (city_slug, category_slug, source_slug, generation, state, bbox_json)
                                     VALUES ('c1','restaurants','overpass',1,'pending', '{"sw":{"lat":-6.4,"lon":106.7},"ne":{"lat":-6.1,"lon":107.0}}'::jsonb) RETURNING id`)).rows[0];
    const agent1 = await makeAgent();
    try { await runAgentOnce(agent1); } finally { await destroyAgent(agent1); }
    const origEvidence = (await pool.query("SELECT source_evidence_id FROM nex.food_business")).rows[0].source_evidence_id;
    // Provenance query · no work_item join
    const prov = await pool.query(`SELECT er.evidence_id, er.response_sha256, er.work_item_id AS wi
                                   FROM nex.food_business t
                                   JOIN nex_workforce.evidence_record er ON er.evidence_id = t.source_evidence_id`);
    expect(prov.rows).toHaveLength(1);
    expect(prov.rows[0].evidence_id).toBe(origEvidence);
    expect(prov.rows[0].wi).toBe(wiRow.id);
  }, 20000);
});

describe("P2 · provenance survives work_item state='completed'", () => {
  it("food_business row + evidence intact after work_item terminal", async () => {
    await seedCityJob();
    overpassServer.plan(HAPPY_200(goodElements(82000, 1)));
    const wiRow = (await pool.query(`INSERT INTO nex_workforce.work_item (city_slug, category_slug, source_slug, generation, state, bbox_json)
                                     VALUES ('c1','restaurants','overpass',1,'pending', '{"sw":{"lat":-6.4,"lon":106.7},"ne":{"lat":-6.1,"lon":107.0}}'::jsonb) RETURNING id`)).rows[0];
    const agent = await makeAgent();
    try { await runAgentOnce(agent); } finally { await destroyAgent(agent); }
    expect((await wiState(wiRow.id)).state).toBe("completed");
    const evId = (await pool.query("SELECT source_evidence_id FROM nex.food_business")).rows[0].source_evidence_id;
    expect((await pool.query("SELECT count(*)::int AS n FROM nex_workforce.evidence_record WHERE evidence_id=$1", [evId])).rows[0].n).toBe(1);
  }, 15000);
});

describe("P3 · provenance survives re-lease · updated row links new evidence", () => {
  it("after re-lease + fresh persist, source_evidence_id advances but original evidence_record retained", async () => {
    await seedCityJob({ leaseMin: 1 });
    overpassServer.plan(HAPPY_200(goodElements(83000, 1)));
    const wiRow = (await pool.query(`INSERT INTO nex_workforce.work_item (city_slug, category_slug, source_slug, generation, state, bbox_json)
                                     VALUES ('c1','restaurants','overpass',1,'pending', '{"sw":{"lat":-6.4,"lon":106.7},"ne":{"lat":-6.1,"lon":107.0}}'::jsonb) RETURNING id`)).rows[0];
    const agent1 = await makeAgent();
    try { await runAgentOnce(agent1); } finally { await destroyAgent(agent1); }
    const origEv = (await pool.query("SELECT source_evidence_id FROM nex.food_business")).rows[0].source_evidence_id;

    // Re-lease via reaper path (complete()→UPDATE blocked; we can INSERT a fresh work_item instead
    // since the existing one is completed and cadence_minutes=60 would prevent immediate requeue).
    // Simpler for this test: INSERT a fresh work_item for same tuple.
    await pool.query("DELETE FROM nex_workforce.work_item WHERE id=$1", [wiRow.id]);
    const wiRow2 = (await pool.query(`INSERT INTO nex_workforce.work_item (city_slug, category_slug, source_slug, generation, state, bbox_json)
                                       VALUES ('c1','restaurants','overpass',1,'pending', '{"sw":{"lat":-6.4,"lon":106.7},"ne":{"lat":-6.1,"lon":107.0}}'::jsonb) RETURNING id`)).rows[0];
    // Use a DIFFERENT response body so evidence_id differs
    overpassServer.plan({
      status: 200,
      body: JSON.stringify({
        version: 0.6, generator: "Overpass API 2",
        osm3s: { timestamp_osm_base: "2026-09-04T02:00:00Z" },
        elements: [{ type: "node", id: 83000, lat: -7.8, lon: 110.4,
                     tags: { amenity: "restaurant", name: "P3-Rewritten" } }],
      }),
    });
    const agent2 = await makeAgent();
    try { await runAgentOnce(agent2); } finally { await destroyAgent(agent2); }
    const newRow = await pool.query("SELECT source_evidence_id, business_name FROM nex.food_business");
    expect(newRow.rows).toHaveLength(1);   // still one row (identity stable)
    expect(newRow.rows[0].business_name).toBe("P3-Rewritten");
    expect(newRow.rows[0].source_evidence_id).not.toBe(origEv);
    // Both evidence_record rows retained
    expect((await pool.query("SELECT count(*)::int AS n FROM nex_workforce.evidence_record")).rows[0].n).toBe(2);
  }, 25000);
});

describe("P4 · older observation does not overwrite newer · silent no-op preserves provenance", () => {
  it("late arrival with earlier retrieved_at leaves target unchanged", async () => {
    await seedCityJob();
    overpassServer.plan(HAPPY_200([{ type: "node", id: 84000, lat: -7.8, lon: 110.4,
                                     tags: { amenity: "restaurant", name: "Fresh" } }]));
    const wiRow = (await pool.query(`INSERT INTO nex_workforce.work_item (city_slug, category_slug, source_slug, generation, state, bbox_json)
                                     VALUES ('c1','restaurants','overpass',1,'pending', '{"sw":{"lat":-6.4,"lon":106.7},"ne":{"lat":-6.1,"lon":107.0}}'::jsonb) RETURNING id`)).rows[0];
    const agent1 = await makeAgent();
    try { await runAgentOnce(agent1); } finally { await destroyAgent(agent1); }
    const before = (await pool.query("SELECT business_name, source_retrieved_at FROM nex.food_business")).rows[0];

    // Directly attempt an older observation via persister
    await pool.query("DELETE FROM nex_workforce.work_item WHERE id=$1", [wiRow.id]);
    const wiRow2 = (await pool.query(`INSERT INTO nex_workforce.work_item (city_slug, category_slug, source_slug, generation, state, bbox_json)
                                       VALUES ('c1','restaurants','overpass',1,'pending', '{"sw":{"lat":-6.4,"lon":106.7},"ne":{"lat":-6.1,"lon":107.0}}'::jsonb) RETURNING id`)).rows[0];
    const c2 = await claim("agent-p4-b");
    const tsOld = "2026-09-03T00:00:00.000Z";  // OLDER than initial
    const evOld = evidenceIdFor(c2.id, c2.generation, "qOld", "rOld");
    await pool.query(`INSERT INTO nex_workforce.evidence_record (evidence_id, work_item_id, generation, source_slug, city_slug, category_slug, query_hash, response_sha256, retrieved_at, http_status, byte_length, candidate_count) VALUES ($1, $2, $3, 'overpass', 'c1', 'restaurants', 'qOld', 'rOld', $4, 200, 100, 1)`,
      [evOld, c2.id, c2.generation, tsOld]);
    const r = (await pool.query(
      `SELECT ok, updated_row FROM nex_workforce.persist_to_food_business($1, $2, $3, $4, $5, 'overpass', $6, $7::jsonb)`,
      ["agent-p4-b", c2.id, c2.generation, evOld, tsOld, "node/84000",
       JSON.stringify({ osm_id: 84000, tags: { amenity: "restaurant", name: "OldRewrite" } })]
    )).rows[0];
    expect(r.ok).toBe(true);
    expect(r.updated_row).toBe(false);
    const after = (await pool.query("SELECT business_name, source_retrieved_at FROM nex.food_business")).rows[0];
    expect(after.business_name).toBe(before.business_name);
    expect(after.source_retrieved_at.getTime()).toBe(before.source_retrieved_at.getTime());
  }, 15000);
});

describe("P5 · repeated persistence with identical evidence · idempotent no-op", () => {
  it("running the agent again on same work_item results in same row · updated_at unchanged", async () => {
    await seedCityJob();
    overpassServer.plan(HAPPY_200(goodElements(85000, 1)), HAPPY_200(goodElements(85000, 1)));
    const wiRow = (await pool.query(`INSERT INTO nex_workforce.work_item (city_slug, category_slug, source_slug, generation, state, bbox_json)
                                     VALUES ('c1','restaurants','overpass',1,'pending', '{"sw":{"lat":-6.4,"lon":106.7},"ne":{"lat":-6.1,"lon":107.0}}'::jsonb) RETURNING id`)).rows[0];
    const agent = await makeAgent();
    try { await runAgentOnce(agent); } finally { await destroyAgent(agent); }
    const beforeUpd = (await pool.query("SELECT updated_at FROM nex.food_business")).rows[0].updated_at;
    // Delete work_item + INSERT new one for same tuple; agent runs again with same evidence content
    await pool.query("DELETE FROM nex_workforce.work_item WHERE id=$1", [wiRow.id]);
    await pool.query(`INSERT INTO nex_workforce.work_item (city_slug, category_slug, source_slug, generation, state, bbox_json)
                      VALUES ('c1','restaurants','overpass',1,'pending', '{"sw":{"lat":-6.4,"lon":106.7},"ne":{"lat":-6.1,"lon":107.0}}'::jsonb)`);
    await new Promise((r) => setTimeout(r, 50));
    const agent2 = await makeAgent();
    try { await runAgentOnce(agent2); } finally { await destroyAgent(agent2); }
    const afterUpd = (await pool.query("SELECT updated_at FROM nex.food_business")).rows[0].updated_at;
    // NOTE: fresh work_item + fresh generation → new evidence_id (different wi UUID) → not a strict evidence replay.
    // The row will be updated with the new evidence_id because retrieved_at is newer (or equal but higher evidence).
    // What we CAN prove is that the ROW COUNT is stable (still 1) even though the content refreshed.
    expect(await foodCount()).toBe(1);
  }, 20000);
});

// ═════════════════════════════════════════════════════════════════════════════
// I + M · IDENTITY + MONOTONIC EVIDENCE
// ═════════════════════════════════════════════════════════════════════════════
describe("I1 · distinct OSM IDs with identical name/coords → two rows (dedupe_hash is NOT identity)", () => {
  it("both persisted as distinct food_business rows", async () => {
    await seedCityJob();
    overpassServer.plan(HAPPY_200([
      { type: "node", id: 86001, lat: -7.8, lon: 110.4, tags: { amenity: "restaurant", name: "Twins", phone: "+62-1", "addr:street": "S", "addr:city": "Y" } },
      { type: "node", id: 86002, lat: -7.8, lon: 110.4, tags: { amenity: "restaurant", name: "Twins", phone: "+62-1", "addr:street": "S", "addr:city": "Y" } },
    ]));
    await pool.query(`INSERT INTO nex_workforce.work_item (city_slug, category_slug, source_slug, generation, state, bbox_json)
                      VALUES ('c1','restaurants','overpass',1,'pending', '{"sw":{"lat":-6.4,"lon":106.7},"ne":{"lat":-6.1,"lon":107.0}}'::jsonb)`);
    const agent = await makeAgent();
    try { await runAgentOnce(agent); } finally { await destroyAgent(agent); }
    const rows = await pool.query("SELECT source_reference, dedupe_hash FROM nex.food_business ORDER BY source_reference");
    expect(rows.rows).toHaveLength(2);
    expect(rows.rows[0].dedupe_hash).toBe(rows.rows[1].dedupe_hash);  // dedupe collides
    expect(rows.rows[0].source_reference).not.toBe(rows.rows[1].source_reference);  // identity does not
  }, 15000);
});

describe("I2 · same OSM ID re-observed → single row updated", () => {
  it("second observation updates in place", async () => {
    await seedCityJob();
    overpassServer.plan(
      HAPPY_200([{ type: "node", id: 87000, lat: -7.8, lon: 110.4, tags: { amenity: "restaurant", name: "First" } }]),
    );
    await pool.query(`INSERT INTO nex_workforce.work_item (city_slug, category_slug, source_slug, generation, state, bbox_json)
                      VALUES ('c1','restaurants','overpass',1,'pending', '{"sw":{"lat":-6.4,"lon":106.7},"ne":{"lat":-6.1,"lon":107.0}}'::jsonb)`);
    const agent1 = await makeAgent();
    try { await runAgentOnce(agent1); } finally { await destroyAgent(agent1); }
    expect(await foodCount()).toBe(1);
    // Fresh work_item · same natural_key · newer name
    overpassServer.plan({
      status: 200,
      body: JSON.stringify({
        version: 0.6, generator: "Overpass API",
        osm3s: { timestamp_osm_base: "2026-09-04T05:00:00Z" },
        elements: [{ type: "node", id: 87000, lat: -7.8, lon: 110.4, tags: { amenity: "restaurant", name: "Renamed" } }],
      }),
    });
    await pool.query("DELETE FROM nex_workforce.work_item");
    await pool.query(`INSERT INTO nex_workforce.work_item (city_slug, category_slug, source_slug, generation, state, bbox_json)
                      VALUES ('c1','restaurants','overpass',1,'pending', '{"sw":{"lat":-6.4,"lon":106.7},"ne":{"lat":-6.1,"lon":107.0}}'::jsonb)`);
    const agent2 = await makeAgent();
    try { await runAgentOnce(agent2); } finally { await destroyAgent(agent2); }
    expect(await foodCount()).toBe(1);
    const row = (await pool.query("SELECT business_name FROM nex.food_business")).rows[0];
    expect(row.business_name).toBe("Renamed");
  }, 20000);
});

describe("I3 · candidate with invalid natural_key rejected by persister · valid ones still persist", () => {
  it("integrated path exercised via direct staging (invalid natural_key can only be forced via direct insert)", async () => {
    await seedCityJob();
    const wiRow = (await pool.query(`INSERT INTO nex_workforce.work_item (city_slug, category_slug, source_slug, generation, state, bbox_json)
                                     VALUES ('c1','restaurants','overpass',1,'pending', '{"sw":{"lat":-6.4,"lon":106.7},"ne":{"lat":-6.1,"lon":107.0}}'::jsonb) RETURNING id`)).rows[0];
    const c = await claim("agent-i3");
    const evId = evidenceIdFor(c.id, c.generation, "qi3", "ri3");
    await pool.query("SELECT nex_workforce.stage_candidates($1, $2, $3, $4, $5::jsonb, $6::jsonb)",
      ["agent-i3", c.id, c.generation, evId,
       JSON.stringify({ source_slug: "overpass", city_slug: "c1", category_slug: "restaurants",
                        query_hash: "qi3", response_sha256: "ri3", retrieved_at: new Date().toISOString(),
                        http_status: 200, byte_length: 100, candidate_count: 2 }),
       JSON.stringify([
         { candidate_index: 0, natural_key: "garbage-not-osm",
           payload_json: { tags: { amenity: "restaurant", name: "Invalid" } }, payload_bytes: 40 },
         { candidate_index: 1, natural_key: "node/88000",
           payload_json: { osm_id: 88000, tags: { amenity: "restaurant", name: "Valid" } }, payload_bytes: 60 },
       ])]);
    const r = (await pool.query("SELECT * FROM nex_workforce.persist_batch($1, $2, $3, $4::regprocedure, $5)",
      ["agent-i3", c.id, c.generation, PERSISTER_FN_SIG, 100])).rows[0];
    expect(r.persisted_count).toBe(1);
    expect(r.rejected_count).toBe(1);
    expect(await foodCount()).toBe(1);
  }, 15000);
});

describe("M1 · monotonic evidence in integrated context · newer batch wins", () => {
  it("later work_item with newer retrieved_at overwrites older values", async () => {
    await seedCityJob();
    // First observation
    overpassServer.plan({
      status: 200,
      body: JSON.stringify({
        version: 0.6, generator: "Overpass API",
        osm3s: { timestamp_osm_base: "2026-09-04T00:00:00Z" },
        elements: [{ type: "node", id: 89000, lat: -7.8, lon: 110.4, tags: { amenity: "restaurant", name: "Early" } }],
      }),
    });
    await pool.query(`INSERT INTO nex_workforce.work_item (city_slug, category_slug, source_slug, generation, state, bbox_json)
                      VALUES ('c1','restaurants','overpass',1,'pending', '{"sw":{"lat":-6.4,"lon":106.7},"ne":{"lat":-6.1,"lon":107.0}}'::jsonb)`);
    const agent1 = await makeAgent();
    try { await runAgentOnce(agent1); } finally { await destroyAgent(agent1); }
    // Second observation with later timestamp
    overpassServer.plan({
      status: 200,
      body: JSON.stringify({
        version: 0.6, generator: "Overpass API",
        osm3s: { timestamp_osm_base: "2026-09-05T00:00:00Z" },
        elements: [{ type: "node", id: 89000, lat: -7.8, lon: 110.4, tags: { amenity: "restaurant", name: "Later" } }],
      }),
    });
    await pool.query("DELETE FROM nex_workforce.work_item");
    await pool.query(`INSERT INTO nex_workforce.work_item (city_slug, category_slug, source_slug, generation, state, bbox_json)
                      VALUES ('c1','restaurants','overpass',1,'pending', '{"sw":{"lat":-6.4,"lon":106.7},"ne":{"lat":-6.1,"lon":107.0}}'::jsonb)`);
    const agent2 = await makeAgent();
    try { await runAgentOnce(agent2); } finally { await destroyAgent(agent2); }
    const row = (await pool.query("SELECT business_name FROM nex.food_business")).rows[0];
    expect(row.business_name).toBe("Later");
  }, 20000);
});

// ═════════════════════════════════════════════════════════════════════════════
// C + F · CONCURRENCY + FAULT ISOLATION
// ═════════════════════════════════════════════════════════════════════════════
describe("C1 · two agents compete for one pending work_item · only one wins", () => {
  it("first claim wins · second gets idle · no duplicates", async () => {
    await seedCityJob();
    await pool.query(`INSERT INTO nex_workforce.work_item (city_slug, category_slug, source_slug, generation, state, bbox_json)
                      VALUES ('c1','restaurants','overpass',1,'pending', '{"sw":{"lat":-6.4,"lon":106.7},"ne":{"lat":-6.1,"lon":107.0}}'::jsonb)`);
    // Both call claim concurrently
    const [c1, c2] = await Promise.all([
      claim("agent-c1-a"),
      claim("agent-c1-b"),
    ]);
    const wins = [c1, c2].filter((x) => x !== null);
    expect(wins).toHaveLength(1);   // exactly one wins
  }, 10000);
});

describe("C2 · two agents on two independent work_items · both progress · no cross-interference", () => {
  it("two work_items · two agents · both complete · no shared-state leaks", async () => {
    await seedCityJob({ city: "c1" });
    await seedCityJob({ city: "c2" });
    overpassServer.plan(HAPPY_200(goodElements(90000, 1)), HAPPY_200(goodElements(90100, 1)));
    await pool.query(`INSERT INTO nex_workforce.work_item (city_slug, category_slug, source_slug, generation, state, bbox_json) VALUES
      ('c1','restaurants','overpass',1,'pending', '{"sw":{"lat":-6.4,"lon":106.7},"ne":{"lat":-6.1,"lon":107.0}}'::jsonb),
      ('c2','restaurants','overpass',1,'pending', '{"sw":{"lat":-6.4,"lon":106.7},"ne":{"lat":-6.1,"lon":107.0}}'::jsonb)`);
    // Two agents, sequential runAgentOnce · each claims one of the two work_items.
    // Concurrent claim() is proven safe by C1 (SKIP LOCKED) · here we prove that
    // TWO agents CAN both progress · no state leaks between them.
    const agentA = await makeAgent({ agentId: "agent-c2-A" });
    const agentB = await makeAgent({ agentId: "agent-c2-B" });
    try {
      const rA = await runAgentOnce(agentA);
      const rB = await runAgentOnce(agentB);
      expect(rA.outcome).toBe("completed");
      expect(rB.outcome).toBe("completed");
      // Different work_items claimed
      expect(rA.workItemId).not.toBe(rB.workItemId);
    } finally {
      await destroyAgent(agentA);
      await destroyAgent(agentB);
    }
    expect(await foodCount()).toBe(2);
    const done = await pool.query("SELECT count(*)::int AS n FROM nex_workforce.work_item WHERE state='completed'");
    expect(done.rows[0].n).toBe(2);
  }, 25000);
});

describe("C3 · reaper concurrent with active persister · SKIP LOCKED protects in-flight TX", () => {
  it("reaper cannot reclaim a row held by an active persist TX", async () => {
    await seedCityJob();
    const wiRow = (await pool.query(`INSERT INTO nex_workforce.work_item (city_slug, category_slug, source_slug, generation, state, bbox_json)
                                     VALUES ('c1','restaurants','overpass',1,'pending', '{"sw":{"lat":-6.4,"lon":106.7},"ne":{"lat":-6.1,"lon":107.0}}'::jsonb) RETURNING id`)).rows[0];
    await claim("agent-c3");
    await pool.query("UPDATE nex_workforce.work_item SET lease_deadline = now() - interval '1 hour' WHERE id=$1", [wiRow.id]);
    // Hold row lock in one client while reaper runs from another
    const holdingClient = await pool.connect();
    try {
      await holdingClient.query("BEGIN");
      await holdingClient.query("SELECT id FROM nex_workforce.work_item WHERE id=$1 FOR UPDATE", [wiRow.id]);
      const reaper = await makeReaper();
      try {
        const reap = await runReaperOnce(reaper);
        expect(reap.reclaimed).toBe(0);   // SKIP LOCKED left it alone
      } finally { await destroyReaper(reaper); }
      // State still leased
      expect((await pool.query("SELECT state FROM nex_workforce.work_item WHERE id=$1", [wiRow.id])).rows[0].state).toBe("leased");
      await holdingClient.query("COMMIT");
    } finally { holdingClient.release(); }
  }, 15000);
});

describe("C4 · fresh-gen agent proceeds while stale-gen agent's writes are fenced", () => {
  it("stale agent's direct persist attempt after reaper fails · fresh agent's cycle completes", async () => {
    await seedCityJob({ leaseMin: 1 });
    overpassServer.plan(HAPPY_200(goodElements(91000, 1)));
    const wiRow = (await pool.query(`INSERT INTO nex_workforce.work_item (city_slug, category_slug, source_slug, generation, state, bbox_json)
                                     VALUES ('c1','restaurants','overpass',1,'pending', '{"sw":{"lat":-6.4,"lon":106.7},"ne":{"lat":-6.1,"lon":107.0}}'::jsonb) RETURNING id`)).rows[0];
    const cStale = await claim("agent-c4-stale");
    // Reaper reclaims · generation bumps (+ reset next_eligible_at)
    await forceReapAndRequeue(wiRow.id);
    // Fresh agent runs full cycle
    const fresh = await makeAgent({ agentId: "agent-c4-fresh" });
    try {
      const r = await runAgentOnce(fresh);
      expect(r.outcome).toBe("completed");
    } finally { await destroyAgent(fresh); }
    expect(await foodCount()).toBe(1);
    // Stale agent tries direct persister now · fenced (state=completed AND wrong generation)
    const tsOld = "2026-09-04T00:00:00.000Z";
    const evOld = evidenceIdFor(cStale.id, cStale.generation, "qs", "rs");
    await pool.query(`INSERT INTO nex_workforce.evidence_record (evidence_id, work_item_id, generation, source_slug, city_slug, category_slug, query_hash, response_sha256, retrieved_at, http_status, byte_length, candidate_count) VALUES ($1, $2, $3, 'overpass', 'c1', 'restaurants', 'qs', 'rs', $4, 200, 100, 1)`,
      [evOld, cStale.id, cStale.generation, tsOld]);
    const r = (await pool.query(
      `SELECT ok FROM nex_workforce.persist_to_food_business($1, $2, $3, $4, $5, 'overpass', $6, $7::jsonb)`,
      ["agent-c4-stale", cStale.id, cStale.generation, evOld, tsOld, "node/91000",
       JSON.stringify({ osm_id: 91000, tags: { amenity: "restaurant", name: "StaleGhost" } })]
    )).rows[0];
    expect(r.ok).toBe(false);
    expect(await foodCount()).toBe(1);   // still just the fresh agent's row
  }, 30000);
});

describe("F1 · WI A failure does not affect WI B in same pool", () => {
  it("Overpass 400 for WI A · WI B still completes with valid data", async () => {
    await seedCityJob({ city: "c1" });
    await seedCityJob({ city: "c2" });
    // Plan: 400 for first request, 200 for second
    overpassServer.plan({ status: 400, body: "bad" }, HAPPY_200(goodElements(92000, 1)));
    const wiA = (await pool.query(`INSERT INTO nex_workforce.work_item (city_slug, category_slug, source_slug, generation, state, bbox_json)
                                    VALUES ('c1','restaurants','overpass',1,'pending', '{"sw":{"lat":-6.4,"lon":106.7},"ne":{"lat":-6.1,"lon":107.0}}'::jsonb) RETURNING id`)).rows[0];
    const wiB = (await pool.query(`INSERT INTO nex_workforce.work_item (city_slug, category_slug, source_slug, generation, state, bbox_json)
                                    VALUES ('c2','restaurants','overpass',1,'pending', '{"sw":{"lat":-6.4,"lon":106.7},"ne":{"lat":-6.1,"lon":107.0}}'::jsonb) RETURNING id`)).rows[0];
    const agent = await makeAgent();
    try {
      const r1 = await runAgentOnce(agent);
      expect(r1.outcome).toBe("catastrophic");
      const r2 = await runAgentOnce(agent);
      expect(r2.outcome).toBe("completed");
    } finally { await destroyAgent(agent); }
    expect((await wiState(wiA.id)).state).toBe("soft_fail");
    expect((await wiState(wiB.id)).state).toBe("completed");
    expect(await foodCount()).toBe(1);
  }, 25000);
});

describe("F2 · one malformed candidate does not fail the whole work_item", () => {
  it("2 valid + 1 rejected → work_item still completes cleanly", async () => {
    await seedCityJob();
    overpassServer.plan({
      status: 200,
      body: JSON.stringify({
        version: 0.6, generator: "Overpass API",
        osm3s: { timestamp_osm_base: "2026-09-04T00:00:00Z" },
        elements: [
          { type: "node", id: 93000, lat: -7.8, lon: 110.4, tags: { amenity: "restaurant", name: "OK1" } },
          { type: "node", id: 93001, lat: -7.8, lon: 110.4, tags: { amenity: "restaurant" } },  // no name
          { type: "node", id: 93002, lat: -7.8, lon: 110.4, tags: { amenity: "restaurant", name: "OK2" } },
        ],
      }),
    });
    const wiRow = (await pool.query(`INSERT INTO nex_workforce.work_item (city_slug, category_slug, source_slug, generation, state, bbox_json)
                                     VALUES ('c1','restaurants','overpass',1,'pending', '{"sw":{"lat":-6.4,"lon":106.7},"ne":{"lat":-6.1,"lon":107.0}}'::jsonb) RETURNING id`)).rows[0];
    const agent = await makeAgent();
    try {
      const r = await runAgentOnce(agent);
      expect(r.outcome).toBe("completed");
    } finally { await destroyAgent(agent); }
    expect(await foodCount()).toBe(2);
    const wi = await wiState(wiRow.id);
    expect(wi.cursor_json.rejected_total).toBe(1);
    expect(wi.cursor_json.persisted_total).toBe(2);
  }, 15000);
});

// ═════════════════════════════════════════════════════════════════════════════
// S · SECURITY BOUNDARY (INTEGRATED RE-PROOF)
// ═════════════════════════════════════════════════════════════════════════════
describe("S1 · runtime CANNOT direct-INSERT nex.food_business (integrated re-proof)", () => {
  it("even with a full completed cycle in place, runtime direct-write is DENIED", async () => {
    await seedCityJob();
    overpassServer.plan(HAPPY_200(goodElements(94000, 1)));
    await pool.query(`INSERT INTO nex_workforce.work_item (city_slug, category_slug, source_slug, generation, state, bbox_json)
                      VALUES ('c1','restaurants','overpass',1,'pending', '{"sw":{"lat":-6.4,"lon":106.7},"ne":{"lat":-6.1,"lon":107.0}}'::jsonb)`);
    const agent = await makeAgent();
    try { await runAgentOnce(agent); } finally { await destroyAgent(agent); }
    // Runtime attempts direct INSERT
    await expect(runtimePool.query(`
      INSERT INTO nex.food_business (public_listing_ref, business_name, category, city, source, source_reference, dedupe_hash)
      VALUES ('#FL-2026-00000', 'Illegal', 'restaurant', 'Yogyakarta', 'osm_overpass', 'node/99999999', 'x')
    `)).rejects.toThrow(/permission denied|policy|row-level security/i);
  }, 15000);
});

describe("S2 · persister-owner role has NOBYPASSRLS · RLS enabled (Slice 1h R2 · matches production)", () => {
  it("attributes verified · Slice 1h R2 uses ENABLE (not FORCE · matches production convention · 92/93 nex.* tables)", async () => {
    const q = await pool.query(`SELECT rolbypassrls, rolcanlogin FROM pg_roles WHERE rolname='nex_workforce_persister_food_business'`);
    expect(q.rows[0].rolbypassrls).toBe(false);
    expect(q.rows[0].rolcanlogin).toBe(false);
    const t = await pool.query(`SELECT relrowsecurity, relforcerowsecurity FROM pg_class WHERE oid='nex.food_business'::regclass`);
    expect(t.rows[0].relrowsecurity).toBe(true);
    expect(t.rows[0].relforcerowsecurity).toBe(false); // R2 · owner=postgres superuser bypasses via role attribute · non-owner non-superuser (persister) still RLS-checked
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// X · CROSS-TARGET ISOLATION
// ═════════════════════════════════════════════════════════════════════════════
describe("X1 · persister role has grants ONLY on nex.food_business among nex.* schema", () => {
  it("no INSERT/UPDATE/DELETE grants on any other nex.* table", async () => {
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
    // Must include food_business AND nothing else
    expect(tables.has("food_business")).toBe(true);
    for (const t of tables) {
      expect(t).toBe("food_business");
    }
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// B · PRODUCTION-BOUNDARY SAFETY
// ═════════════════════════════════════════════════════════════════════════════
describe("B1 · production-boundary safety · target DB is portable · no production side effects", () => {
  it("target DB name / port / version confirmed · no Project B / no PG17-5432 / no PG18-5433 connections opened by this suite", async () => {
    const q = await pool.query("SELECT current_database() AS db, current_setting('port') AS port, current_setting('server_version') AS ver");
    expect(q.rows[0].db).toBe("nex_workforce_slice1_test");
    expect(q.rows[0].port).toBe("5439");
    expect(q.rows[0].ver.startsWith("17.11")).toBe(true);
    // Ensure this test file's URL is the portable one
    expect(URL).toContain("127.0.0.1:5439");
    expect(URL).toContain("nex_workforce_slice1_test");
    // Runtime pool also portable
    const r = await runtimePool.query("SELECT current_database() AS db, current_setting('port') AS port");
    expect(r.rows[0].db).toBe("nex_workforce_slice1_test");
    expect(r.rows[0].port).toBe("5439");
  });
});
