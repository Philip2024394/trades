// NEX Workforce v2 · Slice 1e · Orchestrator Contract Test Suite
// ─────────────────────────────────────────────────────────────────────────────
// Target: portable PostgreSQL 17.11 · localhost:5439 · nex_workforce_slice1_test
// Governed by NEX Workforce Fault-Isolation Doctrine v1.
//
// Eleven scenarios (Philip's approved contract):
//   O1  · empty catalogue + registry · 0 enqueued
//   O2  · 5 cities × 3 jobs · 15 enqueued
//   O3  · second tick immediately · 0 enqueued (all tuples already active)
//   O4  · aged finished_at (via view's own cadence predicate) · re-enqueued
//   O5  · disabled city · never enqueued
//   O6  · disabled job · never enqueued
//   O7  · soft_fail with backoff not elapsed · not enqueued
//   O8  · two concurrent orchestrators · 15 total (not 30) · partial index absorbs
//   O8b · explicit R4 partial-index ON CONFLICT syntax proof (raw SQL)
//   O9  · 3 consecutive tick errors → runOrchOnce throws too_many_errors
//   O10 · requestStop mid-loop → graceful exit_code=0
//   O11 · static-code check · orchestrator.mjs contains no forbidden references

import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import pg from "pg";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createOrch, destroyOrch, runOrchOnce, runOrchLoop, requestStop } from "../orchestrator.mjs";

const CONN = {
  host: "127.0.0.1", port: 5439,
  user: "postgres", database: "nex_workforce_slice1_test",
};
const URL = `postgres://postgres@127.0.0.1:5439/nex_workforce_slice1_test`;
const __dirname = dirname(fileURLToPath(import.meta.url));
const ORCH_SRC_PATH = join(__dirname, "..", "orchestrator.mjs");

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
});

async function seedCity(slug, opts = {}) {
  const { enabled = true, priority = 100 } = opts;
  await pool.query(
    `INSERT INTO nex_workforce.city_catalogue (slug, name, enabled, priority) VALUES ($1, $1, $2, $3)`,
    [slug, enabled, priority]
  );
}
async function seedJob(slug, category, source, opts = {}) {
  const { enabled = true, priority = 100, cadenceMinutes = 60, maxAttempts = 5, leaseMinutes = 15, maxConcurrent = 5 } = opts;
  await pool.query(
    `INSERT INTO nex_workforce.job_registry
       (slug, category_slug, source_slug, cadence_minutes, max_concurrent_per_source, max_attempts, lease_minutes, enabled, priority)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [slug, category, source, cadenceMinutes, maxConcurrent, maxAttempts, leaseMinutes, enabled, priority]
  );
}
async function makeOrch(overrides = {}) {
  return createOrch({
    url: URL, intervalMs: 50, maxConsecutiveErrors: 3, logger: silent, poolMax: 2, ...overrides,
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
// O1 · empty
// ═════════════════════════════════════════════════════════════════════════════
describe("O1 · empty catalogue + registry", () => {
  it("tick enqueues 0 · no error", async () => {
    const orch = await makeOrch();
    try {
      const r = await runOrchOnce(orch);
      expect(r.ok).toBe(true);
      expect(r.eligible).toBe(0);
      expect(r.enqueued).toBe(0);
      expect(orch.consecutiveErrors).toBe(0);
    } finally { await destroyOrch(orch); }
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// O2 · 5 × 3 = 15 enqueued
// ═════════════════════════════════════════════════════════════════════════════
describe("O2 · 5 cities × 3 jobs · one tick enqueues 15", () => {
  it("15 pending rows created · matches distinct tuples", async () => {
    for (let i = 0; i < 5; i++) await seedCity(`c${i}`);
    await seedJob("j1", "cat1", "src1");
    await seedJob("j2", "cat2", "src2");
    await seedJob("j3", "cat3", "src3");

    const orch = await makeOrch();
    try {
      const r = await runOrchOnce(orch);
      expect(r.eligible).toBe(15);
      expect(r.enqueued).toBe(15);
      const rows = await pool.query("SELECT COUNT(*)::int AS n, COUNT(DISTINCT (city_slug, category_slug, source_slug))::int AS distinct_tuples FROM nex_workforce.work_item WHERE state='pending'");
      expect(rows.rows[0].n).toBe(15);
      expect(rows.rows[0].distinct_tuples).toBe(15);
    } finally { await destroyOrch(orch); }
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// O3 · second tick enqueues 0
// ═════════════════════════════════════════════════════════════════════════════
describe("O3 · second tick immediately after O2 · 0 enqueued", () => {
  it("all tuples already have active row · view excludes them", async () => {
    for (let i = 0; i < 5; i++) await seedCity(`c${i}`);
    await seedJob("j1", "cat1", "src1");
    await seedJob("j2", "cat2", "src2");
    await seedJob("j3", "cat3", "src3");

    const orch = await makeOrch();
    try {
      const r1 = await runOrchOnce(orch);
      expect(r1.enqueued).toBe(15);
      const r2 = await runOrchOnce(orch);
      expect(r2.eligible).toBe(0);
      expect(r2.enqueued).toBe(0);
    } finally { await destroyOrch(orch); }
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// O4 · aged finished_at → view considers eligible → orchestrator re-enqueues
// (Orchestrator performs NO cadence math · view's own predicate does the work)
// ═════════════════════════════════════════════════════════════════════════════
describe("O4 · aged finished_at (via view's cadence predicate) · re-enqueued", () => {
  it("orchestrator does not calculate cadence · view alone declares eligibility", async () => {
    await seedCity("c1");
    // Short cadence so aged finished_at is unambiguous
    await seedJob("j1", "cat1", "src1", { cadenceMinutes: 5 });

    const orch = await makeOrch();
    try {
      const r1 = await runOrchOnce(orch);
      expect(r1.enqueued).toBe(1);

      // Simulate: claim → complete the row so it enters 'completed' state
      const claimed = (await pool.query("SELECT nex_workforce.claim($1) AS row", ["test-agent"])).rows[0].row;
      expect(claimed).not.toBeNull();
      const cok = (await pool.query("SELECT nex_workforce.complete($1,$2,$3,$4,$5) AS ok",
        ["test-agent", claimed.id, claimed.generation, 1, 0])).rows[0].ok;
      expect(cok).toBe(true);

      // Second tick right after complete · view rejects (cadence NOT elapsed yet · 5 min > 0 seconds)
      const rBefore = await runOrchOnce(orch);
      expect(rBefore.eligible).toBe(0);
      expect(rBefore.enqueued).toBe(0);

      // Age finished_at to 10 minutes ago (past the 5-min cadence)
      // NOTE: we can't UPDATE terminal rows via helpers, but the DB trigger only
      // blocks non-INSERT/UPDATE state changes. Same-state UPDATE on a terminal
      // row is blocked too by the trigger. So we can't age finished_at directly.
      // Workaround for the test: use pg superuser to update via a temporary
      // trigger disable — but that violates the state contract. Better:
      // reduce cadence to 0 minutes so ANY finished_at (even 1 second ago) is
      // past the threshold. Requires the view to say NOW() - INTERVAL '0 min'.
      // Let's use cadence_minutes=0 by updating job_registry (not blocked).
      await pool.query("UPDATE nex_workforce.job_registry SET cadence_minutes = 0 WHERE slug = 'j1'");

      // View now considers cadence elapsed (finished_at > now() - interval '0 min' is false for any past finished_at)
      const rAfter = await runOrchOnce(orch);
      expect(rAfter.eligible).toBe(1);
      expect(rAfter.enqueued).toBe(1);

      // Confirm the newly-enqueued row is distinct from the completed one
      const rows = await pool.query("SELECT state FROM nex_workforce.work_item WHERE city_slug='c1' AND category_slug='cat1' AND source_slug='src1' ORDER BY enqueued_at");
      expect(rows.rows.map((r) => r.state)).toEqual(["completed", "pending"]);
    } finally { await destroyOrch(orch); }
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// O5 · disabled city
// ═════════════════════════════════════════════════════════════════════════════
describe("O5 · disabled city not enqueued", () => {
  it("enabled=false city excluded by view", async () => {
    await seedCity("live-city", { enabled: true });
    await seedCity("dead-city", { enabled: false });
    await seedJob("j1", "cat1", "src1");

    const orch = await makeOrch();
    try {
      const r = await runOrchOnce(orch);
      expect(r.enqueued).toBe(1);
      const rows = await pool.query("SELECT city_slug FROM nex_workforce.work_item WHERE state='pending'");
      expect(rows.rows.map((r) => r.city_slug)).toEqual(["live-city"]);
    } finally { await destroyOrch(orch); }
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// O6 · disabled job
// ═════════════════════════════════════════════════════════════════════════════
describe("O6 · disabled job not enqueued", () => {
  it("enabled=false job excluded by view", async () => {
    await seedCity("c1");
    await seedJob("live-job", "cat1", "src1", { enabled: true });
    await seedJob("dead-job", "cat2", "src2", { enabled: false });

    const orch = await makeOrch();
    try {
      const r = await runOrchOnce(orch);
      expect(r.enqueued).toBe(1);
      const rows = await pool.query("SELECT category_slug FROM nex_workforce.work_item WHERE state='pending'");
      expect(rows.rows.map((r) => r.category_slug)).toEqual(["cat1"]);
    } finally { await destroyOrch(orch); }
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// O7 · soft_fail with backoff not elapsed · not enqueued
// ═════════════════════════════════════════════════════════════════════════════
describe("O7 · soft_fail with backoff pending is NOT enqueued", () => {
  it("view treats soft_fail-in-backoff as active · orchestrator does not create duplicate", async () => {
    await seedCity("c1");
    await seedJob("j1", "cat1", "src1", { cadenceMinutes: 60 });

    const orch = await makeOrch();
    try {
      // First tick creates the row
      await runOrchOnce(orch);
      // Claim + fail_soft with a long backoff
      const row = (await pool.query("SELECT nex_workforce.claim($1) AS row", ["agent-o7"])).rows[0].row;
      expect(row).not.toBeNull();
      const soft = (await pool.query("SELECT nex_workforce.fail_soft($1,$2,$3,$4,$5,$6) AS ok",
        ["agent-o7", row.id, row.generation, "test", "transient", 3600])).rows[0].ok;
      expect(soft).toBe(true);

      // Second tick · view should NOT return this tuple (soft_fail backoff not elapsed)
      const r2 = await runOrchOnce(orch);
      expect(r2.eligible).toBe(0);
      expect(r2.enqueued).toBe(0);
      const rows = await pool.query("SELECT state FROM nex_workforce.work_item");
      expect(rows.rows).toHaveLength(1);
      expect(rows.rows[0].state).toBe("soft_fail");
    } finally { await destroyOrch(orch); }
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// O8 · two concurrent orchestrators · 15 total (not 30)
// ═════════════════════════════════════════════════════════════════════════════
describe("O8 · two concurrent orchestrators produce exactly 15, not 30", () => {
  it("R4 partial index absorbs duplicate inserts", async () => {
    for (let i = 0; i < 5; i++) await seedCity(`c${i}`);
    await seedJob("j1", "cat1", "src1");
    await seedJob("j2", "cat2", "src2");
    await seedJob("j3", "cat3", "src3");

    const [o1, o2] = await Promise.all([makeOrch(), makeOrch()]);
    try {
      const [r1, r2] = await Promise.all([runOrchOnce(o1), runOrchOnce(o2)]);
      const totalEnqueued = r1.enqueued + r2.enqueued;
      expect(totalEnqueued).toBe(15);

      // Verify DB has exactly 15 rows · zero duplicate tuples
      const dbRows = await pool.query(
        "SELECT COUNT(*)::int AS n, COUNT(DISTINCT (city_slug, category_slug, source_slug))::int AS d FROM nex_workforce.work_item"
      );
      expect(dbRows.rows[0].n).toBe(15);
      expect(dbRows.rows[0].d).toBe(15);
    } finally { await destroyOrch(o1); await destroyOrch(o2); }
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// O8b · explicit R4 partial-index ON CONFLICT syntax proof (raw SQL)
// ═════════════════════════════════════════════════════════════════════════════
describe("O8b · R4 partial-index ON CONFLICT syntax is accepted by PostgreSQL", () => {
  it("the exact orchestrator INSERT statement executes against the R4 partial index without arbitration errors", async () => {
    await seedCity("c1");
    await seedJob("j1", "cat1", "src1");

    // Run the EXACT same SQL the orchestrator uses, twice, and verify:
    //   (a) it does not throw "no unique or exclusion constraint matching the ON CONFLICT specification"
    //   (b) second execution enqueues 0 · dedupe works
    const sql = `
      INSERT INTO nex_workforce.work_item
        (city_slug, category_slug, source_slug, priority, state)
      SELECT city_slug, category_slug, source_slug, priority, 'pending'
      FROM nex_workforce.rotation_eligible
      ON CONFLICT (city_slug, category_slug, source_slug)
        WHERE state IN ('pending', 'leased', 'soft_fail')
      DO NOTHING
      RETURNING id
    `;
    const first = await pool.query(sql);
    expect(first.rowCount).toBe(1);
    const second = await pool.query(sql);
    expect(second.rowCount).toBe(0);

    // Also prove: attempting to INSERT a duplicate directly (no ON CONFLICT)
    // fails with the R4 unique constraint — proving the index IS the arbitration target
    await expect(pool.query(
      `INSERT INTO nex_workforce.work_item (city_slug, category_slug, source_slug, generation, state)
       VALUES ('c1', 'cat1', 'src1', 1, 'pending')`
    )).rejects.toThrow(/work_item_dedupe_active/);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// O9 · 3 consecutive tick errors → throw + log too_many_errors
// ═════════════════════════════════════════════════════════════════════════════
describe("O9 · 3 consecutive tick errors → runOrchOnce throws too_many_errors", () => {
  it("logs orch.exit reason=too_many_errors exit_code=1", async () => {
    const logs = [];
    const orch = await makeOrch({ maxConsecutiveErrors: 3, logger: (o) => logs.push(o) });
    try {
      const realPool = orch.pool;
      orch.pool = { query: async () => { throw new Error("persistent DB fault"); }, end: () => realPool.end() };

      const r1 = await runOrchOnce(orch);
      expect(r1.ok).toBe(false);
      const r2 = await runOrchOnce(orch);
      expect(r2.ok).toBe(false);
      await expect(runOrchOnce(orch)).rejects.toThrow(/too_many_errors/);
      const exitLog = logs.find((l) => l.msg === "orch.exit");
      expect(exitLog).toBeDefined();
      expect(exitLog.reason).toBe("too_many_errors");
      expect(exitLog.exit_code).toBe(1);
    } finally { await destroyOrch(orch); }
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// O10 · requestStop mid-loop → graceful exit_code=0
// ═════════════════════════════════════════════════════════════════════════════
describe("O10 · requestStop mid-loop → graceful exit", () => {
  it("loop exits cleanly · logs orch.exit reason=SIGTERM exit_code=0", async () => {
    const logs = [];
    const orch = await makeOrch({ intervalMs: 30, logger: (o) => logs.push(o) });
    try {
      const loopP = runOrchLoop(orch);
      await waitFor(() => orch.tickCount >= 1);
      requestStop(orch, "SIGTERM");
      await loopP;
      const exitLog = logs.find((l) => l.msg === "orch.exit");
      expect(exitLog).toBeDefined();
      expect(exitLog.reason).toBe("SIGTERM");
      expect(exitLog.exit_code).toBe(0);
    } finally { await destroyOrch(orch); }
  }, 10000);
});

// ═════════════════════════════════════════════════════════════════════════════
// O11 · static-code check · orchestrator.mjs contains no forbidden references
// ═════════════════════════════════════════════════════════════════════════════
describe("O11 · orchestrator.mjs has no forbidden scheduling/state references (source-level lint)", () => {
  it("after stripping JS comments, no forbidden term appears · work_item mutation only via approved surface", async () => {
    const src = readFileSync(ORCH_SRC_PATH, "utf8");
    // Strip block comments then line comments
    let cleaned = src.replace(/\/\*[\s\S]*?\*\//g, "");
    cleaned = cleaned.replace(/\/\/[^\n]*/g, "");

    const forbidden = [
      "city_catalogue",
      "job_registry",
      "agent_heartbeat",
      "lease_deadline",
      "finished_at",
      "cadence_minutes",
    ];
    for (const term of forbidden) {
      // Use RegExp for whole-word match to avoid false positives on substrings
      expect(cleaned.match(new RegExp(term, "g")), `forbidden term "${term}" must not appear in orchestrator.mjs (outside comments)`).toBeNull();
    }

    // work_item is allowed only in INSERT INTO context (no reads / joins / cursor aliases)
    const workItemAll = cleaned.match(/nex_workforce\.work_item(?!_dead_letter)/g) ?? [];
    const workItemInserts = cleaned.match(/INSERT INTO\s+nex_workforce\.work_item(?!_dead_letter)/gi) ?? [];
    expect(workItemAll.length, "every reference to nex_workforce.work_item must be an INSERT INTO usage").toBe(workItemInserts.length);

    // Slice 1e / Slice 3 accepted write surfaces (SAME semantic · same 2-SQL-per-tick
    // contract). Either the inline INSERT (pre-Slice 3) or the SECURITY DEFINER
    // wrapper nex_workforce.enqueue_from_view() (Slice 3 hardened). Exactly one
    // of the two must be present (never both · never neither).
    const inlineInsertPresent  = workItemInserts.length >= 1;
    const enqueueWrapperPresent = /nex_workforce\.enqueue_from_view\s*\(/g.test(cleaned);
    expect(
      (inlineInsertPresent ? 1 : 0) + (enqueueWrapperPresent ? 1 : 0),
      "orchestrator must have exactly ONE approved write surface (inline INSERT INTO work_item OR SECURITY DEFINER enqueue_from_view wrapper) · never both · never neither"
    ).toBe(1);

    // Also verify no FROM nex_workforce.work_item · no JOIN nex_workforce.work_item
    expect(cleaned).not.toMatch(/FROM\s+nex_workforce\.work_item/i);
    expect(cleaned).not.toMatch(/JOIN\s+nex_workforce\.work_item/i);
  });
});
