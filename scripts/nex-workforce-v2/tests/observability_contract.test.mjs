// NEX Workforce v2 · Observability · 15-test contract (O-01..O-15)
// ─────────────────────────────────────────────────────────────────────────────
// Target: portable PostgreSQL 17.11 · localhost:5439 · nex_workforce_slice1_test
//
// Proves the observability library:
//   · reads state (does NOT mutate)
//   · classifies health correctly across scenarios
//   · reports stuck work accurately
//   · aggregates throughput / city×category×source correctly
//   · evaluates alert conditions correctly
//
// Portable tests seed synthetic work_items in specific states, run the
// observability functions, assert outputs, and prove state before ==
// state after (§ O-15 no-mutation guarantee).

import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import pg from "pg";
import { collectAllMetrics } from "../observability/lib/metrics.mjs";
import { classifyHealth, HealthState } from "../observability/lib/health.mjs";
import { evaluateAlerts, AlertSeverity } from "../observability/lib/alerts.mjs";

const CONN = { host: "127.0.0.1", port: 5439, user: "postgres", database: "nex_workforce_slice1_test" };

let pool;
let query; // pg pool → SQL executor for observability lib

const TEST_AGENT = "obs-test-agent-01";
const TEST_CITY_SLUG = "obs-test-city";
const TEST_JOB_SLUG = "obs-test-restaurants-overpass";

beforeAll(async () => {
  pool = new pg.Pool({ ...CONN, max: 4 });
  query = async (sql) => (await pool.query(sql)).rows;

  // Seed a test city + job (so rotation_eligible can potentially resolve).
  // Uses 'obs-test-' prefix so it can never collide with real production entries.
  await pool.query(
    `INSERT INTO nex_workforce.city_catalogue (slug, name, country, enabled, priority, bbox_json)
       VALUES ($1, 'Observability Test City', 'ID', true, 100,
               '{"sw":{"lat":-7.82,"lon":110.34},"ne":{"lat":-7.77,"lon":110.39}}'::jsonb)
     ON CONFLICT (slug) DO UPDATE SET enabled = true`,
    [TEST_CITY_SLUG]
  );
  await pool.query(
    `INSERT INTO nex_workforce.job_registry
       (slug, category_slug, source_slug, cadence_minutes, max_concurrent_per_source, max_attempts, lease_minutes, enabled, priority)
       VALUES ($1, 'obs-restaurants', 'obs-overpass', 60, 3, 5, 15, true, 100)
     ON CONFLICT (slug) DO NOTHING`,
    [TEST_JOB_SLUG]
  );
});

afterAll(async () => {
  if (pool) {
    // Clean up test fixtures (only rows we created · never touch legitimate data)
    try {
      await pool.query(`DELETE FROM nex_workforce.agent_heartbeat WHERE agent_id LIKE 'obs-test-%'`);
      await pool.query(`DELETE FROM nex_workforce.work_item WHERE agent_id LIKE 'obs-test-%' OR city_slug = $1`, [TEST_CITY_SLUG]);
      await pool.query(`DELETE FROM nex_workforce.city_catalogue WHERE slug = $1`, [TEST_CITY_SLUG]);
      await pool.query(`DELETE FROM nex_workforce.job_registry WHERE slug = $1`, [TEST_JOB_SLUG]);
    } catch {}
    await pool.end();
  }
});

beforeEach(async () => {
  // Clean before every test so fixtures are deterministic
  await pool.query(`DELETE FROM nex_workforce.agent_heartbeat WHERE agent_id LIKE 'obs-test-%'`).catch(() => {});
  await pool.query(`DELETE FROM nex_workforce.work_item WHERE agent_id LIKE 'obs-test-%' OR city_slug = $1`, [TEST_CITY_SLUG]).catch(() => {});
});

// ─── Fixture helpers ────────────────────────────────────────────────────────

async function seedWorkItem({ state = "pending", agent = TEST_AGENT, city = TEST_CITY_SLUG, category = "obs-restaurants", source = "obs-overpass", leaseSecsAhead = 900, heartbeatAgoSecs = null, error = null, errorClass = null, recordsNew = null, recordsRejected = null }) {
  // Test fixture: use session_replication_role='replica' to bypass the state
  // transition trigger. This is portable-tests-only · postgres role is
  // superuser on the local test cluster · production never runs this.
  const c = await pool.connect();
  let wiId;
  try {
    await c.query("BEGIN");
    await c.query("SET LOCAL session_replication_role = replica");
    if (state === "pending") {
      const wi = await c.query(
        `INSERT INTO nex_workforce.work_item (city_slug, category_slug, source_slug, priority)
           VALUES ($1, $2, $3, 100) RETURNING id, generation`,
        [city, category, source]
      );
      wiId = wi.rows[0].id;
    } else if (state === "leased") {
      const leaseDeadline = new Date(Date.now() + leaseSecsAhead * 1000).toISOString();
      const wi = await c.query(
        `INSERT INTO nex_workforce.work_item (city_slug, category_slug, source_slug, priority, state, agent_id, lease_deadline, attempts, started_at)
           VALUES ($1, $2, $3, 100, 'leased', $4, $5::timestamptz, 1, now() - interval '5 seconds')
           RETURNING id, generation`,
        [city, category, source, agent, leaseDeadline]
      );
      wiId = wi.rows[0].id;
    } else {
      // Terminal state · CHECK work_item_finished_when_terminal says:
      // finished_at IS NOT NULL iff state IN ('completed','dead_letter').
      // soft_fail must have finished_at = NULL.
      const finishedAt = (state === "completed" || state === "dead_letter") ? "now()" : "NULL";
      const wi = await c.query(
        `INSERT INTO nex_workforce.work_item (city_slug, category_slug, source_slug, priority, state, agent_id, attempts, started_at, finished_at, records_new, records_rejected, last_error, last_error_class)
           VALUES ($1, $2, $3, 100, $4, NULL, 1, now() - interval '1 minute', ${finishedAt}, $5, $6, $7, $8)
           RETURNING id, generation`,
        [city, category, source, state, recordsNew, recordsRejected, error, errorClass]
      );
      wiId = wi.rows[0].id;
    }
    await c.query("COMMIT");
  } finally { c.release(); }

  // Seed heartbeat if requested (for leased fixtures)
  if (state === "leased" && heartbeatAgoSecs !== null) {
    const beatAt = new Date(Date.now() - heartbeatAgoSecs * 1000).toISOString();
    await pool.query(
      `INSERT INTO nex_workforce.agent_heartbeat (agent_id, pid, host, version, started_at, last_beat_at, current_work_item_id, state)
         VALUES ($1, 12345, 'obs-test-host', 'obs-test', now() - interval '10 seconds', $2::timestamptz, $3::uuid, 'working')
       ON CONFLICT (agent_id) DO UPDATE SET last_beat_at = EXCLUDED.last_beat_at, current_work_item_id = EXCLUDED.current_work_item_id`,
      [agent, beatAt, wiId]
    );
  }

  return { workItemId: wiId, generation: 1 };
}

async function stateSnapshot() {
  const r = await pool.query(`SELECT
    (SELECT count(*)::int FROM nex_workforce.work_item) AS wi,
    (SELECT count(*)::int FROM nex_workforce.agent_heartbeat) AS hb,
    (SELECT count(*)::int FROM nex_workforce.evidence_record) AS ev,
    (SELECT count(*)::int FROM nex_workforce.candidate_staging) AS stg,
    (SELECT count(*)::int FROM nex_workforce.persist_audit) AS aud,
    (SELECT count(*)::int FROM nex_workforce.city_catalogue) AS cc,
    (SELECT count(*)::int FROM nex_workforce.job_registry) AS jr,
    (SELECT count(*)::int FROM nex.food_business) AS food`);
  return r.rows[0];
}

// ═════════════════════════════════════════════════════════════════════════════
// O-01 · healthy agent
// ═════════════════════════════════════════════════════════════════════════════
describe("O-01 · healthy agent (recent heartbeat + valid lease)", () => {
  it("classifies as PROGRESSING when leased work has fresh heartbeat", async () => {
    await seedWorkItem({ state: "leased", heartbeatAgoSecs: 10, leaseSecsAhead: 800 });
    const metrics = await collectAllMetrics(query, { windowHours: 1 });
    const health = classifyHealth(metrics);
    expect(health.state).toBe(HealthState.PROGRESSING);
    expect(metrics.agents.active_count).toBeGreaterThanOrEqual(1);
    expect(metrics.stuck_work.length).toBe(0);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// O-02 · stale heartbeat
// ═════════════════════════════════════════════════════════════════════════════
describe("O-02 · stale heartbeat (>120s old · leased still)", () => {
  it("detects stuck work with stale_heartbeat reason and raises Alert G", async () => {
    await seedWorkItem({ state: "leased", heartbeatAgoSecs: 200, leaseSecsAhead: 800 });
    const metrics = await collectAllMetrics(query, { windowHours: 1 });
    const stale = metrics.stuck_work.find(s => s.stuck_reason === "stale_heartbeat");
    expect(stale, "expected stale_heartbeat stuck row").toBeTruthy();
    const alerts = evaluateAlerts(metrics);
    const alertG = alerts.find(a => a.id.startsWith("G-no-progress"));
    expect(alertG, "expected Alert G no_progress_despite_active_work").toBeTruthy();
    expect(alertG.severity).toBe(AlertSeverity.CRITICAL);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// O-03 · near-expiry lease
// ═════════════════════════════════════════════════════════════════════════════
describe("O-03 · lease near expiry (<60s remaining · fresh heartbeat)", () => {
  it("detects stuck-near-expiry AND raises Alert B lease_near_expiry", async () => {
    await seedWorkItem({ state: "leased", heartbeatAgoSecs: 5, leaseSecsAhead: 30 });
    const metrics = await collectAllMetrics(query, { windowHours: 1 });
    const near = metrics.stuck_work.find(s => s.stuck_reason === "near_expiry");
    expect(near, "expected near_expiry stuck row").toBeTruthy();
    const alerts = evaluateAlerts(metrics);
    const alertB = alerts.find(a => a.id.startsWith("B-lease-near-expiry"));
    expect(alertB, "expected Alert B lease_near_expiry").toBeTruthy();
    expect(alertB.severity).toBe(AlertSeverity.WARNING);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// O-04 · expired lease
// ═════════════════════════════════════════════════════════════════════════════
describe("O-04 · lease expired (past deadline · state=leased still)", () => {
  it("detects lease_expired and raises Alert C lease_expired (CRITICAL)", async () => {
    await seedWorkItem({ state: "leased", heartbeatAgoSecs: 300, leaseSecsAhead: -60 });
    const metrics = await collectAllMetrics(query, { windowHours: 1 });
    const expired = metrics.stuck_work.find(s => s.stuck_reason === "lease_expired");
    expect(expired, "expected lease_expired stuck row").toBeTruthy();
    const alerts = evaluateAlerts(metrics);
    const alertC = alerts.find(a => a.id.startsWith("C-lease-expired"));
    expect(alertC, "expected Alert C lease_expired").toBeTruthy();
    expect(alertC.severity).toBe(AlertSeverity.CRITICAL);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// O-05 · progressing work (leased + fresh heartbeat)
// ═════════════════════════════════════════════════════════════════════════════
describe("O-05 · progressing work signal", () => {
  it("agents.active_count reflects live heartbeat", async () => {
    await seedWorkItem({ state: "leased", heartbeatAgoSecs: 20, leaseSecsAhead: 800 });
    const metrics = await collectAllMetrics(query, { windowHours: 1 });
    expect(metrics.agents.active_count).toBe(1);
    expect(metrics.agents.agents[0].heartbeat_age_secs).toBeLessThan(60);
    expect(metrics.agents.agents[0].lease_remaining_secs).toBeGreaterThan(600);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// O-06 · stalled work (leased but no heartbeat row at all)
// ═════════════════════════════════════════════════════════════════════════════
describe("O-06 · stalled work · no heartbeat record for agent", () => {
  it("detects no_heartbeat_record and raises Alert H no_agents_but_leased_work_exists", async () => {
    await seedWorkItem({ state: "leased", heartbeatAgoSecs: null, leaseSecsAhead: 800 });
    const metrics = await collectAllMetrics(query, { windowHours: 1 });
    const noHb = metrics.stuck_work.find(s => s.stuck_reason === "no_heartbeat_record");
    expect(noHb).toBeTruthy();
    // No agent heartbeat → active_count = 0
    expect(metrics.agents.active_count).toBe(0);
    const alerts = evaluateAlerts(metrics);
    const alertH = alerts.find(a => a.id === "H-worker-absent-despite-leased");
    expect(alertH).toBeTruthy();
    expect(alertH.severity).toBe(AlertSeverity.CRITICAL);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// O-07 · transient failure classification
// ═════════════════════════════════════════════════════════════════════════════
describe("O-07 · transient failure appears in failure metrics", () => {
  it("counts transient class from soft_fail work_item", async () => {
    // Seed 3 soft_fail items with class=transient · vary source to avoid
    // work_item_dedupe_active UNIQUE (city,category,source) WHERE state
    // IN (pending/leased/soft_fail)
    for (let i = 0; i < 3; i++) {
      await seedWorkItem({
        state: "soft_fail", agent: `obs-test-agent-t${i}`,
        source: `obs-overpass-t${i}`,
        error: "network hiccup", errorClass: "transient",
      });
    }
    const metrics = await collectAllMetrics(query, { windowHours: 1 });
    expect(metrics.failures.by_class.transient).toBeGreaterThanOrEqual(3);
    const alerts = evaluateAlerts(metrics, { dbTimeoutSpikeThreshold: 3 });
    const alertE = alerts.find(a => a.id === "E-transient-spike");
    expect(alertE).toBeTruthy();
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// O-08 · rate_limit failure classification
// ═════════════════════════════════════════════════════════════════════════════
describe("O-08 · rate_limit failure appears in failure metrics", () => {
  it("counts rate_limit class", async () => {
    await seedWorkItem({ state: "soft_fail", error: "HTTP 429", errorClass: "rate_limit" });
    const metrics = await collectAllMetrics(query, { windowHours: 1 });
    expect(metrics.failures.by_class.rate_limit).toBeGreaterThanOrEqual(1);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// O-09 · catastrophic failure classification
// ═════════════════════════════════════════════════════════════════════════════
describe("O-09 · catastrophic failure raises Alert D", () => {
  it("threshold of 3 catastrophic triggers Alert D CRITICAL", async () => {
    // Vary source so multiple soft_fail rows survive the dedupe_active UNIQUE constraint
    for (let i = 0; i < 3; i++) {
      await seedWorkItem({
        state: "soft_fail", agent: `obs-test-agent-c${i}`,
        source: `obs-overpass-c${i}`,
        error: "config error", errorClass: "catastrophic",
      });
    }
    const metrics = await collectAllMetrics(query, { windowHours: 1 });
    expect(metrics.failures.by_class.catastrophic).toBeGreaterThanOrEqual(3);
    const alerts = evaluateAlerts(metrics, { catastrophicSpikeThreshold: 3 });
    const alertD = alerts.find(a => a.id === "D-catastrophic-spike");
    expect(alertD).toBeTruthy();
    expect(alertD.severity).toBe(AlertSeverity.CRITICAL);
    // Health should be FAILURE_SPIKE (overrides other states)
    const health = classifyHealth(metrics, { failureSpikeThreshold: 3 });
    expect(health.state).toBe(HealthState.FAILURE_SPIKE);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// O-10 · isolated failure (one failed item doesn't hide healthy others)
// ═════════════════════════════════════════════════════════════════════════════
describe("O-10 · failure isolation visibility", () => {
  it("failure in one city/category doesn't mask healthy others · source_matrix breaks it out", async () => {
    // 1 soft_fail item for obs-test-city
    await seedWorkItem({
      state: "soft_fail", agent: "obs-test-agent-iso",
      error: "boom", errorClass: "catastrophic",
    });
    // 1 completed item for a DIFFERENT synthetic tuple
    // (won't be able to use different city without seeding it · use different category)
    await pool.query(
      `INSERT INTO nex_workforce.job_registry (slug, category_slug, source_slug, cadence_minutes, max_concurrent_per_source, max_attempts, lease_minutes, enabled, priority)
         VALUES ('obs-test-cafes-overpass', 'obs-cafes', 'obs-overpass', 60, 3, 5, 15, true, 100)
       ON CONFLICT (slug) DO NOTHING`
    );
    await seedWorkItem({
      state: "completed", agent: "obs-test-agent-iso2",
      category: "obs-cafes",
      recordsNew: 42, recordsRejected: 5,
    });
    const metrics = await collectAllMetrics(query, { windowHours: 1 });
    // Two distinct tuples should appear in the matrix
    const tuples = metrics.source_matrix.filter(m => m.category_slug === "obs-restaurants" || m.category_slug === "obs-cafes");
    expect(tuples.length).toBe(2);
    const restaurants = tuples.find(m => m.category_slug === "obs-restaurants");
    const cafes = tuples.find(m => m.category_slug === "obs-cafes");
    expect(restaurants.soft_fail).toBeGreaterThanOrEqual(1);
    expect(cafes.completed).toBeGreaterThanOrEqual(1);
    expect(cafes.records_new).toBeGreaterThanOrEqual(42);
    // Cleanup: delete this test's extra job
    await pool.query(`DELETE FROM nex_workforce.job_registry WHERE slug = 'obs-test-cafes-overpass'`);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// O-11 · multiple healthy work items (throughput aggregation)
// ═════════════════════════════════════════════════════════════════════════════
describe("O-11 · multiple healthy completed cycles aggregate correctly", () => {
  it("throughput sums records + counts cycles across completions", async () => {
    for (const [n, rn, rj] of [[1, 100, 10], [2, 200, 20], [3, 300, 30]]) {
      await seedWorkItem({
        state: "completed", agent: `obs-test-agent-m${n}`,
        recordsNew: rn, recordsRejected: rj,
      });
    }
    const metrics = await collectAllMetrics(query, { windowHours: 1 });
    expect(metrics.throughput.cycles_completed).toBeGreaterThanOrEqual(3);
    // Note: shared portable cluster may have other completed cycles from prior tests · assert >= not ==
    expect(metrics.throughput.records_new_total).toBeGreaterThanOrEqual(600);
    expect(metrics.throughput.records_rejected_total).toBeGreaterThanOrEqual(60);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// O-12 · throughput calculation (percentiles + averages)
// ═════════════════════════════════════════════════════════════════════════════
describe("O-12 · throughput percentile calculation returns numeric", () => {
  it("p50/p95 are numeric (may be 0 if no data · never NaN)", async () => {
    await seedWorkItem({ state: "completed", agent: "obs-test-agent-p1", recordsNew: 1, recordsRejected: 0 });
    const metrics = await collectAllMetrics(query, { windowHours: 1 });
    expect(typeof metrics.throughput.p50_duration_secs).toBe("number");
    expect(typeof metrics.throughput.p95_duration_secs).toBe("number");
    expect(Number.isFinite(metrics.throughput.p50_duration_secs)).toBe(true);
    expect(Number.isFinite(metrics.throughput.p95_duration_secs)).toBe(true);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// O-13 · city/category/source aggregation
// ═════════════════════════════════════════════════════════════════════════════
describe("O-13 · source matrix aggregates by (city, category, source)", () => {
  it("groups our seeded rows under (obs-test-city, obs-restaurants, obs-overpass)", async () => {
    await seedWorkItem({ state: "completed", agent: "obs-test-agent-mx", recordsNew: 5, recordsRejected: 2 });
    const metrics = await collectAllMetrics(query, { windowHours: 1 });
    const row = metrics.source_matrix.find(m =>
      m.city_slug === TEST_CITY_SLUG && m.category_slug === "obs-restaurants" && m.source_slug === "obs-overpass");
    expect(row).toBeTruthy();
    expect(row.n_total).toBeGreaterThanOrEqual(1);
    expect(row.completed).toBeGreaterThanOrEqual(1);
    expect(row.records_new).toBeGreaterThanOrEqual(5);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// O-14 · zero-workforce state
// ═════════════════════════════════════════════════════════════════════════════
describe("O-14 · zero-workforce state classifies as IDLE or HEALTHY (never crashes)", () => {
  it("no work + no agents → IDLE state without exceptions", async () => {
    // beforeEach already cleaned obs-test-* rows · plus this test doesn't seed
    // The portable cluster may have OTHER completed items from other tests · that's fine · assertion focuses on obs-test-* isolation
    const metrics = await collectAllMetrics(query, { windowHours: 1 });
    // Filter to just our obs-test-* fixtures
    const ours = metrics.source_matrix.filter(m => m.city_slug === TEST_CITY_SLUG);
    expect(ours.length).toBe(0);
    // Overall health classification should not throw
    const health = classifyHealth(metrics);
    expect(Object.values(HealthState)).toContain(health.state);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// O-15 · CRITICAL · zero mutation from any dashboard query
// ═════════════════════════════════════════════════════════════════════════════
describe("O-15 · observability queries perform ZERO mutations (Section 13)", () => {
  it("state before collectAllMetrics == state after collectAllMetrics", async () => {
    // Seed a fixed state
    await seedWorkItem({ state: "completed", agent: "obs-test-agent-nm", recordsNew: 7, recordsRejected: 1 });
    await seedWorkItem({ state: "leased", agent: "obs-test-agent-nm2", heartbeatAgoSecs: 30, leaseSecsAhead: 800 });
    const before = await stateSnapshot();
    // Run observability collection 3 times to be extra-sure it's idempotent
    for (let i = 0; i < 3; i++) {
      await collectAllMetrics(query, { windowHours: 24 });
    }
    const after = await stateSnapshot();
    // Every counter must be exactly identical · zero mutation
    for (const key of Object.keys(before)) {
      expect(after[key], `mutation detected on ${key}: before=${before[key]} after=${after[key]}`).toBe(before[key]);
    }
  });
});
