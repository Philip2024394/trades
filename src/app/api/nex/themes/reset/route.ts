// POST /api/nex/themes/reset · return to LAST PERMANENT theme
// Philip 2026-08-03 · Six Sharpening Rules #5 (Restore behaviour).
//
// Returns the session to the last theme the user actually OWNED (never
// a preview). If they've never owned anything, this lands on Original
// Nex — the immutable home.

import { NextResponse } from "next/server";
import { resetThemeForSession } from "@/lib/nex/themes/server-repo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function readSessionId(req: Request): string | null {
  const raw = req.headers.get("x-nex-session-id");
  if (!raw) return null;
  const trimmed = raw.trim();
  if (trimmed.length < 8 || trimmed.length > 128) return null;
  return trimmed;
}

export async function POST(req: Request) {
  const sessionId = readSessionId(req);
  if (!sessionId) {
    return NextResponse.json(
      { ok: false, error: "session_id_required" },
      { status: 400 },
    );
  }
  try {
    const result = await resetThemeForSession(sessionId);
    return NextResponse.json({
      ok: true,
      active: result.active,
      theme: result.theme,
    });
  } catch (err) {
    console.error("[nex-themes][reset][POST]", err);
    return NextResponse.json(
      { ok: false, error: "reset_failed" },
      { status: 500 },
    );
  }
}
