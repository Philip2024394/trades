// src/app/api/nex/user/memory/[memory_id]/route.ts
//
// Founder Phase 10 · P10-4 · Memory transparency · single-memory delete.

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

export async function DELETE(req: Request, ctx: { params: Promise<{ memory_id: string }> }) {
  const params = await ctx.params;
  const memory_id = params?.memory_id ? decodeURIComponent(params.memory_id) : "";
  const token = extractCookie(req, sessionCookieName());
  const sess = await resolveSession(token);
  if (!sess?.user_id) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  if (!memory_id) return NextResponse.json({ error: "memory_id_required" }, { status: 400 });
  try {
    const store = makePostgresMemoryStore();
    await store.deleteMemory(sess.user_id, memory_id);
    return NextResponse.json({ ok: true, memory_id, user_id: sess.user_id });
  } catch (e) {
    return NextResponse.json({
      error: "memory_delete_error",
      detail: e instanceof Error ? e.message.slice(0, 200) : "unknown",
    }, { status: 500 });
  }
}
