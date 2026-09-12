// Phase 9 · Pre-cutover runtime-auth proof (Path B).
//
// Creates `nex_app_runtime` as a LOGIN role, grants membership in both
// nex_brain_app and nex_social_app WITH SET TRUE, connects through the
// Project B pooler under those credentials, and proves every runtime
// operation the app will need — WITHOUT touching NEX_POSTGRES_URL.
//
// Idempotent: DROP ROLE IF EXISTS + CREATE runs every time so re-runs
// rotate the password and re-verify the whole chain.
//
// On success:
//   · writes the credentialled URL to .env.tools.local as
//     NEX_APP_RUNTIME_POSTGRES_URL (existing gitignored secrets file)
//   · prints the redacted URL + the exact value that will replace
//     .env.local::NEX_POSTGRES_URL when Philip approves cutover
//   · prints the count of the credentials.
//
// On failure:
//   · leaves the role in place so Philip can inspect
//   · reports which assertion failed
//   · exits non-zero.
//
// Does NOT: change NEX_POSTGRES_URL · start a worker · drop the
// migration role · drop the local nex_dev · modify any nex.* data.

import pg from "pg";
import { randomBytes } from "node:crypto";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(__dirname, "..", "..");
const TOOLS_ENV_PATH = resolve(REPO, ".env.tools.local");

const envText = readFileSync(TOOLS_ENV_PATH, "utf8");
const TOKEN = envText.match(/NEX_SUPABASE_ACCESS_TOKEN=(\S+)/)[1];
const REF   = envText.match(/NEX_SUPABASE_PROJECT_REF=(\S+)/)[1];

// --- Management API helper (executes as postgres) --------------------
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

function redactUrl(url) { return url.replace(/:[^:@/]+@/, ":****@"); }

let pass = 0, fail = 0;
const failLines = [];
function T(label, ok, detail) {
  const glyph = ok ? "✓" : "❌";
  const line  = `${glyph} ${label}${detail ? ` · ${detail}` : ""}`;
  console.log(line);
  if (ok) pass++; else { fail++; failLines.push(line); }
}

console.log("=== Phase 9 · Pre-cutover runtime-auth proof (Path B) ===\n");

// --- Step 0 · Verify app-role attributes UNCHANGED from Phase 5 -----
console.log("Step 0 · Confirm app-role attributes still baseline (no BYPASSRLS, no service_role membership)");
const attrsBefore = await mgmt(`
  SELECT rolname, rolinherit, rolcanlogin, rolbypassrls, rolsuper, rolcreaterole
    FROM pg_roles
   WHERE rolname IN ('nex_brain_app','nex_social_app')
   ORDER BY rolname
`);
for (const r of attrsBefore) {
  T(`${r.rolname} rolbypassrls=false`, r.rolbypassrls === false);
  T(`${r.rolname} rolcanlogin=false`,  r.rolcanlogin  === false);
  T(`${r.rolname} rolsuper=false`,     r.rolsuper     === false);
}
const membershipsBefore = await mgmt(`
  SELECT r.rolname AS member, g.rolname AS group_role
    FROM pg_auth_members m
    JOIN pg_roles r ON r.oid = m.member
    JOIN pg_roles g ON g.oid = m.roleid
   WHERE r.rolname IN ('nex_brain_app','nex_social_app')
     AND g.rolname IN ('service_role','postgres','supabase_admin')
`);
T("app roles have NO service_role/postgres/supabase_admin membership", membershipsBefore.length === 0,
  membershipsBefore.length ? `found: ${membershipsBefore.map((m) => `${m.member}→${m.group_role}`).join(", ")}` : "clean");

// --- Step 1 · CREATE nex_app_runtime + memberships WITH SET TRUE ----
const PASSWORD = randomBytes(32).toString("hex"); // 64-char hex · URL-safe
const LOGIN_ROLE = "nex_app_runtime";
console.log(`\nStep 1 · CREATE ${LOGIN_ROLE} LOGIN + GRANT memberships WITH SET TRUE`);
// Rotate: DROP IF EXISTS (idempotent · killing any leftover from a prior
// failed run) then CREATE fresh with a new password.
await mgmt(`
  REVOKE nex_brain_app  FROM ${LOGIN_ROLE};
  REVOKE nex_social_app FROM ${LOGIN_ROLE};
`).catch(() => {}); // ignore if role doesn't exist yet
await mgmt(`DROP ROLE IF EXISTS ${LOGIN_ROLE};`);
await mgmt(`CREATE ROLE ${LOGIN_ROLE} LOGIN PASSWORD '${PASSWORD}' NOINHERIT NOBYPASSRLS NOSUPERUSER NOCREATEROLE NOCREATEDB;`);
// NOINHERIT is deliberate · with INHERIT, the login role auto-gets every
// grant from every group role, which makes it possible to write outside
// the intended scope even without SET ROLE. With NOINHERIT, the login
// role has NO privileges until it explicitly SET ROLEs · exactly what
// Path B requires.
await mgmt(`GRANT nex_brain_app  TO ${LOGIN_ROLE} WITH SET TRUE;`);
await mgmt(`GRANT nex_social_app TO ${LOGIN_ROLE} WITH SET TRUE;`);
console.log(`  ${LOGIN_ROLE} created · password rotated · memberships granted WITH SET TRUE`);

// --- Step 2 · Re-verify app-role attributes UNCHANGED --------------
console.log("\nStep 2 · Re-verify app-role attributes UNCHANGED by the CREATE/GRANT");
const attrsAfter = await mgmt(`
  SELECT rolname, rolbypassrls, rolcanlogin, rolsuper
    FROM pg_roles
   WHERE rolname IN ('nex_brain_app','nex_social_app')
   ORDER BY rolname
`);
for (const r of attrsAfter) {
  T(`${r.rolname} still rolbypassrls=false`, r.rolbypassrls === false);
  T(`${r.rolname} still rolcanlogin=false`,  r.rolcanlogin  === false);
  T(`${r.rolname} still rolsuper=false`,     r.rolsuper     === false);
}
const membershipsAfter = await mgmt(`
  SELECT r.rolname AS member, g.rolname AS group_role
    FROM pg_auth_members m
    JOIN pg_roles r ON r.oid = m.member
    JOIN pg_roles g ON g.oid = m.roleid
   WHERE r.rolname IN ('nex_brain_app','nex_social_app')
     AND g.rolname IN ('service_role','postgres','supabase_admin')
`);
T("app roles STILL have NO service_role/postgres/supabase_admin membership after CREATE",
  membershipsAfter.length === 0,
  membershipsAfter.length ? `found: ${membershipsAfter.map((m) => `${m.member}→${m.group_role}`).join(", ")}` : "clean");

// Also confirm nex_app_runtime's memberships are exactly what we expect.
const runtimeMemberships = await mgmt(`
  SELECT g.rolname AS group_role, am.set_option
    FROM pg_auth_members am
    JOIN pg_roles r ON r.oid = am.member
    JOIN pg_roles g ON g.oid = am.roleid
   WHERE r.rolname = '${LOGIN_ROLE}'
   ORDER BY g.rolname
`);
const brainMbr  = runtimeMemberships.find((m) => m.group_role === "nex_brain_app");
const socialMbr = runtimeMemberships.find((m) => m.group_role === "nex_social_app");
T(`${LOGIN_ROLE} is member of nex_brain_app WITH SET TRUE`,
  brainMbr && brainMbr.set_option === true,
  brainMbr ? `set_option=${brainMbr.set_option}` : "no membership");
T(`${LOGIN_ROLE} is member of nex_social_app WITH SET TRUE`,
  socialMbr && socialMbr.set_option === true,
  socialMbr ? `set_option=${socialMbr.set_option}` : "no membership");
T(`${LOGIN_ROLE} is NOT a member of service_role/postgres/supabase_admin`,
  !runtimeMemberships.some((m) => ["service_role","postgres","supabase_admin"].includes(m.group_role)));

// Verify LOGIN role attributes
const runtimeAttrs = (await mgmt(`
  SELECT rolname, rolinherit, rolcanlogin, rolbypassrls, rolsuper, rolcreaterole, rolcreatedb
    FROM pg_roles WHERE rolname = '${LOGIN_ROLE}'
`))[0];
T(`${LOGIN_ROLE} rolcanlogin=true`,     runtimeAttrs.rolcanlogin  === true);
T(`${LOGIN_ROLE} rolinherit=false`,     runtimeAttrs.rolinherit   === false, "NOINHERIT · privileges only via SET ROLE");
T(`${LOGIN_ROLE} rolbypassrls=false`,   runtimeAttrs.rolbypassrls === false);
T(`${LOGIN_ROLE} rolsuper=false`,       runtimeAttrs.rolsuper     === false);
T(`${LOGIN_ROLE} rolcreaterole=false`,  runtimeAttrs.rolcreaterole === false);
T(`${LOGIN_ROLE} rolcreatedb=false`,    runtimeAttrs.rolcreatedb   === false);

// --- Step 3 · Connect via Project B session pooler --------------------
const RUNTIME_URL = `postgresql://${LOGIN_ROLE}.${REF}:${PASSWORD}@aws-0-eu-west-1.pooler.supabase.com:5432/postgres`;
console.log(`\nStep 3 · Connect via session pooler as ${LOGIN_ROLE}`);
console.log(`  target: ${redactUrl(RUNTIME_URL)}`);

let pool;
try {
  pool = new pg.Pool({ connectionString: RUNTIME_URL, ssl: { rejectUnauthorized: false }, max: 2 });

  // --- Step 4 · Basic session identity ---
  console.log("\nStep 4 · Session identity (baseline · no SET ROLE)");
  {
    const c = await pool.connect();
    try {
      const r = await c.query("SELECT current_user, session_user, current_setting('row_security') AS rs");
      const row = r.rows[0];
      T(`session_user == ${LOGIN_ROLE}`, row.session_user === LOGIN_ROLE, `actual=${row.session_user}`);
      T(`current_user == ${LOGIN_ROLE} before any SET ROLE`, row.current_user === LOGIN_ROLE, `actual=${row.current_user}`);
      T("row_security=on by default", row.rs === "on");
    } finally { c.release(); }
  }

  // --- Step 5 · NOINHERIT means baseline login CANNOT touch nex.* ---
  console.log("\nStep 5 · NOINHERIT · baseline login role has NO nex.* privileges");
  {
    const c = await pool.connect();
    try {
      let ok = false;
      try {
        await c.query("SELECT count(*) FROM nex.food_business");
      } catch (e) {
        ok = /permission denied|does not exist/i.test(e.message);
        T(`${LOGIN_ROLE} CANNOT SELECT nex.food_business without SET ROLE (positive rejection)`,
          ok, ok ? "correctly rejected" : `unexpected error: ${e.message}`);
      }
      if (!ok) T(`${LOGIN_ROLE} CANNOT SELECT nex.food_business without SET ROLE (positive rejection)`,
        false, "query SUCCEEDED unexpectedly");
    } finally { c.release(); }
  }

  // --- Step 6 · SET LOCAL ROLE nex_brain_app · SELECT ---
  console.log("\nStep 6 · SET LOCAL ROLE nex_brain_app · SELECT nex.food_business");
  {
    const c = await pool.connect();
    try {
      await c.query("BEGIN");
      await c.query("SET LOCAL ROLE nex_brain_app");
      const who = await c.query("SELECT current_user, session_user");
      T("current_user == nex_brain_app after SET LOCAL ROLE",
        who.rows[0].current_user === "nex_brain_app", `actual=${who.rows[0].current_user}`);
      T(`session_user still == ${LOGIN_ROLE} (unchanged by SET LOCAL ROLE)`,
        who.rows[0].session_user === LOGIN_ROLE, `actual=${who.rows[0].session_user}`);
      const r = await c.query("SELECT count(*)::text AS n FROM nex.food_business");
      T("SELECT nex.food_business succeeded via SET LOCAL ROLE nex_brain_app",
        r.rows[0].n === "22750", `count=${r.rows[0].n}`);
      await c.query("ROLLBACK");
    } catch (e) {
      T("SELECT via SET LOCAL ROLE nex_brain_app", false, e.message);
      await pool.query("ROLLBACK").catch(() => {});
    } finally { c.release(); }
  }

  // --- Step 7 · INSERT nex.work_item via nex_brain_app · rolled back ---
  console.log("\nStep 7 · INSERT nex.work_item via nex_brain_app · rolled back");
  {
    const c = await pool.connect();
    try {
      await c.query("BEGIN");
      await c.query("SET LOCAL ROLE nex_brain_app");
      // Discover required columns
      const cols = (await c.query(`
        SELECT column_name, data_type, is_nullable, column_default
          FROM information_schema.columns
         WHERE table_schema='nex' AND table_name='work_item'
         ORDER BY ordinal_position
      `)).rows;
      const req = cols.filter((r) => r.is_nullable === "NO" && r.column_default === null);
      function fabValue(col) {
        if (col.column_name === "status")             return "'queued'";
        const t = col.data_type;
        if (t === "uuid")                             return "gen_random_uuid()";
        if (t === "text" || t.includes("char"))      return `'phase9-runtime-auth-${Date.now()}'`;
        if (t === "boolean")                          return "false";
        if (t === "jsonb")                            return "'{}'::jsonb";
        if (t === "json")                             return "'{}'::json";
        if (t.includes("int"))                        return "0";
        if (t.includes("numeric") || t.includes("float") || t.includes("double")) return "0";
        if (t.includes("time"))                       return "now()";
        if (t === "date")                             return "current_date";
        return "NULL";
      }
      const colList = req.map((r) => `"${r.column_name}"`).join(", ");
      const valList = req.map(fabValue).join(", ");
      const sql = req.length > 0
        ? `INSERT INTO nex.work_item (${colList}) VALUES (${valList}) RETURNING work_item_id`
        : `INSERT INTO nex.work_item DEFAULT VALUES RETURNING work_item_id`;
      const r = await c.query(sql);
      T("INSERT nex.work_item via nex_brain_app succeeded (rolled back)",
        !!r.rows[0].work_item_id, `work_item_id=${r.rows[0].work_item_id}`);
      await c.query("ROLLBACK");
    } catch (e) {
      T("INSERT nex.work_item via nex_brain_app", false, e.message);
      await pool.query("ROLLBACK").catch(() => {});
    } finally { c.release(); }
  }

  // --- Step 8 · UPDATE + DELETE nex.work_item via nex_brain_app · rolled back ---
  console.log("\nStep 8 · UPDATE + DELETE nex.work_item via nex_brain_app · rolled back");
  {
    const c = await pool.connect();
    try {
      await c.query("BEGIN");
      await c.query("SET LOCAL ROLE nex_brain_app");
      const upd = await c.query(`
        UPDATE nex.work_item
           SET attempt_count = attempt_count
         WHERE work_item_id IN (SELECT work_item_id FROM nex.work_item LIMIT 1)
      `);
      T("UPDATE nex.work_item via nex_brain_app (rolled back)", upd.rowCount !== null, `rowCount=${upd.rowCount}`);
      const del = await c.query(`
        DELETE FROM nex.work_item
         WHERE work_item_id IN (SELECT work_item_id FROM nex.work_item WHERE 1=0)
      `);
      T("DELETE nex.work_item via nex_brain_app (rolled back · no-op predicate)",
        del.rowCount === 0, `rowCount=${del.rowCount}`);
      await c.query("ROLLBACK");
    } catch (e) {
      T("UPDATE/DELETE nex.work_item via nex_brain_app", false, e.message);
      await pool.query("ROLLBACK").catch(() => {});
    } finally { c.release(); }
  }

  // --- Step 9 · Sequence usage via nex_social_app ---
  console.log("\nStep 9 · Sequence USAGE via nex_social_app");
  {
    const c = await pool.connect();
    try {
      await c.query("BEGIN");
      await c.query("SET LOCAL ROLE nex_social_app");
      const who = await c.query("SELECT current_user");
      T("current_user == nex_social_app after SET LOCAL ROLE",
        who.rows[0].current_user === "nex_social_app", `actual=${who.rows[0].current_user}`);
      const n1 = await c.query("SELECT nextval('nex.social_admin_access_log_access_id_seq'::regclass) AS n");
      const n2 = await c.query("SELECT nextval('nex.social_admin_access_log_access_id_seq'::regclass) AS n");
      T("nextval monotonically advances via nex_social_app",
        Number(n2.rows[0].n) === Number(n1.rows[0].n) + 1, `n1=${n1.rows[0].n} n2=${n2.rows[0].n}`);
      await c.query("ROLLBACK");
    } catch (e) {
      T("sequence USAGE via nex_social_app", false, e.message);
      await pool.query("ROLLBACK").catch(() => {});
    } finally { c.release(); }
  }

  // --- Step 10 · RLS ACTIVELY enforces on nex_social_app INSERT ---
  console.log("\nStep 10 · RLS actively enforces on nex_social_app · unauthorized INSERT rejected");
  {
    const c = await pool.connect();
    try {
      await c.query("BEGIN");
      await c.query("SET LOCAL ROLE nex_social_app");
      try {
        await c.query(`
          INSERT INTO nex.social_admin_access_log (admin_user_id, target_tenant_id, resource, reason)
          VALUES ('phase9-fake-admin', gen_random_uuid(), 'phase9-fake-res', 'phase9-fake-reason')
        `);
        T("RLS blocked unauthorized INSERT (positive test)", false, "INSERT SUCCEEDED · RLS did not enforce · investigate");
      } catch (e) {
        const rlsBlocked = /row-level security|row level security/i.test(e.message);
        T("RLS blocked unauthorized INSERT (positive test)", rlsBlocked,
          rlsBlocked ? "correctly rejected" : `unexpected error: ${e.message}`);
      }
      await c.query("ROLLBACK");
    } finally { c.release(); }
  }

  // --- Step 11 · Cannot access anything outside intended grants ---
  console.log("\nStep 11 · Access denied to public.* which app roles have no grant on");
  {
    const c = await pool.connect();
    try {
      // Even AFTER SET LOCAL ROLE nex_brain_app, no grant on public.knowledge_records
      // means SELECT should fail.
      await c.query("BEGIN");
      await c.query("SET LOCAL ROLE nex_brain_app");
      let denied = false;
      try {
        await c.query("SELECT count(*) FROM public.knowledge_records");
      } catch (e) {
        denied = /permission denied|does not exist/i.test(e.message);
        T("nex_brain_app CANNOT SELECT public.knowledge_records (positive rejection)",
          denied, denied ? "correctly rejected" : `unexpected error: ${e.message}`);
      }
      if (!denied) T("nex_brain_app CANNOT SELECT public.knowledge_records (positive rejection)",
        false, "query SUCCEEDED · app role has an unintended grant");
      await c.query("ROLLBACK");
    } finally { c.release(); }
  }

  // --- Step 12 · Cannot bypass RLS via row_security setting ---
  console.log("\nStep 12 · Cannot bypass RLS by disabling row_security");
  {
    const c = await pool.connect();
    try {
      await c.query("BEGIN");
      await c.query("SET LOCAL ROLE nex_social_app");
      // Turning off row_security causes queries that would apply a policy to
      // FAIL rather than bypass. Prove the setting can't be used to sneak
      // an INSERT past the policy.
      await c.query("SET LOCAL row_security = off");
      try {
        await c.query(`
          INSERT INTO nex.social_admin_access_log (admin_user_id, target_tenant_id, resource, reason)
          VALUES ('phase9-bypass-attempt', gen_random_uuid(), 'x', 'y')
        `);
        T("row_security=off does NOT allow app role to bypass RLS (positive test)",
          false, "INSERT SUCCEEDED · row_security=off leaked bypass");
      } catch (e) {
        // Either "query would be affected by row-level security policy" OR
        // the original RLS rejection — both prove no bypass.
        const stillBlocked = /row-level security|row level security|policy/i.test(e.message);
        T("row_security=off does NOT let app role bypass RLS (positive test)",
          stillBlocked, stillBlocked ? "correctly rejected" : `unexpected error: ${e.message}`);
      }
      await c.query("ROLLBACK");
    } finally { c.release(); }
  }

  // --- Step 13 · Reconnect + pooling behavior ---
  console.log("\nStep 13 · Reconnect + pooling · SET LOCAL never leaks across acquires");
  {
    // Acquire, SET LOCAL ROLE nex_brain_app inside a transaction, release.
    // Then acquire a NEW client · current_user should be LOGIN_ROLE again
    // (proving SET LOCAL is transaction-scoped and pool release doesn't
    // leak role).
    const c1 = await pool.connect();
    try {
      await c1.query("BEGIN");
      await c1.query("SET LOCAL ROLE nex_brain_app");
      const w = await c1.query("SELECT current_user");
      T(`client1 · current_user == nex_brain_app inside tx`, w.rows[0].current_user === "nex_brain_app");
      await c1.query("ROLLBACK");
    } finally { c1.release(); }

    const c2 = await pool.connect();
    try {
      const w = await c2.query("SELECT current_user");
      T(`client2 (fresh acquire) · current_user reset to ${LOGIN_ROLE}`,
        w.rows[0].current_user === LOGIN_ROLE, `actual=${w.rows[0].current_user}`);
      // Prove new client can still SET LOCAL ROLE and run a SELECT.
      await c2.query("BEGIN");
      await c2.query("SET LOCAL ROLE nex_brain_app");
      const r = await c2.query("SELECT count(*)::text AS n FROM nex.food_business");
      T("client2 · SELECT nex.food_business via SET LOCAL ROLE succeeded",
        r.rows[0].n === "22750", `count=${r.rows[0].n}`);
      await c2.query("ROLLBACK");
    } finally { c2.release(); }
  }

  // --- Step 14 · Close pool, reopen · prove new pool works too ---
  console.log("\nStep 14 · Close pool, reopen · new pool can auth + SET ROLE");
  await pool.end();
  pool = new pg.Pool({ connectionString: RUNTIME_URL, ssl: { rejectUnauthorized: false }, max: 1 });
  {
    const c = await pool.connect();
    try {
      await c.query("BEGIN");
      await c.query("SET LOCAL ROLE nex_brain_app");
      const r = await c.query("SELECT count(*)::text AS n FROM nex.work_item");
      T("Fresh pool · SET LOCAL ROLE + SELECT nex.work_item succeeded",
        Number(r.rows[0].n) >= 0, `count=${r.rows[0].n}`);
      await c.query("ROLLBACK");
    } finally { c.release(); }
  }
} finally {
  if (pool) await pool.end();
}

// --- Step 15 · Persist credentialled URL to .env.tools.local -------
if (fail === 0) {
  console.log("\nStep 15 · Persist credentialled URL to .env.tools.local under NEX_APP_RUNTIME_POSTGRES_URL");
  let toolsEnv = readFileSync(TOOLS_ENV_PATH, "utf8");
  const line = `NEX_APP_RUNTIME_POSTGRES_URL=${RUNTIME_URL}`;
  if (/^NEX_APP_RUNTIME_POSTGRES_URL=/m.test(toolsEnv)) {
    toolsEnv = toolsEnv.replace(/^NEX_APP_RUNTIME_POSTGRES_URL=.*$/m, line);
  } else {
    toolsEnv = toolsEnv.trimEnd() + `\n\n# Phase 9 · pre-cutover runtime auth credential (Path B · session pooler)\n# Copy this value into .env.local as NEX_POSTGRES_URL at cutover time.\n${line}\n`;
  }
  writeFileSync(TOOLS_ENV_PATH, toolsEnv);
  console.log(`  written to ${TOOLS_ENV_PATH}`);
  console.log(`  URL (redacted): ${redactUrl(RUNTIME_URL)}`);
  console.log(`  full URL length: ${RUNTIME_URL.length} chars (password 64 hex chars)`);
}

// --- Summary --------------------------------------------------------
console.log(`\n=== Phase 9 result: ${pass} pass · ${fail} fail ===`);
if (fail) {
  console.log("\nFailures:");
  for (const l of failLines) console.log("  " + l);
  console.log(`\nThe login role ${LOGIN_ROLE} was LEFT IN PLACE for inspection.`);
  console.log("To clean up manually: DROP ROLE nex_app_runtime;");
} else {
  console.log("\n✓ Path B end-to-end proof complete.");
  console.log("  · nex_app_runtime created LOGIN + NOINHERIT + WITH SET TRUE memberships");
  console.log("  · Every runtime operation succeeded via SET LOCAL ROLE");
  console.log("  · RLS actively enforced · row_security=off did NOT bypass");
  console.log("  · No unintended access to public.* tables");
  console.log("  · Pool reconnect: SET LOCAL ROLE never leaked across acquires");
  console.log("  · Credentialled URL persisted to .env.tools.local");
  console.log("\nNEXT STEP: cutover value ready for Philip's approval (see hard-stop report).");
}
process.exit(fail === 0 ? 0 : 1);
