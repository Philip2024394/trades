// src/app/api/nex/user/export/route.ts
//
// Founder Phase 10 · P10-4 · GDPR-style right-to-know export.
// GET returns everything NEX has about the current user as JSON.

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
  if (!sess?.user_id) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  try {
    const store = makePostgresMemoryStore();
    const profile = await store.loadProfile(sess.user_id);
    return NextResponse.json({
      exported_at: new Date().toISOString(),
      user_id: sess.user_id,
      account: sess.account,
      profile,
      note: "Complete right-to-know export. Doctrine #4: MEMORY INFORMS CONTEXT · MEMORY DOES NOT ESTABLISH TRUTH.",
    });
  } catch (e) {
    return NextResponse.json({
      error: "export_error",
      detail: e instanceof Error ? e.message.slice(0, 200) : "unknown",
    }, { status: 500 });
  }
}
