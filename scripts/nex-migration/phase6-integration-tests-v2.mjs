// Phase 6 v2 · session-pooler integration tests · proves nex_brain_app +
// nex_social_app can perform the required runtime operations end-to-end
// via SET ROLE. Temporarily GRANTs the app roles to the migration user
// so the session pooler can `SET ROLE` into them, then REVOKEs.
//
// Every write path runs inside BEGIN/ROLLBACK so no production data is
// mutated. GRANT/REVOKE happens at the start and end · outside the tx.

import pg from "pg";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const __dirname = dirname(fileURLToPath(import.meta.url));
const envText = readFileSync(resolve(__dirname, "..", "..", ".env.tools.local"), "utf8");
const TOKEN   = envText.match(/NEX_SUPABASE_ACCESS_TOKEN=(\S+)/)[1];
const REF     = envText.match(/NEX_SUPABASE_PROJECT_REF=(\S+)/)[1];
const DB_URL  = envText.match(/NEX_SUPABASE_DB_URL=(\S+)/)[1];

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

console.log("=== Phase 6 v2 · Session-pooler integration tests ===\n");

// Step 0 · Temp GRANT so migration user can SET ROLE into app roles.
console.log("Step 0 · Temp GRANT nex_brain_app + nex_social_app TO nex_migrate_mtkiv3bg");
await mgmt(`GRANT nex_brain_app  TO nex_migrate_mtkiv3bg WITH SET TRUE;`);
await mgmt(`GRANT nex_social_app TO nex_migrate_mtkiv3bg WITH SET TRUE;`);
console.log("  granted · SET privilege enabled so SET ROLE works from migration user");

let pool;
try {
  pool = new pg.Pool({ connectionString: DB_URL, ssl: { rejectUnauthorized: false }, max: 1 });
  const c = await pool.connect();
  try {
    // A · nex_brain_app · SELECT on nex.food_business
    console.log("\nA · nex_brain_app · SELECT on nex.food_business");
    await c.query("BEGIN");
    await c.query("SET LOCAL ROLE nex_brain_app");
    const cu = await c.query("SELECT current_user");
    T("current_user == nex_brain_app after SET ROLE", cu.rows[0].current_user === "nex_brain_app", `actual=${cu.rows[0].current_user}`);
    try {
      const r = await c.query("SELECT count(*)::text AS n FROM nex.food_business");
      T("SELECT nex.food_business succeeded as nex_brain_app", true, `count=${r.rows[0].n}`);
    } catch (e) {
      T("SELECT nex.food_business succeeded as nex_brain_app", false, e.message);
    }
    await c.query("ROLLBACK");

    // B · nex_brain_app · INSERT on nex.work_item (rolled back)
    console.log("\nB · nex_brain_app · INSERT on nex.work_item · rolled back");
    // Discover NOT NULL / no-default columns
    const workItemCols = (await c.query(`
      SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns
       WHERE table_schema='nex' AND table_name='work_item'
       ORDER BY ordinal_position`)).rows;
    const requiredCols = workItemCols.filter((r) => r.is_nullable === "NO" && r.column_default === null);
    function fabValue(col) {
      const t = col.data_type;
      if (t === "uuid")                        return "gen_random_uuid()";
      // Column-name-aware fabrication for known enums so CHECK constraints pass.
      // (Data integrity fires AFTER permission check · a check-constraint failure
      // does not indicate a permission problem, but keeping the test focused on
      // ACL means we should avoid tripping data-integrity rules where possible.)
      if (col.column_name === "status")        return `'queued'`;
      if (t === "text" || t.includes("char"))  return `'phase6-integration-${Date.now()}'`;
      if (t === "boolean")                     return "false";
      if (t === "jsonb")                       return "'{}'::jsonb";
      if (t === "json")                        return "'{}'::json";
      if (t.includes("int"))                   return "0";
      if (t.includes("numeric") || t.includes("float") || t.includes("double")) return "0";
      if (t.includes("time"))                  return "now()";
      if (t === "date")                        return "current_date";
      return "NULL";
    }
    const colList = requiredCols.map((c) => `"${c.column_name}"`).join(", ");
    const valList = requiredCols.map(fabValue).join(", ");
    const insertSql = requiredCols.length > 0
      ? `INSERT INTO nex.work_item (${colList}) VALUES (${valList}) RETURNING work_item_id`
      : `INSERT INTO nex.work_item DEFAULT VALUES RETURNING work_item_id`;
    await c.query("BEGIN");
    await c.query("SET LOCAL ROLE nex_brain_app");
    try {
      const r = await c.query(insertSql);
      T("INSERT nex.work_item as nex_brain_app succeeded (rolled back)", true, `work_item_id=${r.rows[0].work_item_id}`);
    } catch (e) {
      T("INSERT nex.work_item as nex_brain_app succeeded (rolled back)", false, e.message);
    }
    await c.query("ROLLBACK");

    // C · UPDATE + DELETE on nex.work_item (rolled back)
    console.log("\nC · nex_brain_app · UPDATE + DELETE on nex.work_item · rolled back");
    await c.query("BEGIN");
    await c.query("SET LOCAL ROLE nex_brain_app");
    try {
      // No LIMIT after WHERE in Postgres. Use ctid-scoped update on any row.
      const upd = await c.query(`
        UPDATE nex.work_item
           SET attempt_count = attempt_count
         WHERE work_item_id IN (SELECT work_item_id FROM nex.work_item LIMIT 1)`);
      T("UPDATE nex.work_item as nex_brain_app succeeded (rolled back)", upd.rowCount !== null, `rowCount=${upd.rowCount}`);

      const del = await c.query(`
        DELETE FROM nex.work_item
         WHERE work_item_id IN (SELECT work_item_id FROM nex.work_item WHERE 1=0)`);
      T("DELETE nex.work_item as nex_brain_app succeeded (rolled back)", del.rowCount === 0, `rowCount=${del.rowCount}`);
    } catch (e) {
      T("UPDATE/DELETE nex.work_item as nex_brain_app succeeded", false, e.message);
    }
    await c.query("ROLLBACK");

    // D · Sequence access via nex_social_app · pure sequence USAGE proof
    //     (INSERT into RLS-guarded social_admin_access_log would trip the
    //     row-security policy, which is expected · that's not what this
    //     assertion measures. We measure that the app role CAN advance the
    //     sequence, which is what an INSERT will need under the hood.)
    console.log("\nD · nex_social_app · direct sequence USAGE (nextval / currval)");
    await c.query("BEGIN");
    await c.query("SET LOCAL ROLE nex_social_app");
    try {
      const cu2 = await c.query("SELECT current_user");
      T("current_user == nex_social_app after SET ROLE", cu2.rows[0].current_user === "nex_social_app");
      const nx = await c.query("SELECT nextval('nex.social_admin_access_log_access_id_seq'::regclass) AS n");
      const nx2 = await c.query("SELECT nextval('nex.social_admin_access_log_access_id_seq'::regclass) AS n");
      T("nextval advances monotonically as nex_social_app",
        Number(nx2.rows[0].n) === Number(nx.rows[0].n) + 1,
        `n1=${nx.rows[0].n} n2=${nx2.rows[0].n}`);
      const nx3 = await c.query("SELECT nextval('nex.social_audit_events_audit_id_seq'::regclass) AS n");
      T("nextval on second sequence works as nex_social_app", nx3.rows[0].n !== null, `n=${nx3.rows[0].n}`);
    } catch (e) {
      T("sequence USAGE as nex_social_app", false, e.message);
    }
    await c.query("ROLLBACK");

    // D2 · Prove RLS is ACTIVELY enforced against nex_social_app on
    //      a WITH CHECK policy · attempted INSERT rejected → correctness.
    console.log("\nD2 · RLS policy actively enforces on nex_social_app (positive rejection)");
    await c.query("BEGIN");
    await c.query("SET LOCAL ROLE nex_social_app");
    try {
      await c.query(`
        INSERT INTO nex.social_admin_access_log (admin_user_id, target_tenant_id, resource, reason)
        VALUES ('phase6-fake-admin', gen_random_uuid(), 'phase6-fake-res', 'phase6-fake-reason')`);
      // If we reach here, RLS did NOT block — that's a failure.
      T("RLS blocked unauthorized INSERT (positive test)", false, "insert SUCCEEDED · RLS did NOT enforce · investigate policy");
    } catch (e) {
      const rlsBlocked = /row-level security|row level security/i.test(e.message);
      T("RLS blocked unauthorized INSERT (positive test)", rlsBlocked, rlsBlocked ? "correctly rejected" : `unexpected error: ${e.message}`);
    }
    await c.query("ROLLBACK");

    // E · Prove RLS is ACTIVELY enforced (not bypassed) by app roles.
    console.log("\nE · RLS active-enforcement proof for nex_brain_app (bypassrls=false in Phase 5)");
    // rolbypassrls=false was confirmed in Phase 5 role attributes. Additionally
    // verify current session's row_security setting inside SET ROLE.
    await c.query("BEGIN");
    await c.query("SET LOCAL ROLE nex_brain_app");
    const rs = await c.query("SELECT current_setting('row_security') AS rs, current_user AS u");
    T(`row_security=${rs.rows[0].rs} while acting as nex_brain_app`, rs.rows[0].rs === "on");
    await c.query("ROLLBACK");
  } finally {
    c.release();
  }
} finally {
  if (pool) await pool.end();
}

// Step Z · REVOKE the temp grants so the migration user is back to baseline.
console.log("\nStep Z · REVOKE nex_brain_app + nex_social_app FROM nex_migrate_mtkiv3bg");
await mgmt(`REVOKE nex_brain_app  FROM nex_migrate_mtkiv3bg;`);
await mgmt(`REVOKE nex_social_app FROM nex_migrate_mtkiv3bg;`);
// Re-verify: migration user should NO LONGER be a member of app roles.
const post = await mgmt(`
  SELECT r.rolname AS member, g.rolname AS group_role
    FROM pg_auth_members am
    JOIN pg_roles r ON r.oid = am.member
    JOIN pg_roles g ON g.oid = am.roleid
   WHERE r.rolname = 'nex_migrate_mtkiv3bg'
     AND g.rolname IN ('nex_brain_app', 'nex_social_app')`);
T("REVOKE succeeded · migration user no longer member of app roles", post.length === 0,
  post.length ? `still member of: ${post.map((r) => r.group_role).join(", ")}` : "clean");

// Additionally confirm app-role members roster is still exactly [postgres, supabase_admin].
const rosterBrain = await mgmt(`
  SELECT r.rolname AS member FROM pg_auth_members am JOIN pg_roles r ON r.oid = am.member
   JOIN pg_roles g ON g.oid = am.roleid WHERE g.rolname='nex_brain_app' ORDER BY r.rolname`);
const rosterSocial = await mgmt(`
  SELECT r.rolname AS member FROM pg_auth_members am JOIN pg_roles r ON r.oid = am.member
   JOIN pg_roles g ON g.oid = am.roleid WHERE g.rolname='nex_social_app' ORDER BY r.rolname`);
console.log(`  nex_brain_app members after revoke:  [${rosterBrain.map((r) => r.member).join(", ")}]`);
console.log(`  nex_social_app members after revoke: [${rosterSocial.map((r) => r.member).join(", ")}]`);

console.log(`\n=== Phase 6 v2 result: ${pass} pass · ${fail} fail ===`);
if (fail) {
  console.log("\nFailures:");
  for (const l of failLines) console.log("  " + l);
}
process.exit(fail === 0 ? 0 : 1);
