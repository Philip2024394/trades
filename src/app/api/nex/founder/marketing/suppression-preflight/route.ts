// POST /api/nex/founder/marketing/suppression-preflight
//
// Founder-only DRY-RUN projection of how many contacts in a proposed audience
// filter would actually be sendable after all suppression rules apply.
//
// Read-only aggregate · zero mutation · zero sends · never returns raw emails.

import { NextResponse } from "next/server";
import { getPool } from "@/lib/nex/db";
import { resolveFounderAuth } from "@/lib/nex/marketing/founder";
import { computeSuppressionProjection, type SuppressionInputRow } from "@/lib/nex/marketing/deliverability";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface AudienceFilter {
  readonly country?: string;
  readonly category?: string;
  readonly limit?: number;               // safety cap
  readonly sender_id?: string;           // enables sender_reputation join
}

export async function POST(req: Request) {
  const auth = resolveFounderAuth(req);
  if (!auth.authenticated) return NextResponse.json({ ok: false, error: "not_founder" }, { status: 401 });
  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 }); }

  const filter: AudienceFilter = {
    country: typeof body?.country === "string" ? body.country : undefined,
    category: typeof body?.category === "string" ? body.category : undefined,
    limit: Number.isFinite(body?.limit) ? Math.min(Math.max(1, Math.floor(body.limit)), 10000) : 500,
    sender_id: typeof body?.sender_id === "string" ? body.sender_id : undefined,
  };

  const pool = await getPool();
  if (!pool) return NextResponse.json({ ok: false, error: "database_unavailable" }, { status: 503 });
  const client = await pool.connect();
  try {
    // Build audience query · returns SuppressionInputRow shape · never raw emails
    const params: any[] = [];
    const where: string[] = ["email IS NOT NULL"];
    if (filter.country) { params.push(filter.country); where.push(`country = $${params.length}`); }
    if (filter.category) { params.push(filter.category); where.push(`category = $${params.length}`); }
    params.push(filter.limit);
    const audience = await client.query<{
      contact_id: string; has_valid_email: boolean; hard_bounced: boolean;
      opt_out: boolean; complaint_count: number;
    }>(
      `SELECT contact_id::text,
              (email ~ '^[^@]+@[^@]+\\.[^@]+$') AS has_valid_email,
              COALESCE(hard_bounced, false) AS hard_bounced,
              COALESCE(opt_out, false) AS opt_out,
              COALESCE(complaint_count, 0) AS complaint_count
         FROM nex.marketing_contact
        WHERE ${where.join(" AND ")}
        LIMIT $${params.length}`,
      params,
    ).catch(() => ({ rows: [] as any[] }));

    let sender_reputation_state: string | null = null;
    let domain_dmarc_reject_unaligned = false;
    if (filter.sender_id) {
      const rep = await client.query<{ reputation_state: string }>(
        `SELECT reputation_state FROM nex.marketing_sender_reputation WHERE sender_id = $1
         ORDER BY computed_at DESC LIMIT 1`,
        [filter.sender_id],
      ).catch(() => ({ rows: [] as any[] }));
      sender_reputation_state = rep.rows[0]?.reputation_state ?? null;
    }

    const rows: SuppressionInputRow[] = audience.rows.map(r => ({
      contact_id: r.contact_id,
      has_valid_email: !!r.has_valid_email,
      hard_bounced: !!r.hard_bounced,
      opt_out: !!r.opt_out,
      complaint_count: Number(r.complaint_count) || 0,
      sender_reputation_state: sender_reputation_state as any,
      domain_dmarc_reject_unaligned,
    }));

    const projection = computeSuppressionProjection(rows);
    return NextResponse.json({
      ok: true,
      note: "DRY-RUN preflight · zero mutation · zero sends · no email addresses in body",
      filter,
      projection,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: "internal_error", detail: msg }, { status: 500 });
  } finally { client.release(); }
}
