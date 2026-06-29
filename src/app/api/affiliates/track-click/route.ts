// POST /api/affiliates/track-click
//
// Fire-and-forget click logger. The middleware calls this when it spots
// a fresh ?ref= or refreshes an existing affiliate cookie. We accept
// the payload, validate the affiliate exists + is active, and insert
// a row into hammerex_affiliate_clicks. Failures are swallowed (never
// blocks the user request).
import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

function parseDeviceBrowser(ua: string): { device: string; browser: string } {
  const u = ua.toLowerCase();
  let device = "desktop";
  if (/ipad|tablet/.test(u)) device = "tablet";
  else if (/mobile|android|iphone/.test(u)) device = "mobile";
  let browser = "other";
  if (u.includes("edg/")) browser = "edge";
  else if (u.includes("chrome/") && !u.includes("edg/")) browser = "chrome";
  else if (u.includes("firefox/")) browser = "firefox";
  else if (u.includes("safari/") && !u.includes("chrome/")) browser = "safari";
  return { device, browser };
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: {
    affiliate_id?: unknown;
    landing_page?: unknown;
    referrer_url?: unknown;
    country?: unknown;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false }, { status: 200 });
  }

  const id =
    typeof body.affiliate_id === "number"
      ? Math.floor(body.affiliate_id)
      : Number(body.affiliate_id);
  if (!Number.isFinite(id) || id <= 0) {
    return NextResponse.json({ ok: false }, { status: 200 });
  }

  // Verify the affiliate exists + is active. Bad refs silently no-op so
  // an attacker can't pollute the clicks table with garbage IDs.
  const aff = await supabaseAdmin
    .from("hammerex_affiliates")
    .select("affiliate_id, status")
    .eq("affiliate_id", id)
    .maybeSingle();
  if (!aff.data || aff.data.status !== "active") {
    return NextResponse.json({ ok: true });
  }

  const ipHeader =
    req.headers.get("x-forwarded-for") ?? req.headers.get("x-real-ip") ?? "";
  const ip = ipHeader.split(",")[0]?.trim() || null;
  const country =
    (typeof body.country === "string" && body.country) ||
    req.headers.get("cf-ipcountry") ||
    req.headers.get("x-vercel-ip-country") ||
    null;
  const ua = req.headers.get("user-agent") ?? "";
  const { device, browser } = parseDeviceBrowser(ua);
  const landing =
    typeof body.landing_page === "string" ? body.landing_page.slice(0, 500) : null;
  const referrer =
    typeof body.referrer_url === "string"
      ? body.referrer_url.slice(0, 500)
      : null;

  const expiresAt = new Date(
    Date.now() + 30 * 24 * 60 * 60 * 1000
  ).toISOString();

  await supabaseAdmin.from("hammerex_affiliate_clicks").insert({
    affiliate_id: id,
    ip,
    country,
    device,
    browser,
    landing_page: landing,
    referrer_url: referrer,
    cookie_expires_at: expiresAt
  });

  return NextResponse.json({ ok: true });
}
