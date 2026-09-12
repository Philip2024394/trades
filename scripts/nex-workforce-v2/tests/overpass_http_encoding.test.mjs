// NEX Workforce v2 · Slice 5 (Gate 5A HTTP-layer fix) · fetchOverpass encoding tests
// ─────────────────────────────────────────────────────────────────────────────
// Verifies the Gate 5A HTTP-layer fix in scripts/nex-workforce-v2/steps/
// overpass_observe_and_stage.mjs · specifically that the HTTP request:
//   1. Uses POST
//   2. Declares content-type: application/x-www-form-urlencoded
//   3. Actually sends form-encoded body `data=<URL-encoded query>`
//   4. Preserves the exact captured bbox in the query (no whole-world literal)
//   5. Includes an explicit User-Agent
//   6. HTTP 406 does NOT enter an infinite retry loop (classified catastrophic
//      per NEX HTTP 4xx doctrine · fail_soft not TRANSIENT_EXHAUSTED)
//
// The mock Overpass server (support/mock_overpass.mjs) records the request
// body in requestLog · we introspect that to verify encoding + query content.

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from "vitest";
import pg from "pg";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createAgent, destroyAgent, runAgentOnce } from "../agent.mjs";
import * as StepRegistry from "../lib/step_registry.mjs";
import * as SourceRate from "../lib/sources_rate.mjs";
import * as overpassObserveAndStage from "../steps/overpass_observe_and_stage.mjs";
import { startMockOverpass } from "./support/mock_overpass.mjs";

const CONN = { host: "127.0.0.1", port: 5439, user: "postgres", database: "nex_workforce_slice1_test" };
const URL  = `postgres://postgres@127.0.0.1:5439/nex_workforce_slice1_test`;

const YOGYA_BBOX = { sw: { lat: -7.82, lon: 106.7 }, ne: { lat: -7.77, lon: 106.75 } };  // 0.05° × 0.05°

const HAPPY_200 = () => ({
  status: 200,
  body: JSON.stringify({
    version: 0.6, generator: "Overpass API",
    osm3s: { timestamp_osm_base: "2026-09-04T00:00:00Z" },
    elements: [
      { type: "node", id: 1001, lat: -7.795, lon: 110.365, tags: { amenity: "restaurant", name: "Warung Test" } },
    ],
  }),
});

let pool;
let overpassServer;
const silent = () => {};

beforeAll(async () => {
  pool = new pg.Pool({ ...CONN, max: 4 });
  overpassServer = await startMockOverpass();
  process.env.NEX_OVERPASS_URL   = overpassServer.url;
  process.env.NEX_PERSISTER_FN   = "nex_workforce.mock_persist_target(text,uuid,integer,text,timestamptz,text,text,jsonb)";

  // Mock target + persister (Slice 1g portable fixture pattern)
  await pool.query(`CREATE TABLE IF NOT EXISTS nex_workforce.mock_target (
    pk text PRIMARY KEY, source_slug text NOT NULL, natural_key text NOT NULL,
    source_evidence_id text NOT NULL, source_retrieved_at timestamptz NOT NULL,
    source_work_item_id uuid NOT NULL, source_generation integer NOT NULL,
    payload_json jsonb NOT NULL,
    first_seen_at timestamptz NOT NULL DEFAULT now(),
    last_updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (source_slug, natural_key))`);
  await pool.query(`CREATE OR REPLACE FUNCTION nex_workforce.mock_persist_target(
    p_agent_id text, p_work_item_id uuid, p_generation integer,
    p_evidence_id text, p_retrieved_at timestamptz, p_source_slug text,
    p_natural_key text, p_payload_json jsonb)
  RETURNS TABLE(ok boolean, target_pk text, new_row boolean, updated_row boolean, rejected boolean, rejection_reason text) AS $$
  BEGIN
    INSERT INTO nex_workforce.mock_target (pk, source_slug, natural_key, source_evidence_id,
      source_retrieved_at, source_work_item_id, source_generation, payload_json)
    VALUES (p_source_slug||'::'||p_natural_key, p_source_slug, p_natural_key, p_evidence_id,
      p_retrieved_at, p_work_item_id, p_generation, p_payload_json)
    ON CONFLICT (source_slug, natural_key) DO NOTHING;
    RETURN QUERY SELECT true, (p_source_slug||'::'||p_natural_key), true, false, false, NULL::text;
  END $$ LANGUAGE plpgsql`);
});

afterAll(async () => {
  if (overpassServer) { await overpassServer.stop(); overpassServer = null; }
  delete process.env.NEX_OVERPASS_URL;
  delete process.env.NEX_PERSISTER_FN;
  if (pool) await pool.end();
});

beforeEach(async () => {
  await pool.query("TRUNCATE nex_workforce.mock_target");
  await pool.query("TRUNCATE nex_workforce.persist_audit");
  await pool.query("TRUNCATE nex_workforce.candidate_staging");
  await pool.query("TRUNCATE nex_workforce.evidence_record CASCADE");
  await pool.query("TRUNCATE nex_workforce.work_item_dead_letter, nex_workforce.work_item, nex_workforce.agent_heartbeat, nex_workforce.reaper_run RESTART IDENTITY CASCADE");
  await pool.query("DELETE FROM nex_workforce.job_registry");
  await pool.query("DELETE FROM nex_workforce.city_catalogue");
  StepRegistry._resetForTests();
  // Tests bypass agent.main() so must register the capability directly
  StepRegistry.register("restaurants", "overpass", overpassObserveAndStage);
  SourceRate._resetForTests();
  overpassServer.reset();
  await pool.query(`INSERT INTO nex_workforce.city_catalogue (slug, name, enabled, priority, bbox_json)
    VALUES ('c1', 'C1', true, 100, $1::jsonb)`, [JSON.stringify(YOGYA_BBOX)]);
  await pool.query(`INSERT INTO nex_workforce.job_registry
    (slug, category_slug, source_slug, cadence_minutes, max_concurrent_per_source, max_attempts, lease_minutes, enabled, priority)
    VALUES ('r-o','restaurants','overpass',60,10,3,15,true,100)`);
});

async function seedPending() {
  const r = await pool.query(
    `INSERT INTO nex_workforce.work_item (city_slug, category_slug, source_slug, generation, state, bbox_json)
     VALUES ('c1','restaurants','overpass', 1, 'pending', $1::jsonb) RETURNING id`,
    [JSON.stringify(YOGYA_BBOX)]);
  return r.rows[0].id;
}
async function makeAgent(overrides = {}) {
  return createAgent({ url: URL, pollMs: 30, heartbeatMsOverride: 150, logger: silent, poolMax: 3, ...overrides });
}

// ═══════════════════════════════════════════════════════════════════════════
// A · Request uses POST + declares form-urlencoded + body IS form-encoded
// ═══════════════════════════════════════════════════════════════════════════
describe("Slice 5 · A · fetchOverpass sends POST + form-urlencoded body containing exactly `data=<URL-encoded query>`", () => {
  it("mock server receives POST · body starts with `data=` · decoding reconstructs the exact Overpass QL", async () => {
    overpassServer.plan(HAPPY_200());
    const id = await seedPending();
    const agent = await makeAgent();
    try {
      const r = await runAgentOnce(agent);
      expect(r.outcome).toBe("completed");
    } finally { await destroyAgent(agent); }

    const log = overpassServer.requestLog();
    expect(log.length).toBe(1);
    expect(log[0].method).toBe("POST");
    // Body form-encoded shape: `data=<encoded>`
    expect(log[0].body.startsWith("data=")).toBe(true);
    const encoded = log[0].body.slice("data=".length);
    const decoded = decodeURIComponent(encoded);
    // Decoded QL contains the bounded bbox exactly · no widening
    expect(decoded).toContain(`[out:json][timeout:60]`);
    expect(decoded).toContain(`node["amenity"="restaurant"](-7.82,106.7,-7.77,106.75);out center;`);
    // Explicit prohibitions
    expect(decoded).not.toContain("-90,-180,90,180");
    expect(decoded).not.toMatch(/\(-90,-180,90,180\)/);
  }, 15000);
});

// ═══════════════════════════════════════════════════════════════════════════
// B · Exact bounded bbox preserved · no whole-world literal
// ═══════════════════════════════════════════════════════════════════════════
describe("Slice 5 · B · captured bounded bbox flows verbatim into the HTTP body · zero fallback", () => {
  it("body contains only the specific Yogyakarta bbox coordinates · never `-90,-180,90,180`", async () => {
    overpassServer.plan(HAPPY_200());
    const id = await seedPending();
    const agent = await makeAgent();
    try {
      await runAgentOnce(agent);
    } finally { await destroyAgent(agent); }
    const bodies = overpassServer.requestLog().map(r => decodeURIComponent(r.body.replace(/^data=/, "")));
    for (const b of bodies) {
      expect(b).not.toMatch(/\(-90(?:,|\.\d)/);      // no southern-pole bbox literal
      expect(b).not.toMatch(/-180[,)]/);              // no western meridian literal
      expect(b).toContain("-7.82,106.7,-7.77,106.75"); // exact captured bbox
    }
  }, 15000);
});

// ═══════════════════════════════════════════════════════════════════════════
// C · Explicit User-Agent header is sent
// ═══════════════════════════════════════════════════════════════════════════
describe("Slice 5 · C · request carries an explicit sensible User-Agent (Overpass policy)", () => {
  it("User-Agent header present and starts with `nex-workforce/`", async () => {
    // Capture headers via a spy on globalThis.fetch. Restore after.
    const realFetch = globalThis.fetch;
    let capturedInit = null;
    globalThis.fetch = async (u, init) => {
      capturedInit = init;
      return realFetch(u, init);
    };
    try {
      overpassServer.plan(HAPPY_200());
      const id = await seedPending();
      const agent = await makeAgent();
      try { await runAgentOnce(agent); }
      finally { await destroyAgent(agent); }
    } finally { globalThis.fetch = realFetch; }

    expect(capturedInit).not.toBeNull();
    const headers = capturedInit.headers ?? {};
    // Normalize headers to lower-case keys
    const lc = Object.fromEntries(Object.entries(headers).map(([k,v]) => [String(k).toLowerCase(), v]));
    expect(lc["content-type"]).toBe("application/x-www-form-urlencoded");
    expect(String(lc["user-agent"] ?? "").startsWith("nex-workforce/")).toBe(true);
  }, 15000);
});

// ═══════════════════════════════════════════════════════════════════════════
// D · HTTP 406 does NOT create an infinite retry loop
//   per NEX HTTP 4xx doctrine (2026-09-04) · 4xx-except-429/408 = capability
//   defect · fail_soft to operator-visible terminal · NEVER TRANSIENT.
// ═══════════════════════════════════════════════════════════════════════════
describe("Slice 5 · D · HTTP 406 fails closed (catastrophic → fail_soft) · no infinite retry", () => {
  it("single 406 response · agent classifies catastrophic · work_item terminal in soft_fail · NOT retried under this attempt", async () => {
    // Queue ONLY ONE 406 response · if the agent retries, subsequent requests would
    // hit "no plan step" (mock's default 500) which we'd see in the log.
    overpassServer.plan({ status: 406, body: '<osm3s>Overpass says: not acceptable</osm3s>' });
    const id = await seedPending();
    const agent = await makeAgent();
    try {
      const r = await runAgentOnce(agent);
      // The capability's classifier lacks an explicit 406 rule · default =
      // catastrophic · agent fail_softs · runAgentOnce returns "catastrophic"
      expect(["catastrophic","soft_fail"]).toContain(r.outcome);
    } finally { await destroyAgent(agent); }

    // work_item must be in soft_fail with a clear error reference to 406
    const wi = (await pool.query("SELECT state, last_error FROM nex_workforce.work_item WHERE id=$1", [id])).rows[0];
    expect(wi.state).toBe("soft_fail");
    expect(wi.last_error).toMatch(/406/);

    // Log shows EXACTLY ONE Overpass request · not 4 · not infinite
    expect(overpassServer.requestLog().length).toBe(1);
  }, 15000);
});

// ═══════════════════════════════════════════════════════════════════════════
// E · Existing retry semantics for LEGITIMATELY transient status codes are
//     preserved (429 · 504) · not accidentally broken by the encoding fix
// ═══════════════════════════════════════════════════════════════════════════
describe("Slice 5 · E · 504 retries and eventually recovers (existing TRANSIENT semantics preserved)", () => {
  it("504 · 504 · 504 · 200 sequence still recovers via retry policy", async () => {
    overpassServer.plan({ status: 504 }, { status: 504 }, { status: 504 }, HAPPY_200());
    const id = await seedPending();
    const agent = await makeAgent();
    try {
      const r = await runAgentOnce(agent);
      expect(r.outcome).toBe("completed");
    } finally { await destroyAgent(agent); }
    // 4 requests · 3 retries + 1 success
    expect(overpassServer.requestLog().length).toBe(4);
  }, 15000);
});
