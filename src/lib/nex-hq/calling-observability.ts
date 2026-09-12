// src/lib/nex-hq/calling-observability.ts
//
// NEX HQ · Calling observability data loader · Philip 2026-08-27.
//
// Aggregates nex.call_record + reads the signalling server's health endpoint
// so the HQ page can render:
//   · Overall call volume, path distribution, quality trend
//   · Recent call log (last 50)
//   · Signalling server presence + uptime
//   · Business-gate configurations (voice/video enabled counts)
//   · Resilience metrics: RTT p50/p95, packet loss, calls with quality warnings
//
// Read-only.

import { Pool } from "pg";
import { getPostgresUrl } from "@/lib/nex/config/pg";

const POOL = new Pool({
  connectionString: getPostgresUrl(),
  max: 3,
});

export interface CallSummary {
  totalCalls: number;
  totalConnected: number;
  totalMissed: number;
  totalFailed: number;
  medianDurationSec: number;
  pathDistribution: { p2p: number; srflx: number; relay: number; unknown: number };
  medianRttMs: number | null;
  p95RttMs: number | null;
  medianJitterMs: number | null;
  callsWithQualityWarnings: number;
  callsByHour: Array<{ hour: string; n: number }>;
  totalPacketsLost: number;
  bytesSentTotal: bigint | number;
  bytesReceivedTotal: bigint | number;
}

export interface RecentCall {
  id: string;
  caller: string | null;
  callee: string | null;
  media_type: string;
  path: string | null;
  end_reason: string | null;
  duration_sec: number | null;
  rtt_ms: number | null;
  video_resolution: string | null;
  started_at: Date;
}

export interface SignalHealth {
  reachable: boolean;
  uptimeSec: number | null;
  identitiesOnline: number | null;
  error?: string;
}

export interface GateSummary {
  totalConfigs: number;
  voiceEnabled: number;
  videoEnabled: number;
  bothEnabled: number;
  withConsent: number;
  withHours: number;
  totalBlockedCallers: number;
}

async function scalar<T = number>(sql: string, params?: unknown[]): Promise<T> {
  const r = await POOL.query(sql, params);
  return Object.values(r.rows[0] ?? {})[0] as T;
}

// Median helper (in SQL) — Postgres has percentile_cont, use that where possible.
export async function loadCallSummary(hours = 24): Promise<CallSummary> {
  const since = `now() - interval '${hours} hours'`;
  const totalCalls = Number(await scalar<number>(`SELECT COUNT(*) FROM nex.call_record WHERE started_at > ${since}`));
  const totalConnected = Number(await scalar<number>(`SELECT COUNT(*) FROM nex.call_record WHERE started_at > ${since} AND connected_at IS NOT NULL`));
  const totalMissed = Number(await scalar<number>(`SELECT COUNT(*) FROM nex.call_record WHERE started_at > ${since} AND end_reason = 'missed'`));
  const totalFailed = Number(await scalar<number>(`SELECT COUNT(*) FROM nex.call_record WHERE started_at > ${since} AND end_reason = 'failed'`));

  const durationRow = await POOL.query(
    `SELECT
       percentile_cont(0.5) WITHIN GROUP (ORDER BY duration_sec) AS median_dur,
       percentile_cont(0.5) WITHIN GROUP (ORDER BY quality_median_rtt_ms) AS median_rtt,
       percentile_cont(0.95) WITHIN GROUP (ORDER BY quality_median_rtt_ms) AS p95_rtt,
       percentile_cont(0.5) WITHIN GROUP (ORDER BY quality_median_jitter_ms) AS median_jitter,
       COALESCE(SUM(quality_packets_lost), 0)::bigint AS lost,
       COALESCE(SUM(bytes_sent), 0)::bigint AS sent,
       COALESCE(SUM(bytes_received), 0)::bigint AS recv
     FROM nex.call_record
     WHERE started_at > ${since}`,
  );
  const d = durationRow.rows[0] ?? {};
  const medianDurationSec = Number(d.median_dur ?? 0);
  const medianRttMs = d.median_rtt != null ? Number(d.median_rtt) : null;
  const p95RttMs = d.p95_rtt != null ? Number(d.p95_rtt) : null;
  const medianJitterMs = d.median_jitter != null ? Number(d.median_jitter) : null;
  const totalPacketsLost = Number(d.lost ?? 0);
  const bytesSentTotal = d.sent ?? 0;
  const bytesReceivedTotal = d.recv ?? 0;

  // Path distribution
  const pathRows = await POOL.query(
    `SELECT COALESCE(path, 'unknown') AS path, COUNT(*)::int AS n
       FROM nex.call_record
      WHERE started_at > ${since}
      GROUP BY 1`,
  );
  const pathDistribution = { p2p: 0, srflx: 0, relay: 0, unknown: 0 };
  for (const r of pathRows.rows) {
    if (r.path in pathDistribution) (pathDistribution as any)[r.path] = Number(r.n);
    else pathDistribution.unknown += Number(r.n);
  }

  const warningRow = await POOL.query(
    `SELECT COUNT(*)::int AS n FROM nex.call_record
      WHERE started_at > ${since}
        AND (quality_median_rtt_ms > 300 OR quality_median_jitter_ms > 60 OR quality_packets_lost > 100)`,
  );
  const callsWithQualityWarnings = Number(warningRow.rows[0]?.n ?? 0);

  const hourlyRows = await POOL.query(
    `SELECT to_char(date_trunc('hour', started_at), 'YYYY-MM-DD HH24:00') AS hour, COUNT(*)::int AS n
       FROM nex.call_record
      WHERE started_at > ${since}
      GROUP BY 1
      ORDER BY 1 DESC
      LIMIT 24`,
  );
  const callsByHour = hourlyRows.rows.map((r) => ({ hour: r.hour, n: Number(r.n) }));

  return {
    totalCalls, totalConnected, totalMissed, totalFailed,
    medianDurationSec, pathDistribution,
    medianRttMs, p95RttMs, medianJitterMs,
    callsWithQualityWarnings, callsByHour,
    totalPacketsLost, bytesSentTotal, bytesReceivedTotal,
  };
}

export async function loadRecentCalls(limit = 50): Promise<RecentCall[]> {
  const r = await POOL.query(
    `SELECT id, caller_display_name AS caller, callee_display_name AS callee,
            media_type, path, end_reason, duration_sec,
            quality_median_rtt_ms AS rtt_ms, video_resolution, started_at
       FROM nex.call_record
       ORDER BY started_at DESC
       LIMIT $1`,
    [limit],
  );
  return r.rows.map((r) => ({
    id: String(r.id),
    caller: r.caller ?? null,
    callee: r.callee ?? null,
    media_type: r.media_type ?? "voice",
    path: r.path,
    end_reason: r.end_reason,
    duration_sec: r.duration_sec != null ? Number(r.duration_sec) : null,
    rtt_ms: r.rtt_ms != null ? Number(r.rtt_ms) : null,
    video_resolution: r.video_resolution,
    started_at: new Date(r.started_at),
  }));
}

export async function loadSignalHealth(): Promise<SignalHealth> {
  const base = process.env.NEXT_PUBLIC_NEX_CALL_SIGNAL_URL ?? "http://localhost:8090";
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2000);
    const r = await fetch(`${base}/health`, { signal: controller.signal, cache: "no-store" });
    clearTimeout(timer);
    if (!r.ok) return { reachable: false, uptimeSec: null, identitiesOnline: null, error: `http ${r.status}` };
    const j = await r.json();
    return {
      reachable: true,
      uptimeSec: Number(j.uptime_sec ?? 0),
      identitiesOnline: Number(j.identities_online ?? 0),
    };
  } catch (e) {
    return { reachable: false, uptimeSec: null, identitiesOnline: null, error: (e as Error).message };
  }
}

export async function loadGateSummary(): Promise<GateSummary> {
  const r = await POOL.query(
    `SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE voice_enabled)::int AS voice,
        COUNT(*) FILTER (WHERE video_enabled)::int AS video,
        COUNT(*) FILTER (WHERE voice_enabled AND video_enabled)::int AS both,
        COUNT(*) FILTER (WHERE consent_at IS NOT NULL)::int AS consent,
        COUNT(*) FILTER (WHERE hours IS NOT NULL)::int AS with_hours,
        COALESCE(SUM(cardinality(blocked_callers)), 0)::int AS blocked
      FROM nex.business_calling_config`,
  );
  const row = r.rows[0] ?? {};
  return {
    totalConfigs: Number(row.total ?? 0),
    voiceEnabled: Number(row.voice ?? 0),
    videoEnabled: Number(row.video ?? 0),
    bothEnabled: Number(row.both ?? 0),
    withConsent: Number(row.consent ?? 0),
    withHours: Number(row.with_hours ?? 0),
    totalBlockedCallers: Number(row.blocked ?? 0),
  };
}
