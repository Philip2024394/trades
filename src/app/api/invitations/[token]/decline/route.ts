// POST /api/invitations/[token]/decline — public endpoint used by the
// trade's /join/[token] landing page. Marks the invitation as
// 'declined'. Owner sees the state change on their Trades & Suppliers
// panel next render.

import { NextResponse } from "next/server";
import { declineInvitation } from "@/lib/homeowners/invitations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  if (!token) return NextResponse.json({ ok: false, error: "missing-token" }, { status: 400 });
  const res = await declineInvitation(token);
  if (!res.ok) {
    const status =
      res.error === "not-found"          ? 404 :
      res.error === "already-responded"  ? 409 : 400;
    return NextResponse.json({ ok: false, error: res.error }, { status });
  }
  return NextResponse.json({ ok: true });
}
