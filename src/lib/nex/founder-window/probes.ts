// src/lib/nex/founder-window/probes.ts
//
// Founder 2026-09-10 · Founder's Window · 5 subsystem health probes.
//
// Each probe:
//   · runs a REAL check (not a hardcoded value)
//   · returns green | yellow | red | unknown | not_implemented
//   · records the reason ("whisper.cpp binary not installed") so the pill's
//     tooltip is honest
//   · records metrics (rows written today, bytes used) for the panel body
//
// Called from a scheduled task every 60s. Persists via upsertSubsystemStatus.

import { existsSync, statSync } from "node:fs";
import { getPool } from "../db";
import { upsertSubsystemStatus } from "./emit";

type ProbeResult = {
  subsystem: string;
  status: "green" | "yellow" | "red" | "unknown" | "not_implemented";
  reason: string;
  metrics: Record<string, unknown>;
  reference: Record<string, unknown>;
};

async function scalar<T = unknown>(sql: string, params: unknown[] = []): Promise<T | null> {
  const pool = await getPool();
  if (!pool) return null;
  const c = await pool.connect();
  try {
    const r = await c.query(sql, params);
    const row = r.rows?.[0];
    if (!row) return null;
    const firstKey = Object.keys(row)[0];
    return (row[firstKey] as T) ?? null;
  } catch { return null; } finally { c.release(); }
}

// ─── 1 · Code Execution ────────────────────────────────────────────
// Probe: is there a code_execution row in the last 24h? is the programmer
// worker heartbeat fresh?
export async function probeCodeExecution(): Promise<ProbeResult> {
  const rowsToday = await scalar<number>(
    `SELECT count(*)::int FROM nex.code_execution WHERE executed_at >= now() - interval '24 hours'`
  ).catch(() => null);
  const totalRows = await scalar<number>(
    `SELECT count(*)::int FROM nex.code_execution`
  ).catch(() => null);
  const heartbeatPath = "data/nex-agent-runtime/heartbeat-programmer.json";
  let heartbeatFresh = false;
  let heartbeatAgeSec: number | null = null;
  try {
    if (existsSync(heartbeatPath)) {
      const st = statSync(heartbeatPath);
      heartbeatAgeSec = Math.round((Date.now() - st.mtimeMs) / 1000);
      heartbeatFresh = heartbeatAgeSec <= 60;
    }
  } catch { /* ignore */ }

  let status: ProbeResult["status"] = "yellow";
  let reason = "programmer worker installed · Phase A observation-only · no code mutations yet";
  if (totalRows === null) { status = "red"; reason = "cannot reach Postgres to check nex.code_execution"; }
  else if (heartbeatFresh && (rowsToday ?? 0) > 0) { status = "green"; reason = `heartbeat fresh (${heartbeatAgeSec}s) · ${rowsToday} runs today`; }
  else if (heartbeatFresh) { status = "yellow"; reason = `heartbeat fresh (${heartbeatAgeSec}s) · no runs today (observation mode)`; }
  else if (heartbeatAgeSec !== null) { status = "yellow"; reason = `heartbeat stale (${heartbeatAgeSec}s old)`; }
  else { status = "yellow"; reason = "programmer heartbeat file not present"; }

  return { subsystem: "code_execution", status, reason,
    metrics: { rows_today: rowsToday ?? 0, total_rows: totalRows ?? 0, heartbeat_age_sec: heartbeatAgeSec },
    reference: { heartbeat_path: heartbeatPath } };
}

// ─── 2 · Voice ─────────────────────────────────────────────────────
// Probe: are voice_transcript/voice_synthesis tables reachable? is the
// whisper.cpp / piper binary installed? is provider mode real or mock?
export async function probeVoice(): Promise<ProbeResult> {
  const transcripts = await scalar<number>(
    `SELECT count(*)::int FROM nex.voice_transcript`
  ).catch(() => null);
  const synthesised = await scalar<number>(
    `SELECT count(*)::int FROM nex.voice_synthesis`
  ).catch(() => null);
  const provider = process.env.NEX_VOICE_PROVIDER ?? "mock";
  // whisper.cpp / piper binaries · check common Windows install locations
  let whisperInstalled = false;
  let piperInstalled = false;
  for (const p of ["C:\\tools\\whisper.cpp\\main.exe", "C:\\Program Files\\whisper.cpp\\main.exe", "C:\\whisper\\main.exe"]) {
    if (existsSync(p)) { whisperInstalled = true; break; }
  }
  for (const p of ["C:\\tools\\piper\\piper.exe", "C:\\Program Files\\piper\\piper.exe"]) {
    if (existsSync(p)) { piperInstalled = true; break; }
  }

  let status: ProbeResult["status"] = "yellow";
  let reason: string;
  if (transcripts === null || synthesised === null) {
    status = "red";
    reason = "voice tables unreachable (Postgres down or migration missing)";
  } else if (provider === "real" && whisperInstalled && piperInstalled) {
    status = "green";
    reason = `real mode · whisper+piper installed · ${transcripts} transcripts · ${synthesised} synths`;
  } else if (provider === "real" && (!whisperInstalled || !piperInstalled)) {
    status = "red";
    reason = `provider=real but binaries missing (whisper=${whisperInstalled}, piper=${piperInstalled})`;
  } else {
    status = "yellow";
    reason = `provider=mock · endpoints live · install whisper.cpp+piper and set NEX_VOICE_PROVIDER=real to activate`;
  }

  return { subsystem: "voice", status, reason,
    metrics: { transcripts: transcripts ?? 0, synthesised: synthesised ?? 0, provider,
               whisper_installed: whisperInstalled, piper_installed: piperInstalled },
    reference: {} };
}

// ─── 3 · OCR ───────────────────────────────────────────────────────
// Probe: is tesseract.js reachable via node_modules? are file_extraction
// rows growing?
export async function probeOcr(): Promise<ProbeResult> {
  const total = await scalar<number>(`SELECT count(*)::int FROM nex.file_extraction`).catch(() => null);
  const today = await scalar<number>(
    `SELECT count(*)::int FROM nex.file_extraction WHERE extracted_at >= now() - interval '24 hours'`
  ).catch(() => null);
  const tesseractInstalled = existsSync("node_modules/tesseract.js/package.json");

  let status: ProbeResult["status"] = "yellow";
  let reason: string;
  if (total === null) { status = "red"; reason = "nex.file_extraction unreachable"; }
  else if (!tesseractInstalled) { status = "red"; reason = "tesseract.js not installed"; }
  else if ((today ?? 0) > 0) { status = "green"; reason = `${today} extractions today · ${total} total`; }
  else { status = "yellow"; reason = `tesseract.js ready · ${total} total extractions · no traffic today`; }

  return { subsystem: "ocr", status, reason,
    metrics: { total_rows: total ?? 0, rows_today: today ?? 0, tesseract_installed: tesseractInstalled },
    reference: {} };
}

// ─── 4 · API / MCP ─────────────────────────────────────────────────
// Probe: does /api/nex/mcp respond? are registered tools countable?
export async function probeApiMcp(): Promise<ProbeResult> {
  const port = process.env.PORT ?? "3008";
  const url = `http://localhost:${port}/api/nex/mcp`;
  let mcpOk = false;
  let mcpBody: unknown = null;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
    mcpOk = res.ok;
    if (res.ok) mcpBody = await res.json().catch(() => null);
  } catch { /* ignore */ }
  const toolCount = (mcpBody as { supported_methods?: unknown[] } | null)?.supported_methods?.length ?? 0;

  const status: ProbeResult["status"] = mcpOk ? "green" : "yellow";
  const reason = mcpOk
    ? `MCP endpoint reachable · JSON-RPC 2.0 · ${toolCount} methods supported`
    : `MCP endpoint not reachable at ${url} (dev server may be down)`;

  return { subsystem: "api_mcp", status, reason,
    metrics: { endpoint_ok: mcpOk, methods_count: toolCount },
    reference: { url, body: mcpBody } };
}

// ─── 5 · Storage ───────────────────────────────────────────────────
// Probe: Postgres reachable? disk space? MinIO reachable? object_blobs
// growing?
export async function probeStorage(): Promise<ProbeResult> {
  const pgUp = await scalar<number>(`SELECT 1`).catch(() => null);
  const dbBytes = await scalar<string>(`SELECT pg_database_size(current_database())::text`).catch(() => null);
  const objectBlobs = await scalar<number>(`SELECT count(*)::int FROM nex.object_blobs`).catch(() => null);
  const objectBlobsBytes = await scalar<string>(`SELECT COALESCE(sum(size_bytes),0)::text FROM nex.object_blobs`).catch(() => null);
  const tableCount = await scalar<number>(
    `SELECT count(*)::int FROM information_schema.tables WHERE table_schema IN ('nex','nex_lab','nex_lab_accommodation','nex_lab_food','nex_lab_transport','nex_lab_business','nex_lab_activities')`
  ).catch(() => null);

  // MinIO reachability probe (best-effort)
  let minioOk = false;
  try {
    const res = await fetch("http://localhost:9000/minio/health/live", { signal: AbortSignal.timeout(2000) });
    minioOk = res.ok;
  } catch { /* not running */ }

  let status: ProbeResult["status"] = "yellow";
  let reason: string;
  if (pgUp !== 1) { status = "red"; reason = "Postgres unreachable"; }
  else if (minioOk) { status = "green"; reason = `Postgres up · ${tableCount} tables · MinIO up · ${objectBlobs} object versions`; }
  else { status = "yellow"; reason = `Postgres up · ${tableCount} tables · MinIO not reachable at :9000 (falling back to nex.object_blobs bytea)`; }

  return { subsystem: "storage", status, reason,
    metrics: { pg_up: pgUp === 1, minio_up: minioOk,
               db_bytes: dbBytes ? Number(dbBytes) : null,
               object_blobs_count: objectBlobs ?? 0,
               object_blobs_bytes: objectBlobsBytes ? Number(objectBlobsBytes) : 0,
               table_count: tableCount ?? 0 },
    reference: { pg_url: "postgresql://localhost:5433/nex_dev", minio_url: "http://localhost:9000" } };
}

// ─── Runner ────────────────────────────────────────────────────────
export async function runAllProbes(): Promise<ProbeResult[]> {
  const probes = [probeCodeExecution, probeVoice, probeOcr, probeApiMcp, probeStorage];
  const results = await Promise.all(probes.map(async (p) => {
    try { return await p(); } catch (err) {
      return { subsystem: p.name.replace(/^probe/i, "").toLowerCase(),
               status: "unknown" as const,
               reason: `probe threw: ${String(err).slice(0, 200)}`,
               metrics: {}, reference: {} };
    }
  }));
  // Persist each result
  await Promise.all(results.map((r) =>
    upsertSubsystemStatus(r.subsystem, r.status, r.reason, r.metrics, r.reference)
  ));
  return results;
}
