// POST /api/homeowner/home-care — homeowner creates a maintenance reminder.
//
// Body: { title, kind?, cadenceDays?, description? }
// Auth: homeowner cookie only.

import { NextResponse } from "next/server";
import { getHomeownerFromCookie } from "@/lib/homeowners/auth";
import { createHomeCareItem, type HomeCareKind } from "@/lib/homeowners/homeCare";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const homeowner = await getHomeownerFromCookie();
  if (!homeowner) return NextResponse.json({ ok: false, error: "not-authed" }, { status: 401 });

  const body = await req.json().catch(() => null) as {
    title?:        string;
    kind?:         HomeCareKind;
    cadenceDays?:  number;
    description?:  string;
  } | null;
  if (!body?.title) return NextResponse.json({ ok: false, error: "missing-title" }, { status: 400 });

  const res = await createHomeCareItem({
    homeownerId:  homeowner.id,
    title:        body.title,
    kind:         body.kind,
    cadenceDays:  body.cadenceDays,
    description:  body.description ?? null
  });
  if (!res.ok) return NextResponse.json({ ok: false, error: res.error }, { status: 400 });
  return NextResponse.json({ ok: true, id: res.item.id });
}
