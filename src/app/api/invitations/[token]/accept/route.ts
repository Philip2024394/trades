// POST /api/invitations/[token]/accept — public endpoint used by the
// trade's /join/[token] landing page. NO AUTH — the token is the
// credential. Creates hammerex_sitebook_members rows for each ticked
// project on success.

import { NextResponse } from "next/server";
import { acceptInvitation } from "@/lib/homeowners/invitations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  if (!token) return NextResponse.json({ ok: false, error: "missing-token" }, { status: 400 });
  const res = await acceptInvitation(token);
  if (!res.ok) {
    const status =
      res.error === "not-found"          ? 404 :
      res.error === "revoked"            ? 410 :
      res.error === "already-responded"  ? 409 : 400;
    return NextResponse.json({ ok: false, error: res.error }, { status });
  }
  return NextResponse.json({ ok: true, invitationId: res.invitation.id });
}
