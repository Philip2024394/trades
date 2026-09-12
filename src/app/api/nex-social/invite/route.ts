// src/app/api/nex-social/invite/route.ts
//
// NEX Y-P3 · POST /api/nex-social/invite
// Philip 2026-09-07
//
// Authenticated caller creates a friend invitation from themselves to
// a recipient_user_id. Server-side authorization + state machine live
// in @/lib/nex/friend-edge/friend-edge.ts. This route is a thin adapter.

import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/nex/brains/_auth";
import { createInvite } from "@/lib/nex/friend-edge/friend-edge";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const auth = await getAuthenticatedUser();
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });

  let body: { recipient_user_id?: unknown; meeting_pref?: unknown } | null = null;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 }); }
  const recipient_user_id = typeof body?.recipient_user_id === "string" ? body!.recipient_user_id : "";
  const meeting_pref = typeof body?.meeting_pref === "string" ? body!.meeting_pref : null;

  const result = await createInvite({
    actor_user_id: auth.user.supabase_user_id,
    recipient_user_id,
    meeting_pref,
  });
  if (!result.ok) return NextResponse.json({ ok: false, error: result.error }, { status: result.status });
  return NextResponse.json({ ok: true, invite: result.value }, { status: 201 });
}
