// POST /api/homeowner/costs/[id]/payments — add a payment record.
//
// Body: { amountPence, method?, paidAt?, note? }
//
// The DB trigger auto-recomputes the parent cost's paid_pence + status.

import { NextResponse } from "next/server";
import { getHomeownerFromCookie } from "@/lib/homeowners/auth";
import { addPayment, markPaid, type PaymentMethod } from "@/lib/homeowners/costs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const homeowner = await getHomeownerFromCookie();
  if (!homeowner) return NextResponse.json({ ok: false, error: "not-authed" }, { status: 401 });
  const { id } = await params;
  const body = await req.json().catch(() => null) as {
    amountPence?: number;
    method?:      PaymentMethod;
    paidAt?:      string;
    note?:        string;
    /** Shortcut: markPaid=true records the full outstanding balance. */
    markPaid?:    boolean;
  } | null;

  if (body?.markPaid) {
    const res = await markPaid({ homeownerId: homeowner.id, costId: id, method: body.method });
    if (!res.ok) return NextResponse.json({ ok: false, error: res.error }, { status: 400 });
    return NextResponse.json({ ok: true });
  }

  if (typeof body?.amountPence !== "number") {
    return NextResponse.json({ ok: false, error: "missing-amount" }, { status: 400 });
  }
  const res = await addPayment({
    homeownerId: homeowner.id,
    costId:      id,
    amountPence: body.amountPence,
    method:      body.method,
    paidAt:      body.paidAt,
    note:        body.note
  });
  if (!res.ok) return NextResponse.json({ ok: false, error: res.error }, { status: 400 });
  return NextResponse.json({ ok: true, payment: res.payment });
}
