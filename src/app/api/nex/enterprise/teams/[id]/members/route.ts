// src/app/api/nex/enterprise/teams/[id]/members/route.ts
//
// Founder Phase 16 · P16-3 · List / add members.

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { resolveSession } from "@/lib/nex/identity-auth";
import { addMember, listMembers, getRoleInTeam } from "@/lib/nex/enterprise";

export const runtime = "nodejs";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const cookieStore = await cookies();
  const token = cookieStore.get("nex_session")?.value ?? null;
  const session = await resolveSession(token);
  if (!session?.user_id) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const role = await getRoleInTeam(id, session.user_id);
  if (!role) return NextResponse.json({ error: "not_a_member" }, { status: 403 });
  const members = await listMembers(id);
  return NextResponse.json({ team_id: id, viewer_role: role, members });
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const cookieStore = await cookies();
  const token = cookieStore.get("nex_session")?.value ?? null;
  const session = await resolveSession(token);
  if (!session?.user_id) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  let body: Record<string, unknown> = {};
  try { body = (await req.json()) as Record<string, unknown>; } catch { /* empty body */ }
  const new_user_id = typeof body.user_id === "string" ? body.user_id : "";
  const role = (["owner", "admin", "member"].includes(body.role as string) ? body.role : "member") as "owner" | "admin" | "member";
  if (!new_user_id) return NextResponse.json({ error: "missing_user_id" }, { status: 400 });
  const out = await addMember({
    team_id: id,
    actor_user_id: session.user_id,
    new_user_id,
    role,
  });
  if (!out.ok) return NextResponse.json({ error: out.error }, { status: 403 });
  return NextResponse.json({ member: out.row });
}
