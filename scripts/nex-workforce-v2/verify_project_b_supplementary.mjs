// Supplementary verification · uses pg_catalog which is accessible to all roles
// regardless of USAGE grants. Confirms schema/tables/triggers exist even though
// information_schema filters them out for nex_app_runtime.
import pg from "pg";

const client = new pg.Client({ connectionString: process.env.NEX_POSTGRES_URL });
await client.connect();

async function q(label, sql) {
  try {
    const r = await client.query(sql);
    console.log(`── ${label} · ${r.rows.length} row(s) ──`);
    for (const row of r.rows) console.log("  ", JSON.stringify(row));
  } catch (e) {
    console.log(`── ${label} · ERROR: ${e.message}`);
  }
}

// Schema via pg_namespace (system catalog · unfiltered by permissions)
await q("pg_namespace_nex_workforce", `
  SELECT nspname, nspowner::regrole::text AS owner
  FROM pg_namespace
  WHERE nspname = 'nex_workforce'
`);

// Tables via pg_class + pg_namespace
await q("pg_class_tables_nex_workforce", `
  SELECT c.relname
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'nex_workforce' AND c.relkind = 'r'
  ORDER BY c.relname
`);

// Views
await q("pg_class_views_nex_workforce", `
  SELECT c.relname
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'nex_workforce' AND c.relkind = 'v'
`);

// Triggers via pg_trigger (system catalog)
await q("pg_trigger_nex_workforce", `
  SELECT c.relname AS table_name, t.tgname AS trigger_name,
         CASE
           WHEN (t.tgtype & 2)  = 2  THEN 'BEFORE'
           WHEN (t.tgtype & 64) = 64 THEN 'INSTEAD OF'
           ELSE 'AFTER'
         END AS timing,
         CASE
           WHEN (t.tgtype & 4)  = 4  THEN 'INSERT'
           WHEN (t.tgtype & 8)  = 8  THEN 'DELETE'
           WHEN (t.tgtype & 16) = 16 THEN 'UPDATE'
           WHEN (t.tgtype & 32) = 32 THEN 'TRUNCATE'
         END AS event,
         t.tgtype
  FROM pg_trigger t
  JOIN pg_class c ON c.oid = t.tgrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'nex_workforce' AND NOT t.tgisinternal
`);

// tgtype for BEFORE INSERT OR UPDATE = 2 (BEFORE) + 4 (INSERT) + 16 (UPDATE) = 22
// Actually a single trigger with multiple events has one row. Value should be 22.

// Function signatures with argument types
await q("pg_proc_signatures_nex_workforce", `
  SELECT p.proname,
         pg_catalog.pg_get_function_arguments(p.oid) AS args,
         pg_catalog.pg_get_function_result(p.oid) AS returns
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'nex_workforce'
  ORDER BY p.proname
`);

// Schema owner
await q("schema_owner", `
  SELECT nspname, nspowner::regrole::text AS owner
  FROM pg_namespace WHERE nspname = 'nex_workforce'
`);

// Grants on nex_workforce schema
await q("schema_privileges", `
  SELECT nspname, nspacl::text AS acl
  FROM pg_namespace
  WHERE nspname = 'nex_workforce'
`);

// Confirm nex_app_runtime does NOT have USAGE on nex_workforce (that's why
// information_schema filtered the earlier results)
await q("runtime_role_usage_test", `
  SELECT has_schema_privilege('nex_app_runtime', 'nex_workforce', 'USAGE') AS has_usage
`);

await client.end();
console.log("\n=== SUPPLEMENTARY COMPLETE ===");
