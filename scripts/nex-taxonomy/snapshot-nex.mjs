#!/usr/bin/env node
// scripts/nex-taxonomy/snapshot-nex.mjs · Philip 2026-09-05
//
// Read-only snapshot of key nex.* + public.* row counts so BEFORE/AFTER
// comparison can prove T1 did not disturb unrelated NEX data.
// Emits JSON to stdout. Also skips schemas that don't exist gracefully.
//
// USAGE
//   NEX_POSTGRES_URL=... node scripts/nex-taxonomy/snapshot-nex.mjs > snapshot.json

const OBJECTS_TO_SNAPSHOT = [
  // NEX operational
  { schema: "nex", table: "work_item" },
  { schema: "nex", table: "worker_cycle_run" },
  { schema: "nex", table: "food_business" },
  { schema: "nex", table: "conv_intents" },
  { schema: "nex", table: "jobs" },
  { schema: "nex", table: "brain_memories" },
  { schema: "nex", table: "events" },
  { schema: "nex", table: "mp_category" },
  // Existing workforce v2 if present
  { schema: "nex_workforce", table: "worker_health" },
  // Public schema samples (System A adjacency)
  { schema: "public", table: "profiles" },
];

async function main() {
  const url = process.env.NEX_POSTGRES_URL;
  if (!url) { console.error("[snapshot] NEX_POSTGRES_URL not set"); process.exit(1); }
  const pg = await import("pg");
  const needsSsl = /supabase\.co|render\.com|neon\.tech|amazonaws\.com/.test(url);
  const pool = new pg.default.Pool({ connectionString: url, ssl: needsSsl ? { rejectUnauthorized: false } : undefined, max: 2 });
  const client = await pool.connect();
  const snapshot = { taken_at: new Date().toISOString(), counts: {}, notes: [] };
  try {
    for (const obj of OBJECTS_TO_SNAPSHOT) {
      try {
        const { rows } = await client.query(`SELECT count(*)::bigint AS c FROM ${obj.schema}.${obj.table}`);
        snapshot.counts[`${obj.schema}.${obj.table}`] = Number(rows[0].c);
      } catch (err) {
        snapshot.notes.push(`${obj.schema}.${obj.table} unavailable: ${String(err.message ?? err).slice(0, 120)}`);
      }
    }
    // Existing schemas + policies count as extra invariants
    const { rows: [{ c: nex_schema_count }] } = await client.query(`SELECT count(*)::int AS c FROM information_schema.schemata WHERE schema_name LIKE 'nex%'`);
    const { rows: [{ c: nex_policies_count }] } = await client.query(`SELECT count(*)::int AS c FROM pg_policies WHERE schemaname LIKE 'nex%'`);
    const { rows: [{ c: nex_tables_count }] } = await client.query(`SELECT count(*)::int AS c FROM information_schema.tables WHERE table_schema LIKE 'nex%'`);
    snapshot.schemas_matching_nex = nex_schema_count;
    snapshot.policies_matching_nex = nex_policies_count;
    snapshot.tables_matching_nex = nex_tables_count;
  } finally {
    client.release();
    await pool.end();
  }
  process.stdout.write(JSON.stringify(snapshot, null, 2) + "\n");
}

main().catch((err) => { console.error("[snapshot] error:", err); process.exit(1); });
