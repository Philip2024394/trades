// src/app/api/nex/conversations/search/route.ts
//
// Founder Phase 13 · P13-2 · Full-text search across the user's conversations.
// GET ?q=... [&limit=N]

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { resolveSession } from "@/lib/nex/identity-auth";
import { searchConversations } from "@/lib/nex/conversations";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const cookieStore = await cookies();
  const token = cookieStore.get("nex_session")?.value ?? null;
  const session = await resolveSession(token);
  if (!session?.user_id) {
    return NextResponse.json({ authenticated: false, results: [] }, { status: 200 });
  }
  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  const limit = Math.max(1, Math.min(50, Number(url.searchParams.get("limit") ?? 20)));
  if (!q) return NextResponse.json({ authenticated: true, results: [] });
  const results = await searchConversations(session.user_id, q, limit);
  return NextResponse.json({ authenticated: true, query: q, results });
}
