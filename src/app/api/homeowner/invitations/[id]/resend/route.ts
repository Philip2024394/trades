// POST /api/homeowner/invitations/[id]/resend — owner resends a
// pending or unavailable invitation. Free within 7 days of the last
// send; otherwise debits 1 washer. Returns a fresh wa.me URL.

import { NextResponse } from "next/server";
import { getHomeownerFromCookie } from "@/lib/homeowners/auth";
import { resendInvitation } from "@/lib/homeowners/invitations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const homeowner = await getHomeownerFromCookie();
  if (!homeowner) return NextResponse.json({ ok: false, error: "not-authed" }, { status: 401 });

  const { id } = await params;
  if (!id) return NextResponse.json({ ok: false, error: "missing-invitation" }, { status: 400 });

  const res = await resendInvitation(id, homeowner.id);
  if (!res.ok) {
    const status = res.error === "quota-exceeded" ? 402 : 400;
    return NextResponse.json({ ok: false, error: res.error }, { status });
  }
  return NextResponse.json({ ok: true, waUrl: res.waUrl, charged: res.charged });
}
