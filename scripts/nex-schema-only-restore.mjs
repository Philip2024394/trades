#!/usr/bin/env node
// Step D · Execute schema-only restore against Supabase Project B (ijvqdvsvwtwxzcqmoqit).
// Strips psql meta-commands (\restrict / \unrestrict), wraps in BEGIN/COMMIT, POSTs to
// Supabase Management API /database/query. Restores nex.* schema only. Zero table data.
// Zero public.* touches. If anything fails, the wrapping transaction rolls back.

import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");
const envText = readFileSync(resolve(repoRoot, ".env.tools.local"), "utf8");
const TOKEN = envText.match(/NEX_SUPABASE_ACCESS_TOKEN=(\S+)/)?.[1];
const REF = envText.match(/NEX_SUPABASE_PROJECT_REF=(\S+)/)?.[1];
if (!TOKEN || !REF) { console.error("Missing NEX_SUPABASE_ACCESS_TOKEN or NEX_SUPABASE_PROJECT_REF"); process.exit(2); }

const ENDPOINT = `https://api.supabase.com/v1/projects/${REF}/database/query`;
const SCHEMA_SQL_PATH = resolve(repoRoot, "scripts", "nex-migration", "nex-schema-only-post-enum-fix.sql");

// 1 · Load + strip psql meta-commands
let raw = readFileSync(SCHEMA_SQL_PATH, "utf8");
const stripped = raw.split(/\r?\n/).filter(line => !/^\\(restrict|unrestrict)\b/.test(line)).join("\n");
const strippedBytes = Buffer.byteLength(stripped, "utf8");
process.stderr.write(`  loaded schema SQL: ${strippedBytes} bytes (${(strippedBytes/1024).toFixed(1)} KB) after stripping meta-commands\n`);

// 2 · Wrap in explicit BEGIN/COMMIT for atomicity + guarantee statement_timeout=0
//     Plus explicit CREATE SCHEMA nex (pg_dump --schema=nex filter omits it)
//     Plus minimum-privilege role creation for the 2 missing role targets referenced
//     by 22 CREATE POLICY statements. Both NOLOGIN, no elevated privileges.
const preamble = `-- schema-only restore wrapper · Step D · nex.* only
BEGIN;
SET LOCAL statement_timeout = 0;
SET LOCAL lock_timeout = 0;
SET LOCAL idle_in_transaction_session_timeout = 0;

-- Ensure the nex schema exists (pg_dump --schema=nex filter omits CREATE SCHEMA)
CREATE SCHEMA IF NOT EXISTS nex;

-- Create the two NEX application roles referenced by CREATE POLICY statements.
-- NOLOGIN = these are group-roles for RLS policy attachment only. They cannot
-- log in themselves. No SUPERUSER, CREATEDB, CREATEROLE, REPLICATION.
-- USAGE on the nex schema only. No cross-schema privileges. Idempotent.
DO $body$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'nex_brain_app') THEN
    CREATE ROLE nex_brain_app NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'nex_social_app') THEN
    CREATE ROLE nex_social_app NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION;
  END IF;
END $body$;
GRANT USAGE ON SCHEMA nex TO nex_brain_app, nex_social_app;

`;
const wrappedSql = `${preamble}${stripped}\n\nCOMMIT;`;
const finalBytes = Buffer.byteLength(wrappedSql, "utf8");
process.stderr.write(`  wrapped in BEGIN/COMMIT: ${finalBytes} bytes total\n`);

// 3 · Save the exact SQL that will be POSTed (for audit)
const outSql = resolve(repoRoot, "scripts", "nex-migration", "nex-schema-only-POSTED.sql");
writeFileSync(outSql, wrappedSql);
process.stderr.write(`  saved wrapped SQL to: ${outSql}\n`);

// 4 · Pre-flight target-side safety checks BEFORE writing anything
async function q(sql) {
  const r = await fetch(ENDPOINT, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query: sql }),
  });
  const text = await r.text();
  let body; try { body = JSON.parse(text); } catch { body = text; }
  return { status: r.status, body };
}

process.stderr.write("\n=== TARGET SAFETY CHECK (pre-write) ===\n");
const pubCountPre = await q("SELECT count(*) AS n FROM information_schema.tables WHERE table_schema='public'");
const nexExistsPre = await q("SELECT count(*) AS n FROM pg_namespace WHERE nspname='nex'");
console.log("  target public.* table count (pre):", pubCountPre.body[0]?.n);
console.log("  target nex schema exists (pre):", nexExistsPre.body[0]?.n === 0 ? "NO (safe)" : "YES (ABORT)");

if (nexExistsPre.body[0]?.n !== 0) {
  console.error("\nABORT · nex schema already exists on target. Refusing to overwrite.");
  process.exit(3);
}

// 5 · POST the schema-only restore
process.stderr.write("\n=== EXECUTING SCHEMA-ONLY RESTORE (Management API POST) ===\n");
const started = Date.now();
const r = await fetch(ENDPOINT, {
  method: "POST",
  headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
  body: JSON.stringify({ query: wrappedSql }),
});
const elapsed = ((Date.now() - started) / 1000).toFixed(2);
const text = await r.text();
let body; try { body = JSON.parse(text); } catch { body = text; }
console.log(`  HTTP ${r.status} in ${elapsed}s`);
console.log("  response body preview:", typeof body === "string" ? body.slice(0, 800) : JSON.stringify(body).slice(0, 800));

if (r.status !== 200 && r.status !== 201) {
  console.error("\nRESTORE FAILED · transaction rolled back on target (BEGIN/COMMIT semantics)");
  process.exit(4);
}

// 6 · Post-restore verification
process.stderr.write("\n=== POST-RESTORE VERIFICATION ===\n");
const checks = [
  ["nex_schema_exists",          "SELECT count(*) AS n FROM pg_namespace WHERE nspname='nex'"],
  ["nex_tables",                 "SELECT count(*) AS n FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='nex' AND c.relkind='r'"],
  ["nex_indexes",                "SELECT count(*) AS n FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='nex' AND c.relkind='i'"],
  ["nex_pk_uk_check_constraints","SELECT count(*) AS n FROM pg_constraint co JOIN pg_namespace n ON n.oid=co.connamespace WHERE n.nspname='nex' AND co.contype IN ('p','u','c')"],
  ["nex_fk_constraints",         "SELECT count(*) AS n FROM pg_constraint co JOIN pg_namespace n ON n.oid=co.connamespace WHERE n.nspname='nex' AND co.contype='f'"],
  ["nex_rls_policies",           "SELECT count(*) AS n FROM pg_policy p JOIN pg_class c ON c.oid=p.polrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='nex'"],
  ["nex_rls_policies_by_role",   "SELECT r.rolname AS target_role, count(*) AS policies FROM pg_policy p JOIN pg_class c ON c.oid=p.polrelid JOIN pg_namespace n ON n.oid=c.relnamespace, unnest(p.polroles) AS pr(oid) LEFT JOIN pg_roles r ON r.oid=pr.oid WHERE n.nspname='nex' GROUP BY r.rolname ORDER BY r.rolname"],
  ["nex_rls_enabled_tables",     "SELECT count(*) AS n FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='nex' AND c.relkind='r' AND c.relrowsecurity=true"],
  ["nex_functions",              "SELECT count(*) AS n FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='nex'"],
  ["nex_views",                  "SELECT count(*) AS n FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='nex' AND c.relkind='v'"],
  ["nex_matviews",               "SELECT count(*) AS n FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='nex' AND c.relkind='m'"],
  ["nex_sequences",              "SELECT count(*) AS n FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='nex' AND c.relkind='S'"],
  ["nex_enum_types",             "SELECT count(*) AS n FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname='nex' AND t.typtype='e'"],
  ["nex_composite_types",        "SELECT count(*) AS n FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname='nex' AND t.typtype='c' AND t.typrelid IN (SELECT oid FROM pg_class WHERE relkind='c')"],
  ["nex_triggers",               "SELECT count(*) AS n FROM pg_trigger tr JOIN pg_class c ON c.oid=tr.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='nex' AND NOT tr.tgisinternal"],
  ["public_tables_still_17",     "SELECT count(*) AS n FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='r'"],
  ["public_policies_count",      "SELECT count(*) AS n FROM pg_policy p JOIN pg_class c ON c.oid=p.polrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public'"],
  ["public_no_nex_food",         "SELECT count(*) AS n FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname LIKE 'nex_food%'"],
  ["public_no_nex_food_types",   "SELECT count(*) AS n FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname='public' AND t.typname LIKE 'nex_food%'"],
  ["fk_from_nex_to_public",      `SELECT count(*) AS n FROM pg_constraint co
                                    JOIN pg_class c ON c.oid=co.conrelid
                                    JOIN pg_namespace n ON n.oid=c.relnamespace
                                    JOIN pg_class rc ON rc.oid=co.confrelid
                                    JOIN pg_namespace rn ON rn.oid=rc.relnamespace
                                    WHERE co.contype='f' AND n.nspname='nex' AND rn.nspname='public'`],
  ["known_public_row_check",     "SELECT (SELECT count(*) FROM public.knowledge_records) AS knowledge_records, (SELECT count(*) FROM public.worker_jobs) AS worker_jobs"],
  ["nex_app_roles_created",      "SELECT rolname, rolcanlogin, rolsuper, rolcreatedb, rolcreaterole FROM pg_roles WHERE rolname IN ('nex_brain_app','nex_social_app') ORDER BY rolname"],
  ["all_schemas_present",        "SELECT n.nspname FROM pg_namespace n WHERE n.nspname NOT LIKE 'pg_%' AND n.nspname != 'information_schema' ORDER BY n.nspname"],
  ["unexpected_new_public_tables","SELECT relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='r' ORDER BY relname"],
];

const results = {};
for (const [name, sql] of checks) {
  const r = await q(sql);
  results[name] = r.body;
  process.stderr.write(`  ${name.padEnd(30)} → ${JSON.stringify(r.body)}\n`);
}

const reportPath = resolve(repoRoot, "scripts", "nex-migration", "schema-only-restore-report.json");
writeFileSync(reportPath, JSON.stringify({
  execution: {
    endpoint: ENDPOINT,
    schema_sql_bytes: finalBytes,
    http_status: r.status,
    elapsed_seconds: elapsed,
    posted_sql_file: outSql,
  },
  target_before: {
    public_tables: pubCountPre.body[0]?.n,
    nex_schema_existed: nexExistsPre.body[0]?.n !== 0,
  },
  target_after: results,
}, null, 2));
console.log(`\nReport: ${reportPath}`);
