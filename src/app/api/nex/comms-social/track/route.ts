// GET /api/nex/comms-social/track?to=<url>&post=<post_id>&platform=<plat>
//
// Merchant links land here via UTM redirect · we record a canonical
// analytics_event (event_type='clicked' · provider='social:<platform>')
// and redirect to `to`. `to` is required · must be http(s) · we do not
// blindly redirect to arbitrary schemes.

import { NextResponse } from "next/server";
import { withClient } from "@/lib/nex/db";
import { recordSocialClick } from "@/lib/nex/comms-social/analytics/publish-audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const to       = url.searchParams.get("to");
  const post     = url.searchParams.get("post") ?? url.searchParams.get("utm_campaign") ?? "";
  const platform = url.searchParams.get("platform") ?? url.searchParams.get("utm_medium") ?? "unknown";
  const variant  = url.searchParams.get("variant") ?? url.searchParams.get("utm_content") ?? undefined;
  if (!to) return NextResponse.json({ ok: false, error: "to required" }, { status: 400 });
  let target: URL;
  try { target = new URL(to); }
  catch { return NextResponse.json({ ok: false, error: "to must be a valid URL" }, { status: 400 }); }
  if (target.protocol !== "http:" && target.protocol !== "https:") {
    return NextResponse.json({ ok: false, error: "to must be http or https" }, { status: 400 });
  }

  await withClient(async (c) => {
    await c.query("BEGIN");
    try {
      await c.query("SET LOCAL ROLE nex_social_app");
      // analytics_events has no RLS · public insert path (mirrors delivery pattern)
      await recordSocialClick({
        client: c,
        platform,
        post_id: post,
        variant,
        link_url: target.toString(),
        user_agent: request.headers.get("user-agent") ?? undefined,
        ip:         request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? undefined,
      });
      await c.query("COMMIT");
    } catch (e) { await c.query("ROLLBACK"); throw e; }
  });

  return NextResponse.redirect(target.toString(), 302);
}
