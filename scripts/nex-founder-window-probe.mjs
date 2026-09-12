#!/usr/bin/env node
// scripts/nex-founder-window-probe.mjs
//
// Founder 2026-09-10 · Runs the 5 subsystem probes + emits fresh events.
// Intended to be scheduled every 60s so the dashboard status pills are
// always <60s stale.
//
// Direct Postgres · no Next.js imports (script runs outside the app process)

import { existsSync, statSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..");

async function loadPg() {
  try { return (await import("pg")).Client; } catch { return null; }
}
function readPgUrl() {
  try {
    const env = readFileSync(join(REPO_ROOT, ".env.local"), "utf8");
    const m = env.match(/^NEX_TAXONOMY_POSTGRES_URL\s*=\s*(.+)$/m);
    if (m) return m[1].trim().replace(/^["']|["']$/g, "");
  } catch { /* fall through */ }
  return "postgresql://postgres:Admin1phil@localhost:5433/nex_dev";
}

function log(...args) { console.log(new Date().toISOString(), ...args); }

async function scalar(c, sql, params = []) {
  try { const r = await c.query(sql, params); const row = r.rows?.[0]; if (!row) return null;
    return row[Object.keys(row)[0]] ?? null; }
  catch { return null; }
}

async function probeCodeExecution(c) {
  const rowsToday = await scalar(c, `SELECT count(*)::int FROM nex.code_execution WHERE executed_at >= now() - interval '24 hours'`);
  const total = await scalar(c, `SELECT count(*)::int FROM nex.code_execution`);
  const hb = join(REPO_ROOT, "data/nex-agent-runtime/heartbeat-programmer.json");
  let hbAge = null;
  try { if (existsSync(hb)) hbAge = Math.round((Date.now() - statSync(hb).mtimeMs) / 1000); } catch { /* ignore */ }
  let status = "yellow", reason;
  if (total === null) { status = "red"; reason = "cannot reach nex.code_execution"; }
  else if (hbAge !== null && hbAge <= 60 && rowsToday > 0) { status = "green"; reason = `heartbeat fresh (${hbAge}s) · ${rowsToday} runs today`; }
  else if (hbAge !== null && hbAge <= 60) reason = `heartbeat fresh (${hbAge}s) · observation-only`;
  else if (hbAge !== null) reason = `heartbeat stale (${hbAge}s)`;
  else reason = "no heartbeat file · programmer not started";
  return { subsystem: "code_execution", status, reason,
    metrics: { rows_today: rowsToday ?? 0, total_rows: total ?? 0, heartbeat_age_sec: hbAge } };
}

async function probeVoice(c) {
  const t = await scalar(c, `SELECT count(*)::int FROM nex.voice_transcript`);
  const s = await scalar(c, `SELECT count(*)::int FROM nex.voice_synthesis`);
  const provider = process.env.NEX_VOICE_PROVIDER ?? "mock";
  let whisper = false, piper = false;
  for (const p of ["C:\\tools\\whisper.cpp\\main.exe","C:\\Program Files\\whisper.cpp\\main.exe"]) if (existsSync(p)) whisper = true;
  for (const p of ["C:\\tools\\piper\\piper.exe","C:\\Program Files\\piper\\piper.exe"]) if (existsSync(p)) piper = true;
  let status = "yellow", reason;
  if (t === null) { status = "red"; reason = "voice tables unreachable"; }
  else if (provider === "real" && whisper && piper) { status = "green"; reason = `real mode · ${t} transcripts · ${s} synths`; }
  else if (provider === "real") { status = "red"; reason = `provider=real but binaries missing (whisper=${whisper}, piper=${piper})`; }
  else reason = `provider=mock · install whisper.cpp+piper and set NEX_VOICE_PROVIDER=real`;
  return { subsystem: "voice", status, reason, metrics: { transcripts: t ?? 0, synthesised: s ?? 0, provider, whisper_installed: whisper, piper_installed: piper } };
}

async function probeOcr(c) {
  const total = await scalar(c, `SELECT count(*)::int FROM nex.file_extraction`);
  const today = await scalar(c, `SELECT count(*)::int FROM nex.file_extraction WHERE extracted_at >= now() - interval '24 hours'`);
  const tess = existsSync(join(REPO_ROOT, "node_modules/tesseract.js/package.json"));
  let status = "yellow", reason;
  if (total === null) { status = "red"; reason = "nex.file_extraction unreachable"; }
  else if (!tess) { status = "red"; reason = "tesseract.js not installed"; }
  else if (today > 0) { status = "green"; reason = `${today} extractions today · ${total} total`; }
  else reason = `tesseract.js ready · ${total} total · no traffic today`;
  return { subsystem: "ocr", status, reason, metrics: { total_rows: total ?? 0, rows_today: today ?? 0, tesseract_installed: tess } };
}

async function probeApiMcp() {
  const port = process.env.PORT ?? "3008";
  const url = `http://localhost:${port}/api/nex/mcp`;
  let ok = false, body = null;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
    ok = res.ok;
    if (ok) body = await res.json().catch(() => null);
  } catch { /* ignore */ }
  const methods = body?.supported_methods?.length ?? 0;
  return { subsystem: "api_mcp", status: ok ? "green" : "yellow",
    reason: ok ? `MCP live · ${methods} methods` : `MCP not reachable at ${url}`,
    metrics: { endpoint_ok: ok, methods_count: methods } };
}

async function probeStorage(c) {
  const up = await scalar(c, `SELECT 1`);
  const dbBytes = await scalar(c, `SELECT pg_database_size(current_database())::text`);
  const blobs = await scalar(c, `SELECT count(*)::int FROM nex.object_blobs`);
  const blobBytes = await scalar(c, `SELECT COALESCE(sum(size_bytes),0)::text FROM nex.object_blobs`);
  const tables = await scalar(c, `SELECT count(*)::int FROM information_schema.tables WHERE table_schema LIKE 'nex%'`);
  let minioOk = false;
  try { const r = await fetch("http://localhost:9000/minio/health/live", { signal: AbortSignal.timeout(2000) }); minioOk = r.ok; } catch { /* ignore */ }
  let status = "yellow", reason;
  if (up !== 1) { status = "red"; reason = "Postgres unreachable"; }
  else if (minioOk) { status = "green"; reason = `Postgres up · ${tables} tables · MinIO up · ${blobs} object versions`; }
  else reason = `Postgres up · ${tables} tables · MinIO not deployed`;
  return { subsystem: "storage", status, reason,
    metrics: { pg_up: up === 1, minio_up: minioOk, db_bytes: dbBytes ? Number(dbBytes) : null,
               object_blobs_count: blobs ?? 0, object_blobs_bytes: blobBytes ? Number(blobBytes) : 0, table_count: tables ?? 0 } };
}

async function main() {
  const Client = await loadPg();
  if (!Client) { log("no pg module · aborting"); process.exit(2); }
  const c = new Client({ connectionString: readPgUrl(), connectionTimeoutMillis: 8000 });
  await c.connect();
  try {
    const probes = [probeCodeExecution(c), probeVoice(c), probeOcr(c), probeApiMcp(), probeStorage(c)];
    const results = await Promise.all(probes);
    for (const r of results) {
      // Upsert status snapshot
      await c.query(
        `INSERT INTO nex.founder_window_subsystem_status
           (subsystem, status, status_reason, last_ok_at, last_probe_at, metrics)
         VALUES ($1,$2,$3,$4,now(),$5::jsonb)
         ON CONFLICT (subsystem) DO UPDATE SET
           status = EXCLUDED.status,
           status_reason = EXCLUDED.status_reason,
           last_ok_at = CASE WHEN EXCLUDED.status='green' THEN now() ELSE nex.founder_window_subsystem_status.last_ok_at END,
           last_probe_at = now(),
           metrics = EXCLUDED.metrics`,
        [r.subsystem, r.status, r.reason, r.status === "green" ? new Date() : null, JSON.stringify(r.metrics ?? {})]
      );
      // Emit subsystem_probe event so the stream shows probes running
      const eventStatus = r.status === "green" ? "ok" : r.status === "red" ? "error" : r.status === "yellow" ? "warning" : "info";
      await c.query(
        `INSERT INTO nex.founder_window_event
           (subsystem, event_kind, status, actor, message, reference)
         VALUES ($1, 'subsystem_probe', $2, 'probe_scheduler', $3, $4::jsonb)`,
        [r.subsystem, eventStatus, r.reason, JSON.stringify(r.metrics ?? {})]
      );
      log(`  ${r.subsystem.padEnd(16)} ${r.status.padEnd(8)} ${r.reason}`);
    }
  } finally {
    try { await c.end(); } catch { /* ignore */ }
  }
}

main().catch((err) => { log("fatal:", String(err).slice(0, 200)); process.exit(1); });
