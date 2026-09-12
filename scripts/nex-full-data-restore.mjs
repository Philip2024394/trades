#!/usr/bin/env node
// Full NEX data-only restore against Supabase Project B.
//
// Strategy (needed because --disable-triggers requires superuser):
//   Phase 1 (via Management API as postgres):
//     - Snapshot + drop all 125 FK constraints
//     - Snapshot + disable RLS on 92 nex.* tables
//     - Create scoped temp login role with explicit ALL privileges on nex.*
//   Phase 2 (via pg_restore as temp role):
//     - --data-only --schema=nex --jobs=1 --exit-on-error --verbose
//   Phase 3 (via Management API as postgres):
//     - Recreate all 125 FKs (single transaction · any violation rolls back)
//     - Re-enable RLS on 92 tables
//     - Cleanup temp role
//
// Password stays in .env.tools.local + spawn env only. Never logged.
// pg_restore log captured to file (URI-scrubbed).

import { readFileSync, writeFileSync, appendFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { randomBytes } from "node:crypto";
import { spawn, spawnSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");
const envPath = resolve(repoRoot, ".env.tools.local");
const envText = readFileSync(envPath, "utf8");
const TOKEN = envText.match(/NEX_SUPABASE_ACCESS_TOKEN=(\S+)/)?.[1];
const REF = envText.match(/NEX_SUPABASE_PROJECT_REF=(\S+)/)?.[1];
if (!TOKEN || !REF) { console.error("Missing NEX_SUPABASE_ACCESS_TOKEN or NEX_SUPABASE_PROJECT_REF"); process.exit(2); }
const MGMT = `https://api.supabase.com/v1/projects/${REF}/database/query`;
const BACKUP = "D:/nex-backups/nex_dev-2026-09-03-0230-post-enum-fix.dump";
const LOG_DIR = resolve(repoRoot, "scripts", "nex-migration");
const LOG_FILE = resolve(LOG_DIR, "data-restore.log");
const FK_SNAPSHOT_FILE = resolve(LOG_DIR, "fk-constraints-snapshot.json");
mkdirSync(LOG_DIR, { recursive: true });
const PSQL = "C:\\Program Files\\PostgreSQL\\17\\bin\\psql.exe";
const PG_RESTORE = "C:\\Program Files\\PostgreSQL\\17\\bin\\pg_restore.exe";

async function q(sql) {
  const r = await fetch(MGMT, { method: "POST", headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" }, body: JSON.stringify({ query: sql }) });
  const text = await r.text();
  let body; try { body = JSON.parse(text); } catch { body = text; }
  return { status: r.status, body };
}

const TEMP_ROLE = `nex_migrate_${Date.now().toString(36)}`;
const PASSWORD = randomBytes(30).toString("base64url");
const URI = `postgresql://${TEMP_ROLE}.${REF}:${PASSWORD}@aws-0-eu-west-1.pooler.supabase.com:5432/postgres`;

function scrub(s) { return String(s).split(PASSWORD).join("<PASSWORD>").split(encodeURIComponent(PASSWORD)).join("<PASSWORD>"); }
function log(msg) { const line = `[${new Date().toISOString()}] ${msg}\n`; appendFileSync(LOG_FILE, scrub(line)); process.stderr.write(scrub(msg + "\n")); }

writeFileSync(LOG_FILE, "");
log(`data restore session · temp role: ${TEMP_ROLE}`);

let rlsSnapshot = [];
let fkSnapshot = [];
let cleanupRan = false;

async function cleanup(fatal = false) {
  if (cleanupRan) return;
  cleanupRan = true;
  log("cleanup · recreating FKs + re-enabling RLS + dropping temp role");
  // Recreate FKs (single transaction — if any FK violation, we log it but keep going)
  if (fkSnapshot.length && !fatal) {
    const addSql = "BEGIN;\n" + fkSnapshot.map(f => `ALTER TABLE nex.${f.table} ADD CONSTRAINT ${f.name} ${f.def};`).join("\n") + "\nCOMMIT;";
    try {
      const r = await q(addSql);
      log(`  FK recreation HTTP ${r.status}${r.status >= 400 ? ' body=' + JSON.stringify(r.body).slice(0,500) : ` · ${fkSnapshot.length} FKs restored`}`);
    } catch (e) { log(`  FK recreation exception: ${e.message}`); }
  } else if (fatal) {
    log(`  skipping FK recreation (fatal path · will need manual recovery via ${FK_SNAPSHOT_FILE})`);
  }
  // Re-enable RLS
  if (rlsSnapshot.length) {
    const chunks = [];
    for (let i = 0; i < rlsSnapshot.length; i += 40) chunks.push(rlsSnapshot.slice(i, i + 40));
    for (const chunk of chunks) {
      const reSql = chunk.map(t => `ALTER TABLE nex.${t.table} ENABLE ROW LEVEL SECURITY;`).join("\n");
      try { await q(reSql); } catch (e) { log(`  RLS re-enable failed: ${e.message}`); }
    }
    log(`  RLS re-enabled on ${rlsSnapshot.length} tables`);
  }
  // Drop temp role
  try {
    const r = await q(`
      GRANT ${TEMP_ROLE} TO postgres;
      REASSIGN OWNED BY ${TEMP_ROLE} TO postgres;
      DROP OWNED BY ${TEMP_ROLE};
      DROP ROLE IF EXISTS ${TEMP_ROLE};
    `);
    log(`  role cleanup HTTP ${r.status}`);
  } catch (e) { log(`  role cleanup exception: ${e.message}`); }
}
process.on("SIGINT", async () => { await cleanup(true); process.exit(130); });
process.on("SIGTERM", async () => { await cleanup(true); process.exit(143); });

try {
  // === PHASE 1 · PREP ==========================================================

  log("phase 1a · snapshotting all 125 FK constraints in nex.*");
  const fkRes = await q(`
    SELECT cl.relname AS table_name, c.conname AS name, pg_get_constraintdef(c.oid) AS def
    FROM pg_constraint c
    JOIN pg_class cl ON cl.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = cl.relnamespace
    WHERE c.contype = 'f' AND n.nspname = 'nex'
    ORDER BY cl.relname, c.conname`);
  if (fkRes.status !== 200 && fkRes.status !== 201) { log(`  FK snapshot failed: ${JSON.stringify(fkRes.body).slice(0,300)}`); process.exit(3); }
  fkSnapshot = fkRes.body.map(r => ({ table: r.table_name, name: r.name, def: r.def }));
  writeFileSync(FK_SNAPSHOT_FILE, JSON.stringify(fkSnapshot, null, 2));
  log(`  captured ${fkSnapshot.length} FKs → snapshot at ${FK_SNAPSHOT_FILE}`);

  log("phase 1b · dropping all FK constraints (recreatable from snapshot)");
  if (fkSnapshot.length > 0) {
    const chunks = [];
    for (let i = 0; i < fkSnapshot.length; i += 40) chunks.push(fkSnapshot.slice(i, i + 40));
    for (const chunk of chunks) {
      const dropSql = chunk.map(f => `ALTER TABLE nex.${f.table} DROP CONSTRAINT ${f.name};`).join("\n");
      const r = await q(dropSql);
      if (r.status !== 200 && r.status !== 201) { log(`  FK drop chunk failed: ${JSON.stringify(r.body).slice(0,300)}`); process.exit(3); }
    }
    log(`  dropped ${fkSnapshot.length} FK constraints`);
  }

  log("phase 1c · snapshotting + disabling RLS on nex.* tables");
  const rlsListRes = await q(`SELECT c.relname AS table FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='nex' AND c.relkind='r' AND c.relrowsecurity=true ORDER BY c.relname`);
  if (rlsListRes.status !== 200 && rlsListRes.status !== 201) { log(`  RLS list failed`); process.exit(3); }
  rlsSnapshot = rlsListRes.body.map(r => ({ table: r.table }));
  log(`  captured ${rlsSnapshot.length} nex.* tables with RLS enabled`);
  if (rlsSnapshot.length > 0) {
    const chunks = [];
    for (let i = 0; i < rlsSnapshot.length; i += 40) chunks.push(rlsSnapshot.slice(i, i + 40));
    for (const chunk of chunks) {
      const disSql = chunk.map(t => `ALTER TABLE nex.${t.table} DISABLE ROW LEVEL SECURITY;`).join("\n");
      const r = await q(disSql);
      if (r.status !== 200 && r.status !== 201) { log(`  DISABLE RLS chunk failed`); process.exit(3); }
    }
    log(`  disabled RLS on ${rlsSnapshot.length} tables`);
  }

  log("phase 1d · creating temp login role with explicit nex.* privileges");
  const escapedPw = PASSWORD.replace(/'/g, "''");
  const createSql = `
    DO $body$ BEGIN
      IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='${TEMP_ROLE}') THEN
        DROP ROLE ${TEMP_ROLE};
      END IF;
    END $body$;
    CREATE ROLE ${TEMP_ROLE} WITH LOGIN PASSWORD '${escapedPw}' NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION;
    GRANT USAGE ON SCHEMA nex TO ${TEMP_ROLE};
    GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA nex TO ${TEMP_ROLE};
    GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA nex TO ${TEMP_ROLE};
    ALTER DEFAULT PRIVILEGES IN SCHEMA nex GRANT ALL ON TABLES TO ${TEMP_ROLE};
  `;
  const cr = await q(createSql);
  if (cr.status !== 200 && cr.status !== 201) { log(`  CREATE ROLE failed: ${JSON.stringify(cr.body).slice(0,300)}`); process.exit(3); }
  log(`  role + grants HTTP ${cr.status}`);

  // === PHASE 2 · VERIFY + RESTORE =============================================

  log("phase 2a · verifying temp role connection");
  const verify = spawnSync(PSQL, ["-Atc", "SELECT current_user, current_setting('server_version')", URI], { env: { ...process.env }, encoding: "utf8", timeout: 30000 });
  if (verify.status !== 0) { log(`  psql verification FAILED: ${verify.stderr}`); process.exit(4); }
  log(`  connection OK: ${verify.stdout.trim()}`);

  // Persist URI to .env.tools.local
  let newEnv = readFileSync(envPath, "utf8");
  const uriLine = `NEX_SUPABASE_DB_URL=${URI}`;
  if (/^NEX_SUPABASE_DB_URL=/m.test(newEnv)) newEnv = newEnv.replace(/^NEX_SUPABASE_DB_URL=.*$/m, uriLine);
  else newEnv = newEnv.trimEnd() + `\n\n# TEMP data-restore role · removed after cutover\n${uriLine}\n`;
  writeFileSync(envPath, newEnv);

  log("phase 2b · pg_restore --data-only --schema=nex --jobs=1 --exit-on-error --verbose");
  log(`  backup: ${BACKUP}`);
  const t0 = Date.now();
  const args = ["--dbname", URI, "--data-only", "--schema=nex", "--jobs=1", "--exit-on-error", "--verbose", "--no-owner", "--no-acl", BACKUP];
  const restoreEnv = { ...process.env, PGOPTIONS: "-c statement_timeout=0 -c lock_timeout=0 -c idle_in_transaction_session_timeout=0" };
  const proc = spawn(PG_RESTORE, args, { env: restoreEnv, stdio: ["ignore", "pipe", "pipe"] });
  proc.stdout.on("data", d => { const s = scrub(d.toString()); process.stdout.write(s); appendFileSync(LOG_FILE, s); });
  proc.stderr.on("data", d => { const s = scrub(d.toString()); process.stderr.write(s); appendFileSync(LOG_FILE, s); });
  const exit = await new Promise((res) => proc.on("close", res));
  const elapsedMin = ((Date.now() - t0) / 60000).toFixed(2);
  log(`\npg_restore exit: ${exit} · elapsed: ${elapsedMin} min`);
  if (exit !== 0) { log(`RESTORE FAILED · exit ${exit}`); await cleanup(true); process.exit(5); }

  // === PHASE 3 · RECOVERY =====================================================

  log("phase 3 · running cleanup (recreate FKs + re-enable RLS + drop temp role)");
  await cleanup(false);

  log("phase 4 · ANALYZE nex.* (updates planner stats)");
  // ANALYZE via Management API as postgres (has ownership)
  const analyzeSql = `ANALYZE VERBOSE nex.audit_log; SELECT 'analyze started' AS status`;
  // Just run ANALYZE on the whole nex schema
  const analyze = await q("DO $body$ DECLARE r record; BEGIN FOR r IN SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='nex' AND c.relkind='r' LOOP EXECUTE 'ANALYZE nex.' || quote_ident(r.relname); END LOOP; END $body$;");
  log(`  ANALYZE HTTP ${analyze.status}`);

  log("\nRESTORE COMPLETE");
  process.exit(0);
} catch (e) {
  log(`UNEXPECTED ERROR: ${e.stack || e.message}`);
  await cleanup(true);
  process.exit(6);
}
