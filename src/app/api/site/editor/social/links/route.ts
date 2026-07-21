// GET  /api/site/editor/social/links  — return the caller's saved
//                                        Instagram / Facebook / TikTok /
//                                        Snapchat profile URLs.
// POST /api/site/editor/social/links  — upsert one or more of those URLs.
//
// Same URLs render on the merchant's canteen / tradesite (paid tiers)
// as their public social handles, so one edit here syncs both surfaces.
//
// Auth: signed-in merchant only. Body accepts partial updates —
// callers can send { instagram } to change just IG without clearing
// the others.

import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getMerchantSlug } from "@/lib/merchantSession";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Very light URL sanitisation — accept:
 *   1. bare handles ("@myshop", "myshop")
 *   2. profile URLs from any platform
 *  Reject anything with a JS injection surface. Returns null when
 *  the value is empty or invalid. Not aggressive because the URLs
 *  are user-supplied trade profiles, not user-generated content
 *  displayed to strangers. */
function sanitise(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const t = input.trim().slice(0, 300);
  if (!t) return null;
  if (/[<>"'`\\]/.test(t))     return null;         // no HTML / shell
  if (/^\s*javascript:/i.test(t)) return null;      // no js: scheme
  return t;
}

export async function GET(): Promise<NextResponse> {
  const merchantSlug = await getMerchantSlug();
  if (!merchantSlug) {
    return NextResponse.json({ ok: false, error: "not_authenticated" }, { status: 401 });
  }
  const res = await supabaseAdmin
    .from("hammerex_trade_off_listings")
    .select("instagram, facebook, tiktok, snapchat")
    .eq("slug", merchantSlug)
    .maybeSingle();
  if (res.error || !res.data) {
    return NextResponse.json({ ok: false, error: "listing_not_found" }, { status: 404 });
  }
  return NextResponse.json({
    ok:    true,
    links: {
      instagram: (res.data.instagram as string | null) ?? "",
      facebook:  (res.data.facebook  as string | null) ?? "",
      tiktok:    (res.data.tiktok    as string | null) ?? "",
      snapchat:  (res.data.snapchat  as string | null) ?? ""
    }
  });
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const merchantSlug = await getMerchantSlug();
  if (!merchantSlug) {
    return NextResponse.json({ ok: false, error: "not_authenticated" }, { status: 401 });
  }
  let body: { instagram?: unknown; facebook?: unknown; tiktok?: unknown; snapchat?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  // Build a partial update — only include keys the caller actually
  // sent, so { instagram: "…" } doesn't null out facebook.
  const patch: Record<string, string | null> = {};
  if ("instagram" in body) patch.instagram = sanitise(body.instagram);
  if ("facebook"  in body) patch.facebook  = sanitise(body.facebook);
  if ("tiktok"    in body) patch.tiktok    = sanitise(body.tiktok);
  if ("snapchat"  in body) patch.snapchat  = sanitise(body.snapchat);

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ ok: false, error: "nothing_to_update" }, { status: 400 });
  }

  const upd = await supabaseAdmin
    .from("hammerex_trade_off_listings")
    .update(patch)
    .eq("slug", merchantSlug)
    .select("instagram, facebook, tiktok, snapchat")
    .maybeSingle();
  if (upd.error || !upd.data) {
    return NextResponse.json({ ok: false, error: "update_failed" }, { status: 500 });
  }

  return NextResponse.json({
    ok:    true,
    links: {
      instagram: (upd.data.instagram as string | null) ?? "",
      facebook:  (upd.data.facebook  as string | null) ?? "",
      tiktok:    (upd.data.tiktok    as string | null) ?? "",
      snapchat:  (upd.data.snapchat  as string | null) ?? ""
    }
  });
}
