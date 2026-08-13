// GET /api/nex/themes · list built-in themes merged with session state
// Philip 2026-08-03 · Theme Engine v1 · Supabase-backed.
//
// Returns the full catalog for the current session:
//   · theme         — canonical v2 Theme (5 layers · capabilities · design language)
//   · owned         — true if the session owns this theme (built-ins are all "owned")
//   · isActive      — true if this is the currently applied theme
//   · hasActivePreview — true if this session is inside a live 24h preview
//   · previewExpiresAt — ISO timestamp when the preview ends
//
// Client-side consumers use this endpoint to render the Saved Themes
// list, the Theme Gallery, and to hydrate the applied theme on load.
// v1 uses session_id from the x-nex-session-id header.

import { NextResponse } from "next/server";
import { listCatalogForSession } from "@/lib/nex/themes/server-repo";

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
    const catalog = await listCatalogForSession(sessionId);
    return NextResponse.json({ ok: true, catalog });
  } catch (err) {
    console.error("[nex-themes][GET]", err);
    const detail =
      process.env.NODE_ENV !== "production" && err instanceof Error
        ? err.message
        : undefined;
    return NextResponse.json(
      { ok: false, error: "list_failed", detail },
      { status: 500 },
    );
  }
}
