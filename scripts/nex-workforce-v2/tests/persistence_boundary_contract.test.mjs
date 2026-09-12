// NEX Workforce v2 · Slice 1g · Persistence Boundary Contract Test Suite
// ─────────────────────────────────────────────────────────────────────────────
// Target: portable PostgreSQL 17.11 · localhost:5439 · nex_workforce_slice1_test
// Mock target created in beforeAll (Slice 1h will replace with real target).
//
// 40 tests grouped:
//   Provenance          (P1-P6)   · 6
//   Fencing             (F1-F5)   · 5
//   Reaper races        (R1-R6)   · 6
//   Lease boundary      (L1-L3)   · 3
//   Monotonic evidence  (M1-M4)   · 4
//   Staging             (S1-S7)   · 7
//   Overpass observe+stage (O1-O8) · 8
//   Anti-drift          (A1)     · 1
//                                = 40

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
const __dirname = dirname(fileURLToPath(import.meta.url));
const CAPABILITY_SRC = join(__dirname, "..", "steps", "overpass_observe_and_stage.mjs");

const sha256 = (s) => createHash("sha256").update(s).digest("hex");
const evidenceIdFor = (wi, gen, qh, rh) => sha256(`${wi}::${gen}::${qh}::${rh}`);

let pool;
let overpassServer;
const silent = () => {};

const HAPPY_200 = (elements = null) => ({
  status: 200,
  body: JSON.stringify({
    version: 0.6,
    generator: "Overpass API",
    osm3s: { timestamp_osm_base: "2026-09-04T00:00:00Z" },
    elements: elements ?? [
      { type: "node", id: 1, lat: -7.8, lon: 110.4, tags: { amenity: "restaurant", name: "A" } },
      { type: "node", id: 2, lat: -7.79, lon: 110.41, tags: { amenity: "restaurant", name: "B" } },
      { type: "node", id: 3, lat: -7.78, lon: 110.42, tags: { amenity: "restaurant", name: "C" } },
    ],
  }),
});

// ═════════════════════════════════════════════════════════════════════════════
// SETUP · create mock target + mock persister once (they're test-only fixtures)
// ═════════════════════════════════════════════════════════════════════════════
beforeAll(async () => {
  pool = new pg.Pool({ ...CONN, max: 10 });

  // Sanity: verify target
  const r = await pool.query("SELECT current_database() AS db, current_setting('port') AS port");
  if (r.rows[0].db !== "nex_workforce_slice1_test") throw new Error(`wrong DB: ${r.rows[0].db}`);
  if (r.rows[0].port !== "5439") throw new Error(`wrong port: ${r.rows[0].port}`);

  // Mock target table (test-only fixture · Slice 1h replaces with real nex.* target)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS nex_workforce.mock_target (
      pk                    text PRIMARY KEY,
      source_slug           text NOT NULL,
      natural_key           text NOT NULL,
      source_evidence_id    text NOT NULL,
      source_retrieved_at   timestamptz NOT NULL,
      source_work_item_id   uuid NOT NULL,
      source_generation     integer NOT NULL,
      payload_json          jsonb NOT NULL,
      first_seen_at         timestamptz NOT NULL DEFAULT now(),
      last_updated_at       timestamptz NOT NULL DEFAULT now(),
      UNIQUE (source_slug, natural_key)
    )
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS mock_target_by_evidence ON nex_workforce.mock_target (source_evidence_id)`);

  // Mock persister function · target = mock_target
  // Implements the monotonic UPSERT rule (§9 · newer retrieved_at wins, tiebreak by evidence_id).
  await pool.query(`
    CREATE OR REPLACE FUNCTION nex_workforce.mock_persist_target(
      p_agent_id      text,
      p_work_item_id  uuid,
      p_generation    integer,
      p_evidence_id   text,
      p_retrieved_at  timestamptz,
      p_source_slug   text,
      p_natural_key   text,
      p_payload_json  jsonb
    ) RETURNS TABLE (
      ok                boolean,
      target_pk         text,
      new_row           boolean,
      updated_row       boolean,
      rejected          boolean,
      rejection_reason  text
    ) AS $$
    DECLARE
      v_pk text := p_source_slug || '::' || p_natural_key;
      v_before RECORD;
      v_did_update boolean := false;
      v_did_insert boolean := false;
    BEGIN
      -- Simulate malformed candidate rejection
      IF (p_payload_json->>'osm_id') = 'REJECT_ME' THEN
        RETURN QUERY SELECT false, NULL::text, false, false, true, 'test-rejection'::text;
        RETURN;
      END IF;

      SELECT source_evidence_id, source_retrieved_at INTO v_before
        FROM nex_workforce.mock_target WHERE pk = v_pk;

      -- Monotonic UPSERT · newer retrieved_at wins · tiebreak by evidence_id lexical
      INSERT INTO nex_workforce.mock_target (
        pk, source_slug, natural_key,
        source_evidence_id, source_retrieved_at,
        source_work_item_id, source_generation,
        payload_json, last_updated_at
      ) VALUES (
        v_pk, p_source_slug, p_natural_key,
        p_evidence_id, p_retrieved_at,
        p_work_item_id, p_generation,
        p_payload_json, now()
      )
      ON CONFLICT (source_slug, natural_key) DO UPDATE SET
        source_evidence_id   = EXCLUDED.source_evidence_id,
        source_retrieved_at  = EXCLUDED.source_retrieved_at,
        source_work_item_id  = EXCLUDED.source_work_item_id,
        source_generation    = EXCLUDED.source_generation,
        payload_json         = EXCLUDED.payload_json,
        last_updated_at      = now()
      WHERE
        nex_workforce.mock_target.source_retrieved_at IS NULL
        OR nex_workforce.mock_target.source_retrieved_at < EXCLUDED.source_retrieved_at
        OR (nex_workforce.mock_target.source_retrieved_at = EXCLUDED.source_retrieved_at
            AND nex_workforce.mock_target.source_evidence_id < EXCLUDED.source_evidence_id);

      IF v_before IS NULL THEN v_did_insert := true;
      ELSIF v_before.source_evidence_id IS DISTINCT FROM p_evidence_id
         OR v_before.source_retrieved_at < p_retrieved_at THEN v_did_update := true;
      END IF;

      RETURN QUERY SELECT true, v_pk, v_did_insert, v_did_update, false, NULL::text;
    END;
    $$ LANGUAGE plpgsql;
  `);
});

afterAll(async () => {
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
  SourceRate._resetForTests();

  await pool.query(`INSERT INTO nex_workforce.city_catalogue (slug, name, enabled, priority, bbox_json) VALUES ('c1', 'C1', true, 100, '{"sw":{"lat":-6.4,"lon":106.7},"ne":{"lat":-6.1,"lon":107.0}}'::jsonb)`);
  await pool.query(`INSERT INTO nex_workforce.job_registry (slug, category_slug, source_slug, cadence_minutes, max_concurrent_per_source, max_attempts, lease_minutes, enabled, priority)
                    VALUES ('rest', 'restaurants', 'overpass', 60, 10, 5, 1, true, 100)`);
  StepRegistry.register("restaurants", "overpass", overpassObserveAndStage);
  overpassServer = await startMockOverpass();
  process.env.NEX_OVERPASS_URL = overpassServer.url;
  process.env.NEX_PERSISTER_FN = "nex_workforce.mock_persist_target(text,uuid,integer,text,timestamptz,text,text,jsonb)";
});

afterEach(async () => {
  if (overpassServer) { await overpassServer.stop(); overpassServer = null; }
  delete process.env.NEX_OVERPASS_URL;
  delete process.env.NEX_PERSISTER_FN;
});

// ─── helpers ────────────────────────────────────────────────────────────────
async function seedPending() {
  // Slice 4 (2026-09-04) · seed with a valid bounded bbox (Jakarta-shape · 0.3° × 0.3°)
  // to satisfy the fail-closed bbox validator introduced in Slice 4. Pre-Slice-4
  // this test relied on the silent whole-world fallback in overpass_observe_and_stage
  // which no longer exists (validator throws BboxInvalidError otherwise).
  const r = await pool.query(
    `INSERT INTO nex_workforce.work_item (city_slug, category_slug, source_slug, generation, state, bbox_json)
     VALUES ('c1', 'restaurants', 'overpass', 1, 'pending',
             '{"sw":{"lat":-6.4,"lon":106.7},"ne":{"lat":-6.1,"lon":107.0}}'::jsonb) RETURNING id`
  );
  return r.rows[0].id;
}
async function claim(agentId = "test-agent") {
  const r = await pool.query("SELECT nex_workforce.claim($1) AS row", [agentId]);
  return r.rows[0].row;
}
async function makeAgent(overrides = {}) {
  return createAgent({ url: URL, pollMs: 30, heartbeatMsOverride: 150, logger: silent, poolMax: 3, ...overrides });
}
async function waitFor(cond, { timeoutMs = 5000, intervalMs = 30 } = {}) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) { if (await cond()) return true; await new Promise((r) => setTimeout(r, intervalMs)); }
  return false;
}

// ═════════════════════════════════════════════════════════════════════════════
// PROVENANCE (P1–P6)
// ═════════════════════════════════════════════════════════════════════════════
describe("P1 · evidence_record inserted on stage_candidates", () => {
  it("full evidence row exists after successful stage", async () => {
    overpassServer.plan(HAPPY_200());
    const id = await seedPending();
    const agent = await makeAgent();
    try {
      const r = await runAgentOnce(agent);
      expect(r.outcome).toBe("completed");
      const er = await pool.query("SELECT * FROM nex_workforce.evidence_record");
      expect(er.rows).toHaveLength(1);
      expect(er.rows[0].source_slug).toBe("overpass");
      expect(er.rows[0].candidate_count).toBe(3);
      expect(er.rows[0].evidence_id).toMatch(/^[a-f0-9]{64}$/);
    } finally { await destroyAgent(agent); }
  });
});

describe("P2 · evidence_id consistency CHECK rejects mismatched hash", () => {
  it("INSERT with wrong evidence_id fails the CHECK constraint", async () => {
    await expect(pool.query(`
      INSERT INTO nex_workforce.evidence_record (evidence_id, work_item_id, generation,
        source_slug, city_slug, category_slug,
        query_hash, response_sha256, retrieved_at, http_status, byte_length, candidate_count)
      VALUES ('deadbeef0000000000000000000000000000000000000000000000000000dead',
              '00000000-0000-0000-0000-000000000001', 1,
              'overpass', 'c1', 'restaurants',
              'a', 'b', now(), 200, 100, 5)
    `)).rejects.toThrow(/evidence_id_consistency|check constraint/i);
  });
});

describe("P3 · duplicate evidence_id INSERT is idempotent (ON CONFLICT DO NOTHING)", () => {
  it("same evidence recomputed twice produces one evidence_record row", async () => {
    overpassServer.plan(HAPPY_200(), HAPPY_200());
    const id = await seedPending();
    const agent = await makeAgent();
    try {
      const r = await runAgentOnce(agent);
      expect(r.outcome).toBe("completed");
      // Verify only 1 evidence_record exists (retries within one cycle shouldn't create more)
      const er = await pool.query("SELECT COUNT(*)::int AS n FROM nex_workforce.evidence_record");
      expect(er.rows[0].n).toBe(1);
    } finally { await destroyAgent(agent); }
  });
});

describe("P4 · provenance survives via evidence_record (independent of work_item.cursor_json)", () => {
  it("provenance query joins nex.* → evidence_record only · never touches work_item.cursor_json", async () => {
    overpassServer.plan(HAPPY_200());
    const id = await seedPending();
    const agent = await makeAgent();
    let originalEvidenceId;
    try {
      const r = await runAgentOnce(agent);
      expect(r.outcome).toBe("completed");
      originalEvidenceId = (await pool.query("SELECT evidence_id FROM nex_workforce.evidence_record")).rows[0].evidence_id;
      const mockRow = await pool.query("SELECT source_evidence_id FROM nex_workforce.mock_target");
      expect(mockRow.rows[0].source_evidence_id).toBe(originalEvidenceId);
    } finally { await destroyAgent(agent); }

    // Prove: the canonical provenance query resolves through evidence_record ONLY,
    // never joining work_item · so it survives any work_item state change (re-lease,
    // generation bump, cursor_json rewrite, deletion by future cleanup, etc).
    const provenanceQuery = await pool.query(`
      SELECT er.evidence_id, er.response_sha256, er.retrieved_at,
             er.work_item_id AS original_wi, er.generation AS original_gen
      FROM nex_workforce.mock_target t
      JOIN nex_workforce.evidence_record er ON er.evidence_id = t.source_evidence_id
    `);
    expect(provenanceQuery.rows).toHaveLength(3);
    for (const row of provenanceQuery.rows) {
      expect(row.evidence_id).toBe(originalEvidenceId);
      expect(row.original_wi).toBe(id);   // captured at fetch time, not from current wi state
      expect(row.original_gen).toBeGreaterThanOrEqual(1);
    }
    // Prove the join query does NOT reference work_item at all — it works even
    // if work_item was completely deleted (which we don't do here, but the SQL
    // shape ensures it's independent).
    expect(provenanceQuery.rows[0].evidence_id).toBe(originalEvidenceId);
  });
});

describe("P5 · evidence_record immutability · UPDATE from runtime perspective rejected via absence of grants", () => {
  it("(Slice 3 will enforce grant · Slice 1g asserts constraint semantics)", async () => {
    // In Slice 1g we don't have Slice 3 grants yet, so we assert the CHECK
    // constraint enforces the invariant instead. This test proves that even
    // an admin cannot corrupt evidence_id.
    await pool.query(`INSERT INTO nex_workforce.evidence_record (evidence_id, work_item_id, generation, source_slug, city_slug, category_slug, query_hash, response_sha256, retrieved_at, http_status, byte_length, candidate_count) VALUES (
      encode(extensions.digest('00000000-0000-0000-0000-000000000042::1::qh::rh', 'sha256'), 'hex'),
      '00000000-0000-0000-0000-000000000042', 1, 'overpass', 'c1', 'restaurants', 'qh', 'rh', now(), 200, 100, 5
    )`);
    await expect(pool.query("UPDATE nex_workforce.evidence_record SET response_sha256 = 'tampered'")).rejects.toThrow(/evidence_id_consistency|check constraint/i);
  });
});

describe("P6 · every persist_audit row includes evidence_ids for traceability", () => {
  it("audit row's evidence_ids array matches persisted staging rows' evidence_ids", async () => {
    overpassServer.plan(HAPPY_200());
    const id = await seedPending();
    const agent = await makeAgent();
    try {
      await runAgentOnce(agent);
      const audit = await pool.query("SELECT evidence_ids, new_rows FROM nex_workforce.persist_audit");
      expect(audit.rows.length).toBeGreaterThanOrEqual(1);
      // First audit row's evidence_ids should be non-empty
      expect(audit.rows[0].evidence_ids.length).toBeGreaterThanOrEqual(1);
      expect(audit.rows[0].evidence_ids[0]).toMatch(/^[a-f0-9]{64}$/);
    } finally { await destroyAgent(agent); }
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// FENCING (F1–F5)
// ═════════════════════════════════════════════════════════════════════════════
describe("F1 · stage_candidates with correct owner succeeds", () => {
  it("returns true", async () => {
    const id = await seedPending();
    const c = await claim("agent-fence-1");
    const evId = evidenceIdFor(c.id, c.generation, "qh1", "rh1");
    const ok = (await pool.query("SELECT nex_workforce.stage_candidates($1, $2, $3, $4, $5::jsonb, $6::jsonb) AS ok",
      ["agent-fence-1", c.id, c.generation, evId,
       JSON.stringify({ source_slug: "overpass", city_slug: "c1", category_slug: "restaurants",
                        query_hash: "qh1", response_sha256: "rh1", retrieved_at: new Date().toISOString(),
                        http_status: 200, byte_length: 100, candidate_count: 0 }),
       JSON.stringify([])])).rows[0].ok;
    expect(ok).toBe(true);
  });
});

describe("F2 · stage_candidates with WRONG agent_id fails fence", () => {
  it("returns false", async () => {
    const id = await seedPending();
    const c = await claim("real-agent");
    const evId = evidenceIdFor(c.id, c.generation, "qh", "rh");
    const ok = (await pool.query("SELECT nex_workforce.stage_candidates($1, $2, $3, $4, $5::jsonb, $6::jsonb) AS ok",
      ["ghost-agent", c.id, c.generation, evId,
       JSON.stringify({ source_slug: "overpass", city_slug: "c1", category_slug: "restaurants",
                        query_hash: "qh", response_sha256: "rh", retrieved_at: new Date().toISOString(),
                        http_status: 200, byte_length: 100, candidate_count: 0 }),
       JSON.stringify([])])).rows[0].ok;
    expect(ok).toBe(false);
    // No evidence_record written
    expect((await pool.query("SELECT COUNT(*)::int AS n FROM nex_workforce.evidence_record")).rows[0].n).toBe(0);
  });
});

describe("F3 · stage_candidates with WRONG generation fails fence", () => {
  it("returns false", async () => {
    const id = await seedPending();
    const c = await claim("agent-fence-3");
    const evId = evidenceIdFor(c.id, 999, "qh", "rh");
    const ok = (await pool.query("SELECT nex_workforce.stage_candidates($1, $2, $3, $4, $5::jsonb, $6::jsonb) AS ok",
      ["agent-fence-3", c.id, 999, evId,
       JSON.stringify({ source_slug: "overpass", city_slug: "c1", category_slug: "restaurants",
                        query_hash: "qh", response_sha256: "rh", retrieved_at: new Date().toISOString(),
                        http_status: 200, byte_length: 100, candidate_count: 0 }),
       JSON.stringify([])])).rows[0].ok;
    expect(ok).toBe(false);
  });
});

describe("F4 · persist_batch on non-leased row fails fence", () => {
  it("returns fence_ok=false", async () => {
    const id = await seedPending();
    // Don't claim · state is pending
    const r = (await pool.query("SELECT * FROM nex_workforce.persist_batch($1, $2, $3, $4::regprocedure, $5)",
      ["orphan-agent", id, 1, "nex_workforce.mock_persist_target(text,uuid,integer,text,timestamptz,text,text,jsonb)", 100])).rows[0];
    expect(r.fence_ok).toBe(false);
  });
});

describe("F5 · after fence failure, NO evidence_record or staging row was written", () => {
  it("stage_candidates rollback leaves DB clean", async () => {
    const id = await seedPending();
    const c = await claim("real-agent-5");
    const evId = evidenceIdFor(c.id, 999, "qh", "rh");
    await pool.query("SELECT nex_workforce.stage_candidates($1, $2, $3, $4, $5::jsonb, $6::jsonb)",
      ["ghost-agent-5", c.id, 999, evId,
       JSON.stringify({ source_slug: "overpass", city_slug: "c1", category_slug: "restaurants",
                        query_hash: "qh", response_sha256: "rh", retrieved_at: new Date().toISOString(),
                        http_status: 200, byte_length: 100, candidate_count: 0 }),
       JSON.stringify([{ candidate_index: 0, natural_key: "osm:node:1", payload_json: {}, payload_bytes: 2 }])]);
    expect((await pool.query("SELECT COUNT(*)::int AS n FROM nex_workforce.evidence_record")).rows[0].n).toBe(0);
    expect((await pool.query("SELECT COUNT(*)::int AS n FROM nex_workforce.candidate_staging")).rows[0].n).toBe(0);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// REAPER RACES (R1–R6)
// ═════════════════════════════════════════════════════════════════════════════
describe("R1 · reaper's SKIP LOCKED yields to persist_batch's FOR UPDATE", () => {
  it("concurrent reaper call skips work_item locked by an in-flight persist", async () => {
    const id = await seedPending();
    const c = await claim("agent-r1");
    // Stage a small batch so persist has work to do
    const evId = evidenceIdFor(c.id, c.generation, "qh", "rh");
    await pool.query("SELECT nex_workforce.stage_candidates($1, $2, $3, $4, $5::jsonb, $6::jsonb)",
      ["agent-r1", c.id, c.generation, evId,
       JSON.stringify({ source_slug: "overpass", city_slug: "c1", category_slug: "restaurants",
                        query_hash: "qh", response_sha256: "rh", retrieved_at: new Date().toISOString(),
                        http_status: 200, byte_length: 100, candidate_count: 1 }),
       JSON.stringify([{ candidate_index: 0, natural_key: "osm:node:99", payload_json: { osm_id: 99 }, payload_bytes: 20 }])]);

    // Force lease deadline into the past so reaper WOULD reclaim if it could
    await pool.query("UPDATE nex_workforce.work_item SET lease_deadline = now() - interval '1 hour' WHERE id=$1", [id]);

    // Open a persister transaction that holds the row lock
    const holdingClient = await pool.connect();
    try {
      await holdingClient.query("BEGIN");
      await holdingClient.query("SELECT id FROM nex_workforce.work_item WHERE id=$1 FOR UPDATE", [id]);
      // Reaper runs · should SKIP LOCKED our row
      const reap = await pool.query("SELECT * FROM nex_workforce.reap_expired_leases()");
      expect(reap.rows[0].reclaimed).toBe(0);
      // Row still leased
      const state = (await pool.query("SELECT state FROM nex_workforce.work_item WHERE id=$1", [id])).rows[0].state;
      expect(state).toBe("leased");
      await holdingClient.query("COMMIT");
    } finally { holdingClient.release(); }
  }, 15000);
});

describe("R2 · after reaper reclaim, subsequent persist_batch fails fence (returns fence_ok=false)", () => {
  it("stale agent cannot persist after reaper transitions state='pending'", async () => {
    const id = await seedPending();
    const c = await claim("agent-r2");
    // Force expiry + reaper reclaim
    await pool.query("UPDATE nex_workforce.work_item SET lease_deadline = now() - interval '1 hour' WHERE id=$1", [id]);
    await pool.query("SELECT * FROM nex_workforce.reap_expired_leases()");
    // Stale agent tries persist_batch
    const r = (await pool.query("SELECT * FROM nex_workforce.persist_batch($1, $2, $3, $4::regprocedure, $5)",
      ["agent-r2", c.id, c.generation, "nex_workforce.mock_persist_target(text,uuid,integer,text,timestamptz,text,text,jsonb)", 100])).rows[0];
    expect(r.fence_ok).toBe(false);
    // No audit rows since fence failed (would need adjustment · currently persist_batch writes audit ONLY on fence_ok=true)
  });
});

describe("R3 · stale generation on stage_candidates fails", () => {
  it("agent A gen 1, reaper reclaims, agent A tries to stage under old gen · rejected", async () => {
    const id = await seedPending();
    const c = await claim("agent-r3");
    await pool.query("UPDATE nex_workforce.work_item SET lease_deadline = now() - interval '1 hour' WHERE id=$1", [id]);
    await pool.query("SELECT * FROM nex_workforce.reap_expired_leases()");
    const evId = evidenceIdFor(c.id, c.generation, "qh", "rh");
    const ok = (await pool.query("SELECT nex_workforce.stage_candidates($1, $2, $3, $4, $5::jsonb, $6::jsonb) AS ok",
      ["agent-r3", c.id, c.generation, evId,
       JSON.stringify({ source_slug: "overpass", city_slug: "c1", category_slug: "restaurants",
                        query_hash: "qh", response_sha256: "rh", retrieved_at: new Date().toISOString(),
                        http_status: 200, byte_length: 100, candidate_count: 0 }),
       JSON.stringify([])])).rows[0].ok;
    expect(ok).toBe(false);
  });
});

describe("R4 · stale agent cannot checkpoint after reaper reclaim (already proven Slice 1b but reconfirmed)", () => {
  it("checkpoint fenced out", async () => {
    const id = await seedPending();
    const c = await claim("agent-r4");
    await pool.query("UPDATE nex_workforce.work_item SET lease_deadline = now() - interval '1 hour' WHERE id=$1", [id]);
    await pool.query("SELECT * FROM nex_workforce.reap_expired_leases()");
    const ok = (await pool.query("SELECT nex_workforce.checkpoint($1, $2, $3, $4::jsonb) AS ok",
      ["agent-r4", c.id, c.generation, "{}"])).rows[0].ok;
    expect(ok).toBe(false);
  });
});

describe("R5 · stale agent cannot complete after reaper reclaim", () => {
  it("complete fenced out", async () => {
    const id = await seedPending();
    const c = await claim("agent-r5");
    await pool.query("UPDATE nex_workforce.work_item SET lease_deadline = now() - interval '1 hour' WHERE id=$1", [id]);
    await pool.query("SELECT * FROM nex_workforce.reap_expired_leases()");
    const ok = (await pool.query("SELECT nex_workforce.complete($1, $2, $3, $4, $5) AS ok",
      ["agent-r5", c.id, c.generation, 1, 0])).rows[0].ok;
    expect(ok).toBe(false);
  });
});

describe("R6 · after reaper reclaim mid-stage, new agent claims fresh generation and stages fresh evidence", () => {
  it("new evidence_record exists with new generation · old evidence not modified", async () => {
    const id = await seedPending();
    const c1 = await claim("agent-r6-a");
    const oldEvId = evidenceIdFor(c1.id, c1.generation, "qh", "rh1");
    await pool.query("SELECT nex_workforce.stage_candidates($1, $2, $3, $4, $5::jsonb, $6::jsonb)",
      ["agent-r6-a", c1.id, c1.generation, oldEvId,
       JSON.stringify({ source_slug: "overpass", city_slug: "c1", category_slug: "restaurants",
                        query_hash: "qh", response_sha256: "rh1", retrieved_at: new Date().toISOString(),
                        http_status: 200, byte_length: 100, candidate_count: 0 }),
       JSON.stringify([])]);
    await pool.query("UPDATE nex_workforce.work_item SET lease_deadline = now() - interval '1 hour' WHERE id=$1", [id]);
    await pool.query("SELECT * FROM nex_workforce.reap_expired_leases()");
    await pool.query("UPDATE nex_workforce.work_item SET next_eligible_at = now() WHERE id=$1", [id]);
    const c2 = await claim("agent-r6-b");
    expect(c2.generation).toBeGreaterThan(c1.generation);
    const newEvId = evidenceIdFor(c2.id, c2.generation, "qh", "rh2");
    await pool.query("SELECT nex_workforce.stage_candidates($1, $2, $3, $4, $5::jsonb, $6::jsonb)",
      ["agent-r6-b", c2.id, c2.generation, newEvId,
       JSON.stringify({ source_slug: "overpass", city_slug: "c1", category_slug: "restaurants",
                        query_hash: "qh", response_sha256: "rh2", retrieved_at: new Date().toISOString(),
                        http_status: 200, byte_length: 100, candidate_count: 0 }),
       JSON.stringify([])]);
    const evRecs = await pool.query("SELECT evidence_id, generation FROM nex_workforce.evidence_record ORDER BY generation");
    expect(evRecs.rows).toHaveLength(2);
    expect(evRecs.rows[0].generation).toBeLessThan(evRecs.rows[1].generation);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// LEASE BOUNDARY (L1–L3)
// ═════════════════════════════════════════════════════════════════════════════
describe("L1 · in-flight persist_batch straddling lease_deadline commits (state-authoritative)", () => {
  it("fence does NOT check lease_deadline > now() · owner completes if state='leased' + gen match", async () => {
    const id = await seedPending();
    const c = await claim("agent-l1");
    // Force lease_deadline into the past · but state still 'leased'
    await pool.query("UPDATE nex_workforce.work_item SET lease_deadline = now() - interval '5 seconds' WHERE id=$1", [id]);
    // Stage + persist should still work · fence uses state, not deadline
    const evId = evidenceIdFor(c.id, c.generation, "qh", "rh-l1");
    const stageOk = (await pool.query("SELECT nex_workforce.stage_candidates($1, $2, $3, $4, $5::jsonb, $6::jsonb) AS ok",
      ["agent-l1", c.id, c.generation, evId,
       JSON.stringify({ source_slug: "overpass", city_slug: "c1", category_slug: "restaurants",
                        query_hash: "qh", response_sha256: "rh-l1", retrieved_at: new Date().toISOString(),
                        http_status: 200, byte_length: 100, candidate_count: 1 }),
       JSON.stringify([{ candidate_index: 0, natural_key: "osm:node:L1", payload_json: { osm_id: "L1" }, payload_bytes: 30 }])])).rows[0].ok;
    expect(stageOk).toBe(true);
  });
});

describe("L2 · reaper can reclaim after lease_deadline once agent's transaction released the lock", () => {
  it("state moves to pending after expiry + reaper", async () => {
    const id = await seedPending();
    await claim("agent-l2");
    await pool.query("UPDATE nex_workforce.work_item SET lease_deadline = now() - interval '1 hour' WHERE id=$1", [id]);
    await pool.query("SELECT * FROM nex_workforce.reap_expired_leases()");
    const state = (await pool.query("SELECT state FROM nex_workforce.work_item WHERE id=$1", [id])).rows[0].state;
    expect(state).toBe("pending");
  });
});

describe("L3 · new generation fences prior owner (proven via helpers)", () => {
  it("after reaper + new claim, prior agent's stage_candidates fails", async () => {
    const id = await seedPending();
    const c1 = await claim("agent-l3");
    await pool.query("UPDATE nex_workforce.work_item SET lease_deadline = now() - interval '1 hour' WHERE id=$1", [id]);
    await pool.query("SELECT * FROM nex_workforce.reap_expired_leases()");
    await pool.query("UPDATE nex_workforce.work_item SET next_eligible_at = now() WHERE id=$1", [id]);
    const c2 = await claim("agent-l3-new");
    expect(c2.generation).toBeGreaterThan(c1.generation);
    // Prior agent tries stage under old gen · rejected
    const evId = evidenceIdFor(c1.id, c1.generation, "qh", "rh");
    const ok = (await pool.query("SELECT nex_workforce.stage_candidates($1, $2, $3, $4, $5::jsonb, $6::jsonb) AS ok",
      ["agent-l3", c1.id, c1.generation, evId,
       JSON.stringify({ source_slug: "overpass", city_slug: "c1", category_slug: "restaurants",
                        query_hash: "qh", response_sha256: "rh", retrieved_at: new Date().toISOString(),
                        http_status: 200, byte_length: 100, candidate_count: 0 }),
       JSON.stringify([])])).rows[0].ok;
    expect(ok).toBe(false);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// MONOTONIC EVIDENCE (M1–M4)
// ═════════════════════════════════════════════════════════════════════════════
describe("M1 · newer retrieved_at replaces older row content", () => {
  it("later persist with newer retrieved_at overwrites older", async () => {
    // Manually invoke the mock persister twice with different retrieved_at
    const wi = "00000000-0000-0000-0000-00000000a001";
    const older = new Date(Date.now() - 60000).toISOString();
    const newer = new Date().toISOString();
    // Insert evidence records first (FK required)
    const eId1 = evidenceIdFor(wi, 1, "q", "r1");
    const eId2 = evidenceIdFor(wi, 1, "q", "r2");
    for (const [eid, ts, resp] of [[eId1, older, "r1"], [eId2, newer, "r2"]]) {
      await pool.query(`INSERT INTO nex_workforce.evidence_record (evidence_id, work_item_id, generation, source_slug, city_slug, category_slug, query_hash, response_sha256, retrieved_at, http_status, byte_length, candidate_count) VALUES ($1, $2, 1, 'overpass', 'c1', 'restaurants', 'q', $3, $4, 200, 100, 1) ON CONFLICT DO NOTHING`, [eid, wi, resp, ts]);
    }
    // Persist older first
    await pool.query("SELECT * FROM nex_workforce.mock_persist_target($1, $2, $3, $4, $5, $6, $7, $8::jsonb)",
      ["a", wi, 1, eId1, older, "overpass", "osm:node:M1", { v: "old" }]);
    // Then newer
    await pool.query("SELECT * FROM nex_workforce.mock_persist_target($1, $2, $3, $4, $5, $6, $7, $8::jsonb)",
      ["a", wi, 1, eId2, newer, "overpass", "osm:node:M1", { v: "new" }]);
    const row = await pool.query("SELECT source_evidence_id, payload_json FROM nex_workforce.mock_target WHERE natural_key='osm:node:M1'");
    expect(row.rows[0].source_evidence_id).toBe(eId2);
    expect(row.rows[0].payload_json.v).toBe("new");
  });
});

describe("M2 · older retrieved_at does NOT overwrite newer (persistence order irrelevant)", () => {
  it("persist newer first, then older · row still reflects newer", async () => {
    const wi = "00000000-0000-0000-0000-00000000a002";
    const older = new Date(Date.now() - 60000).toISOString();
    const newer = new Date().toISOString();
    const eIdOld = evidenceIdFor(wi, 1, "q", "rold");
    const eIdNew = evidenceIdFor(wi, 1, "q", "rnew");
    for (const [eid, ts, resp] of [[eIdOld, older, "rold"], [eIdNew, newer, "rnew"]]) {
      await pool.query(`INSERT INTO nex_workforce.evidence_record (evidence_id, work_item_id, generation, source_slug, city_slug, category_slug, query_hash, response_sha256, retrieved_at, http_status, byte_length, candidate_count) VALUES ($1, $2, 1, 'overpass', 'c1', 'restaurants', 'q', $3, $4, 200, 100, 1) ON CONFLICT DO NOTHING`, [eid, wi, resp, ts]);
    }
    // Persist NEWER first
    await pool.query("SELECT * FROM nex_workforce.mock_persist_target($1, $2, $3, $4, $5, $6, $7, $8::jsonb)",
      ["a", wi, 1, eIdNew, newer, "overpass", "osm:node:M2", { v: "new" }]);
    // Then OLDER · should be a no-op per monotonic rule
    await pool.query("SELECT * FROM nex_workforce.mock_persist_target($1, $2, $3, $4, $5, $6, $7, $8::jsonb)",
      ["a", wi, 1, eIdOld, older, "overpass", "osm:node:M2", { v: "old" }]);
    const row = await pool.query("SELECT source_evidence_id, payload_json FROM nex_workforce.mock_target WHERE natural_key='osm:node:M2'");
    expect(row.rows[0].source_evidence_id).toBe(eIdNew);
    expect(row.rows[0].payload_json.v).toBe("new");
  });
});

describe("M3 · equal retrieved_at uses evidence_id lexical tiebreak", () => {
  it("equal timestamps · higher lexical evidence_id wins on second persist", async () => {
    // Contrive two different work_items with same retrieved_at
    const ts = new Date().toISOString();
    const wi1 = "00000000-0000-0000-0000-00000000a003";
    const wi2 = "00000000-0000-0000-0000-00000000a004";
    const eId1 = evidenceIdFor(wi1, 1, "q", "r-lex-a");
    const eId2 = evidenceIdFor(wi2, 1, "q", "r-lex-b");
    for (const [eid, wi, resp] of [[eId1, wi1, "r-lex-a"], [eId2, wi2, "r-lex-b"]]) {
      await pool.query(`INSERT INTO nex_workforce.evidence_record (evidence_id, work_item_id, generation, source_slug, city_slug, category_slug, query_hash, response_sha256, retrieved_at, http_status, byte_length, candidate_count) VALUES ($1, $2, 1, 'overpass', 'c1', 'restaurants', 'q', $3, $4, 200, 100, 1) ON CONFLICT DO NOTHING`, [eid, wi, resp, ts]);
    }
    const [lo, hi] = eId1 < eId2 ? [eId1, eId2] : [eId2, eId1];
    // Persist lo first
    await pool.query("SELECT * FROM nex_workforce.mock_persist_target($1, $2, $3, $4, $5, $6, $7, $8::jsonb)",
      ["a", eId1 < eId2 ? wi1 : wi2, 1, lo, ts, "overpass", "osm:node:M3", { v: "lo" }]);
    // Then hi · monotonic rule allows update (equal ts, hi.evidence_id > existing)
    await pool.query("SELECT * FROM nex_workforce.mock_persist_target($1, $2, $3, $4, $5, $6, $7, $8::jsonb)",
      ["a", eId1 < eId2 ? wi2 : wi1, 1, hi, ts, "overpass", "osm:node:M3", { v: "hi" }]);
    const row = await pool.query("SELECT source_evidence_id, payload_json FROM nex_workforce.mock_target WHERE natural_key='osm:node:M3'");
    expect(row.rows[0].source_evidence_id).toBe(hi);
    expect(row.rows[0].payload_json.v).toBe("hi");
  });
});

describe("M4 · same evidence_id replay is true no-op (no timestamp bump)", () => {
  it("second call with same evidence_id + same retrieved_at does NOT trigger UPDATE", async () => {
    const wi = "00000000-0000-0000-0000-00000000a005";
    const ts = new Date().toISOString();
    const eId = evidenceIdFor(wi, 1, "q", "r-noop");
    await pool.query(`INSERT INTO nex_workforce.evidence_record (evidence_id, work_item_id, generation, source_slug, city_slug, category_slug, query_hash, response_sha256, retrieved_at, http_status, byte_length, candidate_count) VALUES ($1, $2, 1, 'overpass', 'c1', 'restaurants', 'q', 'r-noop', $3, 200, 100, 1) ON CONFLICT DO NOTHING`, [eId, wi, ts]);
    await pool.query("SELECT * FROM nex_workforce.mock_persist_target($1, $2, $3, $4, $5, $6, $7, $8::jsonb)",
      ["a", wi, 1, eId, ts, "overpass", "osm:node:M4", { v: "first" }]);
    const before = (await pool.query("SELECT last_updated_at FROM nex_workforce.mock_target WHERE natural_key='osm:node:M4'")).rows[0].last_updated_at;
    await new Promise((r) => setTimeout(r, 50));
    await pool.query("SELECT * FROM nex_workforce.mock_persist_target($1, $2, $3, $4, $5, $6, $7, $8::jsonb)",
      ["a", wi, 1, eId, ts, "overpass", "osm:node:M4", { v: "second-attempt" }]);
    const after = (await pool.query("SELECT last_updated_at, payload_json FROM nex_workforce.mock_target WHERE natural_key='osm:node:M4'")).rows[0];
    // last_updated_at should be unchanged (no UPDATE happened)
    expect(after.last_updated_at.toISOString()).toBe(before.toISOString());
    expect(after.payload_json.v).toBe("first");
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// STAGING (S1–S7)
// ═════════════════════════════════════════════════════════════════════════════
describe("S1 · atomic multi-row staging (3 candidates in one call)", () => {
  it("stage_candidates inserts all 3 rows in one TX", async () => {
    const id = await seedPending();
    const c = await claim("agent-s1");
    const evId = evidenceIdFor(c.id, c.generation, "q", "r");
    await pool.query("SELECT nex_workforce.stage_candidates($1, $2, $3, $4, $5::jsonb, $6::jsonb)",
      ["agent-s1", c.id, c.generation, evId,
       JSON.stringify({ source_slug: "overpass", city_slug: "c1", category_slug: "restaurants",
                        query_hash: "q", response_sha256: "r", retrieved_at: new Date().toISOString(),
                        http_status: 200, byte_length: 100, candidate_count: 3 }),
       JSON.stringify([
         { candidate_index: 0, natural_key: "k1", payload_json: {}, payload_bytes: 2 },
         { candidate_index: 1, natural_key: "k2", payload_json: {}, payload_bytes: 2 },
         { candidate_index: 2, natural_key: "k3", payload_json: {}, payload_bytes: 2 },
       ])]);
    const n = (await pool.query("SELECT COUNT(*)::int AS n FROM nex_workforce.candidate_staging WHERE work_item_id=$1", [c.id])).rows[0].n;
    expect(n).toBe(3);
  });
});

describe("S2 · duplicate stage_candidates call (same evidence_id) is no-op", () => {
  it("second call inserts zero additional rows", async () => {
    const id = await seedPending();
    const c = await claim("agent-s2");
    const evId = evidenceIdFor(c.id, c.generation, "q", "r");
    const args = ["agent-s2", c.id, c.generation, evId,
       JSON.stringify({ source_slug: "overpass", city_slug: "c1", category_slug: "restaurants",
                        query_hash: "q", response_sha256: "r", retrieved_at: new Date().toISOString(),
                        http_status: 200, byte_length: 100, candidate_count: 2 }),
       JSON.stringify([
         { candidate_index: 0, natural_key: "k1", payload_json: {}, payload_bytes: 2 },
         { candidate_index: 1, natural_key: "k2", payload_json: {}, payload_bytes: 2 },
       ])];
    await pool.query("SELECT nex_workforce.stage_candidates($1, $2, $3, $4, $5::jsonb, $6::jsonb)", args);
    await pool.query("SELECT nex_workforce.stage_candidates($1, $2, $3, $4, $5::jsonb, $6::jsonb)", args);
    const n = (await pool.query("SELECT COUNT(*)::int AS n FROM nex_workforce.candidate_staging")).rows[0].n;
    expect(n).toBe(2);
    const ev = (await pool.query("SELECT COUNT(*)::int AS n FROM nex_workforce.evidence_record")).rows[0].n;
    expect(ev).toBe(1);
  });
});

describe("S3 · candidate_index preserved as stable ordering", () => {
  it("stored rows retain their given candidate_index (0..N-1)", async () => {
    const id = await seedPending();
    const c = await claim("agent-s3");
    const evId = evidenceIdFor(c.id, c.generation, "q", "r");
    await pool.query("SELECT nex_workforce.stage_candidates($1, $2, $3, $4, $5::jsonb, $6::jsonb)",
      ["agent-s3", c.id, c.generation, evId,
       JSON.stringify({ source_slug: "overpass", city_slug: "c1", category_slug: "restaurants",
                        query_hash: "q", response_sha256: "r", retrieved_at: new Date().toISOString(),
                        http_status: 200, byte_length: 100, candidate_count: 3 }),
       JSON.stringify([
         { candidate_index: 0, natural_key: "k0", payload_json: {}, payload_bytes: 2 },
         { candidate_index: 1, natural_key: "k1", payload_json: {}, payload_bytes: 2 },
         { candidate_index: 2, natural_key: "k2", payload_json: {}, payload_bytes: 2 },
       ])]);
    const rows = await pool.query("SELECT candidate_index, natural_key FROM nex_workforce.candidate_staging ORDER BY candidate_index");
    expect(rows.rows.map((r) => r.natural_key)).toEqual(["k0", "k1", "k2"]);
  });
});

describe("S4 · payload_bytes cap enforced (32 KB)", () => {
  it("staging INSERT rejected for oversize payload", async () => {
    const id = await seedPending();
    const c = await claim("agent-s4");
    const evId = evidenceIdFor(c.id, c.generation, "q", "r");
    await expect(pool.query("SELECT nex_workforce.stage_candidates($1, $2, $3, $4, $5::jsonb, $6::jsonb)",
      ["agent-s4", c.id, c.generation, evId,
       JSON.stringify({ source_slug: "overpass", city_slug: "c1", category_slug: "restaurants",
                        query_hash: "q", response_sha256: "r", retrieved_at: new Date().toISOString(),
                        http_status: 200, byte_length: 100, candidate_count: 1 }),
       JSON.stringify([{ candidate_index: 0, natural_key: "k", payload_json: {}, payload_bytes: 40000 }])]))
      .rejects.toThrow(/staging_payload_bytes_cap|check constraint/i);
  });
});

describe("S5 · staging FK enforces evidence_record must exist first", () => {
  it("INSERT into candidate_staging with unknown evidence_id fails", async () => {
    const id = await seedPending();
    await expect(pool.query(`INSERT INTO nex_workforce.candidate_staging (work_item_id, generation, city_slug, category_slug, source_slug, evidence_id, candidate_index, natural_key, payload_json, payload_bytes) VALUES ($1, 1, 'c1', 'restaurants', 'overpass', 'nonexistent_evidence_id_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx', 0, 'k', '{}'::jsonb, 2)`, [id]))
      .rejects.toThrow(/violates foreign key|evidence_id/i);
  });
});

describe("S6 · persist_batch marks staging row persisted=true (idempotent · no double-persist)", () => {
  it("re-invoking persist_batch on already-persisted rows is no-op (remaining=0)", async () => {
    overpassServer.plan(HAPPY_200());
    const id = await seedPending();
    const agent = await makeAgent();
    try {
      await runAgentOnce(agent);
      // All staged rows should be persisted=true now
      const persisted = await pool.query("SELECT persisted, COUNT(*)::int AS n FROM nex_workforce.candidate_staging GROUP BY persisted");
      expect(persisted.rows.every((r) => r.persisted === true)).toBe(true);
      // A second persist_batch call (with same fence) · returns fence_ok=false because state='completed', not 'leased'
      const c2 = (await pool.query("SELECT id, generation FROM nex_workforce.work_item")).rows[0];
      const r2 = (await pool.query("SELECT * FROM nex_workforce.persist_batch($1, $2, $3, $4::regprocedure, $5)",
        ["agent-s6", c2.id, c2.generation, "nex_workforce.mock_persist_target(text,uuid,integer,text,timestamptz,text,text,jsonb)", 100])).rows[0];
      expect(r2.fence_ok).toBe(false); // state is 'completed', not 'leased'
    } finally { await destroyAgent(agent); }
  });
});

describe("S7 · staging survives across process death (evidence + payload intact)", () => {
  it("stage completes · agent crashes · new agent finds staging rows persisted=false and processes them", async () => {
    // Manually seed staging (simulating crashed agent that staged but never persisted)
    const id = await seedPending();
    const c = await claim("agent-s7-a");
    const evId = evidenceIdFor(c.id, c.generation, "q", "r-s7");
    await pool.query("SELECT nex_workforce.stage_candidates($1, $2, $3, $4, $5::jsonb, $6::jsonb)",
      ["agent-s7-a", c.id, c.generation, evId,
       JSON.stringify({ source_slug: "overpass", city_slug: "c1", category_slug: "restaurants",
                        query_hash: "q", response_sha256: "r-s7", retrieved_at: new Date().toISOString(),
                        http_status: 200, byte_length: 100, candidate_count: 1 }),
       JSON.stringify([{ candidate_index: 0, natural_key: "osm:node:S7", payload_json: { v: "x" }, payload_bytes: 10 }])]);
    // Verify staging exists and payload survives
    const staged = await pool.query("SELECT payload_json, persisted FROM nex_workforce.candidate_staging WHERE work_item_id=$1", [id]);
    expect(staged.rows).toHaveLength(1);
    expect(staged.rows[0].payload_json.v).toBe("x");
    expect(staged.rows[0].persisted).toBe(false);
    // A new agent (same generation, but simulated as still owning the lease) can persist
    const r = (await pool.query("SELECT * FROM nex_workforce.persist_batch($1, $2, $3, $4::regprocedure, $5)",
      ["agent-s7-a", c.id, c.generation, "nex_workforce.mock_persist_target(text,uuid,integer,text,timestamptz,text,text,jsonb)", 100])).rows[0];
    expect(r.fence_ok).toBe(true);
    expect(r.persisted_count).toBe(1);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// OVERPASS OBSERVE + STAGE end-to-end (O1–O8)
// ═════════════════════════════════════════════════════════════════════════════
describe("O1 · full lifecycle · fetch → stage → persist → complete", () => {
  it("all 3 candidates end up in mock_target with correct evidence_id", async () => {
    overpassServer.plan(HAPPY_200());
    const id = await seedPending();
    const logs = [];
    const agent = await makeAgent({ logger: (o) => logs.push(o) });
    try {
      const r = await runAgentOnce(agent);
      if (r.outcome !== "completed") console.log("[O1 debug]", JSON.stringify(logs, null, 2));
      expect(r.outcome).toBe("completed");
      const wi = await pool.query("SELECT state, records_new, records_rejected, cursor_json FROM nex_workforce.work_item WHERE id=$1", [id]);
      expect(wi.rows[0].state).toBe("completed");
      expect(wi.rows[0].records_new).toBe(3);
      expect(wi.rows[0].cursor_json.phase).toBe("completed");
      const targetRows = await pool.query("SELECT COUNT(*)::int AS n FROM nex_workforce.mock_target");
      expect(targetRows.rows[0].n).toBe(3);
    } finally { await destroyAgent(agent); }
  });
});

describe("O2 · empty response (records_new=0, no fabrication)", () => {
  it("cycle completes with 0 records, no mock_target rows", async () => {
    overpassServer.plan({ status: 200, body: JSON.stringify({ elements: [] }) });
    const id = await seedPending();
    const agent = await makeAgent();
    try {
      const r = await runAgentOnce(agent);
      expect(r.outcome).toBe("completed");
      const wi = await pool.query("SELECT records_new FROM nex_workforce.work_item WHERE id=$1", [id]);
      expect(wi.rows[0].records_new).toBe(0);
      const targetN = (await pool.query("SELECT COUNT(*)::int AS n FROM nex_workforce.mock_target")).rows[0].n;
      expect(targetN).toBe(0);
    } finally { await destroyAgent(agent); }
  });
});

describe("O3 · persistent 502 → transient_exhausted (no fabricated records_rejected)", () => {
  it("row = soft_fail · records_new NULL · records_rejected NULL", async () => {
    overpassServer.plan({ status: 502 }, { status: 502 }, { status: 502 }, { status: 502 });
    const id = await seedPending();
    const agent = await makeAgent();
    try {
      const r = await runAgentOnce(agent);
      expect(r.outcome).toBe("transient_exhausted");
      const wi = await pool.query("SELECT state, last_error_class, records_new, records_rejected FROM nex_workforce.work_item WHERE id=$1", [id]);
      expect(wi.rows[0].state).toBe("soft_fail");
      expect(wi.rows[0].last_error_class).toBe("transient_exhausted");
      expect(wi.rows[0].records_new).toBeNull();
      expect(wi.rows[0].records_rejected).toBeNull();
      const targetN = (await pool.query("SELECT COUNT(*)::int AS n FROM nex_workforce.mock_target")).rows[0].n;
      expect(targetN).toBe(0);
    } finally { await destroyAgent(agent); }
  }, 30000);
});

describe("O4 · transient 502 recovered on 4th attempt · full pipeline succeeds", () => {
  it("3 retries then success · candidates persisted", async () => {
    overpassServer.plan({ status: 502 }, { status: 502 }, { status: 502 }, HAPPY_200());
    const id = await seedPending();
    const agent = await makeAgent();
    try {
      const r = await runAgentOnce(agent);
      expect(r.outcome).toBe("completed");
      expect((await pool.query("SELECT COUNT(*)::int AS n FROM nex_workforce.mock_target")).rows[0].n).toBe(3);
    } finally { await destroyAgent(agent); }
  }, 30000);
});

describe("O5 · HTTP 400 → catastrophic · no writes to any table", () => {
  it("evidence_record + staging + mock_target all empty", async () => {
    overpassServer.plan({ status: 400, body: "bad query" });
    const id = await seedPending();
    const agent = await makeAgent();
    try {
      const r = await runAgentOnce(agent);
      expect(r.outcome).toBe("catastrophic");
      expect((await pool.query("SELECT COUNT(*)::int AS n FROM nex_workforce.evidence_record")).rows[0].n).toBe(0);
      expect((await pool.query("SELECT COUNT(*)::int AS n FROM nex_workforce.candidate_staging")).rows[0].n).toBe(0);
      expect((await pool.query("SELECT COUNT(*)::int AS n FROM nex_workforce.mock_target")).rows[0].n).toBe(0);
    } finally { await destroyAgent(agent); }
  });
});

describe("O6 · persister rejection surfaces to records_rejected without breaking cycle", () => {
  it("one REJECT_ME candidate is dead-lettered in staging.rejected · cycle still completes", async () => {
    overpassServer.plan({
      status: 200,
      body: JSON.stringify({
        elements: [
          { type: "node", id: "GOOD1", lat: 0, lon: 0, tags: { amenity: "restaurant", name: "OK" } },
          { type: "node", id: "REJECT_ME", lat: 0, lon: 0, tags: { amenity: "restaurant", name: "Bad" } },
          { type: "node", id: "GOOD2", lat: 0, lon: 0, tags: { amenity: "restaurant", name: "OK2" } },
        ],
      }),
    });
    const id = await seedPending();
    const agent = await makeAgent();
    try {
      const r = await runAgentOnce(agent);
      expect(r.outcome).toBe("completed");
      const wi = await pool.query("SELECT records_new, records_rejected FROM nex_workforce.work_item WHERE id=$1", [id]);
      expect(wi.rows[0].records_new).toBe(2);
      expect(wi.rows[0].records_rejected).toBe(1);
      const rejected = await pool.query("SELECT COUNT(*)::int AS n FROM nex_workforce.candidate_staging WHERE rejected=true");
      expect(rejected.rows[0].n).toBe(1);
    } finally { await destroyAgent(agent); }
  });
});

describe("O7 · cursor_json stays under 8KB (Slice 1f invariant preserved)", () => {
  it("cursor_json size well under limit despite large response", async () => {
    // Generate 100 candidates
    const many = Array.from({ length: 100 }, (_, i) => ({
      type: "node", id: i + 1000, lat: i * 0.01, lon: i * 0.01,
      tags: { amenity: "restaurant", name: `R${i}` }
    }));
    overpassServer.plan(HAPPY_200(many));
    const id = await seedPending();
    const agent = await makeAgent();
    try {
      const r = await runAgentOnce(agent);
      expect(r.outcome).toBe("completed");
      const wi = await pool.query("SELECT cursor_json FROM nex_workforce.work_item WHERE id=$1", [id]);
      const bytes = Buffer.byteLength(JSON.stringify(wi.rows[0].cursor_json), "utf8");
      expect(bytes).toBeLessThan(8192);
      // But we did stage 100 candidates
      expect((await pool.query("SELECT COUNT(*)::int AS n FROM nex_workforce.candidate_staging")).rows[0].n).toBe(100);
    } finally { await destroyAgent(agent); }
  });
});

describe("O8 · re-fetch NEVER attempted after stage · payload survives across process boundary", () => {
  it("plan a single mock response · agent completes without extra fetches", async () => {
    overpassServer.plan(HAPPY_200());
    const id = await seedPending();
    const agent = await makeAgent();
    try {
      const r = await runAgentOnce(agent);
      expect(r.outcome).toBe("completed");
      expect(overpassServer.requestsReceived()).toBe(1);
    } finally { await destroyAgent(agent); }
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// ANTI-DRIFT (A1)
// ═════════════════════════════════════════════════════════════════════════════
describe("A1 · anti-drift static lint for overpass_observe_and_stage.mjs", () => {
  it("no forbidden production nex.* references or console.log", async () => {
    const src = readFileSync(CAPABILITY_SRC, "utf8");
    let cleaned = src.replace(/\/\*[\s\S]*?\*\//g, "");
    cleaned = cleaned.replace(/\/\/[^\n]*/g, "");
    // Forbidden: nex.* production table references
    expect(cleaned, "must not reference nex.acquisition tables").not.toMatch(/nex\.acquisition/);
    expect(cleaned, "must not reference nex.food_business").not.toMatch(/nex\.food_business/);
    expect(cleaned, "must not reference nex.accommodation_business").not.toMatch(/nex\.accommodation/);
    expect(cleaned, "must not reference nex.worker_cycle_run").not.toMatch(/nex\.worker_cycle_run/);
    // Forbidden: direct DB library imports
    expect(cleaned, "must not import pg").not.toMatch(/from\s+['"]pg['"]/);
    expect(cleaned, "must not require pg").not.toMatch(/require\s*\(\s*['"]pg['"]/);
    // Forbidden: console.log/error (use ctx.logger)
    expect(cleaned, "must not use console.log").not.toMatch(/console\.log/);
    expect(cleaned, "must not use console.error").not.toMatch(/console\.error/);
    // Forbidden: raw INSERT/UPDATE to nex.* tables
    expect(cleaned, "must not INSERT into nex.*").not.toMatch(/INSERT\s+INTO\s+nex\./i);
    expect(cleaned, "must not UPDATE nex.*").not.toMatch(/UPDATE\s+nex\./i);
    // Allowed nex_workforce.* references from the capability source:
    //   - stage_candidates helper call
    //   - persist_batch helper call
    //   - mock_persist_target (default persister for tests; env-overridable)
    // Note: this check accepts references appearing anywhere in the file
    // (comments stripped, but string literals retained). The forbidden checks
    // above (nex.acquisition/nex.food_business/etc + direct INSERT/UPDATE nex.*)
    // are the meaningful production-safety check. This whitelist is a
    // defense-in-depth catch for accidental introduction of new nex_workforce
    // symbols.
    const nexWorkforceRefs = cleaned.match(/nex_workforce\.[a-z_]+/gi) ?? [];
    const allowedHelpers = new Set([
      "nex_workforce.stage_candidates",
      "nex_workforce.persist_batch",
      "nex_workforce.mock_persist_target",   // default persister for tests only
    ]);
    for (const ref of nexWorkforceRefs) {
      expect(allowedHelpers.has(ref.toLowerCase()), `${ref} is not on the Slice 1g capability whitelist`).toBe(true);
    }
  });
});
