// GET /api/nex-coding-chat/history?session_id=... → single-session transcript
// GET /api/nex-coding-chat/history                 → list of sessions

import { NextResponse } from "next/server";
import { listSessions, loadSession } from "@/lib/nex-coding-chat/memory";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const session_id = (url.searchParams.get("session_id") ?? "").trim();
  if (session_id) {
    const s = loadSession(session_id);
    if (!s) return NextResponse.json({ ok: false, error: "session not found" }, { status: 404 });
    return NextResponse.json({ ok: true, session: s });
  }
  return NextResponse.json({ ok: true, sessions: listSessions(50) });
}
