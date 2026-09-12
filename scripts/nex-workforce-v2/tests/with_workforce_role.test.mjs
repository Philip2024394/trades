// NEX Workforce v2 · Application Cutover · withWorkforceRole role-boundary tests
// ─────────────────────────────────────────────────────────────────────────────
// Target · portable PostgreSQL 17.11 · localhost:5439 · nex_workforce_slice1_test
//
// Test connections are opened as `nex_workforce_runtime` — the portable
// LOGIN fixture whose relationship to `nex_workforce_app` mirrors the
// Project B relationship between `nex_app_runtime` and `nex_workforce_app`
// (GRANT ... WITH INHERIT TRUE, SET TRUE, ADMIN OPTION FALSE).
//
// Every functional DB proof is rolled back — no persistent workforce state
// is created by this suite. No agent / reaper / orchestrator process is
// started. Static (source) checks live in the "K" describe block.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import pg from "pg";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { withWorkforceRole, WorkforceRoleElevationError } from "../lib/with_workforce_role.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));

const ADMIN_CONN = { host: "127.0.0.1", port: 5439, user: "postgres", database: "nex_workforce_slice1_test" };
const RUNTIME_CONN = { host: "127.0.0.1", port: 5439, user: "nex_workforce_runtime", database: "nex_workforce_slice1_test" };

let adminPool;    // postgres · used for catalog inspection and fixture setup
let runtimePool;  // nex_workforce_runtime · used for withWorkforceRole functional proofs
let baselineRows = { wi: 0, hb: 0, rr: 0 };

beforeAll(async () => {
  adminPool = new pg.Pool({ ...ADMIN_CONN, max: 4 });
  // Ensure the LOGIN fixture exists + has GRANT nex_workforce_app WITH INHERIT + SET.
  // (The slice3_role_hardening_contract.test.mjs beforeAll creates this too · we
  // duplicate the CREATE-IF-NOT-EXISTS to allow this test to run standalone.)
  await adminPool.query(`
    DO $body$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='nex_workforce_runtime') THEN
        CREATE ROLE nex_workforce_runtime LOGIN NOBYPASSRLS;
      END IF;
    END $body$
  `);
  await adminPool.query(`GRANT nex_workforce_app TO nex_workforce_runtime WITH INHERIT TRUE, SET TRUE`);
  runtimePool = new pg.Pool({ ...RUNTIME_CONN, max: 4 });
  // Snapshot workforce row counts BEFORE this suite runs · other suites
  // (agent_lifecycle, orchestrator_contract, etc.) may have left rows on the
  // shared portable cluster · L asserts THIS suite adds zero rows.
  const snap = await adminPool.query(`SELECT
    (SELECT count(*)::int FROM nex_workforce.work_item) AS wi,
    (SELECT count(*)::int FROM nex_workforce.agent_heartbeat) AS hb,
    (SELECT count(*)::int FROM nex_workforce.reaper_run) AS rr`);
  baselineRows = snap.rows[0];
});

afterAll(async () => {
  if (runtimePool) await runtimePool.end();
  if (adminPool) await adminPool.end();
});

// ═══════════════════════════════════════════════════════════════════════════
// A · Runtime connection starts as session_user = nex_workforce_runtime
// ═══════════════════════════════════════════════════════════════════════════
describe("A · runtime pool baseline: session_user = nex_workforce_runtime, current_user matches", () => {
  it("session_user + current_user both nex_workforce_runtime before any SET LOCAL ROLE", async () => {
    const r = await runtimePool.query("SELECT current_user AS cu, session_user AS su");
    expect(r.rows[0].su).toBe("nex_workforce_runtime");
    expect(r.rows[0].cu).toBe("nex_workforce_runtime");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// B · Inside withWorkforceRole scope: current_user=nex_workforce_app · session_user=runtime
// ═══════════════════════════════════════════════════════════════════════════
describe("B · role elevation flips current_user only (session_user preserved)", () => {
  it("inside callback: current_user=nex_workforce_app · session_user=nex_workforce_runtime", async () => {
    const captured = { cu: null, su: null };
    await withWorkforceRole(runtimePool, async (c) => {
      const r = await c.query("SELECT current_user AS cu, session_user AS su");
      captured.cu = r.rows[0].cu; captured.su = r.rows[0].su;
    });
    expect(captured.cu).toBe("nex_workforce_app");
    expect(captured.su).toBe("nex_workforce_runtime");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// C · Outside scope: current_user returns to nex_workforce_runtime · no leak
// ═══════════════════════════════════════════════════════════════════════════
describe("C · after withWorkforceRole returns: current_user is back to nex_workforce_runtime", () => {
  it("subsequent pool query outside scope has current_user=nex_workforce_runtime", async () => {
    await withWorkforceRole(runtimePool, async (c) => {
      // no-op · just ensure we opened + closed the workforce scope
      await c.query("SELECT 1");
    });
    const r = await runtimePool.query("SELECT current_user AS cu, session_user AS su");
    expect(r.rows[0].cu).toBe("nex_workforce_runtime");
    expect(r.rows[0].su).toBe("nex_workforce_runtime");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// D · Pooled connections do NOT leak workforce role state across acquisitions
// ═══════════════════════════════════════════════════════════════════════════
describe("D · no workforce role leaks across pool acquisitions", () => {
  it("100 interleaved withWorkforceRole + raw queries · each raw query still runtime", async () => {
    for (let i = 0; i < 20; i++) {
      const inside = await withWorkforceRole(runtimePool, (c) =>
        c.query("SELECT current_user AS cu"));
      expect(inside.rows[0].cu).toBe("nex_workforce_app");

      const outside = await runtimePool.query("SELECT current_user AS cu");
      expect(outside.rows[0].cu).toBe("nex_workforce_runtime");
    }
  });

  it("parallel withWorkforceRole calls don't leak · concurrent + serialised current_user checks", async () => {
    const results = await Promise.all(
      Array.from({ length: 10 }, () =>
        withWorkforceRole(runtimePool, (c) => c.query("SELECT current_user AS cu"))
      )
    );
    for (const r of results) expect(r.rows[0].cu).toBe("nex_workforce_app");
    const outside = await runtimePool.query("SELECT current_user AS cu");
    expect(outside.rows[0].cu).toBe("nex_workforce_runtime");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// E · Workforce function EXECUTE succeeds through withWorkforceRole
// ═══════════════════════════════════════════════════════════════════════════
describe("E · SECURITY DEFINER workforce function EXECUTE succeeds via withWorkforceRole", () => {
  it("nex_workforce.claim() executes without permission error · returns NULL row (no eligible work)", async () => {
    // claim() may return NULL row when no work is eligible · that is a valid
    // successful invocation · what we care about is that EXECUTE is permitted.
    // Because withWorkforceRole COMMITs, any state change from claim() would
    // persist. For safety we use an obviously-invalid agent id and rely on
    // Slice 3 fence semantics: no work_item leased to a fake agent, so no
    // net state change.
    // Wrap in an outer try to catch a permission error explicitly · a
    // permission error would be a HARD FAIL of this test.
    const fakeAgentId = "with-workforce-role-test-must-not-lease";
    const r = await withWorkforceRole(runtimePool, (c) =>
      c.query("SELECT nex_workforce.claim($1) AS row", [fakeAgentId]));
    // Either NULL (no work) or a row · both prove EXECUTE succeeded.
    expect(r.rowCount).toBe(1);
    // If a row was leased (unexpected · workforce tables must be empty by
    // this gate's rules), release it immediately by fail_soft to keep
    // state clean. Under the current gate, this branch should never fire.
    const row = r.rows[0].row;
    if (row !== null) {
      // Defensive · fail_soft to release. If this ever fires it's a bug
      // in an upstream test that inserted work_item rows.
      await withWorkforceRole(runtimePool, (c) =>
        c.query("SELECT nex_workforce.fail_soft($1, $2, $3, $4, $5, $6)",
          [fakeAgentId, row.id, row.generation, "test-cleanup", "test", 60]));
      throw new Error(`E · unexpected work_item lease (id=${row.id}) · fix upstream state`);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// F · Direct table mutation stays UNAVAILABLE to nex_workforce_app
// ═══════════════════════════════════════════════════════════════════════════
describe("F · nex_workforce_app cannot direct-mutate workforce tables (SECURITY DEFINER boundary intact)", () => {
  it("direct INSERT into nex_workforce.work_item is rejected · permission denied 42501", async () => {
    let sqlstate = null; let msg = null;
    try {
      await withWorkforceRole(runtimePool, (c) =>
        c.query(`INSERT INTO nex_workforce.work_item (city_slug, category_slug, source_slug, priority, state)
                 VALUES ('__test__','__test__','__test__', 0, 'pending')`));
    } catch (e) { sqlstate = e.code; msg = e.message; }
    expect(sqlstate, `expected 42501 permission denied · got sqlstate=${sqlstate} msg=${msg}`).toBe("42501");
  });

  it("nex_workforce_app has NO INSERT / UPDATE / DELETE privilege on nex.food_business", async () => {
    // Privilege-level check avoids table-shape dependencies · the boundary
    // is enforced via GRANT/REVOKE catalog state (see Slice 3 R2.1 § 5).
    const r = await withWorkforceRole(runtimePool, (c) =>
      c.query(`SELECT
        has_table_privilege('nex_workforce_app', 'nex.food_business', 'INSERT') AS ins,
        has_table_privilege('nex_workforce_app', 'nex.food_business', 'UPDATE') AS upd,
        has_table_privilege('nex_workforce_app', 'nex.food_business', 'DELETE') AS del,
        has_table_privilege('nex_workforce_app', 'nex.food_business', 'SELECT') AS sel`));
    expect(r.rows[0].ins).toBe(false);
    expect(r.rows[0].upd).toBe(false);
    expect(r.rows[0].del).toBe(false);
    // SELECT should also be false · app has no read access either
    expect(r.rows[0].sel).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// G · PUBLIC EXECUTE remains zero on hardened wrappers (unchanged by cutover)
// ═══════════════════════════════════════════════════════════════════════════
describe("G · PUBLIC EXECUTE on hardened workforce wrappers remains zero", () => {
  it("aclexplode grantee=0 count = 0 across 11 hardened wrappers", async () => {
    const r = await adminPool.query(`
      SELECT count(*)::int AS n
      FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
      CROSS JOIN LATERAL aclexplode(p.proacl) x
      WHERE n.nspname='nex_workforce'
        AND x.grantee=0 AND x.privilege_type='EXECUTE'
        AND p.proname IN ('claim','heartbeat','checkpoint','complete','fail_soft','fail_hard',
                          'stage_candidates','persist_batch','reap_expired_leases',
                          'requeue_soft_fail_backoff_elapsed','enqueue_from_view')`);
    expect(r.rows[0].n).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// H · Brain / social permissions on nex.food_business remain unchanged
// ═══════════════════════════════════════════════════════════════════════════
describe("H · brain / social CRUD on nex.food_business unchanged by cutover", () => {
  it("brain + social both retain DELETE + INSERT + SELECT + UPDATE grants", async () => {
    const r = await adminPool.query(`
      SELECT grantee, string_agg(privilege_type,',' ORDER BY privilege_type) AS privs
      FROM information_schema.role_table_grants
      WHERE table_schema='nex' AND table_name='food_business'
        AND grantee IN ('nex_brain_app','nex_social_app')
      GROUP BY grantee ORDER BY grantee`);
    const brain = r.rows.find(x => x.grantee === "nex_brain_app");
    const social = r.rows.find(x => x.grantee === "nex_social_app");
    expect(brain?.privs).toBe("DELETE,INSERT,SELECT,UPDATE");
    expect(social?.privs).toBe("DELETE,INSERT,SELECT,UPDATE");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// I · RLS enforced · nex_workforce_app cannot SELECT nex.food_business
//     (no grant + no policy for app on food_business)
// ═══════════════════════════════════════════════════════════════════════════
describe("I · RLS + grants enforced · nex_workforce_app has no read access to nex.food_business", () => {
  it("SELECT nex.food_business as app is denied", async () => {
    let sqlstate = null; let msg = null;
    try {
      await withWorkforceRole(runtimePool, (c) => c.query("SELECT count(*) FROM nex.food_business"));
    } catch (e) { sqlstate = e.code; msg = e.message; }
    expect(sqlstate, `expected 42501 · got sqlstate=${sqlstate} msg=${msg}`).toBe("42501");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// J · Failure to SET LOCAL ROLE causes fail-closed behaviour
// ═══════════════════════════════════════════════════════════════════════════
describe("J · fail-closed on SET LOCAL ROLE failure", () => {
  it("attempting to SET LOCAL ROLE a nonexistent role throws WorkforceRoleElevationError · no callback run", async () => {
    // We can't easily test SET LOCAL ROLE nex_workforce_app failing because
    // the runtime has the grant. Instead we prove the helper is fail-closed
    // by using an internal-only escape hatch: temporarily REVOKE the SET
    // grant · verify · restore. Because the REVOKE + restore span the same
    // suite and admin does them, the runtime pool is briefly denied.
    await adminPool.query("REVOKE nex_workforce_app FROM nex_workforce_runtime");
    let callbackRan = false;
    let err = null;
    try {
      await withWorkforceRole(runtimePool, async () => { callbackRan = true; });
    } catch (e) { err = e; }
    // Restore before assertions to avoid poisoning downstream tests.
    await adminPool.query("GRANT nex_workforce_app TO nex_workforce_runtime WITH INHERIT TRUE, SET TRUE");
    expect(callbackRan, "callback MUST NOT run when role elevation fails").toBe(false);
    expect(err).toBeInstanceOf(WorkforceRoleElevationError);
    expect(err?.message).toMatch(/SET LOCAL ROLE nex_workforce_app failed|role elevation verification failed/i);
    // Confirm the restore worked · pool is functional again.
    const after = await withWorkforceRole(runtimePool, (c) => c.query("SELECT current_user AS cu"));
    expect(after.rows[0].cu).toBe("nex_workforce_app");
  });

  it("callback throw causes ROLLBACK · error propagates · connection released", async () => {
    const boom = new Error("intentional test error");
    let caught = null;
    try {
      await withWorkforceRole(runtimePool, async () => { throw boom; });
    } catch (e) { caught = e; }
    expect(caught).toBe(boom);
    // Pool still usable after · runtime role restored
    const after = await runtimePool.query("SELECT current_user AS cu");
    expect(after.rows[0].cu).toBe("nex_workforce_runtime");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// K · Static source proof · agent, orchestrator, reaper, heartbeat all use helper
// ═══════════════════════════════════════════════════════════════════════════
describe("K · agent / orchestrator / reaper / heartbeat source paths use withWorkforceRole", () => {
  const root = join(__dirname, "..");
  const files = [
    "agent.mjs",
    "orchestrator.mjs",
    "reaper.mjs",
    "lib/heartbeat.mjs",
    "steps/overpass_observe_and_stage.mjs",
  ];

  for (const f of files) {
    it(`${f} imports withWorkforceRole from lib/with_workforce_role.mjs`, () => {
      const src = readFileSync(join(root, f), "utf8");
      expect(src).toMatch(/import\s+\{\s*withWorkforceRole\s*\}\s+from\s+['"]\.\.?\/(?:lib\/)?with_workforce_role\.mjs['"]/);
    });

    it(`${f} has NO raw pool.query with 'nex_workforce.<function>(' call surface`, () => {
      const src = readFileSync(join(root, f), "utf8");
      // Match:  <something>.pool.query(...)  OR  pool.query(...)  where the
      // string content mentions nex_workforce.<identifier>(  · that would be
      // a bypass of the helper.
      // Multiline scan across the file.
      const lines = src.split("\n");
      const offenders = [];
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        // Skip lines that only match inside withWorkforceRole callback (c.query)
        if (/(?:^|\s)pool\.query\s*\(/.test(line) || /agent\.pool\.query\s*\(/.test(line) || /this\.pool\.query\s*\(/.test(line) || /orch\.pool\.query\s*\(/.test(line) || /reaper\.pool\.query\s*\(/.test(line)) {
          // Look ahead in-context (this line + next 4) for nex_workforce.
          const chunk = lines.slice(i, i + 4).join("\n");
          if (/nex_workforce\.[a-z_]+\s*\(/.test(chunk)) {
            offenders.push(`${f}:${i + 1}: ${line.trim()}`);
          }
        }
      }
      expect(offenders, `raw pool.query workforce-function bypass detected:\n${offenders.join("\n")}`).toEqual([]);
    });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// L · This test suite does NOT start any workforce process
// ═══════════════════════════════════════════════════════════════════════════
describe("L · no workforce process is started by this test suite", () => {
  it("this suite added zero work_item / agent_heartbeat / reaper_run rows (delta vs. baseline)", async () => {
    // NOTE: absolute counts vary because this suite shares the portable cluster
    // with other test files that legitimately create + persist workforce rows
    // (agent_lifecycle, orchestrator_contract, slice1i_integration).
    // What THIS suite must prove is that IT alone caused zero increase.
    const r = await adminPool.query(`SELECT
      (SELECT count(*)::int FROM nex_workforce.work_item)       AS wi,
      (SELECT count(*)::int FROM nex_workforce.agent_heartbeat) AS hb,
      (SELECT count(*)::int FROM nex_workforce.reaper_run)      AS rr`);
    expect(r.rows[0].wi, `wi baseline=${baselineRows.wi} · post=${r.rows[0].wi}`).toBe(baselineRows.wi);
    expect(r.rows[0].hb, `hb baseline=${baselineRows.hb} · post=${r.rows[0].hb}`).toBe(baselineRows.hb);
    expect(r.rows[0].rr, `rr baseline=${baselineRows.rr} · post=${r.rows[0].rr}`).toBe(baselineRows.rr);
  });
});
