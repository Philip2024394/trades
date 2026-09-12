// src/app/api/nex/enterprise/teams/route.ts
//
// Founder Phase 16 · P16-3 · List / create teams.

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { resolveSession } from "@/lib/nex/identity-auth";
import { createTeam, listTeamsForUser } from "@/lib/nex/enterprise";

export const runtime = "nodejs";

export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get("nex_session")?.value ?? null;
  const session = await resolveSession(token);
  if (!session?.user_id) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const teams = await listTeamsForUser(session.user_id);
  return NextResponse.json({ teams });
}

export async function POST(req: Request) {
  const cookieStore = await cookies();
  const token = cookieStore.get("nex_session")?.value ?? null;
  const session = await resolveSession(token);
  if (!session?.user_id) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  let body: Record<string, unknown> = {};
  try { body = (await req.json()) as Record<string, unknown>; } catch { /* empty body */ }
  const name = typeof body.name === "string" && body.name.trim() ? body.name.trim() : "";
  if (!name) return NextResponse.json({ error: "missing_name" }, { status: 400 });
  const tier = ["starter", "pro", "enterprise"].includes(body.tier as string)
    ? (body.tier as "starter" | "pro" | "enterprise")
    : "starter";
  const team = await createTeam({ name, created_by: session.user_id, tier });
  return NextResponse.json({ team });
}
