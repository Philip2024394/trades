// src/app/api/nex/conversations/[id]/branch/route.ts
//
// Founder Phase 13 · P13-3 · Fork a conversation at any prior message.
// POST { from_message_id } → new conversation containing messages 0..N inclusive.

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { resolveSession } from "@/lib/nex/identity-auth";
import { branchConversation } from "@/lib/nex/conversations";

export const runtime = "nodejs";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const cookieStore = await cookies();
  const token = cookieStore.get("nex_session")?.value ?? null;
  const session = await resolveSession(token);

  let body: Record<string, unknown> = {};
  try { body = (await req.json()) as Record<string, unknown>; } catch { /* empty body */ }
  const from_message_id = body.from_message_id as string;
  if (typeof from_message_id !== "string" || !from_message_id) {
    return NextResponse.json({ error: "missing_from_message_id" }, { status: 400 });
  }

  const branched = await branchConversation(id, from_message_id, session?.user_id ?? null);
  if (!branched) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ conversation: branched });
}
