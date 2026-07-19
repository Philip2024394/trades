// POST /api/homeowner/posts — homeowner creates a new SiteBook post
//
// Body: {
//   projectId: string
//   title?: string
//   body: string (required)
//   kind?: 'update' | 'new-work' | 'question' | 'warranty' | 'completion'
//   visibility?: 'selected' | 'all-trades'
//   invitedListingIds?: string[]  // required when visibility='selected'
//   coverPhotoUrl?: string
// }

import { NextResponse } from "next/server";
import { getHomeownerFromCookie } from "@/lib/homeowners/auth";
import { createPost } from "@/lib/homeowners/posts";
import type { PostKind, PostVisibility } from "@/lib/homeowners/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const homeowner = await getHomeownerFromCookie();
  if (!homeowner) return NextResponse.json({ ok: false, error: "not-authed" }, { status: 401 });

  const body = await req.json().catch(() => null) as {
    projectId?: string;
    title?: string;
    body?: string;
    kind?: PostKind;
    visibility?: PostVisibility;
    invitedListingIds?: string[];
    coverPhotoUrl?: string;
  } | null;
  if (!body?.projectId) return NextResponse.json({ ok: false, error: "missing-project" }, { status: 400 });
  if (!body.body?.trim()) return NextResponse.json({ ok: false, error: "empty-body" },   { status: 400 });

  const res = await createPost({
    homeownerId:       homeowner.id,
    homeownerName:     homeowner.first_name || "Homeowner",
    projectId:         body.projectId,
    title:             body.title,
    body:              body.body,
    kind:              body.kind,
    visibility:        body.visibility,
    invitedListingIds: body.invitedListingIds,
    coverPhotoUrl:     body.coverPhotoUrl
  });

  if (!res.ok) return NextResponse.json({ ok: false, error: res.error }, { status: 400 });
  return NextResponse.json({ ok: true, postId: res.post.id });
}
