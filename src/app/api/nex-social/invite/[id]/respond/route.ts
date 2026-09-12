// src/app/api/nex-social/invite/[id]/respond/route.ts
//
// NEX Y-P3 · POST /api/nex-social/invite/[id]/respond
// Philip 2026-09-07
//
// Authenticated RECIPIENT accepts or declines a specific invitation.
// Server-side rules (in friend-edge.ts):
//   · caller must equal invite.recipient_user_id (else 403)
//   · invite must currently be PENDING (else 409)
//   · ACCEPT creates a canonical friend edge (LEAST/GREATEST ordered pair)
//   · DECLINE never creates a friend edge

import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/nex/brains/_auth";
import { respondToInvite } from "@/lib/nex/friend-edge/friend-edge";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await getAuthenticatedUser();
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });

  const { id } = await ctx.params;
  let body: { decision?: unknown } | null = null;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 }); }
  const decision = body?.decision === "ACCEPT" || body?.decision === "DECLINE" ? body!.decision : null;
  if (!decision) return NextResponse.json({ ok: false, error: "decision must be ACCEPT or DECLINE" }, { status: 400 });

  const result = await respondToInvite({
    actor_user_id: auth.user.supabase_user_id,
    invite_id: id,
    decision,
  });
  if (!result.ok) return NextResponse.json({ ok: false, error: result.error }, { status: result.status });
  return NextResponse.json({ ok: true, invite: result.value.invite, edge: result.value.edge }, { status: 200 });
}
