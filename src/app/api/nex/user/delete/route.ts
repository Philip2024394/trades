// src/app/api/nex/user/delete/route.ts
//
// Founder Phase 10 · P10-4 · GDPR-style right-to-delete.
// POST cascades account · memories · sessions · profile custom_instructions.

import { NextResponse } from "next/server";
import { deleteAccount, resolveSession, sessionCookieName } from "@/lib/nex/identity-auth";

export const runtime = "nodejs";

function extractCookie(req: Request, name: string): string | null {
  const cookieHeader = req.headers.get("cookie") ?? "";
  for (const p of cookieHeader.split(/;\s*/)) {
    const idx = p.indexOf("=");
    if (idx > 0 && p.slice(0, idx) === name) return decodeURIComponent(p.slice(idx + 1));
  }
  return null;
}

export async function POST(req: Request) {
  const token = extractCookie(req, sessionCookieName());
  const sess = await resolveSession(token);
  if (!sess?.user_id) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  try {
    await deleteAccount(sess.user_id);
    const res = NextResponse.json({ ok: true, user_id: sess.user_id, deleted_at: new Date().toISOString() });
    res.cookies.set(sessionCookieName(), "", { path: "/", expires: new Date(0) });
    return res;
  } catch (e) {
    return NextResponse.json({
      error: "delete_error",
      detail: e instanceof Error ? e.message.slice(0, 200) : "unknown",
    }, { status: 500 });
  }
}
