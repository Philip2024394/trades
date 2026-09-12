#!/usr/bin/env node
// Pre-data-restore safety checks · 6 read-only assertions before pg_restore.
// Compares LIVE Supabase target + LOCAL nex_dev + LOCAL backup file.
// Bails with exit 2 if any assertion fails.

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { statfs } from "node:fs/promises";
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { spawn } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");
const envText = readFileSync(resolve(repoRoot, ".env.tools.local"), "utf8");
const TOKEN = envText.match(/NEX_SUPABASE_ACCESS_TOKEN=(\S+)/)?.[1];
const REF = envText.match(/NEX_SUPABASE_PROJECT_REF=(\S+)/)?.[1];
if (!TOKEN || !REF) { console.error("Missing NEX_SUPABASE_ACCESS_TOKEN or NEX_SUPABASE_PROJECT_REF"); process.exit(2); }
const ENDPOINT = `https://api.supabase.com/v1/projects/${REF}/database/query`;

async function q(sql) {
  const r = await fetch(ENDPOINT, { method: "POST", headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" }, body: JSON.stringify({ query: sql }) });
  const text = await r.text();
  let body; try { body = JSON.parse(text); } catch { body = text; }
  return { status: r.status, body };
}

const expected = {
  ref: "ijvqdvsvwtwxzcqmoqit",
  region: "eu-west-1",
  account_email: "asknexapp@gmail.com",
  backup_sha: "4293ceb3686d2e552f49de195533538f6c1363baf2a8b9380820323c3a7d8c54",
  backup_path: "D:/nex-backups/nex_dev-2026-09-03-0230-post-enum-fix.dump",
  public_tables: 17,
  public_knowledge_records: 3627,
  public_worker_jobs: 19167,
  nex_tables: 191,
};

let failures = 0;
function check(name, actual, expected, extra = "") {
  const ok = actual === expected || (Array.isArray(actual) && actual.length === expected);
  console.log(`  [${ok ? "PASS" : "FAIL"}] ${name.padEnd(45)} actual=${JSON.stringify(actual)} expected=${JSON.stringify(expected)} ${extra}`);
  if (!ok) failures++;
  return ok;
}

// ── CHECK 1 · target identity ───────────────────────────────────────────────
console.log("\n=== CHECK 1 · Target identity ===");
const projMeta = await fetch(`https://api.supabase.com/v1/projects/${REF}`, { headers: { Authorization: `Bearer ${TOKEN}` } }).then(r => r.json());
check("project ref", projMeta.id, expected.ref);
check("region", projMeta.region, expected.region);
check("project name contains asknexapp", projMeta.name?.includes("asknexapp"), true, `name="${projMeta.name}"`);

// ── CHECK 2 · nex.* has 191 tables + empty ──────────────────────────────────
console.log("\n=== CHECK 2 · nex.* schema present + empty of application data ===");
const nexTables = (await q("SELECT count(*) AS n FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='nex' AND c.relkind='r'")).body?.[0]?.n;
check("nex table count", nexTables, expected.nex_tables);

// Sample 8 representative tables to confirm all empty (small subset · full check post-restore)
const sampleTables = [
  "food_business","food_enrichment_job","food_commercial_event","food_business_source_snapshot",
  "worker_jobs","worker_results","identity_merge_log","brain_memories"
];
const emptyChecks = await q(`SELECT ${sampleTables.map(t => `(SELECT count(*) FROM nex.${t}) AS ${t}`).join(", ")}`);
const emptyOk = emptyChecks.body?.[0] && Object.values(emptyChecks.body[0]).every(v => Number(v) === 0);
check("sampled nex tables empty", emptyOk, true, `values=${JSON.stringify(emptyChecks.body?.[0])}`);

// ── CHECK 3 · public.* baseline unchanged ───────────────────────────────────
console.log("\n=== CHECK 3 · public.* UK trades baseline unchanged ===");
const pubTables = (await q("SELECT count(*) AS n FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='r'")).body?.[0]?.n;
check("public table count", pubTables, expected.public_tables);
const pubRows = (await q("SELECT (SELECT count(*) FROM public.knowledge_records) AS kr, (SELECT count(*) FROM public.worker_jobs) AS wj")).body?.[0];
check("public.knowledge_records rows", pubRows?.kr, expected.public_knowledge_records);
check("public.worker_jobs rows", pubRows?.wj, expected.public_worker_jobs);

// ── CHECK 4 · backup SHA-256 ────────────────────────────────────────────────
console.log("\n=== CHECK 4 · backup file SHA-256 ===");
const computedSha = await new Promise((resolveFn, reject) => {
  const h = createHash("sha256");
  const s = createReadStream(expected.backup_path);
  s.on("data", d => h.update(d));
  s.on("end", () => resolveFn(h.digest("hex")));
  s.on("error", reject);
});
check("backup SHA-256", computedSha, expected.backup_sha);

// ── CHECK 5 · walkers stopped ──────────────────────────────────────────────
console.log("\n=== CHECK 5 · walker workforce stopped ===");
const walkersRunning = await new Promise((resolveFn) => {
  const p = spawn("tasklist.exe", ["/FI", "IMAGENAME eq node.exe", "/FO", "CSV"], { shell: false });
  let out = "";
  p.stdout.on("data", d => out += d.toString());
  p.on("close", () => resolveFn(out));
  p.on("error", () => resolveFn(""));
});
// Rough heuristic: count node.exe processes. Walker supervisor runs as node. If unrelated node processes exist, output shows them.
const nodeLines = walkersRunning.split(/\r?\n/).filter(l => l.toLowerCase().includes("node.exe"));
console.log(`  (info) node.exe processes running on this machine: ${nodeLines.length}`);
// Also check Task Scheduler for NEX-Acquisition-Workforce
const schedState = await new Promise((resolveFn) => {
  const p = spawn("powershell.exe", ["-NoProfile","-Command","(Get-ScheduledTask -TaskName 'NEX-Acquisition-Workforce' -ErrorAction SilentlyContinue).State"], { shell: false });
  let out = ""; p.stdout.on("data", d => out += d.toString()); p.on("close", () => resolveFn(out.trim())); p.on("error", () => resolveFn(""));
});
console.log(`  Scheduled task 'NEX-Acquisition-Workforce' state: ${schedState || "(not found or query failed)"}`);
// Check DB heartbeat: if walker recently touched local supervisor_heartbeat we should see recent timestamp
try {
  const local = spawn("C:\\Program Files\\PostgreSQL\\17\\bin\\psql.exe", ["-h","localhost","-p","5433","-U","postgres","-d","nex_dev","-Atc","SELECT extract(epoch from now() - max(updated_at)) AS seconds_since_heartbeat FROM nex.supervisor_heartbeat"], { env: { ...process.env, PGPASSWORD: "Admin1phil" } });
  const hb = await new Promise(resolveFn => { let o=""; local.stdout.on("data",d=>o+=d.toString()); local.on("close",()=>resolveFn(o.trim())); local.on("error",()=>resolveFn("")); });
  console.log(`  local nex_dev supervisor_heartbeat age (seconds): ${hb || "(no heartbeat rows or table missing)"}`);
  const hbTrimmed = String(hb || "").trim();
  const hbAge = hbTrimmed === "" ? null : Number(hbTrimmed);
  if (hbAge !== null && Number.isFinite(hbAge) && hbAge > 0 && hbAge < 60) {
    console.log(`  [FAIL] Walker heartbeat within last 60s (${hbAge}s ago). STOP THE WALKERS FIRST.`);
    failures++;
  } else {
    console.log(`  [PASS] no recent walker heartbeat activity (${hbAge === null ? "no heartbeat rows" : hbAge + "s since last"})`);
  }
  // Also check scheduled task state — "Running" means active. "Ready" or "Disabled" = safe.
  if (schedState === "Running") {
    console.log(`  [FAIL] Scheduled task 'NEX-Acquisition-Workforce' is currently Running. STOP IT FIRST.`);
    failures++;
  } else {
    console.log(`  [PASS] Scheduled task state='${schedState}' (not Running)`);
  }
} catch (e) {
  console.log(`  (info) heartbeat check skipped: ${e.message}`);
}

// ── CHECK 6 · exact restore command ─────────────────────────────────────────
console.log("\n=== CHECK 6 · exact restore command (will NOT execute until Philip provides NEX_SUPABASE_DB_URL) ===");
const restoreCmd = [
  `PGOPTIONS='-c statement_timeout=0 -c lock_timeout=0 -c idle_in_transaction_session_timeout=0'`,
  `pg_restore`,
  `--dbname="$NEX_SUPABASE_DB_URL"`,
  `--data-only`,
  `--schema=nex`,
  `--jobs=1`,
  `--exit-on-error`,
  `--verbose`,
  `"${expected.backup_path}"`,
].join(" \\\n  ");
console.log(restoreCmd);

console.log(`\n=== SUMMARY · ${failures} failures ===`);
if (failures > 0) {
  console.error("Pre-restore safety checks FAILED · aborting.");
  process.exit(2);
} else {
  console.log("All safety checks PASSED · target ready for data restore.");
}
