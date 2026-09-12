// src/app/api/nex/user/memory/list/route.ts
//
// Founder Phase 10 · P10-4 · Memory transparency · list.
// GET returns every memory NEX has about the current user.
// The visible differentiator vs ChatGPT: you can SEE it.

import { NextResponse } from "next/server";
import { resolveSession, sessionCookieName } from "@/lib/nex/identity-auth";
import { makePostgresMemoryStore } from "@/lib/nex/live-chat-completion/memory/postgres-store";

export const runtime = "nodejs";

function extractCookie(req: Request, name: string): string | null {
  const cookieHeader = req.headers.get("cookie") ?? "";
  for (const p of cookieHeader.split(/;\s*/)) {
    const idx = p.indexOf("=");
    if (idx > 0 && p.slice(0, idx) === name) return decodeURIComponent(p.slice(idx + 1));
  }
  return null;
}

export async function GET(req: Request) {
  const token = extractCookie(req, sessionCookieName());
  const sess = await resolveSession(token);
  if (!sess?.user_id) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  const store = makePostgresMemoryStore();
  try {
    const memories = await store.listMemories(sess.user_id, { limit: 200 });
    return NextResponse.json({
      user_id: sess.user_id,
      count: memories.length,
      memories,
      note: "Doctrine #4: MEMORY INFORMS CONTEXT · MEMORY DOES NOT ESTABLISH TRUTH. "
        + "You can delete any memory below via DELETE /api/nex/user/memory/[memory_id].",
    });
  } catch (e) {
    return NextResponse.json({
      error: "memory_list_error",
      detail: e instanceof Error ? e.message.slice(0, 200) : "unknown",
    }, { status: 500 });
  }
}
