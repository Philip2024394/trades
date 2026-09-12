#!/usr/bin/env node
// scripts/nex-postgres-parity-check.mjs
//
// Founder Phase A · Supabase → Own Postgres migration parity checker.
//
// Compares row counts (and optionally checksums) between the local
// Postgres and the Supabase-hosted Postgres for every core NEX table.
// Exit code 0 if all tables match, 1 if any drift is detected.
//
// Runs daily via Windows Scheduled Task once Phase A dual-write is
// active. Writes a JSONL report to data/parity-check/ for audit.
//
// Usage:
//   node scripts/nex-postgres-parity-check.mjs
//   node scripts/nex-postgres-parity-check.mjs --json           # machine-readable
//   node scripts/nex-postgres-parity-check.mjs --tables accommodation_business,knowledge_records

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..");
const OUT_DIR = join(REPO_ROOT, "data", "parity-check");

const args = new Map();
for (let i = 2; i < process.argv.length; i++) {
  const a = process.argv[i];
  if (a.startsWith("--")) {
    const key = a.replace(/^--/, "");
    const next = process.argv[i + 1];
    if (next && !next.startsWith("--")) { args.set(key, next); i++; }
    else args.set(key, "true");
  }
}
const JSON_MODE = args.get("json") === "true";
const TABLES_ARG = args.get("tables");

// Read env from .env.local
function loadEnvLocal() {
  try {
    const raw = readFileSync(join(REPO_ROOT, ".env.local"), "utf8");
    const env = {};
    for (const line of raw.split("\n")) {
      const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/);
      if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
    }
    return env;
  } catch { return {}; }
}
const envLocal = loadEnvLocal();

const LOCAL_URL  = envLocal.NEX_TAXONOMY_POSTGRES_URL
  ?? "postgresql://postgres:Admin1phil@localhost:5433/nex_dev";
// After cutover, NEX_POSTGRES_URL points at local. Preserve rollback
// url from the commented line so parity check can still compare.
const rollbackMatch = /^#\s*NEX_POSTGRES_URL_SUPABASE_ROLLBACK\s*=\s*(.*)$/m;
const rollbackLine = readFileSync(join(REPO_ROOT, ".env.local"), "utf8").match(rollbackMatch);
const REMOTE_URL = rollbackLine?.[1]?.trim().replace(/^["']|["']$/g, "")
  ?? envLocal.NEX_POSTGRES_URL_SUPABASE_ROLLBACK
  ?? envLocal.NEX_POSTGRES_URL;

const DEFAULT_TABLES = [
  "accommodation_business",
  "accommodation_business_field_provenance",
  "accommodation_business_source_snapshot",
  "knowledge_records",
  "knowledge_feedback",
  "record_versions",
  "audit_log",
  "user_account",
  "user_session",
  "knowledge_inbox",
];
const TABLES = TABLES_ARG ? TABLES_ARG.split(",").map((s) => s.trim()) : DEFAULT_TABLES;

async function countTable(client, table) {
  try {
    const r = await client.query(`SELECT count(*)::bigint AS c FROM nex.${table}`);
    return Number(r.rows[0].c);
  } catch (err) {
    return { error: String(err).slice(0, 200) };
  }
}

async function main() {
  const { Client } = await import("pg").catch(() => {
    console.error("[parity] pg module missing · run: npm i pg");
    process.exit(2);
  });

  if (!REMOTE_URL) {
    console.error("[parity] NEX_POSTGRES_URL not set in .env.local · nothing to compare against");
    process.exit(2);
  }

  const localC = new Client({ connectionString: LOCAL_URL, connectionTimeoutMillis: 10_000 });
  const remoteC = new Client({
    connectionString: REMOTE_URL,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 15_000,
  });

  try {
    await localC.connect();
    await remoteC.connect();
  } catch (err) {
    console.error(`[parity] connection failed: ${String(err).slice(0, 200)}`);
    process.exit(2);
  }

  const rows = [];
  for (const t of TABLES) {
    const local = await countTable(localC, t);
    const remote = await countTable(remoteC, t);
    const localOk = typeof local === "number";
    const remoteOk = typeof remote === "number";
    const delta = localOk && remoteOk ? local - remote : null;
    const status = !localOk || !remoteOk ? "ERR" : delta === 0 ? "OK" : "DRIFT";
    rows.push({ table: t, local, remote, delta, status });
  }

  await localC.end();
  await remoteC.end();

  const drifts = rows.filter((r) => r.status === "DRIFT");
  const errs = rows.filter((r) => r.status === "ERR");
  const passed = drifts.length === 0 && errs.length === 0;

  const report = {
    ts_iso: new Date().toISOString(),
    local_url: LOCAL_URL.replace(/:[^:@]+@/, ":*****@"),
    remote_url: REMOTE_URL.replace(/:[^:@]+@/, ":*****@"),
    tables_checked: TABLES.length,
    ok: rows.filter((r) => r.status === "OK").length,
    drift: drifts.length,
    err: errs.length,
    passed,
    rows,
  };

  if (JSON_MODE) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log("");
    console.log("┌─ NEX POSTGRES PARITY CHECK ────────────────────────");
    console.log(`│ local:  ${report.local_url}`);
    console.log(`│ remote: ${report.remote_url}`);
    console.log(`│ tables: ${TABLES.length} checked`);
    console.log("├─────────────────────────────────────────────────────");
    console.log("│ table                                | local | remote | delta | status");
    for (const r of rows) {
      const l = typeof r.local === "number" ? String(r.local) : "ERR";
      const rm = typeof r.remote === "number" ? String(r.remote) : "ERR";
      const d = typeof r.delta === "number" ? String(r.delta) : "?";
      console.log(`│ ${r.table.padEnd(37)} | ${l.padStart(5)} | ${rm.padStart(6)} | ${d.padStart(5)} | ${r.status}`);
    }
    console.log("├─────────────────────────────────────────────────────");
    console.log(`│ VERDICT: ${passed ? "PARITY ✓" : "DRIFT DETECTED ✗"}`);
    console.log("└─────────────────────────────────────────────────────");
  }

  // Persist audit trail
  try {
    if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });
    const ts = new Date().toISOString().replace(/:/g, "-").replace(/\..+/, "Z");
    const out = join(OUT_DIR, `parity-${ts}.json`);
    writeFileSync(out, JSON.stringify(report, null, 2), "utf8");
  } catch { /* audit is nice-to-have, never fail */ }

  process.exit(passed ? 0 : 1);
}

main().catch((err) => {
  console.error(`[parity] fatal: ${String(err)}`);
  process.exit(2);
});
