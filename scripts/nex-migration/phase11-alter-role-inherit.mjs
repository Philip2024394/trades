// Phase 11 · Execute the approved single role-attribute change and prove
// every gated invariant.
//
// ONE SQL:
//   ALTER ROLE nex_app_runtime INHERIT;
//
// Verifications (all read-only after the ALTER):
//   1  · nex_app_runtime.rolinherit flipped from false → true
//   2  · nex_app_runtime.rolbypassrls still false
//   3  · nex_app_runtime.rolcanlogin still true (LOGIN preserved)
//   4  · nex_app_runtime.rolsuper still false
//   5  · nex_brain_app.rolbypassrls still false
//   6  · nex_social_app.rolbypassrls still false
//   7  · No new service_role / postgres / supabase_admin membership on
//        nex_brain_app / nex_social_app / nex_app_runtime
//   8  · nex_app_runtime memberships are exactly {nex_brain_app WITH SET,
//        nex_social_app WITH SET}
//   9  · Schema invariants unchanged: 191 tables / 92 RLS / 125 FKs /
//        140 policies / matview 22,750 / public baseline 3627/19167/19140
//   10 · Phase 10 raw-pool.query heartbeat scenario now SUCCEEDS
//   11 · Phase 10 with-SET-LOCAL-ROLE scenario also succeeds (permission
//        surface only · using a valid enum status this time)
//   12 · RLS-active positive test: unauthorized INSERT into
//        nex.social_admin_access_log via nex_social_app STILL rejected
//
// Rolls back every INSERT · zero data mutation on Project B.

import pg from "pg";
import { readFileSync } from "node:fs";

const envTools = readFileSync(".env.tools.local", "utf8");
const TOKEN = envTools.match(/NEX_SUPABASE_ACCESS_TOKEN=(\S+)/)[1];
const REF   = envTools.match(/NEX_SUPABASE_PROJECT_REF=(\S+)/)[1];
const RUNTIME_URL = envTools.match(/^NEX_APP_RUNTIME_POSTGRES_URL=(.+)$/m)[1];

async function mgmt(sql) {
  const r = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: "POST",
    headers: { Authorization: "Bearer " + TOKEN, "Content-Type": "application/json" },
    body: JSON.stringify({ query: sql }),
  });
  const text = await r.text();
  if (r.status >= 400) throw new Error(`mgmt ${r.status}: ${text}`);
  return text ? JSON.parse(text) : [];
}

let pass = 0, fail = 0;
const failLines = [];
function T(label, ok, detail) {
  const glyph = ok ? "✓" : "❌";
  const line = `${glyph} ${label}${detail ? ` · ${detail}` : ""}`;
  console.log(line);
  if (ok) pass++; else { fail++; failLines.push(line); }
}

console.log("=== Phase 11 · ALTER ROLE nex_app_runtime INHERIT + re-verify ===\n");

// ── Step 0 · Pre-ALTER snapshot ─────────────────────────────────────
console.log("Step 0 · Pre-ALTER snapshot");
const preAttrs = (await mgmt(`
  SELECT rolname, rolinherit, rolcanlogin, rolbypassrls, rolsuper, rolcreaterole, rolcreatedb
    FROM pg_roles WHERE rolname IN ('nex_app_runtime','nex_brain_app','nex_social_app')
   ORDER BY rolname
`));
for (const r of preAttrs) {
  console.log(`  ${r.rolname}: inherit=${r.rolinherit} login=${r.rolcanlogin} bypassrls=${r.rolbypassrls} super=${r.rolsuper} createrole=${r.rolcreaterole} createdb=${r.rolcreatedb}`);
}
const preMemberships = await mgmt(`
  SELECT r.rolname AS member, g.rolname AS group_role, am.set_option
    FROM pg_auth_members am
    JOIN pg_roles r ON r.oid = am.member
    JOIN pg_roles g ON g.oid = am.roleid
   WHERE r.rolname IN ('nex_app_runtime','nex_brain_app','nex_social_app')
   ORDER BY r.rolname, g.rolname
`);
console.log(`  memberships (${preMemberships.length}):`);
for (const m of preMemberships) console.log(`    ${m.member} → ${m.group_role} (set_option=${m.set_option})`);
const preInvariants = (await mgmt(`
  SELECT
    (SELECT count(*)::int FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='nex' AND c.relkind='r') AS nex_tables,
    (SELECT count(*)::int FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='nex' AND c.relkind='r' AND c.relrowsecurity=true) AS rls,
    (SELECT count(*)::int FROM pg_constraint c JOIN pg_namespace n ON n.oid=c.connamespace WHERE n.nspname='nex' AND c.contype='f') AS fks,
    (SELECT count(*)::int FROM pg_policy p JOIN pg_class c ON c.oid=p.polrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='nex') AS policies
`))[0];
console.log(`  invariants: nex_tables=${preInvariants.nex_tables} rls=${preInvariants.rls} fks=${preInvariants.fks} policies=${preInvariants.policies}`);

// ── Step 1 · Execute the single approved SQL ────────────────────────
console.log("\nStep 1 · ALTER ROLE nex_app_runtime INHERIT;");
await mgmt(`ALTER ROLE nex_app_runtime INHERIT;`);
console.log("  ✓ executed");

// ── Step 2 · Post-ALTER attribute check · exactly one bit flipped ──
console.log("\nStep 2 · Confirm exactly one role attribute changed (nex_app_runtime.rolinherit false → true)");
const postAttrs = (await mgmt(`
  SELECT rolname, rolinherit, rolcanlogin, rolbypassrls, rolsuper, rolcreaterole, rolcreatedb
    FROM pg_roles WHERE rolname IN ('nex_app_runtime','nex_brain_app','nex_social_app')
   ORDER BY rolname
`));
for (const r of postAttrs) {
  const prev = preAttrs.find((x) => x.rolname === r.rolname);
  const diff = Object.keys(r).filter((k) => k !== "rolname" && r[k] !== prev[k]);
  if (r.rolname === "nex_app_runtime") {
    T(`nex_app_runtime.rolinherit flipped false → true`, r.rolinherit === true && prev.rolinherit === false);
    T(`nex_app_runtime · ONLY rolinherit changed (no other attribute drift)`,
      diff.length === 1 && diff[0] === "rolinherit",
      `diff=${diff.join(",")}`);
    T(`nex_app_runtime.rolcanlogin still true`, r.rolcanlogin === true);
    T(`nex_app_runtime.rolbypassrls still false`, r.rolbypassrls === false);
    T(`nex_app_runtime.rolsuper still false`, r.rolsuper === false);
    T(`nex_app_runtime.rolcreaterole still false`, r.rolcreaterole === false);
    T(`nex_app_runtime.rolcreatedb still false`, r.rolcreatedb === false);
  } else {
    T(`${r.rolname} attributes UNCHANGED by ALTER (byte-identical row)`,
      diff.length === 0, diff.length ? `unexpected diff=${diff.join(",")}` : "unchanged");
    T(`${r.rolname}.rolbypassrls still false`, r.rolbypassrls === false);
    T(`${r.rolname}.rolcanlogin still false`, r.rolcanlogin === false);
  }
}

// ── Step 3 · Memberships unchanged ─────────────────────────────────
console.log("\nStep 3 · Role memberships UNCHANGED by ALTER");
const postMemberships = await mgmt(`
  SELECT r.rolname AS member, g.rolname AS group_role, am.set_option
    FROM pg_auth_members am
    JOIN pg_roles r ON r.oid = am.member
    JOIN pg_roles g ON g.oid = am.roleid
   WHERE r.rolname IN ('nex_app_runtime','nex_brain_app','nex_social_app')
   ORDER BY r.rolname, g.rolname
`);
const sortedPre  = JSON.stringify(preMemberships);
const sortedPost = JSON.stringify(postMemberships);
T(`membership graph byte-identical (${postMemberships.length} edges)`, sortedPre === sortedPost);

// ── Step 4 · No dangerous memberships crept in ─────────────────────
console.log("\nStep 4 · No service_role / postgres / supabase_admin membership on app or runtime roles");
const dangerous = postMemberships.filter((m) =>
  ["nex_app_runtime","nex_brain_app","nex_social_app"].includes(m.member) &&
  ["service_role","postgres","supabase_admin"].includes(m.group_role));
T("no dangerous memberships",
  dangerous.length === 0,
  dangerous.length ? dangerous.map((m) => `${m.member}→${m.group_role}`).join(", ") : "clean");
T("nex_app_runtime memberships are EXACTLY {nex_brain_app WITH SET, nex_social_app WITH SET}", (() => {
  const runtimeMs = postMemberships.filter((m) => m.member === "nex_app_runtime");
  if (runtimeMs.length !== 2) return false;
  const brain  = runtimeMs.find((m) => m.group_role === "nex_brain_app");
  const social = runtimeMs.find((m) => m.group_role === "nex_social_app");
  return brain && social && brain.set_option === true && social.set_option === true;
})());

// ── Step 5 · Schema/RLS/policy invariants unchanged ─────────────────
console.log("\nStep 5 · Schema invariants unchanged by ALTER");
const postInvariants = (await mgmt(`
  SELECT
    (SELECT count(*)::int FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='nex' AND c.relkind='r') AS nex_tables,
    (SELECT count(*)::int FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='nex' AND c.relkind='r' AND c.relrowsecurity=true) AS rls,
    (SELECT count(*)::int FROM pg_constraint c JOIN pg_namespace n ON n.oid=c.connamespace WHERE n.nspname='nex' AND c.contype='f') AS fks,
    (SELECT count(*)::int FROM pg_policy p JOIN pg_class c ON c.oid=p.polrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='nex') AS policies,
    (SELECT count(*)::int FROM nex.food_business_value) AS matview,
    (SELECT count(*)::int FROM public.knowledge_records) AS kr,
    (SELECT count(*)::int FROM public.worker_jobs) AS wj,
    (SELECT count(*)::int FROM public.worker_results) AS wr
`))[0];
T(`nex tables = 191`, postInvariants.nex_tables === 191, `actual=${postInvariants.nex_tables}`);
T(`RLS-enabled tables = 92`, postInvariants.rls === 92, `actual=${postInvariants.rls}`);
T(`FK count = 125`, postInvariants.fks === 125, `actual=${postInvariants.fks}`);
T(`RLS policies = 140`, postInvariants.policies === 140, `actual=${postInvariants.policies}`);
T(`matview = 22750`, postInvariants.matview === 22750);
T(`public.knowledge_records = 3627`, postInvariants.kr === 3627);
T(`public.worker_jobs = 19167`, postInvariants.wj === 19167);
T(`public.worker_results = 19140`, postInvariants.wr === 19140);

// ── Step 6 · Re-run Phase 10 preflight through the pooler ──────────
console.log("\nStep 6 · Re-run Phase 10 preflight · raw pool.query as nex_app_runtime");
const pool = new pg.Pool({ connectionString: RUNTIME_URL, ssl: { rejectUnauthorized: false }, max: 2 });

const SUPERVISOR_HEARTBEAT_SQL = `
  INSERT INTO nex.worker_heartbeat (worker_id, worker_type, worker_config, last_heartbeat_at, last_status, last_cycle_run_id)
   VALUES ($1, $2, $3, now(), $4, $5::uuid)
   ON CONFLICT (worker_id) DO UPDATE SET
     last_heartbeat_at = EXCLUDED.last_heartbeat_at,
     last_status       = EXCLUDED.last_status,
     last_cycle_run_id = EXCLUDED.last_cycle_run_id,
     worker_config     = EXCLUDED.worker_config
`;
// This time use a VALID status value (per the check constraint).
const HEARTBEAT_PARAMS = ["phase11-preflight-supervisor", "acquisition_supervisor",
  { probe: true, note: "phase11 preflight · rolled back" }, "idle", null];

try {
  // Scenario 1 · raw pool.query WITHOUT SET LOCAL ROLE (matches supervisor code)
  {
    const c = await pool.connect();
    try {
      await c.query("BEGIN");
      const cu = await c.query("SELECT current_user, session_user");
      console.log(`  scenario 1 baseline · current_user=${cu.rows[0].current_user} · session_user=${cu.rows[0].session_user}`);
      try {
        await c.query(SUPERVISOR_HEARTBEAT_SQL, HEARTBEAT_PARAMS);
        T("Scenario 1 · raw pool.query INSERT nex.worker_heartbeat SUCCEEDS (rolled back)", true, "INSERT accepted");
      } catch (e) {
        T("Scenario 1 · raw pool.query INSERT nex.worker_heartbeat SUCCEEDS (rolled back)",
          false, `${e.code} · ${e.message.split("\n")[0]}`);
      } finally { await c.query("ROLLBACK").catch(() => {}); }
    } finally { c.release(); }
  }

  // Scenario 2 · same query wrapped in SET LOCAL ROLE nex_brain_app (matches withBrainRole)
  {
    const c = await pool.connect();
    try {
      await c.query("BEGIN");
      await c.query("SET LOCAL ROLE nex_brain_app");
      const cu = await c.query("SELECT current_user, session_user");
      console.log(`  scenario 2 with-SET-ROLE · current_user=${cu.rows[0].current_user} · session_user=${cu.rows[0].session_user}`);
      T("Scenario 2 · current_user == nex_brain_app after SET LOCAL ROLE", cu.rows[0].current_user === "nex_brain_app");
      T("Scenario 2 · session_user still == nex_app_runtime", cu.rows[0].session_user === "nex_app_runtime");
      try {
        await c.query(SUPERVISOR_HEARTBEAT_SQL, HEARTBEAT_PARAMS);
        T("Scenario 2 · same INSERT via SET LOCAL ROLE ALSO succeeds (rolled back)", true);
      } catch (e) {
        T("Scenario 2 · same INSERT via SET LOCAL ROLE ALSO succeeds (rolled back)",
          false, `${e.code} · ${e.message.split("\n")[0]}`);
      } finally { await c.query("ROLLBACK").catch(() => {}); }
    } finally { c.release(); }
  }

  // ── Step 7 · RLS-active positive test ──────────────────────────
  console.log("\nStep 7 · RLS still actively enforces on nex_social_app (positive rejection)");
  {
    const c = await pool.connect();
    try {
      await c.query("BEGIN");
      await c.query("SET LOCAL ROLE nex_social_app");
      try {
        await c.query(`
          INSERT INTO nex.social_admin_access_log (admin_user_id, target_tenant_id, resource, reason)
          VALUES ('phase11-fake-admin', gen_random_uuid(), 'phase11-fake-res', 'phase11-fake-reason')`);
        T("RLS blocked unauthorized INSERT (positive test · nex_social_app path)", false,
          "INSERT SUCCEEDED · RLS did not enforce · REGRESSION");
      } catch (e) {
        const rlsBlocked = /row-level security|row level security/i.test(e.message);
        T("RLS blocked unauthorized INSERT (positive test · nex_social_app path)", rlsBlocked,
          rlsBlocked ? "correctly rejected" : `unexpected error: ${e.message}`);
      }
      await c.query("ROLLBACK").catch(() => {});
    } finally { c.release(); }
  }

  // ── Step 8 · RLS also enforces on the RAW pool.query path (no SET ROLE) ─
  console.log("\nStep 8 · RLS enforcement · raw pool.query path (no SET ROLE) · nex_app_runtime inherits");
  {
    const c = await pool.connect();
    try {
      await c.query("BEGIN");
      const cu = await c.query("SELECT current_user");
      console.log(`  raw path · current_user=${cu.rows[0].current_user}`);
      try {
        await c.query(`
          INSERT INTO nex.social_admin_access_log (admin_user_id, target_tenant_id, resource, reason)
          VALUES ('phase11-inherit-attempt', gen_random_uuid(), 'x', 'y')`);
        T("RLS still enforces on raw pool.query as nex_app_runtime (positive test)", false,
          "INSERT SUCCEEDED · RLS did not fire on inheriting login role · REGRESSION");
      } catch (e) {
        const rlsBlocked = /row-level security|row level security/i.test(e.message);
        // Membership + INHERIT means policies TO nex_social_app apply to nex_app_runtime.
        // Even without SET ROLE, RLS should still fire on WITH CHECK policies.
        T("RLS enforces on raw pool.query path (nex_app_runtime · inherited from nex_social_app)", rlsBlocked,
          rlsBlocked ? "correctly rejected via inherited membership" : `unexpected error: ${e.message}`);
      }
      await c.query("ROLLBACK").catch(() => {});
    } finally { c.release(); }
  }

  // ── Step 9 · No access to public.* ─────────────────────────────
  console.log("\nStep 9 · nex_app_runtime STILL cannot SELECT public.knowledge_records");
  {
    const c = await pool.connect();
    try {
      let denied = false;
      try {
        await c.query("SELECT count(*) FROM public.knowledge_records");
      } catch (e) {
        denied = /permission denied/i.test(e.message);
        T("nex_app_runtime · SELECT public.knowledge_records still denied", denied, denied ? "correctly rejected" : `unexpected: ${e.message}`);
      }
      if (!denied) T("nex_app_runtime · SELECT public.knowledge_records still denied", false,
        "SELECT SUCCEEDED · unintended grant leaked");
    } finally { c.release(); }
  }
} finally {
  await pool.end();
}

console.log(`\n=== Phase 11 result: ${pass} pass · ${fail} fail ===`);
if (fail) {
  console.log("\nFailures:");
  for (const l of failLines) console.log("  " + l);
  process.exit(1);
}
console.log("\nHARD STOP · workforce NOT launched. Awaiting Philip's separate approval for the first observation cycle.");
process.exit(0);
