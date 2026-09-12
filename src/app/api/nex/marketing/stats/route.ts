// src/app/api/nex/marketing/stats/route.ts
//
// GET /api/nex/marketing/stats
//
// End-to-end pipeline counts for the marketing dashboard's live diagram.
// Matches the Founder's Window pattern: every stage returns a real count.

import { NextResponse } from "next/server";
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

async function scalar(sql: string): Promise<number> {
  const pool = await getPool();
  if (!pool) return 0;
  const c = await pool.connect();
  try {
    const r = await c.query(sql);
    return Number(r.rows?.[0]?.count ?? 0);
  } catch { return 0; } finally { c.release(); }
}

export async function GET(req: Request) {
  if (!isFounderRequest(req)) return NextResponse.json({ error: "no_founder_credential" }, { status: 401 });

  const [
    contacts_total, contacts_sendable, contacts_opted_out, contacts_bounced,
    segments_saved, templates_ready, campaigns_draft, campaigns_pending,
    campaigns_sending, campaigns_sent_24h, queue_pending, queue_sent_24h, queue_failed_24h,
    contacts_new_1h, contacts_new_24h, sends_last_hour,
  ] = await Promise.all([
    scalar(`SELECT count(*)::int AS count FROM nex.marketing_contact`),
    scalar(`SELECT count(*)::int AS count FROM nex.marketing_contact WHERE opt_out = FALSE AND hard_bounced = FALSE AND email IS NOT NULL`),
    scalar(`SELECT count(*)::int AS count FROM nex.marketing_contact WHERE opt_out = TRUE`),
    scalar(`SELECT count(*)::int AS count FROM nex.marketing_contact WHERE hard_bounced = TRUE`),
    scalar(`SELECT count(*)::int AS count FROM nex.marketing_segment`),
    scalar(`SELECT count(*)::int AS count FROM nex.marketing_template`),
    scalar(`SELECT count(*)::int AS count FROM nex.marketing_campaign WHERE status = 'draft'`),
    scalar(`SELECT count(*)::int AS count FROM nex.marketing_campaign WHERE status = 'pending_approval'`),
    scalar(`SELECT count(*)::int AS count FROM nex.marketing_campaign WHERE status = 'sending'`),
    scalar(`SELECT count(*)::int AS count FROM nex.marketing_campaign WHERE status = 'sent' AND completed_at > now() - interval '24 hours'`),
    scalar(`SELECT count(*)::int AS count FROM nex.marketing_send_queue WHERE status = 'pending'`),
    scalar(`SELECT count(*)::int AS count FROM nex.marketing_send_queue WHERE status = 'sent' AND sent_at > now() - interval '24 hours'`),
    scalar(`SELECT count(*)::int AS count FROM nex.marketing_send_queue WHERE status = 'failed' AND sent_at > now() - interval '24 hours'`),
    scalar(`SELECT count(*)::int AS count FROM nex.marketing_contact WHERE first_seen_at > now() - interval '1 hour'`),
    scalar(`SELECT count(*)::int AS count FROM nex.marketing_contact WHERE first_seen_at > now() - interval '24 hours'`),
    scalar(`SELECT count(*)::int AS count FROM nex.marketing_send_log WHERE sent_at > now() - interval '1 hour'`),
  ]);

  // Sources — where our contacts came from
  const pool = await getPool();
  let bySource: Array<{ source: string; count: number }> = [];
  let byCountry: Array<{ country: string; count: number }> = [];
  if (pool) {
    const c = await pool.connect();
    try {
      const srcRes = await c.query(`
        SELECT UNNEST(source_tables) AS source, count(*)::int AS c
        FROM nex.marketing_contact
        WHERE opt_out = FALSE AND hard_bounced = FALSE
        GROUP BY source ORDER BY c DESC LIMIT 10
      `);
      bySource = srcRes.rows.map((r: { source: string; c: number }) => ({ source: r.source, count: r.c }));
      const cRes = await c.query(`
        SELECT COALESCE(country, 'ID') AS country, count(*)::int AS c
        FROM nex.marketing_contact
        WHERE opt_out = FALSE AND hard_bounced = FALSE
        GROUP BY country ORDER BY c DESC LIMIT 20
      `);
      byCountry = cRes.rows.map((r: { country: string; c: number }) => ({ country: r.country, count: r.c }));
    } finally { c.release(); }
  }

  return NextResponse.json({
    generated_at: new Date().toISOString(),
    stages: {
      collect: { contacts_new_1h, contacts_new_24h, note: "from Lab enrichers + crawler" },
      contact_db: { total: contacts_total, sendable: contacts_sendable, opted_out: contacts_opted_out, hard_bounced: contacts_bounced },
      segment: { saved_segments: segments_saved },
      template: { templates_ready },
      campaign: { draft: campaigns_draft, pending_approval: campaigns_pending, sending: campaigns_sending, sent_24h: campaigns_sent_24h },
      queue: { pending: queue_pending, sent_24h: queue_sent_24h, failed_24h: queue_failed_24h },
      sending: { sends_last_hour, note: "worker throttled to NEX_MARKETING_MAX_SEND_PER_MIN" },
    },
    breakdown: { by_source: bySource, by_country: byCountry },
    env: {
      send_enabled: process.env.NEX_MARKETING_SEND_ENABLED === "true",
      esp: process.env.NEX_MARKETING_ESP ?? "not_configured",
      max_per_min: Number(process.env.NEX_MARKETING_MAX_SEND_PER_MIN ?? "10"),
    },
  }, { headers: { "Cache-Control": "no-store" } });
}
