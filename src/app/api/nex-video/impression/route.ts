// POST /api/nex-video/impression
//
// NEX Video Feed V1 · Philip 2026-08-27.
// Records one row per view in nex.video_feed_impression.
//
// Body: { media_id, viewer_id?, session_id?, watched_ms?, unmuted? }
// - viewer_id defaults to session_id if omitted (anonymous view)
// - watched_ms best-effort · client posts on pause/next/unmount

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

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface Body {
  media_id?: string;
  viewer_id?: string;
  session_id?: string;
  watched_ms?: number;
  unmuted?: boolean;
}

export async function POST(req: Request) {
  let body: Body;
  try { body = await req.json(); }
  catch { return NextResponse.json({ ok: false, error: "invalid json" }, { status: 400 }); }

  if (!body.media_id || !UUID_RE.test(body.media_id)) {
    return NextResponse.json({ ok: false, error: "media_id must be UUID" }, { status: 400 });
  }
  const viewerId = (body.viewer_id ?? body.session_id ?? "anon").slice(0, 200);
  const sessionId = body.session_id ? body.session_id.slice(0, 200) : null;
  const watchedMs = Math.max(0, Math.min(24 * 3600 * 1000, Number(body.watched_ms ?? 0) || 0));
  const unmuted = Boolean(body.unmuted);

  const pool = getPool();
  await pool.query(
    `INSERT INTO nex.video_feed_impression
       (media_id, viewer_id, session_id, watched_ms, unmuted)
     VALUES ($1::uuid, $2, $3, $4, $5)`,
    [body.media_id, viewerId, sessionId, watchedMs, unmuted],
  ).catch(() => { /* impression logging is best-effort · never break playback */ });

  return NextResponse.json({ ok: true });
}
