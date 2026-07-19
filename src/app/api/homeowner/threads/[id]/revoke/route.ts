// POST /api/homeowner/threads/[id]/revoke — homeowner kill-switch.
// Sets revoked_at on the WA thread so the /r/{token} public reply
// page starts returning 'revoked' + future outgoing sends on the
// same (post, trade) pair fail with 'thread-revoked'.
//
// Idempotent: revoking an already-revoked thread returns ok.
// Auth: ownership check enforced inside revokeThread (matches on
// homeowner_id).

import { NextResponse } from "next/server";
import { getHomeownerFromCookie } from "@/lib/homeowners/auth";
import { revokeThread } from "@/lib/homeowners/waMessages";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const homeowner = await getHomeownerFromCookie();
  if (!homeowner) return NextResponse.json({ ok: false, error: "not-authed" }, { status: 401 });

  const { id } = await params;
  if (!id) return NextResponse.json({ ok: false, error: "missing-thread" }, { status: 400 });

  const ok = await revokeThread(id, homeowner.id);
  if (!ok) return NextResponse.json({ ok: false, error: "not-found" }, { status: 404 });

  return NextResponse.json({ ok: true });
}
