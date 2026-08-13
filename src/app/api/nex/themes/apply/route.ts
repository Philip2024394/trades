// POST /api/nex/themes/apply · validate + apply a theme for this session
// Philip 2026-08-03 · Theme Engine v1.
//
// Composition:
//   · Composes with THEME OBJECT STORAGE — theme_id must resolve in the registry
//   · Composes with THEMES MUST NEVER REDUCE USABILITY — validator gate FIRST
//   · Composes with SIX SHARPENING RULES — ownership + preview eligibility
//   · Composes with FIFTH LAW (Completion) — the swap actually happens · not just described
//
// Behaviour:
//   · If the theme is Original Nex (immutable home), always allow.
//   · If the theme is owned OR the session has an active preview for it, allow.
//   · Otherwise: refuse with reason="not_licensed" — the client should
//     redirect the user to /api/nex/themes/preview to start a 24h preview.

import { NextResponse } from "next/server";
import {
  applyThemeForSession,
  getActivePreviewForSession,
  listOwnershipForSession,
} from "@/lib/nex/themes/server-repo";
import { isImmutableTheme } from "@/lib/nex/themes/registry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function readSessionId(req: Request): string | null {
  const raw = req.headers.get("x-nex-session-id");
  if (!raw) return null;
  const trimmed = raw.trim();
  if (trimmed.length < 8 || trimmed.length > 128) return null;
  return trimmed;
}

type ApplyBody = {
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
  let body: ApplyBody;
  try {
    body = (await req.json()) as ApplyBody;
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
    // Licensing gate. Original Nex is universal; other themes need
    // ownership OR an active preview matching the theme_id.
    if (!isImmutableTheme(themeId)) {
      const [owned, preview] = await Promise.all([
        listOwnershipForSession(sessionId),
        getActivePreviewForSession(sessionId),
      ]);
      const isOwned = owned.some((o) => o.theme_id === themeId);
      const hasPreview = preview?.theme_id === themeId;
      if (!isOwned && !hasPreview) {
        return NextResponse.json(
          {
            ok: false,
            error: "not_licensed",
            message:
              "This theme isn't yet in your library. Start a 24-hour preview to try it, or unlock it permanently.",
          },
          { status: 402 },
        );
      }
    }

    const result = await applyThemeForSession(sessionId, themeId, {
      variantId,
      source: "user_choice",
    });

    if (!result.ok) {
      const status = result.reason === "validator_failed" ? 422 : 400;
      return NextResponse.json(
        {
          ok: false,
          error: result.reason,
          validator: result.validator,
        },
        { status },
      );
    }

    return NextResponse.json({
      ok: true,
      active: result.active,
      theme: result.theme,
      validator: result.validator,
    });
  } catch (err) {
    console.error("[nex-themes][apply][POST]", err);
    return NextResponse.json(
      { ok: false, error: "apply_failed" },
      { status: 500 },
    );
  }
}
