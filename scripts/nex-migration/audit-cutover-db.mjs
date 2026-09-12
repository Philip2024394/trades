#!/usr/bin/env node
// Cutover-readiness audit · DATABASE SIDE · read-only.

import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..", "..");
const envText = readFileSync(resolve(repoRoot, ".env.tools.local"), "utf8");
const TOKEN = envText.match(/NEX_SUPABASE_ACCESS_TOKEN=(\S+)/)[1];
const REF = envText.match(/NEX_SUPABASE_PROJECT_REF=(\S+)/)[1];
const MGMT = `https://api.supabase.com/v1/projects/${REF}/database/query`;
async function q(sql) {
  const r = await fetch(MGMT, { method: "POST", headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" }, body: JSON.stringify({ query: sql }) });
  return { status: r.status, body: await r.text() };
}

const report = {};

console.log("═══════════════════════════════════════════════════════════════════════════");
console.log("CUTOVER READINESS AUDIT · DATABASE SIDE · read-only");
console.log("═══════════════════════════════════════════════════════════════════════════");

// ── 1 · ROLES + attributes ─────────────────────────────────────────
console.log("\n=== 1 · ROLES + attributes ===");
report.roles = JSON.parse((await q(`
  SELECT rolname, rolsuper, rolinherit, rolcreaterole, rolcreatedb, rolcanlogin, rolreplication, rolbypassrls, rolconnlimit, rolvaliduntil::text
  FROM pg_roles
  WHERE rolname IN ('nex_brain_app','nex_social_app','service_role','anon','authenticated','postgres','supabase_admin','supabase_auth_admin','nex_migrate_mtkiv3bg')
     OR rolname LIKE 'nex_%'
  ORDER BY rolname
`)).body);
console.log(JSON.stringify(report.roles, null, 2));

// ── 2 · ROLE MEMBERSHIPS ────────────────────────────────────────────
console.log("\n=== 2 · Role memberships ===");
report.role_members = JSON.parse((await q(`
  SELECT r.rolname AS role_of, m.rolname AS member_is
  FROM pg_auth_members am
  JOIN pg_roles r ON r.oid = am.roleid
  JOIN pg_roles m ON m.oid = am.member
  WHERE r.rolname IN ('nex_brain_app','nex_social_app','service_role','anon','authenticated','postgres','supabase_admin','nex_migrate_mtkiv3bg')
     OR m.rolname IN ('nex_brain_app','nex_social_app','service_role','anon','authenticated','postgres','nex_migrate_mtkiv3bg')
  ORDER BY r.rolname, m.rolname
`)).body);
console.log(JSON.stringify(report.role_members, null, 2));

// ── 3 · SCHEMA USAGE grants ─────────────────────────────────────────
console.log("\n=== 3 · Schema USAGE grants (nex + public) ===");
report.schema_grants = JSON.parse((await q(`
  SELECT nspname AS schema, r.rolname AS grantee,
         has_schema_privilege(r.rolname, n.oid, 'USAGE') AS has_usage,
         has_schema_privilege(r.rolname, n.oid, 'CREATE') AS has_create
  FROM pg_namespace n
  CROSS JOIN pg_roles r
  WHERE n.nspname IN ('nex','public')
    AND r.rolname IN ('nex_brain_app','nex_social_app','service_role','anon','authenticated','postgres','nex_migrate_mtkiv3bg')
  ORDER BY nspname, r.rolname
`)).body);
console.log(JSON.stringify(report.schema_grants, null, 2));

// ── 4 · TABLE privileges (sampled · 5 nex tables representative of runtime paths) ──
console.log("\n=== 4 · Table privileges for sample nex.* tables ===");
const sampleTables = ['food_business','worker_cycle_run','identity_merge_log','conv_knowledge_items','audit_log','worker_jobs','worker_results','knowledge_records'];
const tableGrants = {};
for (const t of sampleTables) {
  tableGrants[t] = JSON.parse((await q(`
    SELECT r.rolname AS grantee,
           has_table_privilege(r.rolname, 'nex.${t}'::regclass, 'SELECT') AS sel,
           has_table_privilege(r.rolname, 'nex.${t}'::regclass, 'INSERT') AS ins,
           has_table_privilege(r.rolname, 'nex.${t}'::regclass, 'UPDATE') AS upd,
           has_table_privilege(r.rolname, 'nex.${t}'::regclass, 'DELETE') AS del,
           has_table_privilege(r.rolname, 'nex.${t}'::regclass, 'TRUNCATE') AS tru,
           has_table_privilege(r.rolname, 'nex.${t}'::regclass, 'REFERENCES') AS ref,
           has_table_privilege(r.rolname, 'nex.${t}'::regclass, 'TRIGGER') AS trg
    FROM pg_roles r
    WHERE r.rolname IN ('nex_brain_app','nex_social_app','service_role','anon','authenticated','nex_migrate_mtkiv3bg')
    ORDER BY r.rolname
  `)).body);
}
report.table_grants_sample = tableGrants;
for (const [t, g] of Object.entries(tableGrants)) {
  console.log(`\n  nex.${t}:`);
  for (const row of g) console.log(`    ${row.grantee.padEnd(25)} S=${row.sel?"Y":"n"} I=${row.ins?"Y":"n"} U=${row.upd?"Y":"n"} D=${row.del?"Y":"n"} T=${row.tru?"Y":"n"} R=${row.ref?"Y":"n"} Tr=${row.trg?"Y":"n"}`);
}

// ── 5 · SEQUENCES (2 in nex) ────────────────────────────────────────
console.log("\n=== 5 · Sequences in nex ===");
report.sequences = JSON.parse((await q(`
  SELECT c.relname AS seq_name, r.rolname AS owner,
         has_sequence_privilege('nex_brain_app', c.oid, 'USAGE') AS brain_usage,
         has_sequence_privilege('nex_social_app', c.oid, 'USAGE') AS social_usage,
         has_sequence_privilege('service_role', c.oid, 'USAGE') AS service_usage,
         has_sequence_privilege('nex_brain_app', c.oid, 'SELECT') AS brain_sel,
         has_sequence_privilege('service_role', c.oid, 'SELECT') AS service_sel,
         has_sequence_privilege('service_role', c.oid, 'UPDATE') AS service_upd
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  JOIN pg_roles r ON r.oid = c.relowner
  WHERE n.nspname = 'nex' AND c.relkind = 'S'
  ORDER BY c.relname
`)).body);
console.log(JSON.stringify(report.sequences, null, 2));

// ── 6 · RLS POLICIES · 140 total ────────────────────────────────────
console.log("\n=== 6 · RLS policies enumeration (140 total) ===");
report.policies = JSON.parse((await q(`
  SELECT c.relname AS table_name, p.polname AS policy, p.polcmd AS command,
         array(SELECT rolname FROM pg_roles WHERE oid = ANY(p.polroles)) AS target_roles,
         pg_get_expr(p.polqual, p.polrelid) AS using_expr,
         pg_get_expr(p.polwithcheck, p.polrelid) AS check_expr,
         p.polpermissive AS permissive
  FROM pg_policy p
  JOIN pg_class c ON c.oid = p.polrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'nex'
  ORDER BY c.relname, p.polname
`)).body);
console.log(`  total policies: ${report.policies.length}`);
console.log(`  policies grouped by target roles:`);
const byRole = {};
for (const p of report.policies) {
  // Postgres returns arrays as strings like "{role1,role2}" via Management API
  const arr = Array.isArray(p.target_roles) ? p.target_roles : (typeof p.target_roles === "string" ? p.target_roles.replace(/^\{|\}$/g, "").split(",").filter(Boolean) : []);
  const rk = arr.length === 0 ? "(no roles · PUBLIC-ish)" : arr.join(",");
  byRole[rk] = (byRole[rk] || 0) + 1;
}
for (const [k, v] of Object.entries(byRole).sort((a,b) => b[1]-a[1])) console.log(`    ${k.padEnd(30)} ${v}`);
// Anomalies: policies referencing public.* in USING/CHECK
const policyRefsPublic = report.policies.filter(p => (p.using_expr && /public\./.test(p.using_expr)) || (p.check_expr && /public\./.test(p.check_expr)));
console.log(`  policies with public.* references in expressions: ${policyRefsPublic.length}`);
if (policyRefsPublic.length > 0) for (const p of policyRefsPublic) console.log(`    ${p.table_name}.${p.policy}: USING=${p.using_expr} · CHECK=${p.check_expr}`);

// ── 7 · FUNCTIONS · 28 total ───────────────────────────────────────
console.log("\n=== 7 · Functions in nex (28) ===");
report.functions = JSON.parse((await q(`
  SELECT p.proname AS name, pg_get_function_identity_arguments(p.oid) AS args,
         r.rolname AS owner,
         p.prosecdef AS security_definer,
         array_to_string(p.proconfig, ',') AS config_settings,
         l.lanname AS language
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  JOIN pg_roles r ON r.oid = p.proowner
  JOIN pg_language l ON l.oid = p.prolang
  WHERE n.nspname = 'nex'
  ORDER BY p.proname
`)).body);
console.log(`  total: ${report.functions.length}`);
const secDef = report.functions.filter(f => f.security_definer);
console.log(`  SECURITY DEFINER: ${secDef.length}`);
for (const f of secDef) console.log(`    ${f.name}(${f.args}) · owner=${f.owner} · config=${f.config_settings || '(none)'} · language=${f.language}`);
const noSearchPath = secDef.filter(f => !f.config_settings || !/search_path/.test(f.config_settings));
console.log(`  SECURITY DEFINER functions without pinned search_path: ${noSearchPath.length} (potential security concern)`);
for (const f of noSearchPath) console.log(`    ⚠️ ${f.name}(${f.args}) · missing search_path`);

// ── 8 · VIEWS ──────────────────────────────────────────────────────
console.log("\n=== 8 · Views (13) — check for public.* references in definitions ===");
report.views = JSON.parse((await q(`
  SELECT c.relname AS name, r.rolname AS owner, pg_get_viewdef(c.oid) AS definition
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  JOIN pg_roles r ON r.oid = c.relowner
  WHERE n.nspname = 'nex' AND c.relkind = 'v'
  ORDER BY c.relname
`)).body);
const viewsRefPublic = report.views.filter(v => /public\./.test(v.definition));
console.log(`  total: ${report.views.length}`);
console.log(`  views referencing public.*: ${viewsRefPublic.length}`);
if (viewsRefPublic.length > 0) for (const v of viewsRefPublic) console.log(`    ⚠️ ${v.name}: ${v.definition.slice(0, 300)}...`);

// ── 9 · TRIGGERS ──────────────────────────────────────────────────
console.log("\n=== 9 · Triggers (13) — inspect for public.* dependencies ===");
report.triggers = JSON.parse((await q(`
  SELECT c.relname AS table, tr.tgname AS trigger, pg_get_triggerdef(tr.oid) AS def
  FROM pg_trigger tr
  JOIN pg_class c ON c.oid = tr.tgrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'nex' AND NOT tr.tgisinternal
  ORDER BY c.relname, tr.tgname
`)).body);
console.log(`  total: ${report.triggers.length}`);
const trigRefPublic = report.triggers.filter(t => /public\./.test(t.def));
console.log(`  triggers referencing public.*: ${trigRefPublic.length}`);
if (trigRefPublic.length > 0) for (const t of trigRefPublic) console.log(`    ⚠️ ${t.table}.${t.trigger}: ${t.def}`);

// ── 10 · DEFAULT PRIVILEGES ─────────────────────────────────────────
console.log("\n=== 10 · Default privileges in nex schema ===");
report.default_privs = JSON.parse((await q(`
  SELECT r.rolname AS granting_role, n.nspname AS schema, d.defaclobjtype AS obj_type,
         d.defaclacl::text AS acl
  FROM pg_default_acl d
  JOIN pg_roles r ON r.oid = d.defaclrole
  JOIN pg_namespace n ON n.oid = d.defaclnamespace
  WHERE n.nspname = 'nex'
  ORDER BY d.defaclobjtype, r.rolname
`)).body);
console.log(`  default privilege rules: ${report.default_privs.length}`);
for (const d of report.default_privs) console.log(`    role=${d.granting_role} type=${d.obj_type} acl=${d.acl}`);

// ── 11 · FK cross-schema check ─────────────────────────────────────
console.log("\n=== 11 · Verify no nex.* FK references public.* ===");
const crossFk = JSON.parse((await q(`
  SELECT c.conname, cl.relname AS child_table, rc.relname AS parent_table, rn.nspname AS parent_schema
  FROM pg_constraint c
  JOIN pg_class cl ON cl.oid = c.conrelid
  JOIN pg_namespace n ON n.oid = cl.relnamespace
  JOIN pg_class rc ON rc.oid = c.confrelid
  JOIN pg_namespace rn ON rn.oid = rc.relnamespace
  WHERE c.contype = 'f' AND n.nspname = 'nex' AND rn.nspname <> 'nex'
`)).body);
report.cross_schema_fks = crossFk;
console.log(`  FKs from nex.* to non-nex schema: ${crossFk.length} ${crossFk.length === 0 ? "✓" : "❌"}`);

// ── 12 · TABLE + INDEX sizes (top 15) ───────────────────────────────
console.log("\n=== 12 · Storage top 15 tables ===");
report.storage_top = JSON.parse((await q(`
  SELECT c.relname AS table,
         pg_size_pretty(pg_total_relation_size(c.oid)) AS total,
         pg_size_pretty(pg_relation_size(c.oid)) AS heap,
         pg_size_pretty(pg_indexes_size(c.oid)) AS indexes,
         pg_size_pretty(COALESCE(pg_total_relation_size(c.reltoastrelid), 0)) AS toast
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'nex' AND c.relkind = 'r'
  ORDER BY pg_total_relation_size(c.oid) DESC LIMIT 15
`)).body);
console.log(JSON.stringify(report.storage_top, null, 2));

// ── 13 · DB storage summary ────────────────────────────────────────
console.log("\n=== 13 · DB storage summary ===");
report.storage_summary = JSON.parse((await q(`
  SELECT pg_database_size(current_database())::text AS db_bytes,
         pg_size_pretty(pg_database_size(current_database())) AS db_pretty,
         pg_current_wal_lsn()::text AS wal_lsn,
         (SELECT sum(pg_total_relation_size(c.oid))::text FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='nex' AND c.relkind IN ('r','m')) AS nex_total_bytes,
         (SELECT sum(pg_indexes_size(c.oid))::text FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='nex' AND c.relkind='r') AS nex_index_bytes
`)).body[0]);
console.log(JSON.stringify(report.storage_summary, null, 2));

// ── 14 · Supabase backup / PITR status ─────────────────────────────
console.log("\n=== 14 · Supabase backup / PITR status ===");
const backups = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/backups`, { headers: { Authorization: `Bearer ${TOKEN}` } }).then(r => r.json());
report.backups = { walg_enabled: backups.walg_enabled, pitr_enabled: backups.pitr_enabled, backup_count: backups.backups?.length ?? 0, latest_backup: backups.backups?.[0] };
console.log(`  WAL-G: ${backups.walg_enabled} · PITR: ${backups.pitr_enabled} · Backup count: ${backups.backups?.length}`);
if (backups.backups?.length > 0) console.log(`  Latest: ${JSON.stringify(backups.backups[0])}`);

// ── 15 · public.* baseline reconfirmation ──────────────────────────
console.log("\n=== 15 · public.* baseline reconfirmation ===");
report.public_baseline = JSON.parse((await q(`
  SELECT (SELECT count(*)::text FROM public.knowledge_records) AS knowledge_records,
         (SELECT count(*)::text FROM public.worker_jobs) AS worker_jobs,
         (SELECT count(*)::text FROM public.worker_results) AS worker_results,
         (SELECT count(*)::text FROM public.audit_log) AS audit_log,
         (SELECT count(*)::text FROM public.sources) AS sources,
         (SELECT count(*)::text FROM public.confidence_scores) AS confidence_scores,
         (SELECT count(*)::text FROM public.graph_edges) AS graph_edges,
         (SELECT count(*)::text FROM public.knowledge_feedback) AS knowledge_feedback,
         (SELECT count(*)::text FROM public.directory_seeds) AS directory_seeds
`)).body[0]);
console.log(JSON.stringify(report.public_baseline, null, 2));

// ── 16 · Migration role reconfirmation ─────────────────────────────
console.log("\n=== 16 · Migration temp role status ===");
report.migration_role = JSON.parse((await q(`
  SELECT rolname, rolcanlogin, rolbypassrls, rolsuper
  FROM pg_roles WHERE rolname LIKE 'nex_migrate_%' ORDER BY rolname
`)).body);
console.log(JSON.stringify(report.migration_role, null, 2));

// ── 17 · readonly + system health ──────────────────────────────────
console.log("\n=== 17 · Supabase readonly / project health ===");
const ro = await fetch(`https://api.supabase.com/v1/projects/${REF}/readonly`, { headers: { Authorization: `Bearer ${TOKEN}` } }).then(r => r.json());
const proj = await fetch(`https://api.supabase.com/v1/projects/${REF}`, { headers: { Authorization: `Bearer ${TOKEN}` } }).then(r => r.json());
report.readonly = ro;
report.project = { id: proj.id, region: proj.region, status: proj.status, name: proj.name };
console.log(`  readonly: enabled=${ro.enabled}`);
console.log(`  project: ${proj.id} · ${proj.region} · ${proj.status}`);

writeFileSync(resolve(__dirname, "audit-cutover-db-report.json"), JSON.stringify(report, null, 2));
console.log("\n─── DB audit complete · report saved ───");
