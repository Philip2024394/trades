#!/usr/bin/env node
// NEX Project B pre-flight audit · READ-ONLY · zero writes.
// Runs 13 SELECT-only checks via Supabase Management API /database/query.
// Usage: node scripts/nex-supabase-preflight.mjs
// Reads NEX_SUPABASE_ACCESS_TOKEN + NEX_SUPABASE_PROJECT_REF from .env.tools.local.

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");
const envText = readFileSync(resolve(repoRoot, ".env.tools.local"), "utf8");
const TOKEN = envText.match(/NEX_SUPABASE_ACCESS_TOKEN=(\S+)/)?.[1];
const REF = envText.match(/NEX_SUPABASE_PROJECT_REF=(\S+)/)?.[1];
if (!TOKEN || !REF) { console.error("Missing NEX_SUPABASE_ACCESS_TOKEN or NEX_SUPABASE_PROJECT_REF"); process.exit(2); }

const ENDPOINT = `https://api.supabase.com/v1/projects/${REF}/database/query`;

async function q(name, sql) {
  const r = await fetch(ENDPOINT, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query: sql }),
  });
  const text = await r.text();
  let body;
  try { body = JSON.parse(text); } catch { body = text; }
  return { name, status: r.status, body };
}

const CHECKS = [
  ["01_pg_version_and_extensions", `
    SELECT version() AS pg_version, current_database() AS db, current_user AS running_as;
  `],
  ["02_extensions_installed", `
    SELECT extname, extversion, extnamespace::regnamespace::text AS in_schema
    FROM pg_extension ORDER BY extname;
  `],
  ["03_extensions_available", `
    SELECT name, default_version, installed_version, comment
    FROM pg_available_extensions
    WHERE name IN ('pgcrypto','uuid-ossp','plpgsql','pg_trgm','vector','postgis','pg_stat_statements','pgjwt','pgsodium','pg_graphql','pg_cron','pg_net','hstore','ltree')
    ORDER BY name;
  `],
  ["04_database_size", `
    SELECT pg_size_pretty(pg_database_size(current_database())) AS total_size,
           pg_database_size(current_database()) AS total_bytes;
  `],
  ["05_schemas_and_object_counts", `
    SELECT n.nspname AS schema,
      (SELECT count(*) FROM pg_class WHERE relnamespace=n.oid AND relkind='r') AS tables,
      (SELECT count(*) FROM pg_class WHERE relnamespace=n.oid AND relkind='v') AS views,
      (SELECT count(*) FROM pg_class WHERE relnamespace=n.oid AND relkind='m') AS matviews,
      (SELECT count(*) FROM pg_proc  WHERE pronamespace=n.oid) AS functions,
      (SELECT count(*) FROM pg_type  WHERE typnamespace=n.oid AND typtype='c') AS composite_types
    FROM pg_namespace n
    WHERE n.nspname NOT LIKE 'pg_%' AND n.nspname != 'information_schema'
    ORDER BY n.nspname;
  `],
  ["06_public_tables_size_and_rows", `
    SELECT c.relname AS table_name,
      pg_size_pretty(pg_total_relation_size(c.oid)) AS total_size,
      pg_total_relation_size(c.oid) AS total_bytes,
      s.n_live_tup AS row_estimate
    FROM pg_class c
    JOIN pg_namespace n ON n.oid=c.relnamespace
    LEFT JOIN pg_stat_user_tables s ON s.relid=c.oid
    WHERE c.relkind='r' AND n.nspname='public'
    ORDER BY pg_total_relation_size(c.oid) DESC;
  `],
  ["07_nex_schema_exists", `
    SELECT nspname FROM pg_namespace WHERE nspname='nex';
  `],
  ["08_roles_all", `
    SELECT rolname, rolsuper AS is_super, rolcanlogin AS can_login,
           rolcreaterole AS create_role, rolcreatedb AS create_db, rolreplication AS replication
    FROM pg_roles WHERE rolname NOT LIKE 'pg_%' ORDER BY rolname;
  `],
  ["09_target_custom_roles_status", `
    SELECT wanted.role_name AS role_needed,
      CASE WHEN r.rolname IS NOT NULL THEN 'EXISTS' ELSE 'MISSING' END AS status
    FROM (VALUES ('nex_brain_app'),('nex_social_app'),('service_role'),('authenticator'),('anon'),('authenticated'),('supabase_admin')) AS wanted(role_name)
    LEFT JOIN pg_roles r ON r.rolname = wanted.role_name
    ORDER BY wanted.role_name;
  `],
  ["10_rls_policies_all_user_schemas", `
    SELECT n.nspname AS schema, c.relname AS table_name,
      c.relrowsecurity AS rls_enabled,
      (SELECT count(*) FROM pg_policy p WHERE p.polrelid=c.oid) AS policy_count
    FROM pg_class c
    JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE c.relkind='r'
      AND n.nspname NOT IN ('pg_catalog','information_schema','pg_toast','extensions','auth','storage','realtime','supabase_functions','pgsodium','pgsodium_masks','vault','graphql','graphql_public','_analytics','_realtime','supabase_migrations','net')
    ORDER BY n.nspname, c.relname;
  `],
  ["11_security_definer_functions_public", `
    SELECT n.nspname AS schema, p.proname AS function_name,
      pg_get_function_identity_arguments(p.oid) AS args,
      p.prosecdef AS security_definer,
      r.rolname AS owner
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid=p.pronamespace
    JOIN pg_roles r ON r.oid=p.proowner
    WHERE p.prosecdef=true AND n.nspname NOT IN ('pg_catalog','information_schema','pg_toast','extensions','auth','storage','realtime','supabase_functions','pgsodium','pgsodium_masks','vault','graphql','graphql_public','_analytics','_realtime','supabase_migrations','net')
    ORDER BY n.nspname, p.proname;
  `],
  ["12_disk_usage_by_schema", `
    SELECT n.nspname AS schema,
      pg_size_pretty(sum(pg_total_relation_size(c.oid))) AS total_size,
      sum(pg_total_relation_size(c.oid)) AS total_bytes,
      count(*) FILTER (WHERE c.relkind='r') AS tables
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE c.relkind IN ('r','i','t','m')
      AND n.nspname NOT LIKE 'pg_%' AND n.nspname!='information_schema'
    GROUP BY n.nspname ORDER BY sum(pg_total_relation_size(c.oid)) DESC;
  `],
  ["13_settings_relevant", `
    SELECT name, setting, unit, short_desc
    FROM pg_settings
    WHERE name IN ('max_connections','shared_buffers','work_mem','maintenance_work_mem','statement_timeout','idle_in_transaction_session_timeout','max_prepared_transactions','server_version','server_version_num')
    ORDER BY name;
  `],
];

const results = {};
for (const [name, sql] of CHECKS) {
  process.stderr.write(`  running ${name}... `);
  const r = await q(name, sql);
  results[name] = r;
  process.stderr.write(`HTTP ${r.status}${Array.isArray(r.body)?` · ${r.body.length} rows`:''}\n`);
}

const outPath = resolve(repoRoot, "scripts", "nex-preflight-report.json");
writeFileSync(outPath, JSON.stringify(results, null, 2));
console.log(`\nReport written to ${outPath}`);
console.log(`Total checks: ${CHECKS.length}`);
