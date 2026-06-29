// GET /api/affiliates/marketing-download?asset_id=<uuid>
//
// Logs a per-affiliate download row and 302-redirects to the actual
// public Supabase Storage URL. Requires an authenticated affiliate
// session; without one we 401.
//
// We deliberately do NOT try to watermark images here — see the
// affiliate dashboard copy: assets are ready-to-post; affiliates add
// their referral URL in the caption. The personalised "stamp" is the
// QR code generator (which uses the affiliate's referral URL as data).
import { NextResponse, type NextRequest } from "next/server";
import { readAffiliateSession } from "@/lib/affiliateSession";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { LEVEL_ORDER, type AffiliateLevel } from "@/lib/affiliateLevel";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const session = readAffiliateSession(req);
  if (!session) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 401 });
  }
  const url = new URL(req.url);
  const assetId = url.searchParams.get("asset_id") ?? "";
  if (!assetId) {
    return NextResponse.json(
      { ok: false, error: "Missing asset_id" },
      { status: 400 }
    );
  }
  const { data: asset } = await supabaseAdmin
    .from("hammerex_affiliate_marketing_assets")
    .select("file_url, required_level")
    .eq("id", assetId)
    .maybeSingle();
  if (!asset?.file_url) {
    return NextResponse.json(
      { ok: false, error: "Asset not found" },
      { status: 404 }
    );
  }

  // Level-gate enforcement (server-side check on top of the UI hide).
  const requiredLevel = (asset.required_level ?? "bronze") as AffiliateLevel;
  if (requiredLevel !== "bronze") {
    const { data: aff } = await supabaseAdmin
      .from("hammerex_affiliates")
      .select("level")
      .eq("affiliate_id", session.affiliate_id)
      .maybeSingle();
    const affLevel = (aff?.level ?? "bronze") as AffiliateLevel;
    if (LEVEL_ORDER.indexOf(affLevel) < LEVEL_ORDER.indexOf(requiredLevel)) {
      return NextResponse.json(
        { ok: false, error: `Requires ${requiredLevel} level.` },
        { status: 403 }
      );
    }
  }

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    null;

  // Best-effort log — never block the download on log failure.
  await supabaseAdmin
    .from("hammerex_affiliate_marketing_downloads")
    .insert({
      asset_id: assetId,
      affiliate_id: session.affiliate_id,
      ip
    });

  return NextResponse.redirect(asset.file_url, 302);
}
