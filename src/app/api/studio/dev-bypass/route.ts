// GET /api/studio/dev-bypass?slug=<optional>
//
// DEV-ONLY: skip the magic-link step and sign in as a specific merchant.
// Refuses hard in production. The Studio sign-in screen only surfaces
// the bypass link when NODE_ENV !== "production", but the server also
// enforces here so a stray link on a prod deployment does nothing.
//
// Merchant resolution priority:
//   1. ?slug=<slug> from the query string (explicit)
//   2. process.env.DEV_STUDIO_SLUG (per-machine default)
//   3. first live listing whose slug starts with "demo-" (fallback)
//
// On success we set the same studio_session cookie the magic-link
// flow sets and 303 to /studio/home. The cookie is HttpOnly, sameSite
// lax, 30-day lifetime — matches loadStudioSession().

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { setStudioSession } from "@/lib/studio/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { ok: false, error: "dev-bypass-disabled-in-production" },
      { status: 403 }
    );
  }

  const url = new URL(req.url);
  const requestedSlug = (url.searchParams.get("slug") ?? "").trim();
  const envSlug = (process.env.DEV_STUDIO_SLUG ?? "").trim();

  // Try each candidate slug in order until we find a listing with an
  // edit_token.
  const candidates = [requestedSlug, envSlug].filter(Boolean);

  let editToken: string | null = null;
  let resolvedSlug: string | null = null;

  for (const slug of candidates) {
    const res = await supabaseAdmin
      .from("hammerex_trade_off_listings")
      .select("slug, edit_token, status")
      .eq("slug", slug)
      .maybeSingle();
    if (res.data?.edit_token) {
      editToken = res.data.edit_token as string;
      resolvedSlug = res.data.slug as string;
      break;
    }
  }

  // Fallback: first live demo-prefixed listing.
  if (!editToken) {
    const fallback = await supabaseAdmin
      .from("hammerex_trade_off_listings")
      .select("slug, edit_token")
      .like("slug", "demo-%")
      .eq("status", "live")
      .not("edit_token", "is", null)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (fallback.data?.edit_token) {
      editToken = fallback.data.edit_token as string;
      resolvedSlug = fallback.data.slug as string;
    }
  }

  if (!editToken) {
    return NextResponse.json(
      {
        ok: false,
        error: "no-merchant-found",
        hint:
          "Pass ?slug=<merchant-slug>, set DEV_STUDIO_SLUG in .env.local, or seed at least one live demo- merchant."
      },
      { status: 404 }
    );
  }

  await setStudioSession(editToken);

  const target = new URL("/studio/home", url.origin);
  target.searchParams.set("dev_bypass", "1");
  target.searchParams.set("slug", resolvedSlug ?? "");
  return NextResponse.redirect(target, 303);
}
