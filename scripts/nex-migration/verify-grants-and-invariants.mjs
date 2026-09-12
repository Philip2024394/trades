// Read-only post-grant verification + invariant recheck.
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const __dirname = dirname(fileURLToPath(import.meta.url));
const envText = readFileSync(resolve(__dirname, "..", "..", ".env.tools.local"), "utf8");
const TOKEN = envText.match(/NEX_SUPABASE_ACCESS_TOKEN=(\S+)/)[1];
const REF = envText.match(/NEX_SUPABASE_PROJECT_REF=(\S+)/)[1];
async function q(sql) {
  const r = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`,{method:"POST",headers:{Authorization:"Bearer "+TOKEN,"Content-Type":"application/json"},body:JSON.stringify({query:sql})});
  const text = await r.text();
  try { return { status: r.status, body: JSON.parse(text) }; } catch { return { status: r.status, body: text }; }
}

console.log("=== Post-grant verification ===\n");

// A · Sample table privileges after grants
const sampleTables = ["food_business","work_item","identity_merge_log","conv_knowledge_items","worker_cycle_run","worker_heartbeat","audit_log","knowledge_records"];
console.log("A · Table privileges (must show S/I/U/D=Y for nex_brain_app and nex_social_app; T/R/Tr=n):");
for (const t of sampleTables) {
  const r = await q(`SELECT r.rolname, has_table_privilege(r.rolname, 'nex.${t}'::regclass, 'SELECT') AS S, has_table_privilege(r.rolname, 'nex.${t}'::regclass, 'INSERT') AS I, has_table_privilege(r.rolname, 'nex.${t}'::regclass, 'UPDATE') AS U, has_table_privilege(r.rolname, 'nex.${t}'::regclass, 'DELETE') AS D, has_table_privilege(r.rolname, 'nex.${t}'::regclass, 'TRUNCATE') AS T, has_table_privilege(r.rolname, 'nex.${t}'::regclass, 'REFERENCES') AS R, has_table_privilege(r.rolname, 'nex.${t}'::regclass, 'TRIGGER') AS Tr FROM pg_roles r WHERE r.rolname IN ('nex_brain_app','nex_social_app','service_role') ORDER BY r.rolname`);
  console.log(`  nex.${t}:`);
  for (const row of r.body) console.log(`    ${row.rolname.padEnd(18)} S=${row.s?"Y":"n"} I=${row.i?"Y":"n"} U=${row.u?"Y":"n"} D=${row.d?"Y":"n"} T=${row.t?"Y":"n"} R=${row.r?"Y":"n"} Tr=${row.tr?"Y":"n"}`);
}

// B · Sequence privileges after grants
console.log("\nB · Sequence privileges (must show USAGE/SELECT/UPDATE=Y for nex_brain_app + nex_social_app):");
const seqR = await q(`SELECT r.rolname, c.relname AS seq, has_sequence_privilege(r.rolname, c.oid, 'USAGE') AS U, has_sequence_privilege(r.rolname, c.oid, 'SELECT') AS S, has_sequence_privilege(r.rolname, c.oid, 'UPDATE') AS Upd FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace CROSS JOIN pg_roles r WHERE n.nspname='nex' AND c.relkind='S' AND r.rolname IN ('nex_brain_app','nex_social_app','service_role') ORDER BY c.relname, r.rolname`);
for (const row of seqR.body) console.log(`  ${row.seq.padEnd(45)} ${row.rolname.padEnd(18)} U=${row.u?"Y":"n"} S=${row.s?"Y":"n"} Upd=${row.upd?"Y":"n"}`);

// C · Default privileges (should now include app roles)
console.log("\nC · Default privileges in nex schema:");
const defR = await q(`SELECT r.rolname AS granting_role, d.defaclobjtype, d.defaclacl::text FROM pg_default_acl d JOIN pg_roles r ON r.oid=d.defaclrole JOIN pg_namespace n ON n.oid=d.defaclnamespace WHERE n.nspname='nex' ORDER BY d.defaclobjtype, r.rolname`);
for (const row of defR.body) console.log(`  role=${row.granting_role} type=${row.defaclobjtype} acl=${row.defaclacl}`);

// D · Full invariants
console.log("\nD · Full invariants after grant:");
const inv = (await q(`
  SELECT
    (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='nex' AND c.relkind='r') AS nex_tables,
    (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='nex' AND c.relkind='r' AND c.relrowsecurity=true) AS rls,
    (SELECT count(*) FROM pg_constraint c JOIN pg_namespace n ON n.oid=c.connamespace WHERE n.nspname='nex' AND c.contype='f') AS fks,
    (SELECT count(*) FROM pg_policy p JOIN pg_class c ON c.oid=p.polrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='nex') AS policies,
    (SELECT count(*) FROM nex.food_business_value) AS matview,
    (SELECT count(*) FROM public.knowledge_records) AS kr,
    (SELECT count(*) FROM public.worker_jobs) AS wj,
    (SELECT count(*) FROM public.worker_results) AS wr,
    pg_database_size(current_database())::text AS db_bytes,
    pg_size_pretty(pg_database_size(current_database())) AS db_pretty
`)).body[0];
const roR = await fetch(`https://api.supabase.com/v1/projects/${REF}/readonly`, { headers: { Authorization: `Bearer ${TOKEN}` } }).then(r => r.json());
console.log(`  nex tables:  ${inv.nex_tables} (expected 191) ${inv.nex_tables === 191 ? "✓" : "❌"}`);
console.log(`  RLS enabled: ${inv.rls} (expected 92) ${inv.rls === 92 ? "✓" : "❌"}`);
console.log(`  FK count:    ${inv.fks} (expected 125) ${Number(inv.fks) === 125 ? "✓" : "❌"}`);
console.log(`  RLS policies: ${inv.policies} (expected 140) ${inv.policies === 140 ? "✓" : "❌"}`);
console.log(`  matview:     ${inv.matview} (expected 22750) ${Number(inv.matview) === 22750 ? "✓" : "❌"}`);
console.log(`  public.knowledge_records: ${inv.kr} (expected 3627) ${inv.kr === 3627 ? "✓" : "❌"}`);
console.log(`  public.worker_jobs:       ${inv.wj} (expected 19167) ${inv.wj === 19167 ? "✓" : "❌"}`);
console.log(`  public.worker_results:    ${inv.wr} (expected 19140) ${inv.wr === 19140 ? "✓" : "❌"}`);
console.log(`  DB size:     ${inv.db_pretty}`);
console.log(`  readonly:    enabled=${roR.enabled}`);

// E · Full orphan re-check
console.log("\nE · Full 125-FK orphan re-check:");
const snapshot = JSON.parse(readFileSync(resolve(__dirname, "fk-constraints-snapshot.json"), "utf8"));
let totalOrphans = 0;
for (const fk of snapshot) {
  const m = fk.def.match(/FOREIGN KEY\s+\(([^)]+)\)\s+REFERENCES\s+nex\.(\w+)\s*\(([^)]+)\)/);
  if (!m) continue;
  const cCols = m[1].split(",").map(s => s.trim());
  const pTbl = m[2];
  const pCols = m[3].split(",").map(s => s.trim());
  const notNullCheck = cCols.map(c => `c."${c}" IS NOT NULL`).join(" AND ");
  const joinCheck = cCols.map((c, i) => `p."${pCols[i]}" = c."${c}"`).join(" AND ");
  const r = await q(`SELECT count(*)::text AS n FROM nex.${fk.table} c WHERE ${notNullCheck} AND NOT EXISTS (SELECT 1 FROM nex.${pTbl} p WHERE ${joinCheck})`);
  if (r.status < 400) totalOrphans += Number(r.body[0].n);
}
console.log(`  Total orphans: ${totalOrphans} ${totalOrphans === 0 ? "✓" : "❌"}`);
