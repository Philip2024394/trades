// GET  /api/nex/marketing/campaigns
// POST /api/nex/marketing/campaigns · create draft campaign (no send)
// PATCH /api/nex/marketing/campaigns · set status='approved' (queues send) — requires active policy

import { NextResponse } from "next/server";
import { getPool } from "@/lib/nex/db";
import { materialiseSegmentContacts } from "@/lib/nex/marketing/segments";
import { listActivePolicies } from "@/lib/nex/authorization/policy";

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
  if (!isFounderRequest(req)) return NextResponse.json({ error: "no_founder_credential" }, { status: 401 });
  const pool = await getPool();
  if (!pool) return NextResponse.json({ campaigns: [] });
  const c = await pool.connect();
  try {
    const r = await c.query(`
      SELECT c.campaign_id, c.slug, c.display_name, c.status, c.target_count,
             c.send_count, c.fail_count, c.opened_count, c.clicked_count,
             c.bounced_count, c.complained_count,
             c.proposed_at, c.approved_at, c.started_at, c.completed_at,
             t.subject_line, t.slug AS template_slug, s.slug AS segment_slug
      FROM nex.marketing_campaign c
      JOIN nex.marketing_template t ON t.template_id = c.template_id
      JOIN nex.marketing_segment s ON s.segment_id = c.segment_id
      ORDER BY c.proposed_at DESC LIMIT 100
    `);
    return NextResponse.json({ campaigns: r.rows });
  } finally { c.release(); }
}

// Create draft (safe · no send)
export async function POST(req: Request) {
  if (!isFounderRequest(req)) return NextResponse.json({ error: "no_founder_credential" }, { status: 401 });
  const body = await req.json().catch(() => null) as {
    slug?: string; display_name?: string; template_id?: string; segment_id?: string;
  } | null;
  if (!body?.slug || !body.template_id || !body.segment_id) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }
  const pool = await getPool();
  if (!pool) return NextResponse.json({ error: "postgres_unavailable" }, { status: 500 });
  const c = await pool.connect();
  try {
    const r = await c.query(
      `INSERT INTO nex.marketing_campaign (slug, display_name, template_id, segment_id, status)
       VALUES ($1,$2,$3::uuid,$4::uuid,'draft') RETURNING campaign_id`,
      [body.slug, body.display_name ?? body.slug, body.template_id, body.segment_id]
    );
    return NextResponse.json({ ok: true, campaign_id: r.rows[0].campaign_id, status: "draft" });
  } finally { c.release(); }
}

// Approve · queues sends · requires an ACTIVE POLICY (not per-record HMAC)
export async function PATCH(req: Request) {
  if (!isFounderRequest(req)) return NextResponse.json({ error: "no_founder_credential" }, { status: 401 });
  const body = await req.json().catch(() => null) as { campaign_id?: string; approved_by?: string } | null;
  if (!body?.campaign_id) return NextResponse.json({ error: "missing_fields" }, { status: 400 });

  const pool = await getPool();
  if (!pool) return NextResponse.json({ error: "postgres_unavailable" }, { status: 500 });
  const c = await pool.connect();
  try {
    await c.query("BEGIN");
    const cam = (await c.query(
      `SELECT campaign_id, status, segment_id, template_id FROM nex.marketing_campaign WHERE campaign_id = $1 FOR UPDATE`,
      [body.campaign_id]
    )).rows[0];
    if (!cam) { await c.query("ROLLBACK"); return NextResponse.json({ error: "campaign_not_found" }, { status: 404 }); }
    if (cam.status !== "draft") { await c.query("ROLLBACK"); return NextResponse.json({ error: `already_${cam.status}` }, { status: 400 }); }

    // Policy gate · at least one active marketing_email policy must exist
    const policies = await listActivePolicies("marketing_email");
    const sendPolicies = policies.filter((p) => p.action_kind === "send_email");
    if (sendPolicies.length === 0) {
      await c.query("ROLLBACK");
      return NextResponse.json({
        error: "no_active_policy",
        detail: "No active marketing_email/send_email policy. Founder must authorize a policy via /api/nex/marketing/policies before campaigns can be approved."
      }, { status: 403 });
    }

    // Materialise queue from segment
    const seg = (await c.query(`SELECT category_group, category_slug, country, city, language, extra_where FROM nex.marketing_segment WHERE segment_id = $1`, [cam.segment_id])).rows[0];
    if (!seg) { await c.query("ROLLBACK"); return NextResponse.json({ error: "segment_not_found" }, { status: 404 }); }
    const contacts = await materialiseSegmentContacts(c, seg, seg.extra_where);
    if (contacts.length === 0) { await c.query("ROLLBACK"); return NextResponse.json({ error: "segment_empty" }, { status: 400 }); }

    // Enqueue
    for (const ct of contacts) {
      await c.query(
        `INSERT INTO nex.marketing_send_queue (campaign_id, contact_id, email, status)
         VALUES ($1, $2, $3, 'pending') ON CONFLICT DO NOTHING`,
        [cam.campaign_id, ct.contact_id, ct.email]
      );
    }
    await c.query(
      `UPDATE nex.marketing_campaign SET status='sending', approved_at=now(), approved_by=$1, target_count=$2, started_at=now() WHERE campaign_id=$3`,
      [body.approved_by ?? "founder", contacts.length, cam.campaign_id]
    );
    await c.query("COMMIT");
    return NextResponse.json({ ok: true, queued: contacts.length, policy_gate_active: sendPolicies.map((p) => p.slug) });
  } catch (err) {
    try { await c.query("ROLLBACK"); } catch { /* ignore */ }
    return NextResponse.json({ error: "internal", detail: String(err).slice(0, 200) }, { status: 500 });
  } finally { c.release(); }
}
