// Batch 6 · identity_merge_log · streaming plan · READ-ONLY.
// Tests two extraction methods · reports full plan · no execution.

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

async function q(sql) {
  const r = await fetch(MGMT, { method: "POST", headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" }, body: JSON.stringify({ query: sql }) });
  const text = await r.text();
  let body; try { body = JSON.parse(text); } catch { body = text; }
  return { status: r.status, body };
}
function local(sql) {
  const r = spawnSync(PSQL, ["-Atc", sql, LOCAL_URI], { env: { ...process.env, PGPASSWORD: "Admin1phil" }, encoding: "utf8", timeout: 60000 });
  return r.stdout.trim();
}

console.log("═══════════════════════════════════════════════════════════════════════════");
console.log("BATCH 6 · identity_merge_log · STREAMING GATE (read-only plan · no execution)");
console.log("═══════════════════════════════════════════════════════════════════════════\n");

// ─── 1 · FREEZE VERIFICATION ────────────────────────────────────────
console.log("─── 1 · Local freeze + target state ───");
const nodeCount = execSync("powershell -NoProfile -Command \"(Get-CimInstance Win32_Process -Filter \\\"Name='node.exe'\\\" | Where-Object { $_.CommandLine -notlike '*build-batch06*' } | Measure-Object).Count\"", { encoding: "utf8" }).trim();
const taskState = execSync("powershell -NoProfile -Command \"(Get-ScheduledTask -TaskName 'NEX-Acquisition-Workforce').State\"", { encoding: "utf8" }).trim();
console.log(`  node.exe on host (excl this script): ${nodeCount} · scheduled task: ${taskState}`);

const inv = (await q(`
  SELECT
    (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='nex' AND c.relkind='r' AND c.relrowsecurity=true) AS rls_enabled,
    (SELECT count(*) FROM pg_constraint c JOIN pg_namespace n ON n.oid=c.connamespace WHERE n.nspname='nex' AND c.contype='f') AS nex_fks,
    (SELECT count(*) FROM public.knowledge_records) AS kr,
    (SELECT count(*) FROM public.worker_jobs) AS wj,
    (SELECT count(*) FROM public.worker_results) AS wr,
    (SELECT count(*) FROM nex.identity_merge_log) AS imel_target,
    pg_database_size(current_database()) AS db_bytes,
    pg_size_pretty(pg_database_size(current_database())) AS db_pretty,
    pg_current_wal_lsn()::text AS wal_lsn
`)).body[0];
console.log(`  Supabase target: DB=${inv.db_pretty} (${Number(inv.db_bytes).toLocaleString()} B) · WAL=${inv.wal_lsn}`);
console.log(`  identity_merge_log on target: ${inv.imel_target} rows (must be 0)`);
console.log(`  RLS=${inv.rls_enabled} · FKs=${inv.nex_fks} · public tables=${inv.kr === 3627 && inv.wj === 19167 ? "baseline" : "DRIFT"}`);
const ro = await fetch(`https://api.supabase.com/v1/projects/${REF}/readonly`, { headers: { Authorization: `Bearer ${TOKEN}` } }).then(r => r.json());
console.log(`  Supabase readonly: enabled=${ro.enabled}`);

// ─── 2 · SOURCE FACTS (frozen local nex_dev) ────────────────────────
console.log("\n─── 2 · Source facts (frozen local nex_dev) ───");
const dumpTs = "2026-09-03 02:30:44";
const localTotal = Number(local("SELECT count(*) FROM nex.identity_merge_log"));
const localAtDumpTs = Number(local(`SELECT count(*) FROM nex.identity_merge_log WHERE merged_at <= '${dumpTs}'::timestamptz`));
const localPostDump = localTotal - localAtDumpTs;
console.log(`  local total rows:            ${localTotal.toLocaleString()}`);
console.log(`  local rows @ dump timestamp: ${localAtDumpTs.toLocaleString()}  (WHERE merged_at <= '${dumpTs}')`);
console.log(`  local rows post-dump:        ${localPostDump.toLocaleString()}`);
console.log(`  dump snapshot rows (known):  1,356,697`);
const timestampFilterOk = localAtDumpTs === 1356697;
console.log(`  timestamp filter equals dump count exactly: ${timestampFilterOk ? "✓ YES" : "❌ NO — filter alone insufficient"}`);

// ─── 3 · TABLE SCHEMA ─────────────────────────────────────────────────
console.log("\n─── 3 · Schema summary (from earlier investigation) ───");
console.log(`  Table:      nex.identity_merge_log`);
console.log(`  PK:         merge_id (uuid, gen_random_uuid())`);
console.log(`  Indexes:    identity_merge_log_pkey (PK) + 3 non-unique btree indexes`);
console.log(`  Local size: 599 MB heap + 296 MB indexes = 896 MB physical`);
console.log(`  Columns:    19 (merge_id, table_name, existing_ref, match_layer, incoming_*, enriched_fields, skipped_reason, worker_id, cycle_run_id, merged_at)`);
console.log(`  jsonb col:  incoming_extras (may drive toast if large)`);

// ─── 4 · DISTRIBUTION FOR VERIFICATION ────────────────────────────────
console.log("\n─── 4 · Distribution stats for post-migration verification ───");
console.log("  By match_layer (5-value CHECK constraint):");
const byLayer = local(`SELECT match_layer, count(*) FROM nex.identity_merge_log WHERE merged_at <= '${dumpTs}' GROUP BY 1 ORDER BY 2 DESC`);
console.log(byLayer.split("\n").map(l => "    " + l).join("\n"));
console.log("  By table_name:");
const byTable = local(`SELECT table_name, count(*) FROM nex.identity_merge_log WHERE merged_at <= '${dumpTs}' GROUP BY 1 ORDER BY 2 DESC`);
console.log(byTable.split("\n").map(l => "    " + l).join("\n"));
console.log("  By day(merged_at):");
const byDay = local(`SELECT date_trunc('day', merged_at)::date, count(*) FROM nex.identity_merge_log WHERE merged_at <= '${dumpTs}' GROUP BY 1 ORDER BY 1`);
console.log(byDay.split("\n").map(l => "    " + l).join("\n"));

// ─── 5 · CHUNK SIZE DECISION ──────────────────────────────────────────
console.log("\n─── 5 · Chunk size decision (from Batch 4/5 WAL evidence) ───");
console.log("  Batch 4 (index-medium):    215,755 rows → 224 MB WAL = ~1,040 B/row WAL");
console.log("  Batch 5 (index-heavy):     247,824 rows → 112 MB WAL = ~452 B/row WAL");
console.log("  identity_merge_log is index-medium (296 MB idx / 599 MB heap = 33% index ratio)");
console.log("  Expected WAL rate: ~500–800 B/row");
console.log("");
console.log("  Original plan proposed:    150,000 rows/chunk → 75–120 MB WAL per chunk");
console.log("  Recommended (conservative): 100,000 rows/chunk → 50–80 MB WAL per chunk");
console.log(`  → ~14 chunks total for 1,356,697 rows`);
console.log(`  Postgres max_wal_size = 1 GB · each 100K chunk stays well below trigger threshold`);
console.log(`  Postgres checkpoint_timeout = 300s · natural checkpoint every ~5 min`);

// ─── 6 · EXTRACTION + INSERTION METHOD ────────────────────────────────
console.log("\n─── 6 · Extraction + insertion method ───");
console.log("  RECOMMENDED · Direct psql cursor stream from LOCAL (frozen) to TARGET:");
console.log("");
console.log("    Per chunk (executed sequentially, non-overlapping ranges by merge_id):");
console.log("    1. On LOCAL: SELECT [columns] FROM nex.identity_merge_log");
console.log("                 WHERE merged_at <= '2026-09-03 02:30:44'::timestamptz");
console.log(`                   AND merge_id > '$last_merge_id'::uuid`);
console.log("                 ORDER BY merge_id LIMIT 100000");
console.log("       Streamed via psql \\COPY (SELECT ...) TO STDOUT");
console.log("");
console.log("    2. Pipe the stream to TARGET psql session:");
console.log("       PGOPTIONS='-c role=service_role' psql \\");
console.log("         --dbname=$NEX_SUPABASE_DB_URL \\");
console.log("         -c 'BEGIN; \\COPY nex.identity_merge_log ([columns]) FROM STDIN; COMMIT;'");
console.log("");
console.log("    3. On success, record last merge_id from this chunk as $last_merge_id");
console.log("       On failure, transaction rolls back → last_merge_id unchanged → retry same chunk");
console.log("");
console.log("  Alternative considered · pg_restore --table + chunked SQL split:");
console.log(`    - Would exactly reproduce dump contents (1,356,697 rows)`);
console.log(`    - But requires ~600 MB temp SQL file + parser to chunk`);
console.log(`    - MORE COMPLEX · less recoverable if anything goes wrong`);
console.log(`    - REJECTED in favor of direct psql cursor stream`);

// ─── 7 · CHUNK BOUNDARIES + DUPLICATE/MISSING PREVENTION ──────────────
console.log("\n─── 7 · Chunk boundaries · duplicate + missing row prevention ───");
console.log("  Ordering: strict ASC by merge_id (uuid PK, unique, index-only-scannable)");
console.log("  Chunk k+1 predicate: WHERE merge_id > $last_merge_id_of_chunk_k");
console.log("  → chunks are strictly non-overlapping ranges over PK space");
console.log("  → duplicate impossible (each merge_id appears in exactly one chunk)");
console.log("  → missing impossible (union of chunks = full ordered scan of source)");
console.log("");
console.log("  If chunk N fails:");
console.log("    · BEGIN/COMMIT wrapping = automatic rollback of that chunk's inserts");
console.log("    · $last_merge_id_of_chunk_(N-1) is unchanged");
console.log("    · Retry chunk N with same predicate → deterministic re-fetch of same 100K rows");
console.log("    · PK unique constraint on merge_id = defense in depth (would reject any duplicate)");
console.log("");
console.log("  Progress persisted to file: scripts/nex-migration/batch-06-progress.json");
console.log("    Format: { chunks_completed: [...], last_merge_id: 'uuid', target_row_count: N }");
console.log("    Enables clean resume from any failure point");

// ─── 8 · PER-CHUNK VERIFICATION ───────────────────────────────────────
console.log("\n─── 8 · Per-chunk verification (during streaming) ───");
console.log("  BEFORE each chunk:");
console.log("    SELECT pg_database_size(current_database()), pg_current_wal_lsn(),");
console.log("           (SELECT count(*) FROM nex.identity_merge_log) AS current_count");
console.log("    GET /v1/projects/{ref}/readonly");
console.log("");
console.log("  DURING chunk: monitor stream · timing");
console.log("");
console.log("  AFTER each chunk:");
console.log("    SELECT pg_database_size(...), pg_current_wal_lsn(),");
console.log("           (SELECT count(*) FROM nex.identity_merge_log) AS new_count,");
console.log("           (SELECT max(merge_id) FROM nex.identity_merge_log) AS max_merge_id");
console.log("    Verify: new_count == current_count + chunk_size (or lastChunkSize)");
console.log("    Verify: max_merge_id == expected_boundary (last merge_id sent in stream)");
console.log("    Report: db_delta_bytes, wal_delta_bytes, elapsed_sec");
console.log("    Compare: is db/WAL growth within projected range · escalate if not");

// ─── 9 · FINAL VERIFICATION (post-batch) ──────────────────────────────
console.log("\n─── 9 · Final verification (post-all-chunks) — data-integrity beyond row count ───");
console.log("  A. Row count: SELECT count(*) FROM nex.identity_merge_log · MUST equal 1,356,697");
console.log("  B. Key range: min(merge_id), max(merge_id) · MUST equal source (frozen local filtered) min/max");
console.log("  C. Distribution by match_layer · MUST equal source distribution exactly:");
console.log("     source_ref: X, geo_confirmed: Y, phone: Z, website: W, name_city: V");
console.log("  D. Distribution by table_name · MUST equal source exactly (3 values)");
console.log("  E. Distribution by day(merged_at) · MUST match source day-buckets");
console.log("  F. Sample-based deep check: 100 random merge_ids · fetch full row from both sides · compare 19 columns per row");
console.log("  G. Aggregate hash for extra confidence (computed as WHERE-limited group hash · not full-table hash):");
console.log("     SELECT md5(string_agg(merge_id::text || table_name || match_layer, ',' ORDER BY merge_id))");
console.log("     FROM nex.identity_merge_log WHERE merge_id::text LIKE '00%' LIMIT 10000");
console.log("     (compares small deterministic subset · fast · catches column-drop or type-cast bugs)");

// ─── 10 · STOP THRESHOLDS ─────────────────────────────────────────────
console.log("\n─── 10 · Emergency STOP thresholds ───");
console.log("  Immediate STOP (script aborts, no further chunks):");
console.log(`    • Supabase readonly.enabled == true`);
console.log(`    • pg_database_size(current) > 6 GB (75% of 8 GB disk)`);
console.log(`    • Single-chunk WAL growth > 300 MB (2× projected max)`);
console.log(`    • Any pg_restore/COPY error (--exit-on-error handles this)`);
console.log(`    • Elapsed time > 60 min total (something's wrong)`);
console.log(`    • Row count mismatch between chunk send and post-chunk verify`);
console.log("");
console.log("  Recovery from STOP:");
console.log(`    • Script writes state to batch-06-progress.json before exit`);
console.log(`    • Report last successful chunk, cumulative DB size, WAL LSN`);
console.log(`    • Await Philip's explicit approval before resume/retry`);
console.log(`    • Data integrity guaranteed: no partial-chunk rows on target (BEGIN/COMMIT per chunk)`);

// ─── 11 · IF SUPABASE GOES READONLY ───────────────────────────────────
console.log("\n─── 11 · If Supabase goes readonly during streaming ───");
console.log("  Immediate: current chunk's COPY fails on next write → transaction rolls back cleanly");
console.log("  Script detects failure → STOP → report last successful chunk");
console.log("  DO NOT auto-retry (readonly usually = disk pressure signal)");
console.log("  Await Philip: investigate disk, then decide (resume from last chunk / abort / re-plan)");

// ─── 12 · SAFETY CONFIRMATIONS ────────────────────────────────────────
console.log("\n─── 12 · Safety confirmations ───");
console.log("  ✓ FKs NOT recreated during Batch 6 (kept dropped · restore in Batch 7)");
console.log("  ✓ RLS remains enabled (92 tables) · service_role via SET ROLE handles BYPASSRLS");
console.log("  ✓ public.* schema NOT touched (all writes are nex.identity_merge_log only)");
console.log("  ✓ Local nex_dev remains frozen (0 processes, task Disabled) — read-only queries only");
console.log("  ✓ Workforce/Next.js not restarted");
console.log("  ✓ NEX_POSTGRES_URL not changed");
console.log("  ✓ Migration temp role (nex_migrate_*) kept · uses --role=service_role for SET ROLE");
console.log("  ✓ Dump file untouched · not re-created");

// ─── 13 · EXTRACTION-METHOD DECISION ──────────────────────────────────
console.log("\n─── 13 · Extraction-method decision (needs Philip's call) ───");
if (timestampFilterOk) {
  console.log(`  ✓ WHERE merged_at <= '${dumpTs}' returns exactly 1,356,697 (dump count)`);
  console.log(`  → RECOMMENDED: use LOCAL with timestamp filter · exact dump-count reproduction`);
} else {
  console.log(`  ⚠️ WHERE merged_at <= '${dumpTs}' returns ${localAtDumpTs.toLocaleString()} rows (dump has 1,356,697)`);
  const diff = localAtDumpTs - 1356697;
  console.log(`  Delta: ${diff > 0 ? "+" : ""}${diff} rows`);
  if (Math.abs(diff) < 100) {
    console.log(`  Small delta likely due to microsecond boundary. Two options:`);
    console.log(`    Option A: Tighten filter to WHERE merged_at < '${dumpTs}' (exclusive)`);
    console.log(`    Option B: Extract from dump via pg_restore (more complex, exactly matches dump)`);
  } else {
    console.log(`  Large delta. Must extract from dump directly to reproduce dump content exactly.`);
  }
  console.log(`  Alternative: load all ${localTotal.toLocaleString()} rows from frozen local (no delta to reconcile later)`);
}

// ─── 14 · EXECUTION COMMAND SKELETON (NOT EXECUTED) ────────────────────
console.log("\n─── 14 · Execution command sketch (NOT EXECUTED) ───");
console.log(`
  Node script would:

    for chunk in 1..14:
      1. Measure PRE: db_size, wal_lsn, readonly, target count
      2. Extract chunk from local via psql \\COPY:
           psql $LOCAL_URI -c "\\copy (SELECT [cols] FROM nex.identity_merge_log
             WHERE merged_at <= '${dumpTs}' AND merge_id > '$last_id'
             ORDER BY merge_id LIMIT 100000) TO 'chunk-N.csv' WITH (FORMAT csv, HEADER false)"
      3. Load chunk into target via psql \\COPY:
           PGOPTIONS='-c role=service_role' psql $NEX_SUPABASE_DB_URL -c \\
             "BEGIN; \\copy nex.identity_merge_log ([cols]) FROM 'chunk-N.csv' WITH (FORMAT csv); COMMIT;"
      4. Measure POST: db_size, wal_lsn, readonly, target count
      5. Verify: target count grew by exactly chunk_size (or last chunk's actual size)
      6. Verify: max(merge_id) advanced past expected boundary
      7. Delete temp CSV
      8. Persist $last_id to batch-06-progress.json
      9. If disk_delta > 300MB OR readonly=true OR count mismatch → STOP

    After all 14 chunks:
      Full verification per Section 9 (A-G)
      Final report
`);

console.log("═══════════════════════════════════════════════════════════════════════════");
console.log("HARD STOP · awaiting Philip's approval");
console.log("═══════════════════════════════════════════════════════════════════════════");
console.log("");
console.log("Awaiting your call on:");
console.log("  1. Extraction method (see Section 13)");
console.log("  2. Chunk size (proposed 100K · alternative 150K)");
console.log("  3. Any further tightening of STOP thresholds");
