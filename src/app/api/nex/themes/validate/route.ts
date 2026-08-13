// POST /api/nex/themes/validate · dry-run the theme validator
// Philip 2026-08-03 · Refinement 5 in executable form.
//
// Two modes:
//   1. theme_id  — validate a built-in theme (developer / QA use)
//   2. theme     — validate an ad-hoc theme object (for the AI Theme
//                  Engine · community-published themes · business themes)
//
// Never persists. Never applies. Pure validation report so the caller
// can decide whether the theme is safe to save/apply.

import { NextResponse } from "next/server";
import { getBuiltInTheme } from "@/lib/nex/themes/registry";
import { validateTheme } from "@/lib/nex/themes/validator";
import type { Theme } from "@/lib/nex/themes/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ValidateBody = {
  theme_id?: string;
  theme?: Theme;
};

export async function POST(req: Request) {
  let body: ValidateBody;
  try {
    body = (await req.json()) as ValidateBody;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  let theme: Theme | null = null;
  if (body.theme_id) {
    theme = getBuiltInTheme(body.theme_id.trim());
    if (!theme) {
      return NextResponse.json(
        { ok: false, error: "unknown_theme" },
        { status: 404 },
      );
    }
  } else if (body.theme && typeof body.theme === "object") {
    theme = body.theme;
  } else {
    return NextResponse.json(
      { ok: false, error: "theme_or_theme_id_required" },
      { status: 400 },
    );
  }

  try {
    const report = validateTheme(theme);
    return NextResponse.json({ ok: true, report });
  } catch (err) {
    console.error("[nex-themes][validate][POST]", err);
    return NextResponse.json(
      { ok: false, error: "validate_failed" },
      { status: 500 },
    );
  }
}
