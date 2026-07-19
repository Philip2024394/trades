// POST /api/homeowner/invitations — owner creates a trade/supplier
// invitation. Debits 1 washer, returns the wa.me URL for the client
// to window.open(). Rejects unauthed callers.
//
// Body: { tradeListingId: string, projectIds: string[] }
// Response: { ok: true, waUrl, invitationId, projectTitles } | { ok: false, error }

import { NextResponse } from "next/server";
import { getHomeownerFromCookie } from "@/lib/homeowners/auth";
import { createInvitation } from "@/lib/homeowners/invitations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const homeowner = await getHomeownerFromCookie();
  if (!homeowner) return NextResponse.json({ ok: false, error: "not-authed" }, { status: 401 });

  const body = await req.json().catch(() => null) as {
    tradeListingId?: string;
    tradeSlug?:      string;
    projectIds?:     string[];
  } | null;
  if (!body?.tradeListingId && !body?.tradeSlug) return NextResponse.json({ ok: false, error: "missing-trade" }, { status: 400 });
  if (!Array.isArray(body.projectIds))           return NextResponse.json({ ok: false, error: "missing-projects" }, { status: 400 });
  if (body.projectIds.length === 0)              return NextResponse.json({ ok: false, error: "no-projects-selected" }, { status: 400 });

  const res = await createInvitation({
    homeownerId:        homeowner.id,
    homeownerFirstName: homeowner.first_name,
    siteBookNickname:   homeowner.house_nickname,
    siteBookCity:       homeowner.city,
    tradeListingId:     body.tradeListingId,
    tradeSlug:          body.tradeSlug,
    projectIds:         body.projectIds
  });
  if (!res.ok) {
    const status = res.error === "quota-exceeded" ? 402 : 400;
    return NextResponse.json({ ok: false, error: res.error }, { status });
  }
  return NextResponse.json({
    ok:            true,
    waUrl:         res.waUrl,
    invitationId:  res.invitation.id,
    projectTitles: res.projectTitles
  });
}
