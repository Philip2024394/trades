// POST /api/nex/themes/preview · start a 24-hour preview
// GET /api/nex/themes/preview  · read active preview (if any)
// Philip 2026-08-03 · Theme Engine v1 · Six Sharpening Rules #4.
//
// Behaviour:
//   · Duration: 24 wall-clock hours (not calendar days)
//   · Concurrency: ONE active preview at a time. Starting a new one
//     ENDS the existing preview with outcome=explored_another
//   · Offline expiry: if the preview clock has already passed, the
//     applied theme stays visible until the next connected session ·
//     the polite expiry prompt fires there (client behaviour)
//   · Ownership fast-path: if the theme is already owned, we skip the
//     preview and return reason="already_owned" so the client can apply
//     directly via /api/nex/themes/apply

import { NextResponse } from "next/server";
import {
  getActivePreviewForSession,
  grantPreviewForSession,
} from "@/lib/nex/themes/server-repo";

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
    const preview = await getActivePreviewForSession(sessionId);
    return NextResponse.json({ ok: true, preview });
  } catch (err) {
    console.error("[nex-themes][preview][GET]", err);
    return NextResponse.json(
      { ok: false, error: "preview_read_failed" },
      { status: 500 },
    );
  }
}

type PreviewBody = {
  theme_id?: string;
  variant_id?: string;
};

export async function POST(req: Request) {
  const sessionId = readSessionId(req);
  if (!sessionId) {
    return NextResponse.json(
      { ok: false, error: "session_id_required" },
      { status: 400 },
    );
  }
  let body: PreviewBody;
  try {
    body = (await req.json()) as PreviewBody;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }
  const themeId = body.theme_id?.trim();
  if (!themeId) {
    return NextResponse.json(
      { ok: false, error: "theme_id_required" },
      { status: 400 },
    );
  }
  const variantId = body.variant_id?.trim() || undefined;

  try {
    const result = await grantPreviewForSession(sessionId, themeId, variantId);
    if (!result.ok) {
      const status =
        result.reason === "unknown_theme"
          ? 404
          : result.reason === "already_owned"
          ? 409
          : 400;
      return NextResponse.json(
        { ok: false, error: result.reason },
        { status },
      );
    }
    return NextResponse.json({
      ok: true,
      preview: result.preview,
      active: result.active,
      theme: result.theme,
      ended: result.ended,
    });
  } catch (err) {
    console.error("[nex-themes][preview][POST]", err);
    return NextResponse.json(
      { ok: false, error: "preview_grant_failed" },
      { status: 500 },
    );
  }
}
