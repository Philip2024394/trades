// Strict permission audit for nex_brain_app + nex_social_app on Project B.
// Confirms both roles have EXACTLY the required set (Philip's Path 1 spec)
// and NONE of the forbidden attributes/memberships.

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const __dirname = dirname(fileURLToPath(import.meta.url));
const envText = readFileSync(resolve(__dirname, "..", "..", ".env.tools.local"), "utf8");
const TOKEN = envText.match(/NEX_SUPABASE_ACCESS_TOKEN=(\S+)/)[1];
const REF   = envText.match(/NEX_SUPABASE_PROJECT_REF=(\S+)/)[1];

async function q(sql) {
  const r = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: "POST",
    headers: { Authorization: "Bearer " + TOKEN, "Content-Type": "application/json" },
    body: JSON.stringify({ query: sql }),
  });
  return { status: r.status, body: r.status < 400 ? await r.json() : await r.text() };
}

let failures = 0;
function check(label, cond, detail) {
  const glyph = cond ? "✓" : "❌";
  console.log(`  ${glyph} ${label}${detail ? ` · ${detail}` : ""}`);
  if (!cond) failures++;
}

console.log("=== Phase 5 · Strict permission audit ===\n");

// A · Role attributes
console.log("A · Role attributes (must be: inherit=true login=false bypassrls=false superuser=false createrole=false)");
const roles = (await q(`
  SELECT rolname, rolinherit, rolcanlogin, rolbypassrls, rolsuper, rolcreaterole
    FROM pg_roles
   WHERE rolname IN ('nex_brain_app', 'nex_social_app', 'service_role')
   ORDER BY rolname
`)).body;
for (const r of roles) {
  const isApp = r.rolname === "nex_brain_app" || r.rolname === "nex_social_app";
  console.log(`  ${r.rolname}:`);
  console.log(`    rolinherit=${r.rolinherit} rolcanlogin=${r.rolcanlogin} rolbypassrls=${r.rolbypassrls} rolsuper=${r.rolsuper} rolcreaterole=${r.rolcreaterole}`);
  if (isApp) {
    check(`  ${r.rolname} inherit=true`, r.rolinherit === true);
    check(`  ${r.rolname} bypassrls=false`, r.rolbypassrls === false, "no RLS bypass");
    check(`  ${r.rolname} superuser=false`, r.rolsuper === false);
    check(`  ${r.rolname} createrole=false`, r.rolcreaterole === false);
  }
}

// B · Role memberships (must NOT include service_role for app roles)
console.log("\nB · Role memberships (nex_brain_app, nex_social_app must NOT be members of service_role)");
const memberships = (await q(`
  SELECT r.rolname AS member, g.rolname AS group_role
    FROM pg_auth_members m
    JOIN pg_roles r ON r.oid = m.member
    JOIN pg_roles g ON g.oid = m.roleid
   WHERE r.rolname IN ('nex_brain_app', 'nex_social_app')
   ORDER BY r.rolname, g.rolname
`)).body;
if (memberships.length === 0) {
  console.log("  (no memberships — app roles are standalone)");
  check("app roles NOT members of service_role", true);
  check("app roles NOT members of postgres", true);
} else {
  for (const m of memberships) console.log(`  ${m.member} → member of ${m.group_role}`);
  const badMemberships = memberships.filter((m) => m.group_role === "service_role" || m.group_role === "postgres" || m.group_role === "supabase_admin");
  check("app roles NOT members of service_role/postgres/supabase_admin", badMemberships.length === 0,
    badMemberships.length ? `found: ${badMemberships.map((m) => `${m.member}→${m.group_role}`).join(", ")}` : "");
}

// C · Schema USAGE
console.log("\nC · nex schema USAGE");
const schemaUsage = (await q(`
  SELECT r.rolname, has_schema_privilege(r.rolname, 'nex', 'USAGE') AS usage
    FROM pg_roles r
   WHERE r.rolname IN ('nex_brain_app', 'nex_social_app')
   ORDER BY r.rolname
`)).body;
for (const r of schemaUsage) {
  check(`${r.rolname} has USAGE on nex`, r.usage === true);
}

// D · Table privileges · sample every kind of nex table
console.log("\nD · Table privileges (S/I/U/D = must be Y · T/R/Tr = must be n)");
const sampleTables = [
  "food_business",         // dominant business table
  "work_item",             // work queue
  "identity_merge_log",    // audit-heavy
  "conv_knowledge_items",  // conversation
  "worker_cycle_run",      // workforce
  "worker_heartbeat",      // workforce
  "audit_log",             // audit
  "knowledge_records",     // knowledge
];
for (const t of sampleTables) {
  const rows = (await q(`
    SELECT r.rolname,
           has_table_privilege(r.rolname, 'nex.${t}'::regclass, 'SELECT')     AS s,
           has_table_privilege(r.rolname, 'nex.${t}'::regclass, 'INSERT')     AS i,
           has_table_privilege(r.rolname, 'nex.${t}'::regclass, 'UPDATE')     AS u,
           has_table_privilege(r.rolname, 'nex.${t}'::regclass, 'DELETE')     AS d,
           has_table_privilege(r.rolname, 'nex.${t}'::regclass, 'TRUNCATE')   AS t,
           has_table_privilege(r.rolname, 'nex.${t}'::regclass, 'REFERENCES') AS r_ref,
           has_table_privilege(r.rolname, 'nex.${t}'::regclass, 'TRIGGER')    AS tr
      FROM pg_roles r
     WHERE r.rolname IN ('nex_brain_app', 'nex_social_app')
     ORDER BY r.rolname
  `)).body;
  for (const row of rows) {
    const good = row.s && row.i && row.u && row.d && !row.t && !row.r_ref && !row.tr;
    check(`nex.${t} · ${row.rolname} · S=${row.s?"Y":"n"} I=${row.i?"Y":"n"} U=${row.u?"Y":"n"} D=${row.d?"Y":"n"} T=${row.t?"Y":"n"} R=${row.r_ref?"Y":"n"} Tr=${row.tr?"Y":"n"}`, good);
  }
}

// E · Sequence privileges · sample every sequence
console.log("\nE · Sequence privileges (must be USAGE/SELECT/UPDATE = Y on every nex sequence)");
const seqCount = (await q(`SELECT count(*)::int AS n FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='nex' AND c.relkind='S'`)).body[0].n;
const seqRows = (await q(`
  SELECT r.rolname, c.relname AS seq,
         has_sequence_privilege(r.rolname, c.oid, 'USAGE')  AS u,
         has_sequence_privilege(r.rolname, c.oid, 'SELECT') AS s,
         has_sequence_privilege(r.rolname, c.oid, 'UPDATE') AS upd
    FROM pg_class c
    JOIN pg_namespace n ON n.oid=c.relnamespace
   CROSS JOIN pg_roles r
   WHERE n.nspname='nex' AND c.relkind='S' AND r.rolname IN ('nex_brain_app', 'nex_social_app')
   ORDER BY c.relname, r.rolname
`)).body;
console.log(`  ${seqCount} sequences · ${seqRows.length} role-sequence combinations checked`);
const seqBad = seqRows.filter((r) => !r.u || !r.s || !r.upd);
if (seqBad.length === 0) {
  check("every nex sequence has USAGE+SELECT+UPDATE for both app roles", true);
} else {
  for (const r of seqBad) console.log(`    ❌ ${r.seq} · ${r.rolname} U=${r.u?"Y":"n"} S=${r.s?"Y":"n"} Upd=${r.upd?"Y":"n"}`);
  check("every nex sequence has USAGE+SELECT+UPDATE for both app roles", false, `${seqBad.length} bad rows`);
}

// F · Table privileges · EVERY nex table (not just samples)
console.log("\nF · Table privileges · every nex table (sweep)");
const allTables = (await q(`
  SELECT c.relname AS tbl
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
   WHERE n.nspname='nex' AND c.relkind='r'
   ORDER BY c.relname
`)).body;
let sweepBad = [];
for (const t of allTables) {
  const rows = (await q(`
    SELECT r.rolname,
           has_table_privilege(r.rolname, 'nex.${t.tbl}'::regclass, 'SELECT')   AS s,
           has_table_privilege(r.rolname, 'nex.${t.tbl}'::regclass, 'INSERT')   AS i,
           has_table_privilege(r.rolname, 'nex.${t.tbl}'::regclass, 'UPDATE')   AS u,
           has_table_privilege(r.rolname, 'nex.${t.tbl}'::regclass, 'DELETE')   AS d,
           has_table_privilege(r.rolname, 'nex.${t.tbl}'::regclass, 'TRUNCATE') AS trunc
      FROM pg_roles r WHERE r.rolname IN ('nex_brain_app', 'nex_social_app')
  `)).body;
  for (const row of rows) {
    if (!row.s || !row.i || !row.u || !row.d) sweepBad.push({ tbl: t.tbl, role: row.rolname, missing: `${!row.s?"S":""}${!row.i?"I":""}${!row.u?"U":""}${!row.d?"D":""}` });
    if (row.trunc) sweepBad.push({ tbl: t.tbl, role: row.rolname, extra: "TRUNCATE (must not have)" });
  }
}
console.log(`  ${allTables.length} tables × 2 roles = ${allTables.length * 2} combinations checked`);
if (sweepBad.length === 0) {
  check("every nex table has S/I/U/D for both app roles and no TRUNCATE", true);
} else {
  for (const b of sweepBad.slice(0, 20)) console.log(`    ❌ ${b.tbl} · ${b.role} · ${b.missing ?? b.extra}`);
  check("every nex table has S/I/U/D for both app roles and no TRUNCATE", false, `${sweepBad.length} violations`);
}

console.log(`\n=== Result: ${failures} failures ===`);
process.exit(failures === 0 ? 0 : 1);
