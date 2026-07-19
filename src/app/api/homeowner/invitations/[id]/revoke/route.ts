// POST /api/homeowner/invitations/[id]/revoke — owner kill-switch.
// Sets status='revoked' so the /join/[token] page starts returning
// "no longer available" and the panel row shows the revoked state.

import { NextResponse } from "next/server";
import { getHomeownerFromCookie } from "@/lib/homeowners/auth";
import { revokeInvitation } from "@/lib/homeowners/invitations";

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

  const ok = await revokeInvitation(id, homeowner.id);
  if (!ok) return NextResponse.json({ ok: false, error: "not-found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
