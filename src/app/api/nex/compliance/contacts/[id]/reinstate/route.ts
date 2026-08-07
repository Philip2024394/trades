// POST /api/nex/compliance/contacts/{id}/reinstate
// Body: { reason: string, actor?: string, confirmed?: boolean }
//
// Reinstate is policy-gated:
//   suppressed_soft / suppressed_hard  → allowed (single-click undo)
//   complaint / manual_block / unsubscribed → requires confirmed=true
//                                             + a reason (audit trail)
import { NextResponse } from "next/server";
import { getContactCompliance, manualReinstate } from "@/lib/nex/compliance/engine";
import { reinstatePolicy } from "@/lib/nex/compliance/policy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  let body: { reason?: string; actor?: string; confirmed?: boolean };
  try { body = await request.json() as typeof body; }
  catch { return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 }); }

  const cur = await getContactCompliance(id);
  if (!cur) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });

  const policy = reinstatePolicy(cur.compliance_state);
  if (policy === "denied") return NextResponse.json({ ok: false, error: "not_suppressed" }, { status: 400 });
  if (policy === "requires_confirmation" && body.confirmed !== true) {
    return NextResponse.json({
      ok: false, error: "confirmation_required",
      current_state: cur.compliance_state,
      hint: `state=${cur.compliance_state} requires explicit admin confirmation · resend with { confirmed: true, reason: '...' }`,
    }, { status: 409 });
  }
  if (!body.reason || body.reason.trim().length < 3) {
    return NextResponse.json({ ok: false, error: "reason required (min 3 chars)" }, { status: 400 });
  }

  const r = await manualReinstate(id, body.actor?.trim() || "admin", body.reason.trim());
  if (!r) return NextResponse.json({ ok: false, error: "update_failed" }, { status: 500 });
  return NextResponse.json({ ok: true, contact: r });
}
