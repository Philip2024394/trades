// Phase 10 · Pre-flight simulation of the FIRST supervisor query.
//
// The supervisor's first DB call is `INSERT INTO nex.worker_heartbeat …`
// via raw `pool.query()` (no SET LOCAL ROLE wrapper). Because I created
// nex_app_runtime with NOINHERIT in Phase 9, this will fail permission-
// denied when run against Project B.
//
// This script proves the outcome BEFORE launching the supervisor · so
// Philip can decide whether to:
//   (a) ALTER ROLE nex_app_runtime INHERIT   · 1 SQL, no code change,
//       loses "fail-loud on forgotten SET ROLE" defence, but membership
//       still enforces RLS-target policies TO nex_brain_app apply.
//   (b) Wrap supervisor + category-walker writes in SET LOCAL ROLE
//       (touches ~25 query sites · significant code change).
//
// Rolls back every INSERT · no rows mutated on Project B.

import pg from "pg";
import { readFileSync } from "node:fs";

const envText = readFileSync(".env.tools.local", "utf8");
const RUNTIME_URL = envText.match(/^NEX_APP_RUNTIME_POSTGRES_URL=(.+)$/m)[1];

console.log("=== Phase 10 · Pre-flight simulation of supervisor's first query ===\n");
console.log("Connecting via NEX_APP_RUNTIME_POSTGRES_URL (session pooler as nex_app_runtime)…\n");

const pool = new pg.Pool({ connectionString: RUNTIME_URL, ssl: { rejectUnauthorized: false }, max: 1 });

const SUPERVISOR_HEARTBEAT_SQL = `
  INSERT INTO nex.worker_heartbeat (worker_id, worker_type, worker_config, last_heartbeat_at, last_status, last_cycle_run_id)
   VALUES ($1, $2, $3, now(), $4, $5::uuid)
   ON CONFLICT (worker_id) DO UPDATE SET
     last_heartbeat_at = EXCLUDED.last_heartbeat_at,
     last_status       = EXCLUDED.last_status,
     last_cycle_run_id = EXCLUDED.last_cycle_run_id,
     worker_config     = EXCLUDED.worker_config
`;
const HEARTBEAT_PARAMS = [
  "phase10-preflight-supervisor",
  "acquisition_supervisor",
  { probe: true, note: "phase10 preflight · rolled back" },
  "STARTING",
  null,
];

async function scenario(label, wrapWithSetRole) {
  console.log(`─── ${label} ───`);
  const c = await pool.connect();
  try {
    await c.query("BEGIN");
    if (wrapWithSetRole) {
      await c.query("SET LOCAL ROLE nex_brain_app");
    }
    const cu = await c.query("SELECT current_user, session_user");
    console.log(`  current_user=${cu.rows[0].current_user} · session_user=${cu.rows[0].session_user}`);
    try {
      await c.query(SUPERVISOR_HEARTBEAT_SQL, HEARTBEAT_PARAMS);
      console.log(`  ✓ INSERT SUCCEEDED (rolled back)`);
      return { ok: true };
    } catch (e) {
      console.log(`  ❌ INSERT FAILED · ${e.code ?? "?"} · ${e.message.split("\n")[0]}`);
      return { ok: false, code: e.code, message: e.message.split("\n")[0] };
    } finally {
      await c.query("ROLLBACK").catch(() => {});
    }
  } finally {
    c.release();
  }
}

try {
  const noRole  = await scenario("Scenario 1 · NO SET ROLE (matches raw pool.query in supervisor)", false);
  console.log("");
  const withRole = await scenario("Scenario 2 · WITH SET LOCAL ROLE nex_brain_app (matches withBrainRole)", true);

  console.log("\n=== Verdict ===");
  if (noRole.ok) {
    console.log("Supervisor's raw pool.query SUCCEEDED. NOINHERIT is not blocking. Safe to launch.");
    process.exit(0);
  } else if (!noRole.ok && withRole.ok) {
    console.log("As predicted: NOINHERIT blocks raw pool.query, but SET LOCAL ROLE works.");
    console.log("");
    console.log("Options to unblock the first workforce cycle:");
    console.log("");
    console.log("  (a) ALTER ROLE nex_app_runtime INHERIT;");
    console.log("      · 1 SQL via Management API · no code change · workforce writes go through.");
    console.log("      · Loses 'fail-loud if a code path forgets SET ROLE' defence.");
    console.log("      · With INHERIT, nex_app_runtime automatically has grants of both nex_brain_app");
    console.log("        AND nex_social_app · no separation at the connection level.");
    console.log("      · Still preserves rolbypassrls=false on app roles (RLS still fires).");
    console.log("      · Still preserves no service_role/postgres membership on app roles.");
    console.log("      · RLS target-role matching: PostgreSQL applies policies TO nex_brain_app when");
    console.log("        the current session has direct or inherited membership in nex_brain_app,");
    console.log("        so nex_app_runtime + INHERIT still gets policies applied correctly.");
    console.log("");
    console.log("  (b) Wrap every write in the supervisor + category-walker + related mjs scripts");
    console.log("      inside BEGIN; SET LOCAL ROLE nex_brain_app; ...; COMMIT/ROLLBACK.");
    console.log("      · ~25 raw pool.query sites across at least 2 files.");
    console.log("      · Significant code change · reviewable but risky for a first observation cycle.");
    console.log("      · Preserves NOINHERIT defence-in-depth.");
    console.log("");
    console.log("Neither option modifies grants, RLS, schema, or environment files.");
    console.log("Both leave app-role attributes (rolbypassrls, role memberships) unchanged.");
    console.log("");
    console.log("HARD STOP · request Philip's decision.");
    process.exit(2);
  } else {
    console.log("BOTH scenarios failed · unexpected. Details:");
    console.log("  no-role:  " + JSON.stringify(noRole));
    console.log("  with-role:" + JSON.stringify(withRole));
    process.exit(3);
  }
} finally {
  await pool.end();
}
