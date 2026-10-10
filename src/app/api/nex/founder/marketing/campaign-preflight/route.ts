// POST /api/nex/founder/marketing/campaign-preflight
//
// Founder-only unified DRY-RUN projection composing suppression + A/B + schedule.
// Read-only · zero persistence · zero sends · never returns raw emails.

import { NextResponse } from "next/server";
import { getPool } from "@/lib/nex/db";
import { resolveFounderAuth } from "@/lib/nex/marketing/founder";
import {
  composeCampaignPreflight, type CampaignPreflightInput,
  type SuppressionInputRow, type VariantDefinition,
} from "@/lib/nex/marketing/deliverability";
import type { ReputationState } from "@/lib/nex/marketing/deliverability/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const auth = resolveFounderAuth(req);
  if (!auth.authenticated) return NextResponse.json({ ok: false, error: "not_founder" }, { status: 401 });
  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 }); }

  const campaign_id = String(body?.campaign_id ?? "");
  if (!campaign_id) return NextResponse.json({ ok: false, error: "campaign_id_required" }, { status: 400 });
  const variants: VariantDefinition[] = Array.isArray(body?.variants) ? body.variants : [];
  const sender_id = String(body?.sender_id ?? "");
  if (!sender_id) return NextResponse.json({ ok: false, error: "sender_id_required" }, { status: 400 });
  const country = typeof body?.country === "string" ? body.country : undefined;
  const category = typeof body?.category === "string" ? body.category : undefined;
  const limit = Number.isFinite(body?.limit) ? Math.min(Math.max(1, Math.floor(body.limit)), 10000) : 500;

  const pool = await getPool();
  if (!pool) return NextResponse.json({ ok: false, error: "database_unavailable" }, { status: 503 });
  const client = await pool.connect();
  try {
    // Load audience rows
    const params: any[] = [];
    const where: string[] = ["email IS NOT NULL"];
    if (country) { params.push(country); where.push(`country = $${params.length}`); }
    if (category) { params.push(category); where.push(`category = $${params.length}`); }
    params.push(limit);
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

    // Load sender reputation
    const rep = await client.query<{ reputation_state: string }>(
      `SELECT reputation_state FROM nex.marketing_sender_reputation WHERE sender_id = $1
       ORDER BY computed_at DESC LIMIT 1`,
      [sender_id],
    ).catch(() => ({ rows: [] as any[] }));
    const sender_reputation_state = (rep.rows[0]?.reputation_state as ReputationState) ?? "unknown";

    const audience_rows: SuppressionInputRow[] = audience.rows.map(r => ({
      contact_id: r.contact_id,
      has_valid_email: !!r.has_valid_email,
      hard_bounced: !!r.hard_bounced,
      opt_out: !!r.opt_out,
      complaint_count: Number(r.complaint_count) || 0,
      sender_reputation_state: null, // per-row sender rep not tracked · sender-level applied at composer
      domain_dmarc_reject_unaligned: false,
    }));

    const composer_input: CampaignPreflightInput = {
      campaign_id, audience_rows, variants,
      sender_id, sender_reputation_state,
      per_hour_cap: Number(body?.per_hour_cap ?? 100),
      window_hours: Number(body?.window_hours ?? 4),
      start_at: String(body?.start_at ?? new Date().toISOString()),
      max_slot_size: body?.max_slot_size,
      min_inter_slot_ms: body?.min_inter_slot_ms,
    };

    const outcome = composeCampaignPreflight(composer_input);
    return NextResponse.json({
      ok: true,
      note: "DRY-RUN campaign preflight · zero mutation · zero sends · no email addresses in body",
      outcome,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: "internal_error", detail: msg }, { status: 500 });
  } finally { client.release(); }
}
