// Admin campaign API.
//
// POST   /api/admin/affiliates/campaigns        — create a new campaign
// PATCH  /api/admin/affiliates/campaigns?id=… — update fields / status
//
// When a competition ends (status flips to "ended"), we tally the top
// N affiliates by paid commissions within its [starts_at, ends_at]
// window and create one bonus payout per winner (status='pending').
import { NextResponse, type NextRequest } from "next/server";
import { isAdminAuthed } from "@/lib/adminAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const KINDS = new Set(["competition", "bonus", "seasonal"]);
const STATUSES = new Set(["active", "ended", "cancelled"]);

type CampaignPatch = {
  title?: unknown;
  description?: unknown;
  starts_at?: unknown;
  ends_at?: unknown;
  bonus_pence?: unknown;
  multiplier?: unknown;
  prize_pence?: unknown;
  prize_count?: unknown;
  status?: unknown;
};

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }
  const kind = typeof body.kind === "string" ? body.kind : "";
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const startsAt = typeof body.starts_at === "string" ? body.starts_at : "";
  const endsAt = typeof body.ends_at === "string" ? body.ends_at : "";
  if (!KINDS.has(kind) || !title || !startsAt || !endsAt) {
    return NextResponse.json(
      { ok: false, error: "Missing kind / title / starts_at / ends_at." },
      { status: 400 }
    );
  }

  const row = {
    kind,
    title,
    description: typeof body.description === "string" ? body.description : null,
    starts_at: startsAt,
    ends_at: endsAt,
    bonus_pence: Math.max(0, Number(body.bonus_pence ?? 0) | 0),
    multiplier: Math.max(1, Number(body.multiplier ?? 1)),
    prize_pence: Math.max(0, Number(body.prize_pence ?? 0) | 0),
    prize_count: Math.max(0, Number(body.prize_count ?? 0) | 0)
  };
  const ins = await supabaseAdmin
    .from("hammerex_affiliate_campaigns")
    .insert(row)
    .select("id")
    .maybeSingle();
  if (ins.error || !ins.data) {
    return NextResponse.json(
      { ok: false, error: ins.error?.message ?? "Insert failed." },
      { status: 500 }
    );
  }
  await supabaseAdmin.from("hammerex_affiliate_audit_log").insert({
    actor_type: "admin",
    actor_id: "admin",
    action: "campaign.create",
    target_id: ins.data.id,
    details: { kind, title }
  });
  return NextResponse.json({ ok: true, id: ins.data.id });
}

export async function PATCH(req: NextRequest): Promise<NextResponse> {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }
  const url = new URL(req.url);
  const id = url.searchParams.get("id") ?? "";
  if (!id) {
    return NextResponse.json({ ok: false, error: "Missing id" }, { status: 400 });
  }
  let body: CampaignPatch;
  try {
    body = (await req.json()) as CampaignPatch;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }
  const patch: Record<string, unknown> = {};
  if (typeof body.title === "string") patch.title = body.title.trim();
  if (typeof body.description === "string") patch.description = body.description;
  if (typeof body.starts_at === "string") patch.starts_at = body.starts_at;
  if (typeof body.ends_at === "string") patch.ends_at = body.ends_at;
  if (body.bonus_pence !== undefined) {
    patch.bonus_pence = Math.max(0, Number(body.bonus_pence ?? 0) | 0);
  }
  if (body.multiplier !== undefined) {
    patch.multiplier = Math.max(1, Number(body.multiplier ?? 1));
  }
  if (body.prize_pence !== undefined) {
    patch.prize_pence = Math.max(0, Number(body.prize_pence ?? 0) | 0);
  }
  if (body.prize_count !== undefined) {
    patch.prize_count = Math.max(0, Number(body.prize_count ?? 0) | 0);
  }
  if (typeof body.status === "string" && STATUSES.has(body.status)) {
    patch.status = body.status;
  }

  // If we're ending a competition, fan out the prize payouts BEFORE we
  // flip the status, so we can read the campaign window cleanly.
  if (patch.status === "ended") {
    const { data: campaign } = await supabaseAdmin
      .from("hammerex_affiliate_campaigns")
      .select("kind, starts_at, ends_at, prize_pence, prize_count")
      .eq("id", id)
      .maybeSingle();
    if (
      campaign?.kind === "competition" &&
      campaign.prize_pence > 0 &&
      campaign.prize_count > 0
    ) {
      const { data: contenders } = await supabaseAdmin
        .from("hammerex_affiliate_commissions")
        .select("affiliate_id")
        .eq("status", "paid")
        .gte("paid_at", campaign.starts_at)
        .lte("paid_at", campaign.ends_at);
      const tally = new Map<number, number>();
      for (const row of contenders ?? []) {
        tally.set(row.affiliate_id, (tally.get(row.affiliate_id) ?? 0) + 1);
      }
      const winners = Array.from(tally.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, campaign.prize_count);
      const periodMonth = new Date(campaign.ends_at).toISOString().slice(0, 7);
      for (const [affiliateId] of winners) {
        await supabaseAdmin.from("hammerex_affiliate_payouts").insert({
          affiliate_id: affiliateId,
          total_pence: campaign.prize_pence,
          commission_ids: [],
          status: "pending",
          period_month: periodMonth,
          reference: `Prize: campaign ${id}`
        });
      }
    }
  }

  const upd = await supabaseAdmin
    .from("hammerex_affiliate_campaigns")
    .update(patch)
    .eq("id", id);
  if (upd.error) {
    return NextResponse.json(
      { ok: false, error: upd.error.message },
      { status: 500 }
    );
  }
  await supabaseAdmin.from("hammerex_affiliate_audit_log").insert({
    actor_type: "admin",
    actor_id: "admin",
    action: "campaign.update",
    target_id: id,
    details: patch
  });
  return NextResponse.json({ ok: true });
}
