// Batch 6 · execution design + fresh baselines from FROZEN LOCAL · READ-ONLY.

import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync, spawnSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..", "..");
const envText = readFileSync(resolve(repoRoot, ".env.tools.local"), "utf8");
const TOKEN = envText.match(/NEX_SUPABASE_ACCESS_TOKEN=(\S+)/)[1];
const REF = envText.match(/NEX_SUPABASE_PROJECT_REF=(\S+)/)[1];
const MGMT = `https://api.supabase.com/v1/projects/${REF}/database/query`;
const PSQL = "C:\\Program Files\\PostgreSQL\\17\\bin\\psql.exe";
const LOCAL_URI = "postgresql://postgres:Admin1phil@localhost:5433/nex_dev";

function local(sql) {
  const r = spawnSync(PSQL, ["-Atc", sql, LOCAL_URI], { env: { ...process.env, PGPASSWORD: "Admin1phil" }, encoding: "utf8", timeout: 300000 });
  if (r.status !== 0) { console.error(`local psql failed: ${r.stderr}`); process.exit(1); }
  return r.stdout.trim();
}
async function q(sql) {
  const r = await fetch(MGMT, { method: "POST", headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" }, body: JSON.stringify({ query: sql }) });
  const text = await r.text();
  try { return { status: r.status, body: JSON.parse(text) }; } catch { return { status: r.status, body: text }; }
}

console.log("═══════════════════════════════════════════════════════════════════════════");
console.log("BATCH 6 · EXECUTION DESIGN + FRESH FROZEN-LOCAL BASELINES");
console.log("═══════════════════════════════════════════════════════════════════════════\n");

// ─── FRESH FROZEN-LOCAL BASELINES ────────────────────────────────────────
console.log("─── 1 · Fresh baselines from FROZEN LOCAL nex_dev (Option A source of truth) ───\n");

console.log("  Executing exact total count, min/max merge_id, distributions...");
const totalCount = Number(local("SELECT count(*) FROM nex.identity_merge_log"));
// UUID has no built-in min/max aggregate — cast to text for ordering (lexicographic == UUID canonical order)
const minMax = local("SELECT min(merge_id::text) || '|' || max(merge_id::text) FROM nex.identity_merge_log").split("|");
console.log(`  total_rows:     ${totalCount.toLocaleString()}  (must equal 1,376,510)`);
console.log(`  min(merge_id):  ${minMax[0]}`);
console.log(`  max(merge_id):  ${minMax[1]}`);
if (totalCount !== 1376510) { console.error("❌ frozen count drift · aborting design"); process.exit(1); }

// Distribution by match_layer (5-value CHECK constraint)
console.log("\n  By match_layer:");
const byLayerRaw = local("SELECT match_layer || '|' || count(*)::text FROM nex.identity_merge_log GROUP BY match_layer ORDER BY count(*) DESC");
const byLayer = {};
for (const line of byLayerRaw.split("\n")) { const [k,v] = line.split("|"); byLayer[k] = Number(v); console.log(`    ${k.padEnd(20)} ${Number(v).toLocaleString()}`); }

// Distribution by table_name
console.log("\n  By table_name:");
const byTableRaw = local("SELECT table_name || '|' || count(*)::text FROM nex.identity_merge_log GROUP BY table_name ORDER BY count(*) DESC");
const byTable = {};
for (const line of byTableRaw.split("\n")) { const [k,v] = line.split("|"); byTable[k] = Number(v); console.log(`    ${k.padEnd(35)} ${Number(v).toLocaleString()}`); }

// Distribution by day
console.log("\n  By day(merged_at):");
const byDayRaw = local("SELECT date_trunc('day', merged_at)::date::text || '|' || count(*)::text FROM nex.identity_merge_log GROUP BY date_trunc('day', merged_at) ORDER BY date_trunc('day', merged_at)");
const byDay = {};
for (const line of byDayRaw.split("\n")) { const [k,v] = line.split("|"); byDay[k] = Number(v); console.log(`    ${k.padEnd(15)} ${Number(v).toLocaleString()}`); }

// Deterministic integrity subset: merge_id starting with '00' (uniform 1/256th of PK space)
// Use unambiguous delimiters: chr(31) = ASCII Unit Separator between fields, chr(30) = Record Separator between rows
console.log("\n  Deterministic integrity subset (WHERE merge_id::text LIKE '00%'):");
const subsetCount = Number(local("SELECT count(*) FROM nex.identity_merge_log WHERE merge_id::text LIKE '00%'"));
console.log(`    subset row count: ${subsetCount.toLocaleString()} (~1/256 of PK space)`);

// Use quote_nullable() to escape safely, || with an unambiguous field separator chr(31), and row separator chr(30)
// Hash of ordered (merge_id, table_name, match_layer, incoming_source, merged_at::text)
console.log("  computing md5 hash over subset (deterministic · order-stable)...");
const subsetHash = local(`
  SELECT md5(string_agg(
    merge_id::text || chr(31) ||
    coalesce(quote_nullable(table_name), 'NULL') || chr(31) ||
    coalesce(quote_nullable(match_layer), 'NULL') || chr(31) ||
    coalesce(quote_nullable(incoming_source), 'NULL') || chr(31) ||
    merged_at::text,
    chr(30) ORDER BY merge_id
  ))
  FROM nex.identity_merge_log
  WHERE merge_id::text LIKE '00%'
`);
console.log(`    subset md5:       ${subsetHash}`);

// Sum of a numeric column for extra proof (incoming_lat/lng where not null)
const numericSum = local(`
  SELECT
    count(incoming_lat)::text || '|' || count(incoming_lng)::text || '|' ||
    coalesce(round(sum(incoming_lat)::numeric, 6)::text, 'NULL') || '|' ||
    coalesce(round(sum(incoming_lng)::numeric, 6)::text, 'NULL')
  FROM nex.identity_merge_log
`);
const [nLat, nLng, sumLat, sumLng] = numericSum.split("|");
console.log(`\n  Numeric aggregates (extra check):`);
console.log(`    non-null count(incoming_lat)=${Number(nLat).toLocaleString()}, sum=${sumLat}`);
console.log(`    non-null count(incoming_lng)=${Number(nLng).toLocaleString()}, sum=${sumLng}`);

// Chunk plan
const CHUNK_SIZE = 100000;
const chunkCount = Math.ceil(totalCount / CHUNK_SIZE);
console.log(`\n─── 2 · Chunk plan · ${CHUNK_SIZE.toLocaleString()} rows/chunk · ${chunkCount} chunks ───`);
console.log(`  Chunks 1-${chunkCount - 1}: exactly ${CHUNK_SIZE.toLocaleString()} rows each`);
console.log(`  Chunk ${chunkCount}: ${(totalCount - (chunkCount - 1) * CHUNK_SIZE).toLocaleString()} rows (remainder)`);
console.log(`  Ordering: strict ASC by merge_id (PK · uuid · index-only-scannable)`);
console.log(`  Boundary: chunk N+1 uses WHERE merge_id > $last_of_chunk_N`);

// Persist baseline to disk
const baseline = {
  captured_at: new Date().toISOString(),
  source: "frozen local nex_dev · NEX_POSTGRES_URL=localhost:5433/nex_dev",
  total_rows: totalCount,
  min_merge_id: minMax[0],
  max_merge_id: minMax[1],
  by_match_layer: byLayer,
  by_table_name: byTable,
  by_day_merged_at: byDay,
  subset_row_count: subsetCount,
  subset_predicate: "WHERE merge_id::text LIKE '00%'",
  subset_hash_algo: "md5(string_agg(field1||chr(31)||field2||chr(31)||... , chr(30) ORDER BY merge_id))",
  subset_hash_fields: ["merge_id::text","quote_nullable(table_name)","quote_nullable(match_layer)","quote_nullable(incoming_source)","merged_at::text"],
  subset_hash: subsetHash,
  numeric_aggregates: {
    non_null_incoming_lat: Number(nLat),
    sum_incoming_lat: sumLat,
    non_null_incoming_lng: Number(nLng),
    sum_incoming_lng: sumLng,
  },
  chunk_size: CHUNK_SIZE,
  chunk_count: chunkCount,
  columns: ["merge_id","table_name","existing_ref","match_layer","incoming_source","incoming_source_reference","incoming_name","incoming_city","incoming_website","incoming_phone","incoming_whatsapp","incoming_lat","incoming_lng","incoming_extras","enriched_fields","skipped_reason","worker_id","cycle_run_id","merged_at"],
};
const baselinePath = resolve(__dirname, "batch-06-baseline.json");
writeFileSync(baselinePath, JSON.stringify(baseline, null, 2));
console.log(`\n  Baseline persisted: ${baselinePath}`);

// ─── TARGET BASELINE ─────────────────────────────────────────────────────
console.log("\n─── 3 · Target baseline (Supabase Project B, right now) ───");
const inv = (await q(`
  SELECT (SELECT count(*) FROM nex.identity_merge_log) AS imel_target,
         (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='nex' AND c.relkind='r' AND c.relrowsecurity=true) AS rls,
         (SELECT count(*) FROM pg_constraint c JOIN pg_namespace n ON n.oid=c.connamespace WHERE n.nspname='nex' AND c.contype='f') AS fks,
         (SELECT count(*) FROM public.knowledge_records) AS kr,
         (SELECT count(*) FROM public.worker_jobs) AS wj,
         (SELECT count(*) FROM public.worker_results) AS wr,
         pg_database_size(current_database()) AS db_bytes,
         pg_size_pretty(pg_database_size(current_database())) AS db_pretty,
         pg_current_wal_lsn()::text AS wal_lsn
`)).body[0];
console.log(`  identity_merge_log rows:  ${inv.imel_target}  (must be 0)`);
console.log(`  db_size:                  ${inv.db_pretty}  (${Number(inv.db_bytes).toLocaleString()} bytes)`);
console.log(`  wal_lsn:                  ${inv.wal_lsn}`);
console.log(`  RLS-enabled tables:       ${inv.rls} (expected 92)`);
console.log(`  FK count:                 ${inv.fks} (expected 0)`);
console.log(`  public.knowledge_records: ${inv.kr} (expected 3627)`);
console.log(`  public.worker_jobs:       ${inv.wj} (expected 19167)`);
console.log(`  public.worker_results:    ${inv.wr} (expected 19140)`);
const ro = await fetch(`https://api.supabase.com/v1/projects/${REF}/readonly`, { headers: { Authorization: `Bearer ${TOKEN}` } }).then(r => r.json());
console.log(`  Supabase readonly:        enabled=${ro.enabled}`);

// ─── EXECUTION DESIGN ────────────────────────────────────────────────────
console.log("\n─── 4 · Execution design (Node script · not yet executed) ───");
console.log(`
STATE FILE: scripts/nex-migration/batch-06-progress.json
    {
      started_at, last_merge_id, chunks_completed: [...], target_row_count, wal_history: [...]
    }

TIGHTENED STOP THRESHOLDS (Philip's approved values):
    • Supabase readonly.enabled == true
    • pg_database_size > 3 GB (3,221,225,472 bytes)  ← was 6 GB, tightened
    • Single-chunk WAL delta > 200 MB                ← was 300 MB, tightened
    • Any COPY error
    • Row count mismatch (source_extract vs target_delta)
    • Total elapsed > 60 min

TEMP FILES (deleted after successful chunk):
    scripts/nex-migration/tmp/chunk-N.csv   ~66 MB each · overwritten between chunks
    (single 100K-row TSV export from local · load to target · then delete)

EXECUTION LOOP per chunk (Node orchestrator, sequential):

    load state from batch-06-progress.json (or init at chunk=1, last_merge_id=NULL)

    for chunk_num in [state.chunks_completed.length+1 .. 14]:

      # ---- PRE ----
      pre = {
        db_bytes: q("SELECT pg_database_size(current_database())"),
        wal_lsn:  q("SELECT pg_current_wal_lsn()::text"),
        target_count: q("SELECT count(*) FROM nex.identity_merge_log"),
        readonly: GET /v1/projects/{ref}/readonly,
        t0: Date.now(),
      }
      if (pre.readonly.enabled) STOP("readonly at chunk start")
      if (pre.db_bytes > 3 GB) STOP("db size at chunk start")

      # ---- EXTRACT ----
      chunk_path = tmp/chunk-N.csv
      psql $LOCAL_URI -c "\\copy (
        SELECT merge_id, table_name, existing_ref, match_layer, incoming_source,
               incoming_source_reference, incoming_name, incoming_city, incoming_website,
               incoming_phone, incoming_whatsapp, incoming_lat, incoming_lng, incoming_extras,
               enriched_fields, skipped_reason, worker_id, cycle_run_id, merged_at
        FROM nex.identity_merge_log
        WHERE merge_id > COALESCE('$last_merge_id'::uuid, '00000000-0000-0000-0000-000000000000'::uuid)
        ORDER BY merge_id
        LIMIT 100000
      ) TO 'chunk-N.csv' WITH (FORMAT csv, HEADER false, DELIMITER e'\\t', NULL '\\\\N')"

      # ---- Chunk stats ----
      csv_row_count = wc -l chunk-N.csv
      chunk_last_id = tail -1 chunk-N.csv | cut -f1     (first col is merge_id)
      if (csv_row_count < 100000 && chunk_num < 14) STOP("premature short chunk")

      # ---- LOAD ----
      PGOPTIONS='-c role=service_role' psql "$NEX_SUPABASE_DB_URL" \\
        -v ON_ERROR_STOP=1 -c \\
        "BEGIN; \\copy nex.identity_merge_log (merge_id,table_name,existing_ref,match_layer,
           incoming_source,incoming_source_reference,incoming_name,incoming_city,incoming_website,
           incoming_phone,incoming_whatsapp,incoming_lat,incoming_lng,incoming_extras,
           enriched_fields,skipped_reason,worker_id,cycle_run_id,merged_at
         ) FROM 'chunk-N.csv' WITH (FORMAT csv, DELIMITER e'\\t', NULL '\\\\N');
         COMMIT;"

      # exit code non-zero → transaction rolled back automatically by BEGIN/COMMIT semantics
      # + ON_ERROR_STOP=1 aborts the psql session on first error
      # → target state unchanged from PRE
      # → last_merge_id NOT advanced → safe retry on same range

      # ---- POST ----
      post = {
        db_bytes, wal_lsn, target_count, max_merge_id, readonly,
      }
      db_delta = post.db_bytes - pre.db_bytes
      wal_delta_bytes = pg_wal_lsn_diff(post.wal_lsn, pre.wal_lsn)
      elapsed = (Date.now() - pre.t0) / 1000

      # ---- VERIFY ----
      required = post.target_count == pre.target_count + csv_row_count
      required = post.max_merge_id == chunk_last_id
      required = wal_delta_bytes <= 200 MB
      required = post.db_bytes <= 3 GB
      required = !post.readonly.enabled

      # ---- SUCCESS ----
      state.chunks_completed.push({
        chunk_num, first_merge_id: <first from csv>, last_merge_id: chunk_last_id,
        rows_sent: csv_row_count, target_before: pre.target_count, target_after: post.target_count,
        db_before, db_after, db_delta_bytes, wal_lsn_before, wal_lsn_after, wal_delta_bytes,
        elapsed_seconds: elapsed,
      })
      state.last_merge_id = chunk_last_id
      state.target_row_count = post.target_count
      persistState()
      unlink(chunk-N.csv)
      log per-chunk row

    endfor

    # ---- POST-BATCH VERIFICATION (per Philip's stronger set) ----
    verify {
      A: target count == 1,376,510                              ← total from frozen local baseline
      B: min(merge_id) target == baseline.min_merge_id
         max(merge_id) target == baseline.max_merge_id
      C: distribution by match_layer target == baseline.by_match_layer (5 exact counts)
      D: distribution by table_name target == baseline.by_table_name (3 exact counts)
      E: distribution by day(merged_at) target == baseline.by_day_merged_at (6 exact counts)
      F: 100 random merge_ids · fetch full row from local + target · deep-compare 19 columns
      G: subset md5 hash · target computes same md5 with same delimiters + fields + order · must match baseline.subset_hash
    }

    if all pass:
      log SUCCESS · cumulative report
      persistState({ complete: true })
    else:
      log which verifier failed
      report state
      HARD STOP (no auto-remediation)
`);

// ─── EXACT PSQL COMMANDS PREVIEW ─────────────────────────────────────────
console.log("─── 5 · Exact psql commands (to be embedded in Node execution script) ───");
console.log(`
  EXTRACT (per chunk N):
    psql "postgresql://postgres:...@localhost:5433/nex_dev" \\
      -v ON_ERROR_STOP=1 \\
      -c "\\copy (SELECT merge_id, table_name, existing_ref, match_layer, incoming_source, incoming_source_reference, incoming_name, incoming_city, incoming_website, incoming_phone, incoming_whatsapp, incoming_lat, incoming_lng, incoming_extras, enriched_fields, skipped_reason, worker_id, cycle_run_id, merged_at FROM nex.identity_merge_log WHERE merge_id > '\\$LAST_ID'::uuid ORDER BY merge_id LIMIT 100000) TO 'chunk-N.csv' WITH (FORMAT csv, HEADER false, DELIMITER E'\\t', NULL '\\\\N')"

  LOAD (per chunk N):
    PGOPTIONS='-c role=service_role -c statement_timeout=0 -c lock_timeout=0' \\
    psql "$NEX_SUPABASE_DB_URL" \\
      -v ON_ERROR_STOP=1 \\
      -c "BEGIN; \\copy nex.identity_merge_log (merge_id, table_name, existing_ref, match_layer, incoming_source, incoming_source_reference, incoming_name, incoming_city, incoming_website, incoming_phone, incoming_whatsapp, incoming_lat, incoming_lng, incoming_extras, enriched_fields, skipped_reason, worker_id, cycle_run_id, merged_at) FROM 'chunk-N.csv' WITH (FORMAT csv, DELIMITER E'\\t', NULL '\\\\N'); COMMIT;"

  PER-CHUNK MEASUREMENT (via Management API):
    POST /v1/projects/{ref}/database/query { query: "
      SELECT pg_database_size(current_database())::text AS db_bytes,
             pg_current_wal_lsn()::text AS wal_lsn,
             (SELECT count(*) FROM nex.identity_merge_log)::text AS target_count,
             (SELECT max(merge_id) FROM nex.identity_merge_log)::text AS max_merge_id
    "}
    GET /v1/projects/{ref}/readonly
`);

// ─── ABSOLUTE NO-GOs ─────────────────────────────────────────────────────
console.log("─── 6 · Absolute NO-GO list (enforced by omission from script) ───");
console.log(`  ✗ No FK recreation
  ✗ No ANALYZE
  ✗ No matview refresh
  ✗ No workforce restart
  ✗ No Next.js restart
  ✗ No scheduled-task enable
  ✗ No NEX_POSTGRES_URL change
  ✗ No local writes (only SELECT + \\copy TO)
  ✗ No public.* writes
  ✗ No migration-role changes
  ✗ No dump modification
  ✗ No pg_switch_wal() calls (never treat as WAL cleanup)
`);

console.log("═══════════════════════════════════════════════════════════════════════════");
console.log("HARD STOP · Design complete. Baseline captured. NO WRITES to Supabase.");
console.log("═══════════════════════════════════════════════════════════════════════════");
console.log(`
Next step: your explicit approval to build + execute execute-batch06.mjs.

Artifacts created (local only):
  • scripts/nex-migration/batch-06-baseline.json   ← frozen-local baseline for later comparison
  • scripts/nex-migration/build-batch06-design.mjs ← this script (design report)

Nothing to be created/executed until you say "execute Batch 6".
`);
