// src/app/api/nex/enterprise/teams/[id]/members/[user_id]/route.ts
//
// Founder Phase 16 · P16-3 · Remove a member.

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { resolveSession } from "@/lib/nex/identity-auth";
import { removeMember } from "@/lib/nex/enterprise";

export const runtime = "nodejs";

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string; user_id: string }> }) {
  const { id, user_id } = await ctx.params;
  const cookieStore = await cookies();
  const token = cookieStore.get("nex_session")?.value ?? null;
  const session = await resolveSession(token);
  if (!session?.user_id) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const out = await removeMember({
    team_id: id,
    actor_user_id: session.user_id,
    target_user_id: user_id,
  });
  if (!out.ok) return NextResponse.json({ error: out.error }, { status: 403 });
  return NextResponse.json({ ok: true, team_id: id, user_id });
}
