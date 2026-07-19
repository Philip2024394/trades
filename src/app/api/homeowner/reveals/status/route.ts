// GET /api/homeowner/reveals/status — current reveal-credit balance.
// Used by the SiteBook usage card to show "X reveals left this month
// · Y from packs" without a full page reload after a WA send.

import { NextResponse } from "next/server";
import { getHomeownerFromCookie } from "@/lib/homeowners/auth";
import { getQuota } from "@/lib/homeowners/revealCredits";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const homeowner = await getHomeownerFromCookie();
  if (!homeowner) return NextResponse.json({ ok: false, error: "not-authed" }, { status: 401 });

  const q = await getQuota(homeowner.id);
  if (!q.ok) return NextResponse.json({ ok: false, error: q.error }, { status: 400 });

  return NextResponse.json({ ok: true, quota: q.quota });
}
