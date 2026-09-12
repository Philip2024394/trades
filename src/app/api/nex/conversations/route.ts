// src/app/api/nex/conversations/route.ts
//
// Founder Phase 13 · P13-2 · List / create conversations.
//
// GET   ?limit=N       · list conversations for authenticated user
// POST  { title? }     · create empty conversation

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { resolveSession } from "@/lib/nex/identity-auth";
import { createConversation, listConversations } from "@/lib/nex/conversations";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const cookieStore = await cookies();
  const token = cookieStore.get("nex_session")?.value ?? null;
  const session = await resolveSession(token);
  if (!session?.user_id) {
    return NextResponse.json({ authenticated: false, conversations: [] }, { status: 200 });
  }
  const url = new URL(req.url);
  const limit = Math.max(1, Math.min(200, Number(url.searchParams.get("limit") ?? 50)));
  const conversations = await listConversations(session.user_id, limit);
  return NextResponse.json({ authenticated: true, user_id: session.user_id, conversations });
}

export async function POST(req: Request) {
  const cookieStore = await cookies();
  const token = cookieStore.get("nex_session")?.value ?? null;
  const session = await resolveSession(token);
  let body: Record<string, unknown> = {};
  try { body = (await req.json()) as Record<string, unknown>; } catch { /* empty body */ }
  const title = typeof body.title === "string" ? body.title.slice(0, 200) : undefined;
  const conv = await createConversation({
    user_id: session?.user_id ?? null,
    title,
  });
  if (!conv) return NextResponse.json({ error: "persistence_unavailable" }, { status: 503 });
  return NextResponse.json({ conversation: conv });
}
