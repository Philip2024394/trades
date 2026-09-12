// src/app/api/nex/founder-window/stream/route.ts
//
// Founder's Window · GET /api/nex/founder-window/stream
//
// Server-Sent Events push. The Founder's Window UI subscribes with
// EventSource and receives new events pushed as soon as they land in
// nex.founder_window_event.
//
// Implementation notes:
//   · Polls Postgres every 800ms (near-live · avoids LISTEN/NOTIFY setup
//     complexity in dev · can upgrade later)
//   · Sends heartbeat every 15s so proxies/load-balancers don't kill the
//     connection
//   · Uses ReadableStream · works with Next.js 14/15/16 runtime=nodejs
//   · Client sends Last-Event-ID (or ?after=<iso>) to resume without gap

import { getPool } from "@/lib/nex/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function isFounderRequest(req: Request): boolean {
  const url = new URL(req.url);
  const host = url.hostname;
  if (host === "localhost" || host === "127.0.0.1" || host === "::1") return true;
  const cookie = req.headers.get("cookie") ?? "";
  if (cookie.includes("admin_authed=1") || /x-admin-sig|nex_session=/.test(cookie)) return true;
  const token = req.headers.get("x-hq-token") ?? url.searchParams.get("hq_token");
  const expected = process.env.NEX_HQ_DASHBOARD_TOKEN;
  if (expected && expected.length >= 16 && token && token === expected) return true;
  return false;
}

export async function GET(req: Request) {
  if (!isFounderRequest(req)) {
    return new Response(JSON.stringify({ error: "no_founder_credential" }), {
      status: 401, headers: { "content-type": "application/json" },
    });
  }
  const url = new URL(req.url);
  const initialAfterHeader = req.headers.get("last-event-id");
  let after = initialAfterHeader || url.searchParams.get("after") || new Date().toISOString();

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      let closed = false;
      const send = (event: { id?: string; type?: string; data: unknown }) => {
        if (closed) return;
        try {
          const lines: string[] = [];
          if (event.id) lines.push(`id: ${event.id}`);
          if (event.type) lines.push(`event: ${event.type}`);
          lines.push(`data: ${JSON.stringify(event.data)}`);
          lines.push("", "");
          controller.enqueue(encoder.encode(lines.join("\n")));
        } catch { closed = true; }
      };
      // Initial hello (unblocks client waiting for first byte)
      send({ type: "hello", data: { subscribed_at: new Date().toISOString(), after } });

      const poll = async () => {
        try {
          const pool = await getPool();
          if (!pool) return;
          const c = await pool.connect();
          try {
            const r = await c.query(
              `SELECT event_id, emitted_at, subsystem, event_kind, status,
                      request_id, actor, subject_ref, message, reference, duration_ms
               FROM nex.founder_window_event
               WHERE emitted_at > $1::timestamptz
               ORDER BY emitted_at ASC
               LIMIT 200`,
              [after]
            );
            for (const row of r.rows) {
              send({ id: row.emitted_at.toISOString(), type: "event", data: row });
              after = row.emitted_at.toISOString();
            }
          } finally { c.release(); }
        } catch { /* keep polling · dashboard is best-effort */ }
      };

      // Heartbeat every 15s
      const heartbeat = setInterval(() => send({ type: "heartbeat", data: { at: new Date().toISOString() } }), 15_000);
      // Poll every 800ms
      const pollInterval = setInterval(poll, 800);

      // Cleanup on client disconnect
      const abort = req.signal;
      const onAbort = () => {
        closed = true;
        clearInterval(heartbeat);
        clearInterval(pollInterval);
        try { controller.close(); } catch { /* ignore */ }
      };
      if (abort.aborted) onAbort(); else abort.addEventListener("abort", onAbort);
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream",
      "cache-control": "no-cache, no-transform",
      "connection": "keep-alive",
      "x-accel-buffering": "no",
    },
  });
}
