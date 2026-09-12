// src/app/api/nex-social/friends/route.ts
//
// NEX Y-P3 · GET /api/nex-social/friends
// Philip 2026-09-07
//
// Returns the authenticated caller's accepted friendships only.
// Server-side scope: edges where user_low = auth.uid() OR user_high = auth.uid().

import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/nex/brains/_auth";
import { listFriends } from "@/lib/nex/friend-edge/friend-edge";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await getAuthenticatedUser();
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });

  const result = await listFriends(auth.user.supabase_user_id);
  if (!result.ok) return NextResponse.json({ ok: false, error: result.error }, { status: result.status });
  return NextResponse.json({ ok: true, friends: result.value }, { status: 200 });
}
