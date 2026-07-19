// POST /api/homeowner/things-to-fix — homeowner logs a snag.
//
// Body: { title, projectId?, photoUrl?, assigneeListingId?, assigneeName?, postId? }
// Auth: homeowner cookie only.

import { NextResponse } from "next/server";
import { getHomeownerFromCookie } from "@/lib/homeowners/auth";
import { createThingToFix } from "@/lib/homeowners/thingsToFix";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const homeowner = await getHomeownerFromCookie();
  if (!homeowner) return NextResponse.json({ ok: false, error: "not-authed" }, { status: 401 });

  const body = await req.json().catch(() => null) as {
    title?:             string;
    projectId?:         string;
    photoUrl?:          string;
    assigneeListingId?: string;
    assigneeName?:      string;
    postId?:            string;
  } | null;
  if (!body?.title) return NextResponse.json({ ok: false, error: "missing-title" }, { status: 400 });

  const res = await createThingToFix({
    homeownerId:        homeowner.id,
    title:              body.title,
    projectId:          body.projectId          ?? null,
    photoUrl:           body.photoUrl           ?? null,
    assigneeListingId:  body.assigneeListingId  ?? null,
    assigneeName:       body.assigneeName       ?? null,
    postId:             body.postId             ?? null
  });
  if (!res.ok) return NextResponse.json({ ok: false, error: res.error }, { status: 400 });
  return NextResponse.json({ ok: true, id: res.thing.id });
}
