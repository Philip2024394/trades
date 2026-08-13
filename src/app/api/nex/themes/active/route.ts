// GET /api/nex/themes/active · read current applied theme + variant
// Philip 2026-08-03.

import { NextResponse } from "next/server";
import { getActiveThemeForSession } from "@/lib/nex/themes/server-repo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function readSessionId(req: Request): string | null {
  const raw = req.headers.get("x-nex-session-id");
  if (!raw) return null;
  const trimmed = raw.trim();
  if (trimmed.length < 8 || trimmed.length > 128) return null;
  return trimmed;
}

export async function GET(req: Request) {
  const sessionId = readSessionId(req);
  if (!sessionId) {
    return NextResponse.json(
      { ok: false, error: "session_id_required" },
      { status: 400 },
    );
  }
  try {
    const result = await getActiveThemeForSession(sessionId);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("[nex-themes][active][GET]", err);
    return NextResponse.json(
      { ok: false, error: "active_read_failed" },
      { status: 500 },
    );
  }
}
