// POST /api/affiliates/social-links — add a social link to the
// affiliate's saved list.
import { NextResponse, type NextRequest } from "next/server";
import { readAffiliateSession } from "@/lib/affiliateSession";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

const ALLOWED_PLATFORMS = new Set([
  "facebook",
  "instagram",
  "tiktok",
  "youtube",
  "linkedin",
  "pinterest",
  "x",
  "website",
  "other"
]);

export async function POST(req: NextRequest): Promise<NextResponse> {
  const session = readAffiliateSession(req);
  if (!session) {
    return NextResponse.json(
      { ok: false, error: "Not authenticated" },
      { status: 401 }
    );
  }
  let body: { platform?: unknown; url?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON" },
      { status: 400 }
    );
  }
  const platform = typeof body.platform === "string" ? body.platform : "";
  const url = typeof body.url === "string" ? body.url.trim() : "";
  if (!ALLOWED_PLATFORMS.has(platform)) {
    return NextResponse.json(
      { ok: false, error: "Unknown platform." },
      { status: 400 }
    );
  }
  if (!url || !/^https?:\/\//i.test(url)) {
    return NextResponse.json(
      { ok: false, error: "URL must start with http:// or https://" },
      { status: 400 }
    );
  }

  const insert = await supabaseAdmin
    .from("hammerex_affiliate_social_links")
    .insert({
      affiliate_id: session.affiliate_id,
      platform,
      url: url.slice(0, 500),
      status: "active"
    })
    .select("id, platform, url, status, last_checked_at, created_at")
    .maybeSingle();

  if (insert.error || !insert.data) {
    return NextResponse.json(
      { ok: false, error: insert.error?.message ?? "Could not save." },
      { status: 500 }
    );
  }

  await supabaseAdmin.from("hammerex_affiliate_audit_log").insert({
    actor_type: "affiliate",
    actor_id: String(session.affiliate_id),
    action: "social_link.add",
    target_id: insert.data.id,
    details: { platform, url }
  });

  return NextResponse.json({ ok: true, link: insert.data });
}
