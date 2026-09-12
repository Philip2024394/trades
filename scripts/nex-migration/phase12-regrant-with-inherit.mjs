// Phase 12 · Option A′ · re-grant memberships with WITH INHERIT TRUE, SET TRUE
// to fix the PG16+ pg_auth_members.inherit_option=false that Phase 11 surfaced.
//
// Executes EXACTLY two SQL statements against Project B via Management API:
//   GRANT nex_brain_app  TO nex_app_runtime WITH INHERIT TRUE, SET TRUE;
//   GRANT nex_social_app TO nex_app_runtime WITH INHERIT TRUE, SET TRUE;
//
// Then runs every verification Philip enumerated, PLUS explicit invariant
// snapshots proving Project B schema/RLS/grants are unchanged outside the
// two membership-option flips, PLUS a local nex_dev + Scheduled Task + no-
// workers check.

import pg from "pg";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

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

console.log("=== Phase 12 · Option A′ · WITH INHERIT TRUE, SET TRUE + full re-verify ===\n");

// ── Step 0 · Pre-GRANT snapshot (attrs + memberships + invariants) ──
console.log("Step 0 · Pre-GRANT snapshot");
const preAttrs = await mgmt(`
  SELECT rolname, rolinherit, rolcanlogin, rolbypassrls, rolsuper
    FROM pg_roles WHERE rolname IN ('nex_app_runtime','nex_brain_app','nex_social_app')
   ORDER BY rolname`);
for (const r of preAttrs) console.log(`  ${r.rolname}: inherit=${r.rolinherit} login=${r.rolcanlogin} bypassrls=${r.rolbypassrls} super=${r.rolsuper}`);
const preMemberships = await mgmt(`
  SELECT r.rolname AS member, g.rolname AS group_role, am.admin_option, am.set_option, am.inherit_option
    FROM pg_auth_members am
    JOIN pg_roles r ON r.oid = am.member
    JOIN pg_roles g ON g.oid = am.roleid
   WHERE r.rolname IN ('nex_app_runtime','nex_brain_app','nex_social_app')
   ORDER BY r.rolname, g.rolname`);
console.log(`  memberships (${preMemberships.length}):`);
for (const m of preMemberships) console.log(`    ${m.member} → ${m.group_role} · admin=${m.admin_option} set=${m.set_option} inherit=${m.inherit_option}`);
const preInv = (await mgmt(`
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
console.log(`  invariants: nex_tables=${preInv.nex_tables} rls=${preInv.rls} fks=${preInv.fks} policies=${preInv.policies} matview=${preInv.matview} kr=${preInv.kr} wj=${preInv.wj} wr=${preInv.wr}`);
const preSchemaUsage = (await mgmt(`
  SELECT has_schema_privilege('nex_app_runtime', 'nex', 'USAGE') AS usage,
         has_table_privilege('nex_app_runtime', 'nex.worker_heartbeat', 'INSERT') AS ins`))[0];
console.log(`  effective (pre): nex_app_runtime · nex USAGE=${preSchemaUsage.usage} · worker_heartbeat INSERT=${preSchemaUsage.ins}`);

// ── Step 1 · Execute the two approved GRANTs (only) ────────────────
console.log("\nStep 1 · GRANT nex_brain_app TO nex_app_runtime WITH INHERIT TRUE, SET TRUE;");
await mgmt(`GRANT nex_brain_app TO nex_app_runtime WITH INHERIT TRUE, SET TRUE;`);
console.log("  ✓ executed");
console.log("Step 1b · GRANT nex_social_app TO nex_app_runtime WITH INHERIT TRUE, SET TRUE;");
await mgmt(`GRANT nex_social_app TO nex_app_runtime WITH INHERIT TRUE, SET TRUE;`);
console.log("  ✓ executed");

// ── Step 2 · Confirm ONLY inherit_option flipped on both memberships ─
console.log("\nStep 2 · Confirm exactly inherit_option=true on both memberships · nothing else changed");
const postMemberships = await mgmt(`
  SELECT r.rolname AS member, g.rolname AS group_role, am.admin_option, am.set_option, am.inherit_option
    FROM pg_auth_members am
    JOIN pg_roles r ON r.oid = am.member
    JOIN pg_roles g ON g.oid = am.roleid
   WHERE r.rolname IN ('nex_app_runtime','nex_brain_app','nex_social_app')
   ORDER BY r.rolname, g.rolname`);
console.log(`  memberships now (${postMemberships.length}):`);
for (const m of postMemberships) console.log(`    ${m.member} → ${m.group_role} · admin=${m.admin_option} set=${m.set_option} inherit=${m.inherit_option}`);

const brainMbr  = postMemberships.find((m) => m.member === "nex_app_runtime" && m.group_role === "nex_brain_app");
const socialMbr = postMemberships.find((m) => m.member === "nex_app_runtime" && m.group_role === "nex_social_app");
T("nex_brain_app membership · inherit_option = true",  brainMbr && brainMbr.inherit_option  === true);
T("nex_brain_app membership · set_option = true",      brainMbr && brainMbr.set_option      === true);
T("nex_brain_app membership · admin_option = false",   brainMbr && brainMbr.admin_option    === false);
T("nex_social_app membership · inherit_option = true", socialMbr && socialMbr.inherit_option === true);
T("nex_social_app membership · set_option = true",     socialMbr && socialMbr.set_option     === true);
T("nex_social_app membership · admin_option = false",  socialMbr && socialMbr.admin_option   === false);

// Only these two membership rows should differ · exactly the two options flipped
const beforeMap = new Map(preMemberships.map((m) => [`${m.member}→${m.group_role}`, m]));
const afterMap  = new Map(postMemberships.map((m) => [`${m.member}→${m.group_role}`, m]));
T("membership edge count unchanged (still 2)",
  postMemberships.length === preMemberships.length && postMemberships.length === 2,
  `pre=${preMemberships.length} post=${postMemberships.length}`);
for (const [k, post] of afterMap) {
  const pre = beforeMap.get(k);
  if (!pre) { T(`unexpected NEW membership row: ${k}`, false); continue; }
  const changedKeys = ["admin_option","set_option","inherit_option"].filter((f) => pre[f] !== post[f]);
  if (k.startsWith("nex_app_runtime→")) {
    T(`${k} · only inherit_option changed (false → true)`,
      changedKeys.length === 1 && changedKeys[0] === "inherit_option" && pre.inherit_option === false && post.inherit_option === true,
      `changed=${changedKeys.join(",")}`);
  } else {
    T(`${k} · byte-identical (no unrelated drift)`,
      changedKeys.length === 0, `unexpected changes=${changedKeys.join(",")}`);
  }
}

// ── Step 3 · Role attributes unchanged ──────────────────────────────
console.log("\nStep 3 · Role attributes unchanged by GRANT");
const postAttrs = await mgmt(`
  SELECT rolname, rolinherit, rolcanlogin, rolbypassrls, rolsuper
    FROM pg_roles WHERE rolname IN ('nex_app_runtime','nex_brain_app','nex_social_app')
   ORDER BY rolname`);
for (const r of postAttrs) {
  const prev = preAttrs.find((x) => x.rolname === r.rolname);
  const diffs = Object.keys(r).filter((k) => k !== "rolname" && r[k] !== prev[k]);
  T(`${r.rolname} attributes byte-identical (rolinherit/login/bypassrls/super)`,
    diffs.length === 0, diffs.length ? `unexpected diff=${diffs.join(",")}` : "unchanged");
  T(`${r.rolname}.rolbypassrls still false`, r.rolbypassrls === false);
}

// ── Step 4 · No new dangerous memberships crept in ──────────────────
console.log("\nStep 4 · No service_role / postgres / supabase_admin membership on app or runtime roles");
const dangerous = postMemberships.filter((m) =>
  ["nex_app_runtime","nex_brain_app","nex_social_app"].includes(m.member) &&
  ["service_role","postgres","supabase_admin"].includes(m.group_role));
T("no dangerous memberships anywhere", dangerous.length === 0,
  dangerous.length ? dangerous.map((m) => `${m.member}→${m.group_role}`).join(", ") : "clean");

// Also verify the full inbound membership roster for both app roles.
const brainMembers = await mgmt(`
  SELECT r.rolname FROM pg_auth_members am JOIN pg_roles r ON r.oid=am.member
   JOIN pg_roles g ON g.oid=am.roleid WHERE g.rolname='nex_brain_app' ORDER BY r.rolname`);
const socialMembers = await mgmt(`
  SELECT r.rolname FROM pg_auth_members am JOIN pg_roles r ON r.oid=am.member
   JOIN pg_roles g ON g.oid=am.roleid WHERE g.rolname='nex_social_app' ORDER BY r.rolname`);
console.log(`  nex_brain_app members:  [${brainMembers.map((r) => r.rolname).join(", ")}]`);
console.log(`  nex_social_app members: [${socialMembers.map((r) => r.rolname).join(", ")}]`);
T("nex_brain_app members exactly {postgres, nex_app_runtime}",
  brainMembers.length === 2 && brainMembers.some((r) => r.rolname === "postgres") && brainMembers.some((r) => r.rolname === "nex_app_runtime"));
T("nex_social_app members exactly {postgres, nex_app_runtime}",
  socialMembers.length === 2 && socialMembers.some((r) => r.rolname === "postgres") && socialMembers.some((r) => r.rolname === "nex_app_runtime"));

// ── Step 5 · Schema/RLS/policy/matview/public invariants unchanged ──
console.log("\nStep 5 · Schema invariants unchanged by GRANT");
const postInv = (await mgmt(`
  SELECT
    (SELECT count(*)::int FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='nex' AND c.relkind='r') AS nex_tables,
    (SELECT count(*)::int FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='nex' AND c.relkind='r' AND c.relrowsecurity=true) AS rls,
    (SELECT count(*)::int FROM pg_constraint c JOIN pg_namespace n ON n.oid=c.connamespace WHERE n.nspname='nex' AND c.contype='f') AS fks,
    (SELECT count(*)::int FROM pg_policy p JOIN pg_class c ON c.oid=p.polrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='nex') AS policies,
    (SELECT count(*)::int FROM nex.food_business_value) AS matview,
    (SELECT count(*)::int FROM public.knowledge_records) AS kr,
    (SELECT count(*)::int FROM public.worker_jobs) AS wj,
    (SELECT count(*)::int FROM public.worker_results) AS wr`))[0];
T(`nex tables unchanged (${preInv.nex_tables} → ${postInv.nex_tables})`, postInv.nex_tables === preInv.nex_tables && postInv.nex_tables === 191);
T(`RLS-enabled unchanged (${preInv.rls} → ${postInv.rls})`, postInv.rls === preInv.rls && postInv.rls === 92);
T(`FK count unchanged (${preInv.fks} → ${postInv.fks})`, postInv.fks === preInv.fks && postInv.fks === 125);
T(`RLS policies unchanged (${preInv.policies} → ${postInv.policies})`, postInv.policies === preInv.policies && postInv.policies === 140);
T(`matview unchanged (${preInv.matview} → ${postInv.matview})`, postInv.matview === preInv.matview && postInv.matview === 22750);
T(`public.knowledge_records unchanged (${preInv.kr} → ${postInv.kr})`, postInv.kr === preInv.kr && postInv.kr === 3627);
T(`public.worker_jobs unchanged (${preInv.wj} → ${postInv.wj})`, postInv.wj === preInv.wj && postInv.wj === 19167);
T(`public.worker_results unchanged (${preInv.wr} → ${postInv.wr})`, postInv.wr === preInv.wr && postInv.wr === 19140);

// ── Step 6 · Effective-privilege catalog check ──────────────────────
console.log("\nStep 6 · has_schema_privilege / has_table_privilege now report inherited grants");
const postEff = (await mgmt(`
  SELECT
    has_schema_privilege('nex_app_runtime', 'nex', 'USAGE')                          AS nex_usage,
    has_table_privilege ('nex_app_runtime', 'nex.worker_heartbeat', 'INSERT')        AS wh_insert,
    has_table_privilege ('nex_app_runtime', 'nex.worker_heartbeat', 'SELECT')        AS wh_select,
    has_table_privilege ('nex_app_runtime', 'nex.work_item', 'INSERT')               AS wi_insert,
    has_table_privilege ('nex_app_runtime', 'nex.work_item', 'UPDATE')               AS wi_update,
    has_table_privilege ('nex_app_runtime', 'nex.work_item', 'DELETE')               AS wi_delete,
    has_table_privilege ('nex_app_runtime', 'nex.food_business', 'SELECT')           AS fb_select,
    has_table_privilege ('nex_app_runtime', 'nex.social_admin_access_log', 'INSERT') AS sal_insert,
    has_sequence_privilege('nex_app_runtime', 'nex.social_admin_access_log_access_id_seq', 'USAGE') AS seq_usage,
    -- Negative expectations: no public.* grants should have crept in.
    has_table_privilege ('nex_app_runtime', 'public.knowledge_records', 'SELECT')    AS kr_select
`))[0];
T(`nex_app_runtime has USAGE on nex (was ${preSchemaUsage.usage}, now ${postEff.nex_usage})`, postEff.nex_usage === true);
T("nex_app_runtime has INSERT on nex.worker_heartbeat via inheritance", postEff.wh_insert === true);
T("nex_app_runtime has SELECT on nex.worker_heartbeat via inheritance", postEff.wh_select === true);
T("nex_app_runtime has INSERT on nex.work_item via inheritance", postEff.wi_insert === true);
T("nex_app_runtime has UPDATE on nex.work_item via inheritance", postEff.wi_update === true);
T("nex_app_runtime has DELETE on nex.work_item via inheritance", postEff.wi_delete === true);
T("nex_app_runtime has SELECT on nex.food_business via inheritance", postEff.fb_select === true);
T("nex_app_runtime has INSERT on nex.social_admin_access_log via inheritance", postEff.sal_insert === true);
T("nex_app_runtime has USAGE on social sequence via inheritance", postEff.seq_usage === true);
T("nex_app_runtime does NOT have SELECT on public.knowledge_records (negative test)", postEff.kr_select === false);

// ── Step 7 · Runtime proof via session pooler · raw path + RLS ──────
console.log("\nStep 7 · Runtime proof via session pooler as nex_app_runtime");
const pool = new pg.Pool({ connectionString: RUNTIME_URL, ssl: { rejectUnauthorized: false }, max: 2 });

const SUPERVISOR_HEARTBEAT_SQL = `
  INSERT INTO nex.worker_heartbeat (worker_id, worker_type, worker_config, last_heartbeat_at, last_status, last_cycle_run_id)
   VALUES ($1, $2, $3, now(), $4, $5::uuid)
   ON CONFLICT (worker_id) DO UPDATE SET
     last_heartbeat_at = EXCLUDED.last_heartbeat_at,
     last_status       = EXCLUDED.last_status,
     last_cycle_run_id = EXCLUDED.last_cycle_run_id,
     worker_config     = EXCLUDED.worker_config`;
const HEARTBEAT_PARAMS = ["phase12-preflight-supervisor","acquisition_supervisor",
  { probe: true, note: "phase12 preflight · rolled back" }, "idle", null];

try {
  // Scenario A · raw pool.query WITHOUT SET LOCAL ROLE · matches supervisor code
  {
    const c = await pool.connect();
    try {
      await c.query("BEGIN");
      const cu = await c.query("SELECT current_user, session_user");
      console.log(`  raw path · current_user=${cu.rows[0].current_user} · session_user=${cu.rows[0].session_user}`);
      try {
        await c.query(SUPERVISOR_HEARTBEAT_SQL, HEARTBEAT_PARAMS);
        T("A · raw pool.query INSERT nex.worker_heartbeat SUCCEEDS (rolled back)", true, "INSERT accepted");
      } catch (e) {
        T("A · raw pool.query INSERT nex.worker_heartbeat SUCCEEDS (rolled back)",
          false, `${e.code} · ${e.message.split("\n")[0]}`);
      } finally { await c.query("ROLLBACK").catch(() => {}); }
    } finally { c.release(); }
  }

  // Scenario B · raw pool.query into RLS-guarded table · MUST reach RLS and be rejected
  // (Philip: "raw pool.query() → inherited app privileges → reaches table → RLS evaluates → unauthorized operation rejected")
  console.log("\n  Critical test (Philip-required) · raw path reaches RLS not permission-denied:");
  {
    const c = await pool.connect();
    try {
      await c.query("BEGIN");
      try {
        await c.query(`
          INSERT INTO nex.social_admin_access_log (admin_user_id, target_tenant_id, resource, reason)
          VALUES ('phase12-fake-admin', gen_random_uuid(), 'phase12-fake-res', 'phase12-fake-reason')`);
        T("B · raw INSERT into RLS-guarded table BLOCKED (positive test)", false,
          "INSERT SUCCEEDED · RLS did not fire · REGRESSION");
      } catch (e) {
        const rlsBlocked = /row-level security|row level security/i.test(e.message);
        const permDenied = /permission denied/i.test(e.message);
        if (permDenied && !rlsBlocked) {
          T("B · raw INSERT into RLS-guarded table BLOCKED via RLS (not perm-denied)",
            false, `still permission-denied · INHERIT did not take effect · ${e.message.split("\n")[0]}`);
        } else {
          T("B · raw INSERT into RLS-guarded table BLOCKED via RLS (not perm-denied)",
            rlsBlocked, rlsBlocked ? "reached RLS · correctly rejected" : `unexpected: ${e.code} ${e.message.split("\n")[0]}`);
        }
      }
      await c.query("ROLLBACK").catch(() => {});
    } finally { c.release(); }
  }

  // Scenario C · Explicit withBrainRole path still works
  {
    const c = await pool.connect();
    try {
      await c.query("BEGIN");
      await c.query("SET LOCAL ROLE nex_brain_app");
      const cu = await c.query("SELECT current_user, session_user");
      T("C · SET LOCAL ROLE nex_brain_app · current_user switches", cu.rows[0].current_user === "nex_brain_app");
      T("C · SET LOCAL ROLE nex_brain_app · session_user unchanged", cu.rows[0].session_user === "nex_app_runtime");
      const r = await c.query("SELECT count(*)::text AS n FROM nex.food_business");
      T("C · SELECT nex.food_business via SET LOCAL ROLE nex_brain_app", r.rows[0].n === "22750", `count=${r.rows[0].n}`);
      await c.query("ROLLBACK");
    } catch (e) {
      T("C · withBrainRole path still works", false, e.message);
    } finally { c.release(); }
  }

  // Scenario D · Explicit withSocialRole path still works · RLS positive rejection
  {
    const c = await pool.connect();
    try {
      await c.query("BEGIN");
      await c.query("SET LOCAL ROLE nex_social_app");
      const cu = await c.query("SELECT current_user, session_user");
      T("D · SET LOCAL ROLE nex_social_app · current_user switches", cu.rows[0].current_user === "nex_social_app");
      T("D · SET LOCAL ROLE nex_social_app · session_user unchanged", cu.rows[0].session_user === "nex_app_runtime");
      try {
        await c.query(`
          INSERT INTO nex.social_admin_access_log (admin_user_id, target_tenant_id, resource, reason)
          VALUES ('phase12-fake-social', gen_random_uuid(), 'phase12', 'phase12')`);
        T("D · SET LOCAL ROLE nex_social_app · RLS still blocks unauthorized INSERT",
          false, "INSERT SUCCEEDED · RLS did not fire");
      } catch (e) {
        const rlsBlocked = /row-level security|row level security/i.test(e.message);
        T("D · SET LOCAL ROLE nex_social_app · RLS still blocks unauthorized INSERT",
          rlsBlocked, rlsBlocked ? "correctly rejected" : `unexpected: ${e.message.split("\n")[0]}`);
      }
      await c.query("ROLLBACK");
    } finally { c.release(); }
  }

  // Scenario E · No access to public.* via raw path
  {
    const c = await pool.connect();
    try {
      let denied = false;
      try {
        await c.query("SELECT count(*) FROM public.knowledge_records");
      } catch (e) {
        denied = /permission denied/i.test(e.message);
        T("E · raw path · nex_app_runtime still denied on public.knowledge_records",
          denied, denied ? "correctly rejected" : `unexpected: ${e.message}`);
      }
      if (!denied) T("E · raw path · nex_app_runtime still denied on public.knowledge_records",
        false, "query SUCCEEDED · public grant leaked");
    } finally { c.release(); }
  }
} finally {
  await pool.end();
}

// ── Step 8 · Local nex_dev untouched ────────────────────────────────
console.log("\nStep 8 · Local nex_dev accessible and unchanged");
try {
  const localPool = new pg.Pool({ connectionString: "postgresql://postgres:Admin1phil@localhost:5433/nex_dev", max: 1, connectionTimeoutMillis: 5000 });
  const c = await localPool.connect();
  try {
    const r = await c.query(`
      SELECT
        (SELECT count(*)::int FROM nex.food_business)       AS fb,
        (SELECT count(*)::int FROM nex.identity_merge_log)  AS iml,
        (SELECT count(*)::int FROM nex.work_item)           AS wi,
        pg_postmaster_start_time()::text                     AS pg_start,
        pg_size_pretty(pg_database_size(current_database()))  AS db_size`);
    const row = r.rows[0];
    T(`local nex.food_business unchanged (22750)`, row.fb === 22750, `actual=${row.fb}`);
    T(`local nex.identity_merge_log unchanged (1376510)`, row.iml === 1376510, `actual=${row.iml}`);
    T(`local nex.work_item unchanged (10059)`, row.wi === 10059, `actual=${row.wi}`);
    T(`local postgres uptime preserved (started 2026-08-30 14:08:39.446322+07)`,
      row.pg_start.startsWith("2026-08-30 14:08:39"), `actual=${row.pg_start}`);
    console.log(`  local DB size: ${row.db_size}`);
  } finally { c.release(); await localPool.end(); }
} catch (e) {
  T("local nex_dev accessible", false, e.message);
}

// ── Step 9 · Windows Scheduled Task still Disabled ────────────────
console.log("\nStep 9 · Windows Scheduled Task NEX-Acquisition-Workforce still Disabled");
const ps = spawnSync("powershell", ["-NoProfile", "-Command",
  "(Get-ScheduledTask -TaskName 'NEX-Acquisition-Workforce' -ErrorAction SilentlyContinue).State"],
  { encoding: "utf8" });
const taskState = (ps.stdout || "").trim();
T(`Scheduled Task state = Disabled`, taskState === "Disabled", `actual=${taskState || "unknown"}`);

// ── Step 10 · No NEX worker processes running ─────────────────────
console.log("\nStep 10 · No NEX worker processes running");
const psProcs = spawnSync("powershell", ["-NoProfile", "-Command",
  "Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -match 'nex-acquisition|run-outer-watchdog|run-indonesia|run-supervisor|run-production-launcher|run-production-watchdog|run-production-supervisor|_category-walker' } | ForEach-Object { $_.ProcessId }"],
  { encoding: "utf8" });
const runningPids = (psProcs.stdout || "").trim().split(/\s+/).filter(Boolean);
T(`no NEX worker processes running (found ${runningPids.length})`, runningPids.length === 0,
  runningPids.length ? `PIDs: ${runningPids.join(",")}` : "clean");

// ── Summary ──────────────────────────────────────────────────────
console.log(`\n=== Phase 12 result: ${pass} pass · ${fail} fail ===`);
if (fail) {
  console.log("\nFailures:");
  for (const l of failLines) console.log("  " + l);
  process.exit(1);
}
console.log("\n✓ Option A′ complete · workforce NOT launched · awaiting Philip approval for first observation cycle.");
process.exit(0);
