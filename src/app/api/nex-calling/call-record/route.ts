// POST /api/nex-calling/call-record
//
// NEX Internal Calling · pure-NEX write endpoint · Philip 2026-08-27.
//
// Pure NEX: no Thenetworkers auth graft. Identity is what the client sends,
// same string the signalling server routes messages through. The call_record
// row lands with caller_user_id / callee_user_id as TEXT (migration 117).
//
// Called by the client on hangup. No side-effects other than the INSERT.

import { NextResponse } from "next/server";
import { Pool } from "pg";

export const dynamic = "force-dynamic";

let poolInstance: Pool | null = null;
function getPool(): Pool {
  if (!poolInstance) {
    poolInstance = new Pool({
      connectionString: process.env.NEX_POSTGRES_URL
        ?? "postgresql://postgres:Admin1phil@localhost:5433/nex_dev",
      max: 3,
    });
  }
  return poolInstance;
}

interface CallRecordBody {
  caller_user_id:         string;   // NEX identity string
  callee_user_id:         string;   // NEX identity string
  caller_display_name?:   string;
  callee_display_name?:   string;
  media_type?:            "voice" | "video";
  direction?:             "outbound" | "inbound";
  started_at?:            string;
  connected_at?:          string | null;
  ended_at?:              string | null;
  duration_sec?:          number;
  end_reason?:            "completed" | "missed" | "declined" | "busy" | "failed" | "ended";
  path?:                  "p2p" | "srflx" | "relay" | "unknown";
  quality_median_rtt_ms?: number | null;
  quality_median_jitter_ms?: number | null;
  quality_packets_lost?:  number | null;
  bytes_sent?:            number | null;
  bytes_received?:        number | null;
  audio_codec?:           string | null;
  video_codec?:           string | null;
  video_resolution?:      string | null;
  client_call_id?:        string;
}

export async function POST(req: Request) {
  let body: CallRecordBody;
  try { body = await req.json(); }
  catch { return NextResponse.json({ ok: false, error: "invalid json" }, { status: 400 }); }

  if (typeof body.caller_user_id !== "string" || body.caller_user_id.length === 0) {
    return NextResponse.json({ ok: false, error: "caller_user_id required" }, { status: 400 });
  }
  if (typeof body.callee_user_id !== "string" || body.callee_user_id.length === 0) {
    return NextResponse.json({ ok: false, error: "callee_user_id required" }, { status: 400 });
  }

  const pool = getPool();
  try {
    const result = await pool.query<{ id: string }>(
      `INSERT INTO nex.call_record (
         caller_user_id, callee_user_id, caller_display_name, callee_display_name,
         media_type, direction,
         started_at, connected_at, ended_at, duration_sec,
         end_reason, path,
         quality_median_rtt_ms, quality_median_jitter_ms, quality_packets_lost,
         bytes_sent, bytes_received,
         audio_codec, video_codec, video_resolution,
         client_call_id
       ) VALUES (
         $1, $2, $3, $4,
         $5, $6,
         COALESCE($7::timestamptz, now()), $8::timestamptz, $9::timestamptz, $10,
         $11, $12,
         $13, $14, $15,
         $16, $17,
         $18, $19, $20,
         $21
       )
       RETURNING id::text`,
      [
        body.caller_user_id, body.callee_user_id,
        body.caller_display_name ?? null, body.callee_display_name ?? null,
        body.media_type ?? "voice", body.direction ?? "outbound",
        body.started_at ?? null, body.connected_at ?? null, body.ended_at ?? null, body.duration_sec ?? null,
        body.end_reason ?? "ended", body.path ?? "unknown",
        body.quality_median_rtt_ms ?? null, body.quality_median_jitter_ms ?? null, body.quality_packets_lost ?? null,
        body.bytes_sent ?? null, body.bytes_received ?? null,
        body.audio_codec ?? null, body.video_codec ?? null, body.video_resolution ?? null,
        body.client_call_id ?? null,
      ],
    );
    return NextResponse.json({ ok: true, id: result.rows[0]?.id });
  } catch (err) {
    const message = err instanceof Error ? err.message : "insert failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
