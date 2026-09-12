// READ-ONLY verification of Slice 1b R4 applied to Project B.
// Uses NEX_POSTGRES_URL (nex_app_runtime role) — SELECT queries only.
// Governed by Philip's HARD RULES 2026-09-04: no mutation, no superuser.
//
// Verifies:
//   1. nex_workforce schema exists
//   2. 6 expected tables + 1 expected view + 9 expected functions
//   3. state-machine trigger present (BEFORE INSERT + BEFORE UPDATE events)
//   4. work_item_dedupe_active partial index with correct WHERE clause
//   5. all 8 helper function signatures + enforce_state_transitions trigger fn
//   6. zero rows in workforce tables (attempts SELECT · notes if permission denied)
//   7. existing nex.* schema unchanged (table count, function count baselines)
//   8. nex.worker_cycle_run zombie count still 32
//   9. no unexpected schemas beyond nex_workforce added

import pg from "pg";

const url = process.env.NEX_POSTGRES_URL;
if (!url) { console.error("NEX_POSTGRES_URL not set"); process.exit(1); }

const client = new pg.Client({ connectionString: url });
await client.connect();

const results = {};
async function run(label, sql, params = []) {
  try {
    const r = await client.query(sql, params);
    results[label] = { ok: true, rows: r.rows, rowCount: r.rows.length };
    console.log(`── ${label} · ${r.rows.length} row(s) ──`);
    for (const row of r.rows) console.log("  ", JSON.stringify(row));
  } catch (err) {
    results[label] = { ok: false, error: err.message, code: err.code };
    console.log(`── ${label} · ERROR ──`);
    console.log("  ", err.message);
  }
}

// Sanity: verify we're on Project B (project ref appears in current_user)
await run("target_identity", `
  SELECT current_database() AS db,
         current_user       AS role,
         inet_server_addr()::text AS server_addr,
         current_setting('server_version') AS pg_version
`);

// 1 · schema existence
await run("schema_nex_workforce", `
  SELECT schema_name FROM information_schema.schemata
  WHERE schema_name = 'nex_workforce'
`);

// 2 · tables (expected: 6)
await run("nex_workforce_tables", `
  SELECT table_name FROM information_schema.tables
  WHERE table_schema = 'nex_workforce' AND table_type = 'BASE TABLE'
  ORDER BY table_name
`);

// 2b · views (expected: 1)
await run("nex_workforce_views", `
  SELECT table_name FROM information_schema.views
  WHERE table_schema = 'nex_workforce'
`);

// 3 · functions (expected: 9 including enforce_state_transitions)
await run("nex_workforce_functions", `
  SELECT routine_name FROM information_schema.routines
  WHERE routine_schema = 'nex_workforce' AND routine_type = 'FUNCTION'
  ORDER BY routine_name
`);

// 4 · triggers (expected: 2 rows · BEFORE INSERT + BEFORE UPDATE)
await run("nex_workforce_triggers", `
  SELECT event_object_table, trigger_name, event_manipulation, action_timing
  FROM information_schema.triggers
  WHERE trigger_schema = 'nex_workforce'
  ORDER BY trigger_name, event_manipulation
`);

// 5 · R4 partial index existence + exact definition
await run("dedupe_active_index", `
  SELECT indexname, indexdef
  FROM pg_indexes
  WHERE schemaname = 'nex_workforce'
    AND indexname LIKE 'work_item_dedupe%'
  ORDER BY indexname
`);

// 6 · all workforce indexes for completeness
await run("all_workforce_indexes", `
  SELECT indexname FROM pg_indexes
  WHERE schemaname = 'nex_workforce'
  ORDER BY indexname
`);

// 7 · seed row counts (may fail with permission denied — that's diagnostic)
for (const t of ["city_catalogue","job_registry","work_item","work_item_dead_letter","agent_heartbeat","reaper_run"]) {
  await run(`seed_check_${t}`, `SELECT COUNT(*)::int AS n FROM nex_workforce.${t}`);
}

// 8 · existing nex.* schema baseline (must remain unchanged by this migration)
await run("nex_table_count", `
  SELECT COUNT(*)::int AS n FROM information_schema.tables
  WHERE table_schema = 'nex' AND table_type = 'BASE TABLE'
`);
await run("nex_function_count", `
  SELECT COUNT(*)::int AS n FROM information_schema.routines
  WHERE routine_schema = 'nex' AND routine_type = 'FUNCTION'
`);
await run("nex_view_count", `
  SELECT COUNT(*)::int AS n FROM information_schema.views
  WHERE table_schema = 'nex'
`);
await run("nex_worker_cycle_run_zombies", `
  SELECT COUNT(*)::int AS zombie_count
  FROM nex.worker_cycle_run
  WHERE status = 'running' AND finished_at IS NULL
`);
await run("nex_worker_cycle_run_total", `
  SELECT COUNT(*)::int AS total FROM nex.worker_cycle_run
`);

// 9 · unexpected schema check
await run("all_non_system_schemas", `
  SELECT schema_name FROM information_schema.schemata
  WHERE schema_name NOT IN (
    'information_schema','pg_catalog','pg_toast',
    'pg_temp_1','pg_toast_temp_1'
  )
    AND schema_name NOT LIKE 'pg_%'
  ORDER BY schema_name
`);

// 10 · RLS policies count baseline on nex.* (should not have changed)
await run("nex_rls_policy_count", `
  SELECT COUNT(*)::int AS n FROM pg_policies WHERE schemaname = 'nex'
`);
await run("nex_workforce_rls_policy_count", `
  SELECT COUNT(*)::int AS n FROM pg_policies WHERE schemaname = 'nex_workforce'
`);

await client.end();
console.log("\n=== VERIFICATION COMPLETE ===");
